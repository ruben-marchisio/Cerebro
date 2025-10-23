import { useCallback, useEffect, useMemo, useState } from "react";

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
} from "../core";
import {
  getActiveProjectId,
  getActiveThreadId,
  useChatStore,
} from "../store/chatStore";
import type { TranslationKey } from "../i18n";

type Translator = (key: TranslationKey) => string;

type ChatProps = {
  t: Translator;
};

type ChatMessage = MessageRecord & {
  pending?: boolean;
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

export default function Chat({ t }: ChatProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [threads, setThreads] = useState<ThreadRecord[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const activeProjectId = useChatStore((state) => state.activeProjectId);
  const activeThreadId = useChatStore((state) => state.activeThreadId);
  const setActiveProject = useChatStore((state) => state.setActiveProject);
  const setActiveThread = useChatStore((state) => state.setActiveThread);

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
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    let cancelled = false;

    const fetchMessages = async () => {
      try {
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
          return;
        }

        const refreshed = await messagesRepo.findByThread(currentThreadId);

        if (getActiveThreadId() !== currentThreadId) {
          return;
        }

        const placeholder = createAssistantPlaceholder(currentThreadId);
        setMessages(sortByDate([...refreshed, placeholder]));
      } catch (error) {
        console.error("Failed to send message", error);
      } finally {
        setIsSending(false);
      }
    },
    [hasActiveContext],
  );

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
    () => !hasActiveContext || !activeThreadId || isSending,
    [activeThreadId, hasActiveContext, isSending],
  );

  if (!hasBootstrapped) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-slate-500">{t("loading")}</p>
      </div>
    );
  }

  return (
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
          <ChatView
            messages={messages}
            hasActiveThread={Boolean(activeThreadId)}
            isLoading={messagesLoading}
            t={t}
          />
          <ChatComposer
            disabled={composerDisabled}
            onSend={handleSendMessage}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}
