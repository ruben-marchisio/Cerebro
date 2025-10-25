const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

import { chooseProfile, estimateTokenCount } from "../src/core/ai/profileSelector.js";
import { probeLocalOllama } from "../src/core/ai/detect.js";

const run = async (): Promise<void> => {
  const fastProfile = chooseProfile({ tokenCount: 120, content: "Hola" });
  assert(fastProfile === "fast", "Expected ≤200 tokens to use fast mode");

  const balancedProfile = chooseProfile({ tokenCount: 400, content: "Necesito ayuda" });
  assert(
    balancedProfile === "balanced",
    "Expected between 200 and 1500 tokens to use balanced mode",
  );

  const thoughtfulProfile = chooseProfile({
    tokenCount: 220,
    content: "Planear arquitectura de proyecto complejo",
  });
  assert(
    thoughtfulProfile === "thoughtful",
    "Keywords should force thoughtful mode",
  );

  const tokenEstimate = estimateTokenCount(
    "This is a short message designed for estimation purposes.",
  );
  assert(tokenEstimate >= 10, "Token estimation should return a reasonable value");

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => ({ ok: true } as unknown as Response)) as typeof fetch;
  const probeSuccess = await probeLocalOllama("http://localhost:11434");
  assert(probeSuccess.ok === true, "Probe should succeed when fetch resolves ok");
  assert(
    typeof probeSuccess.latencyMs === "number" || probeSuccess.latencyMs === null,
    "Latency should be numeric or null",
  );

  globalThis.fetch = (async () => {
    throw new Error("Network error");
  }) as typeof fetch;
  const probeFailure = await probeLocalOllama("http://localhost:11434");
  assert(probeFailure.ok === false, "Probe should fail when fetch throws");

  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }

  console.log("Smoke tests passed");
};

run().catch((error) => {
  console.error(error);
  const nodeProcess = (globalThis as { process?: { exit(code: number): never } }).process;
  if (nodeProcess?.exit) {
    nodeProcess.exit(1);
  }
});
