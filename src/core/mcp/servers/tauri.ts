import { invoke } from "@tauri-apps/api/core";

import type {
  MCPExecResult,
  MCPInfoResult,
  MCPRequestContext,
  MCPServer,
} from "../types";

const ensureContext = (context: MCPRequestContext): MCPRequestContext => context;

export const tauriServer: MCPServer = {
  id: "mcp.tauri",
  label: "Capacidades Tauri",
  description:
    "Control de ventanas, diálogos y características del entorno Tauri con confirmaciones explícitas.",
  exec: async ({ command, args = [] }, context) => {
    ensureContext(context);
    const response = await invoke<MCPExecResult>("mcp_tauri_exec", {
      command,
      args,
    });
    return response;
  },
  info: async (_, context) => {
    ensureContext(context);
    const response = await invoke<MCPInfoResult>("mcp_tauri_capabilities");
    return response;
  },
};
