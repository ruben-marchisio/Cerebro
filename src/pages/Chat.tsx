import { useEffect, useMemo, useState } from "react";

import ChatComposer from "../components/chat/ChatComposer";
import ChatView from "../components/chat/ChatView";
import SidebarProjects from "../components/chat/SidebarProjects";
import ThreadList from "../components/chat/ThreadList";
import {
  initDB,
  MessageRecord,
  messagesRepo,
  ProjectRecord,
  projectsRepo,
  ThreadRecord,
  threadsRepo,
} from "../db";
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

const sortByDate = <T extends { createdAt: string }>(collection: T[]): T[] =>
  [...collection].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export default function Chat({ t }: ChatProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [threads, setThreads] = useState<ThreadRecord[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const activeProjectId = useChatStore((state) => state.activeProjectId);
  const activeThreadId = useChatStore((state) => state.activeThreadId);
  const setActiveProject = useChatStore((state) => state.setActiveProject);
  const setActiveThread = useChatStore((state) => state.setActiveThread);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await initDB();
        const allProjects = await projectsRepo.findAll();
        if (cancelled) {
          return;
        }
        setProjects(allProjects);

        if (allProjects.length > 0 && !getActiveProjectId()) {
          setActiveProject(allProjects[0].id);
        }
      } catch (error) {
        console.error("Failed to initialize chat repositories", error);
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [setActiveProject]);

  useEffect(() => {
    if (!activeProjectId) {
      setThreads([]);
      setMessages([]);
      return;
    }

    let cancelled = false;

    const fetchThreads = async () => {
      try {
        const projectThreads = await threadsRepo.findByProject(activeProjectId);
        if (cancelled) {
          return;
        }

        setThreads(projectThreads);

        if (projectThreads.length === 0) {
          setActiveThread(null);
          setMessages([]);
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
      }
    };

    void fetchThreads();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, setActiveThread]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const threadMessages = await messagesRepo.findByThread(activeThreadId);
        if (cancelled) {
          return;
        }
        setMessages(threadMessages);
      } catch (error) {
        console.error("Failed to load messages", error);
      }
    };

    void fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [activeThreadId]);

  const handleSelectProject = (projectId: string) => {
    setActiveProject(projectId);
  };

  const handleCreateProject = async (name: string) => {
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
  };

  const handleCreateThread = async (title: string) => {
    if (!activeProjectId) {
      return;
    }

    try {
      const thread = await threadsRepo.add({
        projectId: activeProjectId,
        title,
      });

      setThreads((prev) => sortByDate([...prev, thread]));
      setMessages([]);
      setActiveThread(thread.id);
    } catch (error) {
      console.error("Failed to create thread", error);
    }
  };

  const handleSelectThread = (threadId: string) => {
    setActiveThread(threadId);
  };

  const handleSendMessage = async (content: string) => {
    if (!activeThreadId) {
      return;
    }

    try {
      setIsSending(true);
      const message = await messagesRepo.add({
        threadId: activeThreadId,
        role: "user",
        content,
      });

      setMessages((prev) => sortByDate([...prev, message]));
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsSending(false);
    }
  };

  const composerDisabled = useMemo(
    () => !activeThreadId || isSending || !isReady,
    [activeThreadId, isSending, isReady],
  );

  if (!isReady) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-slate-500">Cargando chat...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      <SidebarProjects
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={handleSelectProject}
        onCreate={handleCreateProject}
        t={t}
      />
      <div className="flex flex-1 gap-4">
        <ThreadList
          threads={threads}
          activeThreadId={activeThreadId}
          hasActiveProject={Boolean(activeProjectId)}
          onSelect={handleSelectThread}
          onCreate={handleCreateThread}
          t={t}
        />
        <div className="flex flex-1 flex-col">
          <ChatView
            messages={messages}
            hasActiveThread={Boolean(activeThreadId)}
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
