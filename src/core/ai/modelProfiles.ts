import type { TranslationKey } from "../../i18n";

type LocalizedPrompts = {
  es: string;
  en: string;
};

export type ModelProfileReasoning = {
  memoryContext: string;
  thoughtStyle: string;
  contextTokens: number;
  maxOutputTokens: number;
  temperature: number;
  maxHistoryMessages?: number;
  systemPrompts: LocalizedPrompts;
};

export type ModelRuntime = "local" | "remote";

export type ModelProfile = {
  id: string;
  label: TranslationKey;
  description: TranslationKey;
  model: string;
  runtime: ModelRuntime;
  icon?: string;
  requiresAdvanced?: boolean;
  reasoning?: ModelProfileReasoning;
};

const profiles: ModelProfile[] = [
  {
    id: "fast",
    label: "modelProfileFastLabel",
    description: "modelProfileFastDescription",
    model: "llama3.2:3b",
    runtime: "local",
    icon: "⚡",
    reasoning: {
      memoryContext: "humano",
      thoughtStyle: "directo",
      contextTokens: 512,
      maxOutputTokens: 512,
      temperature: 1.1,
      maxHistoryMessages: 6,
      systemPrompts: {
        es: `Actúa como una mente humana ágil y directa. Responde siempre en español coloquial, como lo haría una persona real. Prioriza respuestas cortas y accionables con soluciones inmediatas y un tono cálido. Evita tecnicismos innecesarios y usa listas solo cuando faciliten el siguiente paso.`,
        en: `Act as an agile, human-minded assistant. Always reply in natural, conversational English as if you were a real person. Favour short, actionable answers with immediate solutions and a warm tone. Avoid unnecessary jargon and only use lists when they make the next step clearer.`,
      },
    },
  },
  {
    id: "balanced",
    label: "modelProfileBalancedLabel",
    description: "modelProfileBalancedDescription",
    model: "qwen2.5:3b-instruct",
    runtime: "local",
    icon: "🎯",
    reasoning: {
      memoryContext: "natural",
      thoughtStyle: "analítico",
      contextTokens: 2048,
      maxOutputTokens: 2048,
      temperature: 0.9,
      maxHistoryMessages: 12,
      systemPrompts: {
        es: `Actúa como un pensador natural y analítico. Responde en español con claridad cercana, combinando contexto con recomendaciones prácticas. Ofrece explicaciones estructuradas, ejemplos breves cuando aporten valor y mantiene un equilibrio entre detalle y humanidad sin divagar.`,
        en: `Act as a natural yet analytical thinker. Answer in English with a clear, approachable tone that blends context with practical guidance. Provide structured explanations and concise examples when they add value, balancing detail with warmth while staying focused on the request.`,
      },
    },
  },
  {
    id: "thoughtful",
    label: "modelProfileThoughtfulLabel",
    description: "modelProfileThoughtfulDescription",
    model: "mistral",
    runtime: "local",
    icon: "🧩",
    reasoning: {
      memoryContext: "arquitecto",
      thoughtStyle: "planificación profunda",
      contextTokens: 4096,
      maxOutputTokens: 4096,
      temperature: 0.6,
      maxHistoryMessages: 18,
      systemPrompts: {
        es: `Actúa como un arquitecto de soluciones profundo. Responde en español con calma estratégica, explicando tu razonamiento paso a paso. Descompone los problemas, planifica en capas y diseña proyectos de programación completos y sin errores cuando sea necesario. Mantén rigor técnico sin perder claridad humana.`,
        en: `Act as a deep solution architect. Reply in English with a calm, strategic tone and walk through your reasoning step by step. Break problems down, plan in layers, and design flawless programming projects when needed. Maintain technical rigour while keeping your explanations human and clear.`,
      },
    },
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
