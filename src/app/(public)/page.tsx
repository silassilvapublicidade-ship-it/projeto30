import type { Metadata } from "next";
import { ArrowRight, CalendarDays, CheckCircle2, Heart, Sparkles } from "lucide-react";

import {
  BenefitList,
  defaultPillars,
  Eyebrow,
  FaqList,
  PlatformPreview,
  PillarGrid,
  publicFaqItems,
  PublicSection,
  StepList,
} from "@/components/public/public-sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "30 dias para evoluir",
  description:
    "Conheça o Projeto 30: uma jornada gratuita para construir disciplina, saúde, fé, organização e constância em ciclos de 30 dias.",
  openGraph: {
    title: "Projeto 30 - 30 dias para evoluir",
    description:
      "Disciplina hoje. Liberdade amanhã. Uma experiência digital premium para começar e continuar.",
  },
};

const homeSteps = [
  {
    title: "Crie sua conta",
    description:
      "Entre com e-mail, senha ou link de acesso e prepare seu primeiro ciclo.",
  },
  {
    title: "Comece o Dia 1",
    description:
      "O ciclo não depende do calendário do mês. Ele começa quando você decide.",
  },
  {
    title: "Acompanhe seus hábitos",
    description:
      "Registre práticas simples de saúde, leitura, fé, movimento e autocuidado.",
  },
  {
    title: "Marque o progresso",
    description: "Veja o caminho ganhar forma sem transformar disciplina em cobrança.",
  },
  {
    title: "Volte no dia seguinte",
    description:
      "A constância nasce do retorno. Alguns dias serão incompletos, e tudo bem.",
  },
  {
    title: "Conclua e recomece",
    description:
      "Ao final dos 30 dias, preserve o histórico e abra espaço para o próximo ciclo.",
  },
];

