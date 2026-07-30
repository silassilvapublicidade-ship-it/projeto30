"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import {
  removeTipImageAction,
  uploadTipImageAction,
  type AdminTipActionResult,
} from "@/features/admin/admin-tips.actions";

const initialState: AdminTipActionResult = { ok: false, message: "" };

function UploadSubmitButton({ hasFile }: { hasFile: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={!hasFile} loading={pending} size="sm" type="submit">
      {pending ? "Enviando" : "Enviar imagem"}
    </Button>
  );
}

function RemoveSubmitButton({ onRequestConfirm }: { onRequestConfirm: (event: React.MouseEvent) => void }) {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} onClick={onRequestConfirm} size="sm" type="submit" variant="ghost">
      {pending ? "Removendo" : "Remover imagem"}
    </Button>
  );
}

type TipImageUploaderProps = {
  currentImageUrl: string | null;
  tipId: string;
};

/**
 * Drag-and-drop + click-to-browse file picker. Real upload progress isn't
 * available from a plain server action (no XHR progress events), so the
 * "progresso" requirement is covered by a clear pending/sending state
 * (useFormStatus) rather than a fabricated percentage bar.
 */
export function TipImageUploader({ currentImageUrl, tipId }: TipImageUploaderProps) {
  const [uploadState, uploadAction] = useActionState(uploadTipImageAction, initialState);
  const [removeState, removeAction] = useActionState(removeTipImageAction, initialState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function applyFile(file: File | undefined) {
    if (!inputRef.current) {
      return;
    }

    if (!file) {
      setPreviewUrl(null);
      inputRef.current.value = "";
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    inputRef.current.files = transfer.files;
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveClick(event: React.MouseEvent) {
    if (!window.confirm("Remover a imagem deste card? A dica volta a ficar sem imagem.")) {
      event.preventDefault();
    }
  }

  const displayImageUrl = previewUrl ?? currentImageUrl;

  return (
    <div className="space-y-3">
      <div
        className="relative flex aspect-[4/5] w-full max-w-[240px] items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-dashed border-white/[0.16] bg-white/[0.03] data-[dragging=true]:border-action/60 data-[dragging=true]:bg-action/[0.06]"
        data-dragging={isDragging}
        onClick={() => inputRef.current?.click()}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          applyFile(event.dataTransfer.files?.[0]);
        }}
        role="button"
        tabIndex={0}
      >
        {displayImageUrl ? (
          <Image alt="" className="object-contain" fill sizes="240px" src={displayImageUrl} />
        ) : (
          <p className="px-4 text-center text-xs leading-5 text-muted-2">
            Arraste uma imagem aqui ou clique para escolher
            <br />
            (recomendado 1080×1350 · 4:5)
          </p>
        )}
      </div>

      <form action={uploadAction} className="flex flex-wrap items-center gap-2">
        <input name="tipId" type="hidden" value={tipId} />
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label="Selecionar imagem do card"
          className="w-full min-w-0 text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-foreground sm:w-auto"
          name="image"
          onChange={(event) => applyFile(event.target.files?.[0])}
          ref={inputRef}
          type="file"
        />
        <UploadSubmitButton hasFile={Boolean(previewUrl)} />
      </form>

      {currentImageUrl ? (
        <form action={removeAction}>
          <input name="tipId" type="hidden" value={tipId} />
          <RemoveSubmitButton onRequestConfirm={handleRemoveClick} />
        </form>
      ) : null}

      <p className="text-xs leading-5 text-muted-2">
        JPEG, PNG ou WebP · até 10 MB · publicação exige uma imagem enviada. Enviar uma nova imagem
        substitui a atual.
      </p>

      {uploadState.message ? (
        <StatusCard
          description={uploadState.message}
          title={uploadState.ok ? "Tudo certo" : "Não foi possível"}
          tone={uploadState.ok ? (uploadState.ratioWarning ? "warning" : "success") : "error"}
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
  );
}
