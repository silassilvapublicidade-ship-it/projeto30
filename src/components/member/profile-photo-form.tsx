"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";

import { MemberAvatar } from "@/components/member/member-avatar";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import type { MemberActionResult } from "@/features/member/member.actions";
import { removeAvatarAction, uploadAvatarAction } from "@/features/member/profile.actions";

const initialState: MemberActionResult = { ok: false, message: "" };

function UploadButton() {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} size="sm" type="submit">
      {pending ? "Enviando" : "Enviar foto"}
    </Button>
  );
}

function RemoveButton({ onRequestConfirm }: { onRequestConfirm: (event: React.MouseEvent) => void }) {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} onClick={onRequestConfirm} size="sm" type="submit" variant="ghost">
      {pending ? "Removendo" : "Remover foto"}
    </Button>
  );
}

/**
 * Owns the file input and its local preview. Remounted via a `key` on the
 * parent whenever an upload succeeds, which resets the native input and the
 * preview together without reaching for an effect-driven setState.
 */
function AvatarFilePicker() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <div className="flex w-full flex-col items-center gap-2 sm:flex-row">
      {previewUrl ? (
        <span className="relative size-11 shrink-0 overflow-hidden rounded-full ring-2 ring-action/40">
          <Image alt="Prévia da nova foto" className="object-cover" fill sizes="44px" src={previewUrl} />
        </span>
      ) : null}
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label="Selecionar foto de perfil"
        className="w-full min-w-0 text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-foreground sm:w-auto"
        name="avatar"
        onChange={(event) => {
          const file = event.target.files?.[0];
          setPreviewUrl(file ? URL.createObjectURL(file) : null);
        }}
        type="file"
      />
    </div>
  );
}

export function ProfilePhotoForm({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null;
  name: string;
}) {
  const [uploadState, uploadAction] = useActionState(uploadAvatarAction, initialState);
  const [removeState, removeAction] = useActionState(removeAvatarAction, initialState);

  function handleRemoveClick(event: React.MouseEvent) {
    if (!window.confirm("Remover sua foto de perfil? Você pode enviar outra a qualquer momento.")) {
      event.preventDefault();
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <MemberAvatar avatarUrl={avatarUrl} name={name} size="xl" />

      <div className="w-full flex-1 space-y-3">
        <form action={uploadAction} className="flex flex-col items-center gap-3 sm:flex-row">
          <AvatarFilePicker key={`${uploadState.ok}:${uploadState.message}`} />
          <UploadButton />
        </form>

        {avatarUrl ? (
          <form action={removeAction}>
            <RemoveButton onRequestConfirm={handleRemoveClick} />
          </form>
        ) : null}

        <p className="text-center text-xs leading-5 text-muted-2 sm:text-left">
          JPEG, PNG ou WebP · até 5 MB · recorte quadrado recomendado.
        </p>

        {uploadState.message ? (
          <StatusCard
            description={uploadState.message}
            title={uploadState.ok ? "Tudo certo" : "Não foi possível"}
            tone={uploadState.ok ? "success" : "error"}
          />
        ) : null}
        {removeState.message ? (
          <StatusCard
            description={removeState.message}
            title={removeState.ok ? "Tudo certo" : "Não foi possível"}
            tone={removeState.ok ? "success" : "error"}
          />
        ) : null}
      </div>
    </div>
  );
}
