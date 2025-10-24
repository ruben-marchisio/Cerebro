import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

import { getEnv } from "../../core";
import type { TranslationKey } from "../../i18n";
import { useSettingsStore } from "../../store/settingsStore";

type Translator = (key: TranslationKey) => string;

type ChatComposerProps = {
  disabled: boolean;
  isStreaming: boolean;
  onAbort: () => void;
  onSend: (content: string) => Promise<void> | void;
  t: Translator;
};

export default function ChatComposer({
  disabled,
  isStreaming,
  onAbort,
  onSend,
  t,
}: ChatComposerProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const model = useSettingsStore((state) => state.settings.model);
  const updateModel = useSettingsStore((state) => state.setModel);

  const { deepseekApiKey } = getEnv();
  const canUseAdvancedModel = useMemo(
    () => Boolean(deepseekApiKey),
    [deepseekApiKey],
  );

  useEffect(() => {
    if (!canUseAdvancedModel && model === "deepseek-6.7") {
      void updateModel("deepseek-1.3");
    }
  }, [canUseAdvancedModel, model, updateModel]);

  const models = useMemo(
    () => [
      { value: "deepseek-1.3", label: "deepseek-1.3", disabled: false },
      {
        value: "deepseek-6.7",
        label: "deepseek-6.7",
        disabled: !canUseAdvancedModel,
      },
    ],
    [canUseAdvancedModel],
  );

  const resetComposer = () => {
    setMessage("");
  };

  const submitMessage = async () => {
    const trimmed = message.trim();

    if (!trimmed || disabled || isSubmitting || isStreaming) {
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitMessage();
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" && isStreaming) {
      event.preventDefault();
      onAbort();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      await submitMessage();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4"
    >
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={t("composerPlaceholder")}
        rows={3}
        disabled={disabled || isSubmitting}
        onKeyDown={handleKeyDown}
        className="min-h-[88px] w-full resize-none rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none transition disabled:opacity-60 focus:border-white/30"
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <label htmlFor="model-selector" className="font-semibold uppercase tracking-[0.3em]">
            {t("modelLabel")}
          </label>
          <select
            id="model-selector"
            value={model}
            onChange={(event) => {
              const next = event.target.value;
              if (!canUseAdvancedModel && next === "deepseek-6.7") {
                return;
              }
              void updateModel(next);
            }}
            className="rounded-lg border border-white/10 bg-slate-950/80 px-3 py-1 text-xs text-slate-200 outline-none transition hover:border-white/30 focus:border-white/40 disabled:opacity-60"
          >
            {models.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isStreaming && (
            <button
              type="button"
              onClick={onAbort}
              className="rounded-xl border border-red-400/60 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-red-200 transition hover:bg-red-500/20"
            >
              {t("stop")}
            </button>
          )}
          <button
            type="submit"
            disabled={disabled || isSubmitting || !message.trim() || isStreaming}
            className="rounded-xl bg-blue-500/80 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-blue-400/80 disabled:opacity-60"
          >
            {isSubmitting ? "..." : t("send")}
          </button>
        </div>
      </div>
      {!canUseAdvancedModel && (
        <p className="text-xs text-slate-500">
          {t("modelUnavailable")}
        </p>
      )}
    </form>
  );
}
