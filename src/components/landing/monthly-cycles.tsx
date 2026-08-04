import { CalendarDays } from "lucide-react";

import { Eyebrow } from "@/components/public/public-sections";
import {
  CURRENT_MONTHLY_CYCLE,
  NEXT_MONTHLY_CYCLE,
  type MonthlyCycleSummary,
} from "@/config/monthly-cycles";

function CycleCard({ cycle }: { cycle: MonthlyCycleSummary }) {
  const isCurrent = cycle.status === "current";

  return (
    <div
      className={[
        "rounded-[var(--radius-card)] border p-6 shadow-[var(--shadow-hairline)] sm:p-7",
        isCurrent
          ? "border-action/25 bg-action/10"
          : "border-white/[0.08] bg-white/[0.04]",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex items-center rounded-[var(--radius-pill)] px-3 py-1 font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em]",
          isCurrent ? "bg-action/15 text-action-soft" : "bg-white/[0.06] text-muted-2",
        ].join(" ")}
      >
        {isCurrent ? "Ciclo atual" : "Próximo ciclo"}
      </span>
      <h3 className="mt-4 font-display text-2xl leading-tight text-foreground sm:text-3xl">
        {cycle.month}
        {isCurrent ? `, ${cycle.theme}` : null}
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted sm:text-base sm:leading-7">
        {cycle.description}
      </p>
    </div>
  );
}

export function MonthlyCycles() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Eyebrow>Ciclos mensais</Eyebrow>
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.12] text-foreground">
            Uma nova jornada a cada mês.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted">
            Projeto 30 é a marca que permanece. Cada mês traz um novo ciclo, com tema,
            hábitos e reflexões próprios — mas a experiência continua, mesmo quando um
            ciclo termina.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <CycleCard cycle={CURRENT_MONTHLY_CYCLE} />
          <CycleCard cycle={NEXT_MONTHLY_CYCLE} />
        </div>

        <p className="mt-6 flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">
          <CalendarDays aria-hidden="true" size={13} />
          Um novo ciclo começa todo mês, sempre com a mesma marca.
        </p>
      </div>
    </section>
  );
}
