import {
  deleteRecord,
  getAllFromStore,
  getByIndex,
  getOneByKey,
  putRecord,
  runTransaction,
  THREADS_STORE,
  ThreadRecord,
} from "../storage/indexedDb";

export type CreateThreadInput = {
  projectId: string | null;
  title: string;
};

export type UpdateThreadInput = Partial<
  Omit<ThreadRecord, "id" | "projectId" | "createdAt">
>;

const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `thread-${Math.random().toString(36).slice(2, 11)}`;
};

const withMetadata = (payload: CreateThreadInput): ThreadRecord => ({
  id: generateId(),
  projectId: payload.projectId ?? null,
  title: payload.title,
  createdAt: new Date().toISOString(),
});

export const add = async (
  payload: CreateThreadInput,
): Promise<ThreadRecord> => {
  const record = withMetadata(payload);

  return runTransaction<ThreadRecord>(
    THREADS_STORE,
    "readwrite",
    async (store) => {
      await putRecord(store, record);
      return record;
    },
  );
};

export const findByProject = async (
  projectId: string | null,
): Promise<ThreadRecord[]> =>
  runTransaction<ThreadRecord[]>(THREADS_STORE, "readonly", async (store) => {
    if (projectId === null) {
      const records = await getAllFromStore<ThreadRecord>(store);
      return records
        .filter((thread) => thread.projectId === null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    const records = await getByIndex<ThreadRecord>(
      store,
      "by_project",
      projectId,
    );
    return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });

export const update = async (
  id: string,
  changes: UpdateThreadInput,
): Promise<ThreadRecord> =>
  runTransaction<ThreadRecord>(
    THREADS_STORE,
    "readwrite",
    async (store) => {
      const existing = await getOneByKey<ThreadRecord>(store, id);

      if (!existing) {
        throw new Error(`Thread with id ${id} not found`);
      }

      const updated: ThreadRecord = {
        ...existing,
        ...changes,
        id: existing.id,
        projectId: existing.projectId,
        createdAt: existing.createdAt,
      };

      await putRecord(store, updated);
      return updated;
    },
  );

export const remove = async (id: string): Promise<void> =>
  runTransaction<void>(THREADS_STORE, "readwrite", async (store) => {
    await deleteRecord(store, id);
  });
