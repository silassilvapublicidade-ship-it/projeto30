import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Lock, Trophy } from "lucide-react";

import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { enrollmentIdSchema } from "@/features/admin/admin-analytics.schemas";
import { pauseEnrollmentAction, resumeEnrollmentAction } from "@/features/admin/admin-challenges.actions";
import {
  describeActivity,
  describeEnrollmentStatus,
  formatCount,
  formatDate,
  formatPercent,
} from "@/features/admin/admin-metrics.core";
import { getAdminParticipantDetail } from "@/server/services/admin-analytics.service";

const enrollmentFeedbackMessages: Record<string, { description: string; title: string; tone: "error" | "success" }> = {
  "pause-success": {
    title: "Inscrição pausada",
    description: "A execução deste participante fica bloqueada até a retomada. Progresso preservado.",
    tone: "success",
  },
  "pause-blocked": {
    title: "Não foi possível pausar",
    description: "Apenas inscrições ativas podem ser pausadas.",
    tone: "error",
  },
  "resume-success": {
    title: "Inscrição retomada",
    description: "Os dias em que ficou pausada foram creditados de volta.",
    tone: "success",
  },
  "resume-blocked": {
    title: "Não foi possível retomar",
    description: "Apenas inscrições pausadas podem ser retomadas.",
    tone: "error",
  },
  error: {
    title: "Não foi possível concluir",
    description: "A ação falhou. Tente novamente.",
    tone: "error",
  },
  invalid: {
    title: "Solicitação inválida",
    description: "Identificador de inscrição ausente.",
    tone: "error",
  },
};

export const metadata: Metadata = {
  title: "Detalhe do participante · Administração",
};

type AdminParticipantDetailPageProps = {
  params: Promise<{ challengeId: string; enrollmentId: string }>;
  searchParams: Promise<{ feedback?: string }>;
};

