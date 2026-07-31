import type { Metadata } from "next";
import { ShieldCheck, UserRound } from "lucide-react";

import { ProfileDetailsForm } from "@/components/member/profile-details-form";
import { ProfilePhotoForm } from "@/components/member/profile-photo-form";
import { ProfileSecurityForm } from "@/components/member/profile-security-form";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAdminRole } from "@/features/admin/admin-access.core";
import { getMemberContext } from "@/server/services/member-area.service";

export const metadata: Metadata = {
  title: "Perfil",
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

export default async function PerfilPage() {
  const context = await getMemberContext();
  const profile = context.profile;
  const displayName = profile.display_name || profile.name || profile.email;

  return (
    <div className="space-y-6">
      <section className="max-w-3xl">
        <span className="flex size-12 items-center justify-center rounded-full bg-action/12 text-action-soft">
          <UserRound aria-hidden="true" size={22} />
        </span>
        <h1 className="mt-5 font-display text-4xl leading-[1.05] text-foreground sm:text-5xl">
          Meu perfil
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
