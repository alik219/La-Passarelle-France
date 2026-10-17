import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  Coffee,
  Eye,
  HeartPulse,
  Home,
  House,
  Laptop,
  Leaf,
  Link2,
  Loader2,
  Plane,
  RotateCcw,
  Shuffle,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  finishVocabDrill,
  getVocabDrill,
  getVocabExtras,
  getVocabTopics,
  type VocabSchedule,
  type VocabTopic,
  type VocabWord,
} from "../api";
import { Logo } from "../components/Brand";
import { Composer } from "../components/Chat";
import Claire, { type Mood } from "../components/Claire";
import LevelPicker from "../components/LevelPicker";
import ThemeToggle from "../components/ThemeToggle";
import { useTutorVoice } from "../hooks/useTutorVoice";
import { LEVELS, useLevel, useSound, type Level } from "../settings";
import { localIso } from "../time";
import { checkFill, checkSay, dueLabel, sentenceText, splitExample, type Verdict } from "../vocab";

/**
 * Vocabulary Drill: new words start as flashcards; once you know them they come back as
 * "fill in the blank" and "say it in French". Your answers set when each word returns
 * (spaced repetition, saved by the backend).
 */

type Kind = "flash" | "fill" | "say";
type Step = {
  kind: Kind;
  word: VocabWord;
  again?: boolean; // a second look at a flashcard you were still learning (not scored)
  example?: string; // Claire's fresh sentence for "fill in the blank", when she wrote one
  exampleEn?: string;
};
type Outcome = { correct: boolean; almost: boolean };
type Phase = "intro" | "loading" | "drill" | "saving" | "results";

const COUNTS = [
  { n: 10, time: "3–5 min" },
  { n: 20, time: "6–10 min" },
  { n: 30, time: "10–15 min" },
];

const ICONS: Record<string, LucideIcon> = {
  shuffle: Shuffle,
  house: House,
  briefcase: Briefcase,
  "heart-pulse": HeartPulse,
  leaf: Leaf,
  laptop: Laptop,
  plane: Plane,
  coffee: Coffee,
  link: Link2,
};

const KIND_LABEL: Record<Kind, string> = { flash: "New word", fill: "Fill in the blank", say: "Say it in French" };
const KIND_TIP: Record<Kind, string> = {
  flash: "Read the word, try to recall what it means, then show the meaning. Be honest: words you're still learning come back sooner.",
  fill: "Type the missing word, or tap the microphone and say it. Small typos and missing accents count as almost right.",
  say: "Give the French word. For nouns, include the article (le, la, l', les): it's how you learn the gender.",
};
const GENDER_SHORT = { m: "masc.", f: "fem." } as const;

export default function DrillPage() {
  const [run, setRun] = useState(0);
  return <Drill key={run} onRestart={() => setRun((r) => r + 1)} />;
}

