import type { Metadata } from "next";

import {
  EditorialPage,
  PublicSection,
  StoryBlock,
} from "@/components/public/public-sections";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Privacidade",
  description:
    "Política de privacidade provisória do Projeto 30, com orientações iniciais sobre dados e transparência.",
  openGraph: {
    title: "Privacidade - Projeto 30",
    description:
      "Conteúdo provisório sobre privacidade enquanto a versão jurídica definitiva é preparada.",
  },
};

export default function PrivacidadePage() {
  return (
    <>
      <EditorialPage
        eyebrow="Privacidade"
        title="Transparência antes da versão jurídica final."
      >
        <Badge tone="warning">Conteúdo provisório</Badge>
        <p className="mt-5">
          Esta página orienta a fase inicial do Projeto 30 e será substituída por uma
          política jurídica definitiva antes de qualquer expansão sensível do produto.
        </p>
      </EditorialPage>

      <PublicSection className="pt-0">
        <div className="grid gap-4 lg:grid-cols-3">
          <StoryBlock title="Dados de conta">
            <p>
              O acesso usa e-mail, senha ou link de acesso. Credenciais e sessões são
              tratadas pela infraestrutura de autenticação configurada para o produto.
            </p>
          </StoryBlock>
          <StoryBlock title="Dados da jornada">
            <p>
              A arquitetura prevê hábitos, diário, progresso e ciclos com proteção por
              políticas de acesso. O usuário não deve ter seus dados privados expostos.
            </p>
          </StoryBlock>
          <StoryBlock title="Sem garantias definitivas">
            <p>
              Este texto não substitui uma política jurídica revisada. Ele existe para
              deixar clara a intenção de privacidade enquanto o produto evolui.
            </p>
          </StoryBlock>
        </div>
      </PublicSection>
    </>
  );
}
