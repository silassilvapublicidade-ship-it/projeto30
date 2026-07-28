import { Database, Flame, LockKeyhole, ShieldCheck, TestTube2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const foundationItems = [
  {
    title: "Banco preparado",
    description: "Schema inicial, RLS base, ledger de pontos e seed de desenvolvimento.",
    icon: Database,
  },
  {
    title: "Auth sem atalhos",
    description:
      "Base para e-mail, senha e magic link via Supabase, com Google previsto.",
    icon: LockKeyhole,
  },
  {
    title: "Regra no servidor",
    description:
      "Pontos, sequência e permissões ficam fora do cliente desde o primeiro dia.",
    icon: ShieldCheck,
  },
  {
    title: "Testável por padrão",
    description:
      "Vitest cobre cálculo de dia, pontos e sequência antes das telas completas.",
    icon: TestTube2,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_right,rgba(255,106,0,0.22),transparent_28rem),linear-gradient(180deg,#050505_0%,#111316_100%)] px-5 py-6 text-foreground sm:px-8 lg:px-12">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[calc(100vw-2.5rem)] flex-col justify-between gap-10 sm:max-w-[calc(100vw-4rem)] lg:max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <a
            href="#fundacao"
            className="inline-flex min-w-0 items-center gap-3 rounded-sm text-sm font-semibold uppercase text-foreground"
            aria-label="Ir para o status da fundação do Projeto 30"
          >
            <span className="flex size-10 items-center justify-center rounded-sm bg-action text-background">
              <Flame aria-hidden="true" size={22} strokeWidth={2.4} />
            </span>
            Projeto 30
          </a>
          <Badge>Fase 1</Badge>
        </header>

        <div
          id="fundacao"
          className="grid min-w-0 gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end"
        >
          <div className="min-w-0 max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase text-action-soft">
              Fundação técnica aprovada
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-7xl leading-[0.88] text-foreground sm:text-8xl lg:text-9xl">
              30 dias para evoluir.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
              A base do produto está sendo montada para sustentar ciclos, hábitos, diário
              privado, pontuação auditável e administração sem prender o MVP em
              complexidade prematura.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button as="a" href="#modulos" className="w-full sm:w-auto">
                Ver módulos
              </Button>
              <Button
                as="a"
                href="#decisoes"
                variant="secondary"
                className="w-full sm:w-auto"
              >
                Ver decisões
              </Button>
            </div>
          </div>

          <aside
            aria-label="Sinal visual do ciclo de 30 dias"
            className="grid aspect-[4/5] w-full max-w-[21.5rem] grid-cols-5 gap-2 justify-self-start lg:max-w-md lg:justify-self-end"
          >
            {Array.from({ length: 30 }, (_, index) => {
              const day = index + 1;
              const isMilestone = [1, 7, 15, 22, 30].includes(day);

              return (
                <div
                  key={day}
                  className={`flex items-center justify-center rounded-sm border text-sm font-semibold tabular-nums ${
                    isMilestone
                      ? "border-action bg-action text-background"
                      : "border-line bg-panel/80 text-muted"
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </aside>
        </div>

        <section id="modulos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {foundationItems.map((item) => (
            <Card key={item.title}>
              <item.icon aria-hidden="true" className="text-action" size={24} />
              <h2 className="mt-5 text-xl font-semibold text-foreground">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{item.description}</p>
            </Card>
          ))}
        </section>

        <section
          id="decisoes"
          className="border-t border-line py-5 font-mono text-xs uppercase text-muted"
        >
          Next.js App Router · TypeScript estrito · Tailwind tokens · Supabase pronto ·
          RLS desde o início
        </section>
      </section>
    </main>
  );
}
