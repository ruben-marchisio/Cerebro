import type { MessageRecord } from "../../core";
import type { TranslationKey } from "../../i18n";

type Translator = (key: TranslationKey) => string;

const roleTranslationKey: Record<
  MessageRecord["role"],
  TranslationKey
> = {
  user: "roleUser",
  assistant: "roleAssistant",
  system: "roleSystem",
};

type ChatViewProps = {
  messages: Array<MessageRecord & { pending?: boolean }>;
  hasActiveThread: boolean;
  isLoading: boolean;
  t: Translator;
};

export default function ChatView({
  messages,
  hasActiveThread,
  isLoading,
  t,
}: ChatViewProps) {
  return (
    <section className="flex h-full flex-1 flex-col rounded-2xl border border-white/10 bg-slate-900/60">
      <div className="flex-1 space-y-4 overflow-y-auto p-6 pr-4">
        {isLoading ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-400">
            {t("loading")}
          </p>
        ) : hasActiveThread ? (
          messages.length > 0 ? (
            messages.map((message) => {
              const isUser = message.role === "user";
              const isSystem = message.role === "system";
              const isPending = message.pending === true;

              const containerClass = [
                "flex",
                isSystem ? "justify-center" : isUser ? "justify-end" : "justify-start",
              ].join(" ");

              const bubbleClass = [
                "max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                isUser
                  ? "bg-blue-500/20 text-blue-100"
                  : isSystem
                    ? "bg-amber-500/10 text-amber-100"
                    : "bg-white/5 text-slate-200",
                isPending ? "italic opacity-80" : "",
              ].join(" ");

              const roleLabel = t(roleTranslationKey[message.role]);

              const content = isPending
                ? t("assistantPlaceholder")
                : message.content;

              return (
                <div key={message.id} className={containerClass}>
                  <div className={bubbleClass}>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {roleLabel}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap">{content}</p>
                    {!isPending && (
                      <span className="mt-2 block text-[10px] uppercase tracking-[0.3em] text-slate-500">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-400">
              {t("emptyMessages")}
            </p>
          )
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-400">
            {t("selectThread")}
          </p>
        )}
      </div>
    </section>
  );
}
