import { THEME_KEY } from "@/lib/config";

export type Theme = "dark" | "light";

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyThemeClass(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#0F172A" : "#F5F0E8");
  }
}
