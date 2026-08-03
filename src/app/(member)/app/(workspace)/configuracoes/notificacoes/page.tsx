import type { Metadata } from "next";
import { BellRing } from "lucide-react";

import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { NotificationPreferencesForm } from "@/components/member/notification-preferences-form";
import { PushNotificationOptIn } from "@/components/member/push-notification-opt-in";
import { getMemberNotificationPreferences } from "@/server/services/notification-preferences.service";

export const metadata: Metadata = {
  title: "Notificações",
};

export default async function NotificacoesConfigPage() {
  const { notifications, reminderTime, timezone } = await getMemberNotificationPreferences();

  return (
    <MemberEmptyPage
      description="Escolha quais lembretes deseja receber. Você pode alterar essas preferências a qualquer momento."
      icon={BellRing}
      title="Notificações"
    >
      <div className="max-w-xl space-y-6">
        <section className="space-y-3 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
          <div>
            <h2 className="font-display text-lg text-foreground">Notificações push</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Receba avisos mesmo com o Projeto 30 fechado. Mesmo sem ativar, você continua recebendo tudo
              na central de notificações.
            </p>
          </div>
          <PushNotificationOptIn initialPushEnabled={notifications.push_enabled} />
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg text-foreground">Lembretes e avisos</h2>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">
            Fuso horário: {timezone}
          </p>
          <NotificationPreferencesForm notifications={notifications} reminderTime={reminderTime} />
        </section>
      </div>
    </MemberEmptyPage>
  );
}
