"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import {
  createNotificationCampaignAction,
  estimateNotificationAudienceAction,
  searchNotificationUsersAction,
  updateNotificationCampaignAction,
  uploadNotificationImageAction,
  type AdminCampaignActionResult,
} from "@/features/admin/notification-campaigns.actions";
import {
  AUDIENCE_REQUIRES_CHALLENGE,
  AUDIENCE_REQUIRES_USER,
  NOTIFICATION_AUDIENCE_LABELS,
  NOTIFICATION_AUDIENCE_TYPES,
  type NotificationAudienceType,
} from "@/features/admin/notification-campaigns.schemas";
import {
  destinationRequiresReference,
  isNotificationDestinationType,
  NOTIFICATION_DESTINATION_LABELS,
  NOTIFICATION_DESTINATION_TYPES,
  type NotificationDestinationType,
} from "@/features/notifications/notification-destination.core";

const initialActionState: AdminCampaignActionResult = { ok: false, message: "" };
const initialUploadState: Awaited<ReturnType<typeof uploadNotificationImageAction>> = {
  ok: false,
  message: "",
};

const destinationOptions = NOTIFICATION_DESTINATION_TYPES.map((type) => ({
  label: NOTIFICATION_DESTINATION_LABELS[type],
  value: type,
}));

const audienceOptions = NOTIFICATION_AUDIENCE_TYPES.map((type) => ({
  label: NOTIFICATION_AUDIENCE_LABELS[type],
  value: type,
}));

type ChallengeOption = { id: string; name: string };
type UserOption = { display_name: string | null; email: string; id: string };

export type NotificationCampaignFormValues = {
  actionLabel: string;
  audienceType: NotificationAudienceType;
  challengeId: string;
  channelInternal: boolean;
  channelPush: boolean;
  destinationReferenceId: string;
  destinationType: NotificationDestinationType;
  imageUrl: string;
  message: string;
  specificUser: UserOption | null;
  title: string;
};

const emptyValues: NotificationCampaignFormValues = {
  actionLabel: "",
  audienceType: "all_active_users",
  challengeId: "",
  channelInternal: true,
  channelPush: true,
  destinationReferenceId: "",
  destinationType: "hoje",
  imageUrl: "",
  message: "",
  specificUser: null,
  title: "",
};

function UploadPendingIndicator() {
  const { pending } = useFormStatus();
  return pending ? <span className="text-xs text-muted-2">Enviando…</span> : null;
}

function ImageUploadField({
  imageUrl,
  onUploaded,
}: {
  imageUrl: string;
  onUploaded: (url: string) => void;
}) {
  const [state, formAction] = useActionState(uploadNotificationImageAction, initialUploadState);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) {
      onUploaded(state.imageUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to a fresh successful upload, not to onUploaded identity
  }, [state]);

  return (
    <Field
      error={!state.ok && state.message ? state.message : undefined}
      hint="JPEG, PNG ou WebP · até 10 MB · opcional."
      label="Imagem (opcional)"
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Storage public URL, next/image not needed for an admin preview
        <img alt="" className="mb-2 max-h-40 rounded-[var(--radius-control)] object-cover" src={imageUrl} />
      ) : null}
      <form action={formAction} className="flex items-center gap-2">
        <input
          accept="image/jpeg,image/png,image/webp"
          className="min-w-0 flex-1 text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-foreground"
          name="image"
          onChange={() => inputRef.current?.form?.requestSubmit()}
          ref={inputRef}
          type="file"
        />
        <UploadPendingIndicator />
      </form>
    </Field>
  );
}

