import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type Series = {
  key: string;
  label: string;
  color: string; // a CSS colour, normally var(--series-N)
  values: (number | null)[];
};

type Props = {
  ariaLabel: string;
  xLabels: string[]; // full label per point (tooltip and table)
  xTick?: (i: number) => string | null; // short axis label, or null to skip
  series: Series[];
  yMax: number;
  yTicks: number[];
  bands?: { y: number; label: string }[]; // faint reference lines, e.g. NCLC levels
  valueFormat?: (v: number) => string; // tooltip and table
  tickFormat?: (v: number) => string; // y-axis labels
  height?: number;
};

const M = { top: 12, right: 96, bottom: 28, left: 36 };

/**
 * A small dependency-free line chart: hairline grid, 2px lines, 8px markers, a legend,
 * direct labels for up to 4 series, a crosshair tooltip (pointer or arrow keys) and a
 * table view, so no value is only readable by hovering.
 */
export default function LineChart({
  ariaLabel,
  xLabels,
  xTick = (i) => xLabels[i],
  series,
  yMax,
  yTicks,
  bands = [],
  valueFormat = (v) => String(v),
  tickFormat = (v) => String(v),
  height = 240,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(Math.max(260, el.clientWidth)); // measure straight away, before the first observer callback
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = xLabels.length;
  const narrow = width < 480;
  const right = narrow || series.length > 4 ? 16 : M.right; // direct labels need room
  const plotW = width - M.left - right;
  const plotH = height - M.top - M.bottom;
  const x = (i: number) => M.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => M.top + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const showMarkers = n <= 31;
  const directLabels = series.length <= 4 && !narrow;

  // Line paths, broken where a value is missing.
  const path = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) return void (pen = false);
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  // Direct labels at each series' last point, nudged apart so they never overlap.
  const labels = series
    .map((s) => {
      const last = s.values.reduce<number>((acc, v, i) => (v === null ? acc : i), -1);
      return last < 0 ? null : { s, yPos: y(s.values[last] as number) };
    })
    .filter((l): l is { s: Series; yPos: number } => l !== null)
    .sort((a, b) => a.yPos - b.yPos);
  for (let i = 1; i < labels.length; i++) {
    labels[i].yPos = Math.max(labels[i].yPos, labels[i - 1].yPos + 14);
  }
  // If that pushed the lowest labels below the chart, push the stack back up.
  const floor = M.top + plotH;
  for (let i = labels.length - 1; i >= 0; i--) {
    const limit = i === labels.length - 1 ? floor : labels[i + 1].yPos - 14;
    labels[i].yPos = Math.min(labels[i].yPos, limit);
  }

  function pointAt(clientX: number) {
    const rect = wrapRef.current?.querySelector("svg")?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const px = clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((px - M.left) / plotW) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  const tipLeft = active === null ? 0 : Math.min(Math.max(x(active) + 12, 0), width - 190);

  return (
    <div className="chart">
      {series.length >= 2 && (
        <ul className="chart__legend" aria-hidden="true">
          {series.map((s) => (
            <li key={s.key}>
              <span className="chart__key" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <div
        ref={wrapRef}
        className="chart__plot"
        tabIndex={0}
        role="img"
        aria-label={`${ariaLabel}. Use the left and right arrow keys to read values, or show the table.`}
        onKeyDown={onKey}
        onFocus={() => setActive((a) => a ?? n - 1)}
        onBlur={() => setActive(null)}
        onPointerMove={(e: PointerEvent) => pointAt(e.clientX)}
        onPointerLeave={() => setActive(null)}
      >
        <svg width={width} height={height} aria-hidden="true">
          {yTicks.map((t) => (
            <g key={t}>
              <line className="chart__grid" x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} />
              <text className="chart__tick" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {tickFormat(t)}
              </text>
            </g>
          ))}
          {bands.map((b) => (
            <g key={b.label}>
              <line className="chart__band" x1={M.left} x2={M.left + plotW} y1={y(b.y)} y2={y(b.y)} />
              <text className="chart__band-label" x={M.left + 4} y={y(b.y) - 4}>
                {b.label}
              </text>
            </g>
          ))}
          <line className="chart__axis" x1={M.left} x2={M.left + plotW} y1={y(0)} y2={y(0)} />
          {xLabels.map((_, i) => {
            const label = xTick(i);
            return label ? (
              <text key={i} className="chart__tick" x={x(i)} y={height - 8} textAnchor="middle">
                {label}
              </text>
            ) : null;
          })}

          {active !== null && (
            <line className="chart__crosshair" x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} />
          )}

          {series.map((s) => (
            <g key={s.key}>
              <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) =>
                v === null || !(showMarkers || i === active) ? null : (
                  <circle key={i} className="chart__dot" cx={x(i)} cy={y(v)} r={4} fill={s.color} />
                ),
              )}
            </g>
          ))}

          {directLabels &&
            labels.map(({ s, yPos }) => (
              <text key={s.key} className="chart__direct" x={M.left + plotW + 10} y={yPos} dy="0.32em">
                {s.label}
              </text>
            ))}
        </svg>

        {active !== null && (
          <div className="chart__tip" style={{ left: tipLeft }} role="presentation">
            <p className="chart__tip-x">{xLabels[active]}</p>
            {series.map((s) => (
              <p key={s.key} className="chart__tip-row">
                <span className="chart__tip-key" style={{ background: s.color }} />
                <strong>{s.values[active] === null ? "–" : valueFormat(s.values[active] as number)}</strong>
                <span>{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="link-btn chart__table-toggle"
        aria-expanded={showTable}
        aria-controls={tableId}
        onClick={() => setShowTable((v) => !v)}
      >
        {showTable ? "Hide table" : "Show as table"}
      </button>
      {showTable && (
        <div className="chart__table-wrap" id={tableId}>
          <table className="chart__table">
            <thead>
              <tr>
                <th scope="col">{" "}</th>
                {series.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {xLabels.map((label, i) => (
                <tr key={i}>
                  <th scope="row">{label}</th>
                  {series.map((s) => (
                    <td key={s.key}>{s.values[i] === null ? "–" : valueFormat(s.values[i] as number)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
