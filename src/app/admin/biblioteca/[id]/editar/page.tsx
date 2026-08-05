import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { LibraryContentForm } from "@/components/admin/library-content-form";
import { LibraryRowActions } from "@/components/admin/library-row-actions";
import { StatusCard } from "@/components/ui/feedback";
import { markLibraryContentReviewedAction } from "@/features/admin/admin-library.actions";
import { LIBRARY_STATUS_LABELS, type LibraryContentStatus } from "@/features/library/library.core";
import { adminGetLibraryContent } from "@/server/services/admin-library.service";
import { listChallengesForTipPicker } from "@/server/services/admin-tips.service";

export const metadata: Metadata = {
  title: "Editar conteúdo · Biblioteca · Administração",
};

type EditarConteudoBibliotecaPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const feedbackMessages: Record<string, { description: string; title: string; tone: "success" | "error" }> = {
  "create-success": { title: "Conteúdo criado", description: "Continue preenchendo os blocos editoriais abaixo.", tone: "success" },
  "transition-success": { title: "Status atualizado", description: "O conteúdo foi atualizado.", tone: "success" },
  "transition-error": {
    title: "Não foi possível mudar o status",
    description: "Revise se o conteúdo já foi aprovado antes de publicar ou agendar.",
    tone: "error",
  },
  "review-success": { title: "Marcado como revisado", description: "Registro de revisão salvo.", tone: "success" },
};

export default async function EditarConteudoBibliotecaPage({ params, searchParams }: EditarConteudoBibliotecaPageProps) {
  const { id } = await params;
  const rawParams = await searchParams;
  const feedbackKey = Array.isArray(rawParams.feedback) ? rawParams.feedback[0] : rawParams.feedback;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;

  const [content, challenges] = await Promise.all([adminGetLibraryContent(id), listChallengesForTipPicker()]);

  if (!content) {
    notFound();
  }

  const redirectTo = `/admin/biblioteca/${id}/editar`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
            href="/admin/biblioteca"
          >
            <ArrowLeft aria-hidden="true" size={14} />
            Voltar para Biblioteca
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">{content.title}</h1>
          <p className="mt-1 text-sm leading-6 text-muted">
            Status atual: <strong className="text-foreground">{LIBRARY_STATUS_LABELS[content.status as LibraryContentStatus] ?? content.status}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="rounded-full border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.06]"
            href={`/admin/biblioteca/${id}/preview`}
          >
            Ver preview
          </Link>
          <LibraryRowActions contentId={content.id} redirectTo={redirectTo} status={content.status} />
        </div>
      </div>

      {feedback ? <StatusCard description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}

      {content.status === "draft" ? (
        <form action={markLibraryContentReviewedAction}>
          <input name="contentId" type="hidden" value={content.id} />
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <button
            className="text-xs font-semibold text-action-soft underline-offset-2 hover:underline"
            type="submit"
          >
            Marcar como revisado (move para &ldquo;Em revisão&rdquo;)
          </button>
        </form>
      ) : null}

      <LibraryContentForm challenges={challenges} content={content} />
    </div>
  );
}
