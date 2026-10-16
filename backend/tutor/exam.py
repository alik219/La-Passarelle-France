"""TCF Canada speaking exam (expression orale) simulation.

The real exam has three tasks, about 12 minutes in total:
  1. Entretien dirigé (guided interview), 2 min, no preparation.
  2. Exercice en interaction (interactive exercise), 5 min 30: 2 min preparation, then
     3 min 30 where the candidate asks the examiner questions about a situation.
  3. Expression d'un point de vue (giving an opinion), 4 min 30, no preparation.
Each task is marked out of 20, which converts to an NCLC (Canadian Language Benchmark) level.
"""

import random
from dataclasses import dataclass


@dataclass(frozen=True)
class Task:
    number: int
    title: str  # English, for the interface
    title_fr: str
    instructions: str  # what the candidate does, in English
    talk_seconds: int
    prep_seconds: int = 0


TASKS = {
    1: Task(1, "Guided interview", "Entretien dirigé",
            "Claire asks you questions about yourself: your life, work or studies, interests and plans. "
            "Answer in full sentences and give details.", 120),
    2: Task(2, "Interactive exercise", "Exercice en interaction",
            "Read the situation. You have up to 2 minutes to prepare, then you ask Claire questions to "
            "get the information you need. She plays the other person.", 210, prep_seconds=120),
    3: Task(3, "Giving an opinion", "Expression d'un point de vue",
            "Claire gives you a statement. Say whether you agree, explain why with arguments and examples, "
            "and defend your point of view when she challenges it.", 270),
}

# Task 2 situations: the candidate asks questions; Claire plays the role.
SITUATIONS = [
    {"id": "s1", "role": "le propriétaire de l'appartement",
     "fr": "Vous venez d'arriver à Montréal et vous cherchez un appartement. Vous appelez le propriétaire d'un "
           "appartement à louer. Posez-lui des questions (loyer, quartier, charges, date d'entrée…).",
     "en": "You've just arrived in Montreal and are looking for an apartment. You call the owner of one for rent. "
           "Ask about the rent, the neighbourhood, utilities, move-in date…"},
    {"id": "s2", "role": "la responsable des inscriptions du club de sport",
     "fr": "Vous voulez vous inscrire dans un club de sport près de chez vous. Vous parlez à la responsable des "
           "inscriptions. Posez-lui des questions (activités, horaires, prix, matériel…).",
     "en": "You want to join a sports club near your home. You speak to the person in charge of registrations. "
           "Ask about activities, opening hours, prices, equipment…"},
    {"id": "s3", "role": "l'employé de l'agence de voyages",
     "fr": "Vous voulez partir une semaine en vacances en Gaspésie. Vous êtes dans une agence de voyages. Posez des "
           "questions à l'employé (transport, hébergement, activités, prix…).",
     "en": "You want a one-week holiday in the Gaspé Peninsula. You're at a travel agency. Ask the agent about "
           "transport, accommodation, activities, prices…"},
    {"id": "s4", "role": "la directrice de l'école de langues",
     "fr": "Vous souhaitez suivre des cours de français le soir. Vous rencontrez la directrice d'une école de langues. "
           "Posez-lui des questions (niveaux, horaires, durée, tarif, certificat…).",
     "en": "You'd like to take evening French classes. You meet the director of a language school. Ask about levels, "
           "schedule, length, fees, certificate…"},
    {"id": "s5", "role": "le responsable du recrutement",
     "fr": "Vous avez vu une offre d'emploi pour un poste de serveur à temps partiel dans un restaurant. Vous appelez le "
           "responsable du recrutement. Posez-lui des questions (horaires, salaire, tâches, expérience demandée…).",
     "en": "You saw a part-time waiter job ad at a restaurant. You call the hiring manager. Ask about hours, pay, "
           "duties, experience required…"},
    {"id": "s6", "role": "la voisine qui organise la fête de quartier",
     "fr": "Votre voisine organise une fête de quartier et vous voulez participer. Posez-lui des questions (date, lieu, "
           "programme, ce qu'il faut apporter, aide nécessaire…).",
     "en": "Your neighbour is organising a street party and you want to take part. Ask about the date, place, programme, "
           "what to bring, help needed…"},
    {"id": "s7", "role": "l'employée de la bibliothèque municipale",
     "fr": "Vous venez de vous installer dans une nouvelle ville et vous voulez utiliser la bibliothèque municipale. "
           "Posez des questions à l'employée (inscription, documents, horaires, services, activités…).",
     "en": "You've just moved to a new town and want to use the public library. Ask the librarian about signing up, "
           "documents needed, opening hours, services, activities…"},
    {"id": "s8", "role": "le vendeur de vélos d'occasion",
     "fr": "Vous voulez acheter un vélo d'occasion que vous avez vu sur une petite annonce. Vous appelez le vendeur. "
           "Posez-lui des questions (état, âge, prix, accessoires, rendez-vous pour l'essayer…).",
     "en": "You want to buy a second-hand bike from an online ad. You call the seller. Ask about its condition, age, "
           "price, accessories, a time to try it…"},
]

