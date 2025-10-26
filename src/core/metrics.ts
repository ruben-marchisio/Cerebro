import { invoke } from "@tauri-apps/api/core";

export type MetricRecord = {
  ts: number;
  mode: string;
  provider: string;
  model?: string;
  latencyMs?: number;
  promptTokens?: number;
  outputTokens?: number;
  success: boolean;
  error?: string;
};

export type MetricRecordInput = Omit<MetricRecord, "ts"> & {
  ts?: number;
};

type RawMetricRecord = {
  ts?: unknown;
  timestamp?: unknown;
  mode?: unknown;
  provider?: unknown;
  model?: unknown;
  latency_ms?: unknown;
  latencyMs?: unknown;
  prompt_tokens?: unknown;
  tokensIn?: unknown;
  output_tokens?: unknown;
  tokensOut?: unknown;
  success?: unknown;
  error?: unknown;
};

const coerceNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const coerceString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;

const coerceBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const normalizeMetric = (input: RawMetricRecord): MetricRecord => {
  const ts =
    coerceNumber(input.ts) ??
    coerceNumber(input.timestamp) ??
    Date.now();

  const mode = coerceString(input.mode) ?? "unknown";
  const provider = coerceString(input.provider) ?? "unknown";
  const model = coerceString(input.model);

  const latencyMs =
    coerceNumber(input.latency_ms) ??
    coerceNumber(input.latencyMs);

  const promptTokens =
    coerceNumber(input.prompt_tokens) ??
    coerceNumber(input.tokensIn);

  const outputTokens =
    coerceNumber(input.output_tokens) ??
    coerceNumber(input.tokensOut);

  const success = coerceBoolean(input.success) ?? false;
  const error = coerceString(input.error);

  return {
    ts,
    mode,
    provider,
    model: model ?? undefined,
    latencyMs,
    promptTokens,
    outputTokens,
    success,
    error: error ?? undefined,
  };
};

const serializeMetric = (record: MetricRecordInput): Record<string, unknown> => ({
  ts: record.ts ?? Date.now(),
  mode: record.mode,
  provider: record.provider,
  model: record.model ?? null,
  latency_ms: record.latencyMs ?? null,
  prompt_tokens: record.promptTokens ?? null,
  output_tokens: record.outputTokens ?? null,
  success: record.success,
  error: record.error ?? null,
});

export const appendMetric = async (
  record: MetricRecordInput,
): Promise<void> => {
  try {
    await invoke("mcp_metrics_append", {
      entry: serializeMetric(record),
    });
  } catch (error) {
    console.warn("[metrics] Failed to append entry", error);
  }
};

export const fetchRecentMetrics = async (
  limit = 20,
): Promise<MetricRecord[]> => {
  try {
    const result = await invoke<unknown>("mcp_metrics_tail", {
      limit,
    });
    if (!Array.isArray(result)) {
      return [];
    }
    return result
      .map((item) => normalizeMetric(item as RawMetricRecord))
      .filter((record) => typeof record.ts === "number");
  } catch (error) {
    console.warn("[metrics] Failed to load metrics", error);
    return [];
  }
};

export const clearMetrics = async (): Promise<void> => {
  try {
    await invoke("mcp_metrics_clear");
  } catch (error) {
    console.warn("[metrics] Failed to clear log", error);
  }
};
