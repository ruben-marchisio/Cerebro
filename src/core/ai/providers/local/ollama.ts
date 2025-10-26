import type {
  CompletionHandle,
  ProviderCompleteParams,
  ProviderProfileId,
  StreamingProvider,
} from "../../types";
import { getModelProfileById } from "../../modelProfiles";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const GENERATE_ENDPOINT = "/api/generate";
const TAGS_ENDPOINT = "/api/tags";

type OllamaProviderOptions = {
  baseURL?: string;
  defaultModel: string;
};

type OllamaResponseChunk = {
  response?: string;
  done?: boolean;
  error?: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
};

type OllamaRequestOptions = {
  num_predict?: number;
  temperature?: number;
  num_ctx?: number;
  top_p?: number;
  repeat_penalty?: number;
  repeat_last_n?: number;
};

type ReasoningOverrides = {
  temperature?: number;
  maxOutputTokens?: number;
  contextTokens?: number;
};

export class OllamaModelMissingError extends Error {
  readonly model: string;
  readonly recommendations: string[];

  constructor(model: string, recommendations?: string[]) {
    const normalizedSuggestions = (recommendations ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const suggestion = normalizedSuggestions[0];
    const message = suggestion
      ? `No tenés este modelo. Ejecutá: ollama pull ${suggestion}.`
      : `No tenés este modelo. Ejecutá: ollama pull ${model} o elegí otro perfil.`;
    super(message);
    this.name = "OllamaModelMissingError";
    this.model = model;
    this.recommendations = normalizedSuggestions;
  }
}

const isAbortError = (error: unknown): boolean => {
  return (
    error instanceof DOMException && error.name === "AbortError"
  );
};

const normalizeBaseUrl = (url: string): string =>
  url.endsWith("/") ? url.slice(0, -1) : url;

const PROFILE_EXTRA_TUNING: Partial<Record<ProviderProfileId, OllamaRequestOptions>> = {
  fast: {
    top_p: 0.92,
    repeat_penalty: 1.08,
    repeat_last_n: 64,
  },
  balanced: {
    top_p: 0.9,
    repeat_penalty: 1.05,
    repeat_last_n: 96,
  },
  thoughtful: {
    top_p: 0.88,
    repeat_penalty: 1.04,
    repeat_last_n: 160,
  },
  thoughtfulLocal: {
    top_p: 0.88,
    repeat_penalty: 1.04,
    repeat_last_n: 160,
  },
};

const PROFILE_MODEL_FALLBACKS: Partial<Record<ProviderProfileId, string[]>> = {
  fast: ["llama3.2:3b", "qwen2.5:3b-instruct", "mistral"],
  balanced: ["mistral", "qwen2.5:3b-instruct", "llama3.2:3b"],
  thoughtfulLocal: ["mistral", "qwen2.5:3b-instruct", "llama3.2:3b"],
};

type InstalledModelsInfo = {
  names: Set<string>;
  raw: string[];
};

const MODEL_CACHE_TTL_MS = 15_000;
const DEFAULT_COMPLETION_TIMEOUT_MS = 45_000;
const PROFILE_TIMEOUTS_MS: Partial<Record<ProviderProfileId, number>> = {
  fast: 8_000,
  balanced: 20_000,
  thoughtful: 60_000,
  thoughtfulLocal: 60_000,
};

let lastKnownLocalModels: string[] = [];

export const getCachedLocalModels = (): string[] => [...lastKnownLocalModels];

const getTunedOptionsForModel = (
  model: string,
  profileId?: ProviderProfileId,
  overrides: ReasoningOverrides = {},
): OllamaRequestOptions | undefined => {
  const normalized = model.trim().toLowerCase();

  if (profileId) {
    const reasoning = getModelProfileById(profileId)?.reasoning;

    if (reasoning) {
      const options: OllamaRequestOptions = {};
      const extras = PROFILE_EXTRA_TUNING[profileId];
      if (extras) {
        Object.assign(options, extras);
      }

      const temperature =
        typeof overrides.temperature === "number"
          ? overrides.temperature
          : reasoning.temperature;
      if (typeof temperature === "number") {
        options.temperature = temperature;
      }

      const maxOutputTokens =
        typeof overrides.maxOutputTokens === "number"
          ? overrides.maxOutputTokens
          : reasoning.maxOutputTokens;
      if (typeof maxOutputTokens === "number") {
        options.num_predict = maxOutputTokens;
      }

      const contextTokens =
        typeof overrides.contextTokens === "number"
          ? overrides.contextTokens
          : reasoning.contextTokens;
      if (typeof contextTokens === "number") {
        options.num_ctx = contextTokens;
      }

      return options;
    }
  }

  if (normalized.startsWith("llama3.2:3b")) {
    const options: OllamaRequestOptions = {
      top_p: 0.9,
      repeat_penalty: 1.08,
      repeat_last_n: 64,
    };

    const temperature =
      typeof overrides.temperature === "number"
        ? overrides.temperature
        : 0.7;
    if (typeof temperature === "number") {
      options.temperature = temperature;
    }

    const maxOutputTokens =
      typeof overrides.maxOutputTokens === "number"
        ? overrides.maxOutputTokens
        : 320;
    if (typeof maxOutputTokens === "number") {
      options.num_predict = maxOutputTokens;
    }

    const contextTokens =
      typeof overrides.contextTokens === "number"
        ? overrides.contextTokens
        : 2048;
    if (typeof contextTokens === "number") {
      options.num_ctx = contextTokens;
    }

    return options;
  }

  return undefined;
};

const linkAbortSignals = (
  controller: AbortController,
  external?: AbortSignal,
) => {
  if (!external) {
    return;
  }

  if (external.aborted) {
    controller.abort(external.reason);
    return;
  }

  const abort = () => {
    controller.abort(
      external.reason ??
        (typeof DOMException !== "undefined"
          ? new DOMException("Aborted", "AbortError")
          : undefined),
    );
  };

  external.addEventListener("abort", abort, { once: true });
};

const normalizeErrorMessage = (
  base: string,
  details?: string | null,
): string => {
  if (!details) {
    return base;
  }

  const normalized = details.trim();
  if (!normalized) {
    return base;
  }

  return `${base}: ${normalized}`;
};

export const createOllamaProvider = ({
  baseURL = DEFAULT_BASE_URL,
  defaultModel,
}: OllamaProviderOptions): StreamingProvider => {
  const preparedBase = normalizeBaseUrl(baseURL);
  const sanitizedDefaultModel = defaultModel.trim();

  if (!sanitizedDefaultModel) {
    throw new Error(
      "Ollama provider: defaultModel es obligatorio y no puede estar vacío.",
    );
  }

  let cachedModels: { timestamp: number; info: InstalledModelsInfo } | null = null;

  const fetchInstalledModels = async (
    signal: AbortSignal,
  ): Promise<InstalledModelsInfo> => {
    const now = Date.now();
    if (cachedModels && now - cachedModels.timestamp < MODEL_CACHE_TTL_MS) {
      return cachedModels.info;
    }

    let response: Response;
    try {
      response = await fetch(`${preparedBase}${TAGS_ENDPOINT}`, {
        method: "GET",
        signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      throw new Error(
        normalizeErrorMessage(
          "No se pudo conectar con Ollama. Verifica que el servicio esté en ejecución (`ollama serve`)",
          error instanceof Error ? error.message : null,
        ),
      );
    }

    if (!response.ok) {
      let errorMessage: string | null = null;
      try {
        const data = (await response.json()) as { error?: string };
        errorMessage = data?.error ?? null;
      } catch {
        try {
          errorMessage = await response.text();
        } catch {
          errorMessage = null;
        }
      }

      const baseMessage = `Ollama devolvió un error (${response.status} ${response.statusText}) al listar modelos disponibles`;

      throw new Error(
        normalizeErrorMessage(baseMessage, errorMessage),
      );
    }

    let data: OllamaTagsResponse;
    try {
      data = (await response.json()) as OllamaTagsResponse;
    } catch (error) {
      throw new Error(
        normalizeErrorMessage(
          "Ollama devolvió una respuesta inválida al listar modelos disponibles",
          error instanceof Error ? error.message : null,
        ),
      );
    }

    const models = data.models ?? [];
    const names = new Set<string>();
    const rawSet = new Set<string>();

    for (const entry of models) {
      const candidates = [entry.name, entry.model]
        .map((value) => (value ?? "").trim())
        .filter((value) => value.length > 0);

      for (const candidate of candidates) {
        rawSet.add(candidate);
        names.add(candidate.toLowerCase());
        names.add(`${candidate.toLowerCase()}:latest`);
      }
    }

    const info: InstalledModelsInfo = {
      names,
      raw: Array.from(rawSet.values()),
    };

    cachedModels = { timestamp: now, info };
    lastKnownLocalModels = info.raw.slice();

    return info;
  };

  const selectModelForProfile = async (
    desiredModel: string,
    profileId: ProviderProfileId | undefined,
    signal: AbortSignal,
  ): Promise<string> => {
    const installed = await fetchInstalledModels(signal);
    const candidates = [
      desiredModel,
      ...((profileId && PROFILE_MODEL_FALLBACKS[profileId]) ?? []),
    ];

    const seen = new Set<string>();
    for (const candidateRaw of candidates) {
      const candidate = candidateRaw.trim();
      if (!candidate) {
        continue;
      }
      const key = candidate.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      if (
        installed.names.has(key) ||
        installed.names.has(`${key}:latest`)
      ) {
        return candidate;
      }
    }

    throw new OllamaModelMissingError(desiredModel, candidates);
  };

  const complete = ({
    prompt,
    system,
    model,
    onToken,
    signal,
    profileId,
    temperature,
    maxOutputTokens,
    contextTokens,
  }: ProviderCompleteParams): CompletionHandle => {
    const controller = new AbortController();
    linkAbortSignals(controller, signal);

    const resolvedModel = (model ?? sanitizedDefaultModel).trim();
    if (!resolvedModel) {
      throw new Error(
        "Ollama provider: no se especificó un modelo. Descarga un modelo con `ollama run <modelo>` y vuelve a intentarlo.",
      );
    }

    const handle: CompletionHandle = {
      controller,
      response: Promise.resolve(""),
      model: resolvedModel,
    };

    const send = async (): Promise<string> => {
      if (!prompt.trim()) {
        throw new Error(
          "Ollama provider: el prompt está vacío. Proporciona un mensaje de usuario válido.",
        );
      }

      const selectedModel = await selectModelForProfile(
        resolvedModel,
        profileId,
        controller.signal,
      );

      if (selectedModel.toLowerCase() !== resolvedModel.toLowerCase()) {
        console.warn("[ai] model-fallback", {
          requested: resolvedModel,
          selected: selectedModel,
          profileId,
        });
      }

      handle.model = selectedModel;

      const timeoutMs =
        (profileId && PROFILE_TIMEOUTS_MS[profileId]) ??
        DEFAULT_COMPLETION_TIMEOUT_MS;
      const timeoutHandle = setTimeout(() => {
        controller.abort(
          typeof DOMException !== "undefined"
            ? new DOMException("Timed out", "AbortError")
            : undefined,
        );
      }, timeoutMs);

      try {
        const tunedOptions = getTunedOptionsForModel(selectedModel, profileId, {
          temperature,
          maxOutputTokens,
          contextTokens,
        });

        const bodyPayload = {
          model: selectedModel,
          prompt,
          stream: true,
          system: system?.trim() || undefined,
          options: tunedOptions ?? undefined,
        };

        let response: Response;
        try {
          response = await fetch(`${preparedBase}${GENERATE_ENDPOINT}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal,
          });
        } catch (error) {
          if (isAbortError(error)) {
            throw error;
          }

          throw new Error(
            normalizeErrorMessage(
              "No se pudo conectar con Ollama. Verifica que el servicio esté en ejecución (`ollama serve`)",
              error instanceof Error ? error.message : null,
            ),
          );
        }

        if (!response.ok) {
          let errorMessage: string | null = null;
          try {
            const data = (await response.json()) as { error?: string };
            errorMessage = data?.error ?? null;
          } catch {
            try {
              errorMessage = await response.text();
            } catch {
              errorMessage = null;
            }
          }

          const baseMessage = `Ollama devolvió un error (${response.status} ${response.statusText})`;

          throw new Error(
            normalizeErrorMessage(baseMessage, errorMessage),
          );
        }

        const body = response.body;
        if (!body) {
          throw new Error(
            "Ollama devolvió una respuesta vacía al generar texto.",
          );
        }

        const reader = body.getReader();
        const decoder = new TextDecoder("utf-8");

        let accumulated = "";
        let buffer = "";
        let isDone = false;

        const processLine = (line: string) => {
          try {
            const parsed = JSON.parse(line) as OllamaResponseChunk;

            if (parsed.error) {
              throw new Error(
                normalizeErrorMessage(
                  "Ollama reportó un error al generar la respuesta",
                  parsed.error,
                ),
              );
            }

            const piece = parsed.response ?? "";
            if (piece) {
              accumulated += piece;
              onToken?.(piece);
            }

            if (parsed.done) {
              isDone = true;
            }
          } catch (error) {
            console.warn("[ollama] No se pudo procesar el chunk", {
              line,
              error,
            });
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            let newlineIndex = buffer.indexOf("\n");

            while (newlineIndex !== -1) {
              const rawLine = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);

              if (rawLine) {
                processLine(rawLine);
              }

              if (isDone) {
                break;
              }

              newlineIndex = buffer.indexOf("\n");
            }

            if (isDone) {
              break;
            }
          }

          if (!isDone) {
            const tail = buffer.trim();
            if (tail) {
              processLine(tail);
            }
          }
        } catch (error) {
          if (!isAbortError(error)) {
            throw error;
          }
          throw error;
        } finally {
          reader.releaseLock();
        }

        return accumulated;
      } finally {
        clearTimeout(timeoutHandle);
      }
    };

    handle.response = send();
    return handle;
  };

  const provider: StreamingProvider = {
    complete,
  };

  return provider;
};
