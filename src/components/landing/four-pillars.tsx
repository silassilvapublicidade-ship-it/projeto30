import { HeartPulse, ShieldCheck, SunMedium, BookOpen } from "lucide-react";

import { Eyebrow, PillarGrid } from "@/components/public/public-sections";

const pillars = [
  {
    title: "Corpo",
    description: "Saúde, movimento, alimentação, hidratação, sono e autocuidado.",
    icon: HeartPulse,
  },
  {
    title: "Mente",
    description: "Leitura, organização, reflexão, presença e redução de distrações.",
    icon: BookOpen,
  },
  {
    title: "Caráter",
    description:
      "Disciplina, constância, gratidão, responsabilidade, autocontrole e bondade.",
    icon: ShieldCheck,
  },
  {
    title: "Espírito",
    description: "Oração, propósito, silêncio, fé, gratidão e aproximação de Deus.",
    icon: SunMedium,
  },
];

export function FourPillars() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24" id="pilares">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Eyebrow>Os quatro pilares</Eyebrow>
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.12] text-foreground">
            Uma jornada para a vida por inteiro.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted">
            O Projeto 30 não separa o que você faz do que você se torna. Cada ciclo
            trabalha corpo, mente, caráter e espírito juntos, na medida certa para caber
            no seu dia.
          </p>
        </div>

        <div className="mt-10">
          <PillarGrid items={pillars} />
        </div>
      </div>
    </section>
  );
}
