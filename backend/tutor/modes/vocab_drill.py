from .base import Mode

MODE = Mode(
    id="vocabulary-drill",
    title="Vocabulary Drill",
    description="Build useful vocabulary with exercises tailored to your current level.",
    icon="a-arrow-up",
    heading="Vocabulary practice",
    instructions="Mode: vocabulary drill (not a conversation).",
    enabled=True,  # has its own page and API (tutor/vocab.py), not the chat endpoint
    order=40,
)
