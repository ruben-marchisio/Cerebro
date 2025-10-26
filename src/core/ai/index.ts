import { getEnv } from "../config/env";
import { pingLocalOllama } from "./detect";
import { createDeepSeekProvider } from "./providers/deepseek";
import { createFallbackMemoryProvider } from "./providers/fallback";
import { createOllamaProvider } from "./providers/local/ollama";
import type { RuntimeStatus, StreamingProvider } from "./types";

const DEFAULT_OLLAMA_MODEL = "mistral";

let runtimeStatus: RuntimeStatus = "none";

const createLocalProvider = (): StreamingProvider =>
  createOllamaProvider({
    defaultModel: DEFAULT_OLLAMA_MODEL,
  });

type ProviderSelectionOptions = {
  allowRemote?: boolean;
  onStatusChange?: (status: RuntimeStatus) => void;
};

export const createBestProvider = async ({
  allowRemote = true,
  onStatusChange,
}: ProviderSelectionOptions = {}): Promise<StreamingProvider> => {
  try {
    const isOllamaAvailable = await pingLocalOllama();

    if (isOllamaAvailable) {
      runtimeStatus = "local";
      onStatusChange?.(runtimeStatus);
      return createLocalProvider();
    }
  } catch (error) {
    console.warn("[ai] Falló la detección de Ollama local", error);
  }

  const { deepseekApiKey } = getEnv();

  if (allowRemote && deepseekApiKey) {
    runtimeStatus = "remote";
    onStatusChange?.(runtimeStatus);
    return createDeepSeekProvider();
  }

  runtimeStatus = "none";
  onStatusChange?.(runtimeStatus);
  return createFallbackMemoryProvider();
};

export const getRuntimeStatus = (): RuntimeStatus => runtimeStatus;

export type {
  RuntimeStatus,
  StreamingProvider,
  ProviderMessage,
  ProviderCompleteParams,
  CompletionHandle,
  ProviderProfileId,
} from "./types";

export { PROVIDER_PROFILE_IDS, isProviderProfileId } from "./types";

export { createFallbackMemoryProvider } from "./providers/fallback";
