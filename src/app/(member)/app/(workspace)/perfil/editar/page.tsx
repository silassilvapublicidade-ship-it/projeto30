import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Bell, ChevronRight, ShieldCheck, UserRound } from "lucide-react";

import { ProfileDetailsForm } from "@/components/member/profile-details-form";
import { ProfilePhotoForm } from "@/components/member/profile-photo-form";
import { ProfileSecurityForm } from "@/components/member/profile-security-form";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAdminRole } from "@/features/admin/admin-access.core";
import { resolveUserDisplayName } from "@/lib/user-display";
import { getMemberContext } from "@/server/services/member-area.service";

export const metadata: Metadata = {
  title: "Editar perfil",
};

function ProfileSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

/**
 * Configurações da conta (Parte 14) - exatamente o conteúdo que antes vivia
 * em /app/perfil, movido para cá sem remover nenhuma funcionalidade. /app/
 * perfil agora é o Dashboard de Evolução Pessoal; esta rota fica reservada
 * para foto/nome/cidade/senha/preferências/PWA/acesso administrativo.
 */
export default async function EditarPerfilPage() {
  const context = await getMemberContext();
  const profile = context.profile;
  const displayName = resolveUserDisplayName(profile);

  return (
    <div className="space-y-6">
      <section className="max-w-3xl">
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/app/perfil"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para o perfil
        </Link>
        <span className="mt-4 flex size-12 items-center justify-center rounded-full bg-action/12 text-action-soft">
          <UserRound aria-hidden="true" size={22} />
        </span>
        <h1 className="mt-5 font-display text-4xl leading-[1.05] text-foreground sm:text-5xl">
          Editar perfil
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Seus dados, sua foto e a segurança da sua conta ficam reunidos aqui.
        </p>
      </section>

      <ProfileSection
        description="Uma foto ajuda a reconhecer sua jornada de relance. JPEG, PNG ou WebP, até 5 MB."
        title="Foto e identidade"
      >
        <ProfilePhotoForm avatarUrl={profile.avatar_url} name={displayName} />
      </ProfileSection>

      <ProfileSection
        description="Nome, nome de exibição e cidade. O e-mail é somente leitura nesta fase."
        title="Informações pessoais"
      >
        <ProfileDetailsForm
          city={profile.city}
          displayName={profile.display_name}
          email={profile.email}
          name={profile.name}
        />
      </ProfileSection>

      <ProfileSection
        description="Confirme sua senha atual para definir uma nova senha de acesso."
        title="Segurança"
      >
        <ProfileSecurityForm />
      </ProfileSection>

      <ProfileSection
        description="Abra o Projeto 30 direto da tela inicial, em tela cheia, como um aplicativo."
        title="Instalar aplicativo"
      >
        <InstallAppPrompt />
      </ProfileSection>

      <Link
        className="flex items-center gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.035] p-4 transition-colors hover:border-white/14 hover:bg-white/[0.05] focus-visible:outline-action-soft"
        href="/app/configuracoes/notificacoes"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-action/12 text-action-soft">
          <Bell aria-hidden="true" size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Preferências de notificação</span>
          <span className="block text-xs text-muted-2">Lembretes, push e o que você quer receber</span>
        </span>
        <ChevronRight aria-hidden="true" className="shrink-0 text-muted-2" size={16} />
      </Link>

      {isAdminRole(profile.role) ? (
        <ProfileSection
          description="Sua conta tem papel administrativo. O acesso continua protegido no servidor."
          title="Acesso administrativo"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted">
              <ShieldCheck aria-hidden="true" className="text-action-soft" size={16} />
              Papel atual: {profile.role === "super_admin" ? "Super admin" : "Administrador"}
            </div>
            <Button as="a" href="/admin">
              Acessar administração
            </Button>
          </div>
        </ProfileSection>
      ) : null}
    </div>
  );
}
