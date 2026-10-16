import { Moon, Sun } from "lucide-react";
import { useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || "light",
  );

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("pf-theme", next);
    } catch {
      /* storage unavailable: the choice just won't be remembered */
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
