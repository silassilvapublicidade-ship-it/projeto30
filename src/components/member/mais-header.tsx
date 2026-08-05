import { ShieldCheck } from "lucide-react";

import { MemberAvatar } from "@/components/member/member-avatar";
import { ProfileEditLink } from "@/components/member/profile-edit-link";
import { Card } from "@/components/ui/card";
import type { MemberContext } from "@/server/services/member-area.service";

/**
 * Cabeçalho do hub /app/mais (Parte F). Mesma computação de "dia atual /
 * desafio ativo" já usada em member-shell.tsx - nenhuma consulta nova,
 * context já veio de getMemberContext() (Parte P).
 */
export function MaisHeader({ context }: { context: MemberContext }) {
  const profile = context.profile;
  const displayName = profile.display_name || profile.name || profile.email;
  const enrollmentCount = context.enrollments.length;
  const firstEnrollment = context.enrollments[0]?.enrollment ?? null;
  const showRoleBadge = profile.role === "admin" || profile.role === "super_admin";

  const cycleLabel =
    enrollmentCount === 0
      ? "Sem ciclo ativo"
      : enrollmentCount === 1
        ? `Dia ${firstEnrollment?.current_day}`
        : `${enrollmentCount} desafios ativos`;
  const cycleSubLabel =
    enrollmentCount === 0
      ? "Entre em um ciclo para começar com calma."
      : enrollmentCount === 1
        ? (firstEnrollment?.challenge?.name ?? "Ciclo ativo")
        : "Veja cada um na tela Hoje.";

  return (
    <Card className="hover:translate-y-0" tone="accent">
      <section aria-labelledby="mais-header-name" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <MemberAvatar avatarUrl={profile.avatar_url} name={displayName} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-2xl leading-tight text-foreground sm:text-3xl" id="mais-header-name">
                {displayName}
              </h1>
              {showRoleBadge ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-action/28 bg-action/10 px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-action-soft">
                  <ShieldCheck aria-hidden="true" size={11} />
                  {profile.role === "super_admin" ? "Super admin" : "Administrador"}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 truncate text-sm text-muted-2">{cycleLabel} · {cycleSubLabel}</p>
          </div>
        </div>

        <ProfileEditLink />
      </section>
    </Card>
  );
}
