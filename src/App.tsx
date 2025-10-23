import { useEffect, useMemo } from "react";
import { HashRouter, Route, Routes, useNavigate } from "react-router-dom";
import WindowControls from "./components/WindowControls";
import Button from "./components/ui/Button";
import SectionTitle from "./components/ui/SectionTitle";
import {
  availableLocales,
  getLocaleLabel,
  isLocale,
  TranslationKey,
  translate,
} from "./i18n";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import { defaultSettings } from "./core/config/settings";
import { useSettingsStore } from "./store/settingsStore";

if (typeof window !== "undefined") {
  const settingsState = useSettingsStore.getState();
  if (!settingsState.isHydrated) {
    void settingsState.hydrate();
  }
}

type Translator = (key: TranslationKey) => string;

type PageProps = {
  t: Translator;
};

function Home({ t }: PageProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 text-center">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500">
            {t("tagline")}
          </p>
        </div>
        <div className="space-y-4">
          <SectionTitle title={t("heroTitle")} subtitle={t("heroSubtitle")} />
        </div>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            onClick={() => navigate("/dashboard")}
          >
            {t("primaryAction")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate("/chat")}
          >
            {t("openChat")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Settings() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-slate-900/60 px-8 py-10 text-center shadow-lg shadow-slate-950/30">
        <p className="text-sm uppercase tracking-[0.4em] text-slate-500">
          Settings
        </p>
        <h2 className="mt-4 text-xl font-semibold text-slate-200">
          Coming soon
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Configure integrations, preferences, and shortcuts from here.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const locale = useSettingsStore((state) => state.settings.language);
  const updateLanguage = useSettingsStore((state) => state.setLanguage);
  const isSettingsHydrated = useSettingsStore((state) => state.isHydrated);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useMemo<Translator>(
    () => (key: TranslationKey) => translate(locale, key),
    [locale],
  );

  if (!isSettingsHydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <p className="text-sm">
          {translate(defaultSettings.language, "loading")}
        </p>
      </div>
    );
  }

  return (
    <HashRouter>
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
                  void updateLanguage(next);
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

        <main className="flex flex-1 flex-col overflow-y-auto px-6 py-10">
          <Routes>
            <Route path="/" element={<Home t={t} />} />
            <Route path="/dashboard" element={<Dashboard t={t} />} />
            <Route path="/chat" element={<Chat t={t} />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Home t={t} />} />
          </Routes>
        </main>

        <footer className="flex items-center justify-between border-t border-white/5 bg-slate-900/60 px-4 py-2 text-xs text-slate-500">
          <span>{t("statusReady")}</span>
          <span className="uppercase tracking-[0.3em] text-slate-600">
            {t("appName")}
          </span>
        </footer>
      </div>
    </HashRouter>
  );
}
