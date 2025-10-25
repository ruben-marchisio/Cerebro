import type { ProviderProfileId } from "./types";

const KEYWORDS_THOUGHTFUL = ["proyecto", "arquitectura"];

export type PromptStats = {
  tokenCount: number;
  content: string;
};

export const estimateTokenCount = (content: string): number => {
  const text = content.trim();
  if (!text) {
    return 0;
  }

  const words = text.split(/\s+/).length;
  const characters = text.replace(/\s+/g, "").length;

  const wordEstimate = Math.ceil(words * 0.8);
  const charEstimate = Math.ceil(characters / 4);

  return Math.max(wordEstimate, charEstimate);
};

export const chooseProfile = ({
  tokenCount,
  content,
}: PromptStats): ProviderProfileId => {
  if (!Number.isFinite(tokenCount) || tokenCount < 0) {
    return "fast";
  }

  const normalized = content.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  const matchesKeyword = KEYWORDS_THOUGHTFUL.some((keyword) =>
    normalized.includes(keyword),
  );

  if (tokenCount > 1500 || matchesKeyword) {
    return "thoughtful";
  }

  if (tokenCount > 200) {
    return "balanced";
  }

  return "fast";
};
