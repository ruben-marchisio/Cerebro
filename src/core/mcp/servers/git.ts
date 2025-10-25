import { invoke } from "@tauri-apps/api/core";

import type {
  MCPExecRequest,
  MCPExecResult,
  MCPInfoResult,
  MCPRequestContext,
  MCPServer,
} from "../types";

const sanitizeExecArgs = (params: MCPExecRequest): MCPExecRequest => ({
  command: params.command,
  args: params.args ?? [],
  cwd: params.cwd,
  env: params.env ?? {},
  timeoutMs: params.timeoutMs,
});

const ensureContext = (context: MCPRequestContext): MCPRequestContext => context;

export const gitServer: MCPServer = {
  id: "mcp.git",
  label: "Git local",
  description:
    "Gestión de repositorios Git locales (commits, ramas, merges y logs) sin interacción remota.",
  exec: async (params, context) => {
    ensureContext(context);
    const response = await invoke<MCPExecResult>("mcp_git_exec", {
      ...sanitizeExecArgs(params),
    });
    return response;
  },
  info: async (_, context) => {
    ensureContext(context);
    const response = await invoke<MCPInfoResult>("mcp_git_info");
    return response;
  },
};
