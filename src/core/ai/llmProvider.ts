import { getDefaultModel } from "../config/settings";

export type LLMRequest = {
  prompt: string;
  context?: string[];
};

export interface LLMProvider {
  readonly model: string;
  generateResponse(input: LLMRequest): Promise<string>;
}

class DeepSeekProvider implements LLMProvider {
  readonly model: string;

  constructor(model: string = getDefaultModel()) {
    this.model = model;
  }

  async generateResponse(_: LLMRequest): Promise<string> {
    // TODO: integrate with DeepSeek API.
    return Promise.resolve(
      "[DeepSeek] Implementación pendiente para generar respuestas.",
    );
  }
}

export const createDeepSeekProvider = (model?: string): LLMProvider =>
  new DeepSeekProvider(model);
