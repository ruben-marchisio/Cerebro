const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const HEALTH_ENDPOINT = "/api/version";
const PING_TIMEOUT_MS = 1200;

const normalizeBaseUrl = (url: string): string =>
  url.endsWith("/") ? url.slice(0, -1) : url;

export const pingLocalOllama = async (
  baseUrl: string = DEFAULT_OLLAMA_URL,
): Promise<boolean> => {
  const url = `${normalizeBaseUrl(baseUrl)}${HEALTH_ENDPOINT}`;
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    controller.abort();
  }, PING_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    return response.ok;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
};
