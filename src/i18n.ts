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
