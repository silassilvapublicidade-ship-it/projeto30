import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { getAdminNotificationCampaign } from "@/server/services/admin-notification-campaigns.service";
import { requireAdminUser } from "@/server/services/admin-session.service";

export const metadata: Metadata = {
  title: "Pré-visualização · Administração",
};

export default async function NotificationCampaignPreviewPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  await requireAdminUser();
  const { campaignId } = await params;
  const { data: campaign, error } = await getAdminNotificationCampaign(campaignId);

  if (error || !campaign) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link className="text-sm text-muted hover:text-foreground" href={`/admin/notificacoes/${campaignId}`}>
          ← Voltar
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Pré-visualização</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Aproximação de como a notificação aparece nos dois canais - o layout real pode variar por
          sistema operacional.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-2">
          Notificação push (sistema)
        </p>
        <div className="flex gap-3 rounded-[1rem] border border-white/[0.10] bg-matte/95 p-3.5 shadow-[var(--shadow-lift)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- ícone estático do app, tamanho fixo pequeno */}
          <img alt="" className="size-9 shrink-0 rounded-[0.6rem]" src="/icons/icon-192.png" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-2">Projeto 30</p>
            <p className="text-sm font-semibold leading-5 text-foreground">{campaign.title}</p>
            <p className="text-sm leading-5 text-muted">{campaign.message}</p>
            {campaign.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem enviada pelo admin
              <img
                alt=""
                className="mt-2 max-h-32 w-full rounded-[0.6rem] object-cover"
                src={campaign.image_url}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-2">
          Central interna (/app/notificacoes)
        </p>
        <div className="flex gap-3 rounded-[1.25rem] border border-action/26 bg-action/[0.05] p-3.5 sm:p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-action/30 bg-action/14 text-action-soft">
            <Bell aria-hidden="true" size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-5 text-foreground">{campaign.title}</p>
            <p className="mt-1 text-sm leading-5 text-muted">{campaign.message}</p>
            {campaign.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem enviada pelo admin
              <img
                alt=""
                className="mt-2 max-h-40 w-full max-w-xs rounded-[0.85rem] border border-white/[0.08] object-cover"
                src={campaign.image_url}
              />
            ) : null}
            {campaign.action_label ? (
              <div className="mt-2.5">
                <span className="inline-flex items-center rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-foreground">
                  {campaign.action_label}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
