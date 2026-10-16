"""Claire's AI "brain". This is the one place that talks to a language model.

Providers, chosen with LLM_PROVIDER in .env (and LLM_FALLBACK for when it fails):
- "groq": Groq's free cloud API. Very fast, ~1,000 requests a day. Needs GROQ_API_KEY.
- "gemini": Google's API. Free tier with a small daily quota. Needs GEMINI_API_KEY.
- "ollama": a free model running on your own computer. No key or quota, but it needs
  a few GB of free RAM and is slow without a graphics card.
"""

import json
import os

import httpx

# What Claire returns on every turn, as standard JSON Schema. Ollama uses it as-is;
# Gemini gets a converted copy (see _gemini_schema).
CORRECTION_SCHEMA = {
    "type": "object",
    "properties": {
        "original": {
            "type": "string",
            "description": "Only the wrong words, copied exactly from the student's message.",
        },
        "corrected": {
            "type": "string",
            "description": "The student's ENTIRE message rewritten in correct French "
            "(every sentence, not just the wrong part). One version only.",
        },
        "explanation": {
            "type": "string",
            "description": "One short plain-English sentence explaining the actual mistake "
            "in 'original' and the rule. Max 20 words.",
        },
        "category": {
            "type": "string",
            "enum": [
                "tense", "conjugation", "word_choice", "agreement", "gender",
                "preposition", "article", "elision", "english_word", "other",
            ],
        },
    },
    "required": ["original", "corrected", "explanation", "category"],
    "additionalProperties": False,
}

REPLY_SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "correction": {"anyOf": [CORRECTION_SCHEMA, {"type": "null"}]},
        "hint": {"type": "string"},
    },
    "required": ["reply", "correction", "hint"],
    "additionalProperties": False,
}

TRANSLATE_PROMPT = (
    "Translate the user's French text into natural, simple English. "
    "Reply with the translation only, no quotes or notes."
)


class LLMError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def _chain() -> list[str]:
    """Providers to try in order: the main one, then the fallback (if any)."""
    main = os.getenv("LLM_PROVIDER", "groq").strip().lower()
    fallback = os.getenv("LLM_FALLBACK", "ollama").strip().lower()
    chain = [main]
    if fallback and fallback not in ("none", main):
        chain.append(fallback)
    for name in chain:
        if name not in PROVIDERS:
            raise LLMError(f"Unknown AI provider '{name}'. Use groq, gemini or ollama.", status=500)
    return chain


async def _complete(system: str, turns: list[tuple[str, str]], schema: dict | None) -> str:
    """Ask the main provider; if it fails (limit, outage, offline), ask the fallback."""
    errors = []
    for name in _chain():
        try:
            return await PROVIDERS[name](system, turns, schema)
        except LLMError as exc:
            errors.append(exc)
    if len(errors) == 1:
        raise errors[0]
    first, last = errors[0], errors[-1]
    raise LLMError(f"{first} The backup also failed: {last}", status=last.status)


def _turns(history: list[dict]) -> list[tuple[str, str]]:
    """(role, text) pairs with role "user" or "assistant", starting with the user."""
    turns = [
        ("assistant" if t["role"] == "tutor" else "user", t["text"])
        for t in history
        if t.get("text", "").strip()
    ]
    # Chat models expect the conversation to start with the user.
    if not turns or turns[0][0] != "user":
        turns.insert(0, ("user", "Bonjour !"))
    return turns


