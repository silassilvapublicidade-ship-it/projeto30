import type { Metadata } from "next";

import {
  EditorialPage,
  FaqList,
  publicFaqItems,
  PublicSection,
} from "@/components/public/public-sections";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Respostas sobre gratuidade, início do ciclo, falhas durante a jornada, dados salvos e uso mobile do Projeto 30.",
  openGraph: {
    title: "Perguntas frequentes do Projeto 30",
    description:
      "Tire dúvidas antes de começar seu ciclo de 30 dias com disciplina e constância.",
  },
};

export default function FaqPage() {
  return (
    <>
      <EditorialPage eyebrow="FAQ" title="Perguntas honestas antes do Dia 1.">
        <p>
          O Projeto 30 está sendo construído com cuidado. Algumas respostas podem evoluir
          conforme novas fases forem liberadas, mas a direção do produto permanece a
          mesma: clareza, segurança e constância.
        </p>
      </EditorialPage>

      <PublicSection className="pt-0">
        <FaqList items={publicFaqItems} />
      </PublicSection>

      <PublicSection className="pt-0">
        <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[var(--shadow-hairline)] sm:p-8">
          <h2 className="text-2xl font-semibold text-foreground">
            Ainda está em dúvida se deve começar?
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-8 text-muted">
            Você não precisa ter tudo organizado para entrar. O Projeto 30 existe para
            ajudar justamente quando a rotina ainda está sendo construída.
          </p>
          <Button as="a" className="mt-6" href="/cadastro">
            Começar gratuitamente
          </Button>
        </div>
      </PublicSection>
    </>
  );
}
