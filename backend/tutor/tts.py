"""Claire's voice: free Microsoft Edge neural voices through edge-tts."""

import base64
import os

import edge_tts

from .llm import LLMError

# edge-tts reports times in 100-nanosecond units.
_TICKS_PER_MS = 10_000


async def synthesize(text: str) -> dict:
    """Speak `text` in French.

    Returns base64 MP3 audio plus word timings in milliseconds, which the animated
    Claire (milestone 3) will use for lip-sync.
    """
    voice = os.getenv("TTS_VOICE", "fr-FR-DeniseNeural")
    audio = bytearray()
    words: list[str] = []
    wtimes: list[int] = []
    wdurations: list[int] = []
    try:
        stream = edge_tts.Communicate(text, voice, boundary="WordBoundary").stream()
        async for chunk in stream:
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append(chunk["text"])
                wtimes.append(round(chunk["offset"] / _TICKS_PER_MS))
                wdurations.append(round(chunk["duration"] / _TICKS_PER_MS))
    except Exception as exc:  # network problems, service changes, unknown voice...
        raise LLMError(f"Claire's voice is unavailable right now ({type(exc).__name__}).", status=503) from exc
    if not audio:
        raise LLMError("Claire's voice returned no audio. Try again.", status=502)
    return {
        "audio_b64": base64.b64encode(bytes(audio)).decode("ascii"),
        "mime": "audio/mpeg",
        "words": words,
        "wtimes": wtimes,
        "wdurations": wdurations,
    }
