/** Timestamp with the local time-zone offset, e.g. 2026-10-16T15:04:05-04:00.
 * Saved sessions use local time so the report counts each session on the day you practised. */
export function localIso(d: Date) {
  const off = -d.getTimezoneOffset();
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const local = new Date(d.getTime() + off * 60_000).toISOString().slice(0, 19);
  return `${local}${off >= 0 ? "+" : "-"}${pad(off / 60)}:${pad(off % 60)}`;
}
