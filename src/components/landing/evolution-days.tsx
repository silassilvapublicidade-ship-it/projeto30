import { Flame, Trophy } from "lucide-react";

import { Eyebrow } from "@/components/public/public-sections";
import { cn } from "@/lib/utils";

type DayState = {
  day: number;
  progress: number;
  habits: string;
  streak: string;
  badge?: string;
};

const dayOne: DayState = { day: 1, progress: 10, habits: "1/6 hábitos", streak: "1d" };
const dayFifteen: DayState = { day: 15, progress: 55, habits: "4/6 hábitos", streak: "9d" };
const dayThirty: DayState = {
  day: 30,
  progress: 100,
  habits: "6/6 hábitos",
  streak: "30d",
  badge: "Conquista desbloqueada",
};

const states: DayState[] = [dayOne, dayFifteen, dayThirty];

function DayPanel({
  className,
  state,
}: {
  className?: string;
  state: DayState;
}) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-2xl border border-white/[0.1] bg-[linear-gradient(165deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-5 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-action-soft">
        Dia {state.day}
      </p>
      <p className="mt-3 font-display text-4xl leading-none text-white">
        {state.progress}
        <span className="text-base font-normal text-white/50">%</span>
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--p30-orange),var(--p30-amber))]"
          style={{ width: `${state.progress}%` }}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.06em] text-white/55">
        <span>{state.habits}</span>
        <span className="inline-flex items-center gap-1">
          <Flame aria-hidden="true" className="text-action-soft" size={12} />
          {state.streak}
        </span>
      </div>
      {state.badge ? (
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-action/35 bg-action/12 px-3 py-1 text-[11px] font-semibold text-action-soft">
          <Trophy aria-hidden="true" size={12} />
          {state.badge}
        </div>
      ) : null}
    </div>
  );
}

export function EvolutionDays() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24" id="evolucao">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Eyebrow>30 dias</Eyebrow>
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.12] text-foreground">
            O progresso deixa de ser uma sensação.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted">
            Você vê cada dia concluído, cada sequência construída e o ciclo tomando
            forma.
          </p>
        </div>

        <div className="relative mt-12 hidden lg:block">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
            style={{
              background: "radial-gradient(circle, rgba(255,150,60,0.45) 0%, rgba(255,150,60,0) 70%)",
            }}
          />
          <div className="relative flex items-end justify-center">
            <DayPanel
              className="z-10 -mr-16 w-[190px] translate-y-6 rotate-[-6deg] scale-90 opacity-70"
              state={dayOne}
            />
            <DayPanel
              className="z-20 -mr-14 w-[215px] translate-y-2 rotate-[-2deg] scale-[0.96] opacity-90"
              state={dayFifteen}
            />
            <DayPanel className="z-30 w-[250px] rotate-1" state={dayThirty} />
          </div>
        </div>

        <div
          aria-label="Estados ilustrativos da jornada: dia 1, dia 15 e dia 30"
          className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 lg:hidden [&::-webkit-scrollbar]:hidden"
          role="region"
          style={{ scrollbarWidth: "none" }}
          tabIndex={0}
        >
          {states.map((state) => (
            <DayPanel
              className="w-[78vw] max-w-[300px] snap-center"
              key={state.day}
              state={state}
            />
          ))}
        </div>

        <div
          aria-hidden="true"
          className="mt-3 flex items-center justify-center gap-1.5 lg:hidden"
        >
          {states.map((state) => (
            <span
              className="size-1.5 rounded-full bg-white/25"
              key={state.day}
            />
          ))}
          <span className="ml-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-2">
            Deslize para ver os três dias
          </span>
        </div>

        <p className="mt-8 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">
          Demonstração ilustrativa — sua jornada real começa do zero.
        </p>
      </div>
    </section>
  );
}
