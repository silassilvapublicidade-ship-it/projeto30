import Link from "next/link";
import type { Metadata } from "next";
import { Lock, Medal, Trophy } from "lucide-react";

import { AchievementShareButton } from "@/components/member/achievement-share-button";
import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { getMemberAchievements } from "@/server/services/achievements.service";
import { getMemberContext } from "@/server/services/member-area.service";

export const metadata: Metadata = {
  title: "Conquistas",
};

type ConquistasPageProps = {
  searchParams: Promise<{ desafio?: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function ConquistasPage({ searchParams }: ConquistasPageProps) {
  const { desafio } = await searchParams;
  const [{ locked, participatedChallenges, unlocked }, context] = await Promise.all([
    getMemberAchievements(),
    getMemberContext(),
  ]);

  const displayName =
    context.profile.display_name || context.profile.name || null;

  const filteredUnlocked = desafio
    ? unlocked.filter((achievement) => achievement.challenge_id === desafio)
    : unlocked;
  const filteredLocked = desafio
    ? locked.filter((achievement) => achievement.challenge_id === desafio)
    : locked;

  const hasAnyAchievementData = unlocked.length > 0 || locked.length > 0;

  return (
    <MemberEmptyPage
      description="Conquistas são liberadas a partir de eventos reais da jornada - nada aqui é exibido sem ter sido de fato desbloqueado."
      icon={Medal}
      title="Conquistas"
    >
      {hasAnyAchievementData ? (
        <div className="space-y-8">
          {participatedChallenges.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por desafio">
              <Link
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  !desafio
                    ? "border-action/32 bg-action/14 text-action-soft"
                    : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground"
                }`}
                href="/app/conquistas"
              >
                Todos os desafios
              </Link>
              {participatedChallenges.map((challenge) => (
                <Link
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    desafio === challenge.id
                      ? "border-action/32 bg-action/14 text-action-soft"
                      : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground"
                  }`}
                  href={`/app/conquistas?desafio=${challenge.id}`}
                  key={challenge.id}
                >
                  {challenge.name}
                </Link>
              ))}
            </div>
          ) : null}

          <section aria-labelledby="unlocked-achievements" className="space-y-3">
            <h2
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
              id="unlocked-achievements"
            >
              <Trophy aria-hidden="true" size={13} />
              Desbloqueadas ({filteredUnlocked.length})
            </h2>
            {filteredUnlocked.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredUnlocked.map((achievement) => (
                  <div
                    className="flex flex-col gap-3 rounded-[1.5rem] border border-action/24 bg-[linear-gradient(180deg,rgba(255,106,0,0.08),rgba(255,255,255,0.02))] p-4"
                    key={achievement.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{achievement.name}</p>
                        {achievement.challengeName ? (
                          <p className="text-xs text-muted-2">{achievement.challengeName}</p>
                        ) : null}
                      </div>
                      {achievement.rarity ? (
                        <span className="shrink-0 rounded-full border border-action/28 bg-action/10 px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-action-soft">
                          {achievement.rarity}
                        </span>
                      ) : null}
                    </div>
                    {achievement.description ? (
                      <p className="text-xs leading-5 text-muted">{achievement.description}</p>
                    ) : null}
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-2">
                      Desbloqueada em {formatDate(achievement.unlockedAt)}
                    </p>
                    <div className="mt-auto pt-1">
                      <AchievementShareButton
                        achievement={{
                          challengeName: achievement.challengeName,
                          name: achievement.name,
                          shareMessage: achievement.share_message,
                          shareTitle: achievement.share_title,
                        }}
                        displayName={displayName}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">
                Nenhuma conquista desbloqueada ainda{desafio ? " neste desafio" : ""}.
              </p>
            )}
          </section>

          <section aria-labelledby="locked-achievements" className="space-y-3">
            <h2
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
              id="locked-achievements"
            >
              <Lock aria-hidden="true" size={13} />
              Bloqueadas ({filteredLocked.length})
            </h2>
            {filteredLocked.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredLocked.map((achievement) => (
                  <div
                    className="flex flex-col gap-2 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.02] p-4 opacity-80"
                    key={achievement.id}
                  >
                    <p className="text-sm font-semibold text-foreground">{achievement.name}</p>
                    {achievement.challengeName ? (
                      <p className="text-xs text-muted-2">{achievement.challengeName}</p>
                    ) : null}
                    {achievement.description ? (
                      <p className="text-xs leading-5 text-muted">{achievement.description}</p>
                    ) : null}
                    {achievement.progress ? (
                      <div className="mt-1 space-y-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-white/25"
                            style={{
                              width: `${Math.min(100, Math.round((achievement.progress.current / achievement.progress.target) * 100))}%`,
                            }}
                          />
                        </div>
                        <p className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted-2">
                          {achievement.progress.current} de {achievement.progress.target}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">
                Todas as conquistas disponíveis{desafio ? " neste desafio" : ""} já foram
                desbloqueadas.
              </p>
            )}
          </section>
        </div>
      ) : undefined}
    </MemberEmptyPage>
  );
}
