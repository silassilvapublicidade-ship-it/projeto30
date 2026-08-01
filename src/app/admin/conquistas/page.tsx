import type { Metadata } from "next";

import { AchievementRowActions } from "@/components/admin/achievement-row-actions";
import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { formatCount, formatPercent } from "@/features/admin/admin-metrics.core";
import { getAdminAchievementsAnalytics } from "@/server/services/admin-analytics.service";

export const metadata: Metadata = {
  title: "Conquistas · Administração",
};

function unlockRate(unlocked: number, enrollments: number): string {
  if (enrollments === 0) {
    return "—";
  }

  return formatPercent((unlocked / enrollments) * 100);
}

const feedbackMessages: Record<string, { description: string; title: string }> = {
  invalid: { title: "Solicitação inválida", description: "Identificador de conquista ausente." },
  error: { title: "Não foi possível concluir", description: "A ação falhou. Tente novamente." },
  "delete-success": { title: "Conquista excluída", description: "O registro foi removido." },
  "delete-blocked": {
    title: "Não foi possível excluir",
    description: "Esta conquista já foi desbloqueada por algum usuário. Desative-a em vez disso.",
  },
};

type AdminConquistasPageProps = {
  searchParams: Promise<{ feedback?: string }>;
};

export default async function AdminConquistasPage({ searchParams }: AdminConquistasPageProps) {
  const { feedback: feedbackKey } = await searchParams;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;
  const { data, error } = await getAdminAchievementsAnalytics();

  if (error || !data) {
    return (
      <StatusCard
        description={error ?? "Não foi possível carregar as conquistas agora."}
        title="Analytics indisponíveis"
        tone="error"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Conquistas</h1>
          <p className="mt-1 text-sm leading-6 text-muted">
            Metadados, desbloqueios e compartilhamentos por conquista, calculados a partir de
            user_achievements e share_cards.
          </p>
        </div>
        <Button as="a" href="/admin/conquistas/nova">
          Nova conquista
        </Button>
      </div>

      {feedback ? (
        <StatusCard
          description={feedback.description}
          title={feedback.title}
          tone={feedbackKey === "delete-success" ? "success" : "error"}
        />
      ) : null}

      <section aria-labelledby="achievements-global" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="achievements-global"
        >
          Compartilhamento global
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminMetricCard
            label="Compartilhamentos iniciados"
            value={formatCount(data.global_share_started)}
          />
          <AdminMetricCard
            label="Compartilhamentos concluídos"
            value={formatCount(data.global_share_completed)}
          />
        </div>
        <p className="font-mono text-[0.65rem] text-muted-2">
          Estes dois totais não podem ser atribuídos a uma conquista específica: o evento de
          compartilhamento não carrega o identificador da conquista.
        </p>
      </section>

      <section aria-labelledby="achievements-list" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="achievements-list"
        >
          Por conquista
        </h2>
        {data.achievements.length === 0 ? (
          <EmptyState
            description="Nenhuma conquista cadastrada ainda."
            title="Sem conquistas"
          />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/[0.08]">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
                <tr>
                  <th className="px-4 py-3 font-medium">Conquista</th>
                  <th className="px-4 py-3 font-medium">Desafio</th>
                  <th className="px-4 py-3 font-medium">Raridade</th>
                  <th className="px-4 py-3 font-medium">Desbloqueios</th>
                  <th className="px-4 py-3 font-medium">Taxa de desbloqueio</th>
                  <th className="px-4 py-3 font-medium">Cards gerados</th>
                  <th className="px-4 py-3 font-medium">Compartilhados</th>
                  <th className="px-4 py-3 font-medium">Baixados</th>
                  <th className="px-4 py-3 font-medium">Story · Feed</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {data.achievements.map((achievement) => (
                  <tr key={achievement.achievement_id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{achievement.name}</p>
                      {!achievement.active ? (
                        <p className="font-mono text-[0.65rem] text-muted-2">Inativa</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted">{achievement.challenge_name}</td>
                    <td className="px-4 py-3 text-muted">{achievement.rarity ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {formatCount(achievement.unlocked_count)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {unlockRate(achievement.unlocked_count, achievement.challenge_enrollment_count)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatCount(achievement.share_generated_count)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatCount(achievement.share_completed_count)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatCount(achievement.download_count)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatCount(achievement.story_count)} · {formatCount(achievement.feed_count)}
                    </td>
                    <td className="px-4 py-3">
                      <AchievementRowActions
                        achievementId={achievement.achievement_id}
                        achievementName={achievement.name}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
