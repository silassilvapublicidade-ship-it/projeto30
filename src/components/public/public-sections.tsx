import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CheckCircle2,
  HeartPulse,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  SunMedium,
} from "lucide-react";

import { RhythmRail } from "@/components/brand/rhythm-rail";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type PublicFaqItem = {
  question: string;
  answer: string;
};

type SectionProps = ComponentPropsWithoutRef<"section"> & {
  children: ReactNode;
};

export function PublicSection({ children, className, ...props }: SectionProps) {
  return (
    <section className={cn("px-4 py-14 sm:px-6 sm:py-20 lg:px-8", className)} {...props}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="h-px w-8 bg-action/70" />
      <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-action-soft">
        {children}
      </p>
    </div>
  );
}

export function EditorialIntro({
  align = "left",
  children,
  eyebrow,
  title,
}: {
  align?: "left" | "center";
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      <div className={cn(align === "center" && "flex justify-center")}>
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
      <h1 className="font-display text-5xl leading-[1.02] text-foreground sm:text-6xl lg:text-7xl">
        {title}
      </h1>
      <div className="mt-6 text-base leading-8 text-muted sm:text-lg">{children}</div>
    </div>
  );
}

export function EditorialPage({
  children,
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="overflow-x-hidden">
      <PublicSection className="pb-10 pt-20 sm:pt-28">
        <EditorialIntro eyebrow={eyebrow} title={title}>
          {children}
        </EditorialIntro>
      </PublicSection>
    </main>
  );
}

export function StoryBlock({ children, title }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[var(--shadow-hairline)] sm:p-8">
      <h2 className="text-2xl font-semibold leading-tight text-foreground">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-muted sm:text-base sm:leading-8">
        {children}
      </div>
    </div>
  );
}

export function StepList({
  items,
}: {
  items: Array<{ title: string; description: string }>;
}) {
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div
          className="grid grid-cols-[3rem_1fr] gap-4 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.04] p-4 shadow-[var(--shadow-hairline)]"
          key={item.title}
        >
          <span className="flex size-12 items-center justify-center rounded-full border border-action/25 bg-action/10 font-mono text-sm text-action-soft">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PillarGrid({
  items,
}: {
  items: Array<{ title: string; description: string; icon: LucideIcon }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div
            className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.04] p-5 shadow-[var(--shadow-hairline)] transition-[border-color,background,transform] duration-[var(--motion-base)] hover:-translate-y-0.5 hover:border-white/14 hover:bg-white/[0.06]"
            key={item.title}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-action/10 text-action-soft">
              <Icon aria-hidden="true" size={19} />
            </span>
            <h3 className="mt-5 text-base font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}

export function PlatformPreview({ className }: { className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-4", className)}>
      <Card tone="glass" className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="font-mono text-xs text-action-soft">DIA 13</p>
            <h2 className="mt-3 text-2xl font-semibold text-foreground">
              Hoje eu continuo
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Uma prévia estática da futura área de membros, sem dados reais.
            </p>
          </div>
          <Badge tone="neutral">42%</Badge>
        </div>
        <div className="mt-6">
          <Progress label="Ciclo atual" value={42} />
        </div>
        <div className="mt-6 grid gap-2">
          {["Leitura", "Água", "Gratidão"].map((habit, index) => (
            <div
              className="flex min-h-12 items-center justify-between rounded-[var(--radius-card)] border border-white/[0.08] bg-black/20 px-4"
              key={habit}
            >
              <span className="text-sm font-semibold text-foreground">{habit}</span>
              {index < 2 ? (
                <CheckCircle2 aria-hidden="true" className="text-success" size={18} />
              ) : (
                <span className="size-2 rounded-full bg-action" />
              )}
            </div>
          ))}
        </div>
      </Card>
      <RhythmRail />
    </div>
  );
}

export function BenefitList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          className="flex gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.04] p-4 text-sm leading-6 text-muted shadow-[var(--shadow-hairline)]"
          key={item}
        >
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-success"
            size={18}
          />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

export function FaqList({ items }: { items: PublicFaqItem[] }) {
  return (
    <div className="divide-y divide-white/[0.08] overflow-hidden rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.04] shadow-[var(--shadow-hairline)]">
      {items.map((item) => (
        <details
          className="group px-5 py-4 open:bg-white/[0.035] sm:px-6"
          key={item.question}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-foreground focus-visible:outline-action-soft">
            {item.question}
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-action transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export const defaultPillars = [
  {
    title: "Saúde",
    description:
      "Rotina simples para cuidar do corpo sem transformar cuidado em cobrança.",
    icon: HeartPulse,
  },
  {
    title: "Disciplina",
    description: "Pequenas decisões repetidas com clareza, não intensidade passageira.",
    icon: ShieldCheck,
  },
  {
    title: "Fé",
    description: "Espaço para direção, gratidão e presença no meio dos dias comuns.",
    icon: SunMedium,
  },
  {
    title: "Leitura",
    description: "Contato diário com ideias que ajudam a ampliar repertório e foco.",
    icon: BookOpen,
  },
  {
    title: "Autocuidado",
    description:
      "Práticas possíveis para recuperar energia, silêncio e organização interna.",
    icon: Sparkles,
  },
  {
    title: "Registro",
    description: "Um diário curto para enxergar padrões, avanços e aprendizados.",
    icon: NotebookPen,
  },
  {
    title: "Movimento",
    description: "O corpo entra na jornada como parte da evolução, não como punição.",
    icon: HeartPulse,
  },
  {
    title: "Constância",
    description: "O foco é voltar, ajustar e seguir. Perfeição não é requisito.",
    icon: CheckCircle2,
  },
];

export const publicFaqItems: PublicFaqItem[] = [
  {
    question: "O Projeto 30 é gratuito?",
    answer:
      "A proposta inicial é permitir que você comece gratuitamente. Recursos pagos podem existir no futuro, sempre sinalizados com clareza antes de qualquer cobrança.",
  },
  {
    question: "Preciso começar no primeiro dia do mês?",
    answer:
      "Não. O ciclo é pessoal. Você pode começar no Dia 1 quando fizer sentido para sua rotina.",
  },
  {
    question: "Posso participar de mais de um ciclo?",
    answer:
      "Sim. A arquitetura do produto foi pensada para preservar o histórico de ciclos anteriores e permitir novos ciclos no futuro.",
  },
  {
    question: "Preciso cumprir tudo todos os dias?",
    answer:
      "Não. O objetivo é construir constância com honestidade. Alguns dias serão incompletos, e ainda assim podem ensinar algo importante.",
  },
  {
    question: "O que acontece se eu falhar um dia?",
    answer:
      "Você continua. O Projeto 30 não foi criado para gerar culpa, mas para ajudar a perceber o caminho e retomar no dia seguinte.",
  },
  {
    question: "Meus dados ficam salvos?",
    answer:
      "A estrutura foi preparada para salvar sua jornada com segurança. Dados privados, como diário, devem permanecer protegidos pelas políticas do banco.",
  },
  {
    question: "Posso usar pelo celular?",
    answer:
      "Sim. A experiência é desenhada primeiro para celular, porque a jornada precisa caber no dia real.",
  },
  {
    question: "O Projeto 30 é um aplicativo?",
    answer:
      "Nesta fase, é uma aplicação web responsiva. Você acessa pelo navegador e pode acompanhar a evolução do produto conforme novas etapas forem liberadas.",
  },
];
