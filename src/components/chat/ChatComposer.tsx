import { FormEvent, useState } from "react";

import type { TranslationKey } from "../../i18n";

type Translator = (key: TranslationKey) => string;

type ChatComposerProps = {
  disabled: boolean;
  onSend: (content: string) => Promise<void> | void;
  t: Translator;
};

export default function ChatComposer({
  disabled,
  onSend,
  t,
}: ChatComposerProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetComposer = () => {
    setMessage("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();

    if (!trimmed || disabled) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onSend(trimmed);
      resetComposer();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex items-end gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4"
    >
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={t("composerPlaceholder")}
        rows={2}
        disabled={disabled || isSubmitting}
        className="flex-1 resize-none rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none transition disabled:opacity-60 focus:border-white/30"
      />
      <button
        type="submit"
        disabled={disabled || isSubmitting || !message.trim()}
        className="rounded-xl bg-blue-500/80 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-blue-400/80 disabled:opacity-60"
      >
        {isSubmitting ? "..." : t("send")}
      </button>
    </form>
  );
}
