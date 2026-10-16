import { Clock, MessageSquare, RotateCcw, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { getProgress, resetProgress, type Progress } from "../api";
import { formatDuration } from "./SessionSummary";

const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** "Your progress" on the home page: weak points from recent sessions and the latest sessions. */
export default function ProgressPanel() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    getProgress().then(setProgress, () => setProgress(null));
  }, []);

  if (!progress || progress.sessions.length === 0) return null; // nothing to show before your first session

  async function reset() {
    setResetting(true);
    try {
      await resetProgress();
      setProgress({ weak_points: [], sessions: [] });
    } finally {
      setResetting(false);
      setConfirming(false);
    }
  }

  return (
    <section className="progress" id="progress" aria-labelledby="progress-title">
      <div className="progress__head">
        <div>
          <p className="eyebrow">Your progress</p>
          <h2 className="section-title" id="progress-title">
            Keep going, you're improving.
          </h2>
        </div>
        {confirming ? (
          <div className="progress__confirm" role="group" aria-label="Confirm reset">
            <span>Delete all saved sessions?</span>
            <button type="button" className="btn btn--end" onClick={reset} disabled={resetting}>
              {resetting ? "Deleting…" : "Yes, reset"}
            </button>
            <button type="button" className="btn btn--link" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--link" onClick={() => setConfirming(true)}>
            <RotateCcw size={14} /> Reset progress
          </button>
        )}
      </div>

      <div className="progress__grid">
        <div className="progress__box">
          <h3 className="summary__heading">
            <Target size={15} /> Your weak points
          </h3>
          {progress.weak_points.length === 0 ? (
            <p className="muted">No recurring mistakes in your last sessions. Très bien !</p>
          ) : (
            <ol className="weak-list">
              {progress.weak_points.map((w) => (
                <li key={w.category}>
                  <div className="weak-list__top">
                    <span className="weak-list__label">{w.label}</span>
                    <span className="weak-list__count">{w.count}× recently</span>
                  </div>
                  {w.example.original && (
                    <p className="weak-list__example">
                      <s>{w.example.original}</s> → <strong lang="fr">{w.example.corrected}</strong>
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
          <p className="progress__foot">Based on your last 5 sessions. Claire quietly practises these with you.</p>
        </div>

        <div className="progress__box">
          <h3 className="summary__heading">Recent sessions</h3>
          <ul className="session-list">
            {progress.sessions.map((s) => (
              <li key={s.id}>
                <div className="session-list__meta">
                  <span className="session-list__date">{dateFormat.format(new Date(s.started_at))}</span>
                  <span className="pill">
                    {s.exam ? `TCF exam · ${s.exam.score}/20 · ${s.exam.nclc}` : s.level}
                  </span>
                </div>
                <div className="session-list__stats">
                  <span>
                    <Clock size={13} /> {formatDuration(s.duration_seconds)}
                  </span>
                  <span>
                    <MessageSquare size={13} /> {s.messages_sent} {s.messages_sent === 1 ? "message" : "messages"}
                  </span>
                  <span>
                    {s.corrections} {s.corrections === 1 ? "correction" : "corrections"}
                  </span>
                </div>
                {s.note && <p className="session-list__note">{s.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
