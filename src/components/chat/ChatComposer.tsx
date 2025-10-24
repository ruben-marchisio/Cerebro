import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

import { getEnv } from "../../core";
import type { RuntimeStatus } from "../../core/ai";
import {
  getDefaultProfileIdForRuntime,
  getModelProfilesByRuntime,
  type ModelRuntime,
} from "../../core/ai/modelProfiles";
import type { TranslationKey } from "../../i18n";
import { useSettingsStore } from "../../store/settingsStore";

type Translator = (key: TranslationKey) => string;

type ChatComposerProps = {
  disabled: boolean;
  isStreaming: boolean;
  onAbort: () => void;
  onSend: (content: string) => Promise<void> | void;
  runtime: RuntimeStatus;
  missingProfileId?: string | null;
  t: Translator;
};

export default function ChatComposer({
  disabled,
  isStreaming,
  onAbort,
  onSend,
  runtime,
  missingProfileId = null,
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

  const runtimeCategory: ModelRuntime =
    runtime === "local" ? "local" : "remote";

  const { profiles, disabledProfileIds } = useMemo(() => {
    const available = getModelProfilesByRuntime(runtimeCategory);

    if (runtimeCategory !== "remote") {
      return {
        profiles: available,
        disabledProfileIds: new Set<string>(),
      };
    }

    if (canUseAdvancedModel) {
      return {
        profiles: available,
        disabledProfileIds: new Set<string>(),
      };
    }

    const disabled = new Set<string>(
      available
        .filter((profile) => profile.requiresAdvanced)
        .map((profile) => profile.id),
    );

    return {
      profiles: available,
      disabledProfileIds: disabled,
    };
  }, [canUseAdvancedModel, runtimeCategory]);

  const selectedProfile = useMemo(
    () =>
      profiles.find(
        (profile) =>
          profile.id === model && !disabledProfileIds.has(profile.id),
      ),
    [model, profiles, disabledProfileIds],
  );

  const selectedProfileReasoningText = useMemo(() => {
    const reasoning = selectedProfile?.reasoning;
    if (!reasoning) {
      return null;
    }
    const descriptors = [reasoning.memoryContext, reasoning.thoughtStyle]
      .filter(Boolean)
      .join(" • ");
    const metrics = `${reasoning.contextTokens} tokens • temp ${reasoning.temperature}`;
    return descriptors ? `${descriptors} • ${metrics}` : metrics;
  }, [selectedProfile]);

  useEffect(() => {
    if (!profiles.length) {
      return;
    }

    const isDisabled = disabledProfileIds.has(model);
    if (selectedProfile && !isDisabled) {
      return;
    }

    const preferredId = getDefaultProfileIdForRuntime(runtimeCategory);
    const preferredProfile = profiles.find(
      (profile) =>
        profile.id === preferredId && !disabledProfileIds.has(profile.id),
    );

    const fallbackProfile =
      preferredProfile ??
      profiles.find((profile) => !disabledProfileIds.has(profile.id)) ??
      profiles[0];

    if (fallbackProfile && fallbackProfile.id !== model) {
      void updateModel(fallbackProfile.id);
    }
  }, [
    disabledProfileIds,
    model,
    profiles,
    runtimeCategory,
    selectedProfile,
    updateModel,
  ]);

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
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-2 text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-[0.3em] text-slate-300">
            {t("modelLabel")}
          </span>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => {
              const isDisabled = disabledProfileIds.has(profile.id);
              const isActive = profile.id === model && !isDisabled;
              const highlightMissing =
                !isDisabled && missingProfileId === profile.id;
              const reasoning = profile.reasoning;
              const tooltipParts: string[] = [];
              if (reasoning?.memoryContext) {
                tooltipParts.push(reasoning.memoryContext);
              }
              if (reasoning?.thoughtStyle) {
                tooltipParts.push(reasoning.thoughtStyle);
              }
              if (typeof reasoning?.contextTokens === "number") {
                tooltipParts.push(`${reasoning.contextTokens} tokens`);
              }
              if (typeof reasoning?.temperature === "number") {
                tooltipParts.push(`temp ${reasoning.temperature}`);
              }
              const modeTooltip =
                tooltipParts.length > 0 ? tooltipParts.join(" • ") : undefined;
              const baseClasses =
                "flex items-center gap-1 rounded-xl border px-3 py-1 text-xs transition focus:outline-none focus:ring-1 focus:ring-blue-300/60";
              const visualClasses = highlightMissing
                ? "border-red-400/60 bg-red-500/20 text-red-100"
                : isActive
                  ? "border-blue-300/60 bg-blue-500/15 text-blue-100"
                  : "border-white/10 bg-slate-950/60 text-slate-300";
              const hoverClasses =
                !highlightMissing && !isActive && !isDisabled
                  ? "hover:border-white/20 hover:text-slate-100"
                  : "";
              const stateClasses = isDisabled
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer";
              const buttonClasses = [
                baseClasses,
                visualClasses,
                hoverClasses,
                stateClasses,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={profile.id}
                  type="button"
                  className={buttonClasses}
                  onClick={() => {
                    if (isDisabled || profile.id === model) {
                      return;
                    }
                    void updateModel(profile.id);
                  }}
                  disabled={isDisabled}
                  aria-pressed={isActive}
                  title={modeTooltip}
                >
                  {profile.icon ? <span>{profile.icon}</span> : null}
                  <span>{t(profile.label)}</span>
                </button>
              );
            })}
          </div>
          {missingProfileId === "fast" && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-100">
              <span>{t("modelFastUnavailable")}</span>
              <button
                type="button"
                onClick={() => {
                  void updateModel("balanced");
                }}
                className="rounded-lg border border-red-300/50 bg-red-500/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-red-50 transition hover:bg-red-500/40"
              >
                {t("modelSwitchToBalanced")}
              </button>
            </div>
          )}
          {selectedProfile && (
            <p className="text-[11px] text-slate-400">
              {selectedProfile.icon ? (
                <span className="mr-1 align-middle">{selectedProfile.icon}</span>
              ) : null}
              {t(selectedProfile.description)}
            </p>
          )}
          {selectedProfileReasoningText && (
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              {selectedProfileReasoningText}
            </p>
          )}
          {runtimeCategory === "remote" && !canUseAdvancedModel && (
            <p className="text-[11px] text-slate-500">
              {t("modelUnavailable")}
            </p>
          )}
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
    </form>
  );
}
