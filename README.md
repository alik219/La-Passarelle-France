# La-Passerelle France

A free, open-source speaking tutor for the **TCF Canada** oral exam. You talk with
**Madame Claire**, an AI tutor who answers in natural French and gives you brief
corrections as you go.

> Status: milestone 1 of 5. Text conversation works, with live corrections, an English
> translation of every reply (on click), a Hint button, your level (A1–C1) and tu/vous.
> Voice, the animated tutor and progress memory are coming in later milestones.

## What it costs: nothing

| Part | What we use | Cost |
|---|---|---|
| Tutor brain | [Groq](https://console.groq.com)'s free API (`openai/gpt-oss-120b`), with Ollama or Gemini as an automatic backup | $0 |
| Claire's voice *(milestone 2)* | [edge-tts](https://github.com/rany2/edge-tts) (Microsoft Edge neural voices) | $0 |
| Hearing you *(milestone 2)* | Your browser's Web Speech API (Chrome or Edge) | $0 |
| Animated tutor *(milestone 3)* | Hand-drawn SVG, animated in the browser | $0 |
| Hosting | Runs on your own computer | $0 |

Notes:
- **Groq** (default) answers in a second or two. Its free tier allows roughly 1,000
  requests and 200K tokens a day, which is enough for about 150–200 replies from Claire.
- **Ollama** runs everything on your computer: no account, key or limit. It needs a few GB
  of *free* RAM. On a 16 GB laptop with no graphics card and other apps open, replies can
  take 30–100 seconds, and small models miss more mistakes. Best with a GPU or 32 GB of RAM.
- **Gemini** is good and fast, but its free tier is small (about 20 replies a day on
  `gemini-2.5-flash`), and Google may use free-tier conversations to improve its models.
- Pick the main AI with `LLM_PROVIDER` and the backup with `LLM_FALLBACK` in `.env`.
- edge-tts uses Microsoft Edge's public read-aloud service. It's free but unofficial, so it could change.
- Your practice history is saved only on your own computer (`sessions/`, which git ignores).

## Run it

You need Python 3.10+ and Node.js 18+.

1. Create a free Groq API key at https://console.groq.com/keys
2. Copy `.env.example` to `.env` and paste the key after `GROQ_API_KEY=`.
3. Optional backup:
   - **Ollama** (default `LLM_FALLBACK`): install [Ollama](https://ollama.com/download), then run
     `ollama pull gemma3:4b` (about 3.3 GB).
   - **Gemini**: set `LLM_FALLBACK=gemini` and paste a free key from
     https://aistudio.google.com/apikey after `GEMINI_API_KEY=`.
   - Or set `LLM_FALLBACK=none`.
4. Start the backend (one terminal, from the project folder):
   ```
   cd backend && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt && python server.py
   ```
   On macOS/Linux use `source .venv/bin/activate` instead of `.venv\Scripts\activate`.
5. Start the website (a second terminal, from the project folder):
   ```
   cd web && npm install && npm run dev
   ```
6. Open http://localhost:5173

## Project layout

```
backend/             Python + FastAPI
  server.py          API routes (/api/modes, /api/chat, /api/translate)
  tutor/llm.py       Groq, Gemini and Ollama calls, plus the fallback (the one place to swap AI providers)
  tutor/modes/       one file per practice mode
web/                 React + Vite + TypeScript
  src/pages/         Landing and Session pages
  src/components/    UI pieces (Claire, mode cards, chat bubbles...)
  src/styles/        design tokens (colours, fonts, light/dark)
```

## Add a practice mode

Every practice mode is a single Python file in `backend/tutor/modes/`. The website
builds its mode cards from whatever is in that folder.

1. Copy `backend/tutor/modes/free_conversation.py` to a new file, e.g. `role_play.py`.
2. Change `id`, `title`, `description`, `icon`, `heading`, the opening lines
   (`opening_vous`, `opening_tu`, `opening_translation`, `opening_hint`) and `instructions`.
   Shared rules (level, tu/vous, one question per turn, corrections, hints) live in
   `backend/tutor/modes/base.py` and apply to every mode.
3. Set `enabled=True`. Restart the backend, and the new card appears.

Icons are names from [lucide](https://lucide.dev/icons) (for example `message-circle`, `timer`).

## Roadmap

1. ~~Skeleton, design and text conversation with corrections~~
2. Claire speaks; you answer with your microphone
3. Animated Claire (lip-sync, blinking)
4. Saved sessions and a "weak points" memory
5. Timed Exam, Feedback Report and Vocabulary Drill modes

## Credits

Inspired by Synthesia's [interactive avatar quickstarts](https://github.com/synthesia-ai/interactive-avatar-quickstarts),
rebuilt with free tools. Design drafted in Figma Make.

MIT licensed.
