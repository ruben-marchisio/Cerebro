import { create } from "zustand";

import {
  AppSettings,
  defaultSettings,
  loadSettings,
  persistSettings,
} from "../core/config/settings";
import { createBrowserStorageAdapter } from "../core/storage/adapter";

const adapter = createBrowserStorageAdapter();

const safeLoadSettings = async (): Promise<AppSettings> => {
  try {
    return await loadSettings(adapter);
  } catch (error) {
    console.error("Failed to load settings", error);
    return defaultSettings;
  }
};

const safePersistSettings = async (settings: AppSettings): Promise<void> => {
  try {
    await persistSettings(adapter, settings);
  } catch (error) {
    console.error("Failed to persist settings", error);
  }
};

type SettingsState = {
  settings: AppSettings;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (language: AppSettings["language"]) => Promise<void>;
  setModel: (model: string) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isHydrated: false,
  hydrate: async () => {
    const stored = await safeLoadSettings();
    set({ settings: stored, isHydrated: true });
  },
  setLanguage: async (language) => {
    const current = get().settings;
    if (current.language === language) {
      return;
    }
    const next = { ...current, language };
    set({ settings: next });
    await safePersistSettings(next);
  },
  setModel: async (model) => {
    const trimmed = model.trim();
    const nextModel = trimmed.length > 0 ? trimmed : defaultSettings.model;
    const current = get().settings;
    if (current.model === nextModel) {
      return;
    }
    const next = { ...current, model: nextModel };
    set({ settings: next });
    await safePersistSettings(next);
  },
}));

export const getSettings = (): AppSettings =>
  useSettingsStore.getState().settings;

export const setSettingsLanguage = async (
  language: AppSettings["language"],
): Promise<void> => {
  await useSettingsStore.getState().setLanguage(language);
};

export const setSettingsModel = async (model: string): Promise<void> => {
  await useSettingsStore.getState().setModel(model);
};
