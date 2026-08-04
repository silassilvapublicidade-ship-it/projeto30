import Link from "next/link";
import { Trophy } from "lucide-react";

import { AchievementArtShareButton } from "@/components/member/achievement-art-share-button";
import { AchievementShareButton } from "@/components/member/achievement-share-button";
import { ProfileAchievementShareTracker } from "@/components/member/profile-achievement-share-tracker";
import { EmptyState } from "@/components/ui/feedback";
import type { UnlockedAchievement } from "@/server/services/achievements.service";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

/**
 * Resumo de conquistas (Parte 9) - só as mais recentes, nunca duplica o
 * fluxo completo de /app/conquistas (que continua a fonte de verdade para
 * ver tudo, filtrar por desafio, etc). Mesmos cards premium (bordas,
 * gradiente, badge de raridade) e mesmos botões de compartilhar já usados
 * lá - nenhum componente novo de card reimplementado aqui.
 */
export function ProfileAchievementsSummary({
  displayName,
  recent,
  totalUnlocked,
}: {
  displayName: string | null;
  recent: UnlockedAchievement[];
  totalUnlocked: number;
}) {
  return (
    <section aria-labelledby="profile-achievements-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-action-soft"
          id="profile-achievements-heading"
        >
          <Trophy aria-hidden="true" size={13} />
          Conquistas ({totalUnlocked})
        </h2>
        <Link className="text-xs font-semibold text-muted transition-colors hover:text-foreground" href="/app/conquistas">
          Ver todas
        </Link>
      </div>

      {recent.length === 0 ? (
        <EmptyState description="Sua primeira conquista começa com o primeiro passo." title="Ainda sem conquistas" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((achievement) => (
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
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-2">
                Desbloqueada em {formatDate(achievement.unlockedAt)}
              </p>
              <ProfileAchievementShareTracker>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <AchievementShareButton
                    achievement={{
                      challengeName: achievement.challengeName,
                      name: achievement.name,
                      shareMessage: achievement.share_message,
                      shareTitle: achievement.share_title,
                    }}
                    displayName={displayName}
                  />
                  <AchievementArtShareButton userAchievementId={achievement.userAchievementId} />
                </div>
              </ProfileAchievementShareTracker>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
