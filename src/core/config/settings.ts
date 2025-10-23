import type { StorageAdapter } from "../storage/adapter";

export type AppSettings = {
  language: "es" | "en";
  model: string;
};

export const defaultSettings: AppSettings = {
  language: "es",
  model: "deepseek-1.3",
};

export const settingsStorageKey = "cerebro:settings";

const isLanguage = (value: unknown): value is AppSettings["language"] =>
  value === "es" || value === "en";

export const getDefaultLanguage = (): AppSettings["language"] =>
  defaultSettings.language;

export const getDefaultModel = (): string => defaultSettings.model;

export const loadSettings = async (
  adapter: StorageAdapter,
): Promise<AppSettings> => {
  try {
    const stored =
      (await adapter.get<Partial<AppSettings>>(settingsStorageKey)) ?? undefined;

    if (!stored) {
      return defaultSettings;
    }

    const language = isLanguage(stored.language)
      ? stored.language
      : defaultSettings.language;

    const model =
      typeof stored.model === "string" && stored.model.trim().length > 0
        ? stored.model
        : defaultSettings.model;

    return {
      language,
      model,
    };
  } catch {
    return defaultSettings;
  }
};

export const persistSettings = async (
  adapter: StorageAdapter,
  settings: AppSettings,
): Promise<void> => {
  await adapter.set(settingsStorageKey, settings);
  await adapter.save();
};
