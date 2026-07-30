import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, ListChecks } from "lucide-react";

import { StatusCard } from "@/components/ui/feedback";
import { challengeIdParamSchema } from "@/features/admin/challenge-editor.schemas";
import { describeHabitGoal, parseChallengeThemeConfig, parseHabitGoalConfig } from "@/features/member/challenge-catalog.core";
import { getChallengeEditorData } from "@/server/services/admin-challenge-editor.service";

export const metadata: Metadata = {
  title: "Preview do desafio · Administração",
};

const habitTypeLabels: Record<string, string> = {
  boolean: "Sim/Não",
  duration: "Duração",
  quantity: "Quantidade",
  reading: "Leitura",
};

/**
 * Simulação visual estática do catálogo/detalhe/lista de hábitos, para uso
 * administrativo antes da publicação. Deliberadamente NÃO reaproveita o
 * componente ChallengeCard/formulário de adesão real (src/components/member/
 * challenge-card.tsx) - aquele componente é escrito para desafios já ativos
 * e inclui um <form action={joinChallengeAction}> real; reaproveitá-lo aqui
 * arriscaria um admin disparar uma inscrição real (ou tentar, contra um
 * desafio em rascunho) só para visualizar o card. Este preview nunca cria
 * inscrição, daily_log ou qualquer dado de usuário - é puramente leitura.
 */
export default async function PreviewDesafioPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId: rawChallengeId } = await params;
  const parsedId = challengeIdParamSchema.safeParse(rawChallengeId);

  if (!parsedId.success) {
    notFound();
  }

  const editorData = await getChallengeEditorData(parsedId.data);

  if (!editorData) {
    notFound();
  }

  const { challenge, habits } = editorData;
  const theme = parseChallengeThemeConfig(challenge.theme_config);
  const heroHeadline = theme.headline ?? challenge.name;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href={`/admin/desafios/${challenge.id}/editar`}
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para edição
        </Link>
      </div>

      <StatusCard
        description="Simulação visual, somente leitura. Nenhuma inscrição ou dado de usuário é criado aqui."
        title="Modo preview"
        tone="error"
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] p-6 shadow-[var(--shadow-soft)] sm:p-10">
        {theme.cover_image_url ? (
          <>
            <div aria-hidden="true" className="absolute inset-0 -z-30 bg-black" />
            <Image
              alt=""
              className="absolute inset-0 -z-20 object-contain"
              fill
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
        <h1 className="relative font-display text-4xl leading-[1.05] text-foreground sm:text-5xl">
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
        <div className="relative mt-6 flex flex-wrap gap-2 font-mono text-xs text-white/70">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-black/20 px-3 py-1">
            <CalendarDays aria-hidden="true" size={13} />
            {challenge.duration_days} dias
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-black/20 px-3 py-1">
            <ListChecks aria-hidden="true" size={13} />
            {habits.length} hábitos
          </span>
        </div>
        <div className="relative mt-8 inline-flex rounded-[var(--radius-pill)] border border-action bg-action px-5 py-3 text-sm font-semibold text-background opacity-80">
          {theme.cta_label ?? "Participar do desafio"} (inativo no preview)
        </div>
      </section>

      {habits.length > 0 ? (
        <section aria-labelledby="preview-habits" className="space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2" id="preview-habits">
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
                    {goalLabel} · {habitTypeLabels[habit.habit_type] ?? habit.habit_type} · {habit.points} pts
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <StatusCard
          description="Adicione hábitos na tela de edição para vê-los aqui."
          title="Nenhum hábito ainda"
          tone="error"
        />
      )}
    </div>
  );
}
