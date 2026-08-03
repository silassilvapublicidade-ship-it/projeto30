"use client";

import { useState } from "react";

import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import {
  WEEKDAY_OPTIONS,
  WEEKDAY_PRESETS,
  type HABIT_NOTIFICATION_FREQUENCY_TYPES,
} from "@/features/admin/habit-notifications.schemas";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type FrequencyType = (typeof HABIT_NOTIFICATION_FREQUENCY_TYPES)[number];

/**
 * Modulo G, Parte 2 - "aba Notificações" do hábito. Implementada como uma
 * segunda seção colapsável (<details>) ao lado de "Quando este item
 * aparece", em vez de um componente de abas dedicado - o editor de desafios
 * já usa esse padrão (Parte 21 pede explicitamente accordions/abas/seções,
 * nunca uma interface excessivamente complexa).
 */
export function HabitNotificationFields({
  config,
}: {
  config: Tables<"challenge_habit_notifications"> | null;
}) {
  const [enabled, setEnabled] = useState(config?.enabled ?? false);
  const [frequencyType, setFrequencyType] = useState<FrequencyType>(
    (config?.frequency_type as FrequencyType) ?? "weekly",
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    Array.isArray(config?.weekdays) ? (config.weekdays as number[]) : WEEKDAY_PRESETS.daily.slice(),
  );

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort(),
    );
  }

  return (
    <div className="space-y-3">
      <Checkbox
        checked={enabled}
        description="Envia um lembrete inteligente (respeitando 07:00-22:00, o hábito já concluído e o espaçamento mínimo entre notificações)."
        label="Ativar lembrete"
        name="enabled"
        onChange={(event) => setEnabled(event.target.checked)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título da notificação">
          <Input
            defaultValue={config?.notification_title ?? ""}
            maxLength={120}
            name="notificationTitle"
            required={enabled}
          />
        </Field>
        <Field label="Horário">
          <Input defaultValue={config?.notification_time?.slice(0, 5) ?? "19:00"} name="notificationTime" type="time" />
        </Field>
      </div>

      <Field hint="Emojis são bem-vindos - a mensagem chega exatamente como escrita." label="Mensagem">
        <Textarea
          defaultValue={config?.notification_body ?? ""}
          maxLength={300}
          name="notificationBody"
          required={enabled}
          rows={2}
        />
      </Field>

      <Field label="Frequência">
        <select
          className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground"
          name="frequencyType"
          onChange={(event) => setFrequencyType(event.target.value as FrequencyType)}
          value={frequencyType}
        >
          <option value="weekly">Dias da semana</option>
          <option value="monthly">Um dia por mês</option>
        </select>
      </Field>

      {frequencyType === "weekly" ? (
        <div>
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            <button
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-muted hover:text-foreground"
              onClick={() => setWeekdays(WEEKDAY_PRESETS.daily.slice())}
              type="button"
            >
              Todos os dias
            </button>
            <button
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-muted hover:text-foreground"
              onClick={() => setWeekdays(WEEKDAY_PRESETS.weekdays.slice())}
              type="button"
            >
              Dias úteis
            </button>
            <button
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-muted hover:text-foreground"
              onClick={() => setWeekdays(WEEKDAY_PRESETS.weekend.slice())}
              type="button"
            >
              Fim de semana
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_OPTIONS.map((day) => (
              <label key={day.value}>
                <input
                  checked={weekdays.includes(day.value)}
                  className="peer sr-only"
                  name="weekdays"
                  onChange={() => toggleWeekday(day.value)}
                  type="checkbox"
                  value={day.value}
                />
                <span
                  className={cn(
                    "block cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors",
                    weekdays.includes(day.value)
                      ? "border-action/40 bg-action/16 text-action-soft"
                      : "border-white/[0.08] bg-white/[0.03] text-muted",
                  )}
                >
                  {day.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <Field hint="Dia do mês (1-31)." label="Dia do mês">
          <Input
            defaultValue={config?.monthly_day ?? 1}
            max={31}
            min={1}
            name="monthlyDay"
            required={frequencyType === "monthly"}
            type="number"
          />
        </Field>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox
          defaultChecked={config?.only_if_not_completed ?? true}
          description="Não envia se o hábito já foi concluído hoje (Parte 5)."
          label="Somente se ainda não realizado"
          name="onlyIfNotCompleted"
        />
        <Field hint="1 a 10 - usada para decidir qual lembrete vence quando dois coincidem." label="Prioridade">
          <Input defaultValue={config?.priority ?? 5} max={10} min={1} name="priority" type="number" />
        </Field>
      </div>
    </div>
  );
}
