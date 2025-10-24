import type {
  CompletionHandle,
  ProviderCompleteParams,
  StreamingProvider,
} from "../../types";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const GENERATE_ENDPOINT = "/api/generate";

type OllamaProviderOptions = {
  baseURL?: string;
  defaultModel: string;
};

type OllamaResponseChunk = {
  response?: string;
  done?: boolean;
  error?: string;
};

const isAbortError = (error: unknown): boolean => {
  return (
    error instanceof DOMException && error.name === "AbortError"
  );
};

const normalizeBaseUrl = (url: string): string =>
  url.endsWith("/") ? url.slice(0, -1) : url;

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

  const complete = ({
    prompt,
    system,
    model,
    onToken,
    signal,
  }: ProviderCompleteParams): CompletionHandle => {
    const controller = new AbortController();
    linkAbortSignals(controller, signal);

    const resolvedModel = (model ?? sanitizedDefaultModel).trim();
    if (!resolvedModel) {
      throw new Error(
        "Ollama provider: no se especificó un modelo. Descarga un modelo con `ollama run <modelo>` y vuelve a intentarlo.",
      );
    }

    const send = async (): Promise<string> => {
      if (!prompt.trim()) {
        throw new Error(
          "Ollama provider: el prompt está vacío. Proporciona un mensaje de usuario válido.",
        );
      }

      const bodyPayload = {
        model: resolvedModel,
        prompt,
        stream: true,
        system: system?.trim() || undefined,
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
    };

    const responsePromise = send();

    return {
      controller,
      response: responsePromise,
    };
  };

  const provider: StreamingProvider = {
    complete,
  };

  return provider;
};
