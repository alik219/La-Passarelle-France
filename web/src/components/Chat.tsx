import { CornerDownLeft, HelpCircle, Languages, Lightbulb, Mic, Send, Volume2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { translate, type Correction } from "../api";

const CATEGORY_LABEL: Record<string, string> = {
  tense: "Verb tense",
  conjugation: "Conjugation",
  word_choice: "Word choice",
  agreement: "Agreement",
  gender: "Gender",
  preposition: "Preposition",
  article: "Article",
  elision: "Elision",
  english_word: "English word",
};

function CorrectionCard({ correction }: { correction: Correction }) {
  const tag = CATEGORY_LABEL[correction.category];
  return (
    <div className="correction">
      <p className="correction__label">
        <Lightbulb size={13} /> Quick correction
        {tag && <span className="correction__tag">{tag}</span>}
      </p>
      {correction.original && (
        <p className="correction__row">
          <span className="correction__key">You wrote</span>
          <s>{correction.original}</s>
        </p>
      )}
      <p className="correction__row">
        <span className="correction__key">Better</span>
        <strong lang="fr">{correction.corrected}</strong>
      </p>
      {correction.explanation && (
        <p className="correction__row correction__why">
          <span className="correction__key">Why</span>
          <span>{correction.explanation}</span>
        </p>
      )}
    </div>
  );
}

export type Message = {
  role: "tutor" | "learner";
  text: string;
  correction?: Correction | null; // on learner messages: Claire's fix for that message
  translation?: string; // on tutor messages, when known up front (otherwise fetched on click)
  hint?: string; // on tutor messages: a starter for answering
};

/**
 * "EN" button on Claire's bubble that pops up the English version of what she said.
 * The translation is fetched the first time it's opened (unless one was given up front).
 */
function TranslatePopup({ text, initial }: { text: string; initial?: string }) {
  const [open, setOpen] = useState(false);
  const [translation, setTranslation] = useState(initial ?? "");
  const [failed, setFailed] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // Keep the popup fully visible inside the scrolling chat.
  useEffect(() => {
    if (open) popRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, translation, failed]);

  useEffect(() => {
    if (!open || translation) return;
    let cancelled = false;
    setFailed(null);
    translate(text).then(
      (t) => !cancelled && setTranslation(t),
      (e: Error) => !cancelled && setFailed(e.message),
    );
    return () => {
      cancelled = true;
    };
  }, [open, text, translation]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="translate" ref={ref}>
      <button
        type="button"
        className={`translate__btn${open ? " is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        title="Show in English"
      >
        <Languages size={14} /> EN
      </button>
      {open && (
        <div className="translate__pop" id={id} ref={popRef} role="dialog" aria-label="English translation">
          <div className="translate__head">
            <span>In English</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close translation">
              <X size={14} />
            </button>
          </div>
          {translation ? (
            <p>{translation}</p>
          ) : failed ? (
            <p className="translate__error">{failed}</p>
          ) : (
            <p className="translate__loading">Translating…</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatMessage({ message }: { message: Message }) {
  if (message.role === "learner") {
    return (
      <div className="msg msg--learner">
        <div className="msg__who">
          Vous <span className="avatar avatar--learner">V</span>
        </div>
        <div className="bubble bubble--learner">{message.text}</div>
        {message.correction && <CorrectionCard correction={message.correction} />}
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
        <div className="bubble__tools">
          <TranslatePopup text={message.text} initial={message.translation} />
          <Volume2 size={15} className="bubble__audio" aria-hidden="true" />
        </div>
      </div>
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
  hint?: string; // sentence starter for answering Claire's latest question
  onSend: (text: string) => void;
  onMic: () => void;
};

export function Composer({ disabled, hint, onSend, onMic }: ComposerProps) {
  const [text, setText] = useState("");
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Each new question from Claire starts with the hint hidden again.
  useEffect(() => setShowHint(false), [hint]);

  function applyStarter() {
    if (!hint) return;
    const starter = hint.replace(/\s*(…|\.\.\.)\s*$/, "") + " ";
    setText(starter);
    setShowHint(false);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(starter.length, starter.length);
    });
  }

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
      {hint && (
        <div className="hint-row">
          {showHint ? (
            <button type="button" className="hint-chip" onClick={applyStarter} title="Use this to start your answer">
              <span className="hint-chip__label">Try starting with</span>
              <span className="hint-chip__text">{hint}</span>
              <CornerDownLeft size={14} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="hint-btn" onClick={() => setShowHint(true)}>
              <HelpCircle size={14} /> Hint
            </button>
          )}
        </div>
      )}
      <div className="composer__box">
        <button type="button" className="composer__mic" onClick={onMic} aria-label="Answer with your microphone">
          <Mic size={18} />
        </button>
        <label className="composer__field">
          <span className="composer__label">Type or use the microphone…</span>
          <textarea
            ref={inputRef}
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