const benefits = [
  "Construir uma rotina possível para o seu momento de vida.",
  "Reduzir distrações com um ritual diário curto e claro.",
  "Melhorar a organização sem depender de motivação o tempo todo.",
  "Criar hábitos saudáveis com menos culpa e mais presença.",
  "Fortalecer disciplina sem transformar o processo em punição.",
  "Acompanhar a própria evolução com histórico e contexto.",
];

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      <section className="px-4 pb-12 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8">
        <div className="mx-auto grid min-h-[calc(100vh-7rem)] max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="min-w-0">
            <Badge>Projeto 30</Badge>
            <h1 className="mt-6 font-display text-6xl leading-[0.95] text-foreground sm:text-7xl lg:text-8xl">
              Projeto 30
            </h1>
            <p className="mt-6 max-w-xl font-display text-3xl leading-tight text-foreground sm:text-4xl">
              30 dias para evoluir.
            </p>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
              Disciplina hoje. Liberdade amanhã. Uma jornada simples para cuidar do corpo,
              da mente, da fé e da rotina sem precisar mudar tudo de uma vez.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                as="a"
                href="/cadastro"
                size="lg"
                trailingIcon={<ArrowRight aria-hidden="true" size={17} />}
              >
                Começar gratuitamente
              </Button>
              <Button as="a" href="/manifesto" size="lg" variant="ghost">
                Conhecer o projeto
              </Button>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ["30", "dias de ciclo"],
                ["1", "decisão por vez"],
                ["0", "culpa como método"],
              ].map(([value, label]) => (
                <div
                  className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.035] p-4"
                  key={label}
                >
                  <p className="font-mono text-xl text-action-soft">{value}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-w-0">
            <div
              aria-hidden="true"
              className="absolute -inset-8 rounded-full bg-action/10 blur-3xl"
            />
            <div className="relative grid gap-4 lg:grid-cols-[0.28fr_1fr] lg:items-stretch">
              <div className="hidden rounded-[var(--radius-pill)] border border-action/20 bg-action/10 p-3 lg:block">
                <div className="flex h-full flex-col items-center justify-between py-4">
                  {["Saúde", "Fé", "Leitura", "Rotina", "Voltar"].map((item) => (
                    <span
                      className="[writing-mode:vertical-rl] rotate-180 font-mono text-[0.68rem] uppercase tracking-[0.22em] text-action-soft"
                      key={item}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <PlatformPreview />
            </div>
          </div>
        </div>
      </section>

      <PublicSection id="manifesto">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <Eyebrow>Manifesto</Eyebrow>
            <h2 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
              Não é sobre vencer todos os dias. É sobre voltar.
            </h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-muted">
            <p>
              O Projeto 30 não foi criado para transformar vida real em cobrança. Ele
              existe para dar forma a uma decisão simples: continuar mesmo quando o dia
              não sai perfeito.
            </p>
            <p>
              Disciplina, saúde, fé e organização entram como práticas possíveis. A
              evolução aparece no acúmulo das escolhas pequenas, não em promessas
              grandiosas.
            </p>
            <Button
              as="a"
              href="/manifesto"
              trailingIcon={<ArrowRight aria-hidden="true" size={16} />}
              variant="secondary"
            >
              Ler manifesto
            </Button>
          </div>
        </div>
      </PublicSection>

      <PublicSection className="pt-0">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card tone="soft" className="p-6 sm:p-8">
            <CalendarDays aria-hidden="true" className="text-action-soft" size={24} />
            <h2 className="mt-5 text-2xl font-semibold text-foreground">
              Por que o Projeto 30 existe
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted sm:text-base sm:leading-8">
              Porque muita gente sabe o que precisa mudar, mas se perde entre excesso de
              ferramentas, metas grandes demais e a sensação de ter que recomeçar do zero
              toda segunda-feira.
            </p>
            <Button as="a" className="mt-6" href="/sobre" variant="ghost">
              Ver a história
            </Button>
          </Card>

          <Card tone="glass" className="p-6 sm:p-8">
            <Heart aria-hidden="true" className="text-action-soft" size={24} />
            <h2 className="mt-5 text-2xl font-semibold text-foreground">
              Silas está dentro do processo
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted sm:text-base sm:leading-8">
              Silas idealizou o Projeto 30 como alguém que também está buscando mudança de
              estilo de vida: mais saúde, mais constância e uma rotina que sustente a
              evolução física, mental, espiritual e profissional.
            </p>
            <Button as="a" className="mt-6" href="/sobre#silas" variant="ghost">
              Conhecer o idealizador
            </Button>
          </Card>
        </div>
      </PublicSection>

      <PublicSection id="como-funciona">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
              Um ciclo claro para atravessar dias reais.
            </h2>
            <p className="mt-5 text-base leading-8 text-muted">
              A mecânica é simples de entender porque o desafio já é grande o bastante:
              aparecer para a própria rotina.
            </p>
            <Button as="a" className="mt-7" href="/como-funciona" variant="secondary">
              Entender o ciclo
            </Button>
          </div>
          <StepList items={homeSteps} />
        </div>
      </PublicSection>

      <PublicSection className="pt-0">
        <div className="mb-8 max-w-2xl">
          <Eyebrow>Pilares</Eyebrow>
          <h2 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
            O desafio é digital, mas a mudança acontece fora da tela.
          </h2>
        </div>
        <PillarGrid items={defaultPillars} />
      </PublicSection>

      <PublicSection id="preview">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Eyebrow>Veja por dentro</Eyebrow>
            <h2 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
              Uma prévia da área de membros, sem linguagem de venda.
            </h2>
            <p className="mt-5 text-base leading-8 text-muted">
              A experiência autenticada será construída para executar: acompanhar hábitos,
              registrar jornada e mostrar progresso. A landing apenas revela a direção
              visual, sem simular uma área pronta.
            </p>
          </div>
          <PlatformPreview />
        </div>
      </PublicSection>

      <PublicSection className="pt-0">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <Eyebrow>Benefícios possíveis</Eyebrow>
            <h2 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
              Menos promessa. Mais direção.
            </h2>
            <p className="mt-5 text-base leading-8 text-muted">
              O Projeto 30 não promete uma vida perfeita em um mês. Ele organiza um começo
              possível.
            </p>
          </div>
          <BenefitList items={benefits} />
        </div>
      </PublicSection>

      <PublicSection className="pt-0">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <Eyebrow>Depoimentos</Eyebrow>
            <h2 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
              Espaço reservado para histórias reais.
            </h2>
            <p className="mt-5 text-base leading-8 text-muted">
              Nenhum depoimento será inventado. Esta área receberá relatos quando houver
              participantes reais e autorização explícita de uso.
            </p>
          </div>
          <EmptyState
            action={
              <Button as="a" href="/cadastro" size="sm" variant="secondary">
                Entrar na primeira jornada
              </Button>
            }
            description="A comunidade ainda está nascendo. Os relatos entram aqui quando existirem histórias verificáveis."
            title="Depoimentos em preparação"
          />
        </div>
      </PublicSection>

      <PublicSection className="pt-0">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
              Perguntas antes do Dia 1.
            </h2>
            <Button as="a" className="mt-7" href="/faq" variant="secondary">
              Ver todas as respostas
            </Button>
          </div>
          <FaqList items={publicFaqItems.slice(0, 5)} />
        </div>
      </PublicSection>

      <PublicSection className="pt-0">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-action/20 bg-[linear-gradient(135deg,rgba(255,106,0,0.18),rgba(255,255,255,0.055)_42%,rgba(255,255,255,0.03))] p-6 shadow-[var(--shadow-soft)] sm:p-10">
          <div
            aria-hidden="true"
            className="absolute right-0 top-0 size-48 rounded-full bg-action/20 blur-3xl"
          />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <Sparkles aria-hidden="true" className="text-action-soft" size={24} />
              <h2 className="mt-5 max-w-3xl font-display text-4xl leading-tight text-foreground sm:text-5xl">
                Você não precisa mudar sua vida inteira hoje.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-muted">
                Só precisa começar o Dia 1 com honestidade, presença e uma direção que
                caiba no seu dia.
              </p>
            </div>
            <Button
              as="a"
              href="/cadastro"
              size="lg"
              trailingIcon={<CheckCircle2 aria-hidden="true" size={17} />}
            >
              Começar gratuitamente
            </Button>
          </div>
        </div>
      </PublicSection>
    </main>
  );
}
