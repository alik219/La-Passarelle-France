import { ChevronDown } from "lucide-react";
import { LEVELS, LEVEL_NAMES, type Level } from "../settings";

type Props = { value: Level; onChange: (level: Level) => void };

/** The "LEVEL A2" pill in the header, as a dropdown. */
export default function LevelPicker({ value, onChange }: Props) {
  return (
    <label className="pill pill--select" title="Your French level">
      <span>Level {value}</span>
      <ChevronDown size={13} aria-hidden="true" />
      <select value={value} onChange={(e) => onChange(e.target.value as Level)} aria-label="Your French level">
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {l} · {LEVEL_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
