import type { Metadata } from "next";

import { NotificationCampaignForm } from "@/components/admin/notification-campaign-form";
import { listChallengesForNotificationPicker } from "@/server/services/admin-notification-campaigns.service";
import { requireAdminUser } from "@/server/services/admin-session.service";

export const metadata: Metadata = {
  title: "Nova notificação · Administração",
};

export default async function NewNotificationCampaignPage() {
  await requireAdminUser();
  const challenges = await listChallengesForNotificationPicker();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Nova notificação</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Crie um rascunho, revise o público estimado e depois agende ou envie.
        </p>
      </div>

      <NotificationCampaignForm challenges={challenges} mode="create" />
    </div>
  );
}