export default async function AdminParticipantDetailPage({
  params,
  searchParams,
}: AdminParticipantDetailPageProps) {
  const { challengeId, enrollmentId } = await params;
  const { feedback: feedbackKey } = await searchParams;
  const parsedId = enrollmentIdSchema.safeParse(enrollmentId);

  if (!parsedId.success) {
    notFound();
  }

  const { data, error } = await getAdminParticipantDetail(parsedId.data);

  if (error === "Registro não encontrado.") {
    notFound();
  }

  if (error || !data) {
    return (
      <StatusCard
        description={error ?? "Não foi possível carregar este participante agora."}
        title="Detalhe indisponível"
        tone="error"
      />
    );
  }

  const backHref = `/admin/desafios/${challengeId}/participantes`;
  const selfHref = `/admin/desafios/${challengeId}/participantes/${enrollmentId}`;
  const feedback = feedbackKey ? enrollmentFeedbackMessages[feedbackKey] : undefined;
  const reflectionsWithContent = (data.reflections ?? []).filter((entry) =>
    [
      entry.content,
      entry.gratitude,
      entry.difficulty,
      entry.victory,
      entry.tomorrow_focus,
      entry.mood,
    ].some((value) => value && value.trim().length > 0),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href={backHref}
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para participantes
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{data.name || "Sem nome"}</h1>
            <p className="mt-1 text-sm text-muted">
              {data.email} · {data.challenge_name} · inscrito em {formatDate(data.joined_at)}
            </p>
          </div>
          {data.status === "active" || data.status === "paused" ? (
            <form action={data.status === "active" ? pauseEnrollmentAction : resumeEnrollmentAction}>
              <input name="enrollmentId" type="hidden" value={enrollmentId} />
              <input name="redirectTo" type="hidden" value={selfHref} />
              <Button size="md" type="submit" variant={data.status === "active" ? "secondary" : "primary"}>
                {data.status === "active" ? "Pausar inscrição" : "Retomar inscrição"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {feedback ? (
        <StatusCard description={feedback.description} title={feedback.title} tone={feedback.tone} />
      ) : null}

      <section aria-labelledby="participant-kpis" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="participant-kpis"
        >
          Progresso
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricCard
            label="Status"
            value={describeEnrollmentStatus(data.status)}
            hint={describeActivity(data.activity)}
          />
          <AdminMetricCard label="Progresso" value={formatPercent(data.completion_percent)} />
          <AdminMetricCard label="Pontos" value={formatCount(data.points_total)} />
          <AdminMetricCard
            label="Sequência atual / recorde"
            value={`${formatCount(data.streak_current)} / ${formatCount(data.streak_best)}`}
          />
        </div>
      </section>

      <section aria-labelledby="participant-achievements" className="space-y-3">
        <h2
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="participant-achievements"
        >
          <Trophy aria-hidden="true" size={13} />
          Conquistas
        </h2>
        {data.achievements.length === 0 ? (
          <EmptyState
            description="Nenhuma conquista desbloqueada até agora."
            title="Sem conquistas ainda"
          />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {data.achievements.map((achievement) => (
              <li
                className="rounded-[var(--radius-pill)] border border-action/28 bg-action/10 px-3 py-1.5 text-xs font-semibold text-action-soft"
                key={achievement.slug}
              >
                {achievement.name} · {formatDate(achievement.unlocked_at)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="participant-history" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="participant-history"
        >
          Histórico diário
        </h2>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/[0.08]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
              <tr>
                <th className="px-4 py-3 font-medium">Dia</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Progresso</th>
                <th className="px-4 py-3 font-medium">Pontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {data.daily_history.map((day) => (
                <tr key={day.day_number}>
                  <td className="px-4 py-3 text-foreground">Dia {day.day_number}</td>
                  <td className="px-4 py-3 text-muted">
                    {day.log_date ? formatDate(day.log_date) : "Não aberto"}
                  </td>
                  <td className="px-4 py-3 text-muted">{day.status ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {day.status ? formatPercent(day.completion_percent) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {day.points_earned !== null ? formatCount(day.points_earned) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="participant-reflections" className="space-y-3">
        <h2
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="participant-reflections"
        >
          Reflexões
        </h2>
        {!data.reflections_visible ? (
          <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-muted">
            <Lock aria-hidden="true" size={15} />
            Reflexões são visíveis apenas para super admin.
          </div>
        ) : reflectionsWithContent.length === 0 ? (
          <EmptyState
            description="Este participante ainda não escreveu nenhuma reflexão."
            title="Sem reflexões"
          />
        ) : (
          <div className="space-y-3">
            {reflectionsWithContent.map((entry) => (
              <div
                className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4"
                key={entry.log_date}
              >
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-action-soft">
                  {formatDate(entry.log_date)}
                </p>
                <dl className="mt-3 space-y-2 text-sm leading-6 text-muted">
                  {entry.content ? (
                    <div>
                      <dt className="font-semibold text-foreground">Como foi o dia</dt>
                      <dd>{entry.content}</dd>
                    </div>
                  ) : null}
                  {entry.gratitude ? (
                    <div>
                      <dt className="font-semibold text-foreground">Gratidão</dt>
                      <dd>{entry.gratitude}</dd>
                    </div>
                  ) : null}
                  {entry.difficulty ? (
                    <div>
                      <dt className="font-semibold text-foreground">O que pesou</dt>
                      <dd>{entry.difficulty}</dd>
                    </div>
                  ) : null}
                  {entry.victory ? (
                    <div>
                      <dt className="font-semibold text-foreground">O que venceu</dt>
                      <dd>{entry.victory}</dd>
                    </div>
                  ) : null}
                  {entry.tomorrow_focus ? (
                    <div>
                      <dt className="font-semibold text-foreground">Foco de amanhã</dt>
                      <dd>{entry.tomorrow_focus}</dd>
                    </div>
                  ) : null}
                  {entry.mood ? (
                    <div>
                      <dt className="font-semibold text-foreground">Humor</dt>
                      <dd>{entry.mood}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
