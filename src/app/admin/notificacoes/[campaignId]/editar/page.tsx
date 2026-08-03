import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { NotificationCampaignForm } from "@/components/admin/notification-campaign-form";
import {
  getAdminNotificationCampaign,
  getNotificationUserById,
  listChallengesForNotificationPicker,
} from "@/server/services/admin-notification-campaigns.service";
import { requireAdminUser } from "@/server/services/admin-session.service";

export const metadata: Metadata = {
  title: "Editar notificação · Administração",
};

export default async function EditNotificationCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  await requireAdminUser();
  const { campaignId } = await params;

  const [{ data: campaign, error }, challenges] = await Promise.all([
    getAdminNotificationCampaign(campaignId),
    listChallengesForNotificationPicker(),
  ]);

  if (error || !campaign) {
    notFound();
  }

  if (campaign.status !== "draft") {
    notFound();
  }

  const specificUser = campaign.specific_user_id
    ? await getNotificationUserById(campaign.specific_user_id)
    : null;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Editar notificação</h1>
        <p className="mt-1 text-sm leading-6 text-muted">Apenas rascunhos podem ser editados.</p>
      </div>

      <NotificationCampaignForm
        campaignId={campaignId}
        challenges={challenges}
        initialValues={{
          actionLabel: campaign.action_label ?? "",
          audienceType: campaign.audience_type,
          challengeId: campaign.challenge_id ?? "",
          channelInternal: campaign.channel_internal,
          channelPush: campaign.channel_push,
          destinationReferenceId: campaign.destination_reference_id ?? "",
          destinationType: campaign.destination_type,
          habitKeyword: campaign.habit_keyword ?? "",
          imageUrl: campaign.image_url ?? "",
          message: campaign.message,
          minStreak: campaign.min_streak_threshold?.toString() ?? "",
          specificUser,
          title: campaign.title,
        }}
        mode="edit"
      />
    </div>
  );
}
