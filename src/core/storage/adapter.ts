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
      // Persistencia pendiente.
    },
  };
};
