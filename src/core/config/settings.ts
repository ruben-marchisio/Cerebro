import type { ProviderProfileId } from "../ai/types";
import type { McpAccessLevel } from "../mcp/permissions";
import type { StorageAdapter } from "../storage/adapter";

type StoredSettings = Partial<AppSettings> & {
  model?: unknown;
};

export type AppSettings = {
  language: "es" | "en";
  network: {
    enabled: boolean;
  };
  permissions: {
    accessLevel: McpAccessLevel;
  };
  profile: {
    mode: "auto" | "manual";
    manualId: ProviderProfileId;
  };
};

export const defaultSettings: AppSettings = {
  language: "es",
  network: {
    enabled: false,
  },
  permissions: {
    accessLevel: "basic",
  },
  profile: {
    mode: "auto",
    manualId: "balanced",
  },
};

export const settingsStorageKey = "cerebro:settings";

const isLanguage = (value: unknown): value is AppSettings["language"] =>
  value === "es" || value === "en";

const isAccessLevel = (value: unknown): value is McpAccessLevel =>
  value === "basic" || value === "dev" || value === "power";

const normalizeNetworkSettings = (
  network: unknown,
): AppSettings["network"] => {
  if (
    network &&
    typeof network === "object" &&
    "enabled" in network &&
    typeof (network as { enabled: unknown }).enabled === "boolean"
  ) {
    return {
      enabled: (network as { enabled: boolean }).enabled,
    };
  }

  return { ...defaultSettings.network };
};

const isProfileId = (value: unknown): value is ProviderProfileId =>
  value === "fast" ||
  value === "balanced" ||
  value === "thoughtful" ||
  value === "thoughtfulLocal";

const normalizeProfileSettings = (
  profile: unknown,
  fallbackManualId: ProviderProfileId = defaultSettings.profile.manualId,
): AppSettings["profile"] => {
  if (
    profile &&
    typeof profile === "object" &&
    "mode" in profile &&
    "manualId" in profile
  ) {
    const mode = (profile as { mode: unknown }).mode;
    const manualId = (profile as { manualId: unknown }).manualId;

    const safeMode =
      mode === "auto" || mode === "manual" ? mode : defaultSettings.profile.mode;

    const safeManualId = isProfileId(manualId)
      ? manualId
      : fallbackManualId;

    return {
      mode: safeMode,
      manualId: safeManualId,
    };
  }

  return {
    ...defaultSettings.profile,
    manualId: fallbackManualId,
  };
};

const normalizePermissionsSettings = (
  permissions: unknown,
): AppSettings["permissions"] => {
  if (
    permissions &&
    typeof permissions === "object" &&
    "accessLevel" in permissions &&
    isAccessLevel((permissions as { accessLevel: unknown }).accessLevel)
  ) {
    return {
      accessLevel: (permissions as { accessLevel: McpAccessLevel }).accessLevel,
    };
  }

  return { ...defaultSettings.permissions };
};

export const getDefaultLanguage = (): AppSettings["language"] =>
  defaultSettings.language;

export const loadSettings = async (
  adapter: StorageAdapter,
): Promise<AppSettings> => {
  try {
    const stored =
      (await adapter.get<StoredSettings>(settingsStorageKey)) ?? undefined;

    if (!stored) {
      return defaultSettings;
    }

    const language = isLanguage(stored.language)
      ? stored.language
      : defaultSettings.language;

    const legacyModelValue = stored.model;
    const legacyModel =
      typeof legacyModelValue === "string" && legacyModelValue.trim().length > 0
        ? legacyModelValue.trim()
        : null;

    const permissions = normalizePermissionsSettings(stored.permissions);
    const network = normalizeNetworkSettings(stored.network);
    const profile = normalizeProfileSettings(
      stored.profile,
      (legacyModel && isProfileId(legacyModel)
        ? (legacyModel as ProviderProfileId)
        : defaultSettings.profile.manualId),
    );

    if (legacyModel && isProfileId(legacyModel)) {
      // Preserve the last manual selection for legacy users.
      profile.manualId = legacyModel;
      if (profile.mode === "auto") {
        profile.mode = "manual";
      }
    }

    return {
      language,
      permissions,
      network,
      profile,
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
