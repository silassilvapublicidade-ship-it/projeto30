import type { Metadata } from "next";
import { ArrowRight, Heart, UserRound } from "lucide-react";

import {
  EditorialPage,
  PublicSection,
  StoryBlock,
} from "@/components/public/public-sections";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Sobre",
  description:
    "Conheça a origem do Projeto 30, o problema que ele busca resolver e a história de Silas como idealizador e participante da jornada.",
  openGraph: {
    title: "Sobre o Projeto 30",
    description:
      "Uma ferramenta criada para transformar intenção em constância, sem promessas milagrosas.",
  },
};

export default function SobrePage() {
  return (
    <>
      <EditorialPage
        eyebrow="Sobre"
        title="Uma ferramenta para quem quer voltar ao eixo."
      >
        <p>
          O Projeto 30 foi criado para pessoas que querem melhorar a rotina, mas não
          querem transformar mudança pessoal em pressão permanente.
        </p>
        <p className="mt-4">
          A proposta é organizar um ciclo de 30 dias com hábitos, registros e direção
          suficiente para ajudar a pessoa a continuar.
        </p>
      </EditorialPage>

      <PublicSection className="pt-0">
        <div className="grid gap-4 lg:grid-cols-3">
          <StoryBlock title="O problema">
            <p>
              Muita gente começa motivada e desiste quando o plano fica pesado demais. O
              Projeto 30 reduz o excesso: menos abas abertas, menos metas vagas, mais
              clareza para o dia.
            </p>
          </StoryBlock>
          <StoryBlock title="A resposta">
            <p>
              Um ciclo curto, visual e acompanhável. Trinta dias são suficientes para
              enxergar padrões, testar ajustes e sentir progresso sem perder o histórico.
            </p>
          </StoryBlock>
          <StoryBlock title="O princípio">
            <p>
              Consistência importa mais do que perfeição. O produto deve ajudar a pessoa a
              retomar, não a desistir por ter falhado em um dia.
            </p>
          </StoryBlock>
        </div>
      </PublicSection>

      <PublicSection className="pt-0" id="silas">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <Card tone="glass" className="p-6 sm:p-8">
            <UserRound aria-hidden="true" className="text-action-soft" size={26} />
            <h2 className="mt-5 font-display text-4xl leading-tight text-foreground">
              Silas não está vendendo um palco. Está construindo junto.
            </h2>
            <p className="mt-5 text-sm leading-7 text-muted sm:text-base sm:leading-8">
              O Projeto 30 nasce também de uma busca pessoal por saúde, disciplina e uma
              rotina mais íntegra. Silas aparece aqui como idealizador e participante real
              do processo, não como guru, coach ou promessa de resultado.
            </p>
          </Card>

          <div className="space-y-5 text-base leading-8 text-muted">
            <p>
              A narrativa do Silas importa porque o produto não foi desenhado de fora para
              dentro. Ele parte da vida comum: trabalho, cansaço, metas adiadas, desejo de
              cuidar melhor do corpo, da mente, da fé e da profissão.
            </p>
            <p>
              Em vez de transformar a jornada em performance, o Projeto 30 assume que
              mudança sustentável precisa de método e humanidade. O aplicativo deve ser um
              companheiro discreto: registra, organiza e lembra que o próximo passo ainda
              está disponível.
            </p>
            <p>
              O convite é caminhar junto. Cada pessoa entra no seu Dia 1 com a própria
              história, seus limites e sua intenção.
            </p>
            <Button
              as="a"
              href="/cadastro"
              trailingIcon={<ArrowRight aria-hidden="true" size={16} />}
            >
              Entrar na jornada
            </Button>
          </div>
        </div>
      </PublicSection>

      <PublicSection className="pt-0">
        <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[var(--shadow-hairline)] sm:p-8">
          <Heart aria-hidden="true" className="text-action-soft" size={24} />
          <h2 className="mt-5 text-2xl font-semibold text-foreground">
            O que o Projeto 30 busca preservar
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
            Autonomia, continuidade e verdade. O usuário deve conseguir olhar para a
            própria jornada e entender o que está acontecendo sem receber julgamento da
            interface.
          </p>
        </div>
      </PublicSection>
    </>
  );
}
