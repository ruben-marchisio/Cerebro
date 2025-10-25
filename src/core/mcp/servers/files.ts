import { invoke } from "@tauri-apps/api/core";

import type {
  MCPReadResult,
  MCPServer,
  MCPListEntry,
  MCPRequestContext,
  MCPWriteResult,
} from "../types";

type ListResponse = {
  entries: MCPListEntry[];
};

type ReadResponse = MCPReadResult;

type WriteResponse = MCPWriteResult;

const normalizePathPayload = (path?: string): { path?: string } => {
  if (!path) {
    return {};
  }

  return { path };
};

const ensureContext = (context: MCPRequestContext): MCPRequestContext => context;

export const filesServer: MCPServer = {
  id: "mcp.files",
  label: "File system",
  description: "Operaciones seguras de lectura y escritura dentro de órbitas autorizadas.",
  list: async ({ path } = {}, context) => {
    ensureContext(context);
    const response = await invoke<ListResponse>("mcp_files_list", {
      ...normalizePathPayload(path),
    });
    return response.entries;
  },
  read: async ({ path, encoding = "utf8" }, context) => {
    ensureContext(context);
    const response = await invoke<ReadResponse>("mcp_files_read", {
      path,
      encoding,
    });
    return response;
  },
  write: async ({ path, content, encoding = "utf8", overwrite = true }, context) => {
    ensureContext(context);
    const response = await invoke<WriteResponse>("mcp_files_write", {
      path,
      content,
      encoding,
      overwrite,
    });
    return response;
  },
  info: async (_, context) => {
    ensureContext(context);
    const response = await invoke<Record<string, unknown>>("mcp_files_info", {});
    return response;
  },
};
