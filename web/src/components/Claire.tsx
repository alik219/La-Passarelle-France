import { useEffect, useRef } from "react";

/** What Claire is doing; drives her expression and movement. */
export type Mood = "idle" | "listening" | "thinking" | "speaking";

/** How open her mouth is right now (0 = closed) and its shape, while she speaks. */
export type MouthFrame = { open: number; shape: "neutral" | "round" | "wide" };

type Props = {
  mood?: Mood;
  happy?: boolean; // closed-eye smile, e.g. to encourage after a correction
  mouth?: () => MouthFrame; // read every animation frame while speaking (lip-sync)
  className?: string;
};

const SKIN = "#edc3aa";
const SKIN_SHADE = "#dfa98f";
const HAIR = "#5a3d34";
const FEATURE = "#6b4a40";
const LIPS = "#a2443f";

const REST: MouthFrame = { open: 0, shape: "neutral" };

/** Mouth outline: a soft smile at rest, opening into a rounder or wider shape when speaking. */
function mouthPath({ open, shape }: MouthFrame): string {
  if (open < 0.06) return "M110 133 Q120 142 130 133 Q120 137.5 110 133 Z";
  const halfWidth = shape === "round" ? 5.5 : shape === "wide" ? 10.5 : 8.5;
  const top = 135 - 2 - open * 2;
  const bottom = 135 + 2 + open * (shape === "round" ? 9 : 7);
  return `M${120 - halfWidth} 135 Q120 ${top} ${120 + halfWidth} 135 Q120 ${bottom} ${120 - halfWidth} 135 Z`;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Madame Claire, drawn after the Figma draft, now alive: she blinks, breathes and talks. */
export default function Claire({ mood = "idle", happy = false, mouth, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const mouthFn = useRef(mouth);
  mouthFn.current = mouth;

  // Lip-sync: while speaking, reshape the mouth every frame from her voice. Written
  // straight to the SVG (no React re-render) so it stays smooth.
  useEffect(() => {
    const el = mouthRef.current;
    if (!el) return;
    if (mood !== "speaking" || !mouthFn.current) {
      el.setAttribute("d", mouthPath(REST));
      return;
    }
    let frame = 0;
    let open = 0;
    const tick = () => {
      const target = mouthFn.current?.() ?? REST;
      open += (target.open - open) * 0.45; // smooth out jitter
      el.setAttribute("d", mouthPath({ open, shape: target.shape }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.setAttribute("d", mouthPath(REST));
    };
  }, [mood]);

  // Blink every few seconds, at random, like a person.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || prefersReducedMotion()) return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        svg.classList.add("is-blinking");
        window.setTimeout(() => svg.classList.remove("is-blinking"), 140);
        schedule();
      }, 2200 + Math.random() * 3800);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 240 260"
      className={`claire claire--${mood}${happy ? " claire--happy" : ""}${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={`Madame Claire, your tutor${mood === "speaking" ? ", speaking" : mood === "thinking" ? ", thinking" : ""}`}
    >
      <g className="claire__body">
        {/* hair behind the head */}
        <path d="M58 178 C46 118 52 46 120 40 C188 46 194 118 182 178 C160 186 80 186 58 178 Z" fill={HAIR} />
        {/* neck */}
        <path d="M104 148 L136 148 L137 190 L103 190 Z" fill={SKIN_SHADE} />
        {/* jacket and shirt */}
        <path d="M34 260 C36 212 66 190 102 184 L138 184 C174 190 204 212 206 260 Z" fill="#0b2d5c" />
        <path d="M102 184 L120 232 L138 184 Z" fill="#f7f3ec" />
        <path d="M102 184 L92 196 L114 236 L120 232 Z" fill="#082249" />
        <path d="M138 184 L148 196 L126 236 L120 232 Z" fill="#082249" />
      </g>

      <g className="claire__head">
        {/* face */}
        <ellipse cx="120" cy="106" rx="47" ry="57" fill={SKIN} />
        <ellipse cx="73" cy="110" rx="6" ry="10" fill={SKIN_SHADE} />
        <ellipse cx="167" cy="110" rx="6" ry="10" fill={SKIN_SHADE} />
        {/* fringe */}
        <path d="M70 104 C66 62 96 44 124 46 C158 48 176 72 171 112 C160 88 142 74 122 72 C104 82 88 94 70 104 Z" fill={HAIR} />

        {/* brows (lift when thinking) */}
        <g className="claire__brows">
          <path d="M91 91 Q100 86 109 89" stroke={FEATURE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M131 89 Q140 86 149 91" stroke={FEATURE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>

        {/* open eyes: they blink, and glance up while thinking */}
        <g className="claire__eyes-open">
          {[101, 139].map((cx) => (
            <g key={cx} className="claire__eye">
              <ellipse cx={cx} cy="106" rx="7.5" ry="5.8" fill="#fffaf5" />
              <g className="claire__pupil">
                <circle cx={cx} cy="106.5" r="4.2" fill="#5a3a2c" />
                <circle cx={cx} cy="106.5" r="2" fill="#1e1410" />
                <circle cx={cx + 1.4} cy="105" r="1.1" fill="#fff" />
              </g>
              <path d={`M${cx - 8} 104 Q${cx} 98.5 ${cx + 8} 104`} stroke={FEATURE} strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
          ))}
        </g>

        {/* happy, closed eyes (as in the original drawing) */}
        <g className="claire__eyes-happy">
          <path d="M93 106 Q101 112 109 106" stroke={FEATURE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M131 106 Q139 112 147 106" stroke={FEATURE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>

        {/* nose and cheeks */}
        <path d="M120 112 Q117 124 122 126" stroke={SKIN_SHADE} strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle className="claire__cheek" cx="94" cy="124" r="7" fill="#e9a4a0" />
        <circle className="claire__cheek" cx="146" cy="124" r="7" fill="#e9a4a0" />

        <path ref={mouthRef} d={mouthPath(REST)} fill={LIPS} />
      </g>
    </svg>
  );
}
