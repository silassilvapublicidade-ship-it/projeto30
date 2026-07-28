import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/auth-forms";
import { AuthLink, AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Criar conta",
  description:
    "Crie uma conta gratuita no Projeto 30 e prepare seu primeiro ciclo de evolução.",
  openGraph: {
    title: "Começar gratuitamente - Projeto 30",
    description: "Crie sua conta para iniciar o Dia 1 quando estiver pronto.",
  },
};

export default function CadastroPage() {
  return (
    <AuthShell
      eyebrow="Começar"
      footer={
        <>
          Já tem conta? <AuthLink href="/login">Entrar no Projeto 30</AuthLink>.
        </>
      }
      title="Prepare seu Dia 1."
    >
      <SignupForm />
    </AuthShell>
  );
}
