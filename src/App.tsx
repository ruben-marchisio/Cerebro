import { useCallback, useEffect, useMemo, useState } from "react";
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
import { fetchRecentMetrics, type MetricRecord } from "./core/metrics";
import {
  probeLocalOllama,
  type OllamaProbeResult,
} from "./core/ai/detect";

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

function Settings({ t }: PageProps) {
  const networkEnabled = useSettingsStore(
    (state) => state.settings.network.enabled,
  );
  const [metrics, setMetrics] = useState<MetricRecord[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [ollamaProbe, setOllamaProbe] = useState<OllamaProbeResult | null>(null);
  const [isProbingOllama, setIsProbingOllama] = useState(false);

  const refreshMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    const recent = await fetchRecentMetrics(12);
    setMetrics(recent);
    setIsLoadingMetrics(false);
  }, []);

  const refreshProbe = useCallback(async () => {
    setIsProbingOllama(true);
    const result = await probeLocalOllama();
    setOllamaProbe(result);
    setIsProbingOllama(false);
  }, []);

  useEffect(() => {
    void refreshMetrics();
  }, [refreshMetrics]);

  useEffect(() => {
    void refreshProbe();
  }, [refreshProbe]);

  const networkStatus = networkEnabled
    ? t("diagnosticsNetworkOnline")
    : t("diagnosticsNetworkOffline");

  const ollamaStatusLabel = (() => {
    if (!ollamaProbe) {
      return t("diagnosticsOllamaUnknown");
    }
    if (ollamaProbe.ok) {
      const latency =
        typeof ollamaProbe.latencyMs === "number"
          ? ` (${ollamaProbe.latencyMs} ms)`
          : "";
      return `${t("diagnosticsOllamaReady")}${latency}`;
    }
    return `${t("diagnosticsOllamaDown")}${
      ollamaProbe.error ? ` — ${ollamaProbe.error}` : ""
    }`;
  })();

  const metricsRows = [...metrics].reverse();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
        <h2 className="text-sm uppercase tracking-[0.35em] text-slate-400">
          {t("diagnosticsTitle")}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-500/20 bg-slate-950/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              {t("diagnosticsNetwork")}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-200">
              {networkStatus}
            </p>
          </div>
          <div className="rounded-xl border border-slate-500/20 bg-slate-950/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                {t("diagnosticsOllama")}
              </p>
              <button
                type="button"
                onClick={() => void refreshProbe()}
                className="rounded-md border border-slate-500/30 bg-slate-800/60 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:bg-slate-700/60"
              >
                {isProbingOllama ? t("diagnosticsRefreshing") : t("diagnosticsRefresh")}
              </button>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-200">
              {ollamaStatusLabel}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm uppercase tracking-[0.35em] text-slate-400">
              {t("diagnosticsMetrics")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {t("diagnosticsMetricsSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshMetrics()}
            className="rounded-md border border-slate-500/30 bg-slate-800/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:bg-slate-700/60"
          >
            {t("diagnosticsRefresh")}
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-500/20">
          <table className="w-full border-collapse text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-[10px] uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("metricsTimestamp")}</th>
                <th className="px-3 py-2">{t("metricsMode")}</th>
                <th className="px-3 py-2">{t("metricsProvider")}</th>
                <th className="px-3 py-2 text-right">{t("metricsLatency")}</th>
                <th className="px-3 py-2 text-right">{t("metricsTokensIn")}</th>
                <th className="px-3 py-2 text-right">{t("metricsTokensOut")}</th>
                <th className="px-3 py-2 text-center">{t("metricsSuccess")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingMetrics && (
                <tr>
                  <td
                    className="px-3 py-4 text-center text-slate-500"
                    colSpan={7}
                  >
                    {t("diagnosticsLoading")}
                  </td>
                </tr>
              )}
              {!isLoadingMetrics && metricsRows.length === 0 && (
                <tr>
                  <td
                    className="px-3 py-4 text-center text-slate-500"
                    colSpan={7}
                  >
                    {t("diagnosticsMetricsEmpty")}
                  </td>
                </tr>
              )}
              {!isLoadingMetrics &&
                metricsRows.map((entry) => (
                  <tr key={`${entry.timestamp}-${entry.mode}-${entry.provider}`} className="odd:bg-slate-950/40">
                    <td className="px-3 py-2">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 uppercase tracking-[0.2em]">
                      {entry.mode}
                    </td>
                    <td className="px-3 py-2">{entry.provider}</td>
                    <td className="px-3 py-2 text-right">
                      {typeof entry.latencyMs === "number" ? `${entry.latencyMs} ms` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {typeof entry.tokensIn === "number" ? entry.tokensIn : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {typeof entry.tokensOut === "number" ? entry.tokensOut : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {entry.success ? "✅" : "⚠️"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const locale = useSettingsStore((state) => state.settings.language);
  const updateLanguage = useSettingsStore((state) => state.setLanguage);
  const networkEnabled = useSettingsStore(
    (state) => state.settings.network.enabled,
  );
  const setNetworkEnabled = useSettingsStore(
    (state) => state.setNetworkEnabled,
  );
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
            <button
              type="button"
              onClick={() => {
                void setNetworkEnabled(!networkEnabled);
              }}
              className={`rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] transition focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${networkEnabled ? "border-emerald-300/60 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-slate-900/80 text-slate-300 hover:border-white/20"}`}
              title={networkEnabled ? t("networkOnlineTooltip") : t("networkOfflineTooltip")}
            >
              {networkEnabled ? t("networkOnlineLabel") : t("networkOfflineLabel")}
            </button>
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
          <div className="mb-4 flex flex-col gap-3">
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] ${networkEnabled ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-amber-400/50 bg-amber-500/10 text-amber-200"}`}
            >
              <span>
                {networkEnabled
                  ? t("networkOnlineBanner")
                  : t("networkOfflineBanner")}
              </span>
              <span className="font-mono text-[10px] lowercase tracking-normal text-slate-400">
                {networkEnabled ? t("networkOnlineBadge") : t("networkOfflineBadge")}
              </span>
            </div>
          </div>
          <Routes>
            <Route path="/" element={<Home t={t} />} />
            <Route path="/dashboard" element={<Dashboard t={t} />} />
            <Route path="/chat" element={<Chat t={t} />} />
            <Route path="/settings" element={<Settings t={t} />} />
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
