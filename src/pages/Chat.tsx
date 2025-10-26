import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ChatComposer from "../components/chat/ChatComposer";
import ChatView from "../components/chat/ChatView";
import SidebarProjects from "../components/chat/SidebarProjects";
import ThreadList from "../components/chat/ThreadList";
import {
  ensureSeed,
  MessageRecord,
  messagesRepo,
  ProjectRecord,
  projectsRepo,
  ThreadRecord,
  threadsRepo,
  createBestProvider,
  getRuntimeStatus,
  createFallbackMemoryProvider,
  type ProviderMessage,
  type RuntimeStatus,
  type StreamingProvider,
  type CompletionHandle,
  type ProviderProfileId,
  isProviderProfileId,
} from "../core";
import { OllamaModelMissingError } from "../core/ai/providers/local/ollama";
import {
  getDefaultProfileIdForRuntime,
  getModelProfileById,
} from "../core/ai/modelProfiles";
import { probeLocalOllama } from "../core/ai/detect";
import {
  executeMcpMethod,
  type MCPExecResult,
  type MCPMethod,
  type MCPRequestContext,
  type MCPServerId,
} from "../core/mcp";
import {
  isSensitiveMcpMethod,
  type McpPermission,
} from "../core/mcp/permissions";
import { appendMetric } from "../core/metrics";
import {
  chooseProfile,
  estimateTokenCount,
} from "../core/ai/profileSelector";
import {
  getActiveProjectId,
  getActiveThreadId,
  useChatStore,
} from "../store/chatStore";
import { useMcpPermissionsStore } from "../store/mcpPermissionsStore";
import { MCP_METHOD_LABELS, MCP_SERVER_METADATA } from "../ui/mcpMetadata";
import { useSettingsStore } from "../store/settingsStore";
import type { TranslationKey } from "../i18n";

type Translator = (key: TranslationKey) => string;

const RUNTIME_GUIDE_URL =
  "https://github.com/ruben-marchisio/cerebro#runtime-local";

type ChatProps = {
  t: Translator;
};

type ChatMessage = MessageRecord & {
  pending?: boolean;
};

type AssistantLanguage = "es" | "en";
type ProfileId = ProviderProfileId;

const DEFAULT_PROFILE_ID: ProfileId = "balanced";

type OllamaStatus = {
  ok: boolean;
  latencyMs: number | null;
  error?: string;
  updatedAt: number;
};


const getTime = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const resolveProfileId = (
  candidate: string | null | undefined,
): ProfileId =>
  isProviderProfileId(candidate) ? candidate : DEFAULT_PROFILE_ID;

const resolveProviderLabel = (runtime: RuntimeStatus): string => {
  switch (runtime) {
    case "local":
      return "ollama";
    case "remote":
      return "deepseek";
    default:
      return "memory";
  }
};

const sortByDate = <T extends { createdAt: string }>(collection: T[]): T[] =>
  [...collection].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const createAssistantPlaceholder = (threadId: string): ChatMessage => ({
  id: `assistant-placeholder-${threadId}-${Date.now()}`,
  threadId,
  role: "assistant",
  content: "...",
  createdAt: new Date().toISOString(),
  pending: true,
});

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

const SPANISH_HINTS = [
  "¿",
  "¡",
  "ñ",
  " á",
  " é",
  " í",
  " ó",
  " ú",
  "hola",
  "gracias",
  "código",
  "ejemplo",
  "por qué",
  "necesito",
  "quiero",
  "debería",
  "ayuda",
  "configura",
];

const ENGLISH_HINTS = [
  "hello",
  "thanks",
  "please",
  "code",
  "example",
  "why",
  "need",
  "should",
  "help",
  "configure",
  "what",
  "how",
  "could",
  "would",
];

const sanitizeContent = (input: string): string =>
  input.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const detectLanguageFromContent = (content: string): AssistantLanguage => {
  const raw = content.trim();
  if (!raw) {
    return "es";
  }

  const normalized = sanitizeContent(raw);
  let spanishScore = 0;
  let englishScore = 0;

  for (const hint of SPANISH_HINTS) {
    if (normalized.includes(sanitizeContent(hint))) {
      spanishScore += 2;
    }
  }

  for (const hint of ENGLISH_HINTS) {
    if (normalized.includes(sanitizeContent(hint))) {
      englishScore += 2;
    }
  }

  const characters = raw.split("");
  for (const char of characters) {
    if ("¿¡áéíóúñÁÉÍÓÚÑ".includes(char)) {
      spanishScore += 1;
    }
  }

  return spanishScore >= englishScore ? "es" : "en";
};

const detectAssistantLanguage = (
  records: MessageRecord[],
): AssistantLanguage => {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const entry = records[index];
    if (entry.role === "user") {
      return detectLanguageFromContent(entry.content);
    }
  }
  return "es";
};

