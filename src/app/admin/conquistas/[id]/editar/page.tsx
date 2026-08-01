import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { AchievementEditForm } from "@/components/admin/achievement-edit-form";
import { StatusCard } from "@/components/ui/feedback";
import { achievementIdSchema } from "@/features/admin/admin-achievements.schemas";
import { getAdminAchievementById } from "@/server/services/admin-achievements.service";

export const metadata: Metadata = {
  title: "Editar conquista · Administração",
};

type AdminEditarConquistaPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feedback?: string }>;
};

const feedbackMessages: Record<string, { description: string; title: string }> = {
  "create-success": { title: "Conquista criada", description: "Agora você pode ajustar os detalhes abaixo." },
};

export default async function AdminEditarConquistaPage({
  params,
  searchParams,
}: AdminEditarConquistaPageProps) {
  const { id } = await params;
  const parsedId = achievementIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  const { feedback: feedbackKey } = await searchParams;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;

  const { data: achievement, error } = await getAdminAchievementById(parsedId.data);

  if (error === "Conquista não encontrada.") {
    notFound();
  }

  if (error || !achievement) {
    return <StatusCard description={error ?? "Não foi possível carregar esta conquista."} title="Erro" tone="error" />;
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
        <h1 className="mt-3 text-2xl font-semibold text-foreground">{achievement.name}</h1>
      </div>

      {feedback ? <StatusCard description={feedback.description} title={feedback.title} tone="success" /> : null}

      <AchievementEditForm achievement={achievement} />
    </div>
  );
}
