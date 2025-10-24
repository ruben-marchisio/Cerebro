import type {
  CompletionHandle,
  ProviderCompleteParams,
  StreamingProvider,
} from "../types";

const createAbortError = (): Error => {
  if (typeof DOMException !== "undefined") {
    return new DOMException("Aborted", "AbortError");
  }
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
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

  external.addEventListener(
    "abort",
    () => {
      controller.abort(external.reason);
    },
    { once: true },
  );
};

const FALLBACK_MESSAGE =
  "No hay un modelo disponible. Inicia Ollama y descarga un modelo (`ollama run mistral`) o configura la variable DEEPSEEK_API_KEY. No model is available right now. Start Ollama and download a model (`ollama run mistral`) or set the DEEPSEEK_API_KEY environment variable.";

export const createFallbackMemoryProvider = (): StreamingProvider => {
  const complete = ({
    onToken,
    signal,
  }: ProviderCompleteParams): CompletionHandle => {
    const controller = new AbortController();
    linkAbortSignals(controller, signal);

    const response = new Promise<string>((resolve, reject) => {
      if (controller.signal.aborted) {
        reject(createAbortError());
        return;
      }

      const abortListener = () => {
        reject(createAbortError());
      };

      controller.signal.addEventListener("abort", abortListener, {
        once: true,
      });

      const deliver = () => {
        controller.signal.removeEventListener("abort", abortListener);
        if (controller.signal.aborted) {
          reject(createAbortError());
          return;
        }
        onToken?.(FALLBACK_MESSAGE);
        resolve(FALLBACK_MESSAGE);
      };

      queueMicrotask(deliver);
    });

    return {
      controller,
      response,
    };
  };

  return {
    complete,
  };
};
