import { Sparkles, Target, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  chat,
  getFocus,
  getModes,
  type Focus,
  getProgress,
  saveSession,
  saveSessionOnClose,
  type Mode,
  type SessionStats,
  type SessionToSave,
  type WeakPoint,
} from "../api";
import SessionSummary from "../components/SessionSummary";
import { Logo } from "../components/Brand";
import { ChatMessage, Composer, Typing, type Message } from "../components/Chat";
import Claire, { type Mood } from "../components/Claire";
import LevelPicker from "../components/LevelPicker";
import ThemeToggle from "../components/ThemeToggle";
import { useTutorVoice } from "../hooks/useTutorVoice";
import { useAddress, useLevel, useSound } from "../settings";
import { localIso } from "../time";

type Status = "listening" | "thinking";

const STATUS_LABEL: Record<Status | "speaking", string> = {
  listening: "Listening to you",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

/** "Practice again" starts a brand-new session by remounting the page. */
export default function SessionPage() {
  const [run, setRun] = useState(0);
  return <Session key={run} onRestart={() => setRun((r) => r + 1)} />;
}

function Session({ onRestart }: { onRestart: () => void }) {
  const { modeId = "" } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("listening");
  const [error, setError] = useState<string | null>(null);
  const [sound, setSound] = useSound();
  const soundOn = sound === "on";
  const [sessionId] = useState(() => crypto.randomUUID());
  const [startedAt] = useState(() => new Date());
  const [focus, setFocus] = useState<WeakPoint[]>([]);
  const [ending, setEnding] = useState<{ stats: SessionStats | null; error: string | null } | null>(null);
  const saved = useRef(false);
  const elapsed = useElapsed(startedAt);
  const endRef = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useLevel();
  const [address, setAddress] = useAddress();
  const voice = useTutorVoice();
  const lastSpoken = useRef<string | null>(null);

  useEffect(() => {
    getModes().then(
      (modes) => {
        const found = modes.find((m) => m.id === modeId && m.enabled);
        if (!found) return navigate("/", { replace: true });
        setMode(found);
      },
      (e: Error) => setError(e.message),
    );
  }, [modeId, navigate]);

  // "Practise this" from the Feedback Report: ?focus=tense etc. Claire then works openly on it.
  const [searchParams] = useSearchParams();
  const focusKey = searchParams.get("focus");
  const [practiceFocus, setPracticeFocus] = useState<Focus | null>(null);
  useEffect(() => {
    if (!focusKey) return;
    getFocus(focusKey, address).then(setPracticeFocus, () => setPracticeFocus(null));
  }, [focusKey, address]);

  // Claire's greeting; switching tu/vous before you've answered re-greets you in that form.
  useEffect(() => {
    if (!mode || (focusKey && !practiceFocus)) return;
    const opening = practiceFocus
      ? { text: practiceFocus.opening, translation: practiceFocus.opening_translation, hint: practiceFocus.opening_hint }
      : { text: mode.opening[address], translation: mode.opening_translation, hint: mode.opening_hint };
    setMessages((m) => (m.length > 1 ? m : [{ role: "tutor", ...opening }]));
  }, [mode, address, focusKey, practiceFocus]);

  const lastTutor = [...messages].reverse().find((m) => m.role === "tutor");

  // "Today's focus": your top 3 weak points from recent sessions.
  useEffect(() => {
    getProgress().then((p) => setFocus(p.weak_points), () => setFocus([]));
  }, []);

  // ---------- saving ----------
  const snapshot = (): SessionToSave | null =>
    mode && messages.some((m) => m.role === "learner")
      ? {
          id: sessionId,
          mode: mode.id,
          level,
          address,
          started_at: localIso(startedAt),
          messages: messages.map(({ role, text, correction }) => ({ role, text, correction })),
        }
      : null;
  const latest = useRef(snapshot);
  latest.current = snapshot;

  // Leaving without "End session" (closing the tab, or navigating away) still saves.
  useEffect(() => {
    const saveOnLeave = () => {
      const s = latest.current();
      if (s && !saved.current) {
        saved.current = true;
        saveSessionOnClose(s);
      }
    };
    window.addEventListener("pagehide", saveOnLeave);
    return () => {
      window.removeEventListener("pagehide", saveOnLeave);
      saveOnLeave(); // in-app navigation, e.g. clicking the logo
    };
  }, []);

  async function endSession() {
    voice.stop();
    const s = snapshot();
    if (!s) return navigate("/"); // nothing practised, nothing to save
    saved.current = true;
    setEnding({ stats: null, error: null });
    try {
      const res = await saveSession(s);
      setEnding({ stats: res.saved ? res : null, error: res.saved ? null : "Nothing to save." });
    } catch (e) {
      saved.current = false;
      setEnding({ stats: null, error: (e as Error).message });
    }
  }

  // Claire says each new message of hers out loud (when Sound is on).
  const { play, stop } = voice;
  useEffect(() => {
    const text = lastTutor?.text;
    if (!text || text === lastSpoken.current) return;
    lastSpoken.current = text;
    if (soundOn) void play(text);
  }, [lastTutor?.text, soundOn, play]);

  function toggleSound() {
    if (soundOn) stop();
    setSound(soundOn ? "off" : "on");
  }

  const shownStatus = status === "thinking" ? "thinking" : voice.speakingText ? "speaking" : "listening";

  // Claire's face: nods while you record, glances up while thinking, talks while speaking.
  const [recording, setRecording] = useState(false);
  const [happy, setHappy] = useState(false);
  const mood: Mood =
    shownStatus === "thinking" ? "thinking" : shownStatus === "speaking" ? "speaking" : recording ? "listening" : "idle";

  // An encouraging smile for a few seconds when she has corrected you.
  useEffect(() => {
    if (!happy) return;
    const t = window.setTimeout(() => setHappy(false), 3000);
    return () => window.clearTimeout(t);
  }, [happy]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  async function send(text: string) {
    if (!mode) return;
    const next: Message[] = [...messages, { role: "learner", text }];
    setMessages(next);
    setError(null);
    setStatus("thinking");
    try {
      const res = await chat(
        mode.id,
        next.map(({ role, text }) => ({ role, text })),
        level,
        address,
        practiceFocus?.category,
      );
      const learnerIndex = next.length - 1;
      setMessages((m) => [
        // The correction belongs to the message it corrects.
        ...m.map((msg, i) => (i === learnerIndex ? { ...msg, correction: res.correction } : msg)),
        { role: "tutor", text: res.reply, hint: res.hint },
      ]);
      if (res.correction) setHappy(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("listening");
    }
  }

  return (
    <div className="session">
      <header className="session-bar">
        <Logo compact />
        <div className="session-bar__mode">
          <span className="dot dot--vert" /> {mode?.title ?? "…"}
          <span className="session-bar__sep" />
          <span className="session-bar__time">{elapsed}</span>
        </div>
        <div className="session-bar__actions">
          <LevelPicker value={level} onChange={setLevel} />
          <div className="segmented" role="group" aria-label="How Claire addresses you">
            {(["vous", "tu"] as const).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={address === a}
                onClick={() => setAddress(a)}
                title={a === "vous" ? "Formal, as in the exam" : "Casual"}
              >
                {a}
              </button>
            ))}
          </div>
          <ThemeToggle />
          <button type="button" className="btn btn--end" onClick={endSession} disabled={!!ending}>
            End session <X size={15} />
          </button>
        </div>
      </header>

      {ending ? (
        <SessionSummary
          stats={ending.stats}
          error={ending.error}
          onHome={() => navigate("/")}
          onAgain={onRestart}
          onRetry={endSession}
        />
      ) : (
      <div className="session__body">
        <aside className="tutor-panel">
          <p className="eyebrow eyebrow--center">Your tutor</p>
          <div className="tutor-panel__stage">
            <div className="rings rings--panel" aria-hidden="true" />
            <Claire className="tutor-panel__claire" mood={mood} happy={happy} mouth={voice.mouth} />
          </div>
          <h2 className="tutor-panel__name">Madame Claire</h2>
          <p className="tutor-panel__status" aria-live="polite">
            <span className={`dot ${shownStatus === "thinking" ? "dot--amber" : shownStatus === "speaking" ? "dot--bleu" : "dot--vert"}`} />{" "}
            {STATUS_LABEL[shownStatus]}
          </p>
          {practiceFocus ? (
            <div className="tip focus">
              <p className="tip__title">
                <Target size={14} /> Focused practice
              </p>
              <p>
                Every question today is a chance to practise <strong>{practiceFocus.label.toLowerCase()}</strong>. Claire
                still corrects any mistake.
              </p>
            </div>
          ) : focus.length > 0 ? (
            <div className="tip focus">
              <p className="tip__title">
                <Target size={14} /> Today's focus
              </p>
              <ul className="focus__list">
                {focus.map((w) => (
                  <li key={w.category}>
                    <span>{w.label}</span>
                    <span className="focus__count">{w.count}×</span>
                  </li>
                ))}
              </ul>
              <p className="focus__note">From your last sessions. Claire will give you chances to practise these.</p>
            </div>
          ) : (
            <div className="tip">
              <p className="tip__title">
                <Sparkles size={14} /> Speak naturally
              </p>
              <p>Don’t worry about mistakes. Claire will correct you with patience and encouragement.</p>
            </div>
          )}
        </aside>

        <section className="conversation">
          <div className="conversation__head">
            <div>
              <p className="eyebrow">Conversation</p>
              <h1 className="section-title section-title--sm">
                {practiceFocus ? `Focus: ${practiceFocus.label}` : (mode?.heading ?? "")}
              </h1>
            </div>
            <button
              type="button"
              className="chip-btn"
              onClick={toggleSound}
              aria-pressed={soundOn}
              title={soundOn ? "Mute Claire" : "Let Claire speak her replies"}
            >
              {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />} Sound {soundOn ? "on" : "off"}
            </button>
          </div>

          <div className="conversation__log">
            <div className="divider">
              <span>
                Today,{" "}
                {startedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
            {messages.map((m, i) => (
              <ChatMessage
                key={i}
                message={m}
                speaking={m.role === "tutor" && voice.speakingText === m.text}
                onSpeak={play}
              />
            ))}
            {status === "thinking" && <Typing />}
            {error && <p className="notice notice--error">{error}</p>}
            {voice.error && <p className="notice">Claire's voice: {voice.error}</p>}
            <div ref={endRef} />
          </div>

          <Composer
            disabled={!mode || status === "thinking"}
            hint={status === "thinking" ? undefined : lastTutor?.hint}
            onSend={send}
            onRecordStart={stop}
            onRecordingChange={setRecording}
          />
        </section>
      </div>
      )}
    </div>
  );
}

function useElapsed(since: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((now - since.getTime()) / 1000));
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}
