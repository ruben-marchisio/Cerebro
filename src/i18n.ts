export type Locale = "es" | "en";

export const fallbackLocale: Locale = "en";

export const locales: Locale[] = ["es", "en"];

export const localeLabels: Record<Locale, string> = {
  es: "ES",
  en: "EN",
};

const baseTranslations = {
  es: {
    appName: "CEREBRO",
    tagline: "Tu copiloto para automatizar flujos de desarrollo.",
    heroTitle: "Tu asistente de desarrollo en el escritorio",
    heroSubtitle:
      "Organiza tareas, lanza comandos y concentra el conocimiento de tu equipo en un panel elegante y oscuro.",
    primaryAction: "Abrir panel de control",
    secondaryAction: "Ver documentación",
    statusReady: "Listo",
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
  },
} as const;

export type TranslationSchema = (typeof baseTranslations)[Locale];
export type TranslationKey = keyof TranslationSchema;

export const translations: Record<Locale, TranslationSchema> = baseTranslations;

export function translate(locale: Locale, key: TranslationKey): string {
  const dictionary = translations[locale] ?? translations[fallbackLocale];
  return dictionary[key] ?? translations[fallbackLocale][key];
}