# Task 3 statements: the candidate gives and defends an opinion.
STATEMENTS = [
    {"id": "t1", "fr": "Le télétravail devrait devenir la norme pour tous les métiers qui le permettent.",
     "en": "Remote work should become the norm for every job where it's possible."},
    {"id": "t2", "fr": "Les réseaux sociaux font plus de mal que de bien aux jeunes.",
     "en": "Social media does young people more harm than good."},
    {"id": "t3", "fr": "Il vaut mieux vivre à la campagne qu'en ville.",
     "en": "It's better to live in the countryside than in a city."},
    {"id": "t4", "fr": "Apprendre une deuxième langue devrait être obligatoire dès l'école primaire.",
     "en": "Learning a second language should be compulsory from primary school."},
    {"id": "t5", "fr": "Les transports en commun devraient être gratuits pour tout le monde.",
     "en": "Public transport should be free for everyone."},
    {"id": "t6", "fr": "Les gens travaillent trop aujourd'hui et ne profitent pas assez de la vie.",
     "en": "People work too much nowadays and don't enjoy life enough."},
    {"id": "t7", "fr": "Chacun est responsable de la protection de l'environnement, pas seulement les gouvernements.",
     "en": "Protecting the environment is everyone's responsibility, not just governments'."},
    {"id": "t8", "fr": "Les immigrants devraient obligatoirement apprendre la langue de leur pays d'accueil.",
     "en": "Immigrants should be required to learn the language of their new country."},
    {"id": "t9", "fr": "L'intelligence artificielle va supprimer plus d'emplois qu'elle n'en créera.",
     "en": "Artificial intelligence will destroy more jobs than it creates."},
    {"id": "t10", "fr": "Faire du sport régulièrement est plus important que suivre un régime alimentaire strict.",
     "en": "Exercising regularly matters more than following a strict diet."},
]

SITUATIONS_BY_ID = {s["id"]: s for s in SITUATIONS}
STATEMENTS_BY_ID = {s["id"]: s for s in STATEMENTS}

CLOSING = "Merci, c'est terminé pour cette tâche."
CLOSING_EN = "Thank you, this task is over."


def item_for(task: int, item_id: str | None) -> dict | None:
    if task == 2:
        return SITUATIONS_BY_ID.get(item_id or "")
    if task == 3:
        return STATEMENTS_BY_ID.get(item_id or "")
    return None


def opening(task: int, item: dict | None) -> tuple[str, str]:
    """Claire's first line for a task (French, English). Fixed text, no AI needed."""
    if task == 1:
        return ("Bonjour. Nous commençons la première tâche, l'entretien dirigé. Pouvez-vous vous présenter, "
                "s'il vous plaît ?",
                "Hello. We're starting the first task, the guided interview. Could you introduce yourself, please?")
    if task == 2 and item:
        return (f"Bonjour, je suis {item['role']}. Je vous écoute, posez-moi vos questions.",
                "Hello, I'm the person in this situation. I'm listening, ask me your questions.")
    if task == 3 and item:
        return (f"Voici le sujet : « {item['fr']} » Qu'en pensez-vous ?",
                f"Here is the topic: \"{item['en']}\" What do you think?")
    return ("Bonjour.", "Hello.")


def plan(tasks: list[int]) -> list[dict]:
    """A fresh exam: the chosen tasks with a random situation/statement each."""
    out = []
    for n in tasks:
        task = TASKS[n]
        item = random.choice(SITUATIONS) if n == 2 else random.choice(STATEMENTS) if n == 3 else None
        fr, en = opening(n, item)
        out.append({
            "task": n,
            "title": task.title,
            "title_fr": task.title_fr,
            "instructions": task.instructions,
            "talk_seconds": task.talk_seconds,
            "prep_seconds": task.prep_seconds,
            "item": item,
            "opening": fr,
            "opening_translation": en,
        })
    return out


