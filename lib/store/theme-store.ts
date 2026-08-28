"use client";

import { create } from "zustand";
import { THEME_KEY } from "@/lib/config";
import { applyThemeClass, readStoredTheme, type Theme } from "@/lib/theme";

interface ThemeState {
  theme: Theme;
  hydrated: boolean;
  hydrate: () => void;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  hydrated: false,
  hydrate: () => {
    const theme = readStoredTheme();
    applyThemeClass(theme);
    set({ theme, hydrated: true });
  },
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* private mode */
    }
    applyThemeClass(theme);
    set({ theme });
  },
  toggle: () => {
    get().setTheme(get().theme === "dark" ? "light" : "dark");
  },
}));