const buildSystemPrompt = (
  language: AssistantLanguage,
  profileId: ProfileId,
): string => {
  const profile =
    getModelProfileById(profileId) ?? getModelProfileById(DEFAULT_PROFILE_ID);
  const reasoningPrompts = profile?.reasoning?.systemPrompts;

  if (reasoningPrompts) {
    return reasoningPrompts[language] ?? reasoningPrompts.es;
  }

  const fallbackPrompts = {
    es: {
      fast:
        "Responde en español, directo y en 4-6 líneas máximo. Si hay pasos, usa viñetas breves. No repitas contexto ni cierres largos.",
      balanced:
        "Responde en español, clara y en 2-4 párrafos. Añade un ejemplo corto si ayuda. Evita listas innecesarias.",
      thoughtful:
        "Responde en español, con profundidad y ejemplos cuando correspondan. Puedes extenderte si aporta valor. Mantén la coherencia con la última solicitud.",
      thoughtfulLocal:
        "Responde en español, con profundidad y ejemplos cuando correspondan. Puedes extenderte si aporta valor. Mantén la coherencia con la última solicitud.",
    },
    en: {
      fast:
        "Reply in English, direct, and keep it within 4-6 sentences max. Use short bullets for steps. Skip repeating context or long sign-offs.",
      balanced:
        "Reply in English, clearly, using 2-4 paragraphs. Add a short example if it helps. Avoid unnecessary lists.",
      thoughtful:
        "Reply in English with depth and examples when useful. Feel free to elaborate if it adds value. Stay consistent with the latest request.",
      thoughtfulLocal:
        "Reply in English with depth and examples when useful. Feel free to elaborate if it adds value. Stay consistent with the latest request.",
    },
  } as const;

  const localePrompts = fallbackPrompts[language] ?? fallbackPrompts.es;

  return localePrompts[profileId] ?? localePrompts[DEFAULT_PROFILE_ID];
};

const formatPromptFromMessages = (
  records: MessageRecord[],
  {
    language,
    maxMessages,
  }: {
    language: AssistantLanguage;
    maxMessages?: number;
  },
): { prompt: string; history: MessageRecord[] } => {
  if (records.length === 0) {
    return { prompt: "", history: [] };
  }

  const relevantRecords =
    typeof maxMessages === "number" && maxMessages > 0
      ? records.slice(-maxMessages)
      : records;

  const roleLabels =
    language === "en"
      ? { assistant: "Assistant", system: "System", user: "User" }
      : { assistant: "Asistente", system: "Sistema", user: "Usuario" };

  const historyText = relevantRecords
    .map((message) => {
      const label = roleLabels[message.role as keyof typeof roleLabels] ?? "User";
      return `${label}: ${message.content}`;
    })
    .join("\n\n");

  const prompt = `${historyText}\n\n${roleLabels.assistant}:`;

  return {
    prompt,
    history: relevantRecords,
  };
};

const getMaxMessagesForProfile = (
  profileId: ProfileId,
): number | undefined => {
  const modelProfile = getModelProfileById(profileId);
  const reasoning = modelProfile?.reasoning;

  if (!reasoning) {
    return undefined;
  }

  if (typeof reasoning.maxHistoryMessages === "number") {
    return reasoning.maxHistoryMessages;
  }

  if (typeof reasoning.contextTokens === "number") {
    return Math.max(4, Math.floor(reasoning.contextTokens / 128));
  }

  return undefined;
};

