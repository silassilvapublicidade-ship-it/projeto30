import { ShieldCheck } from "lucide-react";

import { MemberAvatar } from "@/components/member/member-avatar";
import { ProfileEditLink } from "@/components/member/profile-edit-link";
import { Card } from "@/components/ui/card";
import type { MemberContext } from "@/server/services/member-area.service";

/**
 * Cabeçalho do hub /app/mais (Parte F) - a "central da conta", nunca um
 * segundo Dashboard: só texto compacto (projeto, dia, pontos, sequência),
 * sem gráficos/cards de métrica como ProfileMetricsGrid. Todos os dados já
 * vêm de getMemberContext() (points_total/streak_current/current_day já
 * estão em challenge_enrollments) - nenhuma consulta nova (Parte O). Só
 * aparece quando há exatamente UM ciclo em andamento - com 0 ou vários,
 * atribuir esses números a "o" desafio seria ambíguo ou enganoso.
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

  const showAccountSummary = enrollmentCount === 1 && firstEnrollment !== null;
  const streakLabel = `Sequência ${firstEnrollment?.streak_current ?? 0} dia${firstEnrollment?.streak_current === 1 ? "" : "s"}`;

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

      {showAccountSummary ? (
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.08] pt-4 sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-2">Projeto</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {firstEnrollment?.challenge?.name ?? "—"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-2">Dia</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {firstEnrollment?.current_day} de {firstEnrollment?.challenge?.duration_days ?? firstEnrollment?.current_day}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-2">Pontos</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">{firstEnrollment?.points_total ?? 0}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-2">Sequência</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">{streakLabel}</dd>
          </div>
        </dl>
      ) : null}
    </Card>
  );
}
