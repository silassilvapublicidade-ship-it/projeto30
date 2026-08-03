"use client";

import { useId, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  cancelNotificationCampaignAction,
  deleteNotificationCampaignDraftAction,
  duplicateNotificationCampaignAction,
  scheduleNotificationCampaignAction,
  startNotificationCampaignNowAction,
} from "@/features/admin/notification-campaigns.actions";
import { REQUIRED_SEND_CONFIRMATION_PHRASE } from "@/features/admin/notification-campaigns.schemas";

// notification_campaigns.status is a CHECK-constrained text column, not a
// real Postgres enum - Supabase codegen therefore types it as plain string,
// so this component compares against the known literal values directly
// rather than widening its own prop to a union codegen can't back.
type CampaignStatus = string;

function ScheduleDialog({
  campaignId,
  onOpenChange,
  open,
  redirectTo,
}: {
  campaignId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  redirectTo: string;
}) {
  const [scheduledFor, setScheduledFor] = useState("");
  const inputId = useId();

  return (
    <ConfirmDialog
      confirmDisabled={!scheduledFor}
      confirmLabel="Agendar"
      description="A campanha será enviada automaticamente nesta data/hora, mesmo sem nenhum navegador aberto."
      formAction={scheduleNotificationCampaignAction}
      hiddenFields={{ campaignId, redirectTo, scheduledFor }}
      onOpenChange={onOpenChange}
      open={open}
      title="Agendar envio"
    >
      <div className="mt-4">
        <label className="text-xs font-medium text-muted" htmlFor={inputId}>
          Data e hora
        </label>
        <input
          className="mt-1.5 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-action-soft"
          id={inputId}
          onChange={(event) => setScheduledFor(event.target.value)}
          type="datetime-local"
          value={scheduledFor}
        />
      </div>
    </ConfirmDialog>
  );
}

function SendNowDialog({
  campaignId,
  onOpenChange,
  open,
  redirectTo,
  totalRecipients,
}: {
  campaignId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  redirectTo: string;
  totalRecipients: number;
}) {
  const [typedPhrase, setTypedPhrase] = useState("");
  const inputId = useId();

  return (
    <ConfirmDialog
      confirmDisabled={typedPhrase !== REQUIRED_SEND_CONFIRMATION_PHRASE}
      confirmLabel="Enviar agora"
      description={`Esta campanha será enviada imediatamente para aproximadamente ${totalRecipients.toLocaleString("pt-BR")} pessoa(s). Isso não pode ser desfeito.`}
      formAction={startNotificationCampaignNowAction}
      hiddenFields={{ campaignId, confirmationPhrase: typedPhrase, redirectTo }}
      onOpenChange={onOpenChange}
      open={open}
      title="Enviar notificação agora?"
    >
      <div className="mt-4">
        <label className="text-xs font-medium text-muted" htmlFor={inputId}>
          Digite a frase exata: &ldquo;{REQUIRED_SEND_CONFIRMATION_PHRASE}&rdquo;
        </label>
        <input
          autoComplete="off"
          className="mt-1.5 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-action-soft"
          id={inputId}
          onChange={(event) => setTypedPhrase(event.target.value)}
          placeholder={REQUIRED_SEND_CONFIRMATION_PHRASE}
          spellCheck={false}
          type="text"
          value={typedPhrase}
        />
      </div>
    </ConfirmDialog>
  );
}

function ActionForm({
  action,
  campaignId,
  children,
  close,
  redirectTo,
  tone = "default",
}: {
  action: (formData: FormData) => void | Promise<void>;
  campaignId: string;
  children: React.ReactNode;
  close: () => void;
  redirectTo: string;
  tone?: "danger" | "default";
}) {
  return (
    <form action={action} onSubmit={close}>
      <input name="campaignId" type="hidden" value={campaignId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <DropdownMenuItem tone={tone} type="submit">
        {children}
      </DropdownMenuItem>
    </form>
  );
}

export function NotificationCampaignRowActions({
  campaignId,
  campaignTitle,
  redirectTo,
  status,
  totalRecipients,
}: {
  campaignId: string;
  campaignTitle: string;
  redirectTo: string;
  status: CampaignStatus;
  totalRecipients: number;
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sendNowOpen, setSendNowOpen] = useState(false);

  return (
    <>
      <DropdownMenu label={`Ações para ${campaignTitle}`}>
        {({ close }) => (
          <>
            <DropdownMenuItem href={`/admin/notificacoes/${campaignId}`}>Ver detalhes</DropdownMenuItem>
            <DropdownMenuItem href={`/admin/notificacoes/${campaignId}/preview`}>Pré-visualizar</DropdownMenuItem>

            {status === "draft" ? (
              <>
                <DropdownMenuItem href={`/admin/notificacoes/${campaignId}/editar`}>Editar</DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    close();
                    setScheduleOpen(true);
                  }}
                >
                  Agendar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    close();
                    setSendNowOpen(true);
                  }}
                >
                  Enviar agora
                </DropdownMenuItem>
              </>
            ) : null}

            <ActionForm action={duplicateNotificationCampaignAction} campaignId={campaignId} close={close} redirectTo={redirectTo}>
              Duplicar
            </ActionForm>

            {status === "scheduled" || status === "draft" ? (
              <ActionForm
                action={cancelNotificationCampaignAction}
                campaignId={campaignId}
                close={close}
                redirectTo={redirectTo}
                tone="danger"
              >
                Cancelar
              </ActionForm>
            ) : null}

            {status === "draft" ? (
              <>
                <DropdownMenuSeparator />
                <ActionForm
                  action={deleteNotificationCampaignDraftAction}
                  campaignId={campaignId}
                  close={close}
                  redirectTo={redirectTo}
                  tone="danger"
                >
                  Excluir rascunho
                </ActionForm>
              </>
            ) : null}
          </>
        )}
      </DropdownMenu>

      <ScheduleDialog campaignId={campaignId} onOpenChange={setScheduleOpen} open={scheduleOpen} redirectTo={redirectTo} />
      <SendNowDialog
        campaignId={campaignId}
        onOpenChange={setSendNowOpen}
        open={sendNowOpen}
        redirectTo={redirectTo}
        totalRecipients={totalRecipients}
      />
    </>
  );
}