export default function Chat({ t }: ChatProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [threads, setThreads] = useState<ThreadRecord[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [completionController, setCompletionController] =
    useState<AbortController | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const providerRef = useRef<StreamingProvider | null>(null);
  const previousThreadIdRef = useRef<string | null>(null);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeStatus>("none");
  const [providerReady, setProviderReady] = useState(false);
  const [missingModelProfileId, setMissingModelProfileId] = useState<
    string | null
  >(null);
  const [missingModelSuggestion, setMissingModelSuggestion] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({
    ok: false,
    latencyMs: null,
    error: undefined,
    updatedAt: Date.now(),
  });
  const [isProbingOllama, setIsProbingOllama] = useState(false);
  const [systemPaths, setSystemPaths] = useState<{
    home: string;
    safeOrbit: string;
  } | null>(null);

  const activeProjectId = useChatStore((state) => state.activeProjectId);
  const activeThreadId = useChatStore((state) => state.activeThreadId);
  const setActiveProject = useChatStore((state) => state.setActiveProject);
  const setActiveThread = useChatStore((state) => state.setActiveThread);
  const profileSettings = useSettingsStore((state) => state.settings.profile);
  const networkEnabled = useSettingsStore(
    (state) => state.settings.network.enabled,
  );
  const accessLevel = useMcpPermissionsStore((state) => state.accessLevel);
  const getEffectiveMcpPermissions = useMcpPermissionsStore(
    (state) => state.getEffectivePermissions,
  );
  const getBlockedMcpPermissions = useMcpPermissionsStore(
    (state) => state.getBlockedPermissions,
  );
  const isMcpAllowed = useMcpPermissionsStore((state) => state.isAllowed);

  const profileMode = profileSettings.mode;
  const manualProfileId = resolveProfileId(profileSettings.manualId);

  const [activeProfileId, setActiveProfileId] =
    useState<ProfileId>(manualProfileId);

  useEffect(() => {
    if (profileMode === "manual") {
      setActiveProfileId(manualProfileId);
    }
  }, [profileMode, manualProfileId]);

  useEffect(() => {
    let cancelled = false;

    const loadPaths = async () => {
      try {
        const result = await callMcp<{ home?: string; safeOrbit?: string }>(
          "mcp.system",
          "info",
          { topic: "paths" },
          {
            profileId: "thoughtful",
            requireConfirmation: false,
            summary: "system-paths",
          },
        );

        if (cancelled) {
          return;
        }

        if (result?.home && result?.safeOrbit) {
          setSystemPaths({
            home: result.home,
            safeOrbit: result.safeOrbit,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("[mcp] Failed to load system paths", error);
        }
      }
    };

    void loadPaths();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeProfile = useMemo(
    () => getModelProfileById(activeProfileId),
    [activeProfileId],
  );

  const allowedMcpRules = useMemo<McpPermission[]>(
    () => getEffectiveMcpPermissions(activeProfileId),
    [activeProfileId, getEffectiveMcpPermissions, accessLevel],
  );

  const blockedMcpRules = useMemo<McpPermission[]>(
    () => getBlockedMcpPermissions(activeProfileId),
    [activeProfileId, getBlockedMcpPermissions, accessLevel],
  );

  const canUseShell = useMemo(
    () =>
      allowedMcpRules.some(
        (rule) => rule.serverId === "mcp.shell" && rule.methods.includes("exec"),
      ),
    [allowedMcpRules],
  );

  const mcpIndicatorGroups = useMemo(
    () => {
      const toIndicator = (rules: McpPermission[], blocked: boolean) =>
        rules.map((rule) => {
          const info = MCP_SERVER_METADATA[rule.serverId];
          return {
            id: `${rule.serverId}-${blocked ? "blocked" : "allowed"}`,
            serverId: rule.serverId,
            icon: info?.icon ?? "🛠️",
            label: info?.label ?? "mcpGenericLabel",
            methods: rule.methods,
            blocked,
          };
        });

      return {
        allowed: toIndicator(allowedMcpRules, false),
        blocked: toIndicator(blockedMcpRules, true),
      };
    },
    [allowedMcpRules, blockedMcpRules],
  );

  const resolveProfileForRuntime = useCallback(
    (
      candidateId: ProfileId,
      runtime: RuntimeStatus,
    ): { profileId: ProfileId; model: string | undefined } => {
      const candidateProfile = getModelProfileById(candidateId);
      const fallbackLocal = getModelProfileById(
        getDefaultProfileIdForRuntime("local"),
      );
      const fallbackRemote = getModelProfileById(
        getDefaultProfileIdForRuntime("remote"),
      );

      if (runtime === "local") {
        const localCandidateId: ProfileId =
          candidateId === "thoughtful" && getModelProfileById("thoughtfulLocal")
            ? "thoughtfulLocal"
            : candidateId;
        const localCandidateProfile = getModelProfileById(localCandidateId);

        if (localCandidateProfile?.runtime === "local" && localCandidateProfile.model) {
          return { profileId: localCandidateId, model: localCandidateProfile.model };
        }

        const fallbackProfile =
          fallbackLocal ?? localCandidateProfile ?? candidateProfile ?? fallbackRemote;
        const fallbackId = resolveProfileId(fallbackProfile?.id);

        return {
          profileId: fallbackId,
          model: fallbackProfile?.model ?? "mistral",
        };
      }

      if (runtime === "remote") {
        if (candidateProfile?.runtime === "remote" && candidateProfile.model) {
          return { profileId: candidateId, model: candidateProfile.model };
        }

        const fallbackProfile =
          fallbackRemote ?? candidateProfile ?? fallbackLocal;
        const fallbackId = resolveProfileId(fallbackProfile?.id);

        return {
          profileId: fallbackId,
          model: fallbackProfile?.model ?? "deepseek-coder",
        };
      }

      // Runtime "none" or unknown: fallback to candidate, preferring local defaults.
      const fallbackProfile = candidateProfile ?? fallbackLocal ?? fallbackRemote;
      const fallbackId = resolveProfileId(fallbackProfile?.id);

      return {
        profileId: fallbackId,
        model: fallbackProfile?.model ?? "mistral",
      };
    },
    [],
  );

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const confirmSensitiveMcp = useCallback(
    (
      serverId: MCPServerId,
      method: MCPMethod,
      context: MCPRequestContext,
    ): boolean => {
      const serverInfo = MCP_SERVER_METADATA[serverId];
      const methodLabelKey = MCP_METHOD_LABELS[method] ?? "mcpGenericLabel";
      const serverLabel = serverInfo ? t(serverInfo.label) : serverId;
      const methodLabel = t(methodLabelKey);
      const profileLabel = getModelProfileById(context.profileId)?.label;
      const lines = [
        t("mcpConfirmTitle"),
        "",
        `${t("mcpConfirmServer")} ${serverLabel}`,
        `${t("mcpConfirmMethod")} ${methodLabel}`,
      ];
      if (profileLabel) {
        lines.push(`${t("mcpConfirmProfile")} ${t(profileLabel)}`);
      }
      if (context.summary) {
        lines.push(`${t("mcpConfirmSummary")} ${context.summary}`);
      }
      lines.push("", t("mcpConfirmQuestion"));
      return window.confirm(lines.join("\n"));
    },
    [t],
  );

  const callMcp = useCallback(
    async <TResult,>(
      serverId: MCPServerId,
      method: MCPMethod,
      params: Record<string, unknown> | undefined,
      context: MCPRequestContext,
    ): Promise<TResult> => {
      const resolvedProfileId = resolveProfileId(context.profileId);

      if (!isMcpAllowed(resolvedProfileId, serverId, method)) {
        throw new Error(t("mcpPermissionDenied"));
      }

      const shouldConfirm =
        isSensitiveMcpMethod(serverId, method) &&
        context.requireConfirmation !== false;

      if (shouldConfirm) {
        const accepted = confirmSensitiveMcp(serverId, method, {
          ...context,
          profileId: resolvedProfileId,
        });
        if (!accepted) {
          throw new Error(t("mcpActionCancelled"));
        }
      }

      try {
        const result = (await executeMcpMethod(
          serverId,
          method,
          params,
          {
            ...context,
            profileId: resolvedProfileId,
          },
        )) as TResult;
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        const normalized = message
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase();
        if (normalized.includes("orbita segura")) {
          throw new Error(t("mcpOrbitViolation"));
        }
        throw error;
      }
    },
    [confirmSensitiveMcp, isMcpAllowed, t],
  );

  const handleTestProfile = useCallback(
    async (profileId: ProviderProfileId) => {
      const provider = providerRef.current;
      if (!provider) {
        showToast(t("completionError"));
        return;
      }

      const { profileId: effectiveProfileId, model: resolvedModel } =
        resolveProfileForRuntime(profileId, runtimeMode);

      const prompt = t("modelTestPrompt");
      const startedAt = getTime();

      try {
        const completion = provider.complete({
          prompt,
          model: resolvedModel,
          system: undefined,
          profileId: effectiveProfileId,
          temperature: 0,
          maxOutputTokens: 32,
          contextTokens: 512,
        });

        await completion.response;

        const latencyMs = Math.max(0, Math.round(getTime() - startedAt));
        const usedModel = completion.model ?? resolvedModel;

        showToast(
          t("modelTestSuccess")
            .replace("{{model}}", usedModel)
            .replace("{{latency}}", `${latencyMs}`),
        );
        setMissingModelProfileId(null);
        setMissingModelSuggestion(null);
      } catch (error) {
        if (error instanceof OllamaModelMissingError) {
          setMissingModelProfileId(profileId);
          setMissingModelSuggestion(error.recommendations[0] ?? resolvedModel);
        }

        const message =
          error instanceof Error && error.message
            ? error.message
            : t("completionError");
        showToast(message);
      }
    },
    [resolveProfileForRuntime, runtimeMode, showToast, t],
  );

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;

    const probe = async () => {
      try {
        if (!cancelled) {
          setIsProbingOllama(true);
        }
        const result = await probeLocalOllama();
        if (cancelled) {
          return;
        }
        setOllamaStatus({
          ok: result.ok,
          latencyMs: result.latencyMs,
          error: result.error,
          updatedAt: Date.now(),
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setOllamaStatus({
          ok: false,
          latencyMs: null,
          error: error instanceof Error ? error.message : String(error),
          updatedAt: Date.now(),
        });
      } finally {
        if (!cancelled) {
          setIsProbingOllama(false);
        }
      }
    };

    void probe();
    intervalId = window.setInterval(() => {
      void probe();
    }, 20000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const formatMcpMethods = useCallback(
    (methods: MCPMethod[]): string =>
      methods
        .map((method) =>
          t(MCP_METHOD_LABELS[method] ?? "mcpGenericLabel"),
        )
        .join(" · "),
    [t],
  );

  useEffect(() => {
    let cancelled = false;

    const setupProvider = async () => {
      setProviderReady(false);
      providerRef.current = null;

      try {
        const provider = await createBestProvider({
          allowRemote: networkEnabled,
          onStatusChange: (status) => {
            if (!cancelled) {
              setRuntimeMode(status);
            }
          },
        });

        if (cancelled) {
          return;
        }

        providerRef.current = provider;
        setRuntimeMode(getRuntimeStatus());
      } catch (error) {
        console.error("Failed to initialize AI provider", error);
        if (cancelled) {
          return;
        }
        providerRef.current = createFallbackMemoryProvider();
        setRuntimeMode("none");
      } finally {
        if (!cancelled) {
          setProviderReady(true);
        }
      }
    };

    void setupProvider();

    return () => {
      cancelled = true;
    };
  }, [networkEnabled]);

  const hasActiveContext =
    hasBootstrapped &&
    (activeProjectId === null || typeof activeProjectId === "string");

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        setProjectsLoading(true);
        await ensureSeed();
        const allProjects = await projectsRepo.findAll();
        if (cancelled) {
          return;
        }
        setProjects(allProjects);
      } catch (error) {
        console.error("Failed to initialize chat repositories", error);
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
          setHasBootstrapped(true);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasBootstrapped) {
      return;
    }

    let cancelled = false;

    const fetchThreads = async () => {
      try {
        setThreadsLoading(true);
        const projectThreads = await threadsRepo.findByProject(
          activeProjectId ?? null,
        );
        if (cancelled) {
          return;
        }

        setThreads(projectThreads);

        if (projectThreads.length === 0) {
          setActiveThread(null);
          if (activeProjectId !== null) {
            setMessages([]);
          }
          return;
        }

        const currentThreadId = getActiveThreadId();
        const hasActive =
          currentThreadId !== null &&
          projectThreads.some((thread) => thread.id === currentThreadId);

        if (!hasActive) {
          setActiveThread(projectThreads[0].id);
        }
      } catch (error) {
        console.error("Failed to load threads", error);
      } finally {
        if (!cancelled) {
          setThreadsLoading(false);
        }
      }
    };

    void fetchThreads();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, hasBootstrapped, setActiveThread]);

  useEffect(() => {
    if (!hasBootstrapped) {
      return;
    }

    if (!activeThreadId) {
      previousThreadIdRef.current = null;
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    const threadChanged = previousThreadIdRef.current !== activeThreadId;
    previousThreadIdRef.current = activeThreadId;

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        if (threadChanged) {
          setMessages([]);
        }
        setMessagesLoading(true);
        const threadMessages = await messagesRepo.findByThread(activeThreadId);
        if (cancelled) {
          return;
        }
        setMessages(threadMessages);
      } catch (error) {
        console.error("Failed to load messages", error);
      } finally {
        if (!cancelled) {
          setMessagesLoading(false);
        }
      }
    };

    void fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [activeThreadId, hasBootstrapped]);

  const handleSelectProject = useCallback(
    (projectId: string | null) => {
      setActiveProject(projectId);
    },
    [setActiveProject],
  );

  const handleCreateProject = useCallback(
    async (name: string) => {
      try {
        const project = await projectsRepo.add({ name });
        const generalThread = await threadsRepo.add({
          projectId: project.id,
          title: "General",
        });

        setProjects((prev) => sortByDate([...prev, project]));
        setThreads([generalThread]);
        setMessages([]);
        setActiveProject(project.id);
        setActiveThread(generalThread.id);
      } catch (error) {
        console.error("Failed to create project", error);
      }
    },
    [setActiveProject, setActiveThread],
  );

  const handleCreateThread = useCallback(
    async (title: string) => {
      try {
        const thread = await threadsRepo.add({
          projectId: getActiveProjectId(),
          title,
        });

        setThreads((prev) => sortByDate([...prev, thread]));
        setMessages([]);
        setActiveThread(thread.id);
      } catch (error) {
        console.error("Failed to create thread", error);
      }
    },
    [setActiveThread],
  );

  const handleSelectThread = useCallback(
    (threadId: string) => {
      setActiveThread(threadId);
    },
    [setActiveThread],
  );

  const handleRestartOllama = useCallback(async () => {
    if (!canUseShell) {
      showToast(t("ollamaRestartUnavailable"));
      return;
    }

    try {
      setIsProbingOllama(true);
      await callMcp<MCPExecResult>(
        "mcp.shell",
        "exec",
        {
          command: "ollama",
          args: ["serve"],
        },
        {
          profileId: activeProfileId,
          requireConfirmation: true,
          summary: "restart-ollama",
        },
      );
      showToast(t("ollamaRestartSuccess"));
      const result = await probeLocalOllama();
      setOllamaStatus({
        ok: result.ok,
        latencyMs: result.latencyMs,
        error: result.error,
        updatedAt: Date.now(),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("ollamaRestartError");
      showToast(message);
    } finally {
      setIsProbingOllama(false);
    }
  }, [activeProfileId, canUseShell, showToast, t]);

  const handleViewOllamaLogs = useCallback(async () => {
    if (!canUseShell || !systemPaths) {
      showToast(t("ollamaLogsUnavailable"));
      return;
    }

    const logPath = `${systemPaths.home}/.ollama/logs/serve.log`;

    try {
      const result = await callMcp<MCPExecResult>(
        "mcp.shell",
        "exec",
        {
          command: "tail",
          args: ["-n", "60", logPath],
        },
        {
          profileId: activeProfileId,
          requireConfirmation: true,
          summary: "view-ollama-logs",
        },
      );

      const output = result.stdout.trim();
      const message = output.length > 0 ? output : t("ollamaLogsEmpty");
      window.alert(`${t("ollamaLogsTitle")}\n\n${message}`);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("ollamaLogsError");
      showToast(message);
    }
  }, [activeProfileId, canUseShell, showToast, systemPaths, t]);

  const startCompletion = useCallback(
    (
      threadId: string,
      placeholder: ChatMessage,
      baseMessages: MessageRecord[],
      requestedProfileId: ProfileId,
    ) => {
      const { profileId, model } = resolveProfileForRuntime(
        requestedProfileId,
        runtimeMode,
      );
      const reasoningConfig = getModelProfileById(profileId)?.reasoning;

      setActiveProfileId(profileId);

      const completionStartedAt = getTime();

      console.log("[chat] requesting completion", {
        requestedProfileId,
        profileId,
        runtimeMode,
        model,
        threadId,
      });

      let streamedContent = "";
      const placeholderId = placeholder.id;

      setIsStreaming(true);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === placeholderId
            ? { ...message, content: "", pending: true }
            : message,
        ),
      );

      const provider = providerRef.current;

      if (!provider) {
        console.warn("[chat] no provider available for completion");
        setMessages((prev) =>
          prev.filter((message) => message.id !== placeholderId),
        );
        setIsStreaming(false);
        showToast(t("completionError"));
        return;
      }

      const assistantLanguage = detectAssistantLanguage(baseMessages);
      const maxMessages = getMaxMessagesForProfile(profileId);

      const { prompt, history } = formatPromptFromMessages(baseMessages, {
        language: assistantLanguage,
        maxMessages,
      });

      const tokensIn = estimateTokenCount(prompt);

      const providerMessages: ProviderMessage[] = history.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const systemPrompt = buildSystemPrompt(assistantLanguage, profileId);

      let completion: CompletionHandle;
      const targetModel =
        model ?? getModelProfileById(profileId)?.model ?? "mistral";

      try {
        completion = provider.complete({
          prompt,
          model: targetModel,
          system: systemPrompt,
          messages: providerMessages,
          profileId,
          temperature: reasoningConfig?.temperature,
          maxOutputTokens: reasoningConfig?.maxOutputTokens,
          contextTokens: reasoningConfig?.contextTokens,
          onToken: (token) => {
            if (getActiveThreadId() !== threadId) {
              streamedContent += token;
              return;
            }

            streamedContent += token;
            setMessages((prev) =>
              prev.map((item) =>
                item.id === placeholderId
                  ? { ...item, content: streamedContent, pending: true }
                  : item,
              ),
            );
          },
        });
      } catch (error) {
        console.error("Failed to start completion", error);
        setMessages((prev) =>
          prev.filter((message) => message.id !== placeholderId),
        );
        setIsStreaming(false);
        const message =
          error instanceof Error && error.message
            ? error.message
            : t("completionError");
        showToast(message);
        return;
      }

      setCompletionController(completion.controller);

      completion.response
        .then(async (finalText) => {
          console.log("[chat] completion received");
          setMissingModelProfileId(null);
          setMissingModelSuggestion(null);
          if (getActiveThreadId() !== threadId) {
            return;
          }

          await messagesRepo.add({
            threadId,
            role: "assistant",
            content: finalText,
          });

          if (getActiveThreadId() !== threadId) {
            return;
          }

          const updatedMessages = await messagesRepo.findByThread(threadId);

          if (getActiveThreadId() !== threadId) {
            return;
          }

          setMessages(sortByDate(updatedMessages));

          const latencyMs = Math.max(0, Math.round(getTime() - completionStartedAt));
          const usedModel = completion.model ?? targetModel;
          const tokensOut = estimateTokenCount(finalText);
          void appendMetric({
            ts: Date.now(),
            mode: profileId,
            provider: resolveProviderLabel(runtimeMode),
            model: usedModel,
            latencyMs,
            promptTokens: tokensIn,
            outputTokens: tokensOut,
            success: true,
          });
        })
        .catch((error) => {
          if (isAbortError(error)) {
            console.log("[chat] completion aborted");
          } else if (error instanceof OllamaModelMissingError) {
            setMissingModelProfileId(profileId);
            setMissingModelSuggestion(
              error.recommendations[0] ?? targetModel,
            );
            showToast(error.message);
          } else {
            console.error("Failed to complete assistant message", error);
            const message =
              error instanceof Error && error.message
                ? error.message
                : t("completionError");
            setMissingModelSuggestion(null);
            showToast(message);
          }

          if (getActiveThreadId() !== threadId) {
            return;
          }

          setMessages((prev) =>
            prev.filter((message) => message.id !== placeholderId),
          );

          const latencyMs = Math.max(0, Math.round(getTime() - completionStartedAt));
          const errorMessage =
            error instanceof Error && error.message
              ? error.message
              : typeof error === "string"
                ? error
                : t("completionError");
          const usedModel = completion.model ?? targetModel;
          void appendMetric({
            ts: Date.now(),
            mode: profileId,
            provider: resolveProviderLabel(runtimeMode),
            model: usedModel,
            latencyMs,
            promptTokens: tokensIn,
            outputTokens: 0,
            success: false,
            error: errorMessage,
          });
        })
        .finally(() => {
          setIsStreaming(false);
          setCompletionController(null);
        });
    },
    [
      runtimeMode,
      showToast,
      t,
      setMissingModelProfileId,
      resolveProfileForRuntime,
      setActiveProfileId,
    ],
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!hasActiveContext) {
        return;
      }

      const currentThreadId = getActiveThreadId();
      if (!currentThreadId) {
        return;
      }

      try {
        setIsSending(true);
        const requestedProfileId: ProfileId =
          profileMode === "manual"
            ? manualProfileId
            : chooseProfile({
                tokenCount: estimateTokenCount(content),
                content,
              });

        const message = await messagesRepo.add({
          threadId: currentThreadId,
          role: "user",
          content,
        });

        setMessages((prev) => sortByDate([...prev, message]));

        if (getActiveThreadId() !== currentThreadId) {
          setIsSending(false);
          return;
        }

        const refreshed = await messagesRepo.findByThread(currentThreadId);

        if (getActiveThreadId() !== currentThreadId) {
          setIsSending(false);
          return;
        }

        const placeholder = createAssistantPlaceholder(currentThreadId);
        setMessages(sortByDate([...refreshed, placeholder]));
        setIsSending(false);
        startCompletion(
          currentThreadId,
          placeholder,
          refreshed,
          requestedProfileId,
        );
      } catch (error) {
        console.error("Failed to send message", error);
        setIsSending(false);
      }
    },
    [hasActiveContext, startCompletion, profileMode, manualProfileId],
  );

  const handleAbort = useCallback(() => {
    if (completionController) {
      completionController.abort();
    }
  }, [completionController]);

  useEffect(() => {
    if (!missingModelProfileId) {
      return;
    }

    if (runtimeMode !== "local") {
      setMissingModelProfileId(null);
      return;
    }

    if (profileMode === "manual" && manualProfileId !== missingModelProfileId) {
      setMissingModelProfileId(null);
    }
  }, [
    manualProfileId,
    missingModelProfileId,
    profileMode,
    runtimeMode,
    setMissingModelProfileId,
  ]);

  useEffect(() => {
    if (!hasBootstrapped) {
      return;
    }

    const handleShortcuts = (event: KeyboardEvent) => {
      if (!event.ctrlKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.shiftKey && key === "p") {
        event.preventDefault();
        const name = window.prompt(t("newProject"));
        if (name && name.trim()) {
          void handleCreateProject(name.trim());
        }
        return;
      }

      if (!event.shiftKey && key === "n") {
        event.preventDefault();
        const title = window.prompt(t("newThread"));
        if (title && title.trim()) {
          void handleCreateThread(title.trim());
        }
      }
    };

    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, [handleCreateProject, handleCreateThread, hasBootstrapped, t]);

  const composerDisabled = useMemo(
    () => !hasActiveContext || !activeThreadId || isSending || !providerReady,
    [activeThreadId, hasActiveContext, isSending, providerReady],
  );

  const runtimeLabel = useMemo(() => {
    switch (runtimeMode) {
      case "local":
        return t("runtimeLocal");
      case "remote":
        return t("runtimeRemote");
      default:
        return t("runtimeNone");
    }
  }, [runtimeMode, t]);

  const ollamaIndicator = useMemo(() => {
    if (isProbingOllama) {
      return {
        tone: "warning" as const,
        icon: "🟡",
        message: t("ollamaStatusChecking"),
        latency: null,
      };
    }

    if (ollamaStatus.ok) {
      const latency = ollamaStatus.latencyMs ?? null;
      if (latency !== null && latency > 300) {
        return {
          tone: "warning" as const,
          icon: "🟡",
          message: t("ollamaStatusSlow"),
          latency,
        };
      }

      return {
        tone: "success" as const,
        icon: "🟢",
        message: t("ollamaStatusReady"),
        latency,
      };
    }

    return {
      tone: "error" as const,
      icon: "🔴",
      message: t("ollamaStatusDown"),
      latency: null,
    };
  }, [isProbingOllama, ollamaStatus, t]);

  const showRuntimeGuide = runtimeMode === "none";

  if (!hasBootstrapped) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-slate-500">{t("loading")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full gap-4">
        <SidebarProjects
          projects={projects}
          activeProjectId={activeProjectId}
          isLoading={projectsLoading}
          onSelect={handleSelectProject}
          onCreate={handleCreateProject}
          t={t}
        />
        <div className="flex flex-1 gap-4">
          <ThreadList
            threads={threads}
            activeThreadId={activeThreadId}
            isLoading={threadsLoading}
            hasActiveContext={hasActiveContext}
            onSelect={handleSelectThread}
            onCreate={handleCreateThread}
            t={t}
          />
          <div className="flex flex-1 flex-col">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200">
                {runtimeLabel}
              </span>
              {activeProfile && (
                <span className="flex items-center gap-2 rounded-full border border-blue-300/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-blue-100">
                  {activeProfile.icon ? (
                    <span>{activeProfile.icon}</span>
                  ) : null}
                  <span>{t(activeProfile.label)}</span>
                  {profileMode === "manual" && (
                    <span className="rounded-full bg-blue-500/20 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-200">
                      MANUAL
                    </span>
                  )}
                </span>
              )}
              {showRuntimeGuide && (
                <a
                  href={RUNTIME_GUIDE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-blue-300/40 bg-blue-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-200 transition hover:bg-blue-500/20"
                >
                  {t("runtimeSetupCta")}
                </a>
              )}
              {ollamaIndicator && (
                <span
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${
                    ollamaIndicator.tone === "success"
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                      : ollamaIndicator.tone === "warning"
                        ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                        : "border-red-400/60 bg-red-500/10 text-red-200"
                  }`}
                >
                  <span>{ollamaIndicator.icon}</span>
                  <span>{ollamaIndicator.message}</span>
                  {typeof ollamaIndicator.latency === "number" && (
                    <span className="font-mono text-[10px] lowercase tracking-normal text-slate-200/70">
                      {ollamaIndicator.latency} ms
                    </span>
                  )}
                </span>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRestartOllama}
                  disabled={!canUseShell || isProbingOllama}
                  className="rounded-md border border-blue-300/40 bg-blue-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("ollamaRestart")}
                </button>
                <button
                  type="button"
                  onClick={handleViewOllamaLogs}
                  disabled={!canUseShell}
                  className="rounded-md border border-slate-300/30 bg-slate-800/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("ollamaLogsButton")}
                </button>
              </div>
            </div>
            <ChatView
              messages={messages}
              hasActiveThread={Boolean(activeThreadId)}
              isLoading={messagesLoading}
              t={t}
            />
            <ChatComposer
              disabled={composerDisabled}
              isStreaming={isStreaming}
              onAbort={handleAbort}
              onSend={handleSendMessage}
              runtime={runtimeMode}
              missingProfileId={missingModelProfileId}
              missingModelSuggestion={missingModelSuggestion}
              activeProfileId={activeProfileId}
              onTestProfile={handleTestProfile}
              t={t}
            />
          </div>
        </div>
      </div>
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-red-200 shadow-lg shadow-black/40">
          {toastMessage}
        </div>
      )}
      {(mcpIndicatorGroups.allowed.length > 0 ||
        mcpIndicatorGroups.blocked.length > 0) && (
        <div className="pointer-events-none fixed bottom-6 left-6 z-40 flex flex-col gap-2">
          <div className="pointer-events-none rounded-2xl border border-slate-500/30 bg-slate-900/80 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-slate-300 shadow-lg shadow-black/40">
            <span className="block text-[11px] font-semibold text-slate-400">
              {t("mcpPanelTitle")}
            </span>
            {mcpIndicatorGroups.allowed.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">
                  {t("mcpActiveSection")}
                </span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {mcpIndicatorGroups.allowed.map((indicator) => (
                    <span
                      key={indicator.id}
                      className="pointer-events-auto flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-[2px] text-[11px] font-semibold text-emerald-200"
                    >
                      <span>{indicator.icon}</span>
                      <span>{t(indicator.label)}</span>
                      <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-emerald-200/80">
                        {formatMcpMethods(indicator.methods)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {mcpIndicatorGroups.blocked.length > 0 && (
              <div className="mt-3 border-t border-slate-700/40 pt-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-amber-300">
                  {t("mcpBlockedSection")}
                </span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {mcpIndicatorGroups.blocked.map((indicator) => (
                    <span
                      key={indicator.id}
                      className="pointer-events-auto flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-[2px] text-[11px] font-semibold text-amber-200"
                    >
                      <span>{indicator.icon}</span>
                      <span>{t(indicator.label)}</span>
                      <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-amber-200/80">
                        {formatMcpMethods(indicator.methods)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
