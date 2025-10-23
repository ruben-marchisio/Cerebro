import { FormEvent, useEffect, useState } from "react";

import type { ThreadRecord } from "../../core";
import type { TranslationKey } from "../../i18n";

type Translator = (key: TranslationKey) => string;

type ThreadListProps = {
  threads: ThreadRecord[];
  activeThreadId: string | null;
  hasActiveContext: boolean;
  onSelect: (threadId: string) => void;
  onCreate: (title: string) => Promise<void> | void;
  t: Translator;
};

export default function ThreadList({
  threads,
  activeThreadId,
  hasActiveContext,
  onSelect,
  onCreate,
  t,
}: ThreadListProps) {
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!hasActiveContext) {
      setTitle("");
    }
  }, [hasActiveContext]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !hasActiveContext) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreate(trimmed);
      setTitle("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="flex w-64 flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <header>
        <h2 className="text-sm font-semibold uppercase tracking-[0.27em] text-slate-400">
          {t("newThread")}
        </h2>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {hasActiveContext ? (
          threads.length > 0 ? (
            threads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onSelect(thread.id)}
                  className={[
                    "rounded-lg px-3 py-2 text-left text-sm transition",
                    isActive
                      ? "bg-blue-500/20 text-blue-100"
                      : "bg-white/5 text-slate-200 hover:bg-white/10",
                  ].join(" ")}
                >
                  <span className="block truncate">{thread.title}</span>
                </button>
              );
            })
          ) : (
            <p className="text-xs text-slate-500">
              {t("emptyThreadHelp")}
            </p>
          )
        ) : (
          <p className="text-xs text-slate-500">
            {t("projectsTitle")}
          </p>
        )}
      </div>
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("newThread")}
          disabled={!hasActiveContext}
          className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none transition disabled:opacity-60 focus:border-white/30"
        />
        <button
          type="submit"
          disabled={!hasActiveContext || isSubmitting || !title.trim()}
          className="rounded-lg bg-blue-500/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-blue-400/80 disabled:opacity-60"
        >
          {isSubmitting ? "..." : t("newThread")}
        </button>
      </form>
    </section>
  );
}
