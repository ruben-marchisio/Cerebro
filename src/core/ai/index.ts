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

export const createBestProvider = async (): Promise<StreamingProvider> => {
  try {
    const isOllamaAvailable = await pingLocalOllama();

    if (isOllamaAvailable) {
      runtimeStatus = "local";
      return createLocalProvider();
    }
  } catch (error) {
    console.warn("[ai] Falló la detección de Ollama local", error);
  }

  const { deepseekApiKey } = getEnv();

  if (deepseekApiKey) {
    runtimeStatus = "remote";
    return createDeepSeekProvider();
  }

  runtimeStatus = "none";
  return createFallbackMemoryProvider();
};

export const getRuntimeStatus = (): RuntimeStatus => runtimeStatus;

export type {
  RuntimeStatus,
  StreamingProvider,
  ProviderMessage,
  ProviderCompleteParams,
  CompletionHandle,
} from "./types";

export { createFallbackMemoryProvider } from "./providers/fallback";
