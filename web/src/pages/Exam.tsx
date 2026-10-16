import { ArrowRight, Clock, Home, Lightbulb, Loader2, RotateCcw, Timer, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  examEvaluate,
  examTurn,
  getExamPlan,
  saveExam,
  type ExamPlan,
  type ExamTask,
  type TaskResult,
  type Turn,
} from "../api";
import { Logo } from "../components/Brand";
import { ChatMessage, Composer, CorrectionCard, Typing, type Message } from "../components/Chat";
import Claire, { type Mood } from "../components/Claire";
import ThemeToggle from "../components/ThemeToggle";
import { useTutorVoice } from "../hooks/useTutorVoice";
import { useSound } from "../settings";
import { localIso } from "../time";

/**
 * TCF Canada speaking test simulation: the 3 tasks (or one), each on a strict timer, with
 * Claire as a neutral examiner. Feedback and an estimated score come at the end of each task.
 */

type Choice = "full" | 1 | 2 | 3;
type Phase = "intro" | "loading" | "prep" | "talk" | "scoring" | "task-result" | "final";

const TASK_INFO: { task: 1 | 2 | 3; title: string; fr: string; time: string }[] = [
  { task: 1, title: "Guided interview", fr: "Entretien dirigé", time: "2 min" },
  { task: 2, title: "Interactive exercise", fr: "Exercice en interaction", time: "2 min prep + 3 min 30" },
  { task: 3, title: "Giving an opinion", fr: "Expression d'un point de vue", time: "4 min 30" },
];

export default function ExamPage() {
  const [run, setRun] = useState(0);
  return <Exam key={run} onRestart={() => setRun((r) => r + 1)} />;
}

