import { invoke } from "@tauri-apps/api/core";

import type {
  MCPExecRequest,
  MCPExecResult,
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

export const shellServer: MCPServer = {
  id: "mcp.shell",
  label: "Shell local",
  description:
    "Ejecución controlada de comandos locales dentro de órbitas seguras con límites de tiempo.",
  exec: async (params, context) => {
    ensureContext(context);
    const response = await invoke<MCPExecResult>("mcp_shell_exec", {
      ...sanitizeExecArgs(params),
    });
    return response;
  },
  info: async (_, context) => {
    ensureContext(context);
    const response = await invoke<Record<string, unknown>>(
      "mcp_shell_capabilities",
    );
    return response;
  },
};
