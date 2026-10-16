import type { Address, Level } from "./settings";

export type Mode = {
  id: string;
  title: string;
  description: string;
  icon: string;
  heading: string;
  opening: Record<Address, string>;
  opening_translation: string;
  opening_hint: string;
  enabled: boolean;
};

export type Turn = { role: "tutor" | "learner"; text: string };

export type Correction = {
  original: string; // the wrong words, as the learner wrote them
  corrected: string; // the learner's whole message, fixed
  explanation: string; // why, in plain English
  category: string; // tense, word_choice, ... (for the future feedback report)
};

export type TutorReply = {
  reply: string;
  correction: Correction | null;
  hint: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error("Couldn't reach the backend. Is `python server.py` running?");
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      if (res.status >= 500) detail = "Couldn't reach the backend. Is `python server.py` running?";
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const getModes = () => request<Mode[]>("/api/modes");

export const translate = (text: string) =>
  request<{ translation: string }>("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).then((r) => r.translation);

export type Speech = {
  audio_b64: string;
  mime: string;
  words: string[]; // word timings, for lip-sync later
  wtimes: number[];
  wdurations: number[];
};

export const speak = (text: string) =>
  request<Speech>("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

export const transcribe = (audio: Blob) => {
  const ext = audio.type.includes("ogg") ? "ogg" : audio.type.includes("mp4") ? "m4a" : "webm";
  const form = new FormData();
  form.append("audio", audio, `answer.${ext}`);
  return request<{ text: string }>("/api/transcribe", { method: "POST", body: form }).then((r) => r.text);
};

// ---------- Memory: saved sessions and weak points ----------

export type CategoryCount = { category: string; label: string; count: number };

export type SessionStats = {
  id: string;
  mode: string;
  level: string;
  started_at: string;
  duration_seconds: number;
  messages_sent: number;
  corrections: number;
  by_category: CategoryCount[];
  note: string | null;
  exam: { score: number; nclc: string; practice_mode: boolean } | null;
};

export type WeakPoint = CategoryCount & { example: { original: string; corrected: string } };

export type Progress = { weak_points: WeakPoint[]; sessions: SessionStats[] };

export type SessionToSave = {
  id: string;
  mode: string;
  level: Level;
  address: Address;
  started_at: string;
  messages: { role: "tutor" | "learner"; text: string; correction?: Correction | null }[];
};

export const saveSession = (session: SessionToSave) =>
  request<({ saved: true } & SessionStats) | { saved: false }>("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...session, write_note: true }),
  });

/** Best-effort save while the tab is closing (no note: nobody will be there to read it). */
export const saveSessionOnClose = (session: SessionToSave) =>
  navigator.sendBeacon(
    "/api/sessions",
    new Blob([JSON.stringify({ ...session, write_note: false })], { type: "application/json" }),
  );

export const getProgress = () => request<Progress>("/api/progress");

// ---------- Feedback Report ----------

export type ReportPeriod = "7" | "30" | "all";

export type Report = {
  period_days: number | null;
  stats: {
    seconds: number;
    sessions: number;
    conversations: number;
    exams: number;
    messages: number;
    corrections: number;
    active_days: number;
    streak: number;
  };
  exams: { date: string; score: number; nclc: string; tasks: Record<string, number> }[];
  mistakes: {
    weekly: boolean;
    buckets: string[]; // ISO dates: each day, or the Monday of each week
    series: Record<string, number[]>; // category -> count per bucket
    categories: (CategoryCount & { example: { original: string; corrected: string } })[];
    colour_order: string[]; // all-time ranking, so a category keeps its colour across periods
  };
};

export const getReport = (period: ReportPeriod) => request<Report>(`/api/report?period=${period}`);

export type Focus = {
  category: string;
  label: string;
  opening: string;
  opening_translation: string;
  opening_hint: string;
};

export const getFocus = (category: string, address: Address) =>
  request<Focus>(`/api/focus/${encodeURIComponent(category)}?address=${address}`);

// ---------- TCF Canada timed exam ----------

export type ExamItem = { id: string; fr: string; en: string; role?: string };

export type ExamTask = {
  task: 1 | 2 | 3;
  title: string;
  title_fr: string;
  instructions: string;
  talk_seconds: number;
  prep_seconds: number;
  item: ExamItem | null;
  opening: string;
  opening_translation: string;
};

export type ExamPlan = { tasks: ExamTask[]; closing: string; closing_translation: string };

export type TaskResult = {
  task: number;
  score: number; // out of 20
  nclc: string;
  strengths: string[];
  improvements: string[];
  corrections: Correction[];
};

export const getExamPlan = (tasks: number[]) => request<ExamPlan>(`/api/exam/plan?tasks=${tasks.join(",")}`);

const postJson = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const examTurn = (task: number, itemId: string | null, history: Turn[]) =>
  postJson<{ reply: string; hint: string }>("/api/exam/turn", { task, item_id: itemId, history });

export const examEvaluate = (task: number, itemId: string | null, history: Turn[]) =>
  postJson<TaskResult>("/api/exam/evaluate", { task, item_id: itemId, history });

export const saveExam = (exam: {
  id: string;
  started_at: string;
  practice_mode: boolean;
  tasks: { task: number; item_id: string | null; history: Turn[]; score: number; corrections: Correction[] }[];
}) => postJson<{ saved: boolean; exam?: { score: number; nclc: string } }>("/api/exam/save", exam);

export const resetProgress = () => request<{ removed: number }>("/api/progress", { method: "DELETE" });

export const chat = (mode: string, history: Turn[], level: Level, address: Address, focus?: string | null) =>
  request<TutorReply>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, history, level, address, focus: focus ?? null }),
  });
