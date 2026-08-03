import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { DailyMotivationMessageForm } from "@/components/admin/daily-motivation-message-form";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import {
  createDailyMotivationMessageAction,
  deleteDailyMotivationMessageAction,
  updateDailyMotivationMessageAction,
} from "@/features/admin/daily-motivation-messages.actions";
import { DAILY_MOTIVATION_CATEGORY_LABELS } from "@/features/admin/daily-motivation-messages.schemas";
import { listDailyMotivationMessages } from "@/server/services/admin-daily-motivation-messages.service";
import { requireAdminUser } from "@/server/services/admin-session.service";

export const metadata: Metadata = {
  title: "Mensagens motivacionais · Administração",
};

const feedbackMessages: Record<string, { description: string; title: string; tone: "error" | "success" }> = {
  invalid: {
    title: "Solicitação inválida",
    description: "Confira os campos obrigatórios e tente novamente.",
    tone: "error",
  },
  error: { title: "Não foi possível concluir", description: "A ação falhou. Tente novamente.", tone: "error" },
  "create-success": {
    title: "Mensagem criada",
    description: "Ela já entra no sorteio diário do cron a partir de agora.",
    tone: "success",
  },
  "update-success": { title: "Mensagem atualizada", description: "As alterações foram salvas.", tone: "success" },
  "delete-success": { title: "Mensagem excluída", description: "Ela não será mais sorteada.", tone: "success" },
};

type PageProps = {
  searchParams: Promise<{ feedback?: string }>;
};

export default async function MensagensMotivacionaisPage({ searchParams }: PageProps) {
  await requireAdminUser();

  const { feedback: feedbackKey } = await searchParams;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;
  const messages = await listDailyMotivationMessages();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/admin/notificacoes"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para notificações
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Mensagens motivacionais diárias</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Todo dia o cron sorteia uma mensagem ativa entre as elegíveis, sem repetir a do dia anterior. Nenhuma
          mensagem é gerada por IA - todo o texto é escrito aqui pelo administrador (Parte 3/4).
        </p>
      </div>

      {feedback ? (
        <StatusCard description={feedback.description} title={feedback.title} tone={feedback.tone} />
      ) : null}

      <details className="group rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Nova mensagem</summary>
        <div className="mt-4">
          <DailyMotivationMessageForm action={createDailyMotivationMessageAction} submitLabel="Criar mensagem" />
        </div>
      </details>

      {messages.length === 0 ? (
        <EmptyState
          description="Crie a primeira mensagem para que o sistema de motivação diária tenha o que sortear."
          title="Nenhuma mensagem cadastrada"
        />
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => (
            <li
              className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4"
              key={message.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{message.title}</span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.08em] text-muted-2">
                      {DAILY_MOTIVATION_CATEGORY_LABELS[message.category as keyof typeof DAILY_MOTIVATION_CATEGORY_LABELS] ??
                        message.category}
                    </span>
                    {!message.active ? (
                      <span className="rounded-full border border-danger/25 bg-danger-wash px-2 py-0.5 text-[0.65rem] text-danger">
                        Inativa
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-muted">{message.body}</p>
                  <p className="mt-1.5 font-mono text-[0.65rem] text-muted-2">
                    Prioridade {message.priority}
                    {message.starts_at || message.ends_at ? (
                      <>
                        {" · "}
                        {message.starts_at ? new Date(message.starts_at).toLocaleString("pt-BR") : "sempre"}
                        {" – "}
                        {message.ends_at ? new Date(message.ends_at).toLocaleString("pt-BR") : "sem prazo"}
                      </>
                    ) : null}
                  </p>
                </div>
                <form action={deleteDailyMotivationMessageAction}>
                  <input name="messageId" type="hidden" value={message.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`Excluir a mensagem "${message.title}"? Essa ação não pode ser desfeita.`}
                    size="sm"
                    variant="danger"
                  >
                    Excluir
                  </ConfirmSubmitButton>
                </form>
              </div>

              <details className="group mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-foreground">
                  Editar
                </summary>
                <div className="mt-3">
                  <DailyMotivationMessageForm
                    action={updateDailyMotivationMessageAction}
                    message={message}
                    submitLabel="Salvar alterações"
                  />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
