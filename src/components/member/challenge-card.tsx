import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  describeChallengeDisplayStatus,
  getChallengeCta,
  getChallengeDisplayStatus,
  parseChallengeThemeConfig,
  type ChallengeDisplayStatus,
} from "@/features/member/challenge-catalog.core";
import { cn } from "@/lib/utils";
import type { CatalogChallenge } from "@/server/services/challenge-catalog.service";

import { joinChallengeAction } from "@/features/member/challenge-catalog.actions";

const badgeTone: Record<ChallengeDisplayStatus, string> = {
  abandoned: "border-white/[0.1] bg-white/[0.06] text-muted",
  available: "border-action/28 bg-action/10 text-action-soft",
  coming_soon: "border-white/[0.1] bg-white/[0.06] text-muted",
  completed: "border-success/24 bg-success-wash text-success",
  ended: "border-white/[0.08] bg-white/[0.04] text-muted-2",
  joined: "border-action/32 bg-action/14 text-action-soft",
  unavailable: "border-white/[0.08] bg-white/[0.04] text-muted-2",
};

export function ChallengeCard({
  challenge,
  hasActiveEnrollmentElsewhere,
  localDate,
}: {
  challenge: CatalogChallenge;
  hasActiveEnrollmentElsewhere: boolean;
  localDate: string;
}) {
  const displayStatus = getChallengeDisplayStatus({
    challengeStatus: challenge.status,
    enrollmentStart: challenge.enrollment_start,
    enrollmentStatus: challenge.enrollment?.status ?? null,
    localDate,
  });
  const cta = getChallengeCta(displayStatus, hasActiveEnrollmentElsewhere);
  const detailHref = `/app/desafios/${challenge.slug}`;
  const theme = parseChallengeThemeConfig(challenge.theme_config);
  const cardTitle = theme.short_title ?? challenge.name;
  const cardDescription = theme.short_description ?? challenge.description;

  return (
    <article className="flex flex-col overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03] shadow-[var(--shadow-soft)] transition-[border-color,transform] duration-[var(--motion-base)] hover:-translate-y-0.5 hover:border-white/16">
      <Link
        aria-label={`Ver detalhe de ${challenge.name}`}
        className="relative flex aspect-[16/9] w-full items-end overflow-hidden p-5 focus-visible:outline-action-soft"
        href={detailHref}
      >
        {challenge.cover_image_url ? (
          <Image
            alt=""
            className="absolute inset-0 -z-10 object-cover"
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            src={challenge.cover_image_url}
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(155deg,rgba(255,106,0,0.28),rgba(9,10,11,0.94))]"
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,10,11,0.05),rgba(9,10,11,0.85))]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full bg-[radial-gradient(circle,rgba(255,154,61,0.35),transparent_70%)] blur-2xl"
        />
        <span
          className={cn(
            "absolute right-4 top-4 rounded-full border px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em]",
            badgeTone[displayStatus],
          )}
        >
          {describeChallengeDisplayStatus(displayStatus)}
        </span>
        <h3 className="relative font-display text-2xl leading-tight text-foreground sm:text-3xl">
          {cardTitle}
        </h3>
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {cardDescription ? (
          <p className="line-clamp-2 text-sm leading-6 text-muted">{cardDescription}</p>
        ) : null}

        <div className="flex flex-wrap gap-2 font-mono text-xs text-muted-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1">
            <CalendarDays aria-hidden="true" size={13} />
            {challenge.duration_days} dias
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1">
            <ListChecks aria-hidden="true" size={13} />
            {challenge.habitCount} hábitos
          </span>
        </div>

        {displayStatus === "joined" ? (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--p30-orange),var(--p30-amber))]"
                style={{ width: `${Math.min(100, Math.max(0, challenge.enrollment?.completion_percent ?? 0))}%` }}
              />
            </div>
            <p className="font-mono text-[0.68rem] text-muted-2">
              Dia {challenge.enrollment?.current_day ?? 1} de {challenge.duration_days} ·{" "}
              {Math.round(challenge.enrollment?.completion_percent ?? 0)}%
            </p>
          </div>
        ) : null}

        <div className="mt-auto pt-1">
          {cta.kind === "join" ? (
            <form action={joinChallengeAction}>
              <input name="challengeId" type="hidden" value={challenge.id} />
              <input name="challengeSlug" type="hidden" value={challenge.slug} />
              <Button className="w-full" size="sm" type="submit">
                {cta.label}
              </Button>
            </form>
          ) : cta.kind === "continue" ? (
            <Button as="a" className="w-full" href="/app/hoje" size="sm">
              {cta.label}
            </Button>
          ) : (
            <Button as="a" className="w-full" href={detailHref} size="sm" variant="secondary">
              {cta.label}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
