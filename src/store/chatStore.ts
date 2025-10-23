import { create } from "zustand";

type ChatState = {
  activeProjectId: string | null;
  activeThreadId: string | null;
  setActiveProject: (projectId: string | null) => void;
  setActiveThread: (threadId: string | null) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  activeProjectId: null,
  activeThreadId: null,
  setActiveProject: (projectId) =>
    set((state) => ({
      activeProjectId: projectId,
      activeThreadId:
        projectId && state.activeProjectId === projectId
          ? state.activeThreadId
          : null,
    })),
  setActiveThread: (threadId) =>
    set(() => ({
      activeThreadId: threadId,
    })),
}));

export const getActiveProjectId = (): string | null =>
  useChatStore.getState().activeProjectId;

export const getActiveThreadId = (): string | null =>
  useChatStore.getState().activeThreadId;

export const setActiveProject = (projectId: string | null): void =>
  useChatStore.getState().setActiveProject(projectId);

export const setActiveThread = (threadId: string | null): void =>
  useChatStore.getState().setActiveThread(threadId);
