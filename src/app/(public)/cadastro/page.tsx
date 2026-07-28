import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignupForm } from "@/components/auth/auth-forms";
import { AuthLink, AuthShell } from "@/components/auth/auth-shell";
import { getSafeNextPath } from "@/lib/auth/redirects";
import { getOptionalAuthUser } from "@/server/services/auth-session.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Criar conta",
  description:
    "Crie uma conta gratuita no Projeto 30 e prepare seu primeiro ciclo de evolucao.",
  openGraph: {
    title: "Comecar gratuitamente - Projeto 30",
    description: "Crie sua conta para iniciar o Dia 1 quando estiver pronto.",
  },
};

type CadastroPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function CadastroPage({ searchParams }: CadastroPageProps) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next);
  const user = await getOptionalAuthUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <AuthShell
      eyebrow="Comecar"
      footer={
        <>
          Ja tem conta? <AuthLink href="/login">Entrar no Projeto 30</AuthLink>.
        </>
      }
      title="Prepare seu Dia 1."
    >
      <SignupForm nextPath={nextPath} />
    </AuthShell>
  );
}
