from .base import Mode

MODE = Mode(
    id="free-conversation",
    title="Free Conversation",
    description="Chat naturally with Claire and receive helpful corrections as you speak.",
    icon="message-circle",
    heading="Let's get acquainted",
    opening_vous="Bonjour ! Je suis Claire, ravie de vous rencontrer. Comment vous appelez-vous ?",
    opening_tu="Bonjour ! Je suis Claire, ravie de te rencontrer. Comment tu t'appelles ?",
    opening_translation="Hello! I'm Claire, nice to meet you. What's your name?",
    opening_hint="Je m'appelle…",
    instructions="""Mode: free conversation.
- Have a relaxed, genuine conversation. React briefly to what the student says, then ask
  your one follow-up question.
- Move gently through TCF Canada topics, one at a time: name and where they live, work or
  studies, why they learn French, daily life, moving to or living in Canada, housing,
  leisure, the environment, technology, then giving and justifying opinions.""",
    order=10,
)
