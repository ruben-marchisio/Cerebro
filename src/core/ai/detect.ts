const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const HEALTH_ENDPOINT = "/api/version";
const PING_TIMEOUT_MS = 1200;

const normalizeBaseUrl = (url: string): string =>
  url.endsWith("/") ? url.slice(0, -1) : url;

export type OllamaProbeResult = {
  ok: boolean;
  latencyMs: number | null;
  error?: string;
};

const now = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export const probeLocalOllama = async (
  baseUrl: string = DEFAULT_OLLAMA_URL,
): Promise<OllamaProbeResult> => {
  const url = `${normalizeBaseUrl(baseUrl)}${HEALTH_ENDPOINT}`;
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    controller.abort();
  }, PING_TIMEOUT_MS);
  const startedAt = now();

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    const finishedAt = now();
    if (response.ok) {
      return {
        ok: true,
        latencyMs: Math.round(finishedAt - startedAt),
      };
    }

    return {
      ok: false,
      latencyMs: Math.round(finishedAt - startedAt),
      error: `${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
};

export const pingLocalOllama = async (
  baseUrl: string = DEFAULT_OLLAMA_URL,
): Promise<boolean> => {
  const result = await probeLocalOllama(baseUrl);
  return result.ok;
};
