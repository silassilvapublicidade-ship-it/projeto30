import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";

import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  isFeedbackType,
  type FeedbackStatus,
} from "@/features/feedback/feedback.core";
import { withdrawFeedbackAction } from "@/features/feedback/feedback.actions";
import { listMyFeedback } from "@/server/services/feedback.service";

export const metadata: Metadata = {
  title: "Meus feedbacks · Projeto 30",
};

const statusTone: Record<FeedbackStatus, "accent" | "neutral" | "success" | "warning" | "danger"> = {
  new: "accent",
  reviewing: "warning",
  planned: "accent",
  resolved: "success",
  closed: "neutral",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

export default async function MyFeedbackPage() {
  const items = await listMyFeedback();

  return (
    <MemberEmptyPage
      description="Acompanhe o status de tudo que você já enviou - protocolos, respostas e atualizações."
      icon={MessageCircle}
      title="Meus feedbacks"
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button as="a" href="/app/feedback" size="sm" variant="secondary">
            Enviar novo feedback
          </Button>
        </div>

        {items.length === 0 ? (
          <Card className="p-4 sm:p-6">
            <EmptyState description="Você ainda não enviou nenhum feedback." title="Nada por aqui ainda" />
          </Card>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const status = item.status as FeedbackStatus;
              return (
                <li key={item.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs text-muted-2">{item.protocol_code}</span>
                      <Badge tone={statusTone[status] ?? "neutral"}>{FEEDBACK_STATUS_LABELS[status] ?? item.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-2">
                      {isFeedbackType(item.feedback_type) ? FEEDBACK_TYPE_LABELS[item.feedback_type] : item.feedback_type} ·{" "}
                      {formatDate(item.created_at)}
                    </p>

                    {item.admin_response ? (
                      <div className="mt-3 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.03] p-3">
                        <p className="text-xs font-semibold text-foreground">Resposta da equipe</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{item.admin_response}</p>
                        {item.resolved_in_version ? (
                          <p className="mt-1 text-xs text-muted-2">Resolvido na versão {item.resolved_in_version}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {status === "new" ? (
                      <form action={withdrawFeedbackAction} className="mt-3">
                        <input name="id" type="hidden" value={item.id} />
                        <Button size="sm" type="submit" variant="ghost">
                          Retirar
                        </Button>
                      </form>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-muted-2">
          <Link className="hover:underline" href="/app/feedback">
            ← Voltar
          </Link>
        </p>
      </div>
    </MemberEmptyPage>
  );
}
