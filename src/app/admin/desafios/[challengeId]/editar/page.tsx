import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Eye, Trash2 } from "lucide-react";

import { ChallengeDayMessagesEditor } from "@/components/admin/challenge-day-messages-editor";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { HabitNotificationFields } from "@/components/admin/habit-notification-fields";
import { HabitVisibilityFields } from "@/components/admin/habit-visibility-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusCard } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { publishChallengeAction } from "@/features/admin/admin-challenges.actions";
import { challengeIdParamSchema } from "@/features/admin/challenge-editor.schemas";
import {
  addHabitAction,
  duplicateChallengeAsDraftAction,
  generateChallengeDaysAction,
  removeHabitAction,
  updateChallengeCalendarAndRulesAction,
  updateChallengeIdentityAction,
  updateHabitVisibilityAction,
} from "@/features/admin/challenge-editor.actions";
import { describeChallengeLifecycleStage } from "@/features/admin/challenge-editor.core";
import { describeChallengeStatus } from "@/features/admin/admin-metrics.core";
import { upsertHabitNotificationConfigAction } from "@/features/admin/habit-notifications.actions";
import { describeHabitVisibility } from "@/features/journey/habit-visibility.core";
import { getChallengeEditorData } from "@/server/services/admin-challenge-editor.service";

export const metadata: Metadata = {
  title: "Editar desafio · Administração",
};

const feedbackMessages: Record<string, { description: string; title: string; tone: "success" | "error" }> = {
  "days-generated": { description: "Estrutura de dias gerada/atualizada.", title: "Dias gerados", tone: "success" },
  "draft-only": {
    description: "A geração de dias só pode ser executada com o desafio em rascunho.",
    title: "Ação indisponível",
    tone: "error",
  },
  error: { description: "Não foi possível concluir a ação agora.", title: "Erro", tone: "error" },
  "habit-added": { description: "Hábito adicionado.", title: "Hábito salvo", tone: "success" },
  "habit-removed": { description: "Hábito removido.", title: "Hábito removido", tone: "success" },
  "visibility-updated": {
    description: "A janela de exibição deste item foi atualizada.",
    title: "Visibilidade salva",
    tone: "success",
  },
  "habit-notification-saved": {
    description: "O lembrete inteligente deste hábito foi atualizado.",
    title: "Notificação salva",
    tone: "success",
  },
  "habit-notification-invalid": {
    description: "Revise título, mensagem, horário e frequência do lembrete.",
    title: "Dados inválidos",
    tone: "error",
  },
  "habit-notification-error": {
    description: "Não foi possível salvar a notificação agora.",
    title: "Erro",
    tone: "error",
  },
  "identity-success": { description: "Identidade atualizada.", title: "Salvo", tone: "success" },
  invalid: { description: "Revise os campos e tente novamente.", title: "Dados inválidos", tone: "error" },
  "message-saved": { description: "Mensagem do dia atualizada.", title: "Salvo", tone: "success" },
  "message-copied": {
    description: "Mensagem copiada para os dias do intervalo selecionado.",
    title: "Mensagens atualizadas",
    tone: "success",
  },
  "message-invalid": {
    description: "Revise o dia e o texto da mensagem antes de salvar.",
    title: "Dados inválidos",
    tone: "error",
  },
  "message-day-not-found": {
    description: "Este dia não existe na estrutura atual do ciclo.",
    title: "Dia não encontrado",
    tone: "error",
  },
  "rules-success": { description: "Calendário e regras atualizados.", title: "Salvo", tone: "success" },
  "slug-taken": { description: "Já existe um desafio com esse slug.", title: "Slug em uso", tone: "error" },
  "structural-blocked": {
    description: "Este desafio já tem participantes - alterações estruturais (duração, hábitos) estão bloqueadas.",
    title: "Alteração bloqueada",
    tone: "error",
  },
  "validation-failed": {
    description: "Adicione hábitos, gere os dias e confira nome/slug antes de publicar.",
    title: "Não é possível publicar ainda",
    tone: "error",
  },
};

const habitTypeLabels: Record<string, string> = {
  boolean: "Sim/Não",
  duration: "Duração",
  quantity: "Quantidade",
  reading: "Leitura",
};

type PageProps = {
  params: Promise<{ challengeId: string }>;
  searchParams: Promise<{ feedback?: string }>;
};