EXAMINER_BASE = """You are Madame Claire, playing the examiner in the TCF Canada speaking test
(expression orale). Speak standard French from France at a natural B1-B2 level and always
address the candidate with « vous ». Your words are read aloud: no markdown, lists or emoji.

Exam rules (strict):
- NEVER correct the candidate's mistakes, never comment on their French, never give advice
  or feedback. You are a neutral, polite examiner; feedback comes after the task.
- Keep your turns short (1 or 2 sentences) so the candidate does most of the talking.
- Never switch to English. If the candidate speaks English or is lost, rephrase simply in
  French and invite them to continue.
- "hint": a short French sentence starter the candidate could use next, ending with "…"
  (only shown in practice mode)."""

TASK_PROMPTS = {
    1: """Task 1, guided interview (entretien dirigé), 2 minutes.
Ask one personal question at a time about the candidate: who they are, where they live,
family, work or studies, free time, daily routine, why they are learning French, their plans
in Canada. Follow up briefly on what they say ("Et pourquoi ?", "Depuis combien de temps ?")
before moving to a new subject.""",
    2: """Task 2, interactive exercise (exercice en interaction), 3 minutes 30.
Situation given to the candidate: {situation}
You play {role}. The CANDIDATE must ask YOU questions to get information. Answer each question
briefly and realistically, inventing concrete, consistent details (prices in dollars, times,
dates, conditions). Stay consistent with what you already said. You may vary small details
(names, numbers, places) so the situation feels fresh. Do not ask the candidate questions;
only if they stop or seem stuck, say something like « Avez-vous d'autres questions ? ».""",
    3: """Task 3, giving an opinion (expression d'un point de vue), 4 minutes 30.
Statement: « {statement} »
The candidate must give and defend their opinion. After each answer, ask ONE follow-up that
makes them develop or justify it: ask for an example, ask why, or present a counter-argument
("Pourtant, certains pensent que… Qu'en dites-vous ?"). Do not give a long opinion of your own.""",
}


def examiner_prompt(task: int, item: dict | None) -> str:
    detail = TASK_PROMPTS[task]
    if task == 2 and item:
        detail = detail.format(situation=item["fr"], role=item["role"])
    elif task == 3 and item:
        detail = detail.format(statement=item["fr"])
    return EXAMINER_BASE + "\n\n" + detail


EVALUATION_PROMPT = """You are an experienced, fair TCF Canada examiner. Evaluate the candidate's
performance on ONE task of the speaking test from the transcript below.

{task_description}

Judge: task completion (task 2: did they ask varied, relevant questions and get the information;
task 3: a clear opinion, arguments, examples, nuance; task 1: full, detailed answers about
themselves), coherence and use of connectors, range and precision of vocabulary, and grammatical
accuracy and complexity. The transcript comes from speech recognition or typing: ignore
pronunciation, accents, punctuation, capitalisation and obvious transcription slips. Very short
or very few answers must lower the score. Do not invent things the candidate did not say.

"score": an integer from 0 to 20 on the TCF Canada scale: 4-5 basic (A2, NCLC 4), 6 (NCLC 5),
7-9 intermediate (B1, NCLC 6), 10-11 (B2, NCLC 7), 12-13 (B2+, NCLC 8), 14-15 (C1, NCLC 9),
16-20 (C1-C2, NCLC 10+).
"strengths" and "improvements": 1 to 3 short, concrete sentences each, IN ENGLISH, addressed to
the candidate ("You…").
"corrections": up to 5 of the most important real mistakes, taken from the candidate's own
words, most important first (same format as always: original = the wrong words; corrected = the
candidate's whole sentence rewritten correctly; explanation = one short English sentence;
category = tense, conjugation, word_choice, agreement, gender, preposition, article, elision,
english_word or other). Empty list if there are none."""


def evaluation_prompt(task: int, item: dict | None) -> str:
    t = TASKS[task]
    desc = f"Task {task}, {t.title_fr} ({t.title}). {t.instructions}"
    if task == 2 and item:
        desc += f"\nSituation: {item['fr']} The examiner played {item['role']}."
    if task == 3 and item:
        desc += f"\nStatement: « {item['fr']} »"
    return EVALUATION_PROMPT.format(task_description=desc)


def nclc(score: int) -> str:
    """TCF Canada oral score (/20) → NCLC level (used by Canadian immigration)."""
    if score >= 16:
        return "NCLC 10+"
    for minimum, level in ((14, 9), (12, 8), (10, 7), (7, 6), (6, 5), (4, 4)):
        if score >= minimum:
            return f"NCLC {level}"
    return "Below NCLC 4"
