export type RuntimeStatus = "local" | "remote" | "none";

export const PROVIDER_PROFILE_IDS = [
  "fast",
  "balanced",
  "thoughtful",
  "thoughtfulLocal",
] as const;

export type ProviderProfileId = (typeof PROVIDER_PROFILE_IDS)[number];

export const isProviderProfileId = (
  value: unknown,
): value is ProviderProfileId =>
  typeof value === "string" &&
  (PROVIDER_PROFILE_IDS as readonly string[]).includes(value);

export type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProviderCompleteParams = {
  prompt: string;
  system?: string;
  model?: string;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
  messages?: ProviderMessage[];
  profileId?: ProviderProfileId;
  temperature?: number;
  maxOutputTokens?: number;
  contextTokens?: number;
};

export type CompletionHandle = {
  controller: AbortController;
  response: Promise<string>;
  model?: string;
};

export type StreamingProvider = {
  complete(request: ProviderCompleteParams): CompletionHandle;
};
