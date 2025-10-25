import { getMcpServer } from "./registry";
import type {
  MCPExecRequest,
  MCPMethod,
  MCPRequestContext,
  MCPServerId,
} from "./types";

type MethodParams = Record<string, unknown> | undefined;

export async function executeMcpMethod(
  serverId: MCPServerId,
  method: MCPMethod,
  params: MethodParams,
  context: MCPRequestContext,
): Promise<unknown> {
  const server = getMcpServer(serverId);

  if (!server) {
    throw new Error(`MCP server ${serverId} is not registered.`);
  }

  switch (method) {
    case "list":
      if (!server.list) {
        throw new Error(`MCP server ${serverId} does not implement list.`);
      }
      return server.list((params as { path?: string }) ?? {}, context);
    case "read":
      if (!server.read) {
        throw new Error(`MCP server ${serverId} does not implement read.`);
      }
      return server.read(params as { path: string; encoding?: "utf8" | "base64" }, context);
    case "write":
      if (!server.write) {
        throw new Error(`MCP server ${serverId} does not implement write.`);
      }
      return server.write(
        params as {
          path: string;
          content: string;
          encoding?: "utf8" | "base64";
          overwrite?: boolean;
        },
        context,
      );
    case "exec":
      if (!server.exec) {
        throw new Error(`MCP server ${serverId} does not implement exec.`);
      }
      return server.exec(params as MCPExecRequest, context);
    case "info":
      if (!server.info) {
        throw new Error(`MCP server ${serverId} does not implement info.`);
      }
      return server.info(params as Record<string, unknown> | undefined, context);
    default:
      throw new Error(`Unsupported MCP method: ${method}`);
  }
}
