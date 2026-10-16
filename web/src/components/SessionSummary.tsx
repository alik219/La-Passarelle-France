import { ArrowRight, Home, Lightbulb, Loader2, RotateCcw } from "lucide-react";
import type { SessionStats } from "../api";
import Claire from "./Claire";

type Props = {
  stats: SessionStats | null; // null while saving (or if saving failed)
  error: string | null;
  onHome: () => void;
  onAgain: () => void;
  onRetry: () => void;
};

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} min${s >= 30 ? " 30 s" : ""}` : `${s} s`;
}

/** Shown after "End session": what you did, what Claire corrected, and her note. */
export default function SessionSummary({ stats, error, onHome, onAgain, onRetry }: Props) {
  return (
    <main className="summary">
      <div className="summary__card">
        <div className="summary__claire">
          <Claire happy={!!stats} mood={stats || error ? "idle" : "thinking"} />
        </div>
        <p className="eyebrow">Session complete</p>
        <h1 className="section-title section-title--sm">Bien joué !</h1>

        {!stats && !error && (
          <p className="summary__saving">
            <Loader2 size={16} className="spin" /> Saving your session and writing your note…
          </p>
        )}

        {error && (
          <div className="notice notice--error">
            Couldn't save this session: {error}{" "}
            <button type="button" className="link-btn" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}

        {stats && (
          <>
            <dl className="summary__stats">
              <div>
                <dt>Time practised</dt>
                <dd>{formatDuration(stats.duration_seconds)}</dd>
              </div>
              <div>
                <dt>Messages sent</dt>
                <dd>{stats.messages_sent}</dd>
              </div>
              <div>
                <dt>Corrections</dt>
                <dd>{stats.corrections}</dd>
              </div>
            </dl>

            {stats.by_category.length > 0 && (
              <div className="summary__section">
                <h2 className="summary__heading">Corrections by type</h2>
                <ul className="chips">
                  {stats.by_category.map((c) => (
                    <li key={c.category} className="chip">
                      {c.label} <span>{c.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="summary__section">
              <h2 className="summary__heading">
                <Lightbulb size={15} /> Claire's note
              </h2>
              <p className="summary__note">
                {stats.note ?? "Claire couldn't write a note this time, but your session was saved."}
              </p>
            </div>
          </>
        )}

        <div className="summary__actions">
          <button type="button" className="btn btn--primary" onClick={onAgain}>
            <RotateCcw size={16} /> Practice again
          </button>
          <button type="button" className="btn btn--link" onClick={onHome}>
            <Home size={15} /> Back to home <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </main>
  );
}
