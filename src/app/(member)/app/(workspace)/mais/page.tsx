import type { Metadata } from "next";

import { MaisGroupCard } from "@/components/member/mais-group-card";
import { MaisHeader } from "@/components/member/mais-header";
import { filterNavGroupsByRole, MORE_HUB_GROUPS } from "@/features/member/member-navigation.core";
import { isAdminRole } from "@/features/admin/admin-access.core";
import { recordAnalyticsEvent } from "@/server/services/analytics.service";
import { getMemberContext } from "@/server/services/member-area.service";

export const metadata: Metadata = {
  title: "Mais",
};

/**
 * Hub definitivo de navegação secundária (Parte D) - tudo que a barra
 * mobile de 5 itens não mostra direto. Reaproveita getMemberContext() já
 * usado por toda a área de membros - nenhuma consulta nova (Parte O).
 * Lê os mesmos grupos centrais que a sidebar desktop usa
 * (member-navigation.core.ts) - nunca uma segunda lista divergente.
 */
export default async function MaisPage() {
  const context = await getMemberContext();
  const isAdmin = isAdminRole(context.profile.role);
  const groups = filterNavGroupsByRole(MORE_HUB_GROUPS, isAdmin);

  void recordAnalyticsEvent({ eventName: "member_more_opened", source: "server" });

  return (
    <div className="space-y-6">
      <MaisHeader context={context} />

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <MaisGroupCard group={group} key={group.title} />
        ))}
      </div>
    </div>
  );
}
