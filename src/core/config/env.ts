type EnvKeys =
  | "VITE_API_BASE_URL"
  | "VITE_LLM_API_KEY"
  | "VITE_STORAGE_NAMESPACE";

export type EnvConfig = {
  apiBaseUrl?: string;
  llmApiKey?: string;
  storageNamespace: string;
};

const resolveEnvValue = (key: EnvKeys): string | undefined => {
  if (typeof import.meta === "undefined" || !import.meta.env) {
    return undefined;
  }

  const env = import.meta.env as Record<string, string | undefined>;
  return env[key];
};

export const env: EnvConfig = {
  apiBaseUrl: resolveEnvValue("VITE_API_BASE_URL"),
  llmApiKey: resolveEnvValue("VITE_LLM_API_KEY"),
  storageNamespace: resolveEnvValue("VITE_STORAGE_NAMESPACE") ?? "cerebro",
};

export const getEnv = (): EnvConfig => ({ ...env });

export const getEnvVar = (key: keyof EnvConfig) => env[key];
