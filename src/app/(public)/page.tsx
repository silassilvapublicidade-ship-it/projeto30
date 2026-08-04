import type { Metadata } from "next";

import { CampaignHero } from "@/components/landing/campaign-hero";
import { ConstancyOverPerfection } from "@/components/landing/constancy-over-perfection";
import { ContinuityProblem } from "@/components/landing/continuity-problem";
import { EvolutionDays } from "@/components/landing/evolution-days";
import { FinalCta } from "@/components/landing/final-cta";
import { FourPillars } from "@/components/landing/four-pillars";
import { MonthlyCycles } from "@/components/landing/monthly-cycles";
import { OriginStory } from "@/components/landing/origin-story";
import { ProductInUse } from "@/components/landing/product-in-use";
import { ReflectionAchievements } from "@/components/landing/reflection-achievements";

const title = "Projeto 30 — 30 dias para evoluir";
const description =
  "Uma jornada de pequenas escolhas para fortalecer corpo, mente, caráter e espírito, com hábitos, progresso, reflexões e conquistas em ciclos de 30 dias.";

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
      <FourPillars />
      <ProductInUse />
      <OriginStory />
      <EvolutionDays />
      <ConstancyOverPerfection />
      <ReflectionAchievements />
      <MonthlyCycles />
      <FinalCta />
    </main>
  );
}
