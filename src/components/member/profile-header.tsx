import { ShieldCheck } from "lucide-react";

import { MemberAvatar } from "@/components/member/member-avatar";
import { ProfileEditLink } from "@/components/member/profile-edit-link";

function formatJoinedDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

/**
 * Cabeçalho premium do Dashboard de Evolução Pessoal (Parte 3). E-mail
 * nunca aparece aqui - fica só em /app/perfil/editar. A frase motivacional
 * é fixa e curta por design (o bloco de fé/propósito, mais abaixo, é quem
 * varia por mensagem cadastrada pelo admin - este cabeçalho não precisa de
 * uma segunda fonte de texto configurável).
 */
export function ProfileHeader({
  avatarUrl,
  displayName,
  fullName,
  joinedAt,
  primaryChallengeName,
  role,
}: {
  avatarUrl: string | null;
  displayName: string;
  fullName: string | null;
  joinedAt: string | null;
  primaryChallengeName: string | null;
  role: string;
}) {
  const showRoleBadge = role === "admin" || role === "super_admin";

  return (
    <section className="max-w-3xl" aria-labelledby="profile-header-name">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <MemberAvatar avatarUrl={avatarUrl} name={displayName} size="xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl leading-[1.05] text-foreground sm:text-4xl" id="profile-header-name">
                {displayName}
              </h1>
              {showRoleBadge ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-action/28 bg-action/10 px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-action-soft">
                  <ShieldCheck aria-hidden="true" size={11} />
                  {role === "super_admin" ? "Super admin" : "Administrador"}
                </span>
              ) : null}
            </div>
            {fullName && fullName !== displayName ? (
              <p className="mt-0.5 text-sm text-muted-2">{fullName}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted-2">
              {joinedAt ? <span>Desde {formatJoinedDate(joinedAt)}</span> : null}
              {primaryChallengeName ? (
                <span className="text-action-soft">{primaryChallengeName}</span>
              ) : null}
            </div>
          </div>
        </div>

        <ProfileEditLink />
      </div>

      <p className="mt-5 max-w-xl text-base leading-7 text-muted">
        Você está construindo uma nova versão de si mesmo.
      </p>
    </section>
  );
}
