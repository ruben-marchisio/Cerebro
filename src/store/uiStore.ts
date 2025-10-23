import { create } from "zustand";

import { localeStorageKey, Locale, resolveInitialLocale } from "../i18n";

type Theme = "dark" | "light";

type UIState = {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  theme: Theme;
  toggleTheme: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  locale: resolveInitialLocale(),
  setLocale: (nextLocale) =>
    set(() => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(localeStorageKey, nextLocale);
      }
      return { locale: nextLocale };
    }),
  theme: "dark",
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === "dark" ? "light" : "dark",
    })),
}));

export const getLocale = (): Locale => useUIStore.getState().locale;

export const setLocale = (locale: Locale): void =>
  useUIStore.getState().setLocale(locale);
