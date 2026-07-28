import type { Metadata } from "next";

import {
  EditorialPage,
  PublicSection,
  StoryBlock,
} from "@/components/public/public-sections";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Termos",
  description:
    "Termos provisórios de uso do Projeto 30, com avisos iniciais sobre escopo, acesso e evolução do produto.",
  openGraph: {
    title: "Termos - Projeto 30",
    description:
      "Conteúdo provisório de termos enquanto a versão jurídica definitiva é preparada.",
  },
};

export default function TermosPage() {
  return (
    <>
      <EditorialPage
        eyebrow="Termos"
        title="Um acordo provisório para uma fase em construção."
      >
        <Badge tone="warning">Conteúdo provisório</Badge>
        <p className="mt-5">
          Estes termos orientam o uso inicial do Projeto 30 e não substituem uma versão
          jurídica definitiva. Eles existem para evitar links vazios e declarar o escopo
          atual com honestidade.
        </p>
      </EditorialPage>

      <PublicSection className="pt-0">
        <div className="grid gap-4 lg:grid-cols-3">
          <StoryBlock title="Uso do produto">
            <p>
              O Projeto 30 é uma aplicação de apoio à rotina e desenvolvimento pessoal.
              Ele não oferece diagnóstico, tratamento, aconselhamento clínico ou promessa
              de resultado.
            </p>
          </StoryBlock>
          <StoryBlock title="Evolução contínua">
            <p>
              Funcionalidades podem mudar conforme novas fases forem aprovadas. Mudanças
              importantes devem ser comunicadas com clareza ao usuário.
            </p>
          </StoryBlock>
          <StoryBlock title="Responsabilidade">
            <p>
              Cada participante usa a ferramenta como apoio para decisões pessoais. O
              produto deve orientar com clareza, sem substituir acompanhamento
              profissional quando ele for necessário.
            </p>
          </StoryBlock>
        </div>
      </PublicSection>
    </>
  );
}
