"""Claire's memory: practice sessions saved as JSON files on your own computer.

Files live in `sessions/` at the project root, which git ignores, so everyone's practice
stays on their own machine. Weak points are counted from the correction categories of the
most recent sessions; no AI is involved in counting.
"""

import json
import os
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

SESSIONS_DIR = Path(
    os.getenv("SESSIONS_DIR") or Path(__file__).resolve().parent.parent.parent / "sessions"
)
RECENT_SESSIONS = 5  # weak points come from this many latest sessions
_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")

# Shown to the learner and to Claire.
CATEGORY_LABELS = {
    "tense": "Verb tense",
    "conjugation": "Conjugation",
    "word_choice": "Word choice",
    "agreement": "Agreement",
    "gender": "Gender",
    "preposition": "Preposition",
    "article": "Article",
    "elision": "Elision",
    "english_word": "English words",
    "other": "Other",
}


def valid_id(session_id: str) -> bool:
    return bool(_ID.match(session_id))


def _path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}.json"


def load(session_id: str) -> dict | None:
    try:
        return json.loads(_path(session_id).read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _all_sessions() -> list[dict]:
    """Every saved session, newest first."""
    if not SESSIONS_DIR.is_dir():
        return []
    sessions = []
    for file in SESSIONS_DIR.glob("*.json"):
        try:
            sessions.append(json.loads(file.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            continue  # skip a damaged file rather than break the whole page
    return sorted(sessions, key=lambda s: s.get("started_at", ""), reverse=True)


def corrections_of(session: dict) -> list[dict]:
    return [m["correction"] for m in session.get("messages", []) if isinstance(m.get("correction"), dict)]


def stats(session: dict) -> dict:
    """Numbers for the summary screen and the home page."""
    learner = [m for m in session.get("messages", []) if m.get("role") == "learner"]
    by_category = Counter(c.get("category") or "other" for c in corrections_of(session))
    try:
        seconds = (
            datetime.fromisoformat(session["ended_at"]) - datetime.fromisoformat(session["started_at"])
        ).total_seconds()
    except (KeyError, ValueError):
        seconds = 0
    return {
        "id": session.get("id"),
        "mode": session.get("mode"),
        "level": session.get("level"),
        "started_at": session.get("started_at"),
        "duration_seconds": max(0, round(seconds)),
        "messages_sent": len(learner),
        "corrections": sum(by_category.values()),
        "by_category": [
            {"category": cat, "label": CATEGORY_LABELS.get(cat, cat), "count": n}
            for cat, n in by_category.most_common()
        ],
        "note": session.get("note"),
    }


def save(session: dict) -> dict:
    """Write (or overwrite) one session. Saving the same id twice keeps one file."""
    SESSIONS_DIR.mkdir(exist_ok=True)
    tmp = _path(session["id"]).with_suffix(".tmp")
    tmp.write_text(json.dumps(session, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(_path(session["id"]))  # atomic, so a crash never leaves half a file
    return stats(session)


def weak_points(top: int | None = 3) -> list[dict]:
    """Most frequent correction categories over the last few sessions, with an example each."""
    counts: Counter = Counter()
    examples: dict[str, dict] = {}
    for session in _all_sessions()[:RECENT_SESSIONS]:
        for c in corrections_of(session):
            cat = c.get("category") or "other"
            counts[cat] += 1
            # Keep the most recent example (sessions are newest first, so the first seen).
            examples.setdefault(cat, {"original": c.get("original", ""), "corrected": c.get("corrected", "")})
    ranked = [cat for cat, _ in counts.most_common() if cat != "other"] + (["other"] if "other" in counts else [])
    return [
        {"category": cat, "label": CATEGORY_LABELS.get(cat, cat), "count": counts[cat], "example": examples[cat]}
        for cat in ranked[:top]
    ]


def recent(limit: int = 5) -> list[dict]:
    return [stats(s) for s in _all_sessions()[:limit]]


def reset() -> int:
    """Delete every saved session. Returns how many were removed."""
    if not SESSIONS_DIR.is_dir():
        return 0
    removed = 0
    for file in SESSIONS_DIR.glob("*.json"):
        file.unlink(missing_ok=True)
        removed += 1
    return removed


def focus_for_prompt(points: list[dict]) -> list[str]:
    """Weak points phrased for Claire's instructions."""
    lines = []
    for p in points:
        ex = p["example"]
        example = f" (e.g. « {ex['original']} » → « {ex['corrected']} »)" if ex.get("original") else ""
        lines.append(f"{p['label']}: {p['count']} recent mistakes{example}")
    return lines
