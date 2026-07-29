import type { Metadata } from "next";

import { CampaignHero } from "@/components/landing/campaign-hero";
import { ContinuityProblem } from "@/components/landing/continuity-problem";
import { EvolutionDays } from "@/components/landing/evolution-days";
import { FinalCta } from "@/components/landing/final-cta";
import { ProductInUse } from "@/components/landing/product-in-use";
import { ReflectionAchievements } from "@/components/landing/reflection-achievements";

const title = "Projeto 30 — Entre decidir e mudar, existem 30 dias";
const description =
  "Uma jornada diária de 30 dias para transformar intenção em constância, acompanhar hábitos, progresso, reflexões e conquistas.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      <CampaignHero />
      <ContinuityProblem />
      <ProductInUse />
      <EvolutionDays />
      <ReflectionAchievements />
      <FinalCta />
    </main>
  );
}
