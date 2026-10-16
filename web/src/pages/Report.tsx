import { ArrowRight, Flame, Home, Printer, Target, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getReport, type Report as ReportData, type ReportPeriod } from "../api";
import { Logo } from "../components/Brand";
import LineChart, { type Series } from "../components/LineChart";
import { formatDuration } from "../components/SessionSummary";
import ThemeToggle from "../components/ThemeToggle";

/** Feedback Report: practice stats, exam scores and mistake trends, from saved sessions. No AI. */

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

// The exam chart's gridlines sit on the NCLC thresholds of the TCF Canada /20 scale.
const NCLC_TICKS = [0, 4, 7, 10, 12, 14, 16, 20];

function nclc(score: number) {
  if (score >= 16) return "NCLC 10+";
  for (const [min, level] of [[14, 9], [12, 8], [10, 7], [7, 6], [6, 5], [4, 4]] as const) {
    if (score >= min) return `NCLC ${level}`;
  }
  return "below NCLC 4";
}

const SERIES_COLOURS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

const shortDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const asLocalDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

export default function Report() {
  const [period, setPeriod] = useState<ReportPeriod>(() => {
    try {
      const saved = localStorage.getItem("pf-report-period");
      if (saved === "7" || saved === "30" || saved === "all") return saved;
    } catch {
      /* ignore */
    }
    return "30";
  });
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); // keep the old report on screen (dimmed) while the new one loads
    getReport(period).then(
      (r) => {
        if (cancelled) return;
        setData(r);
        setError(null);
        setLoading(false);
      },
      (e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      },
    );
    try {
      localStorage.setItem("pf-report-period", period);
    } catch {
      /* ignore */
    }
    return () => {
      cancelled = true;
    };
  }, [period]);

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "";

  return (
    <div className="report-page">
      <header className="site-header report-header">
        <Logo />
        <nav className="site-nav">
          <button type="button" className="btn btn--link no-print" onClick={() => window.print()}>
            <Printer size={15} /> Print<span className="hide-narrow">&nbsp;/ save as PDF</span>
          </button>
          <ThemeToggle />
        </nav>
      </header>

      <main className="report">
        <div className="report__title">
          <p className="eyebrow">Feedback report</p>
          <h1 className="section-title">Your progress</h1>
          <p className="muted print-only">
            {periodLabel} · printed {longDate.format(new Date())}
          </p>
        </div>

        <div className="report__filters no-print" role="group" aria-label="Report period">
          <div className="segmented segmented--wide">
            {PERIODS.map((p) => (
              <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && !data && <p className="notice notice--error">{error}</p>}
        {data && (
          <div className={`report__body${loading ? " is-refreshing" : ""}`}>
            {data.stats.sessions === 0 ? (
              <div className="report-card report-empty">
                <h2 className="report-card__title">No practice in this period yet</h2>
                <p className="muted">Have a conversation with Claire or take a timed exam, and your report will fill in here.</p>
                <Link to="/" className="btn btn--primary">
                  Start practising <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <>
                <Stats data={data} />
                <ExamCard data={data} />
                <MistakeCard data={data} />
              </>
            )}
          </div>
        )}

        <p className="report__foot no-print">
          <Link to="/" className="btn btn--link">
            <Home size={15} /> Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}

function Stats({ data }: { data: ReportData }) {
  const s = data.stats;
  const tiles = [
    { label: "Time practised", value: formatDuration(s.seconds), sub: `${s.active_days} active day${s.active_days === 1 ? "" : "s"}` },
    { label: "Sessions", value: String(s.sessions), sub: `${s.conversations} conversation${s.conversations === 1 ? "" : "s"} · ${s.exams} exam${s.exams === 1 ? "" : "s"}` },
    { label: "Messages sent", value: String(s.messages), sub: "in French" },
    { label: "Corrections", value: String(s.corrections), sub: s.messages ? `${((s.corrections / s.messages) * 10).toFixed(1)} per 10 messages` : "" },
    { label: "Day streak", value: String(s.streak), sub: s.streak ? "days in a row, up to today" : "practise today to start one", icon: true },
  ];
  return (
    <section className="report-stats" aria-label="Practice stats">
      {tiles.map((t) => (
        <div key={t.label} className="stat-tile">
          <p className="stat-tile__label">
            {t.icon && <Flame size={13} aria-hidden="true" />} {t.label}
          </p>
          <p className="stat-tile__value">{t.value}</p>
          <p className="stat-tile__sub">{t.sub}</p>
        </div>
      ))}
    </section>
  );
}

function ExamCard({ data }: { data: ReportData }) {
  const exams = data.exams;
  return (
    <section className="report-card">
      <h2 className="report-card__title">
        <Timer size={16} /> TCF exam scores
      </h2>
      {exams.length === 0 ? (
        <div className="report-empty report-empty--inline">
          <p className="muted">No timed exams in this period. Take one to track your estimated score and NCLC level.</p>
          <Link to="/practice/timed-exam" className="btn btn--link">
            Take a timed exam <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <>
          <p className="report-card__lead">
            Latest: <strong>{exams[exams.length - 1].score}/20</strong> ({exams[exams.length - 1].nclc}) on{" "}
            {shortDate.format(asLocalDate(exams[exams.length - 1].date))}
            {exams.length > 1 && <> · first in this period: {exams[0].score}/20</>}
          </p>
          <LineChart
            ariaLabel="TCF exam scores out of 20 over time, overall and per task"
            xLabels={exams.map((e) => longDate.format(asLocalDate(e.date)))}
            xTick={(i) => (exams.length <= 8 || i % Math.ceil(exams.length / 8) === 0 ? shortDate.format(asLocalDate(exams[i].date)) : null)}
            series={(
              [
                { key: "overall", label: "Overall", pick: (e: ReportData["exams"][number]) => e.score },
                { key: "1", label: "Task 1", pick: (e: ReportData["exams"][number]) => e.tasks["1"] ?? null },
                { key: "2", label: "Task 2", pick: (e: ReportData["exams"][number]) => e.tasks["2"] ?? null },
                { key: "3", label: "Task 3", pick: (e: ReportData["exams"][number]) => e.tasks["3"] ?? null },
              ] as const
            )
              .map((d, i): Series => ({ key: d.key, label: d.label, color: SERIES_COLOURS[i], values: exams.map(d.pick) }))
              .filter((s) => s.values.some((v) => v !== null))}
            yMax={20}
            yTicks={NCLC_TICKS}
            valueFormat={(v) => `${v}/20 · ${nclc(v)}`}
          />
          <p className="report-card__note">
            Gridlines mark the NCLC levels: 4 = NCLC 4, 7 = NCLC 6, 10 = NCLC 7, 12 = NCLC 8, 14 = NCLC 9, 16 = NCLC 10+.
            Single-task exams only show that task's line. Scores are AI estimates, not official TCF results.
          </p>
        </>
      )}
    </section>
  );
}

function MistakeCard({ data }: { data: ReportData }) {
  const m = data.mistakes;
  // A category's colour comes from its all-time rank (so switching the period never
  // repaints it); the top 4 get a colour, everything else is grouped as "Other".
  const coloured = m.colour_order.slice(0, 4);
  const inPeriod = m.categories.map((c) => c.category);
  const series: Series[] = coloured
    .filter((cat) => inPeriod.includes(cat))
    .map((cat) => ({
      key: cat,
      label: m.categories.find((c) => c.category === cat)!.label,
      color: SERIES_COLOURS[coloured.indexOf(cat)],
      values: m.series[cat],
    }));
  const rest = inPeriod.filter((cat) => !coloured.includes(cat));
  if (rest.length) {
    series.push({
      key: "other",
      label: "Other",
      color: "var(--series-other)",
      values: m.buckets.map((_, i) => rest.reduce((sum, cat) => sum + (m.series[cat]?.[i] ?? 0), 0)),
    });
  }
  const peak = Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0)));
  const yMax = Math.max(4, Math.ceil(peak / 2) * 2);
  const yTicks = [0, yMax / 2, yMax];
  const every = Math.ceil(m.buckets.length / 7);

  return (
    <>
      <section className="report-card">
        <h2 className="report-card__title">
          <Target size={16} /> Mistakes over time
        </h2>
        {data.stats.corrections === 0 ? (
          <p className="muted">No corrections in this period. Très bien !</p>
        ) : (
          <LineChart
            ariaLabel={`Corrections per ${m.weekly ? "week" : "day"} by mistake type`}
            xLabels={m.buckets.map((b) => (m.weekly ? `Week of ${shortDate.format(asLocalDate(b))}` : longDate.format(asLocalDate(b))))}
            xTick={(i) => (i % every === 0 ? shortDate.format(asLocalDate(m.buckets[i])) : null)}
            series={series}
            yMax={yMax}
            yTicks={yTicks}
          />
        )}
        <p className="report-card__note">Corrections per {m.weekly ? "week" : "day"}, from conversations and exams.</p>
      </section>

      {m.categories.length > 0 && (
        <section className="report-card">
          <h2 className="report-card__title">Your mistake types</h2>
          <ul className="mistake-list">
            {m.categories.map((c) => (
              <li key={c.category}>
                <div className="mistake-list__main">
                  <p className="mistake-list__label">
                    {c.label} <span className="mistake-list__count">{c.count}×</span>
                  </p>
                  {c.example.original && (
                    <p className="weak-list__example">
                      <s>{c.example.original}</s> → <strong lang="fr">{c.example.corrected}</strong>
                    </p>
                  )}
                </div>
                <Link className="btn btn--link no-print" to={`/practice/free-conversation?focus=${c.category}`}>
                  Practise this <ArrowRight size={15} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
