import { filesServer } from "./servers/files";
import { gitServer } from "./servers/git";
import { shellServer } from "./servers/shell";
import { systemServer } from "./servers/system";
import { tauriServer } from "./servers/tauri";
import type { MCPServer, MCPServerId } from "./types";

const registry = new Map<MCPServerId, MCPServer>();

const coreServers: MCPServer[] = [
  filesServer,
  gitServer,
  shellServer,
  systemServer,
  tauriServer,
];

export const registerServer = (server: MCPServer): void => {
  registry.set(server.id, server);
};

export const registerCoreMcpServers = (): void => {
  for (const server of coreServers) {
    registerServer(server);
  }
};

export const getMcpServer = (id: MCPServerId): MCPServer | undefined =>
  registry.get(id);

export const listMcpServers = (): MCPServer[] => Array.from(registry.values());
