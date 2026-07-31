import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NewPasswordForm } from "@/components/auth/auth-forms";
import { AuthLink, AuthShell } from "@/components/auth/auth-shell";
import { getOptionalAuthUser } from "@/server/services/auth-session.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nova senha",
  description: "Defina uma nova senha para continuar no Projeto 30.",
  robots: {
    follow: false,
    index: false,
  },
};

export default async function NovaSenhaPage() {
  const user = await getOptionalAuthUser();

  if (!user) {
    redirect("/login?reason=session");
  }

  return (
    <AuthShell
      cardDescription="Defina uma nova senha para continuar no Projeto 30."
      cardTitle="Nova senha"
      footer={
        <>
          Prefere entrar com link? <AuthLink href="/login">Voltar para o login</AuthLink>.
        </>
      }
    >
      <NewPasswordForm />
    </AuthShell>
  );
}
