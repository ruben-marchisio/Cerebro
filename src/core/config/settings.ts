export type AppSettings = {
  language: "es" | "en";
  model: string;
};

export const defaultSettings: AppSettings = {
  language: "es",
  model: "deepseek-1.3",
};

export const getDefaultLanguage = (): AppSettings["language"] =>
  defaultSettings.language;

export const getDefaultModel = (): string => defaultSettings.model;
