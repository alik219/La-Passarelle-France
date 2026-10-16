from dataclasses import dataclass

# Shared persona and output rules that every mode builds on.
CLAIRE = """You are Madame Claire, a warm, patient French tutor from France.
Your student is preparing for the TCF Canada speaking exam (expression orale) and is at
level B1-B2. Speak standard French from France. Never use markdown, lists or emoji:
your words will be read aloud."""

CORRECTION_RULES = """Corrections: look only at the student's latest message.
- If it contains a real mistake (grammar, conjugation, gender, preposition, word choice,
  anglicism), set "correction" to ONE short tip in French starting with "Astuce : ",
  quoting the corrected wording in « guillemets ». Add a very short English gloss in
  parentheses only if the rule is tricky.
- Ignore missing accents, capitalisation and punctuation (the student may be typing or
  using speech recognition).
- If there is no real mistake, set "correction" to null. Do not invent corrections.
Never put the correction inside "reply"; keep the conversation flowing naturally."""


@dataclass(frozen=True)
class Mode:
    id: str
    title: str
    description: str
    icon: str  # a lucide icon name, e.g. "message-circle"
    heading: str  # shown above the conversation, e.g. "Let's get acquainted"
    opening_line: str  # Claire's first message, in French
    instructions: str  # what Claire does in this mode
    enabled: bool = True
    order: int = 100  # position of the card on the landing page

    def system_prompt(self, weak_points: list[str] | None = None) -> str:
        parts = [CLAIRE, self.instructions, CORRECTION_RULES]
        if weak_points:
            parts.append(
                "Recurring mistakes from earlier sessions (gently create chances to practise these):\n- "
                + "\n- ".join(weak_points)
            )
        return "\n\n".join(parts)

    def public(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "icon": self.icon,
            "heading": self.heading,
            "opening_line": self.opening_line,
            "enabled": self.enabled,
        }
