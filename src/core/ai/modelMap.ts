export const uiToApiModel = {
  "deepseek-coder": "deepseek-coder",
} as const;

export type UiModel = keyof typeof uiToApiModel;
export type ApiModel = (typeof uiToApiModel)[UiModel];