export default async function EditarDesafioPage({ params, searchParams }: PageProps) {
  const { challengeId: rawChallengeId } = await params;
  const parsedId = challengeIdParamSchema.safeParse(rawChallengeId);

  if (!parsedId.success) {
    notFound();
  }

  const { feedback: feedbackKey } = await searchParams;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;

  const editorData = await getChallengeEditorData(parsedId.data);

  if (!editorData) {
    notFound();
  }

  const { challenge, daysCount, habits, hasParticipants } = editorData;
  const theme = (challenge.theme_config ?? {}) as unknown as Record<string, string | undefined>;
  const rules = (challenge.rules_config ?? {}) as unknown as Record<string, unknown>;
  const lifecycleStage = describeChallengeLifecycleStage(challenge.status, hasParticipants);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href={`/admin/desafios/${challenge.id}`}
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para o detalhe
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{challenge.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={challenge.status === "active" ? "success" : "neutral"}>
                {describeChallengeStatus(challenge.status)}
              </Badge>
              {hasParticipants ? (
                <Badge tone="warning">
                  {editorData.participantCount} participante(s) - estrutura congelada
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              as="a"
              href={`/admin/desafios/${challenge.id}/preview`}
              leadingIcon={<Eye aria-hidden="true" size={15} />}
              variant="secondary"
            >
              Preview
            </Button>
            <form action={duplicateChallengeAsDraftAction}>
              <input name="challengeId" type="hidden" value={challenge.id} />
              <Button type="submit" variant="secondary">
                Duplicar como rascunho
              </Button>
            </form>
          </div>
        </div>
      </div>

      {feedback ? (
        <StatusCard description={feedback.description} title={feedback.title} tone={feedback.tone} />
      ) : null}

      {lifecycleStage === "published_with_participants" ? (
        <StatusCard
          description="Textos e imagens (identidade) continuam livres. Duração, hábitos e dias estão bloqueados - use 'Duplicar como rascunho' para uma versão estrutural nova."
          title="Estrutura congelada"
          tone="error"
        />
      ) : null}

      <Card tone="glass">
        <CardHeader>
          <CardTitle>Identidade</CardTitle>
          <CardDescription>Sempre editável, mesmo com participantes.</CardDescription>
        </CardHeader>
        <form action={updateChallengeIdentityAction} className="mt-4 space-y-4">
          <input name="challengeId" type="hidden" value={challenge.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <Input defaultValue={challenge.name} maxLength={120} name="name" required />
            </Field>
            <Field label="Slug">
              <Input defaultValue={challenge.slug} maxLength={120} name="slug" required />
            </Field>
          </div>
          <Field hint="Descrição relacional (usada em listagens administrativas)." label="Descrição">
            <Textarea defaultValue={challenge.description ?? ""} maxLength={4000} name="description" rows={3} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field hint="Título de destaque na página do desafio." label="Headline">
              <Input defaultValue={theme.headline ?? ""} maxLength={120} name="headline" />
            </Field>
            <Field label="Subheadline">
              <Input defaultValue={theme.subheadline ?? ""} maxLength={160} name="subheadline" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tagline">
              <Input defaultValue={theme.tagline ?? ""} maxLength={160} name="tagline" />
            </Field>
            <Field hint="Card do catálogo." label="Descrição curta">
              <Input defaultValue={theme.short_description ?? ""} maxLength={220} name="shortDescription" />
            </Field>
          </div>
          <Field label="Mensagem complementar (hero)">
            <Textarea defaultValue={theme.hero_message ?? ""} maxLength={300} name="heroMessage" rows={2} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Texto do botão (CTA)">
              <Input defaultValue={theme.cta_label ?? ""} maxLength={60} name="ctaLabel" />
            </Field>
            <Field label="Texto complementar do CTA">
              <Input defaultValue={theme.cta_supporting_text ?? ""} maxLength={160} name="ctaSupportingText" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria">
              <Input defaultValue={theme.category ?? ""} maxLength={60} name="themeCategory" />
            </Field>
            <Field label="Tema visual">
              <Input defaultValue={theme.visual_style ?? ""} maxLength={60} name="visualStyle" />
            </Field>
          </div>
          <Button type="submit">Salvar identidade</Button>
        </form>
      </Card>

      <Card tone="glass">
        <CardHeader>
          <CardTitle>Calendário e regras</CardTitle>
          <CardDescription>
            Duração é estrutural (bloqueada com participantes); janela de inscrição, limite e
            pontos são operacionais (sempre editáveis).
          </CardDescription>
        </CardHeader>
        <form action={updateChallengeCalendarAndRulesAction} className="mt-4 space-y-4">
          <input name="challengeId" type="hidden" value={challenge.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              error={hasParticipants ? "Bloqueado - já há participantes." : undefined}
              label="Duração (dias)"
            >
              <Input
                defaultValue={challenge.duration_days}
                disabled={hasParticipants}
                max={366}
                min={1}
                name="durationDays"
                required
                type="number"
              />
            </Field>
            <Field label="Data de início">
              <Input defaultValue={challenge.start_date ?? ""} name="startDate" type="date" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data de término">
              <Input defaultValue={challenge.end_date ?? ""} name="endDate" type="date" />
            </Field>
            <Field label="Limite de participantes">
              <Input
                defaultValue={typeof rules.participant_limit === "number" ? rules.participant_limit : ""}
                min={1}
                name="participantLimit"
                type="number"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início das inscrições">
              <Input defaultValue={challenge.enrollment_start ?? ""} name="enrollmentStart" type="date" />
            </Field>
            <Field label="Fim das inscrições">
              <Input defaultValue={challenge.enrollment_end ?? ""} name="enrollmentEnd" type="date" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox
              defaultChecked={rules.allow_join_after_start !== false}
              label="Permitir entrar depois do início"
              name="allowJoinAfterStart"
            />
            <Checkbox
              defaultChecked={rules.allow_abandonment !== false}
              label="Permitir abandono"
              name="allowAbandonment"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Pontos ao finalizar o dia">
              <Input
                defaultValue={typeof rules.finalize_day_points === "number" ? rules.finalize_day_points : 10}
                min={0}
                name="finalizeDayPoints"
                type="number"
              />
            </Field>
            <Field label="Pontos de reflexão">
              <Input
                defaultValue={typeof rules.reflection_points === "number" ? rules.reflection_points : 10}
                min={0}
                name="reflectionPoints"
                type="number"
              />
            </Field>
            <Field label="Bônus todos os hábitos">
              <Input
                defaultValue={
                  typeof rules.all_habits_bonus_points === "number" ? rules.all_habits_bonus_points : 30
                }
                min={0}
                name="allHabitsBonusPoints"
                type="number"
              />
            </Field>
          </div>
          <Field hint="Percentual mínimo de conclusão do dia para contar na sequência." label="Sequência mínima (%)">
            <Input
              defaultValue={
                typeof rules.streak_minimum_completion === "number" ? rules.streak_minimum_completion : 70
              }
              max={100}
              min={0}
              name="streakMinimumCompletion"
              step="0.1"
              type="number"
            />
          </Field>
          <Button type="submit">Salvar calendário e regras</Button>
        </form>
      </Card>

      <Card tone="glass">
        <CardHeader>
          <CardTitle>Hábitos ({habits.length})</CardTitle>
          <CardDescription>
            {hasParticipants
              ? "Bloqueado - este desafio já tem participantes."
              : "Adicione, remova. Tipos suportados pela jornada: sim/não, quantidade, duração, leitura."}
          </CardDescription>
        </CardHeader>
        <ul className="mt-4 space-y-2">
          {habits.map((habit) => (
            <li
              className="space-y-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-3"
              key={habit.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{habit.title}</p>
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.08em] text-muted-2">
                    {habitTypeLabels[habit.habit_type] ?? habit.habit_type} · {habit.points} pts ·{" "}
                    {habit.is_required ? "obrigatório" : "opcional"} ·{" "}
                    {describeHabitVisibility(habit.visibility_config, challenge.duration_days)}
                    {habit.notificationConfig?.enabled ? " · Lembrete ativo" : ""}
                  </p>
                </div>
                {!hasParticipants ? (
                  <form action={removeHabitAction}>
                    <input name="challengeId" type="hidden" value={challenge.id} />
                    <input name="habitId" type="hidden" value={habit.id} />
                    <ConfirmSubmitButton
                      confirmMessage="Remover este hábito do desafio?"
                      size="xs"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" size={13} />
                      Remover
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
              </div>

              <details className="rounded-[var(--radius-control)] border border-white/[0.06] bg-black/15 p-3">
                <summary className="cursor-pointer select-none text-xs font-semibold text-muted">
                  Quando este item aparece
                </summary>
                <form action={updateHabitVisibilityAction} className="mt-3 space-y-3">
                  <input name="challengeId" type="hidden" value={challenge.id} />
                  <input name="habitId" type="hidden" value={habit.id} />
                  <HabitVisibilityFields
                    durationDays={challenge.duration_days}
                    initialVisibilityConfig={habit.visibility_config}
                  />
                  <Button size="sm" type="submit" variant="secondary">
                    Salvar visibilidade
                  </Button>
                </form>
              </details>

              <details className="rounded-[var(--radius-control)] border border-white/[0.06] bg-black/15 p-3">
                <summary className="cursor-pointer select-none text-xs font-semibold text-muted">
                  Notificações
                </summary>
                <form action={upsertHabitNotificationConfigAction} className="mt-3 space-y-3">
                  <input name="challengeId" type="hidden" value={challenge.id} />
                  <input name="habitId" type="hidden" value={habit.id} />
                  <HabitNotificationFields config={habit.notificationConfig} />
                  <Button size="sm" type="submit" variant="secondary">
                    Salvar notificação
                  </Button>
                </form>
              </details>
            </li>
          ))}
          {habits.length === 0 ? (
            <p className="text-sm text-muted">Nenhum hábito cadastrado ainda.</p>
          ) : null}
        </ul>

        {!hasParticipants ? (
          <form action={addHabitAction} className="mt-5 space-y-4 border-t border-white/[0.08] pt-5">
            <input name="challengeId" type="hidden" value={challenge.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título">
                <Input maxLength={120} name="title" required />
              </Field>
              <Field label="Categoria">
                <Input maxLength={60} name="category" />
              </Field>
            </div>
            <Field label="Descrição">
              <Textarea maxLength={400} name="description" rows={2} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tipo">
                <select
                  className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground"
                  defaultValue="boolean"
                  name="habitType"
                >
                  <option value="boolean">Sim/Não</option>
                  <option value="quantity">Quantidade</option>
                  <option value="duration">Duração</option>
                  <option value="reading">Leitura</option>
                </select>
              </Field>
              <Field label="Frequência">
                <select
                  className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground"
                  defaultValue="daily"
                  name="frequencyType"
                >
                  <option value="daily">Diária</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </Field>
              <Field label="Pontos">
                <Input defaultValue={10} min={0} name="points" type="number" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field hint="Só para quantidade/duração." label="Meta">
                <Input min={0} name="validationTarget" step="0.1" type="number" />
              </Field>
              <Field label="Unidade">
                <Input maxLength={40} name="validationUnit" placeholder="ex: litros, minutos" />
              </Field>
              <Field label="Ordem">
                <Input defaultValue={0} min={0} name="sortOrder" type="number" />
              </Field>
            </div>
            <Checkbox defaultChecked label="Obrigatório para concluir o dia" name="isRequired" />
            <HabitVisibilityFields durationDays={challenge.duration_days} />
            <Button type="submit" variant="secondary">
              Adicionar hábito
            </Button>
          </form>
        ) : null}
      </Card>

      <Card tone="glass">
        <CardHeader>
          <CardTitle>Dias do ciclo ({daysCount} de {challenge.duration_days})</CardTitle>
          <CardDescription>
            Gera automaticamente os dias e vincula todos os hábitos ativos a todos os dias. Só
            roda em rascunho; é idempotente (pode rodar de novo após adicionar hábitos).
          </CardDescription>
        </CardHeader>
        <form action={generateChallengeDaysAction} className="mt-4">
          <input name="challengeId" type="hidden" value={challenge.id} />
          <Button disabled={challenge.status !== "draft"} type="submit" variant="secondary">
            Gerar estrutura dos dias
          </Button>
        </form>
      </Card>

      <Card id="mensagens-do-ciclo" tone="glass">
        <CardHeader>
          <CardTitle>Mensagens do ciclo</CardTitle>
          <CardDescription>
            Mensagem editorial por dia - aparece no Dashboard, na missão do dia e na
            celebração quando o dia tem uma definida. Sempre editável, mesmo com
            participantes; nunca altera duração, hábitos ou regras. Nenhum dia precisa ter
            mensagem própria.
          </CardDescription>
        </CardHeader>
        <div className="mt-4">
          <ChallengeDayMessagesEditor challengeId={challenge.id} days={editorData.days} durationDays={challenge.duration_days} />
        </div>
      </Card>

      {challenge.status === "draft" ? (
        <Card tone="accent">
          <CardHeader>
            <CardTitle>Publicar</CardTitle>
            <CardDescription>
              Valida nome, slug, hábitos e dias novamente no servidor antes de tornar o desafio
              ativo.
            </CardDescription>
          </CardHeader>
          <form action={publishChallengeAction} className="mt-4">
            <input name="challengeId" type="hidden" value={challenge.id} />
            <input name="redirectTo" type="hidden" value={`/admin/desafios/${challenge.id}/editar`} />
            <Button size="lg" type="submit">
              Publicar desafio
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
