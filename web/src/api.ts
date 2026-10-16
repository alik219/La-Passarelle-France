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

export const resetProgress = () => request<{ removed: number }>("/api/progress", { method: "DELETE" });

export const chat = (mode: string, history: Turn[], level: Level, address: Address) =>
  request<TutorReply>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, history, level, address }),
  });
