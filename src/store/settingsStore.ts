import { create } from "zustand";

import {
  AppSettings,
  defaultSettings,
  loadSettings,
  persistSettings,
} from "../core/config/settings";
import type { ProviderProfileId } from "../core/ai/types";
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
  setNetworkEnabled: (enabled: boolean) => Promise<void>;
  setProfileMode: (mode: AppSettings["profile"]["mode"]) => Promise<void>;
  setManualProfile: (profileId: ProviderProfileId) => Promise<void>;
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
  setNetworkEnabled: async (enabled) => {
    const current = get().settings;
    if (current.network.enabled === enabled) {
      return;
    }
    const next = {
      ...current,
      network: { ...current.network, enabled },
    };
    set({ settings: next });
    await safePersistSettings(next);
  },
  setProfileMode: async (mode) => {
    if (mode !== "auto" && mode !== "manual") {
      return;
    }
    const current = get().settings;
    if (current.profile.mode === mode) {
      return;
    }
    const next = {
      ...current,
      profile: { ...current.profile, mode },
    };
    set({ settings: next });
    await safePersistSettings(next);
  },
  setManualProfile: async (profileId) => {
    const current = get().settings;
    if (current.profile.manualId === profileId) {
      return;
    }
    const next = {
      ...current,
      profile: { ...current.profile, manualId: profileId },
    };
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

export const setSettingsNetworkEnabled = async (
  enabled: boolean,
): Promise<void> => {
  await useSettingsStore.getState().setNetworkEnabled(enabled);
};

export const setSettingsProfileMode = async (
  mode: AppSettings["profile"]["mode"],
): Promise<void> => {
  await useSettingsStore.getState().setProfileMode(mode);
};

export const setSettingsManualProfile = async (
  profileId: ProviderProfileId,
): Promise<void> => {
  await useSettingsStore.getState().setManualProfile(profileId);
};
