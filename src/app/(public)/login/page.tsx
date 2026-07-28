import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthLink, AuthShell } from "@/components/auth/auth-shell";
import { StatusCard } from "@/components/ui/feedback";
import { getSafeNextPath } from "@/lib/auth/redirects";
import { getOptionalAuthUser } from "@/server/services/auth-session.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrar",
  description:
    "Entre no Projeto 30 com e-mail e senha ou receba um link seguro de acesso.",
  openGraph: {
    title: "Entrar no Projeto 30",
    description: "Acesse sua conta com uma experiencia simples, segura e sem atrito.",
  },
};

type LoginPageProps = {
  searchParams: Promise<{
    logout?: string;
    next?: string;
    reason?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next);
  const user = await getOptionalAuthUser();

  if (user) {
    redirect(nextPath);
  }

  const notice =
    params.logout === "1"
      ? {
          title: "Sessao encerrada",
          description: "Quando quiser continuar, entre novamente com seguranca.",
          tone: "success" as const,
        }
      : params.reason === "session"
        ? {
            title: "Entre novamente",
            description: "Sua sessao expirou ou nao foi encontrada neste dispositivo.",
            tone: "error" as const,
          }
        : null;

  return (
    <AuthShell
      eyebrow="Acesso"
      footer={
        <>
          Ainda nao tem conta? <AuthLink href="/cadastro">Comece gratuitamente</AuthLink>.
          <br />
          Esqueceu a senha?{" "}
          <AuthLink href="/recuperar-senha">Receba um link seguro</AuthLink>.
        </>
      }
      title="Entre para continuar sua jornada."
    >
      <div className="space-y-5">
        {notice ? (
          <StatusCard
            description={notice.description}
            title={notice.title}
            tone={notice.tone}
          />
        ) : null}
        <LoginForm nextPath={nextPath} />
      </div>
    </AuthShell>
  );
}
