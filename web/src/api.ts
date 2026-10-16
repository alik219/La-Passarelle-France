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
  translation: string;
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

export const chat = (mode: string, history: Turn[], level: Level, address: Address) =>
  request<TutorReply>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, history, level, address }),
  });
