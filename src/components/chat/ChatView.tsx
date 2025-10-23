import type { MessageRecord } from "../../db";
import type { TranslationKey } from "../../i18n";

type Translator = (key: TranslationKey) => string;

type ChatViewProps = {
  messages: MessageRecord[];
  hasActiveThread: boolean;
  t: Translator;
};

const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

export default function ChatView({
  messages,
  hasActiveThread,
  t,
}: ChatViewProps) {
  return (
    <section className="flex h-full flex-1 flex-col rounded-2xl border border-white/10 bg-slate-900/60">
      <div className="flex-1 space-y-4 overflow-y-auto p-6 pr-4">
        {hasActiveThread ? (
          messages.length > 0 ? (
            messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={[
                    "flex",
                    isUser ? "justify-end" : "justify-start",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                      isUser
                        ? "bg-blue-500/20 text-blue-100"
                        : "bg-white/5 text-slate-200",
                    ].join(" ")}
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {capitalize(message.role)}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
                    <span className="mt-2 block text-[10px] uppercase tracking-[0.3em] text-slate-500">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-400">
              {t("emptyThreadHelp")}
            </p>
          )
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-400">
            {t("projectsTitle")}
          </p>
        )}
      </div>
    </section>
  );
}
