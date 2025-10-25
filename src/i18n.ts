import { getDefaultLanguage } from "./core/config/settings";

export type Locale = "es" | "en";

export const availableLocales: Array<{ code: Locale; label: string }> = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
];

export const fallbackLocale: Locale = getDefaultLanguage();

export const localeStorageKey = "cerebro:locale";

export const isLocale = (value: string): value is Locale =>
  availableLocales.some((item) => item.code === value);

export const resolveInitialLocale = (): Locale => {
  if (typeof window === "undefined") {
    return fallbackLocale;
  }

  const stored = window.localStorage.getItem(localeStorageKey);
  if (stored && isLocale(stored)) {
    return stored;
  }

  const browserLang = window.navigator.language?.slice(0, 2).toLowerCase();
  if (browserLang && isLocale(browserLang)) {
    return browserLang;
  }

  return fallbackLocale;
};

const dictionaries = {
  es: {
    appName: "CEREBRO",
    tagline: "Tu copiloto para automatizar flujos de desarrollo.",
    heroTitle: "Tu asistente de desarrollo en el escritorio",
    heroSubtitle:
      "Organiza tareas, lanza comandos y concentra el conocimiento de tu equipo en un panel elegante y oscuro.",
    primaryAction: "Abrir panel de control",
    secondaryAction: "Ver documentación",
    statusReady: "Listo",
    topbarTitle: "Panel principal",
    languageLabel: "Idioma",
    networkOfflineLabel: "Offline",
    networkOnlineLabel: "Online",
    networkOfflineTooltip: "Activá la conexión remota para acceder a servicios externos.",
    networkOnlineTooltip: "Desactiva la red para forzar el modo 100% local.",
    networkOfflineBanner: "Modo Avión: ejecución 100% local",
    networkOnlineBanner: "Modo Online: remoto habilitado",
    networkOfflineBadge: "modo_local",
    networkOnlineBadge: "modo_remoto",
    ollamaStatusChecking: "Chequeando Ollama...",
    ollamaStatusReady: "Ollama activo",
    ollamaStatusSlow: "Ollama responde lento",
    ollamaStatusDown: "Ollama no responde",
    ollamaRestart: "Reiniciar Ollama",
    ollamaRestartSuccess: "Ollama reiniciado",
    ollamaRestartError: "No se pudo reiniciar Ollama",
    ollamaRestartUnavailable: "Activá el modo Pensativo para controlar Ollama",
    ollamaLogsButton: "Ver logs",
    ollamaLogsTitle: "Últimas líneas de Ollama",
    ollamaLogsEmpty: "No se encontraron entradas recientes.",
    ollamaLogsError: "No se pudieron leer los logs de Ollama.",
    ollamaLogsUnavailable: "Logs no disponibles en este modo.",
    mcpPanelTitle: "MCP activos",
    mcpFilesLabel: "Archivos",
    mcpGitLabel: "Git",
    mcpShellLabel: "Shell",
    mcpSystemLabel: "Sistema",
    mcpTauriLabel: "Tauri",
    mcpGenericLabel: "MCP",
    diagnosticsTitle: "Diagnóstico",
    diagnosticsNetwork: "Red",
    diagnosticsNetworkOnline: "Modo online activo",
    diagnosticsNetworkOffline: "Modo offline activo",
    diagnosticsOllama: "Ollama",
    diagnosticsOllamaReady: "Ollama operativo",
    diagnosticsOllamaDown: "Ollama fuera de línea",
    diagnosticsOllamaUnknown: "Sin datos de Ollama",
    diagnosticsRefresh: "Actualizar",
    diagnosticsRefreshing: "Actualizando...",
    diagnosticsMetrics: "Métricas recientes",
    diagnosticsMetricsSubtitle: "Últimas ejecuciones registradas",
    diagnosticsMetricsEmpty: "Aún no se registraron métricas.",
    diagnosticsLoading: "Cargando...",
    metricsTimestamp: "Fecha",
    metricsMode: "Modo",
    metricsProvider: "Proveedor",
    metricsLatency: "Latencia",
    metricsTokensIn: "Tokens in",
    metricsTokensOut: "Tokens out",
    metricsSuccess: "OK",
    dashboardTitle: "Panel principal",
    dashboardSubtitle:
      "Explora tus flujos recientes, accesos directos y la actividad del equipo en un vistazo.",
    backHome: "Volver al inicio",
    projectsTitle: "Proyectos",
    globalProject: "Global",
    newProject: "Nuevo proyecto",
    newThread: "Nuevo hilo",
    composerPlaceholder: "Escribe un mensaje...",
    send: "Enviar",
    stop: "Detener",
    modelLabel: "Modelo",
    modelUnavailable:
      "El modelo avanzado no está disponible con la configuración actual.",
    modelFastUnavailable: "El perfil Rápido no está disponible en tu máquina.",
    modelSwitchToBalanced: "Cambiar a Equilibrado",
    modelProfileFastLabel: "⚡ Rápido",
    modelProfileFastDescription:
      "Respuestas ágiles para iterar ideas y tareas cortas.",
    modelProfileBalancedLabel: "🎯 Equilibrado",
    modelProfileBalancedDescription:
      "Equilibrio entre velocidad y contexto para trabajo diario.",
    modelProfileThoughtfulLabel: "🧩 Pensativo",
    modelProfileThoughtfulDescription:
      "Más espacio para razonamientos y respuestas extensas.",
    fastDescShort: "Resúmenes veloces (4-6 líneas).",
    balancedDescShort: "2-4 párrafos claros con ejemplo.",
    thoughtfulDescShort: "Más contexto y detalle.",
    modelProfileDeepseek13Label: "deepseek-1.3",
    modelProfileDeepseek13Description:
      "Modelo remoto estándar de DeepSeek para uso general.",
    modelProfileDeepseek67Label: "deepseek-6.7",
    modelProfileDeepseek67Description:
      "Modelo de razonamiento avanzado de DeepSeek (requiere clave).",
    completionError: "No se pudo completar la respuesta del asistente.",
    runtimeLocal: "Local (Ollama)",
    runtimeRemote: "Remoto (DeepSeek)",
    runtimeNone: "Sin modelo",
    runtimeSetupCta: "Guía de configuración",
    emptyMessages:
      "No hay mensajes en este contexto. Envía el primero para comenzar la conversación.",
    openChat: "Abrir chat",
    loading: "Cargando...",
    emptyProjects: "No hay proyectos todavía.",
    emptyThreads: "No hay hilos todavía.",
    selectContext: "Selecciona un proyecto o usa Global.",
    selectThread: "Selecciona un hilo para comenzar.",
    assistantPlaceholder: "El asistente está pensando...",
    roleUser: "Usuario",
    roleAssistant: "Asistente",
    roleSystem: "Sistema",
  },
  en: {
    appName: "CEREBRO",
    tagline: "Your co-pilot for automating developer workflows.",
    heroTitle: "Your development assistant on the desktop",
    heroSubtitle:
      "Organize tasks, launch commands, and gather your team's knowledge inside a sleek dark dashboard.",
    primaryAction: "Open control center",
    secondaryAction: "View documentation",
    statusReady: "Ready",
    topbarTitle: "Main dashboard",
    languageLabel: "Language",
    networkOfflineLabel: "Offline",
    networkOnlineLabel: "Online",
    networkOfflineTooltip: "Enable the remote connection to access external providers.",
    networkOnlineTooltip: "Disable networking to enforce fully local mode.",
    networkOfflineBanner: "Airplane mode: running 100% locally",
    networkOnlineBanner: "Online mode: remote providers enabled",
    networkOfflineBadge: "local_only",
    networkOnlineBadge: "remote_ready",
    ollamaStatusChecking: "Checking Ollama...",
    ollamaStatusReady: "Ollama is up",
    ollamaStatusSlow: "Ollama is responding slowly",
    ollamaStatusDown: "Ollama is not reachable",
    ollamaRestart: "Restart Ollama",
    ollamaRestartSuccess: "Ollama restarted",
    ollamaRestartError: "Could not restart Ollama",
    ollamaRestartUnavailable: "Switch to Thoughtful mode to manage Ollama",
    ollamaLogsButton: "View logs",
    ollamaLogsTitle: "Latest Ollama logs",
    ollamaLogsEmpty: "No recent entries found.",
    ollamaLogsError: "Unable to read Ollama logs.",
    ollamaLogsUnavailable: "Logs are unavailable in this mode.",
    mcpPanelTitle: "Active MCP",
    mcpFilesLabel: "Files",
    mcpGitLabel: "Git",
    mcpShellLabel: "Shell",
    mcpSystemLabel: "System",
    mcpTauriLabel: "Tauri",
    mcpGenericLabel: "MCP",
    diagnosticsTitle: "Diagnostics",
    diagnosticsNetwork: "Network",
    diagnosticsNetworkOnline: "Online mode enabled",
    diagnosticsNetworkOffline: "Offline mode enabled",
    diagnosticsOllama: "Ollama",
    diagnosticsOllamaReady: "Ollama ready",
    diagnosticsOllamaDown: "Ollama unavailable",
    diagnosticsOllamaUnknown: "No Ollama data yet",
    diagnosticsRefresh: "Refresh",
    diagnosticsRefreshing: "Refreshing...",
    diagnosticsMetrics: "Recent metrics",
    diagnosticsMetricsSubtitle: "Latest recorded sessions",
    diagnosticsMetricsEmpty: "No metrics recorded yet.",
    diagnosticsLoading: "Loading...",
    metricsTimestamp: "Timestamp",
    metricsMode: "Mode",
    metricsProvider: "Provider",
    metricsLatency: "Latency",
    metricsTokensIn: "Tokens in",
    metricsTokensOut: "Tokens out",
    metricsSuccess: "OK",
    dashboardTitle: "Main dashboard",
    dashboardSubtitle:
      "Review your recent flows, shortcuts, and team activity from a single place.",
    backHome: "Back to home",
    projectsTitle: "Projects",
    globalProject: "Global",
    newProject: "New project",
    newThread: "New thread",
    composerPlaceholder: "Type a message...",
    send: "Send",
    stop: "Stop",
    modelLabel: "Model",
    modelUnavailable:
      "Advanced model is not available with the current configuration.",
    modelFastUnavailable: "The Fast profile is unavailable on your machine.",
    modelSwitchToBalanced: "Switch to Balanced",
    modelProfileFastLabel: "⚡ Fast",
    modelProfileFastDescription:
      "Snappy answers to iterate on ideas and short tasks.",
    modelProfileBalancedLabel: "🎯 Balanced",
    modelProfileBalancedDescription:
      "Balanced speed and context for everyday work.",
    modelProfileThoughtfulLabel: "🧩 Thoughtful",
    modelProfileThoughtfulDescription:
      "Gives the model more room for reasoning and long replies.",
    fastDescShort: "Quick summaries (4-6 lines).",
    balancedDescShort: "2-4 clear paragraphs with an example.",
    thoughtfulDescShort: "Extra context and detail.",
    modelProfileDeepseek13Label: "deepseek-1.3",
    modelProfileDeepseek13Description:
      "DeepSeek remote default model for general usage.",
    modelProfileDeepseek67Label: "deepseek-6.7",
    modelProfileDeepseek67Description:
      "DeepSeek advanced reasoning model (API key required).",
    completionError: "Assistant response could not be completed.",
    runtimeLocal: "Local (Ollama)",
    runtimeRemote: "Remote (DeepSeek)",
    runtimeNone: "No model",
    runtimeSetupCta: "Setup guide",
    emptyMessages:
      "No messages in this context yet. Send the first one to start the conversation.",
    openChat: "Open chat",
    loading: "Loading...",
    emptyProjects: "No projects yet.",
    emptyThreads: "No threads yet.",
    selectContext: "Select a project or use Global.",
    selectThread: "Select a thread to get started.",
    assistantPlaceholder: "Assistant is thinking...",
    roleUser: "User",
    roleAssistant: "Assistant",
    roleSystem: "System",
  },
} as const satisfies Record<Locale, Record<string, string>>;

type Dictionaries = typeof dictionaries;

export type TranslationKey = keyof Dictionaries[Locale];

export function translate(locale: Locale, key: TranslationKey): string {
  const table = dictionaries[locale] ?? dictionaries[fallbackLocale];
  return table[key] ?? dictionaries[fallbackLocale][key];
}

export function getLocaleLabel(locale: Locale): string {
  return availableLocales.find((entry) => entry.code === locale)?.label ?? "";
}
