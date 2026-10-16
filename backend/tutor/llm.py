"""Gemini client. This is the one place to change if you want a different AI provider."""

import json
import os

import httpx

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Claire always answers with this shape, so the UI can show corrections separately.
REPLY_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "reply": {"type": "STRING"},
        "correction": {
            "type": "OBJECT",
            "nullable": True,
            "properties": {
                "original": {
                    "type": "STRING",
                    "description": "Only the wrong words, copied exactly from the student's message.",
                },
                "corrected": {
                    "type": "STRING",
                    "description": "The student's ENTIRE message rewritten in correct French "
                    "(every sentence, not just the wrong part). One version only.",
                },
                "explanation": {
                    "type": "STRING",
                    "description": "One short plain-English sentence explaining the actual "
                    "mistake in 'original' and the rule. Max 20 words.",
                },
                "category": {
                    "type": "STRING",
                    "enum": [
                        "tense", "conjugation", "word_choice", "agreement", "gender",
                        "preposition", "article", "elision", "english_word", "other",
                    ],
                },
            },
            "required": ["original", "corrected", "explanation", "category"],
            "propertyOrdering": ["original", "corrected", "explanation", "category"],
        },
        "translation": {"type": "STRING"},
        "hint": {"type": "STRING"},
    },
    "required": ["reply", "correction", "translation", "hint"],
    "propertyOrdering": ["reply", "correction", "translation", "hint"],
}


class LLMError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def _to_contents(history: list[dict]) -> list[dict]:
    contents = [
        {"role": "model" if turn["role"] == "tutor" else "user", "parts": [{"text": turn["text"]}]}
        for turn in history
        if turn.get("text", "").strip()
    ]
    # Gemini expects the conversation to start with the user.
    if not contents or contents[0]["role"] != "user":
        contents.insert(0, {"role": "user", "parts": [{"text": "Bonjour !"}]})
    return contents


async def tutor_reply(system: str, history: list[dict]) -> dict:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise LLMError(
            "No Gemini API key. Get a free one at https://aistudio.google.com/apikey "
            "and put it in .env as GEMINI_API_KEY.",
            status=503,
        )
    # Free-tier quotas are per model (gemini-2.5-flash allows only ~20 requests a day), so
    # when the main model is out of quota or busy, Claire answers with the fallback model.
    models = [os.getenv("GEMINI_MODEL", "gemini-2.5-flash")]
    fallback = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite").strip()
    if fallback and fallback not in models:
        models.append(fallback)
    thinking = int(os.getenv("GEMINI_THINKING_BUDGET", "512"))
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": _to_contents(history),
        "generationConfig": {
            "temperature": 0.6,
            # Safety net only. The prompt keeps replies to 1-2 sentences; a tighter cap
            # would cut the JSON (reply + correction + translation + hint) mid-way.
            "maxOutputTokens": 600 + thinking,
            "responseMimeType": "application/json",
            "responseSchema": REPLY_SCHEMA,
            # A little "thinking" makes corrections much more accurate; kept small so
            # replies still come back fast enough for conversation.
            "thinkingConfig": {"thinkingBudget": thinking},
        },
    }
    async with httpx.AsyncClient(timeout=30) as client:
        for model in models:
            resp = await client.post(
                API_URL.format(model=model), json=body, headers={"x-goog-api-key": key}
            )
            if resp.status_code not in (429, 503):
                break  # success, or an error a different model wouldn't fix
    if resp.status_code == 429:
        if "PerDay" in resp.text:
            msg = "You've used today's free Gemini quota. It resets at midnight Pacific time."
        else:
            msg = "Too many messages in the last minute for Gemini's free tier. Wait a minute and try again."
        raise LLMError(msg, status=429)
    if resp.status_code == 503:
        raise LLMError("Gemini is very busy right now. Try again in a moment.", status=503)
    if resp.status_code >= 400:
        detail = resp.json().get("error", {}).get("message", resp.text) if resp.content else ""
        raise LLMError(f"Gemini error {resp.status_code}: {detail}")

    try:
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise LLMError(f"Unexpected Gemini response: {exc}") from exc

    correction = data.get("correction")
    if not (isinstance(correction, dict) and (correction.get("corrected") or "").strip()):
        correction = None
    else:
        correction = {k: (correction.get(k) or "").strip() for k in ("original", "corrected", "explanation", "category")}
    return {
        "reply": data.get("reply", "").strip(),
        "correction": correction,
        "translation": (data.get("translation") or "").strip(),
        "hint": (data.get("hint") or "").strip(),
    }
