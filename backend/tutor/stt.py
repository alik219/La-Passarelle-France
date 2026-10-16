"""Hearing the learner: speech-to-text with Whisper on Groq's free API."""

import os

import httpx

from .llm import LLMError

GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

# Nudges Whisper to write what was actually said (mistakes included) instead of
# tidying it up, so Claire can correct it. The second sentence lists words learners often
# use, so Whisper recognises them instead of guessing ("ingénieur logiciel", not
# "anglo-lodgique"). Whisper reads at most ~224 tokens of prompt, so keep this short.
VERBATIM_PROMPT = (
    "Transcription mot à mot d'un apprenant de français, avec ses fautes éventuelles. "
    "Vocabulaire : ingénieur logiciel, développeur, informatique, étudiant, université, "
    "à vrai dire, d'ailleurs, cependant, néanmoins, en revanche, autrement dit, "
    "télétravail, logement, immigration, résidence permanente, TCF Canada, Québec, "
    "Montréal, Toronto, Ottawa, anglophone, francophone."
)


async def transcribe(audio: bytes, filename: str, content_type: str) -> str:
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        raise LLMError(
            "Speaking needs a Groq API key (free at https://console.groq.com/keys) in .env as GROQ_API_KEY.",
            status=503,
        )
    data = {
        "model": os.getenv("GROQ_STT_MODEL", "whisper-large-v3"),
        "language": "fr",
        "response_format": "json",
        "temperature": "0",
        "prompt": VERBATIM_PROMPT,
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                GROQ_STT_URL,
                data=data,
                files={"file": (filename, audio, content_type)},
                headers={"Authorization": f"Bearer {key}"},
            )
    except httpx.HTTPError as exc:
        raise LLMError(f"Couldn't reach Groq ({type(exc).__name__}). Check your internet connection.", status=503) from exc

    if resp.status_code == 401:
        raise LLMError("Groq rejected the API key. Check GROQ_API_KEY in .env.", status=503)
    if resp.status_code == 429:
        raise LLMError("Groq's free speech limit was reached. Wait a little, or type your answer.", status=429)
    if resp.status_code >= 400:
        raise LLMError(f"Transcription failed ({resp.status_code}): {resp.text[:200]}")
    text = (resp.json().get("text") or "").strip()
    # Whisper sometimes echoes the prompt when it hears silence.
    if not text or text == VERBATIM_PROMPT:
        raise LLMError("I couldn't hear anything. Check your microphone and try again.", status=422)
    return text
