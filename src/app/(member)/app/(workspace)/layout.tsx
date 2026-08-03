import type { ReactNode } from "react";

import { MemberShell } from "@/components/member/member-shell";
import { requireOnboardedMember } from "@/server/services/member-area.service";
import { getUnreadNotificationCount } from "@/server/services/notifications.service";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const [context, unreadNotificationCount] = await Promise.all([
    requireOnboardedMember(),
    getUnreadNotificationCount(),
  ]);

  return (
    <MemberShell context={context} unreadNotificationCount={unreadNotificationCount}>
      {children}
    </MemberShell>
  );
}
