export type Locale = "es" | "en";

export const availableLocales: Array<{ code: Locale; label: string }> = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
];

export const fallbackLocale: Locale = "es";

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
