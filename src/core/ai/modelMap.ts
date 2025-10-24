export const uiToApiModel = {
  "deepseek-1.3": "deepseek-chat",
  "deepseek-6.7": "deepseek-reasoner",
} as const;

export type UiModel = keyof typeof uiToApiModel;
export type ApiModel = (typeof uiToApiModel)[UiModel];
