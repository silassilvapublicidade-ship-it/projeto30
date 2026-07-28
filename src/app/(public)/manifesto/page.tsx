import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import {
  EditorialPage,
  PublicSection,
  StoryBlock,
} from "@/components/public/public-sections";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Manifesto",
  description:
    "O manifesto do Projeto 30: disciplina sem culpa, constância sem perfeição e evolução possível em dias reais.",
  openGraph: {
    title: "Manifesto do Projeto 30",
    description:
      "Uma visão calma sobre disciplina, saúde, fé, organização e continuidade.",
  },
};

export default function ManifestoPage() {
  return (
    <>
      <EditorialPage eyebrow="Manifesto" title="Constância é uma forma de liberdade.">
        <p>
          O Projeto 30 nasce de uma ideia simples: uma pessoa não precisa resolver a vida
          inteira de uma vez para começar a mudar.
        </p>
        <p className="mt-4">
          Trinta dias não são uma promessa mágica. São um recorte claro, humano e possível
          para observar escolhas, ajustar hábitos e construir presença.
        </p>
      </EditorialPage>

      <PublicSection className="pt-0">
        <div className="grid gap-4 lg:grid-cols-3">
          <StoryBlock title="Não é perfeição">
            <p>
              Perfeição costuma paralisar. O Projeto 30 prefere continuidade. O dia
              incompleto não apaga o caminho; ele mostra onde a rotina precisa de mais
              cuidado.
            </p>
          </StoryBlock>
          <StoryBlock title="Não é punição">
            <p>
              Disciplina não precisa ter gosto de culpa. Ela pode ser uma estrutura
              gentil: clara o bastante para orientar e leve o bastante para caber no
              cotidiano.
            </p>
          </StoryBlock>
          <StoryBlock title="Não é espetáculo">
            <p>
              A maior parte da mudança acontece longe dos aplausos. Ela aparece quando a
              pessoa lê mais uma página, bebe água, caminha, ora, escreve e volta amanhã.
            </p>
          </StoryBlock>
        </div>
      </PublicSection>

      <PublicSection className="pt-0">
        <div className="mx-auto max-w-3xl space-y-6 text-base leading-8 text-muted">
          <h2 className="font-display text-4xl leading-tight text-foreground">
            A mensagem central é: hoje eu continuo.
          </h2>
          <p>
            O Projeto 30 não tenta convencer alguém de que todos os dias serão fortes. Ele
            reconhece que existem dias cheios, dias confusos, dias cansados e dias em que
            o melhor resultado é simplesmente não abandonar o processo.
          </p>
          <p>
            Saúde, fé, leitura, autocuidado, movimento e organização entram como pilares
            porque uma vida melhor raramente nasce de uma única área. Ela se fortalece
            quando pequenas práticas começam a conversar entre si.
          </p>
          <p>
            Por isso a interface precisa ser calma. Ela deve apontar o próximo passo, não
            aumentar ansiedade. Deve registrar progresso, não criar vergonha. Deve lembrar
            que evolução é construída com autonomia.
          </p>
          <Button
            as="a"
            href="/cadastro"
            trailingIcon={<ArrowRight aria-hidden="true" size={16} />}
          >
            Começar o Dia 1
          </Button>
        </div>
      </PublicSection>
    </>
  );
}
