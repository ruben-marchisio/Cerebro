import type { ProviderProfileId } from "../ai/types";
import type { MCPMethod, MCPServerId } from "./types";

export type McpAccessLevel = "basic" | "dev" | "power";

export type McpPermission = {
  serverId: MCPServerId;
  methods: MCPMethod[];
};

export type McpPermissionPartition = {
  allowed: McpPermission[];
  blocked: McpPermission[];
};

export type McpPermissionMatrix = Record<ProviderProfileId, McpPermissionPartition>;

type ProfilePermissionMap = Partial<Record<ProviderProfileId, McpPermission[]>>;
type AccessLevelLimits = Record<
  McpAccessLevel,
  Partial<Record<MCPServerId, MCPMethod[]>>
>;

const clonePermission = (permission: McpPermission): McpPermission => ({
  serverId: permission.serverId,
  methods: [...permission.methods],
});

const clonePermissions = (permissions: McpPermission[]): McpPermission[] =>
  permissions.map(clonePermission);

const THOUGHTFUL_PERMISSIONS: McpPermission[] = [
  {
    serverId: "mcp.files",
    methods: ["list", "read", "write", "info"],
  },
  {
    serverId: "mcp.git",
    methods: ["exec", "info"],
  },
  {
    serverId: "mcp.shell",
    methods: ["exec", "info"],
  },
  {
    serverId: "mcp.system",
    methods: ["info"],
  },
  {
    serverId: "mcp.tauri",
    methods: ["exec", "info"],
  },
];

const PERMISSION_PROFILE_IDS: ProviderProfileId[] = [
  "fast",
  "balanced",
  "thoughtful",
  "thoughtfulLocal",
];

const PROFILE_BASE_PERMISSIONS: ProfilePermissionMap = {
  fast: [],
  balanced: [
    {
      serverId: "mcp.files",
      methods: ["list", "read", "info"],
    },
  ],
  thoughtful: THOUGHTFUL_PERMISSIONS,
  thoughtfulLocal: THOUGHTFUL_PERMISSIONS,
};

const ACCESS_LEVEL_LIMITS: AccessLevelLimits = {
  basic: {
    "mcp.files": ["list", "read", "info"],
    "mcp.system": ["info"],
  },
  dev: {
    "mcp.files": ["list", "read", "write", "info"],
    "mcp.system": ["info"],
    "mcp.git": ["exec", "info"],
    "mcp.shell": ["exec", "info"],
    "mcp.tauri": ["info"],
  },
  power: {
    "mcp.files": ["list", "read", "write", "info"],
    "mcp.system": ["info"],
    "mcp.git": ["exec", "info"],
    "mcp.shell": ["exec", "info"],
    "mcp.tauri": ["exec", "info"],
  },
};

const intersectMethods = (
  baseMethods: MCPMethod[],
  allowedMethods: MCPMethod[] | undefined,
): MCPMethod[] => {
  if (!allowedMethods || allowedMethods.length === 0) {
    return [];
  }
  return baseMethods.filter((method) => allowedMethods.includes(method));
};

const pickLimits = (
  accessLevel: McpAccessLevel,
): Partial<Record<MCPServerId, MCPMethod[]>> => ACCESS_LEVEL_LIMITS[accessLevel];

const computeAllowedRules = (
  baseRules: McpPermission[],
  limits: Partial<Record<MCPServerId, MCPMethod[]>>,
): McpPermission[] =>
  baseRules
    .map((rule) => {
      const allowed = intersectMethods(rule.methods, limits[rule.serverId]);
      return allowed.length > 0
        ? { serverId: rule.serverId, methods: allowed }
        : null;
    })
    .filter((value): value is McpPermission => value !== null);

const computeBlockedRules = (
  baseRules: McpPermission[],
  allowedRules: McpPermission[],
): McpPermission[] =>
  baseRules
    .map((rule) => {
      const activeRule = allowedRules.find(
        (item) => item.serverId === rule.serverId,
      );
      if (!activeRule) {
        return rule;
      }
      const blockedMethods = rule.methods.filter(
        (method) => !activeRule.methods.includes(method),
      );
      return blockedMethods.length > 0
        ? { serverId: rule.serverId, methods: blockedMethods }
        : null;
    })
    .filter((value): value is McpPermission => value !== null);

export const getBasePermissionsForProfile = (
  profileId: ProviderProfileId,
): McpPermission[] => clonePermissions(PROFILE_BASE_PERMISSIONS[profileId] ?? []);

export const getPermissionsPartitionForProfile = (
  profileId: ProviderProfileId,
  accessLevel: McpAccessLevel,
): McpPermissionPartition => {
  const base = getBasePermissionsForProfile(profileId);
  if (base.length === 0) {
    return { allowed: [], blocked: [] };
  }

  const limits = pickLimits(accessLevel);
  const allowed = computeAllowedRules(base, limits);
  if (allowed.length === 0) {
    return {
      allowed: [],
      blocked: base,
    };
  }

  const blocked = computeBlockedRules(base, allowed);
  return {
    allowed,
    blocked,
  };
};

export const buildAccessMatrix = (
  accessLevel: McpAccessLevel,
): McpPermissionMatrix => {
  const matrix = {} as McpPermissionMatrix;
  for (const profileId of PERMISSION_PROFILE_IDS) {
    matrix[profileId] = getPermissionsPartitionForProfile(
      profileId,
      accessLevel,
    );
  }
  return matrix;
};

export const getEffectivePermissionsForProfile = (
  profileId: ProviderProfileId,
  accessLevel: McpAccessLevel,
): McpPermission[] =>
  getPermissionsPartitionForProfile(profileId, accessLevel).allowed;

export const getBlockedPermissionsForProfile = (
  profileId: ProviderProfileId,
  accessLevel: McpAccessLevel,
): McpPermission[] =>
  getPermissionsPartitionForProfile(profileId, accessLevel).blocked;

export const isMcpMethodAllowed = (
  profileId: ProviderProfileId,
  accessLevel: McpAccessLevel,
  serverId: MCPServerId,
  method: MCPMethod,
): boolean => {
  const partition = getPermissionsPartitionForProfile(profileId, accessLevel);
  return partition.allowed.some(
    (rule) => rule.serverId === serverId && rule.methods.includes(method),
  );
};

const SENSITIVE_METHODS: ReadonlySet<MCPMethod> = new Set(["write", "exec"]);

export const isSensitiveMcpMethod = (
  serverId: MCPServerId,
  method: MCPMethod,
): boolean => {
  if (!SENSITIVE_METHODS.has(method)) {
    return false;
  }

  if (serverId === "mcp.files" && method === "write") {
    return true;
  }

  if (
    (serverId === "mcp.shell" ||
      serverId === "mcp.git" ||
      serverId === "mcp.tauri") &&
    method === "exec"
  ) {
    return true;
  }

  return false;
};

export const getAccessLevelLimits = (
  accessLevel: McpAccessLevel,
): Partial<Record<MCPServerId, MCPMethod[]>> => pickLimits(accessLevel);
