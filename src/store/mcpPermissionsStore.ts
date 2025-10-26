import { create } from "zustand";

import type { ProviderProfileId } from "../core/ai/types";
import {
  buildAccessMatrix,
  isMcpMethodAllowed,
  type McpAccessLevel,
  type McpPermission,
  type McpPermissionMatrix,
} from "../core/mcp/permissions";
import { getSettings, setSettingsAccessLevel, useSettingsStore } from "./settingsStore";
import type { MCPMethod, MCPServerId } from "../core/mcp";

type McpPermissionsState = {
  accessLevel: McpAccessLevel;
  matrix: McpPermissionMatrix;
  setAccessLevel: (level: McpAccessLevel) => Promise<void>;
  getEffectivePermissions: (profileId: ProviderProfileId) => McpPermission[];
  getBlockedPermissions: (profileId: ProviderProfileId) => McpPermission[];
  getMatrixForLevel: (level: McpAccessLevel) => McpPermissionMatrix;
  isAllowed: (
    profileId: ProviderProfileId,
    serverId: MCPServerId,
    method: MCPMethod,
  ) => boolean;
};

const initialAccessLevel = getSettings().permissions.accessLevel;
const initialMatrix = buildAccessMatrix(initialAccessLevel);

const clonePermissions = (permissions: McpPermission[]): McpPermission[] =>
  permissions.map((rule) => ({
    serverId: rule.serverId,
    methods: [...rule.methods],
  }));

export const useMcpPermissionsStore = create<McpPermissionsState>((set, get) => ({
  accessLevel: initialAccessLevel,
  matrix: initialMatrix,
  setAccessLevel: async (level) => {
    if (get().accessLevel === level) {
      return;
    }
    await setSettingsAccessLevel(level);
    set({
      accessLevel: level,
      matrix: buildAccessMatrix(level),
    });
  },
  getEffectivePermissions: (profileId) => {
    const partition = get().matrix[profileId];
    if (!partition) {
      return [];
    }
    return clonePermissions(partition.allowed);
  },
  getBlockedPermissions: (profileId) => {
    const partition = get().matrix[profileId];
    if (!partition) {
      return [];
    }
    return clonePermissions(partition.blocked);
  },
  getMatrixForLevel: (level) => buildAccessMatrix(level),
  isAllowed: (profileId, serverId, method) => {
    const partition = get().matrix[profileId];
    if (partition) {
      return partition.allowed.some(
        (rule) => rule.serverId === serverId && rule.methods.includes(method),
      );
    }
    return isMcpMethodAllowed(profileId, get().accessLevel, serverId, method);
  },
}));

useSettingsStore.subscribe((state) => {
  const accessLevel = state.settings.permissions.accessLevel;
  const current = useMcpPermissionsStore.getState().accessLevel;
  if (current !== accessLevel) {
    useMcpPermissionsStore.setState({
      accessLevel,
      matrix: buildAccessMatrix(accessLevel),
    });
  }
});
