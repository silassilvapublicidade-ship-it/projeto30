import { Bell } from "lucide-react";

export type NotificationPreviewContent = {
  actionLabel?: string | null;
  imageUrl?: string | null;
  message: string;
  title: string;
};

/**
 * As duas maquetes de "como a notificacao aparece" (push do sistema + central
 * interna /app/notificacoes) - extraidas de
 * /admin/notificacoes/[campaignId]/preview para serem reaproveitadas tambem
 * pela secao "Campanha de lancamento" do editor de desafio, em vez de
 * duplicar o JSX.
 */
export function NotificationPushPreviewCard({ content }: { content: NotificationPreviewContent }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-2">
        Notificação push (sistema)
      </p>
      <div className="flex gap-3 rounded-[1rem] border border-white/[0.10] bg-matte/95 p-3.5 shadow-[var(--shadow-lift)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- ícone estático do app, tamanho fixo pequeno */}
        <img alt="" className="size-9 shrink-0 rounded-[0.6rem]" src="/icons/icon-192.png" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-2">Projeto 30</p>
          <p className="text-sm font-semibold leading-5 text-foreground">{content.title}</p>
          <p className="text-sm leading-5 text-muted">{content.message}</p>
          {content.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem enviada pelo admin
            <img
              alt=""
              className="mt-2 max-h-32 w-full rounded-[0.6rem] object-cover"
              src={content.imageUrl}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function NotificationInternalCenterPreviewCard({ content }: { content: NotificationPreviewContent }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-2">
        Central interna (/app/notificacoes)
      </p>
      <div className="flex gap-3 rounded-[1.25rem] border border-action/26 bg-action/[0.05] p-3.5 sm:p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-action/30 bg-action/14 text-action-soft">
          <Bell aria-hidden="true" size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5 text-foreground">{content.title}</p>
          <p className="mt-1 text-sm leading-5 text-muted">{content.message}</p>
          {content.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem enviada pelo admin
            <img
              alt=""
              className="mt-2 max-h-40 w-full max-w-xs rounded-[0.85rem] border border-white/[0.08] object-cover"
              src={content.imageUrl}
            />
          ) : null}
          {content.actionLabel ? (
            <div className="mt-2.5">
              <span className="inline-flex items-center rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-foreground">
                {content.actionLabel}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function NotificationPreviewCards({ content }: { content: NotificationPreviewContent }) {
  return (
    <div className="space-y-4">
      <NotificationPushPreviewCard content={content} />
      <NotificationInternalCenterPreviewCard content={content} />
    </div>
  );
}