function Drill({ onRestart }: { onRestart: () => void }) {
  const navigate = useNavigate();
  const [level, setLevel] = useLevel();
  const [sound, setSound] = useSound();
  const soundOn = sound === "on";
  const [topics, setTopics] = useState<VocabTopic[] | null>(null);
  const [topicId, setTopicId] = useState("mixed");
  const [count, setCount] = useState(10);
  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState<string | null>(null);

  const [topic, setTopic] = useState<VocabTopic | null>(null);
  const [words, setWords] = useState<VocabWord[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answer, setAnswer] = useState<{ input: string; verdict: Verdict } | null>(null);
  const [recording, setRecording] = useState(false);
  const [schedule, setSchedule] = useState<VocabSchedule | null>(null);

  const [drillId] = useState(() => crypto.randomUUID());
  const startedAt = useRef(new Date());
  const outcomes = useRef<Record<string, Outcome>>({});
  const followKind = useRef<Record<string, Kind>>({});
  const extras = useRef<Record<string, { example: string; example_en: string }>>({});
  const indexRef = useRef(0);
  indexRef.current = index;
  const voice = useTutorVoice();
  const { play, stop } = voice;

  useEffect(() => {
    let cancelled = false;
    getVocabTopics(level).then(
      (t) => !cancelled && setTopics(t),
      (e: Error) => !cancelled && setError(e.message),
    );
    return () => {
      cancelled = true;
    };
  }, [level]);

  const step: Step | undefined = steps[index];
  // Every new word adds one card later (its check after "Knew it", or a second look), so the total is known up front.
  const total = words.length + words.filter((w) => w.new).length;

  // Claire says each new flashcard word (when Sound is on). Other exercises would give the answer away.
  useEffect(() => {
    if (phase !== "drill" || !step) return;
    if (step.kind === "flash" && soundOn) void play(step.word.fr);
    else stop();
  }, [index, phase]); // eslint-disable-line react-hooks/exhaustive-deps -- only when a new card appears

  // ---------- flow ----------
  async function start() {
    setPhase("loading");
    setError(null);
    try {
      const d = await getVocabDrill(topicId, count, level);
      if (d.words.length === 0) throw new Error("There are no words to practise here yet.");
      const plan: Step[] = [];
      d.words.forEach((w, i) => {
        const varied: Kind = i % 2 === 0 ? "fill" : "say";
        if (w.new) {
          plan.push({ kind: "flash", word: w });
          followKind.current[w.id] = varied; // after "Knew it", it comes back as one of these
        } else {
          plan.push({ kind: w.last_correct ? varied : "fill", word: w }); // missed last time: the sentence helps
        }
      });
      setTopic(d.topic);
      setWords(d.words);
      setSteps(plan);
      setIndex(0);
      startedAt.current = new Date();
      setPhase("drill");

      // Claire writes fresh fill-in sentences in the background; until (or unless) they arrive,
      // the checked built-in sentences are used.
      const fillIds = d.words
        .filter((w) => plan.some((s) => s.word.id === w.id && s.kind === "fill") || followKind.current[w.id] === "fill")
        .map((w) => w.id)
        .slice(0, 10);
      if (fillIds.length) {
        getVocabExtras(level, fillIds).then(
          (r) => {
            extras.current = r.sentences;
            setSteps((all) =>
              all.map((s, i) =>
                i > indexRef.current && s.kind === "fill" && r.sentences[s.word.id] && !s.example
                  ? { ...s, example: r.sentences[s.word.id].example, exampleEn: r.sentences[s.word.id].example_en }
                  : s,
              ),
            );
          },
          () => undefined, // no AI today: built-in sentences only
        );
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase("intro");
    }
  }

  function next() {
    setFlipped(false);
    setAnswer(null);
    if (index + 1 >= steps.length) void finish();
    else setIndex(index + 1);
  }

  function flip() {
    if (!step) return;
    setFlipped(true);
    if (soundOn) void play(sentenceText(step.word.example));
  }

  function mark(knew: boolean) {
    if (!step) return;
    const w = step.word;
    if (!step.again) {
      if (knew) {
        // Check it for real a little later, as fill-in or say-it.
        const kind = followKind.current[w.id] ?? "fill";
        const fresh = kind === "fill" ? extras.current[w.id] : undefined;
        const followUp: Step = { kind, word: w, example: fresh?.example, exampleEn: fresh?.example_en };
        setSteps((all) => {
          const at = Math.min(index + 3, all.length);
          return [...all.slice(0, at), followUp, ...all.slice(at)];
        });
      } else {
        outcomes.current[w.id] = { correct: false, almost: false };
        setSteps((all) => [...all, { kind: "flash", word: w, again: true }]); // one more look at the end
      }
    }
    setFlipped(false);
    setAnswer(null);
    setIndex(index + 1); // there is always a next step: the follow-up or the second look
  }

  function submit(text: string) {
    if (!step || answer) return;
    const example = step.example ?? step.word.example;
    const verdict = step.kind === "fill" ? checkFill(text, step.word, splitExample(example)[1]) : checkSay(text, step.word);
    settle(text, verdict);
  }

  function settle(input: string, verdict: Verdict) {
    if (!step) return;
    setAnswer({ input, verdict });
    if (!outcomes.current[step.word.id]) {
      outcomes.current[step.word.id] = { correct: verdict.result !== "wrong", almost: verdict.result === "almost" };
    }
    if (soundOn) {
      const sentence = sentenceText(step.example ?? step.word.example);
      void play(step.kind === "fill" ? sentence : `${step.word.fr}. ${sentence}`);
    }
  }

  async function finish() {
    stop();
    setPhase("saving");
    setError(null);
    try {
      const res = await finishVocabDrill({
        id: drillId,
        started_at: localIso(startedAt.current),
        topic: topic?.id ?? topicId,
        level,
        results: words.map((w) => ({ id: w.id, ...(outcomes.current[w.id] ?? { correct: false, almost: false }) })),
      });
      setSchedule(res.schedule);
      setPhase("results");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function replay() {
    if (!step) return;
    const sentence = sentenceText(step.example ?? step.word.example);
    if (step.kind === "flash") void play(flipped ? sentence : step.word.fr);
    else if (answer) void play(step.kind === "fill" ? sentence : `${step.word.fr}. ${sentence}`);
  }

  // ---------- screens ----------
  const header = (
    <header className="session-bar">
      <Logo compact />
      <div className="session-bar__mode">
        <span className="dot dot--vert" /> <span className="hide-narrow">Vocabulary</span> Drill
        {phase === "drill" && (
          <>
            <span className="session-bar__sep" />
            <span className="session-bar__time drill-count">
              {index + 1} / {total}
            </span>
          </>
        )}
      </div>
      <div className="session-bar__actions">
        {phase === "intro" && <LevelPicker value={level} onChange={setLevel} />}
        <ThemeToggle />
        <button type="button" className="btn btn--end" onClick={() => navigate("/")}>
          {phase === "results" ? "Close" : "Leave drill"} <X size={15} />
        </button>
      </div>
    </header>
  );

  if (phase === "intro" || phase === "loading") {
    const base: Level = level === "A1" ? "A2" : level;
    const above = LEVELS[LEVELS.indexOf(base) + 1];
    return (
      <div className="session">
        {header}
        <main className="summary">
          <div className="summary__card drill-intro">
            <p className="eyebrow">Vocabulary drill</p>
            <h1 className="section-title section-title--sm">Learn the words the TCF asks for</h1>
            <p className="muted exam-intro__lead">
              New words start as flashcards. Once you know them, Claire checks them with fill-in-the-blank and "say it
              in French". Missed words come back sooner, known words later.
            </p>

            <fieldset className="exam-options">
              <legend className="summary__heading">Choose a topic</legend>
              <div className="drill-topics" role="group" aria-label="Topic">
                {topics?.map((t) => {
                  const Icon = ICONS[t.icon] ?? Sparkles;
                  const meta =
                    t.id === "mixed"
                      ? t.due > 0
                        ? "Due words first, from every topic"
                        : "Nothing due yet: new words from every topic"
                      : (t.blurb ?? `${t.words} words`);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`drill-topic${t.id === "mixed" ? " drill-topic--mixed" : ""}`}
                      aria-pressed={topicId === t.id}
                      onClick={() => setTopicId(t.id)}
                    >
                      <span className="drill-topic__top">
                        <span className="mode-card__icon">
                          <Icon size={17} />
                        </span>
                        {t.due > 0 && <span className="drill-topic__due">{t.due} due</span>}
                      </span>
                      <span className="drill-topic__title">{t.title}</span>
                      <span className="drill-topic__fr" lang="fr">
                        {t.title_fr}
                      </span>
                      <span className="drill-topic__meta" lang={t.blurb ? "fr" : undefined}>
                        {meta}
                      </span>
                    </button>
                  );
                })}
                {!topics && !error && <p className="muted">Loading topics…</p>}
              </div>
            </fieldset>

            <fieldset className="exam-options">
              <legend className="summary__heading">How many words?</legend>
              <div className="segmented segmented--wide" role="group" aria-label="Number of words">
                {COUNTS.map((c) => (
                  <button key={c.n} type="button" aria-pressed={count === c.n} onClick={() => setCount(c.n)}>
                    {c.n} words
                  </button>
                ))}
              </div>
              <p className="exam-options__note">
                About {COUNTS.find((c) => c.n === count)?.time}. Words for level {base}
                {above ? `, plus a few ${above} words to stretch you` : ""}. Change your level with the pill at the top.
              </p>
            </fieldset>

            {error && <p className="notice notice--error">{error}</p>}
            <div className="summary__actions">
              <button type="button" className="btn btn--primary" onClick={start} disabled={phase === "loading" || !topics}>
                {phase === "loading" ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />} Start
              </button>
              <button type="button" className="btn btn--link" onClick={() => navigate("/")}>
                <Home size={15} /> Back to home
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "saving" || phase === "results") {
    return (
      <div className="session">
        {header}
        <main className="summary">
          {phase === "saving" ? (
            <div className="summary__card">
              <p className="eyebrow">Drill complete</p>
              {error ? (
                <div className="notice notice--error">
                  Couldn't save this drill: {error}{" "}
                  <button type="button" className="link-btn" onClick={() => void finish()}>
                    Try again
                  </button>
                </div>
              ) : (
                <p className="summary__saving">
                  <Loader2 size={16} className="spin" /> Saving your words…
                </p>
              )}
            </div>
          ) : (
            <Results
              topic={topic}
              words={words}
              outcomes={outcomes.current}
              schedule={schedule ?? {}}
              onSpeak={play}
              onAgain={onRestart}
              onHome={() => navigate("/")}
            />
          )}
        </main>
      </div>
    );
  }

  if (!step) return null;
  const w = step.word;
  const example = step.example ?? w.example;
  const [before, blank, after] = splitExample(example);
  const happy = answer?.verdict.result === "right" || answer?.verdict.result === "almost";
  const speaking = !!voice.speakingText;
  const mood: Mood = speaking ? "speaking" : recording ? "listening" : "idle";
  const canReplay = step.kind === "flash" || !!answer;

  return (
    <div className="session">
      {header}
      <div className="session__body">
        <aside className="tutor-panel">
          <p className="eyebrow eyebrow--center">Your tutor</p>
          <div className="tutor-panel__stage">
            <div className="rings rings--panel" aria-hidden="true" />
            <Claire className="tutor-panel__claire" mood={mood} happy={happy && !speaking} mouth={voice.mouth} />
          </div>
          <h2 className="tutor-panel__name">Madame Claire</h2>
          <p className="tutor-panel__status" aria-live="polite">
            <span className={`dot ${speaking ? "dot--bleu" : "dot--vert"}`} /> {speaking ? "Speaking…" : topic?.title}
          </p>
          <div className="tip">
            <p className="tip__title">{KIND_LABEL[step.kind]}</p>
            <p>{KIND_TIP[step.kind]}</p>
          </div>
        </aside>

        <section className="conversation drill">
          <div className="conversation__head">
            <div>
              <p className="eyebrow">
                {topic?.title} · {step.again ? "One more look" : KIND_LABEL[step.kind]}
              </p>
              <div className="drill-progress" aria-hidden="true">
                <span style={{ width: `${(index / total) * 100}%` }} />
              </div>
            </div>
            <button
              type="button"
              className="chip-btn"
              onClick={() => {
                if (soundOn) stop();
                setSound(soundOn ? "off" : "on");
              }}
              aria-pressed={soundOn}
            >
              {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />} Sound {soundOn ? "on" : "off"}
            </button>
          </div>

          <div className="drill__stage">
            <div className={`drill-card drill-card--${step.kind}`} key={index}>
              <div className="drill-card__tags">
                <span className="drill-tag">{w.level}</span>
                {step.kind === "fill" && step.example && (
                  <span className="drill-tag drill-tag--ai">
                    <Sparkles size={11} /> Claire's new sentence
                  </span>
                )}
                {canReplay && (
                  <button
                    type="button"
                    className="bubble__audio drill-card__audio"
                    onClick={replay}
                    aria-label="Hear Claire say it"
                    title="Play again"
                  >
                    <Volume2 size={15} />
                  </button>
                )}
              </div>

              {step.kind === "flash" && (
                <>
                  <p className="drill-word" lang="fr">
                    {w.fr}
                    {w.gender && <span className="drill-gender">{GENDER_SHORT[w.gender]}</span>}
                  </p>
                  {!flipped ? (
                    <>
                      <p className="drill-card__prompt">What does it mean? Think of your answer, then check.</p>
                      <div className="drill-card__actions">
                        <button type="button" className="btn btn--primary" onClick={flip} autoFocus>
                          <Eye size={16} /> Show meaning
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="drill-meaning">{w.en}</p>
                      <Example example={w.example} en={w.example_en} />
                      <div className="drill-card__actions">
                        {step.again ? (
                          <button type="button" className="btn btn--primary" onClick={next} autoFocus>
                            {index + 1 >= steps.length ? "See results" : "Next"} <ArrowRight size={16} />
                          </button>
                        ) : (
                          <>
                            <button type="button" className="btn btn--end drill-btn" onClick={() => mark(false)}>
                              <RotateCcw size={15} /> Still learning
                            </button>
                            <button type="button" className="btn btn--primary" onClick={() => mark(true)}>
                              <Check size={16} /> Knew it
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {step.kind === "fill" && (
                <>
                  <p className="drill-sentence" lang="fr">
                    {before}
                    <span className={`drill-blank${answer ? ` is-${answer.verdict.result}` : ""}`}>
                      {answer ? blank : " ".repeat(Math.max(6, blank.length + 2))}
                    </span>
                    {after}
                  </p>
                  <p className="drill-card__prompt">
                    Missing word: <strong>{w.en}</strong>
                  </p>
                  {answer && (step.exampleEn ?? w.example_en) && (
                    <p className="drill-example__en">{step.exampleEn || w.example_en}</p>
                  )}
                </>
              )}

              {step.kind === "say" && (
                <>
                  <p className="drill-card__prompt">How do you say this in French?</p>
                  <p className="drill-meaning drill-meaning--ask">{w.en}</p>
                  {answer && (
                    <>
                      <p className="drill-word drill-word--answer" lang="fr">
                        {w.fr}
                        {w.gender && <span className="drill-gender">{GENDER_SHORT[w.gender]}</span>}
                      </p>
                      <Example example={w.example} en={w.example_en} />
                    </>
                  )}
                </>
              )}

              {answer && <Feedback answer={answer} correct={step.kind === "fill" ? blank : w.fr} />}
              {answer && (
                <div className="drill-card__actions">
                  <button type="button" className="btn btn--primary" onClick={next} autoFocus>
                    {index + 1 >= steps.length ? "See results" : "Next"} <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {(step.kind === "fill" || step.kind === "say") && !answer && (
            <div className="drill__answer">
              <Composer
                key={index}
                disabled={false}
                autoFocus
                onSend={submit}
                onRecordStart={stop}
                onRecordingChange={setRecording}
                footnote="Press Enter to check · Typos and missing accents count as almost right"
              />
              <button type="button" className="btn btn--link drill__skip" onClick={() => settle("", { result: "wrong" })}>
                I don't know, show me
              </button>
            </div>
          )}
          {voice.error && <p className="notice">Claire's voice: {voice.error}</p>}
        </section>
      </div>
    </div>
  );
}

function Example({ example, en }: { example: string; en: string }) {
  const [before, word, after] = splitExample(example);
  return (
    <div className="drill-example">
      <p lang="fr">
        {before}
        <strong>{word}</strong>
        {after}
      </p>
      <p className="drill-example__en">{en}</p>
    </div>
  );
}

function Feedback({ answer, correct }: { answer: { input: string; verdict: Verdict }; correct: string }) {
  const { result, note } = answer.verdict;
  const title = result === "right" ? "Exactly right" : result === "almost" ? "Almost right" : answer.input ? "Not quite" : "Here's the answer";
  return (
    <div className={`drill-feedback drill-feedback--${result}`} role="status">
      <p className="drill-feedback__title">{title}</p>
      {answer.input && result !== "right" && (
        <p className="drill-feedback__row">
          <span className="correction__key">You wrote</span>
          <span lang="fr">{answer.input}</span>
        </p>
      )}
      {result !== "right" && (
        <p className="drill-feedback__row">
          <span className="correction__key">Correct</span>
          <strong lang="fr">{correct}</strong>
        </p>
      )}
      {note && <p className="drill-feedback__note">{note}</p>}
    </div>
  );
}

function Results({
  topic,
  words,
  outcomes,
  schedule,
  onSpeak,
  onAgain,
  onHome,
}: {
  topic: VocabTopic | null;
  words: VocabWord[];
  outcomes: Record<string, Outcome>;
  schedule: VocabSchedule;
  onSpeak: (text: string) => void;
  onAgain: () => void;
  onHome: () => void;
}) {
  const outcome = (w: VocabWord) => outcomes[w.id] ?? { correct: false, almost: false };
  const missed = words.filter((w) => !outcome(w).correct);
  const right = words.filter((w) => outcome(w).correct);
  const almost = right.filter((w) => outcome(w).almost).length;
  const when = (w: VocabWord) => (schedule[w.id] ? dueLabel(schedule[w.id].days, schedule[w.id].due) : "");
  const ratio = right.length / Math.max(1, words.length);

  return (
    <div className="summary__card">
      <p className="eyebrow">Drill complete · {topic?.title}</p>
      <h1 className="section-title section-title--sm">
        {ratio >= 0.8 ? "Excellent travail !" : ratio >= 0.5 ? "Bien joué !" : "Continuez comme ça !"}
      </h1>
      <div className="exam-score">
        <span className="exam-score__num">{right.length}</span>
        <span className="exam-score__of">/{words.length} words right</span>
      </div>
      <dl className="summary__stats drill-stats">
        <div>
          <dt>Right</dt>
          <dd>{right.length - almost}</dd>
        </div>
        <div>
          <dt>Almost right</dt>
          <dd>{almost}</dd>
        </div>
        <div>
          <dt>To review</dt>
          <dd>{missed.length}</dd>
        </div>
      </dl>

      {missed.length > 0 && (
        <div className="summary__section">
          <h2 className="summary__heading">
            <RotateCcw size={15} /> Words to review
          </h2>
          <ul className="drill-review">
            {missed.map((w) => (
              <li key={w.id}>
                <div className="drill-review__top">
                  <button type="button" className="bubble__audio" onClick={() => onSpeak(w.fr)} aria-label={`Hear « ${w.fr} »`}>
                    <Volume2 size={14} />
                  </button>
                  <strong lang="fr">{w.fr}</strong>
                  {w.gender && <span className="drill-gender">{GENDER_SHORT[w.gender]}</span>}
                  <span className="drill-review__en">{w.en}</span>
                </div>
                <Example example={w.example} en={w.example_en} />
                <p className="drill-review__when">
                  <CalendarClock size={13} /> {when(w)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {right.length > 0 && (
        <div className="summary__section">
          <h2 className="summary__heading">
            <Check size={15} /> Words you knew
          </h2>
          <ul className="drill-known">
            {right.map((w) => (
              <li key={w.id}>
                <span>
                  <strong lang="fr">{w.fr}</strong> <span className="muted">· {w.en}</span>
                  {outcome(w).almost && <span className="drill-tag drill-tag--almost">spelling</span>}
                </span>
                <span className="drill-known__when">{when(w)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="exam-intro__fine">
        Missed words come back tomorrow. Each right answer pushes a word further away: 1, 3, 7, 16, then 35 days. Words
        that are due appear first in your next drill and in Mixed review.
      </p>
      <div className="summary__actions">
        <button type="button" className="btn btn--primary" onClick={onAgain}>
          <RotateCcw size={16} /> Another drill
        </button>
        <button type="button" className="btn btn--link" onClick={onHome}>
          <Home size={15} /> Back to home <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
