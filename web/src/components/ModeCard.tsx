import { AArrowUp, ArrowRight, Lock, MessageCircle, Target, Timer, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { Mode } from "../api";

// Mode icons are lucide names set in each backend mode file.
const ICONS: Record<string, LucideIcon> = {
  "message-circle": MessageCircle,
  timer: Timer,
  target: Target,
  "a-arrow-up": AArrowUp,
};

export default function ModeCard({ mode }: { mode: Mode }) {
  const Icon = ICONS[mode.icon] ?? MessageCircle;
  const body = (
    <>
      <div className="mode-card__top">
        <span className="mode-card__icon">
          <Icon size={18} />
        </span>
        {mode.enabled ? (
          <span className="mode-card__status mode-card__status--on">Available</span>
        ) : (
          <span className="mode-card__status">
            <Lock size={11} /> Coming soon
          </span>
        )}
      </div>
      <h3 className="mode-card__title">{mode.title}</h3>
      <p className="mode-card__desc">{mode.description}</p>
      <div className="mode-card__foot">
        {mode.enabled ? (
          <>
            <span>Start practicing</span>
            <ArrowRight size={16} />
          </>
        ) : (
          <span className="mode-card__soon">Coming soon</span>
        )}
      </div>
    </>
  );

  return mode.enabled ? (
    <Link to={`/practice/${mode.id}`} className="mode-card mode-card--enabled">
      {body}
    </Link>
  ) : (
    <div className="mode-card" aria-disabled="true">
      {body}
    </div>
  );
}
