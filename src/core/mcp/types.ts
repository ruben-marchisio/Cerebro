import type { ProviderProfileId } from "../ai/types";

export type MCPServerId =
  | "mcp.files"
  | "mcp.git"
  | "mcp.shell"
  | "mcp.system"
  | "mcp.tauri";

export type MCPMethod = "list" | "read" | "write" | "exec" | "info";

export type MCPAccessRule = {
  serverId: MCPServerId;
  methods: MCPMethod[];
};

export type MCPRequestContext = {
  profileId: ProviderProfileId;
  requireConfirmation?: boolean;
  summary?: string;
};

export type MCPListEntryType = "file" | "directory";

export type MCPListEntry = {
  name: string;
  path: string;
  type: MCPListEntryType;
  size: number;
  modifiedAt?: number;
};

export type MCPReadResult = {
  path: string;
  encoding: "utf8" | "base64";
  content: string;
};

export type MCPWriteResult = {
  path: string;
  bytes: number;
  created: boolean;
};

export type MCPExecRequest = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
};

export type MCPExecResult = {
  command: string;
  args: string[];
  cwd?: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type MCPInfoResult = Record<string, unknown>;

export interface MCPServer {
  readonly id: MCPServerId;
  readonly label: string;
  readonly description?: string;

  list?: (
    params: { path?: string },
    context: MCPRequestContext,
  ) => Promise<MCPListEntry[]>;

  read?: (
    params: { path: string; encoding?: "utf8" | "base64" },
    context: MCPRequestContext,
  ) => Promise<MCPReadResult>;

  write?: (
    params: {
      path: string;
      content: string;
      encoding?: "utf8" | "base64";
      overwrite?: boolean;
    },
    context: MCPRequestContext,
  ) => Promise<MCPWriteResult>;

  exec?: (
    params: MCPExecRequest,
    context: MCPRequestContext,
  ) => Promise<MCPExecResult>;

  info?: (
    params: Record<string, unknown> | undefined,
    context: MCPRequestContext,
  ) => Promise<MCPInfoResult>;
}

export type MCPServerRegistration = MCPServer & {
  requiresConfirmation?: boolean;
};
