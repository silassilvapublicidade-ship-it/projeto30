"use client";

import { useState } from "react";

import { NotificationPreviewCards } from "@/components/admin/notification-preview-cards";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import type { LaunchCampaignStepKey } from "@/server/services/admin-challenge-launch-campaign.service";
import type { Tables } from "@/types/database";

const STEP_LABELS: Record<LaunchCampaignStepKey, string> = {
  launch_day: "Dia do lançamento",
  launch_day_followup: "Dia do lançamento (reforço, só para quem ainda não entrou)",
  one_day_before: "1 dia antes",
  seven_days_before: "7 dias antes",
  three_days_before: "3 dias antes",
};

/**
 * Um step da campanha de lancamento (Modulo de automacao de lancamento) -
 * mesmo padrao de <details><form> de HabitNotificationFields, com uma previa
 * ao vivo (reaproveitando os mesmos 2 cards mockup de
 * /admin/notificacoes/[id]/preview) e um mini-form de teste em conta QA ao
 * lado.
 */
export function LaunchCampaignStepFields({
  step,
  targetDate,
}: {
  step: Tables<"challenge_launch_campaign_steps">;
  targetDate: string | null;
}) {
  const [title, setTitle] = useState(step.title);
  const [message, setMessage] = useState(step.message);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-2">
        {STEP_LABELS[step.step_key as LaunchCampaignStepKey] ?? step.step_key}
        {targetDate ? ` · dispara em ${targetDate}` : " · defina a data de início para calcular a data"}
      </p>

      <Checkbox
        defaultChecked={step.enabled}
        description="Enviado só para quem ainda não se inscreveu neste desafio, e só depois de publicado."
        label="Ativar este aviso"
        name="enabled"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título">
          <Input
            defaultValue={step.title}
            maxLength={120}
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </Field>
        <Field hint="Informativo - o envio real sai no próximo ciclo diário do cron (~09h)." label="Horário">
          <Input defaultValue={step.send_time.slice(0, 5)} name="sendTime" type="time" />
        </Field>
      </div>

      <Field label="Mensagem">
        <Textarea
          defaultValue={step.message}
          maxLength={300}
          name="message"
          onChange={(event) => setMessage(event.target.value)}
          required
          rows={2}
        />
      </Field>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-2">Prévia</p>
        <NotificationPreviewCards content={{ message, title }} />
      </div>
    </div>
  );
}
