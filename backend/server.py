"""Passerelle France backend: practice modes and the tutor conversation API."""

import os
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

from tutor import exam, memory  # noqa: E402
from tutor.llm import (  # noqa: E402  (needs .env loaded first)
    LLMError,
    exam_evaluate,
    exam_turn,
    session_note,
    translate,
    tutor_reply,
)
from tutor.modes import MODES, ordered  # noqa: E402
from tutor.modes.base import Address, Level  # noqa: E402
from tutor.stt import transcribe  # noqa: E402
from tutor.tts import synthesize  # noqa: E402

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # ~10 minutes of compressed speech; plenty for one answer

app = FastAPI(title="Passerelle France")

# Only this computer's own pages may use the API. Without this, any website open in your
# browser could send requests to localhost (using up your free quota or wiping progress),
# and a "DNS rebinding" site could even read the replies.
LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]"}
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "[::1]"])


@app.middleware("http")
async def same_site_only(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and urlparse(origin).hostname not in {h.strip("[]") for h in LOCAL_HOSTS}:
        return JSONResponse({"detail": "Requests from other websites aren't allowed."}, status_code=403)
    return await call_next(request)


class Turn(BaseModel):
    role: str = Field(pattern="^(tutor|learner)$")
    text: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    mode: str
    history: list[Turn] = Field(max_length=200)
    level: Level = "A2"
    address: Address = "vous"


@app.get("/api/modes")
def list_modes():
    return [m.public() for m in ordered()]


@app.post("/api/chat")
async def chat(req: ChatRequest):
    mode = MODES.get(req.mode)
    if not mode or not mode.enabled:
        raise HTTPException(404, f"Unknown or unavailable mode: {req.mode}")
    try:
        # Claire quietly gives you chances to practise your top 3 recent weak points.
        focus = memory.focus_for_prompt(memory.weak_points(top=3))
        system = mode.system_prompt(level=req.level, address=req.address, weak_points=focus)
        return await tutor_reply(system, [t.model_dump() for t in req.history])
    except LLMError as exc:
        raise HTTPException(exc.status, str(exc)) from exc


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@app.post("/api/translate")
async def translate_text(req: TranslateRequest):
    try:
        return {"translation": await translate(req.text)}
    except LLMError as exc:
        raise HTTPException(exc.status, str(exc)) from exc


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@app.post("/api/tts")
async def speak(req: SpeakRequest):
    """Claire's voice for one message: MP3 audio plus word timings."""
    try:
        return await synthesize(req.text)
    except LLMError as exc:
        raise HTTPException(exc.status, str(exc)) from exc


@app.post("/api/transcribe")
async def hear(audio: UploadFile):
    """The learner's recorded answer, as French text."""
    data = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "That recording is too long. Keep answers under a few minutes.")
    if not data:
        raise HTTPException(422, "The recording was empty. Try again.")
    try:
        text = await transcribe(data, audio.filename or "answer.webm", audio.content_type or "audio/webm")
    except LLMError as exc:
        raise HTTPException(exc.status, str(exc)) from exc
    return {"text": text}


# ---------- Memory: saved sessions and weak points ----------

class SavedCorrection(BaseModel):
    original: str = Field(default="", max_length=2000)
    corrected: str = Field(default="", max_length=4000)
    explanation: str = Field(default="", max_length=1000)
    category: str = Field(default="other", max_length=40)


class SavedTurn(Turn):
    correction: SavedCorrection | None = None


class SessionRequest(BaseModel):
    id: str
    mode: str = Field(max_length=64)
    level: Level = "A2"
    address: Address = "vous"
    started_at: str = Field(max_length=40)
    messages: list[SavedTurn] = Field(max_length=400)
    write_note: bool = True  # False when saved by the page closing (no one will read it then)


@app.post("/api/sessions")
async def save_session(req: SessionRequest):
    """Save a finished session (End session, or the tab closing) and write Claire's note."""
    if not memory.valid_id(req.id):
        raise HTTPException(422, "Invalid session id.")
    messages = [m.model_dump() for m in req.messages]
    learner_count = sum(1 for m in messages if m["role"] == "learner")
    if learner_count == 0:
        return {"saved": False}  # nothing practised, nothing to keep

    previous = memory.load(req.id) or {}
    session = {
        "id": req.id,
        "mode": req.mode,
        "level": req.level,
        "address": req.address,
        "started_at": req.started_at,
        "ended_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "messages": messages,
        "note": previous.get("note") if len(previous.get("messages", [])) == len(messages) else None,
    }
    if req.write_note and not session["note"]:
        try:
            corrections = [m["correction"] for m in messages if m.get("correction")]
            session["note"] = await session_note(req.level, corrections, learner_count)
        except LLMError:
            session["note"] = None  # still save the session without a note
    return {"saved": True, **memory.save(session)}


