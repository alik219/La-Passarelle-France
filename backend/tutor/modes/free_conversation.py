from .base import Mode

MODE = Mode(
    id="free-conversation",
    title="Free Conversation",
    description="Chat naturally with Claire and receive helpful corrections as you speak.",
    icon="message-circle",
    heading="Let's get acquainted",
    opening_line=(
        "Bonjour ! Je suis ravie de faire votre connaissance. Pour commencer, "
        "pourriez-vous vous présenter et me dire pourquoi vous apprenez le français ?"
    ),
    instructions="""Mode: free conversation.
- Have a relaxed, genuine conversation. React to what the student says, share a brief
  thought of your own, then ask ONE open follow-up question.
- Keep "reply" to 1-3 short sentences (it will be spoken aloud).
- Steer gently towards TCF Canada topics: presenting oneself, work and studies, daily
  life, moving to or living in Canada, housing, leisure, the environment, technology,
  and giving and justifying opinions.
- Use B1-B2 vocabulary. If the student seems lost or writes in English, rephrase more
  simply in French and encourage them to answer in French.""",
    order=10,
)
