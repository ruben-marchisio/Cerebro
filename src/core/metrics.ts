import { invoke } from "@tauri-apps/api/core";

export type MetricRecord = {
  timestamp: number;
  mode: string;
  provider: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  success: boolean;
};

export const appendMetric = async (record: MetricRecord): Promise<void> => {
  try {
    await invoke("mcp_metrics_append", {
      entry: record,
    });
  } catch (error) {
    console.warn("[metrics] Failed to append entry", error);
  }
};

export const fetchRecentMetrics = async (
  limit = 20,
): Promise<MetricRecord[]> => {
  try {
    const result = await invoke<MetricRecord[]>("mcp_metrics_tail", {
      limit,
    });
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.warn("[metrics] Failed to load metrics", error);
    return [];
  }
};
