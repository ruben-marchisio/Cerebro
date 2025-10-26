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
import { clearMetrics, fetchRecentMetrics, type MetricRecord } from "./core/metrics";
import {
  probeLocalOllama,
  type OllamaProbeResult,
} from "./core/ai/detect";
import { getModelProfileById } from "./core/ai/modelProfiles";
import { isProviderProfileId, type ProviderProfileId } from "./core/ai/types";
import type { MCPMethod } from "./core/mcp";
import { MCP_METHOD_LABELS, MCP_SERVER_METADATA } from "./ui/mcpMetadata";
import { useMcpPermissionsStore } from "./store/mcpPermissionsStore";
import type { McpAccessLevel, McpPermission } from "./core/mcp/permissions";
import { useMcpClient } from "./hooks/useMcpClient";

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

const MCP_PROFILE_ORDER: ProviderProfileId[] = ["fast", "balanced", "thoughtful", "thoughtfulLocal"];

const MCP_ACCESS_LEVEL_OPTIONS: Array<{
  id: McpAccessLevel;
  label: TranslationKey;
}> = [
  { id: "basic", label: "mcpAccessLevelBasic" },
  { id: "dev", label: "mcpAccessLevelDev" },
  { id: "power", label: "mcpAccessLevelPower" },
];

type ProviderRuntime = "local" | "remote" | "memory" | "unknown";

const SHELL_PROFILES: ProviderProfileId[] = ["thoughtful", "thoughtfulLocal"];

