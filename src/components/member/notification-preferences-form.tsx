"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/field";
import { StatusCard } from "@/components/ui/feedback";
import {
  saveNotificationPreferencesAction,
  type SavePreferencesResult,
} from "@/features/notifications/notification-preferences.actions";
import {
  REMINDER_TIME_MAX,
  REMINDER_TIME_MIN,
} from "@/features/notifications/notification-preferences.schemas";
import type { NotificationPreferencesJson } from "@/features/notifications/notification-preferences.schemas";

const initialState: SavePreferencesResult = { ok: false };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button loading={pending} type="submit">
      {pending ? "Salvando..." : "Salvar preferências"}
    </Button>
  );
}

export function NotificationPreferencesForm({
  notifications,
  reminderTime,
}: {
  notifications: NotificationPreferencesJson;
  reminderTime: string | null;
}) {
  const [state, formAction] = useActionState(
    async (_previous: SavePreferencesResult, formData: FormData) => saveNotificationPreferencesAction(formData),
    initialState,
  );
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(notifications.daily_reminder_enabled);

  return (
    <form action={formAction} className="space-y-4">
      {state.ok ? (
        <StatusCard description="Preferências salvas." title="Tudo certo" tone="success" />
      ) : state.message ? (
        <StatusCard description={state.message} title="Revise os campos" tone="error" />
      ) : null}

      <div className="space-y-3 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.03] p-4">
        <Switch
          defaultChecked={dailyReminderEnabled}
          description="Um lembrete quando o dia ainda está aberto e você ainda não finalizou."
          label="Lembrete diário"
          name="dailyReminderEnabled"
          onChange={(event) => setDailyReminderEnabled(event.target.checked)}
        />
        {dailyReminderEnabled ? (
          <Field
            hint={`Entre ${REMINDER_TIME_MIN} e ${REMINDER_TIME_MAX}, no seu fuso horário.`}
            label="Horário do lembrete"
          >
            <Input
              defaultValue={reminderTime?.slice(0, 5) || "19:00"}
              max={REMINDER_TIME_MAX}
              min={REMINDER_TIME_MIN}
              name="dailyReminderTime"
              required={dailyReminderEnabled}
              type="time"
            />
          </Field>
        ) : null}
      </div>

      <div className="space-y-3 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.03] p-4">
        <Switch
          defaultChecked={notifications.challenge_start_notifications}
          description="Avisos de que seu desafio começa amanhã ou hoje."
          label="Desafio começando"
          name="challengeStartNotifications"
        />
        <Switch
          defaultChecked={notifications.new_tip_notifications}
          description="Quando uma nova dica é publicada."
          label="Nova dica"
          name="newTipNotifications"
        />
        <Switch
          defaultChecked={notifications.achievement_notifications}
          description="Quando você desbloqueia uma conquista."
          label="Conquista desbloqueada"
          name="achievementNotifications"
        />
        <Switch
          defaultChecked={notifications.important_updates_notifications}
          description="Comunicados importantes sobre o Projeto 30."
          label="Comunicados importantes"
          name="importantUpdatesNotifications"
        />
      </div>

      <SaveButton />
    </form>
  );
}
