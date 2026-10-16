"""Focused practice: a Free Conversation where Claire works openly on one mistake type.

Started from "Practise this" in the Feedback Report. Unlike the quiet weak-point steering,
Claire announces the focus and every question gives the learner a chance to use it.
"""

FOCUS = {
    "tense": {
        "label": "Verb tense",
        "rule": "choosing the right past tense: passé composé for finished actions, imparfait for "
        "descriptions, habits and background",
        "vous": "Aujourd'hui, on travaille les temps du passé. Racontez-moi : qu'avez-vous fait le week-end dernier ?",
        "tu": "Aujourd'hui, on travaille les temps du passé. Raconte-moi : qu'est-ce que tu as fait le week-end dernier ?",
        "en": "Today we're working on past tenses. Tell me: what did you do last weekend?",
        "hint": "Le week-end dernier, j'ai…",
    },
    "conjugation": {
        "label": "Conjugation",
        "rule": "conjugating verbs correctly (person, tense and mood, including irregular verbs and the "
        "subjonctif after « il faut que », « je veux que »…)",
        "vous": "Aujourd'hui, on travaille la conjugaison. Décrivez-moi une journée typique : que faites-vous le matin ?",
        "tu": "Aujourd'hui, on travaille la conjugaison. Décris-moi une journée typique : qu'est-ce que tu fais le matin ?",
        "en": "Today we're working on conjugation. Describe a typical day: what do you do in the morning?",
        "hint": "Le matin, je me lève et…",
    },
    "word_choice": {
        "label": "Word choice",
        "rule": "choosing the precise French word or expression instead of a vague or wrong one",
        "vous": "Aujourd'hui, on travaille le choix des mots. Parlez-moi de votre travail ou de vos études : en quoi cela consiste-t-il ?",
        "tu": "Aujourd'hui, on travaille le choix des mots. Parle-moi de ton travail ou de tes études : en quoi ça consiste ?",
        "en": "Today we're working on word choice. Tell me about your work or studies: what does it involve?",
        "hint": "Mon travail consiste à…",
    },
    "agreement": {
        "label": "Agreement",
        "rule": "agreement of adjectives and past participles in gender and number",
        "vous": "Aujourd'hui, on travaille les accords. Décrivez-moi votre quartier : comment sont les rues et les maisons ?",
        "tu": "Aujourd'hui, on travaille les accords. Décris-moi ton quartier : comment sont les rues et les maisons ?",
        "en": "Today we're working on agreement. Describe your neighbourhood: what are the streets and houses like?",
        "hint": "Les rues sont…",
    },
    "gender": {
        "label": "Gender",
        "rule": "the gender of nouns (le/la, un/une) and the words that agree with them",
        "vous": "Aujourd'hui, on travaille le genre des noms. Décrivez-moi votre logement, pièce par pièce.",
        "tu": "Aujourd'hui, on travaille le genre des noms. Décris-moi ton logement, pièce par pièce.",
        "en": "Today we're working on noun gender. Describe your home, room by room.",
        "hint": "Dans la cuisine, il y a…",
    },
    "preposition": {
        "label": "Preposition",
        "rule": "prepositions (à, de, en, dans, chez, pour…), especially with places, transport and verbs",
        "vous": "Aujourd'hui, on travaille les prépositions. Comment allez-vous au travail ou à l'école, et où allez-vous en vacances ?",
        "tu": "Aujourd'hui, on travaille les prépositions. Comment tu vas au travail ou à l'école, et où vas-tu en vacances ?",
        "en": "Today we're working on prepositions. How do you get to work or school, and where do you go on holiday?",
        "hint": "Je vais au travail en…",
    },
    "article": {
        "label": "Article",
        "rule": "articles: definite (le/la/les), indefinite (un/une/des) and partitive (du/de la/des), and « de » after negatives",
        "vous": "Aujourd'hui, on travaille les articles. Qu'est-ce que vous mangez d'habitude au petit-déjeuner ?",
        "tu": "Aujourd'hui, on travaille les articles. Qu'est-ce que tu manges d'habitude au petit-déjeuner ?",
        "en": "Today we're working on articles. What do you usually eat for breakfast?",
        "hint": "Au petit-déjeuner, je mange du…",
    },
    "elision": {
        "label": "Elision",
        "rule": "elision and contractions (j'aime, qu'on, l'ami, au, du)",
        "vous": "Aujourd'hui, on travaille l'élision. Qu'est-ce que vous aimez faire le soir, et pourquoi ?",
        "tu": "Aujourd'hui, on travaille l'élision. Qu'est-ce que tu aimes faire le soir, et pourquoi ?",
        "en": "Today we're working on elision. What do you like doing in the evening, and why?",
        "hint": "J'aime… parce qu'…",
    },
    "english_word": {
        "label": "English words",
        "rule": "using French words instead of English ones (jobs, technology, everyday objects)",
        "vous": "Aujourd'hui, on évite les mots anglais. Parlez-moi de la technologie que vous utilisez tous les jours.",
        "tu": "Aujourd'hui, on évite les mots anglais. Parle-moi de la technologie que tu utilises tous les jours.",
        "en": "Today we're avoiding English words. Tell me about the technology you use every day.",
        "hint": "Tous les jours, j'utilise mon ordinateur pour…",
    },
    "other": {
        "label": "General accuracy",
        "rule": "overall accuracy: careful, complete sentences",
        "vous": "Aujourd'hui, on travaille la précision. Parlez-moi d'un projet qui vous tient à cœur.",
        "tu": "Aujourd'hui, on travaille la précision. Parle-moi d'un projet qui te tient à cœur.",
        "en": "Today we're working on accuracy. Tell me about a project that matters to you.",
        "hint": "Un projet qui me tient à cœur, c'est…",
    },
}


def prompt(category: str) -> str:
    f = FOCUS[category]
    return (
        f"FOCUSED PRACTICE (the student chose this): {f['label']}, i.e. {f['rule']}.\n"
        "This replaces the usual topic order. The student knows what you are practising. Every one of "
        "your questions must make them use this point, varying situations so it stays interesting. "
        "Corrections still cover any real mistake, but pay special attention to this point."
    )


def public(category: str, address: str) -> dict:
    f = FOCUS[category]
    return {
        "category": category,
        "label": f["label"],
        "opening": f["vous" if address == "vous" else "tu"],
        "opening_translation": f["en"],
        "opening_hint": f["hint"],
    }
