export type RuntimeStatus = "local" | "remote" | "none";

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
};

export type CompletionHandle = {
  controller: AbortController;
  response: Promise<string>;
};

export type StreamingProvider = {
  complete(request: ProviderCompleteParams): CompletionHandle;
};
