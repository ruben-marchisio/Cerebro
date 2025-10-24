import type { TranslationKey } from "../../i18n";

export type ModelRuntime = "local" | "remote";

export type ModelProfile = {
  id: string;
  label: TranslationKey;
  description: TranslationKey;
  model: string;
  runtime: ModelRuntime;
  icon?: string;
  requiresAdvanced?: boolean;
};

const profiles: ModelProfile[] = [
  {
    id: "fast",
    label: "modelProfileFastLabel",
    description: "modelProfileFastDescription",
    model: "llama3.2:3b",
    runtime: "local",
    icon: "⚡",
  },
  {
    id: "balanced",
    label: "modelProfileBalancedLabel",
    description: "modelProfileBalancedDescription",
    model: "qwen2.5:3b-instruct",
    runtime: "local",
    icon: "🎯",
  },
  {
    id: "thoughtful",
    label: "modelProfileThoughtfulLabel",
    description: "modelProfileThoughtfulDescription",
    model: "mistral",
    runtime: "local",
    icon: "🧩",
  },
  {
    id: "deepseek-1.3",
    label: "modelProfileDeepseek13Label",
    description: "modelProfileDeepseek13Description",
    model: "deepseek-1.3",
    runtime: "remote",
  },
  {
    id: "deepseek-6.7",
    label: "modelProfileDeepseek67Label",
    description: "modelProfileDeepseek67Description",
    model: "deepseek-6.7",
    runtime: "remote",
    requiresAdvanced: true,
  },
];

const defaultProfileByRuntime: Record<ModelRuntime, string> = {
  local: "balanced",
  remote: "deepseek-1.3",
};

export const modelProfiles = profiles;

export const getModelProfileById = (
  id: string | null | undefined,
): ModelProfile | undefined => profiles.find((profile) => profile.id === id);

export const getModelProfilesByRuntime = (
  runtime: ModelRuntime,
): ModelProfile[] => profiles.filter((profile) => profile.runtime === runtime);

export const getDefaultProfileIdForRuntime = (
  runtime: ModelRuntime,
): string => defaultProfileByRuntime[runtime];
