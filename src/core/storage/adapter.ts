export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  save(): Promise<void>;
}

export const createMemoryStorageAdapter = (): StorageAdapter => {
  const state = new Map<string, unknown>();

  return {
    async get<T>(key: string): Promise<T | null> {
      return (state.get(key) as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      state.set(key, value);
    },
    async save(): Promise<void> {
      // No-op for in-memory adapter.
    },
  };
};

export const createBrowserStorageAdapter = (): StorageAdapter => {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return createMemoryStorageAdapter();
  }

  const fallback = new Map<string, unknown>();

  return {
    async get<T>(key: string): Promise<T | null> {
      if (fallback.has(key)) {
        return (fallback.get(key) as T | undefined) ?? null;
      }

      try {
        const stored = window.localStorage.getItem(key);
        if (stored === null) {
          return null;
        }
        return JSON.parse(stored) as T;
      } catch {
        return (fallback.get(key) as T | undefined) ?? null;
      }
    },
    async set<T>(key: string, value: T): Promise<void> {
      try {
        const serialized = JSON.stringify(value);
        window.localStorage.setItem(key, serialized);
        fallback.delete(key);
      } catch {
        fallback.set(key, value);
      }
    },
    async save(): Promise<void> {
      // LocalStorage writes synchronously, nothing else to do.
    },
  };
};
