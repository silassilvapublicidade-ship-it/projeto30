import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthLink, AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Entrar",
  description:
    "Entre no Projeto 30 com e-mail e senha ou receba um link seguro de acesso.",
  openGraph: {
    title: "Entrar no Projeto 30",
    description: "Acesse sua conta com uma experiência simples, segura e sem atrito.",
  },
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Acesso"
      footer={
        <>
          Ainda não tem conta? <AuthLink href="/cadastro">Comece gratuitamente</AuthLink>.
          <br />
          Esqueceu a senha?{" "}
          <AuthLink href="/recuperar-senha">Receba um link seguro</AuthLink>.
        </>
      }
      title="Entre para continuar sua jornada."
    >
      <LoginForm />
    </AuthShell>
  );
}