function Exam({ onRestart }: { onRestart: () => void }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("intro");
  const [choice, setChoice] = useState<Choice>("full");
  const [practice, setPractice] = useState(false);
  const [plan, setPlan] = useState<ExamPlan | null>(null);
  const [index, setIndex] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TaskResult[]>([]);
  const [overall, setOverall] = useState<{ score: number; nclc: string } | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [sound, setSound] = useSound();
  const soundOn = sound === "on";
  const [examId] = useState(() => crypto.randomUUID());
  const [startedAt] = useState(() => new Date());
  const voice = useTutorVoice();
  const { play, stop } = voice;
  const lastSpoken = useRef<string | null>(null);
  const taskRun = useRef(0); // bumps when a task ends, so late replies are ignored
  const records = useRef<{ task: number; item_id: string | null; history: Turn[]; score: number; corrections: TaskResult["corrections"] }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const secondsLeft = useCountdown(deadline);

  const task: ExamTask | null = plan?.tasks[index] ?? null;
  const lastTutor = [...messages].reverse().find((m) => m.role === "tutor");

  // Claire speaks each new line of hers (when Sound is on).
  useEffect(() => {
    const text = lastTutor?.text;
    if (!text || text === lastSpoken.current) return;
    lastSpoken.current = text;
    if (soundOn) void play(text);
  }, [lastTutor?.text, soundOn, play]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  // ---------- flow ----------
  async function start() {
    setPhase("loading");
    setError(null);
    try {
      const p = await getExamPlan(choice === "full" ? [1, 2, 3] : [choice]);
      // Development only: ?fast=1 shortens every timer 12× so the whole flow can be tested quickly.
      if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("fast")) {
        p.tasks = p.tasks.map((t) => ({
          ...t,
          talk_seconds: Math.ceil(t.talk_seconds / 12),
          prep_seconds: Math.ceil(t.prep_seconds / 12),
        }));
      }
      setPlan(p);
      beginTask(p, 0);
    } catch (e) {
      setError((e as Error).message);
      setPhase("intro");
    }
  }

  function beginTask(p: ExamPlan, i: number) {
    const t = p.tasks[i];
    setIndex(i);
    setMessages([]);
    setError(null);
    if (t.prep_seconds > 0) {
      setPhase("prep");
      setDeadline(Date.now() + t.prep_seconds * 1000);
    } else {
      startTalk(t);
    }
  }

  function startTalk(t: ExamTask) {
    taskRun.current++;
    setMessages([{ role: "tutor", text: t.opening, translation: t.opening_translation }]);
    setPhase("talk");
    setDeadline(Date.now() + t.talk_seconds * 1000);
  }

  const endTask = useCallback(async () => {
    if (!plan || !task) return;
    taskRun.current++; // ignore replies still on their way
    setDeadline(null);
    setThinking(false);
    setPhase("scoring");
    const history: Turn[] = messages.map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "tutor", text: plan.closing, translation: plan.closing_translation }]);
    try {
      const res = await examEvaluate(task.task, task.item?.id ?? null, history);
      setResults((r) => [...r, res]);
      records.current.push({
        task: task.task,
        item_id: task.item?.id ?? null,
        history,
        score: res.score,
        corrections: res.corrections,
      });
      // Save after every task, so a finished task is never lost.
      const saved = await saveExam({
        id: examId,
        started_at: localIso(startedAt),
        practice_mode: practice,
        tasks: records.current,
      }).catch(() => null);
      if (saved?.exam) setOverall(saved.exam);
      setPhase("task-result");
    } catch (e) {
      setError((e as Error).message);
      setPhase("task-result");
    }
  }, [plan, task, messages, examId, startedAt, practice]);

  // The timer: prep runs into the talking time; talking time ends the task.
  useEffect(() => {
    if (secondsLeft !== 0 || !task) return;
    if (phase === "prep") startTalk(task);
    else if (phase === "talk") void endTask();
  }, [secondsLeft, phase, task, endTask]);

  async function send(text: string) {
    if (!task || phase !== "talk") return;
    const runAtSend = taskRun.current;
    const next: Message[] = [...messages, { role: "learner", text }];
    setMessages(next);
    setError(null);
    setThinking(true);
    try {
      const res = await examTurn(task.task, task.item?.id ?? null, next.map(({ role, text }) => ({ role, text })));
      if (runAtSend !== taskRun.current) return; // time ran out meanwhile
      setMessages((m) => [...m, { role: "tutor", text: res.reply, hint: res.hint }]);
    } catch (e) {
      if (runAtSend === taskRun.current) setError((e as Error).message);
    } finally {
      if (runAtSend === taskRun.current) setThinking(false);
    }
  }

  function next() {
    if (plan && index + 1 < plan.tasks.length) beginTask(plan, index + 1);
    else setPhase("final");
  }

  // ---------- what Claire looks like ----------
  const speaking = !!voice.speakingText;
  const mood: Mood = thinking || phase === "scoring" ? "thinking" : speaking ? "speaking" : recording ? "listening" : "idle";
  const statusText = thinking ? "Thinking…" : speaking ? "Speaking…" : phase === "talk" ? "Listening to you" : "Examiner";

  // ---------- screens ----------
  const header = (
    <header className="session-bar">
      <Logo compact />
      <div className="session-bar__mode">
        <Timer size={15} /> <span className="hide-narrow">TCF Canada ·</span>{" "}
        {task && phase !== "final" ? `Task ${task.task}` : "Speaking test"}
        {(phase === "prep" || phase === "talk") && secondsLeft !== null && (
          <>
            <span className="session-bar__sep" />
            <span className={`exam-clock${secondsLeft <= 30 ? " is-low" : ""}`} aria-live="off">
              {phase === "prep" ? "Prep " : ""}
              {formatClock(secondsLeft)}
            </span>
          </>
        )}
      </div>
      <div className="session-bar__actions">
        {practice && phase !== "intro" && <span className="pill">Practice mode</span>}
        <ThemeToggle />
        <button type="button" className="btn btn--end" onClick={() => navigate("/")}>
          Leave exam <X size={15} />
        </button>
      </div>
    </header>
  );

  if (phase === "intro" || phase === "loading") {
    return (
      <div className="session">
        {header}
        <main className="summary">
          <div className="summary__card exam-intro">
            <p className="eyebrow">Timed exam simulation</p>
            <h1 className="section-title section-title--sm">TCF Canada: speaking test</h1>
            <p className="muted exam-intro__lead">
              Three tasks, about 12 minutes, each on a strict timer. Claire is your examiner: she won't correct
              you during a task. Your feedback and an estimated score appear as soon as each task ends.
            </p>

            <fieldset className="exam-options">
              <legend className="summary__heading">What do you want to practise?</legend>
              <label className={`exam-option${choice === "full" ? " is-on" : ""}`}>
                <input type="radio" name="choice" checked={choice === "full"} onChange={() => setChoice("full")} />
                <span className="exam-option__title">Full exam</span>
                <span className="exam-option__meta">All 3 tasks · about 12 min</span>
              </label>
              {TASK_INFO.map((t) => (
                <label key={t.task} className={`exam-option${choice === t.task ? " is-on" : ""}`}>
                  <input type="radio" name="choice" checked={choice === t.task} onChange={() => setChoice(t.task)} />
                  <span className="exam-option__title">
                    Task {t.task}: {t.title}
                  </span>
                  <span className="exam-option__meta">
                    {t.fr} · {t.time}
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="exam-options">
              <legend className="summary__heading">Conditions</legend>
              <div className="segmented segmented--wide" role="group" aria-label="Exam or practice mode">
                <button type="button" aria-pressed={!practice} onClick={() => setPractice(false)}>
                  Exam mode
                </button>
                <button type="button" aria-pressed={practice} onClick={() => setPractice(true)}>
                  Practice mode
                </button>
              </div>
              <p className="exam-options__note">
                {practice
                  ? "Practice mode: the EN translation and Hint buttons are available during each task."
                  : "Exam mode: real conditions, no translation and no hints."}
              </p>
            </fieldset>

            <p className="exam-intro__fine">
              Speak with the microphone for the most realistic practice. Scores are an AI estimate to guide your
              preparation, not an official TCF result.
            </p>
            {error && <p className="notice notice--error">{error}</p>}
            <div className="summary__actions">
              <button type="button" className="btn btn--primary" onClick={start} disabled={phase === "loading"}>
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

  if ((phase === "task-result" || phase === "final") && plan) {
    const isLast = index + 1 >= plan.tasks.length;
    return (
      <div className="session">
        {header}
        <main className="summary">
          {phase === "task-result" ? (
            <TaskResultCard
              task={task!}
              result={results[results.length - 1] ?? null}
              error={error}
              onRetry={() => void endTask()}
              actions={
                isLast && plan.tasks.length === 1 ? (
                  <EndActions onAgain={onRestart} onHome={() => navigate("/")} />
                ) : (
                  <button type="button" className="btn btn--primary" onClick={next}>
                    {isLast ? "See overall result" : `Next: Task ${plan.tasks[index + 1].task}`} <ArrowRight size={16} />
                  </button>
                )
              }
            />
          ) : (
            <div className="summary__card">
              <p className="eyebrow">Exam complete</p>
              <h1 className="section-title section-title--sm">Your estimated result</h1>
              <div className="exam-score exam-score--big">
                <span className="exam-score__num">{overall?.score ?? "–"}</span>
                <span className="exam-score__of">/20</span>
                {overall && <span className="exam-nclc">{overall.nclc}</span>}
              </div>
              <ul className="exam-task-rows">
                {results.map((r) => (
                  <li key={r.task}>
                    <span>
                      Task {r.task}: {TASK_INFO[r.task - 1].title}
                    </span>
                    <span>
                      <strong>{r.score}/20</strong> · {r.nclc}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="exam-intro__fine">
                The overall score is the average of your tasks. This is an AI estimate to guide your preparation, not an
                official TCF result. It's saved in your progress, and its corrections count toward your weak points.
              </p>
              <EndActions onAgain={onRestart} onHome={() => navigate("/")} />
            </div>
          )}
        </main>
      </div>
    );
  }

  // prep, talk, scoring
  return (
    <div className="session">
      {header}
      <div className="session__body">
        <aside className="tutor-panel">
          <p className="eyebrow eyebrow--center">Your examiner</p>
          <div className="tutor-panel__stage">
            <div className="rings rings--panel" aria-hidden="true" />
            <Claire className="tutor-panel__claire" mood={mood} mouth={voice.mouth} />
          </div>
          <h2 className="tutor-panel__name">Madame Claire</h2>
          <p className="tutor-panel__status" aria-live="polite">
            <span className={`dot ${thinking ? "dot--amber" : speaking ? "dot--bleu" : "dot--vert"}`} /> {statusText}
          </p>
          {task && (
            <div className="tip">
              <p className="tip__title">
                <Clock size={14} /> Task {task.task}: {task.title}
              </p>
              <p>{task.instructions}</p>
            </div>
          )}
        </aside>

        <section className="conversation">
          <div className="conversation__head">
            <div>
              <p className="eyebrow">
                Task {task?.task} of the TCF · {task?.title_fr}
              </p>
              <h1 className="section-title section-title--sm">{task?.title}</h1>
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

          {task?.item && (
            <div className={`exam-card${phase === "prep" ? " exam-card--prep" : ""}`}>
              <p className="exam-card__label">{task.task === 2 ? "Your situation" : "The statement"}</p>
              <p className="exam-card__fr" lang="fr">
                {task.item.fr}
              </p>
              {practice && <p className="exam-card__en">{task.item.en}</p>}
            </div>
          )}

          {phase === "prep" ? (
            <div className="exam-prep">
              <p>
                Prepare your questions. Think about everything you need to find out. When the timer reaches zero, Claire
                will start the conversation.
              </p>
              <button type="button" className="btn btn--primary" onClick={() => task && startTalk(task)}>
                I'm ready, start now <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="conversation__log">
                {messages.map((m, i) => (
                  <ChatMessage
                    key={i}
                    message={m}
                    speaking={m.role === "tutor" && voice.speakingText === m.text}
                    onSpeak={play}
                    allowTranslate={practice}
                  />
                ))}
                {thinking && <Typing />}
                {phase === "scoring" && (
                  <p className="notice exam-scoring">
                    <Loader2 size={15} className="spin" /> Time's up. Claire is marking this task…
                  </p>
                )}
                {error && <p className="notice notice--error">{error}</p>}
                {voice.error && <p className="notice">Claire's voice: {voice.error}</p>}
                <div ref={endRef} />
              </div>
              {phase === "talk" && (
                <div className="exam-endtask">
                  <button type="button" className="btn btn--link" onClick={() => void endTask()}>
                    I've finished this task
                  </button>
                </div>
              )}
              <Composer
                disabled={phase !== "talk" || thinking}
                closed={phase !== "talk"}
                hint={practice && phase === "talk" && !thinking ? lastTutor?.hint : undefined}
                onSend={send}
                onRecordStart={stop}
                onRecordingChange={setRecording}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function TaskResultCard({
  task,
  result,
  error,
  onRetry,
  actions,
}: {
  task: ExamTask;
  result: TaskResult | null;
  error: string | null;
  onRetry: () => void;
  actions: React.ReactNode;
}) {
  return (
    <div className="summary__card">
      <p className="eyebrow">
        Task {task.task} complete · {task.title_fr}
      </p>
      <h1 className="section-title section-title--sm">{task.title}</h1>
      {!result ? (
        <div className="notice notice--error">
          Couldn't mark this task: {error}{" "}
          <button type="button" className="link-btn" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="exam-score">
            <span className="exam-score__num">{result.score}</span>
            <span className="exam-score__of">/20</span>
            <span className="exam-nclc">{result.nclc}</span>
          </div>
          <div className="exam-feedback">
            {result.strengths.length > 0 && (
              <div>
                <h2 className="summary__heading">What went well</h2>
                <ul>
                  {result.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.improvements.length > 0 && (
              <div>
                <h2 className="summary__heading">
                  <Lightbulb size={15} /> To improve
                </h2>
                <ul>
                  {result.improvements.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {result.corrections.length > 0 && (
            <div className="summary__section">
              <h2 className="summary__heading">Corrections</h2>
              <div className="exam-corrections">
                {result.corrections.map((c, i) => (
                  <CorrectionCard key={i} correction={c} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <div className="summary__actions">{actions}</div>
    </div>
  );
}

function EndActions({ onAgain, onHome }: { onAgain: () => void; onHome: () => void }) {
  return (
    <div className="summary__actions">
      <button type="button" className="btn btn--primary" onClick={onAgain}>
        <RotateCcw size={16} /> Take another exam
      </button>
      <button type="button" className="btn btn--link" onClick={onHome}>
        <Home size={15} /> Back to home <ArrowRight size={15} />
      </button>
    </div>
  );
}

/** Seconds left until `deadline` (ms timestamp), updating 4× a second; null when there's no timer. */
function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [deadline]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
