import { FormEvent, useState } from "react";

import type { ProjectRecord } from "../../core";
import type { TranslationKey } from "../../i18n";

type Translator = (key: TranslationKey) => string;

type SidebarProjectsProps = {
  projects: ProjectRecord[];
  activeProjectId: string | null;
  onSelect: (projectId: string | null) => void;
  onCreate: (name: string) => Promise<void> | void;
  t: Translator;
};

export default function SidebarProjects({
  projects,
  activeProjectId,
  onSelect,
  onCreate,
  t,
}: SidebarProjectsProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreate(trimmed);
      setName("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <aside className="flex w-64 flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
      <header>
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
          {t("projectsTitle")}
        </h2>
      </header>
      <nav className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={[
            "rounded-lg px-3 py-2 text-left text-sm font-medium transition",
            activeProjectId === null
              ? "bg-blue-500/20 text-blue-100"
              : "bg-white/5 text-slate-200 hover:bg-white/10",
          ].join(" ")}
        >
          <span className="block truncate">{t("globalProject")}</span>
        </button>
        {projects.map((project) => {
          const isActive = project.id === activeProjectId;
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelect(project.id)}
              className={[
                "rounded-lg px-3 py-2 text-left text-sm font-medium transition",
                isActive
                  ? "bg-blue-500/20 text-blue-100"
                  : "bg-white/5 text-slate-200 hover:bg-white/10",
              ].join(" ")}
            >
              <span className="block truncate">{project.name}</span>
            </button>
          );
        })}
      </nav>
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
          {t("newProject")}
        </label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("newProject")}
          className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-white/30"
        />
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="rounded-lg bg-blue-500/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-blue-400/80 disabled:opacity-60"
        >
          {isSubmitting ? "..." : t("newProject")}
        </button>
      </form>
    </aside>
  );
}
