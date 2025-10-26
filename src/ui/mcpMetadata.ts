import type { TranslationKey } from "../i18n";
import type { MCPMethod, MCPServerId } from "../core/mcp";

export const MCP_SERVER_METADATA: Record<
  MCPServerId,
  { icon: string; label: TranslationKey }
> = {
  "mcp.files": { icon: "📁", label: "mcpFilesLabel" },
  "mcp.git": { icon: "🌿", label: "mcpGitLabel" },
  "mcp.shell": { icon: "💻", label: "mcpShellLabel" },
  "mcp.system": { icon: "🖥️", label: "mcpSystemLabel" },
  "mcp.tauri": { icon: "🪟", label: "mcpTauriLabel" },
};

export const MCP_METHOD_LABELS: Record<MCPMethod, TranslationKey> = {
  list: "mcpMethodList",
  read: "mcpMethodRead",
  write: "mcpMethodWrite",
  exec: "mcpMethodExec",
  info: "mcpMethodInfo",
};
