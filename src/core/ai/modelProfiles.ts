import type { TranslationKey } from "../../i18n";
import type { MCPAccessRule } from "../mcp";

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
  reasoningLevel?: "low" | "medium" | "high";
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
  mcpAccess?: MCPAccessRule[];
};

const profiles: ModelProfile[] = [
  {
    id: "fast",
    label: "modelProfileFastLabel",
    description: "modelProfileFastDescription",
    model: "llama3.2:3b",
    runtime: "local",
    icon: "🌀",
    reasoning: {
      memoryContext: "humano",
      thoughtStyle: "directo",
      contextTokens: 512,
      maxOutputTokens: 512,
      temperature: 1.1,
      maxHistoryMessages: 6,
      reasoningLevel: "low",
      systemPrompts: {
        es: `Actúa como una mente humana rápida y cercana. Habla en español directo, cálido y breve. Entrega respuestas accionables en 4-6 frases, usa listas solo si facilitan el próximo paso y evita explicaciones largas.`,
        en: `Act as a quick, human-like thinker. Answer in natural English with warmth and keep it brief. Deliver actionable replies within 4-6 sentences, using lists only when they clarify the next step and skipping long sign-offs.`,
      },
    },
    mcpAccess: [],
  },
  {
    id: "balanced",
    label: "modelProfileBalancedLabel",
    description: "modelProfileBalancedDescription",
    model: "mistral",
    runtime: "local",
    icon: "⚖️",
    reasoning: {
      memoryContext: "natural",
      thoughtStyle: "analítico",
      contextTokens: 2048,
      maxOutputTokens: 2048,
      temperature: 0.9,
      maxHistoryMessages: 12,
      reasoningLevel: "medium",
      systemPrompts: {
        es: `Actúa como un pensador natural y explicativo. Responde en español con claridad y estructura, ofreciendo 2-4 párrafos que mezclen contexto con pasos accionables. Incluye ejemplos breves cuando aporten valor y mantén un tono humano y cercano.`,
        en: `Act as a natural, explanatory thinker. Reply in English with structured clarity, delivering 2-4 paragraphs that mix context with actionable steps. Add short examples when they add value and keep a human, approachable tone.`,
      },
    },
    mcpAccess: [
      {
        serverId: "mcp.files",
        methods: ["list", "read", "info"],
      },
    ],
  },
  {
    id: "thoughtful",
    label: "modelProfileThoughtfulLabel",
    description: "modelProfileThoughtfulDescription",
    model: "deepseek-coder",
    runtime: "remote",
    icon: "🧩",
    reasoning: {
      memoryContext: "arquitecto",
      thoughtStyle: "planificación profunda",
      contextTokens: 4096,
      maxOutputTokens: 4096,
      temperature: 0.6,
      maxHistoryMessages: 18,
      reasoningLevel: "high",
      systemPrompts: {
        es: `Actúa como un arquitecto de soluciones estratégico. Responde en español con calma, expone tu razonamiento paso a paso y diseña planes completos para proyectos de desarrollo. Descompone problemas en capas, valida supuestos y prioriza la robustez técnica sin perder claridad humana.`,
        en: `Act as a strategic solution architect. Reply in English calmly, walk through your reasoning step by step, and design end-to-end plans for development projects. Break problems into layers, validate assumptions, and prioritise technical robustness while staying human and clear.`,
      },
    },
    requiresAdvanced: true,
    mcpAccess: [
      {
        serverId: "mcp.files",
        methods: ["list", "read", "write", "info"],
      },
      {
        serverId: "mcp.git",
        methods: ["exec", "info"],
      },
      {
        serverId: "mcp.shell",
        methods: ["exec", "info"],
      },
      {
        serverId: "mcp.system",
        methods: ["info"],
      },
      {
        serverId: "mcp.tauri",
        methods: ["exec", "info"],
      },
    ],
  },
  {
    id: "thoughtfulLocal",
    label: "modelProfileThoughtfulLocalLabel",
    description: "modelProfileThoughtfulLocalDescription",
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
      reasoningLevel: "high",
      systemPrompts: {
        es: `Actúa como un arquitecto de soluciones estratégico. Responde en español con calma, expone tu razonamiento paso a paso y diseña planes completos para proyectos de desarrollo. Descompone problemas en capas, valida supuestos y prioriza la robustez técnica sin perder claridad humana.`,
        en: `Act as a strategic solution architect. Reply in English calmly, walk through your reasoning step by step, and design end-to-end plans for development projects. Break problems into layers, validate assumptions, and prioritise technical robustness while staying human and clear.`,
      },
    },
    mcpAccess: [
      {
        serverId: "mcp.files",
        methods: ["list", "read", "write", "info"],
      },
      {
        serverId: "mcp.git",
        methods: ["exec", "info"],
      },
      {
        serverId: "mcp.shell",
        methods: ["exec", "info"],
      },
      {
        serverId: "mcp.system",
        methods: ["info"],
      },
      {
        serverId: "mcp.tauri",
        methods: ["exec", "info"],
      },
    ],
  },
];

const defaultProfileByRuntime: Record<ModelRuntime, string> = {
  local: "balanced",
  remote: "thoughtful",
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

export const getMcpAccessForProfile = (
  profileId: string,
): MCPAccessRule[] =>
  (getModelProfileById(profileId)?.mcpAccess ?? []).map((rule) => ({
    serverId: rule.serverId,
    methods: [...rule.methods],
  }));
