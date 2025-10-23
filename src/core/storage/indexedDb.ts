export const DB_NAME = "cerebro-chat";
export const DB_VERSION = 1;

export const PROJECTS_STORE = "projects";
export const THREADS_STORE = "threads";
export const MESSAGES_STORE = "messages";

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
};

export type ThreadRecord = {
  id: string;
  projectId: string | null;
  title: string;
  createdAt: string;
};

export type MessageRecord = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

const ensureWindow = () => {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in browser environments");
  }
};

const setupDatabase = (database: IDBDatabase) => {
  if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
    database.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
  }

  if (!database.objectStoreNames.contains(THREADS_STORE)) {
    const store = database.createObjectStore(THREADS_STORE, { keyPath: "id" });
    store.createIndex("by_project", "projectId", { unique: false });
  }

  if (!database.objectStoreNames.contains(MESSAGES_STORE)) {
    const store = database.createObjectStore(MESSAGES_STORE, {
      keyPath: "id",
    });
    store.createIndex("by_thread", "threadId", { unique: false });
    store.createIndex("by_thread_created_at", ["threadId", "createdAt"], {
      unique: false,
    });
  }
};

export const initDB = (): Promise<IDBDatabase> => {
  ensureWindow();

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        setupDatabase(database);
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
        };
        resolve(database);
      };

      request.onerror = () => {
        reject(request.error ?? new Error("Failed to open IndexedDB"));
      };

      request.onblocked = () => {
        reject(
          new Error("IndexedDB upgrade blocked by another connection"),
        );
      };
    });
  }

  return dbPromise;
};

const wrapRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });

export const runTransaction = async <Result>(
  storeName: string,
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => Promise<Result> | Result,
): Promise<Result> => {
  const database = await initDB();
  return new Promise<Result>((resolve, reject) => {
    const tx = database.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result: Promise<Result> | Result;

    try {
      result = executor(store);
    } catch (error) {
      reject(error);
      tx.abort();
      return;
    }

    const finalize = (value: Result) => resolve(value);

    tx.oncomplete = () => {
      if (result instanceof Promise) {
        result.then(finalize).catch(reject);
      } else {
        finalize(result);
      }
    };

    tx.onerror = () => {
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    };

    tx.onabort = () => {
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    };
  });
};

export const getAllFromStore = async <T>(
  store: IDBObjectStore,
): Promise<T[]> => {
  const request = store.getAll();
  return wrapRequest(request) as Promise<T[]>;
};

export const getByIndex = async <T>(
  store: IDBObjectStore,
  indexName: string,
  query: IDBValidKey | IDBKeyRange,
): Promise<T[]> => {
  const index = store.index(indexName);
  const request = index.getAll(query);
  return wrapRequest(request) as Promise<T[]>;
};

export const getOneByKey = async <T>(
  store: IDBObjectStore,
  key: IDBValidKey,
): Promise<T | undefined> => {
  const request = store.get(key);
  const result = await wrapRequest(request);
  return result === undefined ? undefined : (result as T);
};

export const putRecord = async <T>(store: IDBObjectStore, value: T) => {
  const request = store.put(value);
  await wrapRequest(request);
};

export const deleteRecord = async (store: IDBObjectStore, key: IDBValidKey) => {
  const request = store.delete(key);
  await wrapRequest(request);
};
