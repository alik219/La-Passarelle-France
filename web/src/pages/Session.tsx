import { Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { chat, getModes, type Mode } from "../api";
import { Logo } from "../components/Brand";
import { ChatMessage, Composer, Typing, type Message } from "../components/Chat";
import Claire from "../components/Claire";
import ThemeToggle from "../components/ThemeToggle";

type Status = "listening" | "thinking";

const STATUS_LABEL: Record<Status, string> = {
  listening: "Listening to you",
  thinking: "Thinking…",
};

export default function Session() {
  const { modeId = "" } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("listening");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [startedAt] = useState(() => new Date());
  const elapsed = useElapsed(startedAt);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getModes().then(
      (modes) => {
        const found = modes.find((m) => m.id === modeId && m.enabled);
        if (!found) return navigate("/", { replace: true });
        setMode(found);
        setMessages([{ role: "tutor", text: found.opening_line }]);
      },
      (e: Error) => setError(e.message),
    );
  }, [modeId, navigate]);

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
      );
      setMessages((m) => [...m, { role: "tutor", text: res.reply, correction: res.correction }]);
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
          <ThemeToggle />
          <button type="button" className="btn btn--end" onClick={() => navigate("/")}>
            End session <X size={15} />
          </button>
        </div>
      </header>

      <div className="session__body">
        <aside className="tutor-panel">
          <p className="eyebrow eyebrow--center">Your tutor</p>
          <div className="tutor-panel__stage">
            <div className="rings rings--panel" aria-hidden="true" />
            <Claire className="tutor-panel__claire" />
          </div>
          <h2 className="tutor-panel__name">Madame Claire</h2>
          <p className="tutor-panel__status" aria-live="polite">
            <span className={`dot ${status === "thinking" ? "dot--amber" : "dot--vert"}`} /> {STATUS_LABEL[status]}
          </p>
          <div className="tip">
            <p className="tip__title">
              <Sparkles size={14} /> Speak naturally
            </p>
            <p>Don’t worry about mistakes. Claire will correct you with patience and encouragement.</p>
          </div>
        </aside>

        <section className="conversation">
          <div className="conversation__head">
            <div>
              <p className="eyebrow">Conversation</p>
              <h1 className="section-title section-title--sm">{mode?.heading ?? ""}</h1>
            </div>
            <button
              type="button"
              className="chip-btn"
              onClick={() => setSoundOn((s) => !s)}
              aria-pressed={soundOn}
              title="Claire's voice arrives in the next milestone"
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
              <ChatMessage key={i} message={m} />
            ))}
            {status === "thinking" && <Typing />}
            {error && <p className="notice notice--error">{error}</p>}
            <div ref={endRef} />
          </div>

          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <Composer
            disabled={!mode || status === "thinking"}
            onSend={send}
            onMic={() => setNotice("Speaking to Claire with your microphone is coming in the next update. Type your answer for now.")}
          />
        </section>
      </div>
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
