const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

import { chooseProfile, estimateTokenCount } from "../src/core/ai/profileSelector.js";
import { probeLocalOllama } from "../src/core/ai/detect.js";
import type { ProviderProfileId } from "../src/core/ai/types.js";
import {
  buildAccessMatrix,
  getPermissionsPartitionForProfile,
  isMcpMethodAllowed,
  isSensitiveMcpMethod,
} from "../src/core/mcp/permissions.js";
import { defaultSettings } from "../src/core/config/settings.js";

const testOllamaProbe = async (): Promise<void> => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new Error("connection refused");
  }) as typeof fetch;
  const down = await probeLocalOllama("http://127.0.0.1:11434");
  assert(down.ok === false, "Ollama probe should fail when the service is down");

  globalThis.fetch = (async () => ({ ok: true } as unknown as Response)) as typeof fetch;
  const up = await probeLocalOllama("http://127.0.0.1:11434");
  assert(up.ok === true, "Ollama probe should succeed after recovery");

  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  }
};

const testProfileSelection = (): void => {
  const sequence: ProviderProfileId[] = [
    chooseProfile({ tokenCount: 80, content: "hola" }),
    chooseProfile({ tokenCount: 480, content: "Necesito ayuda" }),
    chooseProfile({ tokenCount: 2000, content: "Planear arquitectura de proyecto complejo" }),
  ] as ProviderProfileId[];

  assert(
    sequence[0] === "fast" && sequence[1] === "balanced" && sequence[2] === "thoughtful",
    "Profile selector should escalate from fast → balanced → thoughtful",
  );

  const tokenEstimate = estimateTokenCount(
    "This is a short message designed for estimation purposes.",
  );
  assert(tokenEstimate >= 10, "Token estimation should return a reasonable value");
};

const testMcpPermissions = (): void => {
  const basicMatrix = buildAccessMatrix("basic");
  const balancedBasic = basicMatrix.balanced;
  assert(
    balancedBasic.allowed.some((rule) =>
      rule.serverId === "mcp.files" && rule.methods.includes("read"),
    ),
    "Balanced profile should allow reading files on basic level",
  );
  assert(
    balancedBasic.allowed.every((rule) => !rule.methods.includes("write")),
    "Balanced profile should not allow writing files on basic level",
  );

  const thoughtfulPower = buildAccessMatrix("power").thoughtful;
  assert(
    thoughtfulPower.allowed.some((rule) =>
      rule.serverId === "mcp.shell" && rule.methods.includes("exec"),
    ),
    "Thoughtful profile should allow shell exec on power level",
  );

  assert(
    isMcpMethodAllowed("thoughtful", "basic", "mcp.files", "write") === false,
    "Write outside allowed limits should be blocked",
  );

  const thoughtfulPartition = getPermissionsPartitionForProfile("thoughtful", "power");
  assert(
    thoughtfulPartition.blocked.length === 0,
    "Power users should have full thoughtful access",
  );

  assert(
    isSensitiveMcpMethod("mcp.files", "write") &&
      isSensitiveMcpMethod("mcp.shell", "exec"),
    "Sensitive MCP methods must trigger confirmation",
  );
};

const testSettingsDefaults = (): void => {
  assert(defaultSettings.network.enabled === false, "App should default to offline mode");
};

const run = async (): Promise<void> => {
  await testOllamaProbe();
  testProfileSelection();
  testMcpPermissions();
  testSettingsDefaults();

  console.log("Smoke tests passed");
};

run().catch((error) => {
  console.error(error);
  const nodeProcess = (globalThis as { process?: { exit(code: number): never } }).process;
  if (nodeProcess?.exit) {
    nodeProcess.exit(1);
  }
});
