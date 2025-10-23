import { useNavigate } from "react-router-dom";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";

import type { TranslationKey } from "../i18n";

type DashboardProps = {
  t: (key: TranslationKey) => string;
};

const demoCards = [
  {
    title: "Quick Actions",
    description: "Trigger your most-used workflows and automation scripts.",
  },
  {
    title: "Team Activity",
    description: "Monitor recent commits, deployments, and review status.",
  },
  {
    title: "Knowledge Base",
    description: "Access documentation, decision logs, and shared snippets.",
  },
];

export default function Dashboard({ t }: DashboardProps) {
  const navigate = useNavigate();

  return (
    <div className="flex w-full flex-1 flex-col gap-10">
      <header>
        <SectionTitle
          title={t("dashboardTitle")}
          subtitle={t("dashboardSubtitle")}
        />
      </header>

      <section className="grid gap-5 md:grid-cols-3">
        {demoCards.map((card) => (
          <Card key={card.title}>
            <h2 className="text-lg font-semibold text-slate-100">
              {card.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {card.description}
            </p>
          </Card>
        ))}
      </section>

      <div className="flex justify-center">
        <Button
          variant="secondary"
          onClick={() => navigate("/")}
        >
          {t("backHome")}
        </Button>
      </div>
    </div>
  );
}
