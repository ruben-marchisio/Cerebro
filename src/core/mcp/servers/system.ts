import { invoke } from "@tauri-apps/api/core";

import type {
  MCPInfoResult,
  MCPRequestContext,
  MCPServer,
} from "../types";

const ensureContext = (context: MCPRequestContext): MCPRequestContext => context;

export const systemServer: MCPServer = {
  id: "mcp.system",
  label: "Sistema",
  description:
    "Acceso a información del sistema operativo: CPU, memoria, procesos y recursos locales.",
  info: async (params = {}, context) => {
    ensureContext(context);
    const payload = params as { topic?: string };
    if (payload.topic === "paths") {
      return invoke<MCPInfoResult>("mcp_system_paths");
    }
    const response = await invoke<MCPInfoResult>("mcp_system_info");
    return response;
  },
};
