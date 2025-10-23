import { useEffect, useMemo, useState } from "react";
import WindowControls from "./components/WindowControls";
import {
  availableLocales,
  fallbackLocale,
  getLocaleLabel,
  Locale,
  TranslationKey,
  translate,
} from "./i18n";

const storageKey = "cerebro:locale";

const isLocale = (value: string): value is Locale =>
  availableLocales.some((item) => item.code === value);

const resolveInitialLocale = (): Locale => {
  if (typeof window === "undefined") {
    return fallbackLocale;
  }

  const stored = window.localStorage.getItem(storageKey);
  if (stored && isLocale(stored)) {
    return stored;
  }

  const browserLang = window.navigator.language?.slice(0, 2).toLowerCase();
  if (browserLang && isLocale(browserLang)) {
    return browserLang;
  }

  return fallbackLocale;
};

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => resolveInitialLocale());

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, locale);
    }
  }, [locale]);

  const t = useMemo(
    () => (key: TranslationKey) => translate(locale, key),
    [locale],
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header
        className="drag-region flex items-center justify-between border-b border-white/5 bg-slate-900/80 px-4 py-2 backdrop-blur"
        data-tauri-drag-region
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="no-drag flex select-none flex-col leading-none">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
              {t("appName")}
            </span>
            <span className="text-sm text-slate-500">{t("topbarTitle")}</span>
          </div>
        </div>
        <div className="no-drag flex items-center gap-3">
          <label
            htmlFor="locale-selector"
            className="text-xs font-medium text-slate-400"
          >
            {t("languageLabel")}
          </label>
          <select
            id="locale-selector"
            value={locale}
            onChange={(event) => {
              const next = event.target.value;
              if (isLocale(next)) {
                setLocale(next);
              }
            }}
            className="rounded-md border border-white/10 bg-slate-900/80 px-2 py-1 text-xs text-slate-200 outline-none transition hover:border-white/20 focus:border-white/40"
          >
            {availableLocales.map((option) => (
              <option key={option.code} value={option.code}>
                {getLocaleLabel(option.code)}
              </option>
            ))}
          </select>
        </div>
        <WindowControls />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 text-center">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-500">
              {t("tagline")}
            </p>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold text-slate-100 md:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="text-base leading-relaxed text-slate-400">
              {t("heroSubtitle")}
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              className="no-drag inline-flex items-center justify-center rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400"
            >
              {t("primaryAction")}
            </button>
            <button
              type="button"
              className="no-drag inline-flex items-center justify-center rounded-lg border border-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/5"
            >
              {t("secondaryAction")}
            </button>
          </div>
        </div>
      </main>

      <footer className="flex items-center justify-between border-t border-white/5 bg-slate-900/60 px-4 py-2 text-xs text-slate-500">
        <span>{t("statusReady")}</span>
        <span className="uppercase tracking-[0.3em] text-slate-600">
          {t("appName")}
        </span>
      </footer>
    </div>
  );
}
