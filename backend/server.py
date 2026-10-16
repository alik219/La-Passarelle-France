"""Passerelle France backend: practice modes and the tutor conversation API."""

import os
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

from tutor.llm import LLMError, translate, tutor_reply  # noqa: E402  (needs .env loaded first)
from tutor.modes import MODES, ordered  # noqa: E402
from tutor.modes.base import Address, Level  # noqa: E402

app = FastAPI(title="Passerelle France")


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
        system = mode.system_prompt(level=req.level, address=req.address)
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
