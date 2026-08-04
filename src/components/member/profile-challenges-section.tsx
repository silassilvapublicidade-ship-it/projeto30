import Image from "next/image";
import Link from "next/link";
import { Flag } from "lucide-react";

import { ChallengeOpenLink } from "@/components/member/challenge-open-link";
import { EmptyState } from "@/components/ui/feedback";
import type { ProfileEnrollmentSummary } from "@/server/services/profile-dashboard.service";

type EnrollmentStatus = ProfileEnrollmentSummary["status"];

const statusLabel: Record<EnrollmentStatus, string> = {
  abandoned: "Abandonado",
  active: "Em andamento",
  completed: "Concluído",
  paused: "Pausado",
  restarted: "Reiniciado",
};

const statusTone: Record<EnrollmentStatus, string> = {
  abandoned: "border-white/[0.1] bg-white/[0.05] text-muted",
  active: "border-action/32 bg-action/14 text-action-soft",
  completed: "border-success/24 bg-success-wash text-success",
  paused: "border-warning/26 bg-warning/10 text-warning",
  restarted: "border-white/[0.1] bg-white/[0.05] text-muted",
};

const BUCKET_ORDER: Array<{ key: string; label: string; statuses: EnrollmentStatus[] }> = [
  { key: "active", label: "Em andamento", statuses: ["active"] },
  { key: "paused", label: "Pausados", statuses: ["paused"] },
  { key: "completed", label: "Concluídos", statuses: ["completed"] },
  // "restarted" nao tem secao propria pedida no briefing - agrupado junto
  // com abandonados (ambos "nao estao mais em andamento nem concluidos"),
  // decisao documentada aqui em vez de inventar uma 5a secao.
  { key: "abandoned", label: "Abandonados", statuses: ["abandoned", "restarted"] },
];

function ChallengeCoverCard({ enrollment }: { enrollment: ProfileEnrollmentSummary }) {
  const cta =
    enrollment.status === "active"
      ? { href: "/app/hoje", label: "Continuar" }
      : enrollment.status === "completed"
        ? { href: `/app/jornada?desafio=${enrollment.enrollmentId}`, label: "Ver histórico" }
        : { href: `/app/jornada?desafio=${enrollment.enrollmentId}`, label: "Ver Jornada" };

  return (
    <article className="flex flex-col overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] shadow-[var(--shadow-hairline)]">
      <div className="relative flex aspect-[21/9] w-full items-end overflow-hidden p-4">
        {enrollment.coverImageUrl ? (
          <>
            <div aria-hidden="true" className="absolute inset-0 -z-20 bg-black" />
            <Image
              alt=""
              className="absolute inset-0 -z-10 object-contain"
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              src={enrollment.coverImageUrl}
            />
          </>
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(155deg,rgba(255,106,0,0.26),rgba(9,10,11,0.94))]"
          />
        )}
        <span
          className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] ${statusTone[enrollment.status]}`}
        >
          {statusLabel[enrollment.status]}
        </span>
        <h3 className="relative font-display text-xl leading-tight text-foreground">{enrollment.challengeName}</h3>
      </div>

      <div className="space-y-3 p-4">
        <p className="font-mono text-[0.68rem] text-muted-2">
          Dia {enrollment.currentDay} de {enrollment.durationDays}
        </p>

        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--p30-orange),var(--p30-amber))]"
              style={{ width: `${Math.min(100, Math.max(0, enrollment.completionPercent))}%` }}
            />
          </div>
          <p className="font-mono text-[0.62rem] text-muted-2">{Math.round(enrollment.completionPercent)}% concluído</p>
        </div>

        <div className="flex flex-wrap gap-3 font-mono text-[0.68rem] text-muted-2">
          <span>{enrollment.streakCurrent}d sequência</span>
          <span>{enrollment.pointsTotal.toLocaleString("pt-BR")} pts</span>
        </div>

        <ChallengeOpenLink challengeId={enrollment.challengeId} enrollmentId={enrollment.enrollmentId} href={cta.href}>
          {cta.label}
        </ChallengeOpenLink>
      </div>
    </article>
  );
}

/**
 * "Meus desafios" (Parte 6) - nunca ações destrutivas aqui (pausar/
 * abandonar continuam exclusivas do admin ou de telas dedicadas, nunca no
 * dashboard).
 */
export function ProfileChallengesSection({ enrollments }: { enrollments: ProfileEnrollmentSummary[] }) {
  if (enrollments.length === 0) {
    return (
      <section aria-labelledby="profile-challenges-heading" className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-action-soft" id="profile-challenges-heading">
          Meus desafios
        </h2>
        <EmptyState
          action={
            <Link
              className="inline-flex items-center gap-1.5 rounded-full border border-action/32 bg-action/14 px-4 py-2 text-xs font-semibold text-action-soft"
              href="/app/desafios"
            >
              <Flag aria-hidden="true" size={13} />
              Explorar desafios
            </Link>
          }
          description="Você ainda não iniciou um desafio."
          title="Nada por aqui ainda"
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="profile-challenges-heading" className="space-y-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-action-soft" id="profile-challenges-heading">
        Meus desafios
      </h2>

      {BUCKET_ORDER.map((bucket) => {
        const items = enrollments.filter((enrollment) => bucket.statuses.includes(enrollment.status));
        if (items.length === 0) return null;

        return (
          <div className="space-y-2.5" key={bucket.key}>
            <p className="text-xs font-semibold text-muted">
              {bucket.label} ({items.length})
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((enrollment) => (
                <ChallengeCoverCard enrollment={enrollment} key={enrollment.enrollmentId} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
