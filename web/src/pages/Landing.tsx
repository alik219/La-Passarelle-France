import { ArrowRight, Check, ChevronRight, MessageCircle, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getModes, type Mode } from "../api";
import { Logo, TricoloreStripe } from "../components/Brand";
import Claire from "../components/Claire";
import LevelPicker from "../components/LevelPicker";
import ModeCard from "../components/ModeCard";
import ProgressPanel from "../components/ProgressPanel";
import ThemeToggle from "../components/ThemeToggle";
import { useLevel } from "../settings";

const FIRST_MODE = "/practice/free-conversation";

const POINTS = [
  "A natural French voice designed for active listening.",
  "Brief, useful corrections without interrupting the conversation.",
  "Your progress stays private and is saved on your device.",
];

export default function Landing() {
  const [modes, setModes] = useState<Mode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useLevel();

  useEffect(() => {
    getModes().then(setModes, (e: Error) => setError(e.message));
  }, []);

  return (
    <div className="landing">
      <TricoloreStripe />
      <header className="site-header">
        <Logo />
        <nav className="site-nav">
          <a href="#modes">Practice</a>
          <a href="#about">About</a>
          <LevelPicker value={level} onChange={setLevel} />
          <ThemeToggle />
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">
              <span className="dot dot--rouge" /> Your personal French tutor, available anytime
            </p>
            <h1 className="hero__title">
              Speak French.
              <br />
              <em>Take the leap.</em>
            </h1>
            <p className="hero__lead">
              Prepare for the TCF Canada speaking exam with Claire, your supportive AI tutor. Practice,
              improve, and speak with confidence.
            </p>
            <div className="hero__actions">
              <Link to={FIRST_MODE} className="btn btn--primary">
                Start speaking <ArrowRight size={17} />
              </Link>
              <a href="#modes" className="btn btn--link">
                Explore practice modes <ChevronRight size={16} />
              </a>
            </div>
            <ul className="hero__ticks">
              {["Free", "Open source", "No credit card"].map((t) => (
                <li key={t}>
                  <Check size={14} /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="hero__visual">
            <div className="rings" aria-hidden="true" />
            <div className="tutor-card">
              <span className="badge badge--online">
                <span className="dot dot--vert" /> En ligne
              </span>
              <span className="float-chip float-chip--left">
                <Sparkles size={14} /> Live corrections
              </span>
              <span className="float-chip float-chip--right">
                <Volume2 size={14} /> French accent
              </span>
              <div className="tutor-card__portrait">
                <Claire />
              </div>
              <p className="eyebrow eyebrow--center">Your tutor</p>
              <h2 className="tutor-card__name">Madame Claire</h2>
              <p className="tutor-card__meta">French from France · TCF Canada</p>
              <blockquote className="tutor-card__quote">
                <MessageCircle size={15} />
                <span>“Bonjour! We can begin whenever you’re ready.”</span>
              </blockquote>
            </div>
          </div>
        </section>

        <ProgressPanel />

        <section className="modes" id="modes">
          <div className="modes__head">
            <div>
              <p className="eyebrow">Ready when you are</p>
              <h2 className="section-title">Choose your practice mode</h2>
            </div>
            <p className="modes__intro">
              Begin with a relaxed conversation. More focused ways to practice are coming soon.
            </p>
          </div>
          {error && <p className="notice notice--error">{error}</p>}
          <div className="modes__grid">
            {modes?.map((m) => <ModeCard key={m.id} mode={m} />)}
            {!modes && !error && <p className="muted">Loading practice modes…</p>}
          </div>
        </section>

        <section className="band" id="about">
          <div className="band__intro">
            <p className="eyebrow eyebrow--light">A bridge to your next chapter</p>
            <h2 className="band__title">The speaking practice you’ve been missing.</h2>
          </div>
          <ol className="band__points">
            {POINTS.map((p, i) => (
              <li key={p}>
                <span className="band__num">{String(i + 1).padStart(2, "0")}</span>
                <p>{p}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="site-footer">
        <span className="site-footer__brand">
          <Logo compact />
        </span>
        <p>An open-source project for everyone taking the leap.</p>
      </footer>
    </div>
  );
}
