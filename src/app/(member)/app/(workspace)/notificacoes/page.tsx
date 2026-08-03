import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { NotificationInbox } from "@/components/member/notification-inbox";
import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { listMemberNotifications } from "@/server/services/notifications.service";

export const metadata: Metadata = {
  title: "Notificações",
};

export default async function NotificacoesPage() {
  const { hasMore, notifications } = await listMemberNotifications();

  return (
    <MemberEmptyPage
      description="Tudo que o Projeto 30 já te avisou, em ordem cronológica - mesmo que você nunca tenha ativado notificações push."
      icon={Bell}
      title="Notificações"
    >
      <NotificationInbox initialHasMore={hasMore} initialNotifications={notifications} />
    </MemberEmptyPage>
  );
}
