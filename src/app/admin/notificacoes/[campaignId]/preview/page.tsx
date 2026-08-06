import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { NotificationPreviewCards } from "@/components/admin/notification-preview-cards";
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

      <NotificationPreviewCards
        content={{
          actionLabel: campaign.action_label,
          imageUrl: campaign.image_url,
          message: campaign.message,
          title: campaign.title,
        }}
      />
    </div>
  );
}
