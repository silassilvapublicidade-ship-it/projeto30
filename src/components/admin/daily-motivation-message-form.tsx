"use client";

import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  DAILY_MOTIVATION_CATEGORIES,
  DAILY_MOTIVATION_CATEGORY_LABELS,
} from "@/features/admin/daily-motivation-messages.schemas";
import type { DailyMotivationMessageRow } from "@/server/services/admin-daily-motivation-messages.service";

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

/**
 * Parte 3/4: nenhuma mensagem e' gerada por IA - o formulario so grava o
 * texto que o admin digitou. starts_at/ends_at ficam em branco por padrao
 * (mensagem sempre elegivel).
 */
export function DailyMotivationMessageForm({
  action,
  message,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message?: DailyMotivationMessageRow;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4">
      {message ? <input name="messageId" type="hidden" value={message.id} /> : null}

      <Checkbox
        defaultChecked={message?.active ?? true}
        description="Mensagens inativas nunca sao sorteadas pelo cron."
        label="Ativa"
        name="active"
      />

      <Field label="Título (interno, não aparece para o usuário)">
        <Input defaultValue={message?.title ?? ""} maxLength={120} name="title" required />
      </Field>

      <Field hint="Emojis são bem-vindos - o texto chega exatamente como escrito, sem IA." label="Mensagem">
        <Textarea defaultValue={message?.body ?? ""} maxLength={500} name="body" required rows={3} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Categoria">
          <select
            className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground"
            defaultValue={message?.category ?? "geral"}
            name="category"
          >
            {DAILY_MOTIVATION_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {DAILY_MOTIVATION_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </Field>
        <Field hint="1 a 10 - desempate quando mais de uma mensagem elegível for sorteada." label="Prioridade">
          <Input defaultValue={message?.priority ?? 5} max={10} min={1} name="priority" type="number" />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field hint="Opcional - deixe em branco para sempre elegível." label="Disponível a partir de">
          <Input defaultValue={toDateTimeLocal(message?.starts_at ?? null)} name="startsAt" type="datetime-local" />
        </Field>
        <Field hint="Opcional - deixe em branco para nunca expirar." label="Disponível até">
          <Input defaultValue={toDateTimeLocal(message?.ends_at ?? null)} name="endsAt" type="datetime-local" />
        </Field>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
