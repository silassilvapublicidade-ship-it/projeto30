import type { Metadata } from "next";

import { PasswordRecoveryForm } from "@/components/auth/auth-forms";
import { AuthLink, AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Recuperar senha",
  description:
    "Receba um link seguro para acessar o Projeto 30 sem expor detalhes internos da conta.",
  openGraph: {
    title: "Recuperar acesso - Projeto 30",
    description: "Envie um link seguro para o e-mail usado no Projeto 30.",
  },
};

export default function RecuperarSenhaPage() {
  return (
    <AuthShell
      eyebrow="Recuperar acesso"
      footer={
        <>
          Lembrou a senha? <AuthLink href="/login">Voltar para o login</AuthLink>.
        </>
      }
      title="Volte sem transformar acesso em atrito."
    >
      <PasswordRecoveryForm />
    </AuthShell>
  );
}