const truncate = (value: string, limit = 160): string =>
  value.length > limit ? `${value.slice(0, limit)}…` : value;

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
  const mcpAccessLevel = useMcpPermissionsStore((state) => state.accessLevel);
  const setMcpAccessLevel = useMcpPermissionsStore(
    (state) => state.setAccessLevel,
  );
  const getEffectiveMcpPermissions = useMcpPermissionsStore(
    (state) => state.getEffectivePermissions,
  );
  const getBlockedMcpPermissions = useMcpPermissionsStore(
    (state) => state.getBlockedPermissions,
  );
  const isMcpAllowed = useMcpPermissionsStore((state) => state.isAllowed);
  const { callMcp } = useMcpClient(t);

  const [metrics, setMetrics] = useState<MetricRecord[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [ollamaProbe, setOllamaProbe] = useState<OllamaProbeResult | null>(null);
  const [isProbingOllama, setIsProbingOllama] = useState(false);
  const [isOllamaActionPending, setIsOllamaActionPending] = useState(false);
  const [systemPaths, setSystemPaths] = useState<{
    home: string;
    safeOrbit: string;
  } | null>(null);

  const refreshMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    try {
      const recent = await fetchRecentMetrics(20);
      setMetrics(recent);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  const refreshProbe = useCallback(async () => {
    setIsProbingOllama(true);
    try {
      const result = await probeLocalOllama();
      setOllamaProbe(result);
    } finally {
      setIsProbingOllama(false);
    }
  }, []);

  useEffect(() => {
    void refreshMetrics();
  }, [refreshMetrics]);

  useEffect(() => {
    void refreshProbe();
  }, [refreshProbe]);

  const shellProfileId = useMemo<ProviderProfileId | null>(() => {
    for (const candidate of SHELL_PROFILES) {
      if (isMcpAllowed(candidate, "mcp.shell", "exec")) {
        return candidate;
      }
    }
    return null;
  }, [isMcpAllowed, mcpAccessLevel]);

  useEffect(() => {
    let cancelled = false;

    if (!shellProfileId) {
      setSystemPaths(null);
      return undefined;
    }

    const loadPaths = async () => {
      try {
        const result = await callMcp<{ home?: string; safeOrbit?: string }>(
          "mcp.system",
          "info",
          { topic: "paths" },
          {
            profileId: shellProfileId,
            requireConfirmation: false,
            summary: "settings-system-paths",
          },
        );

        if (!cancelled && result?.home && result?.safeOrbit) {
          setSystemPaths({
            home: result.home,
            safeOrbit: result.safeOrbit,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("[settings] Failed to load system paths", error);
        }
      }
    };

    void loadPaths();

    return () => {
      cancelled = true;
    };
  }, [callMcp, shellProfileId]);

  const formatMcpMethods = useCallback(
    (methods: MCPMethod[]): string =>
      methods
        .map((method) =>
          t(MCP_METHOD_LABELS[method] ?? "mcpGenericLabel"),
        )
        .join(" · "),
    [t],
  );

  const mcpProfilePermissions = useMemo(
    () =>
      MCP_PROFILE_ORDER.map((profileId) => {
        const profile = getModelProfileById(profileId);
        if (!profile) {
          return null;
        }
        return {
          profileId,
          label: t(profile.label),
          allowed: getEffectiveMcpPermissions(profileId),
          blocked: getBlockedMcpPermissions(profileId),
        };
      }).filter(
        (entry): entry is NonNullable<typeof entry> => entry !== null,
      ),
    [
      getBlockedMcpPermissions,
      getEffectiveMcpPermissions,
      t,
      mcpAccessLevel,
    ],
  );

  const networkStatus = networkEnabled
    ? t("diagnosticsNetworkOnline")
    : t("diagnosticsNetworkOffline");

  const describeProvider = useCallback(
    (provider: string): { label: string; runtime: ProviderRuntime } => {
      const normalized = provider.trim().toLowerCase();
      if (normalized.includes("ollama")) {
        return { label: t("metricsProviderOllama"), runtime: "local" };
      }
      if (normalized.includes("deepseek")) {
        return { label: t("metricsProviderDeepseek"), runtime: "remote" };
      }
      if (normalized.includes("memory")) {
        return { label: t("metricsProviderMemory"), runtime: "memory" };
      }
      if (normalized.length === 0 || normalized === "unknown") {
        return { label: t("metricsProviderUnknown"), runtime: "unknown" };
      }
      return { label: provider, runtime: "unknown" };
    },
    [t],
  );

  const getRuntimeLabel = useCallback(
    (runtime: ProviderRuntime): string => {
      switch (runtime) {
        case "local":
          return t("metricsRuntimeLocal");
        case "remote":
          return t("metricsRuntimeRemote");
        case "memory":
          return t("metricsRuntimeOffline");
        default:
          return t("metricsRuntimeUnknown");
      }
    },
    [t],
  );

  const formatTimestamp = useCallback(
    (value: number): string =>
      new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(value)),
    [],
  );

  const formatModeLabel = useCallback(
    (mode: string): string => {
      if (isProviderProfileId(mode)) {
        const profile = getModelProfileById(mode);
        if (profile) {
          return t(profile.label);
        }
      }
      return mode;
    },
    [t],
  );

  const metricsRows = useMemo(
    () => [...metrics].reverse(),
    [metrics],
  );

  type FailureSummary = {
    provider: string;
    count: number;
    lastError?: string;
    lastModel?: string;
  };

  const failureSummary = useMemo<FailureSummary[]>(() => {
    const map = new Map<string, FailureSummary>();
    for (const entry of metrics) {
      if (entry.success) {
        continue;
      }
      const key = entry.provider.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (entry.error) {
          existing.lastError = entry.error;
        }
        if (entry.model) {
          existing.lastModel = entry.model;
        }
      } else {
        map.set(key, {
          provider: entry.provider,
          count: 1,
          lastError: entry.error ?? undefined,
          lastModel: entry.model ?? undefined,
        });
      }
    }
    return Array.from(map.values());
  }, [metrics]);

  const quickTips = useMemo(() => {
    const tips = new Set<string>();

    for (const entry of metrics) {
      if (entry.success) {
        continue;
      }
      const provider = entry.provider.toLowerCase();
      const errorText = (entry.error ?? "").toLowerCase();

      if (provider.includes("ollama")) {
       if (
         entry.model &&
         (errorText.includes("not found") ||
           errorText.includes("missing") ||
           errorText.includes("pull"))
       ) {
          tips.add(
            t("diagnosticsTipPullModel").replace(
              "{{model}}",
              entry.model,
            ),
          );
        } else if (
          errorText.includes("connection") ||
          errorText.includes("refused") ||
          errorText.includes("timeout")
        ) {
          tips.add(t("diagnosticsTipRestartOllama"));
        }
      } else if (provider.includes("deepseek")) {
        if (
          errorText.includes("api key") ||
          errorText.includes("apikey") ||
          errorText.includes("401") ||
          errorText.includes("unauthorized")
        ) {
          tips.add(t("diagnosticsTipDeepseekKey"));
        }
      }
    }

    if (tips.size === 0 && failureSummary.length > 0) {
      tips.add(t("diagnosticsTipCheckLogs"));
    }

    return Array.from(tips);
  }, [failureSummary, metrics, t]);

  const byProvider = useMemo(
    () =>
      failureSummary.map((item) => ({
        ...item,
        meta: describeProvider(item.provider),
      })),
    [describeProvider, failureSummary],
  );

  const ollamaStatus = useMemo(
    () => {
      if (isProbingOllama) {
        return {
          icon: "🟡",
          tone: "warning" as const,
          message: t("ollamaStatusChecking"),
          latency: null,
        };
      }
      if (!ollamaProbe) {
        return {
          icon: "⚪",
          tone: "muted" as const,
          message: t("ollamaStatusUnknown"),
          latency: null,
        };
      }
      if (ollamaProbe.ok) {
        const latency = ollamaProbe.latencyMs ?? null;
        if (latency !== null && latency > 350) {
          return {
            icon: "🟡",
            tone: "warning" as const,
            message: t("ollamaStatusSlow"),
            latency,
          };
        }
        return {
          icon: "🟢",
          tone: "success" as const,
          message: t("ollamaStatusReady"),
          latency,
        };
      }
      return {
        icon: "🔴",
        tone: "danger" as const,
        message: ollamaProbe.error
          ? `${t("ollamaStatusDown")} — ${ollamaProbe.error}`
          : t("ollamaStatusDown"),
        latency: ollamaProbe.latencyMs ?? null,
      };
    },
    [isProbingOllama, ollamaProbe, t],
  );

  const toneClass = useMemo(
    () => ({
      success: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
      warning: "border-amber-400/40 bg-amber-500/10 text-amber-200",
      danger: "border-rose-400/40 bg-rose-500/10 text-rose-200",
      muted: "border-slate-500/20 bg-slate-900/70 text-slate-300",
    }),
    [],
  );

  const handleClearMetrics = useCallback(async () => {
    if (!window.confirm(t("metricsClearConfirm"))) {
      return;
    }
    setIsLoadingMetrics(true);
    try {
      await clearMetrics();
    } finally {
      await refreshMetrics();
    }
  }, [refreshMetrics, t]);

  const handleRestartOllama = useCallback(async () => {
    if (!shellProfileId) {
      window.alert(t("ollamaRestartUnavailable"));
      return;
    }

    setIsOllamaActionPending(true);
    try {
      await callMcp(
        "mcp.shell",
        "exec",
        {
          command: "ollama",
          args: ["serve"],
        },
        {
          profileId: shellProfileId,
          requireConfirmation: true,
          summary: "settings-restart-ollama",
        },
      );
      window.alert(t("ollamaRestartSuccess"));
      await refreshProbe();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : String(error);
      window.alert(message || t("ollamaRestartError"));
    } finally {
      setIsOllamaActionPending(false);
    }
  }, [callMcp, refreshProbe, shellProfileId, t]);

  const handleViewOllamaLogs = useCallback(async () => {
    if (!shellProfileId || !systemPaths) {
      window.alert(t("ollamaLogsUnavailable"));
      return;
    }

    setIsOllamaActionPending(true);
    try {
      const logPath = `${systemPaths.home}/.ollama/logs/serve.log`;
      const result = await callMcp<{ stdout?: string }>(
        "mcp.shell",
        "exec",
        {
          command: "tail",
          args: ["-n", "80", logPath],
        },
        {
          profileId: shellProfileId,
          requireConfirmation: true,
          summary: "settings-view-ollama-logs",
        },
      );
      const output = (result?.stdout ?? "").trim();
      if (output.length === 0) {
        window.alert(t("ollamaLogsEmpty"));
      } else {
        window.alert(`${t("ollamaLogsTitle")}\n\n${output}`);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("ollamaLogsError");
      window.alert(message);
    } finally {
      setIsOllamaActionPending(false);
    }
  }, [callMcp, shellProfileId, systemPaths, t]);

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
                className="rounded-md border border-slate-500/30 bg-slate-800/60 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:bg-slate-700/60 disabled:opacity-50"
                disabled={isProbingOllama}
              >
                {isProbingOllama ? t("diagnosticsRefreshing") : t("diagnosticsRefresh")}
              </button>
            </div>
            <div
              className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${toneClass[ollamaStatus.tone]}`}
            >
              <div className="flex items-center gap-2">
                <span>{ollamaStatus.icon}</span>
                <span className="font-semibold">{ollamaStatus.message}</span>
                {typeof ollamaStatus.latency === "number" && (
                  <span className="font-mono text-xs text-slate-200/80">
                    {ollamaStatus.latency} {t("metricsLatencyUnit")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleRestartOllama()}
                  disabled={
                    !shellProfileId || isOllamaActionPending
                  }
                  className="rounded-md border border-blue-300/40 bg-blue-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("ollamaRestart")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleViewOllamaLogs()}
                  disabled={
                    !shellProfileId ||
                    !systemPaths ||
                    isOllamaActionPending
                  }
                  className="rounded-md border border-slate-300/30 bg-slate-800/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("ollamaLogsButton")}
                </button>
              </div>
            </div>
            {!shellProfileId && (
              <p className="mt-2 text-[11px] text-slate-500">
                {t("ollamaRestartUnavailable")}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm uppercase tracking-[0.35em] text-slate-400">
              {t("mcpSettingsTitle")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {t("mcpSettingsSubtitle")}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
              {t("mcpAccessLevelLabel")}
            </span>
            <div className="flex flex-wrap gap-2">
              {MCP_ACCESS_LEVEL_OPTIONS.map((option) => {
                const isActive = option.id === mcpAccessLevel;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => void setMcpAccessLevel(option.id)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] transition ${isActive ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-slate-900/70 text-slate-300 hover:border-white/20"}`}
                  >
                    {t(option.label)}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-slate-500">
              {t("mcpAccessLevelHint")}
            </span>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {mcpProfilePermissions.map((entry) => (
            <div
              key={entry.profileId}
              className="rounded-xl border border-slate-500/20 bg-slate-950/60 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200">
                  {entry.label}
                </p>
                <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                  {entry.profileId}
                </span>
              </div>
              {entry.allowed.length > 0 ? (
                <div className="mt-3">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">
                    {t("mcpActiveSection")}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {entry.allowed.map((rule: McpPermission) => {
                      const info = MCP_SERVER_METADATA[rule.serverId];
                      return (
                        <span
                          key={`${entry.profileId}-${rule.serverId}-allowed`}
                          className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-[2px] text-[11px] font-semibold text-emerald-200"
                        >
                          <span>{info?.icon ?? "🛠️"}</span>
                          <span>{t(info?.label ?? "mcpGenericLabel")}</span>
                          <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-emerald-200/80">
                            {formatMcpMethods(rule.methods)}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-slate-500">
                  {t("mcpNoPermissions")}
                </p>
              )}
              {entry.blocked.length > 0 && (
                <div className="mt-3 border-t border-slate-800/40 pt-2">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-amber-300">
                    {t("mcpBlockedSection")}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {entry.blocked.map((rule: McpPermission) => {
                      const info = MCP_SERVER_METADATA[rule.serverId];
                      return (
                        <span
                          key={`${entry.profileId}-${rule.serverId}-blocked`}
                          className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-[2px] text-[11px] font-semibold text-amber-200"
                        >
                          <span>{info?.icon ?? "🛠️"}</span>
                          <span>{t(info?.label ?? "mcpGenericLabel")}</span>
                          <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-amber-200/80">
                            {formatMcpMethods(rule.methods)}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm uppercase tracking-[0.35em] text-slate-400">
              {t("diagnosticsMetrics")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {t("diagnosticsMetricsSubtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshMetrics()}
              className="rounded-md border border-slate-500/30 bg-slate-800/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:bg-slate-700/60 disabled:opacity-50"
              disabled={isLoadingMetrics}
            >
              {isLoadingMetrics ? t("diagnosticsRefreshing") : t("diagnosticsRefresh")}
            </button>
            <button
              type="button"
              onClick={() => void handleClearMetrics()}
              className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50"
              disabled={isLoadingMetrics || metrics.length === 0}
            >
              {t("metricsClearButton")}
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-500/20 bg-slate-950/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              {t("diagnosticsFailuresTitle")}
            </p>
            {byProvider.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {byProvider.map((item) => (
                  <span
                    key={item.provider}
                    className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-[2px] text-[11px] text-amber-100"
                  >
                    <span className="font-semibold">{item.meta.label}</span>
                    {item.lastModel && (
                      <span className="text-[10px] text-amber-200/80">
                        {item.lastModel}
                      </span>
                    )}
                    <span className="font-mono text-[10px]">
                      ×{item.count}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                {t("diagnosticsNoFailures")}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-slate-500/20 bg-slate-950/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              {t("diagnosticsTipsTitle")}
            </p>
            {quickTips.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {quickTips.map((tip, index) => (
                  <li key={`${tip}-${index}`} className="flex items-start gap-2">
                    <span className="mt-[2px] text-slate-500">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                {t("diagnosticsNoTips")}
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-500/20">
          <table className="w-full border-collapse text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-[10px] uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("metricsTimestamp")}</th>
                <th className="px-3 py-2">{t("metricsProvider")}</th>
                <th className="px-3 py-2">{t("metricsModel")}</th>
                <th className="px-3 py-2">{t("metricsMode")}</th>
                <th className="px-3 py-2 text-right">{t("metricsLatency")}</th>
                <th className="px-3 py-2 text-right">{t("metricsTokens")}</th>
                <th className="px-3 py-2 text-center">{t("metricsResult")}</th>
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
                metricsRows.map((entry, index) => {
                  const providerMeta = describeProvider(entry.provider);
                  return (
                    <tr
                      key={`${entry.ts}-${index}`}
                      className="border-t border-slate-800/40"
                    >
                      <td className="px-3 py-2 text-xs text-slate-300">
                        {formatTimestamp(entry.ts)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="block text-sm font-semibold text-slate-200">
                          {providerMeta.label}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                          {getRuntimeLabel(providerMeta.runtime)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-300">
                        {entry.model ?? t("metricsModelUnknown")}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-300">
                        {formatModeLabel(entry.mode)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-slate-300">
                        {typeof entry.latencyMs === "number"
                          ? `${entry.latencyMs} ${t("metricsLatencyUnit")}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-200">
                        {typeof entry.promptTokens === "number" ||
                        typeof entry.outputTokens === "number" ? (
                          <>
                            <span>{entry.promptTokens ?? "—"}</span>
                            <span className="mx-1 text-slate-500">/</span>
                            <span>{entry.outputTokens ?? "—"}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center justify-center rounded-full border px-2 py-[1px] text-[10px] font-semibold uppercase tracking-[0.35em] ${entry.success ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" : "border-rose-400/50 bg-rose-500/15 text-rose-200"}`}
                        >
                          {entry.success ? t("metricsResultOk") : t("metricsResultErr")}
                        </span>
                        {!entry.success && entry.error && (
                          <span className="mt-1 block text-[10px] text-rose-200/80">
                            {truncate(entry.error, 160)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
