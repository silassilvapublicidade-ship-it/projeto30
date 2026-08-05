import Link from "next/link";
import type { Metadata } from "next";

import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import {
  categoriesForType,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_PRIORITY_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPES,
  isFeedbackPriority,
  isFeedbackStatus,
  isFeedbackType,
  type FeedbackPriority,
  type FeedbackStatus,
} from "@/features/feedback/feedback.core";
import { formatProjectDateTime } from "@/lib/format-date";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { adminListFeedback } from "@/server/services/feedback.service";

export const metadata: Metadata = { title: "Feedback · Administração" };

const PAGE_SIZE = 20;

const statusTone: Record<FeedbackStatus, "accent" | "neutral" | "success" | "warning" | "danger"> = {
  new: "accent",
  reviewing: "warning",
  planned: "accent",
  resolved: "success",
  closed: "neutral",
};

const priorityTone: Record<FeedbackPriority, "accent" | "neutral" | "success" | "warning" | "danger"> = {
  low: "neutral",
  normal: "accent",
  high: "warning",
  urgent: "danger",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type FeedbackListPageProps = {
  searchParams: Promise<AdminSearchParams>;
};

export default async function AdminFeedbackPage({ searchParams }: FeedbackListPageProps) {
  await requireAdminUser();
  const rawParams = await searchParams;

  const search = firstParam(rawParams.search) || undefined;
  const typeParam = firstParam(rawParams.type);
  const categoryParam = firstParam(rawParams.category);
  const statusParam = firstParam(rawParams.status);
  const priorityParam = firstParam(rawParams.priority);
  const page = Math.max(1, Number(firstParam(rawParams.page)) || 1);

  const feedbackType = typeParam && isFeedbackType(typeParam) ? typeParam : undefined;
  const status = statusParam && isFeedbackStatus(statusParam) ? statusParam : undefined;
  const priority = priorityParam && isFeedbackPriority(priorityParam) ? priorityParam : undefined;
  const availableCategories = feedbackType ? categoriesForType(feedbackType) : [];
  const category = categoryParam && (availableCategories as readonly string[]).includes(categoryParam) ? categoryParam : undefined;

  const { rows, total } = await adminListFeedback({
    search,
    feedbackType,
    category,
    status,
    priority,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Feedback</h1>
        <p className="mt-1 text-sm leading-6 text-muted">Relatos, sugestões e avaliações enviados pelos usuários.</p>
      </div>

      <form
        className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:flex-wrap sm:items-center"
        method="get"
      >
        <input
          className="min-h-12 flex-1 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:min-w-52"
          defaultValue={search ?? ""}
          name="search"
          placeholder="Buscar por título ou protocolo"
          type="text"
        />
        <select
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-44"
          defaultValue={feedbackType ?? ""}
          name="type"
        >
          <option value="">Todo tipo</option>
          {FEEDBACK_TYPES.map((value) => (
            <option key={value} value={value}>
              {FEEDBACK_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-44"
          defaultValue={status ?? ""}
          name="status"
        >
          <option value="">Todo status</option>
          {FEEDBACK_STATUSES.map((value) => (
            <option key={value} value={value}>
              {FEEDBACK_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-44"
          defaultValue={priority ?? ""}
          name="priority"
        >
          <option value="">Toda prioridade</option>
          {FEEDBACK_PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {FEEDBACK_PRIORITY_LABELS[value]}
            </option>
          ))}
        </select>
        <Button size="md" type="submit">
          Filtrar
        </Button>
        <Button as="a" href="/admin/feedback" size="md" variant="ghost">
          Limpar
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState description="Nenhum feedback corresponde aos filtros atuais." title="Nada por aqui" />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                className="block min-w-0 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-3 transition-colors hover:border-white/14 hover:bg-white/[0.05] focus-visible:outline-action-soft sm:p-4"
                href={`/admin/feedback/${row.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">{row.protocol_code}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={priorityTone[row.priority as FeedbackPriority] ?? "neutral"}>
                      {FEEDBACK_PRIORITY_LABELS[row.priority as FeedbackPriority] ?? row.priority}
                    </Badge>
                    <Badge tone={statusTone[row.status as FeedbackStatus] ?? "neutral"}>
                      {FEEDBACK_STATUS_LABELS[row.status as FeedbackStatus] ?? row.status}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 break-words text-sm font-semibold text-foreground">{row.title}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-2">
                  <span>{isFeedbackType(row.feedback_type) ? FEEDBACK_TYPE_LABELS[row.feedback_type] : row.feedback_type}</span>
                  {row.category ? (
                    <span>{FEEDBACK_CATEGORY_LABELS[row.category as keyof typeof FEEDBACK_CATEGORY_LABELS] ?? row.category}</span>
                  ) : null}
                  <span>{row.user_display_name ?? "Usuário"}</span>
                  <span>{formatProjectDateTime(row.created_at)}</span>
                  {row.diagnostic_code ? <span className="font-mono">{row.diagnostic_code}</span> : null}
                  {row.has_attachment ? <span>📎 Anexo</span> : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AdminPagination basePath="/admin/feedback" page={Math.min(page, totalPages)} searchParams={rawParams} totalPages={totalPages} />
    </div>
  );
}
