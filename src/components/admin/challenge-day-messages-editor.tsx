import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import {
  copyChallengeDayMessageToRangeAction,
  updateChallengeDayMessageAction,
} from "@/features/admin/challenge-day-messages.actions";
import { DAY_MESSAGE_MAX_LENGTH } from "@/features/admin/challenge-editor.schemas";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";

type ChallengeDayMessageEditorDay = {
  dayNumber: number;
  id: string;
  message: string | null;
};

function DayMessageRow({
  challengeId,
  day,
  durationDays,
}: {
  challengeId: string;
  day: ChallengeDayMessageEditorDay;
  durationDays: number;
}) {
  const hasMessage = Boolean(day.message?.trim());

  return (
    <li className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-3">
      <details>
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Dia {day.dayNumber}
            <span
              className={
                hasMessage
                  ? "rounded-full border border-action/28 bg-action/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-action-soft"
                  : "rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted-2"
              }
            >
              {hasMessage ? "Mensagem definida" : "Usando padrão"}
            </span>
          </span>
          {hasMessage ? (
            <span className="max-w-[16rem] truncate text-xs text-muted-2">{day.message}</span>
          ) : null}
        </summary>

        <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
          {hasMessage ? (
            <div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-white/[0.06] bg-black/20 p-3 text-sm italic leading-6 text-muted">
              <Sparkles aria-hidden="true" className="mt-0.5 shrink-0 text-action-soft" size={14} />
              {day.message}
            </div>
          ) : (
            <p className="text-xs leading-6 text-muted-2">
              Sem mensagem definida para este dia - o Dashboard e a missão do dia usam a
              mensagem motivacional padrão automaticamente.
            </p>
          )}

          <form action={updateChallengeDayMessageAction} className="space-y-3">
            <input name="challengeId" type="hidden" value={challengeId} />
            <input name="dayNumber" type="hidden" value={day.dayNumber} />
            <Field hint={`Até ${DAY_MESSAGE_MAX_LENGTH} caracteres. Deixe em branco para usar o padrão.`} label="Mensagem deste dia">
              <Textarea defaultValue={day.message ?? ""} maxLength={DAY_MESSAGE_MAX_LENGTH} name="message" rows={3} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="submit" variant="secondary">
                Salvar mensagem
              </Button>
            </div>
          </form>

          {hasMessage ? (
            <form action={updateChallengeDayMessageAction}>
              <input name="challengeId" type="hidden" value={challengeId} />
              <input name="dayNumber" type="hidden" value={day.dayNumber} />
              <input name="message" type="hidden" value="" />
              <ConfirmSubmitButton
                confirmMessage={`Limpar a mensagem do Dia ${day.dayNumber}? O dia volta a usar a mensagem padrão.`}
                size="xs"
                variant="ghost"
              >
                Limpar mensagem
              </ConfirmSubmitButton>
            </form>
          ) : null}

          {hasMessage ? (
            <details>
              <summary className="cursor-pointer select-none text-xs font-semibold text-muted">
                Copiar esta mensagem para outros dias
              </summary>
              <form action={copyChallengeDayMessageToRangeAction} className="mt-3 flex flex-wrap items-end gap-3">
                <input name="challengeId" type="hidden" value={challengeId} />
                <input name="sourceDayNumber" type="hidden" value={day.dayNumber} />
                <Field label="Do dia">
                  <Input defaultValue={day.dayNumber} max={durationDays} min={1} name="targetRangeStart" type="number" />
                </Field>
                <Field label="Até o dia">
                  <Input defaultValue={durationDays} max={durationDays} min={1} name="targetRangeEnd" type="number" />
                </Field>
                <Button size="sm" type="submit" variant="secondary">
                  Duplicar para o intervalo
                </Button>
              </form>
            </details>
          ) : null}
        </div>
      </details>
    </li>
  );
}

/**
 * "Mensagens do ciclo" (Correções obrigatórias pré-lançamento, Parte D) -
 * challenge_days.message já alimentava Dashboard/missão do dia/celebração/
 * motor contextual, mas não tinha nenhuma interface administrativa. Edição
 * sempre permitida, mesmo com participantes (editorial - ver
 * classifyChallengeField) - nunca altera estrutura/duração/hábitos/regras.
 * Nenhum dia é obrigatório a ter mensagem; dias vazios continuam usando o
 * fallback automático já existente (getDailyMissionMessage).
 */
export function ChallengeDayMessagesEditor({
  challengeId,
  days,
  durationDays,
}: {
  challengeId: string;
  days: ChallengeDayMessageEditorDay[];
  durationDays: number;
}) {
  if (days.length === 0) {
    return (
      <EmptyState
        description="Gere a estrutura dos dias primeiro, na seção acima, para poder escrever mensagens por dia."
        title="Nenhum dia gerado ainda"
      />
    );
  }

  const definedCount = days.filter((day) => day.message?.trim()).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-2">
        {definedCount} de {days.length} {days.length === 1 ? "dia tem" : "dias têm"} mensagem própria definida.
      </p>
      <ul className="space-y-2">
        {days.map((day) => (
          <DayMessageRow challengeId={challengeId} day={day} durationDays={durationDays} key={day.id} />
        ))}
      </ul>
    </div>
  );
}
