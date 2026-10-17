"""Claire's memory: practice sessions saved as JSON files on your own computer.

Files live in `sessions/` at the project root, which git ignores, so everyone's practice
stays on their own machine. Weak points are counted from the correction categories of the
most recent sessions; no AI is involved in counting.
"""

import json
import os
import re
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path

SESSIONS_DIR = Path(
    os.getenv("SESSIONS_DIR") or Path(__file__).resolve().parent.parent.parent / "sessions"
)
RECENT_SESSIONS = 5  # weak points come from this many latest sessions
DRILL_MODE = "vocabulary-drill"  # vocabulary drills have no corrections, so they never count as weak points
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
    return sorted(sessions, key=_started, reverse=True)


def _started(session: dict) -> datetime:
    """When a session started, as a comparable time (local-offset and older UTC "Z" formats)."""
    try:
        t = datetime.fromisoformat(session["started_at"].replace("Z", "+00:00"))
        return t if t.tzinfo else t.astimezone()
    except (KeyError, ValueError, AttributeError):
        return datetime.min.replace(tzinfo=datetime.now().astimezone().tzinfo)


def corrections_of(session: dict) -> list[dict]:
    """Corrections attached to messages, plus those from an exam's end-of-task feedback."""
    inline = [m["correction"] for m in session.get("messages", []) if isinstance(m.get("correction"), dict)]
    return inline + [c for c in session.get("extra_corrections", []) if isinstance(c, dict)]


def stats(session: dict) -> dict:
    """Numbers for the summary screen and the home page."""
    learner = [m for m in session.get("messages", []) if m.get("role") == "learner"]
    by_category = Counter(c.get("category") or "other" for c in corrections_of(session))
    try:
        ended = datetime.fromisoformat(session["ended_at"].replace("Z", "+00:00"))
        seconds = (ended - _started(session)).total_seconds()
    except (KeyError, ValueError, AttributeError, TypeError):
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
        "exam": session.get("exam"),  # score and NCLC for exam simulations, else None
        "drill": _drill_stats(session),  # topic and score for vocabulary drills, else None
    }


def _drill_stats(session: dict) -> dict | None:
    drill = session.get("drill")
    if not isinstance(drill, dict):
        return None
    return {"topic": drill.get("topic"), "topic_title": drill.get("topic_title"),
            "total": drill.get("total", 0), "correct": drill.get("correct", 0)}


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
    # Vocabulary drills don't use up the window: weak points are about grammar in what you say.
    for session in [s for s in _all_sessions() if s.get("mode") != DRILL_MODE][:RECENT_SESSIONS]:
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


def _day(session: dict):
    """The local calendar day a session started (older exams were saved in UTC)."""
    if not session.get("started_at"):
        return None
    started = _started(session)
    return None if started.year == 1 else started.astimezone().date()


def _streak(days: set) -> int:
    """Days in a row with practice, ending today (or yesterday, if not practised yet today)."""
    day = date.today()
    if day not in days:
        day -= timedelta(days=1)
    count = 0
    while day in days:
        count += 1
        day -= timedelta(days=1)
    return count


def report(period_days: int | None) -> dict:
    """Numbers for the Feedback Report: stats, exam scores and mistakes over a period.

    `period_days` = 7 or 30 for the last N days (today included), None for all time.
    Counting only; no AI.
    """
    everything = list(reversed(_all_sessions()))  # oldest first
    start = date.today() - timedelta(days=period_days - 1) if period_days else None
    sessions = [s for s in everything if (d := _day(s)) and (start is None or d >= start)]

    # Mistake categories are coloured by their all-time rank, so switching the period
    # never repaints a category in another colour.
    all_time = Counter(c.get("category") or "other" for s in everything for c in corrections_of(s))
    colour_order = [cat for cat, _ in all_time.most_common() if cat != "other"]

    # Time buckets: days for the last 7 days; weeks (starting Monday) for longer periods, since
    # people rarely practise every day and daily points would mostly be zeros.
    first = start or (_day(sessions[0]) if sessions else date.today())
    span = (date.today() - first).days + 1
    weekly = period_days != 7 and span > 7
    if weekly:
        first -= timedelta(days=first.weekday())
        span = (date.today() - first).days + 1  # recount from the Monday, so this week is included
    step = 7 if weekly else 1
    buckets = [first + timedelta(days=i) for i in range(0, max(span, 1), step)]

    def bucket_of(d):
        return (d - first).days // step

    per_bucket = [Counter() for _ in buckets]
    per_category = Counter()
    examples: dict[str, dict] = {}
    seconds = messages = 0
    exams = []
    word_results: dict[str, bool] = {}  # word id -> right at its latest drill in the period
    for s in sessions:
        st = stats(s)
        seconds += st["duration_seconds"]
        messages += st["messages_sent"]
        idx = bucket_of(_day(s))
        for c in corrections_of(s):
            cat = c.get("category") or "other"
            if 0 <= idx < len(per_bucket):
                per_bucket[idx][cat] += 1
            per_category[cat] += 1
            examples[cat] = {"original": c.get("original", ""), "corrected": c.get("corrected", "")}  # latest wins
        for w in (s.get("drill") or {}).get("words", []):
            if isinstance(w, dict) and w.get("id"):
                word_results[w["id"]] = bool(w.get("correct"))  # oldest first, so the latest wins
        if s.get("exam"):
            ex = s["exam"]
            exams.append({
                "date": s.get("started_at"),
                "score": ex.get("score"),
                "nclc": ex.get("nclc"),
                "tasks": {str(t["task"]): t["score"] for t in ex.get("tasks", [])},
            })

    categories = sorted(per_category, key=lambda c: (-per_category[c], c))
    return {
        "period_days": period_days,
        "stats": {
            "seconds": seconds,
            "sessions": len(sessions),
            "conversations": sum(1 for s in sessions if not s.get("exam") and s.get("mode") != DRILL_MODE),
            "exams": len(exams),
            "drills": sum(1 for s in sessions if s.get("mode") == DRILL_MODE),
            "words_learned": sum(word_results.values()),
            "messages": messages,
            "corrections": sum(per_category.values()),
            "active_days": len({_day(s) for s in sessions}),
            "streak": _streak({_day(s) for s in everything}),
        },
        "exams": exams,
        "mistakes": {
            "weekly": weekly,
            "buckets": [b.isoformat() for b in buckets],
            "series": {cat: [b.get(cat, 0) for b in per_bucket] for cat in categories},
            "categories": [
                {"category": cat, "label": CATEGORY_LABELS.get(cat, cat), "count": per_category[cat],
                 "example": examples.get(cat, {"original": "", "corrected": ""})}
                for cat in categories
            ],
            "colour_order": colour_order,
        },
    }


def focus_for_prompt(points: list[dict]) -> list[str]:
    """Weak points phrased for Claire's instructions."""
    lines = []
    for p in points:
        ex = p["example"]
        example = f" (e.g. « {ex['original']} » → « {ex['corrected']} »)" if ex.get("original") else ""
        lines.append(f"{p['label']}: {p['count']} recent mistakes{example}")
    return lines
