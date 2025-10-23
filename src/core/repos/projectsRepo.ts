import {
  deleteRecord,
  getAllFromStore,
  getOneByKey,
  PROJECTS_STORE,
  ProjectRecord,
  putRecord,
  runTransaction,
} from "../storage/indexedDb";

export type CreateProjectInput = {
  name: string;
};

export type UpdateProjectInput = Partial<
  Omit<ProjectRecord, "id" | "createdAt">
>;

const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `project-${Math.random().toString(36).slice(2, 11)}`;
};

const withMetadata = (name: string): ProjectRecord => ({
  id: generateId(),
  name,
  createdAt: new Date().toISOString(),
});

export const add = async (
  payload: CreateProjectInput,
): Promise<ProjectRecord> => {
  const record = withMetadata(payload.name);

  return runTransaction<ProjectRecord>(
    PROJECTS_STORE,
    "readwrite",
    async (store) => {
      await putRecord(store, record);
      return record;
    },
  );
};

export const findAll = async (): Promise<ProjectRecord[]> =>
  runTransaction<ProjectRecord[]>(PROJECTS_STORE, "readonly", async (store) => {
    const records = await getAllFromStore<ProjectRecord>(store);
    return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });

export const update = async (
  id: string,
  changes: UpdateProjectInput,
): Promise<ProjectRecord> =>
  runTransaction<ProjectRecord>(
    PROJECTS_STORE,
    "readwrite",
    async (store) => {
      const existing = await getOneByKey<ProjectRecord>(store, id);

      if (!existing) {
        throw new Error(`Project with id ${id} not found`);
      }

      const updated: ProjectRecord = {
        ...existing,
        ...changes,
        id: existing.id,
        createdAt: existing.createdAt,
      };

      await putRecord(store, updated);
      return updated;
    },
  );

export const remove = async (id: string): Promise<void> =>
  runTransaction<void>(PROJECTS_STORE, "readwrite", async (store) => {
    await deleteRecord(store, id);
  });