function UserPicker({
  onSelect,
  selected,
}: {
  onSelect: (user: UserOption | null) => void;
  selected: UserOption | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const canSearch = !selected && query.trim().length >= 2;

  useEffect(() => {
    if (!canSearch) {
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      searchNotificationUsersAction(query).then((found) => {
        if (!cancelled) setResults(found);
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [canSearch, query]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 py-3 text-sm">
        <span>
          {selected.display_name ?? selected.email} <span className="text-muted-2">· {selected.email}</span>
        </span>
        <button
          className="text-xs font-semibold text-danger hover:underline"
          onClick={() => onSelect(null)}
          type="button"
        >
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div>
      <Input
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por nome ou e-mail"
        type="search"
        value={query}
      />
      {canSearch && results.length > 0 ? (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-[var(--radius-control)] border border-white/[0.08] bg-matte/95">
          {results.map((user) => (
            <li key={user.id}>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-white/[0.05]"
                onClick={() => {
                  onSelect(user);
                  setQuery("");
                }}
                type="button"
              >
                {user.display_name ?? user.email} <span className="text-muted-2">· {user.email}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button loading={pending} type="submit">
      {label}
    </Button>
  );
}

export function NotificationCampaignForm({
  campaignId,
  challenges,
  initialValues,
  mode,
}: {
  campaignId?: string;
  challenges: ChallengeOption[];
  initialValues?: Partial<NotificationCampaignFormValues>;
  mode: "create" | "edit";
}) {
  const [values, setValues] = useState<NotificationCampaignFormValues>({ ...emptyValues, ...initialValues });
  const [estimate, setEstimate] = useState<number | null>(null);
  const action = mode === "create" ? createNotificationCampaignAction : updateNotificationCampaignAction;
  const [state, formAction] = useActionState(action, initialActionState);

  const challengeOptions = challenges.map((challenge) => ({ label: challenge.name, value: challenge.id }));
  const fieldErrors = state.ok ? undefined : state.fieldErrors;

  const audienceReady =
    (!AUDIENCE_REQUIRES_CHALLENGE.has(values.audienceType) || Boolean(values.challengeId)) &&
    (!AUDIENCE_REQUIRES_USER.has(values.audienceType) || Boolean(values.specificUser));

  useEffect(() => {
    if (!audienceReady) {
      return;
    }

    let cancelled = false;
    estimateNotificationAudienceAction({
      audienceType: values.audienceType,
      challengeId: values.challengeId || null,
      specificUserId: values.specificUser?.id ?? null,
    }).then((result) => {
      if (!cancelled && result.ok) setEstimate(result.count);
    });

    return () => {
      cancelled = true;
    };
  }, [audienceReady, values.audienceType, values.challengeId, values.specificUser]);

  const displayEstimate = audienceReady ? estimate : null;

  return (
    <form action={formAction} className="space-y-4">
      {campaignId ? <input name="campaignId" type="hidden" value={campaignId} /> : null}
      <input name="imageUrl" type="hidden" value={values.imageUrl} />
      <input name="channelInternal" type="hidden" value={values.channelInternal ? "on" : ""} />
      <input name="channelPush" type="hidden" value={values.channelPush ? "on" : ""} />
      <input name="destinationType" type="hidden" value={values.destinationType} />
      <input name="audienceType" type="hidden" value={values.audienceType} />
      <input name="challengeId" type="hidden" value={values.challengeId} />
      <input name="specificUserId" type="hidden" value={values.specificUser?.id ?? ""} />

      {state.message ? (
        <StatusCard
          description={state.message}
          title={state.ok ? "Tudo certo" : "Revise os campos"}
          tone={state.ok ? "success" : "error"}
        />
      ) : null}

      <Field error={fieldErrors?.title?.[0]} label="Título">
        <Input
          maxLength={120}
          name="title"
          onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
          required
          value={values.title}
        />
      </Field>

      <Field error={fieldErrors?.message?.[0]} label="Mensagem">
        <Textarea
          maxLength={500}
          name="message"
          onChange={(event) => setValues((prev) => ({ ...prev, message: event.target.value }))}
          required
          rows={3}
          value={values.message}
        />
      </Field>

      <ImageUploadField
        imageUrl={values.imageUrl}
        onUploaded={(url) => setValues((prev) => ({ ...prev, imageUrl: url }))}
      />

      <Field error={fieldErrors?.actionLabel?.[0]} hint="Texto do botão de ação (opcional)." label="Texto do botão">
        <Input
          maxLength={40}
          name="actionLabelDisplay"
          onChange={(event) => setValues((prev) => ({ ...prev, actionLabel: event.target.value }))}
          value={values.actionLabel}
        />
        <input name="actionLabel" type="hidden" value={values.actionLabel} />
      </Field>

      <Select
        label="Destino ao clicar"
        name="destinationTypeDisplay"
        onValueChange={(value) => {
          if (isNotificationDestinationType(value)) {
            setValues((prev) => ({ ...prev, destinationType: value }));
          }
        }}
        options={destinationOptions}
        required
        value={values.destinationType}
      />

      {destinationRequiresReference(values.destinationType) ? (
        <Field
          error={fieldErrors?.destinationReferenceId?.[0]}
          hint="Slug do desafio ou da dica."
          label="Identificador do destino"
        >
          <Input
            name="destinationReferenceIdDisplay"
            onChange={(event) =>
              setValues((prev) => ({ ...prev, destinationReferenceId: event.target.value }))
            }
            required
            value={values.destinationReferenceId}
          />
          <input name="destinationReferenceId" type="hidden" value={values.destinationReferenceId} />
        </Field>
      ) : null}

      <Select
        label="Público"
        name="audienceTypeDisplay"
        onValueChange={(value) => {
          setValues((prev) => ({
            ...prev,
            audienceType: value as NotificationAudienceType,
            challengeId: "",
            specificUser: null,
          }));
        }}
        options={audienceOptions}
        required
        value={values.audienceType}
      />

      {AUDIENCE_REQUIRES_CHALLENGE.has(values.audienceType) ? (
        <Select
          label="Desafio"
          name="challengeIdDisplay"
          onValueChange={(value) => setValues((prev) => ({ ...prev, challengeId: value }))}
          options={challengeOptions}
          placeholder="Selecione um desafio"
          required
          value={values.challengeId}
        />
      ) : null}

      {AUDIENCE_REQUIRES_USER.has(values.audienceType) ? (
        <Field label="Usuário">
          <UserPicker
            onSelect={(user) => setValues((prev) => ({ ...prev, specificUser: user }))}
            selected={values.specificUser}
          />
        </Field>
      ) : null}

      <div className="rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-muted">
        Público estimado:{" "}
        <strong className="text-foreground">
          {displayEstimate === null ? "—" : displayEstimate.toLocaleString("pt-BR")}
        </strong>
      </div>

      <div className="space-y-2">
        <Checkbox
          checked={values.channelInternal}
          description="Sempre entregue a quem está no público, com ou sem push."
          label="Central interna"
          onChange={(event) => setValues((prev) => ({ ...prev, channelInternal: event.target.checked }))}
        />
        <Checkbox
          checked={values.channelPush}
          description="Só chega a quem ativou push neste dispositivo."
          label="Push"
          onChange={(event) => setValues((prev) => ({ ...prev, channelPush: event.target.checked }))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton label={mode === "create" ? "Salvar rascunho" : "Salvar alterações"} />
        <Button as="a" href="/admin/notificacoes" type="button" variant="ghost">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
