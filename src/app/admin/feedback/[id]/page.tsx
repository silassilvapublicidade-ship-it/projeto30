import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { FeedbackDeleteButton } from "@/components/admin/feedback-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { StatusCard } from "@/components/ui/feedback";
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_PRIORITY_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPE_LABELS,
  isFeedbackType,
  type FeedbackCategory,
} from "@/features/feedback/feedback.core";
import { updateFeedbackAction } from "@/features/admin/feedback-admin.actions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatProjectDateTime } from "@/lib/format-date";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { adminGetFeedbackDetail } from "@/server/services/feedback.service";

export const metadata: Metadata = { title: "Feedback · Administração" };

type FeedbackDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feedback?: string }>;
};

export default async function AdminFeedbackDetailPage({ params, searchParams }: FeedbackDetailPageProps) {
  const admin = await requireAdminUser();
  const { id } = await params;
  const { feedback: feedbackParam } = await searchParams;
  const detail = await adminGetFeedbackDetail(id);

  if (!detail) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("record_analytics_event", { p_event_name: "feedback_admin_opened", p_source: "server" });

  let attachmentUrl: string | null = null;
  if (detail.attachmentStoragePath) {
    const adminClient = createSupabaseAdminClient();
    const { data } = await adminClient.storage
      .from("user-feedback-attachments")
      .createSignedUrl(detail.attachmentStoragePath, 120);
    attachmentUrl = data?.signedUrl ?? null;
  }

  const isSuperAdmin = admin.role === "super_admin";

  return (
    <div className="space-y-5">
      <div>
        <Link className="text-xs text-muted-2 hover:text-foreground" href="/admin/feedback">
          ← Feedback
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-semibold text-foreground">{detail.protocolCode}</h1>
          <Badge tone="accent">{isFeedbackType(detail.feedbackType) ? FEEDBACK_TYPE_LABELS[detail.feedbackType] : detail.feedbackType}</Badge>
        </div>
      </div>

      {feedbackParam === "success" ? <StatusCard description="Alterações salvas." title="Tudo certo" tone="success" /> : null}
      {feedbackParam === "error" ? <StatusCard description="Não foi possível salvar agora." title="Falha" tone="error" /> : null}
      {feedbackParam === "forbidden" ? (
        <StatusCard description="Apenas super administradores podem excluir." title="Ação não permitida" tone="warning" />
      ) : null}
      {feedbackParam === "invalid" ? <StatusCard description="Frase de confirmação incorreta." title="Confirmação inválida" tone="warning" /> : null}

      <section className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <h2 className="text-base font-semibold text-foreground">{detail.title}</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{detail.description}</p>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="font-mono uppercase tracking-[0.16em] text-muted-2">Usuário</dt>
            <dd className="mt-1 text-foreground">{detail.userDisplayName ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.16em] text-muted-2">Categoria</dt>
            <dd className="mt-1 text-foreground">
              {detail.category ? FEEDBACK_CATEGORY_LABELS[detail.category as FeedbackCategory] ?? detail.category : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.16em] text-muted-2">Enviado em</dt>
            <dd className="mt-1 text-foreground">{formatProjectDateTime(detail.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.16em] text-muted-2">Contato autorizado</dt>
            <dd className="mt-1 text-foreground">{detail.allowContact ? "Sim" : "Não"}</dd>
          </div>
        </dl>

        {attachmentUrl ? (
          <div className="mt-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Anexo</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária, não vale otimizar/cachear */}
            <img alt="Anexo enviado pelo usuário" className="mt-2 max-h-80 rounded-[var(--radius-card)] border border-white/[0.08]" src={attachmentUrl} />
          </div>
        ) : null}
      </section>

      <section className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Dados técnicos</h2>
        <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="font-mono uppercase tracking-[0.16em] text-muted-2">Rota</dt>
            <dd className="mt-1 break-all text-foreground">{detail.route ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.16em] text-muted-2">Versão</dt>
            <dd className="mt-1 text-foreground">{detail.appVersion ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.16em] text-muted-2">Navegador</dt>
            <dd className="mt-1 text-foreground">{detail.browser ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.16em] text-muted-2">Sistema</dt>
            <dd className="mt-1 text-foreground">{detail.operatingSystem ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.16em] text-muted-2">PWA</dt>
            <dd className="mt-1 text-foreground">{detail.isPwa ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-[0.16em] text-muted-2">Tela</dt>
            <dd className="mt-1 text-foreground">{detail.viewport ?? "—"}</dd>
          </div>
        </dl>

        {detail.diagnosticCode ? (
          <div className="mt-4 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="font-mono text-xs text-foreground">{detail.diagnosticCode}</p>
            {detail.linkedErrorEventCount > 0 ? (
              <Link className="mt-1 inline-block text-xs text-action-soft hover:underline" href="/admin/observabilidade">
                Ver {detail.linkedErrorEventCount} evento(s) relacionado(s) na Observabilidade
              </Link>
            ) : (
              <p className="mt-1 text-xs text-muted-2">Nenhum evento correspondente encontrado na Observabilidade.</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Gerenciar</h2>
        <form action={updateFeedbackAction} className="mt-3 space-y-4">
          <input name="id" type="hidden" value={detail.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <select
                className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
                defaultValue={detail.status}
                name="status"
              >
                {FEEDBACK_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {FEEDBACK_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioridade">
              <select
                className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
                defaultValue={detail.priority}
                name="priority"
              >
                {FEEDBACK_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {FEEDBACK_PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Resposta ao usuário" hint="Aparece em &quot;Meus feedbacks&quot; para o usuário.">
            <Textarea defaultValue={detail.adminResponse ?? ""} name="adminResponse" rows={3} />
          </Field>

          <Field label="Resolvido na versão">
            <Input defaultValue={detail.resolvedInVersion ?? ""} name="resolvedInVersion" placeholder="ex.: 0.1.4" />
          </Field>

          <Field label="Código de diagnóstico vinculado">
            <Input defaultValue={detail.diagnosticCode ?? ""} name="diagnosticCode" placeholder="P30-XXXX-YYYYMMDD-XXXX" />
          </Field>

          {isSuperAdmin ? (
            <Field label="Nota interna" hint="Nunca visível ao usuário.">
              <Textarea defaultValue={detail.internalNotes ?? ""} name="internalNotes" rows={2} />
            </Field>
          ) : null}

          <Button type="submit">Salvar alterações</Button>
        </form>

        {isSuperAdmin ? (
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <FeedbackDeleteButton feedbackId={detail.id} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
