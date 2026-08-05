import { LayoutGrid } from "lucide-react";
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
      <section className="max-w-2xl">
        <span className="flex size-12 items-center justify-center rounded-full bg-action/12 text-action-soft">
          <LayoutGrid aria-hidden="true" size={22} />
        </span>
        <h1 className="mt-5 font-display text-4xl leading-[1.05] text-foreground sm:text-5xl">Mais</h1>
        <p className="mt-3 text-base leading-7 text-muted">Tudo o que você precisa, em um só lugar.</p>
      </section>

      <MaisHeader context={context} />

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <MaisGroupCard group={group} key={group.title} />
        ))}
      </div>
    </div>
  );
}