async def tutor_reply(system: str, history: list[dict]) -> dict:
    """Claire's next turn: {"reply", "correction" (dict or None), "hint"}."""
    text = await _complete(system, _turns(history), REPLY_SCHEMA)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise LLMError(f"Claire's answer wasn't valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise LLMError("Claire's answer had the wrong shape. Try sending your message again.")

    correction = data.get("correction")
    if isinstance(correction, dict) and (correction.get("corrected") or "").strip():
        correction = {
            k: (correction.get(k) or "").strip()
            for k in ("original", "corrected", "explanation", "category")
        }
    else:
        correction = None
    return {
        "reply": (data.get("reply") or "").strip(),
        "correction": correction,
        "hint": (data.get("hint") or "").strip(),
    }


async def translate(text: str) -> str:
    """English translation of one of Claire's messages (fetched when the learner clicks EN)."""
    out = await _complete(TRANSLATE_PROMPT, [("user", text)], None)
    return out.strip().strip('"')


# ---------- Groq (cloud, OpenAI-compatible) ----------

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


async def _groq(system: str, turns: list[tuple[str, str]], schema: dict | None) -> str:
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        raise LLMError(
            "No Groq API key. Create a free one at https://console.groq.com/keys and put it "
            "in .env as GROQ_API_KEY.",
            status=503,
        )
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    body: dict = {
        "model": model,
        "messages": [{"role": "system", "content": system}]
        + [{"role": role, "content": text} for role, text in turns],
        "temperature": 0.6,
        # Room for reasoning models' hidden thinking plus Claire's JSON.
        "max_tokens": 1500,
    }
    if model.startswith("openai/gpt-oss"):
        body["reasoning_effort"] = "low"  # think briefly: fast replies, still careful corrections
    if schema:
        body["messages"][0]["content"] += (
            "\n\nAnswer with one JSON object only, matching this JSON Schema:\n" + json.dumps(schema)
        )
        if model.startswith("openai/gpt-oss"):
            # Strict mode: Groq guarantees the reply matches the schema exactly.
            body["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "claire_turn", "strict": True, "schema": schema},
            }
        else:
            body["response_format"] = {"type": "json_object"}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            for _attempt in range(2):
                resp = await client.post(GROQ_URL, json=body, headers={"Authorization": f"Bearer {key}"})
                # In loose JSON mode the model occasionally drifts into plain text; one retry fixes it.
                if not (resp.status_code == 400 and "json_validate_failed" in resp.text):
                    break
    except httpx.HTTPError as exc:
        raise LLMError(f"Couldn't reach Groq ({type(exc).__name__}). Check your internet connection.", status=503) from exc

    if resp.status_code == 401:
        raise LLMError("Groq rejected the API key. Check GROQ_API_KEY in .env.", status=503)
    if resp.status_code == 429:
        raise LLMError("Groq's free limit was reached. Wait a little and try again.", status=429)
    if resp.status_code >= 500:
        raise LLMError("Groq is having trouble right now. Try again in a moment.", status=503)
    if resp.status_code >= 400:
        raise LLMError(f"Groq error {resp.status_code}: {resp.text[:300]}")
    try:
        return resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        raise LLMError(f"Unexpected Groq response: {exc}") from exc


# ---------- Ollama (local) ----------

async def _ollama(system: str, turns: list[tuple[str, str]], schema: dict | None) -> str:
    url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "gemma3:4b")
    body = {
        "model": model,
        "messages": [{"role": "system", "content": system}]
        + [{"role": role, "content": text} for role, text in turns],
        "stream": False,
        "keep_alive": "30m",  # keep the model in memory between messages
        "options": {"temperature": 0.6, "num_predict": 400},
    }
    if schema:
        body["format"] = schema
    try:
        # Generous timeout: on a CPU-only laptop the first reply also loads the model.
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(f"{url}/api/chat", json=body)
    except httpx.ConnectError as exc:
        raise LLMError(
            "Ollama isn't running. Start the Ollama app (or run `ollama serve`) and try again.",
            status=503,
        ) from exc
    except httpx.TimeoutException as exc:
        raise LLMError("Ollama took too long to answer. Try again, or use a smaller model.", status=504) from exc

    if resp.status_code == 404:
        raise LLMError(f"The model {model} isn't downloaded yet. Run: ollama pull {model}", status=503)
    if resp.status_code >= 400:
        raise LLMError(f"Ollama error {resp.status_code}: {resp.text[:300]}")
    try:
        return resp.json()["message"]["content"]
    except (KeyError, ValueError) as exc:
        raise LLMError(f"Unexpected Ollama response: {exc}") from exc


# ---------- Gemini (Google API) ----------

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _gemini_schema(schema: dict) -> dict:
    """Convert standard JSON Schema to Gemini's dialect (UPPERCASE types, nullable)."""
    if "anyOf" in schema:
        options = [s for s in schema["anyOf"] if s.get("type") != "null"]
        return {**_gemini_schema(options[0]), "nullable": True}
    out = {k: v for k, v in schema.items() if k in ("description", "enum", "required")}
    out["type"] = schema["type"].upper()
    if "properties" in schema:
        out["properties"] = {k: _gemini_schema(v) for k, v in schema["properties"].items()}
        out["propertyOrdering"] = list(schema["properties"])
    return out


async def _gemini(system: str, turns: list[tuple[str, str]], schema: dict | None) -> str:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise LLMError(
            "No Gemini API key. Get a free one at https://aistudio.google.com/apikey and put "
            "it in .env as GEMINI_API_KEY.",
            status=503,
        )
    # Free-tier quotas are per model (gemini-2.5-flash allows only ~20 requests a day), so
    # when the main model is out of quota or busy, the fallback model answers instead.
    models = [os.getenv("GEMINI_MODEL", "gemini-2.5-flash")]
    fallback = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite").strip()
    if fallback and fallback not in models:
        models.append(fallback)
    # Think a little for Claire's replies (better corrections), not for translations.
    budget = int(os.getenv("GEMINI_THINKING_BUDGET", "512")) if schema else 0

    config: dict = {
        "temperature": 0.6,
        # Safety net only; a tight cap would cut the JSON mid-way.
        "maxOutputTokens": 600 + budget,
        # A little "thinking" makes corrections much more accurate.
        "thinkingConfig": {"thinkingBudget": budget},
    }
    if schema:
        config["responseMimeType"] = "application/json"
        config["responseSchema"] = _gemini_schema(schema)
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [
            {"role": "model" if role == "assistant" else "user", "parts": [{"text": text}]}
            for role, text in turns
        ],
        "generationConfig": config,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            for model in models:
                resp = await client.post(
                    GEMINI_URL.format(model=model), json=body, headers={"x-goog-api-key": key}
                )
                if resp.status_code not in (429, 503):
                    break  # success, or an error a different model wouldn't fix
    except httpx.HTTPError as exc:
        raise LLMError(f"Couldn't reach Gemini ({type(exc).__name__}). Check your internet connection.", status=503) from exc
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
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise LLMError(f"Unexpected Gemini response: {exc}") from exc


# Names usable in LLM_PROVIDER / LLM_FALLBACK.
PROVIDERS = {"groq": _groq, "gemini": _gemini, "ollama": _ollama}
