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
        "correction": {"type": "STRING", "nullable": True},
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
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": _to_contents(history),
        "generationConfig": {
            "temperature": 0.6,
            # Safety net only. The prompt keeps replies to 1-2 sentences; a tighter cap
            # would cut the JSON (reply + correction + translation + hint) mid-way.
            "maxOutputTokens": 400,
            "responseMimeType": "application/json",
            "responseSchema": REPLY_SCHEMA,
            # Skip "thinking" so replies come back fast enough for conversation.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            API_URL.format(model=model), json=body, headers={"x-goog-api-key": key}
        )
    if resp.status_code == 429:
        raise LLMError(
            "Gemini's free-tier limit was reached (too many messages this minute, or today's "
            "quota). Wait a minute and try again.",
            status=429,
        )
    if resp.status_code >= 400:
        detail = resp.json().get("error", {}).get("message", resp.text) if resp.content else ""
        raise LLMError(f"Gemini error {resp.status_code}: {detail}")

    try:
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise LLMError(f"Unexpected Gemini response: {exc}") from exc

    correction = (data.get("correction") or "").strip() or None
    return {
        "reply": data.get("reply", "").strip(),
        "correction": correction,
        "translation": (data.get("translation") or "").strip(),
        "hint": (data.get("hint") or "").strip(),
    }
