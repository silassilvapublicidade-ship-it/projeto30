import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import {
  BenefitList,
  EditorialPage,
  PlatformPreview,
  PublicSection,
  StepList,
} from "@/components/public/public-sections";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "Entenda como funciona o ciclo de 30 dias do Projeto 30: conta, hábitos, progresso, diário e continuidade.",
  openGraph: {
    title: "Como funciona o Projeto 30",
    description:
      "Um ciclo simples para acompanhar hábitos, registrar progresso e continuar sem culpa.",
  },
};

const steps = [
  {
    title: "Crie sua conta",
    description:
      "A conta guarda sua jornada e prepara o caminho para ciclos futuros. Nesta fase, o acesso usa e-mail, senha ou link seguro.",
  },
  {
    title: "Entre em um ciclo",
    description:
      "Cada ciclo tem começo, fim e histórico. Isso permite arquivar uma etapa e iniciar outra sem apagar sua evolução.",
  },
  {
    title: "Conheça os hábitos do ciclo",
    description:
      "Cada ciclo já vem com hábitos definidos, pensados para o tema do mês. Você acompanha e registra as práticas propostas, sem precisar montar a própria lista do zero.",
  },
  {
    title: "Registre o dia",
    description:
      "Marque o que fez, escreva uma nota breve e observe o que ajudou ou atrapalhou o processo.",
  },
  {
    title: "Acompanhe o ritmo",
    description:
      "O progresso deve mostrar direção, não julgamento. A interface existe para ajudar você a voltar.",
  },
  {
    title: "Conclua os 30 dias",
    description:
      "Ao final do ciclo, o histórico permanece. A próxima etapa pode começar com mais clareza sobre o que funcionou.",
  },
];

const guidance = [
  "Você pode começar em qualquer dia, não apenas no início do mês.",
  "Um dia incompleto não precisa encerrar o ciclo.",
  "Os registros diários devem pertencer ao ciclo correto para preservar contexto.",
  "A área de membros é focada em execução, não em venda.",
];

export default function ComoFuncionaPage() {
  return (
    <>
      <EditorialPage eyebrow="Como funciona" title="Um ciclo simples para dias reais.">
        <p>
          O Projeto 30 organiza a mudança em uma sequência clara: começar, registrar,
          acompanhar, ajustar e continuar.
        </p>
        <p className="mt-4">
          A tecnologia fica no fundo. Na frente, a pessoa encontra um ritual curto para
          lembrar do que decidiu construir.
        </p>
      </EditorialPage>

      <PublicSection className="pt-0">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <StepList items={steps} />
          <div className="lg:sticky lg:top-28">
            <PlatformPreview />
          </div>
        </div>
      </PublicSection>

      <PublicSection className="pt-0">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <h2 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
              O sistema precisa respeitar o processo.
            </h2>
            <p className="mt-5 text-base leading-8 text-muted">
              O ciclo não existe para produzir ansiedade. Ele existe para tornar o caminho
              visível e permitir que a pessoa escolha o próximo passo com mais clareza.
            </p>
          </div>
          <BenefitList items={guidance} />
        </div>
      </PublicSection>

      <PublicSection className="pt-0">
        <div className="rounded-[var(--radius-card)] border border-action/20 bg-action/10 p-6 sm:p-8">
          <h2 className="font-display text-4xl leading-tight text-foreground">
            Comece pequeno. Observe com honestidade. Volte amanhã.
          </h2>
          <Button
            as="a"
            className="mt-7"
            href="/cadastro"
            trailingIcon={<ArrowRight aria-hidden="true" size={16} />}
          >
            Começar gratuitamente
          </Button>
        </div>
      </PublicSection>
    </>
  );
}