@app.get("/api/progress")
def progress():
    """Top weak points (from the last 5 sessions) and the most recent sessions."""
    return {"weak_points": memory.weak_points(top=3), "sessions": memory.recent(limit=5)}


@app.delete("/api/progress")
def reset_progress():
    return {"removed": memory.reset()}


# ---------- TCF Canada timed exam ----------

@app.get("/api/exam/plan")
def exam_plan(tasks: str = "1,2,3"):
    """A fresh exam: the chosen tasks (e.g. "1,2,3" or "2") with a random situation/statement."""
    try:
        numbers = sorted({int(t) for t in tasks.split(",") if t.strip()})
    except ValueError as exc:
        raise HTTPException(422, "tasks must be numbers like 1,2,3") from exc
    if not numbers or any(n not in exam.TASKS for n in numbers):
        raise HTTPException(422, "tasks must be 1, 2 and/or 3")
    return {"tasks": exam.plan(numbers), "closing": exam.CLOSING, "closing_translation": exam.CLOSING_EN}


class ExamTaskRequest(BaseModel):
    task: int = Field(ge=1, le=3)
    item_id: str | None = Field(default=None, max_length=16)
    history: list[Turn] = Field(max_length=200)


def _exam_item(req: ExamTaskRequest) -> dict | None:
    item = exam.item_for(req.task, req.item_id)
    if req.task in (2, 3) and not item:
        raise HTTPException(422, "Unknown exam situation or statement.")
    return item


@app.post("/api/exam/turn")
async def exam_next_turn(req: ExamTaskRequest):
    """The examiner's next line. No corrections during the task, as in the real exam."""
    try:
        system = exam.examiner_prompt(req.task, _exam_item(req))
        return await exam_turn(system, [t.model_dump() for t in req.history])
    except LLMError as exc:
        raise HTTPException(exc.status, str(exc)) from exc


@app.post("/api/exam/evaluate")
async def exam_score(req: ExamTaskRequest):
    """Score one finished task: /20, NCLC estimate, strengths, improvements, corrections."""
    item = _exam_item(req)
    history = [t.model_dump() for t in req.history]
    if not any(t["role"] == "learner" and t["text"].strip() for t in history):
        result = {"score": 0, "strengths": [], "corrections": [],
                  "improvements": ["You didn't answer during this task. In the real exam, silence scores zero."]}
    else:
        try:
            result = await exam_evaluate(exam.evaluation_prompt(req.task, item), history)
        except LLMError as exc:
            raise HTTPException(exc.status, str(exc)) from exc
    return {**result, "nclc": exam.nclc(result["score"]), "task": req.task}


class ExamTaskRecord(BaseModel):
    task: int = Field(ge=1, le=3)
    item_id: str | None = Field(default=None, max_length=16)
    history: list[Turn] = Field(max_length=200)
    score: int = Field(ge=0, le=20)
    corrections: list[SavedCorrection] = Field(default=[], max_length=10)


class ExamSaveRequest(BaseModel):
    id: str
    started_at: str = Field(max_length=40)
    practice_mode: bool = False
    tasks: list[ExamTaskRecord] = Field(min_length=1, max_length=3)


@app.post("/api/exam/save")
def exam_save(req: ExamSaveRequest):
    """Save an exam (after each finished task, so nothing is lost) to your progress."""
    if not memory.valid_id(req.id):
        raise HTTPException(422, "Invalid session id.")
    tasks = sorted(req.tasks, key=lambda t: t.task)
    overall = round(sum(t.score for t in tasks) / len(tasks))
    messages, corrections = [], []
    for t in tasks:
        messages += [m.model_dump() for m in t.history]
        corrections += [c.model_dump() for c in t.corrections]
    scores = ", ".join(f"Task {t.task}: {t.score}/20" for t in tasks)
    session = {
        "id": req.id,
        "mode": "timed-exam",
        "level": "exam",
        "address": "vous",
        "started_at": req.started_at,
        "ended_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "messages": messages,
        "extra_corrections": corrections,  # counted in weak points like conversation corrections
        "exam": {
            "practice_mode": req.practice_mode,
            "tasks": [{"task": t.task, "item_id": t.item_id, "score": t.score, "nclc": exam.nclc(t.score)} for t in tasks],
            "score": overall,
            "nclc": exam.nclc(overall),
        },
        "note": f"TCF exam simulation ({len(tasks)} task{'s' if len(tasks) > 1 else ''}): "
        f"{scores}. Estimated overall {overall}/20 ({exam.nclc(overall)}).",
    }
    return {"saved": True, **memory.save(session)}


# In production, serve the built website from web/dist.
DIST = ROOT / "web" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        file = (DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(DIST):
            return FileResponse(file)
        return FileResponse(DIST / "index.html")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("PORT", "8000")))
