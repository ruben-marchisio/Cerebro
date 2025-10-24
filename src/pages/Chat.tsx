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
} from "../core";
import { OllamaModelMissingError } from "../core/ai/providers/local/ollama";
import {
  getDefaultProfileIdForRuntime,
  getModelProfileById,
} from "../core/ai/modelProfiles";
import {
  getActiveProjectId,
  getActiveThreadId,
  useChatStore,
} from "../store/chatStore";
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

const isProfileId = (
  value: string | null | undefined,
): value is ProfileId => value === "fast" || value === "balanced" || value === "thoughtful";

const resolveProfileId = (
  candidate: string | null | undefined,
): ProfileId => (isProfileId(candidate) ? candidate : DEFAULT_PROFILE_ID);

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
    },
    en: {
      fast:
        "Reply in English, direct, and keep it within 4-6 sentences max. Use short bullets for steps. Skip repeating context or long sign-offs.",
      balanced:
        "Reply in English, clearly, using 2-4 paragraphs. Add a short example if it helps. Avoid unnecessary lists.",
      thoughtful:
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

  const activeProjectId = useChatStore((state) => state.activeProjectId);
  const activeThreadId = useChatStore((state) => state.activeThreadId);
  const setActiveProject = useChatStore((state) => state.setActiveProject);
  const setActiveThread = useChatStore((state) => state.setActiveThread);
  const selectedModelId = useSettingsStore(
    (state) => state.settings.model,
  );

  const selectedModelProfile = useMemo(
    () => getModelProfileById(selectedModelId),
    [selectedModelId],
  );

  const remoteModelName = useMemo(() => {
    if (runtimeMode !== "remote") {
      return undefined;
    }

    if (selectedModelProfile?.runtime === "remote") {
      return selectedModelProfile.model;
    }

    const fallbackProfile = getModelProfileById(
      getDefaultProfileIdForRuntime("remote"),
    );

    return fallbackProfile?.model ?? "deepseek-1.3";
  }, [runtimeMode, selectedModelProfile]);

  const localModelName = useMemo(() => {
    if (runtimeMode !== "local") {
      return undefined;
    }

    if (selectedModelProfile?.runtime === "local") {
      return selectedModelProfile.model;
    }

    const fallbackProfile = getModelProfileById(
      getDefaultProfileIdForRuntime("local"),
    );

    return fallbackProfile?.model;
  }, [runtimeMode, selectedModelProfile]);

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

  useEffect(() => {
    let cancelled = false;

    const setupProvider = async () => {
      try {
        const provider = await createBestProvider();
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
  }, []);

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

  const startCompletion = useCallback(
    (threadId: string, placeholder: ChatMessage, baseMessages: MessageRecord[]) => {
      const profileId = resolveProfileId(selectedModelProfile?.id);
      const reasoningConfig = getModelProfileById(profileId)?.reasoning;
      console.log("[chat] requesting completion", {
        profileId,
        runtimeMode,
        model: runtimeMode === "remote" ? remoteModelName : localModelName,
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

      const providerMessages: ProviderMessage[] = history.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const systemPrompt = buildSystemPrompt(assistantLanguage, profileId);

      let completion: CompletionHandle;

      try {
        completion = provider.complete({
          prompt,
          model: runtimeMode === "remote" ? remoteModelName : localModelName,
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
        })
        .catch((error) => {
          if (isAbortError(error)) {
            console.log("[chat] completion aborted");
          } else if (error instanceof OllamaModelMissingError) {
            if (runtimeMode === "local" && selectedModelId) {
              setMissingModelProfileId(selectedModelId);
            }
            showToast(error.message);
          } else {
            console.error("Failed to complete assistant message", error);
            const message =
              error instanceof Error && error.message
                ? error.message
                : t("completionError");
            showToast(message);
          }

          if (getActiveThreadId() !== threadId) {
            return;
          }

          setMessages((prev) =>
            prev.filter((message) => message.id !== placeholderId),
          );
        })
        .finally(() => {
          setIsStreaming(false);
          setCompletionController(null);
        });
    },
    [
      remoteModelName,
      runtimeMode,
      selectedModelId,
      showToast,
      t,
      localModelName,
      setMissingModelProfileId,
      selectedModelProfile,
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
        startCompletion(currentThreadId, placeholder, refreshed);
      } catch (error) {
        console.error("Failed to send message", error);
        setIsSending(false);
      }
    },
    [hasActiveContext, startCompletion],
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

    if (
      runtimeMode !== "local" ||
      selectedModelId !== missingModelProfileId
    ) {
      setMissingModelProfileId(null);
    }
  }, [
    missingModelProfileId,
    runtimeMode,
    selectedModelId,
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
    </>
  );
}
