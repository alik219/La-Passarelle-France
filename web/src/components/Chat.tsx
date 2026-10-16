import { Lightbulb, Mic, Send, Volume2 } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

export type Message = {
  role: "tutor" | "learner";
  text: string;
  correction?: string | null;
};

export function ChatMessage({ message }: { message: Message }) {
  if (message.role === "learner") {
    return (
      <div className="msg msg--learner">
        <div className="msg__who">
          Vous <span className="avatar avatar--learner">V</span>
        </div>
        <div className="bubble bubble--learner">{message.text}</div>
      </div>
    );
  }
  return (
    <div className="msg msg--tutor">
      <div className="msg__who">
        <span className="avatar avatar--tutor">C</span> Claire
      </div>
      <div className="bubble bubble--tutor">
        <span>{message.text}</span>
        <Volume2 size={15} className="bubble__audio" aria-hidden="true" />
      </div>
      {message.correction && (
        <div className="correction">
          <p className="correction__label">
            <Lightbulb size={13} /> Quick correction
          </p>
          <p>{message.correction}</p>
        </div>
      )}
    </div>
  );
}

export function Typing() {
  return (
    <div className="msg msg--tutor">
      <div className="msg__who">
        <span className="avatar avatar--tutor">C</span> Claire
      </div>
      <div className="bubble bubble--tutor bubble--typing" aria-label="Claire is thinking">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

type ComposerProps = {
  disabled: boolean;
  onSend: (text: string) => void;
  onMic: () => void;
};

export function Composer({ disabled, onSend, onMic }: ComposerProps) {
  const [text, setText] = useState("");

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer__box">
        <button type="button" className="composer__mic" onClick={onMic} aria-label="Answer with your microphone">
          <Mic size={18} />
        </button>
        <label className="composer__field">
          <span className="composer__label">Type or use the microphone…</span>
          <textarea
            rows={1}
            value={text}
            placeholder="Your answer in French"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            lang="fr"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="composer__send" disabled={disabled || !text.trim()} aria-label="Send">
          <Send size={17} />
        </button>
      </div>
      <p className="composer__hint">Press Enter to send · Your conversations stay private</p>
    </form>
  );
}
