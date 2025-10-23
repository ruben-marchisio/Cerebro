import { useEffect, useMemo, useState } from "react";
import {
  Locale,
  localeLabels,
  locales,
  translate,
  type TranslationKey,
} from "./i18n";

export default function App() {
  const [locale, setLocale] = useState<Locale>("es");

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  const t = useMemo(
    () => (key: TranslationKey) => translate(locale, key),
    [locale],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-slate-100">
      <header className="drag-region flex h-12 items-center justify-between border-b border-white/5 bg-surface/80 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="no-drag flex h-8 w-8 items-center justify-center rounded-md bg-primary/20 text-lg">
            <span role="img" aria-label="CEREBRO">
              🧠
            </span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
              {t("appName")}
            </span>
            <span className="text-[11px] text-slate-500">{t("statusReady")}</span>
          </div>
        </div>

        <div className="no-drag flex items-center gap-2">
          {locales.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={`flex h-8 w-10 items-center justify-center rounded-md border border-white/10 text-xs font-semibold transition ${
                locale === code
                  ? "bg-primary text-white shadow-soft"
                  : "text-slate-400 hover:border-white/30 hover:text-white"
              }`}
            >
              {localeLabels[code]}
            </button>
          ))}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">
            {t("tagline")}
          </p>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="text-base text-slate-400 sm:text-lg">{t("heroSubtitle")}</p>
        </div>

        <div className="no-drag flex flex-wrap items-center justify-center gap-3">
          <button className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-primary/80">
            {t("primaryAction")}
          </button>
          <button className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white">
            {t("secondaryAction")}
          </button>
        </div>
      </main>
    </div>
  );
}
