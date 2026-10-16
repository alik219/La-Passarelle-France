export type Mouth = "rest" | "open" | "wide" | "round";

type Props = {
  mouth?: Mouth;
  className?: string;
};

const SKIN = "#edc3aa";
const SKIN_SHADE = "#dfa98f";
const HAIR = "#5a3d34";
const FEATURE = "#6b4a40";
const LIPS = "#a2443f";

/** Madame Claire, drawn after the Figma draft. `mouth` will be driven by her voice in milestone 3. */
export default function Claire({ mouth = "rest", className }: Props) {
  return (
    <svg viewBox="0 0 240 260" className={className} role="img" aria-label="Madame Claire, your tutor">
      {/* hair behind the head */}
      <path d="M58 178 C46 118 52 46 120 40 C188 46 194 118 182 178 C160 186 80 186 58 178 Z" fill={HAIR} />
      {/* neck */}
      <path d="M104 148 L136 148 L137 190 L103 190 Z" fill={SKIN_SHADE} />
      {/* jacket and shirt */}
      <path d="M34 260 C36 212 66 190 102 184 L138 184 C174 190 204 212 206 260 Z" fill="#0b2d5c" />
      <path d="M102 184 L120 232 L138 184 Z" fill="#f7f3ec" />
      <path d="M102 184 L92 196 L114 236 L120 232 Z" fill="#082249" />
      <path d="M138 184 L148 196 L126 236 L120 232 Z" fill="#082249" />
      {/* face */}
      <ellipse cx="120" cy="106" rx="47" ry="57" fill={SKIN} />
      <ellipse cx="73" cy="110" rx="6" ry="10" fill={SKIN_SHADE} />
      <ellipse cx="167" cy="110" rx="6" ry="10" fill={SKIN_SHADE} />
      {/* fringe */}
      <path d="M70 104 C66 62 96 44 124 46 C158 48 176 72 171 112 C160 88 142 74 122 72 C104 82 88 94 70 104 Z" fill={HAIR} />
      {/* brows */}
      <path d="M92 92 Q101 88 109 91" stroke={FEATURE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M131 91 Q139 88 148 92" stroke={FEATURE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* calm, closed eyes as in the draft */}
      <path d="M93 106 Q101 112 109 106" stroke={FEATURE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M131 106 Q139 112 147 106" stroke={FEATURE} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* nose and cheeks */}
      <path d="M120 112 Q117 124 122 126" stroke={SKIN_SHADE} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="94" cy="124" r="7" fill="#e9a4a0" opacity="0.35" />
      <circle cx="146" cy="124" r="7" fill="#e9a4a0" opacity="0.35" />
      <MouthShape mouth={mouth} />
    </svg>
  );
}

function MouthShape({ mouth }: { mouth: Mouth }) {
  switch (mouth) {
    case "open":
      return <ellipse cx="120" cy="137" rx="7" ry="5" fill={LIPS} />;
    case "wide":
      return <ellipse cx="120" cy="137" rx="10" ry="3.5" fill={LIPS} />;
    case "round":
      return <ellipse cx="120" cy="137" rx="4.5" ry="5.5" fill={LIPS} />;
    default:
      return <path d="M110 134 Q120 142 130 134" stroke={LIPS} strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  }
}
