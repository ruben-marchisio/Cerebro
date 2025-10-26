import { useCallback } from "react";

import {
  executeMcpMethod,
  type MCPMethod,
  type MCPRequestContext,
  type MCPServerId,
} from "../core/mcp";
import { getModelProfileById } from "../core/ai/modelProfiles";
import {
  isSensitiveMcpMethod,
  type McpPermission,
} from "../core/mcp/permissions";
import { useMcpPermissionsStore } from "../store/mcpPermissionsStore";
import { MCP_METHOD_LABELS, MCP_SERVER_METADATA } from "../ui/mcpMetadata";
import type { TranslationKey } from "../i18n";

type Translator = (key: TranslationKey) => string;

const normalizeMessage = (message: string): string =>
  message
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const describeRules = (
  permissions: McpPermission[],
): string[] =>
  permissions.map((rule) => `${rule.serverId}:${rule.methods.join(",")}`);

export const useMcpClient = (t: Translator) => {
  const isAllowed = useMcpPermissionsStore((state) => state.isAllowed);

  const confirmSensitive = useCallback(
    (serverId: MCPServerId, method: MCPMethod, context: MCPRequestContext) => {
      const serverInfo = MCP_SERVER_METADATA[serverId];
      const methodLabelKey = MCP_METHOD_LABELS[method] ?? "mcpGenericLabel";
      const serverLabel = serverInfo ? t(serverInfo.label) : serverId;
      const methodLabel = t(methodLabelKey);
      const profileLabel = getModelProfileById(context.profileId)?.label;
      const lines = [
        t("mcpConfirmTitle"),
        "",
        `${t("mcpConfirmServer")} ${serverLabel}`,
        `${t("mcpConfirmMethod")} ${methodLabel}`,
      ];
      if (profileLabel) {
        lines.push(`${t("mcpConfirmProfile")} ${t(profileLabel)}`);
      }
      if (context.summary) {
        lines.push(`${t("mcpConfirmSummary")} ${context.summary}`);
      }
      lines.push("", t("mcpConfirmQuestion"));
      return window.confirm(lines.join("\n"));
    },
    [t],
  );

  const callMcp = useCallback(
    async <TResult,>(
      serverId: MCPServerId,
      method: MCPMethod,
      params: Record<string, unknown> | undefined,
      context: MCPRequestContext,
    ): Promise<TResult> => {
      if (!isAllowed(context.profileId, serverId, method)) {
        throw new Error(t("mcpPermissionDenied"));
      }

      const needsConfirmation =
        isSensitiveMcpMethod(serverId, method) &&
        context.requireConfirmation !== false;

      if (needsConfirmation) {
        const accepted = confirmSensitive(serverId, method, context);
        if (!accepted) {
          throw new Error(t("mcpActionCancelled"));
        }
      }

      try {
        const result = (await executeMcpMethod(
          serverId,
          method,
          params,
          context,
        )) as TResult;
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        if (normalizeMessage(message).includes("orbita segura")) {
          throw new Error(t("mcpOrbitViolation"));
        }
        throw error;
      }
    },
    [confirmSensitive, isAllowed, t],
  );

  return {
    callMcp,
    describeRules,
  };
};
