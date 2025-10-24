import { uiToApiModel } from "../modelMap";
import type { StreamingProvider, ProviderCompleteParams } from "../types";
import { getDefaultModel } from "../../config/settings";
import { getEnv } from "../../config/env";

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type StreamOptions = {
  onToken?: (token: string) => void;
  onComplete?: (full: string) => void;
  onError?: (error: unknown) => void;
};

type CompleteParams = {
  model: string;
  system?: string;
  messages: DeepSeekMessage[];
  stream?: StreamOptions;
  temperature?: number;
  maxTokens?: number;
};

type CompletionHandle = {
  controller: AbortController;
  response: Promise<string>;
};

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

export const complete = ({
  model,
  system,
  messages,
  stream,
  temperature,
  maxTokens,
}: CompleteParams): CompletionHandle => {
  const controller = new AbortController();
  const resolvedModel =
    uiToApiModel[model as keyof typeof uiToApiModel] ?? model;

  const payloadMessages = system
    ? [{ role: "system" as const, content: system }, ...messages]
    : messages;

  const sendRequest = async (): Promise<string> => {
    const { deepseekApiKey } = getEnv();
    if (!deepseekApiKey) {
      throw new Error("DeepSeek API key is not configured.");
    }

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: payloadMessages,
        stream: true,
        ...(typeof temperature === "number" ? { temperature } : null),
        ...(typeof maxTokens === "number" ? { max_tokens: maxTokens } : null),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let responseText = "";
      try {
        responseText = await response.text();
      } catch {
        responseText = "";
      }
      console.warn({ status: response.status, responseText });

      const baseMessage = `DeepSeek request failed (${response.status} ${response.statusText})`;
      let detailedMessage = baseMessage;

      if (responseText) {
        try {
          const parsed = JSON.parse(responseText) as {
            error?: { message?: string };
          };
          const parsedMessage = parsed?.error?.message?.trim();
          if (parsedMessage) {
            detailedMessage = parsedMessage;
          } else {
            detailedMessage = `${baseMessage} ${responseText}`;
          }
        } catch {
          detailedMessage = `${baseMessage} ${responseText}`;
        }
      }

      throw new Error(detailedMessage);
    }

    const body = response.body;

    if (!body) {
      // Fallback to JSON parsing if the response is not a stream.
      try {
        const payload = await response.clone().json();
        const text =
          payload?.choices?.[0]?.message?.content ??
          "[DeepSeek] Empty completion";
        if (text) {
          stream?.onToken?.(text);
          stream?.onComplete?.(text);
        }
        return text;
      } catch (error) {
        throw new Error(
          `DeepSeek stream is empty and JSON parsing failed: ${String(error)}`,
        );
      }
    }

    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullText = "";
    let isDone = false;

    const flushBuffer = () => {
      const segments = buffer.split("\n");
      buffer = segments.pop() ?? "";

      for (const rawSegment of segments) {
        const segment = rawSegment.trim();
        if (!segment || !segment.startsWith("data:")) {
          continue;
        }

        const payload = segment.slice(5).trim();

        if (!payload) {
          continue;
        }

        if (payload === "[DONE]") {
          isDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{
              delta?: { content?: string };
              message?: { content?: string };
            }>;
          };

          const token =
            parsed.choices?.[0]?.delta?.content ??
            parsed.choices?.[0]?.message?.content ??
            "";

          if (token) {
            fullText += token;
            stream?.onToken?.(token);
          }
        } catch (error) {
          console.warn("DeepSeek streaming chunk parse failed", error);
        }
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        flushBuffer();
        if (isDone) {
          break;
        }
      }

      if (!isDone) {
        buffer += decoder.decode();
        flushBuffer();
      }
    } catch (error) {
      throw error;
    } finally {
      reader.releaseLock();
    }

    stream?.onComplete?.(fullText);
    return fullText;
  };

  const responsePromise = sendRequest().catch((error) => {
    if (!isAbortError(error)) {
      stream?.onError?.(error);
    }
    throw error;
  });

  return {
    controller,
    response: responsePromise,
  };
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

export const createDeepSeekProvider = (): StreamingProvider => {
  const completeWithAdaptedParams = ({
    model,
    system,
    messages,
    onToken,
    signal,
    temperature,
    maxOutputTokens,
  }: ProviderCompleteParams): CompletionHandle => {
    const handle = complete({
      model: model ?? getDefaultModel(),
      system,
      messages: messages ?? [],
      temperature,
      maxTokens: maxOutputTokens,
      stream: {
        onToken,
      },
    });

    linkAbortSignals(handle.controller, signal);
    return handle;
  };

  return {
    complete: completeWithAdaptedParams,
  };
};
