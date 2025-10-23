import {
  getByIndex,
  putRecord,
  runTransaction,
  MESSAGES_STORE,
  MessageRecord,
} from "./index";

export type CreateMessageInput = {
  threadId: string;
  role: MessageRecord["role"];
  content: string;
};

const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `message-${Math.random().toString(36).slice(2, 11)}`;
};

const withMetadata = (payload: CreateMessageInput): MessageRecord => ({
  id: generateId(),
  threadId: payload.threadId,
  role: payload.role,
  content: payload.content,
  createdAt: new Date().toISOString(),
});

export const add = async (
  payload: CreateMessageInput,
): Promise<MessageRecord> => {
  const record = withMetadata(payload);

  return runTransaction<MessageRecord>(
    MESSAGES_STORE,
    "readwrite",
    async (store) => {
      await putRecord(store, record);
      return record;
    },
  );
};

export const findByThread = async (
  threadId: string,
): Promise<MessageRecord[]> =>
  runTransaction<MessageRecord[]>(MESSAGES_STORE, "readonly", async (store) => {
    const records = await getByIndex<MessageRecord>(store, "by_thread", threadId);
    return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });
