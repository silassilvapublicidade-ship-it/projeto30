import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { AchievementCreateForm } from "@/components/admin/achievement-create-form";
import { StatusCard } from "@/components/ui/feedback";
import { listAdminAchievements } from "@/server/services/admin-achievements.service";
import { listChallengesForTipPicker } from "@/server/services/admin-tips.service";

export const metadata: Metadata = {
  title: "Nova conquista · Administração",
};

export default async function AdminNovaConquistaPage() {
  const [challenges, { data: achievements, error }] = await Promise.all([
    listChallengesForTipPicker(),
    listAdminAchievements(),
  ]);

  const usedSlugsByChallengeId: Record<string, string[]> = {};
  for (const achievement of achievements ?? []) {
    const list = usedSlugsByChallengeId[achievement.challenge_id] ?? [];
    list.push(achievement.slug);
    usedSlugsByChallengeId[achievement.challenge_id] = list;
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/admin/conquistas"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para conquistas
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Nova conquista</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Escolha um desafio e um tipo de regra já suportado pelo motor de desbloqueio. Metadados
          (nome, descrição, ícone, textos) são totalmente seus; o tipo de regra não é editável
          depois de criado.
        </p>
      </div>

      {error ? <StatusCard description={error} title="Não foi possível carregar" tone="error" /> : null}

      {challenges.length === 0 ? (
        <StatusCard
          description="Crie um desafio antes de cadastrar conquistas para ele."
          title="Nenhum desafio disponível"
          tone="error"
        />
      ) : (
        <AchievementCreateForm challenges={challenges} usedSlugsByChallengeId={usedSlugsByChallengeId} />
      )}
    </div>
  );
}
