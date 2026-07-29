import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, Lightbulb, ListChecks, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { joinChallengeAction } from "@/features/member/challenge-catalog.actions";
import {
  describeChallengeDisplayStatus,
  describeHabitGoal,
  getChallengeCta,
  getChallengeDisplayStatus,
  parseChallengeThemeConfig,
  parseHabitGoalConfig,
} from "@/features/member/challenge-catalog.core";
import { getChallengeDetailBySlug } from "@/server/services/challenge-catalog.service";
import { getTipsForChallenge } from "@/server/services/tips.service";

type DesafioDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ joinFeedback?: string; joinMessage?: string }>;
};

export async function generateMetadata({
  params,
}: DesafioDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getChallengeDetailBySlug(slug);
  return { title: detail?.challenge.name ?? "Desafio" };
}

const habitTypeLabels: Record<string, string> = {
  boolean: "Sim/Não",
  duration: "Duração",
  multiple_choice: "Múltipla escolha",
  quantity: "Quantidade",
  reading: "Leitura",
  single_choice: "Escolha única",
  text: "Texto",
};

export default async function DesafioDetailPage({
  params,
  searchParams,
}: DesafioDetailPageProps) {
  const { slug } = await params;
  const { joinFeedback, joinMessage } = await searchParams;
  const detail = await getChallengeDetailBySlug(slug);

  if (!detail) {
    notFound();
  }

  const { achievements, challenge, habits, localDate, ownEnrollment } = detail;
  const challengeTips = await getTipsForChallenge(challenge.id);

  const displayStatus = getChallengeDisplayStatus({
    challengeStatus: challenge.status,
    enrollmentStart: challenge.enrollment_start,
    enrollmentStatus: ownEnrollment?.status ?? null,
    localDate,
  });
  const cta = getChallengeCta(displayStatus);
  const theme = parseChallengeThemeConfig(challenge.theme_config);
  const joinLabel = cta.kind === "join" ? (theme.cta_label ?? cta.label) : cta.label;
  // headline is a presentational hero heading distinct from the relational
  // `name` column (source of truth); falls back to it when unset.
  const heroHeadline = theme.headline ?? challenge.name;

  return (
    <div className="space-y-8">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/app/desafios"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para desafios
        </Link>
      </div>

      {joinFeedback && joinFeedback !== "success" ? (
        <StatusCard
          description={
            joinMessage ? decodeURIComponent(joinMessage) : "Não foi possível concluir a inscrição."
          }
          title="Não foi possível participar"
          tone="error"
        />
      ) : null}

      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] p-6 shadow-[var(--shadow-soft)] sm:p-10">
        {theme.cover_image_url ? (
          // object-contain: this cover may be a poster with baked-in text
          // (headline, habit list, CTA) - cropping to fill would cut
          // important content. The black backdrop blends with the poster's
          // own dark background.
          <>
            <div aria-hidden="true" className="absolute inset-0 -z-30 bg-black" />
            <Image
              alt=""
              className="absolute inset-0 -z-20 object-contain"
              fill
              priority
              sizes="100vw"
              src={theme.cover_image_url}
            />
          </>
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-20 bg-[linear-gradient(155deg,rgba(255,106,0,0.22),rgba(9,10,11,0.95))]"
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,10,11,0.35),rgba(9,10,11,0.92))]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-[radial-gradient(circle,rgba(255,154,61,0.32),transparent_70%)] blur-3xl"
        />
        <span className="relative inline-flex rounded-full border border-white/[0.12] bg-white/[0.06] px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-action-soft">
          {describeChallengeDisplayStatus(displayStatus)}
        </span>
        <h1 className="relative mt-4 font-display text-4xl leading-[1.05] text-foreground sm:text-5xl">
          {heroHeadline}
        </h1>
        {theme.subheadline ? (
          <p className="relative mt-2 max-w-2xl text-lg font-medium leading-7 text-action-soft">
            {theme.subheadline}
          </p>
        ) : null}
        {challenge.description ? (
          <p className="relative mt-4 max-w-2xl whitespace-pre-line text-base leading-7 text-white/80">
            {challenge.description}
          </p>
        ) : null}
        {theme.tagline ? (
          <p className="relative mt-4 max-w-2xl font-display text-xl italic leading-8 text-foreground">
            &ldquo;{theme.tagline}&rdquo;
          </p>
        ) : null}
        {theme.hero_message ? (
          <p className="relative mt-2 max-w-2xl text-sm leading-6 text-white/70">
            {theme.hero_message}
          </p>
        ) : null}

        <div className="relative mt-6 flex flex-wrap gap-2 font-mono text-xs text-white/70">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-black/20 px-3 py-1">
            <CalendarDays aria-hidden="true" size={13} />
            {challenge.duration_days} dias
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-black/20 px-3 py-1">
            <ListChecks aria-hidden="true" size={13} />
            {habits.length} hábitos
          </span>
          {achievements.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-black/20 px-3 py-1">
              <Trophy aria-hidden="true" size={13} />
              {achievements.length} conquistas
            </span>
          ) : null}
        </div>

        <div className="relative mt-8">
          {cta.kind === "join" ? (
            <div className="space-y-2">
              <form action={joinChallengeAction}>
                <input name="challengeId" type="hidden" value={challenge.id} />
                <input name="challengeSlug" type="hidden" value={challenge.slug} />
                <Button size="lg" type="submit">
                  {joinLabel}
                </Button>
              </form>
              {theme.cta_supporting_text ? (
                <p className="font-mono text-xs text-muted-2">{theme.cta_supporting_text}</p>
              ) : null}
            </div>
          ) : cta.kind === "continue" ? (
            <Button as="a" href="/app/hoje" size="lg">
              {cta.label}
            </Button>
          ) : (
            <StatusCard
              description="Este desafio não aceita novas inscrições no momento."
              title={cta.label}
              tone="success"
            />
          )}
        </div>
      </section>

      {habits.length > 0 ? (
        <section aria-labelledby="challenge-habits" className="space-y-3">
          <h2
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
            id="challenge-habits"
          >
            Hábitos previstos
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {habits.map((habit) => {
              const goalConfig = parseHabitGoalConfig(habit.validation_config);
              const goalLabel = describeHabitGoal({
                frequencyType: habit.frequency_type,
                target: goalConfig.target,
                unit: goalConfig.unit,
              });

              const frequencyBadgeLabel =
                habit.frequency_type === "weekly"
                  ? "Meta semanal"
                  : habit.frequency_type === "monthly"
                    ? "Meta mensal"
                    : null;

              return (
                <li
                  className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4"
                  key={habit.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{habit.title}</p>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <span className="rounded-full border border-white/[0.08] px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted-2">
                        {habit.is_required ? "Essencial" : "Opcional"}
                      </span>
                      {frequencyBadgeLabel ? (
                        <span className="rounded-full border border-action/28 bg-action/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-action-soft">
                          {frequencyBadgeLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {habit.description ? (
                    <p className="mt-1.5 text-xs leading-5 text-muted">{habit.description}</p>
                  ) : null}
                  <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.08em] text-muted-2">
                    {goalLabel} · {habitTypeLabels[habit.habit_type] ?? habit.habit_type} ·{" "}
                    {habit.points} pts
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {challengeTips.length > 0 ? (
        <section aria-labelledby="challenge-tips" className="space-y-3">
          <h2
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
            id="challenge-tips"
          >
            <Lightbulb aria-hidden="true" size={13} />
            Dicas para este desafio
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {challengeTips.map((tip) => (
              <li key={tip.id}>
                <Link
                  className="block rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 transition-colors hover:border-white/16"
                  href={`/app/dicas/${tip.slug}`}
                >
                  <p className="text-sm font-semibold text-foreground">{tip.title}</p>
                  {tip.excerpt ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{tip.excerpt}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {achievements.length > 0 ? (
        <section aria-labelledby="challenge-achievements" className="space-y-3">
          <h2
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
            id="challenge-achievements"
          >
            Conquistas
          </h2>
          <ul className="flex flex-wrap gap-2">
            {achievements.map((achievement) => (
              <li
                className="rounded-[var(--radius-pill)] border border-action/24 bg-action/[0.08] px-3 py-1.5 text-xs font-semibold text-action-soft"
                key={achievement.id}
                title={achievement.description ?? undefined}
              >
                {achievement.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
