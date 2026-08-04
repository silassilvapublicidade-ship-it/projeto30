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
    "A origem do Projeto 30: uma transformação real de mais de 30 quilos que virou um convite para caminhar junto, com Silas como idealizador e participante, nunca guru.",
  openGraph: {
    title: "Sobre o Projeto 30",
    description:
      "Um projeto que nasceu de uma transformação real, criado para ajudar outras pessoas a decidirem continuar.",
  },
};

export default function SobrePage() {
  return (
    <>
      <EditorialPage
        eyebrow="Sobre"
        title="Um projeto que nasceu de uma transformação real."
      >
        <p>
          O Projeto 30 não começou como uma ideia de produto. Começou como a tentativa de
          uma pessoa comum de mudar de vida, um dia de cada vez.
        </p>
        <p className="mt-4">
          Não criamos o Projeto 30 porque temos todas as respostas. Criamos porque sabemos
          como é difícil começar, continuar e reorganizar a própria vida.
        </p>
      </EditorialPage>

      <PublicSection className="pt-0">
        <div className="grid gap-4 lg:grid-cols-3">
          <StoryBlock title="O início da mudança">
            <p>
              Tudo começou com uma decisão simples: cuidar melhor da própria saúde. Mais
              treino, mais atenção à alimentação, mais disciplina no dia a dia — nada
              radical, só constância repetida.
            </p>
          </StoryBlock>
          <StoryBlock title="Além do corpo">
            <p>
              O resultado físico veio — mais de 30 quilos de mudança. Mas o mais
              surpreendente foi perceber que a disciplina construída ali começou a se
              espalhar: para o trabalho, para a leitura, para a fé, para a forma de encarar
              os dias difíceis.
            </p>
          </StoryBlock>
          <StoryBlock title="O nascimento do Projeto 30">
            <p>
              Dessa experiência nasceu o primeiro desafio de 30 dias, pensado para outras
              pessoas viverem o mesmo tipo de virada. O que era pessoal virou uma
              plataforma para caminhar junto com quem quisesse começar também.
            </p>
          </StoryBlock>
        </div>
      </PublicSection>

      <PublicSection className="pt-0" id="silas">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <Card tone="glass" className="p-6 sm:p-8">
            <UserRound aria-hidden="true" className="text-action-soft" size={26} />
            <h2 className="mt-5 font-display text-4xl leading-tight text-foreground">
              Quem está caminhando com você.
            </h2>
            <p className="mt-5 text-sm leading-7 text-muted sm:text-base sm:leading-8">
              Sou Silas, idealizador do Projeto 30. Não sou coach, não sou guru, não sou
              líder religioso e não sou profissional de saúde. Sou alguém que decidiu
              caminhar e convidar outras pessoas para seguirem junto.
            </p>
          </Card>

          <div className="space-y-5 text-base leading-8 text-muted">
            <p>
              A minha história importa aqui porque o Projeto 30 não foi desenhado de fora
              para dentro. Ele nasce da vida comum: trabalho, cansaço, metas adiadas e o
              desejo de cuidar melhor do corpo, da mente, do caráter e da fé.
            </p>
            <p>
              Perder mais de 30 quilos me ensinou algo que nenhuma meta de peso explica
              sozinha: a verdadeira mudança não estava só no corpo. Estava na disciplina que
              passei a levar para o trabalho, na leitura que voltou a fazer parte da minha
              rotina e na fé que passou a ocupar mais espaço no meu dia.
            </p>
            <p>
              Não criei o Projeto 30 porque tenho todas as respostas. Criei porque sei como
              é difícil começar, continuar e reorganizar a própria vida — e porque acredito
              que ninguém precisa fazer essa caminhada sozinho.
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
            interface. Não é sobre fazer tudo perfeitamente. É sobre não abandonar a
            caminhada.
          </p>
        </div>
      </PublicSection>
    </>
  );
}
