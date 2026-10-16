import { useState } from "react";

export const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type Level = (typeof LEVELS)[number];
export type Address = "vous" | "tu";

export const LEVEL_NAMES: Record<Level, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
  C1: "Advanced",
};

/** A setting remembered in this browser (falls back to the default if storage is unavailable). */
function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved && (allowed as readonly string[]).includes(saved)) return saved as T;
    } catch {
      /* ignore */
    }
    return fallback;
  });

  function update(next: T) {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* ignore */
    }
  }

  return [value, update] as const;
}

export const useLevel = () => useStoredChoice<Level>("pf-level", LEVELS, "A2");
export const useAddress = () => useStoredChoice<Address>("pf-address", ["vous", "tu"], "vous");
