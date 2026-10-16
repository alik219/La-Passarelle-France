import { Link } from "react-router-dom";

export function TricoloreStripe() {
  return (
    <div className="tricolore" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

/** The "passerelle" (footbridge) mark: a frame with three arches. */
export function BridgeMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 50 36" fill="none" aria-hidden="true">
      <path d="M2 4 H48" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M4 4 V34 H46 V4" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      {[11, 21, 31].map((x) => (
        <path key={x} d={`M${x} 34 V16 a4 4 0 0 1 8 0 V34`} stroke="currentColor" strokeWidth="2.2" />
      ))}
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`logo${compact ? " logo--compact" : ""}`} aria-label="Passerelle France home">
      <BridgeMark size={compact ? 30 : 36} />
      <span className="logo__text">
        <span className="logo__name">Passerelle</span>
        <span className="logo__sub">France</span>
      </span>
    </Link>
  );
}
