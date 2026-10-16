from .base import Mode

MODE = Mode(
    id="timed-exam",
    title="Timed Exam",
    description="Practice all three speaking tasks under realistic TCF Canada exam conditions.",
    icon="timer",
    heading="TCF Canada: expression orale",
    instructions="Mode: timed exam simulation (not built yet).",
    enabled=True,  # has its own page and API (tutor/exam.py), not the chat endpoint
    order=20,
)
