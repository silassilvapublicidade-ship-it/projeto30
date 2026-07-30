"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { TipCard } from "@/components/member/tip-card";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { createTipCardAction, type AdminTipActionResult } from "@/features/admin/admin-tips.actions";
import { TIP_CATEGORIES, isRecommendedTipImageRatio } from "@/features/admin/admin-tips.schemas";

const initialState: AdminTipActionResult = { ok: false, message: "" };

const categoryOptions = TIP_CATEGORIES.map((category) => ({ label: category, value: category }));

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SubmitButtons({ hasFile }: { hasFile: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={pending}
        loading={pending}
        name="intent"
        type="submit"
        value="draft"
        variant="secondary"
      >
        {pending ? "Salvando" : "Salvar como rascunho"}
      </Button>
      <Button disabled={pending || !hasFile} loading={pending} name="intent" type="submit" value="publish">
        {pending ? "Publicando" : "Publicar agora"}
      </Button>
      <Button as="a" disabled={pending} href="/admin/dicas" type="button" variant="ghost">
        Cancelar
      </Button>
    </div>
  );
}

export function TipCreateForm({
  challenges,
}: {
  challenges: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(createTipCardAction, initialState);
  const fieldErrors = state.ok ? undefined : state.fieldErrors;

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ratioWarning, setRatioWarning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function applyFile(nextFile: File | undefined) {
    if (!inputRef.current) {
      return;
    }

    if (!nextFile) {
      setFile(null);
      setPreviewUrl(null);
      setRatioWarning(false);
      inputRef.current.value = "";
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(nextFile);
    inputRef.current.files = transfer.files;
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  const challengeOptions = [
    { label: "Nenhum", value: "" },
    ...challenges.map((challenge) => ({ label: challenge.name, value: challenge.id })),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form action={formAction} className="space-y-4">
        {state.message ? (
          <StatusCard
            description={state.message}
            title={state.ok ? "Tudo certo" : "Revise os campos"}
            tone={state.ok ? "success" : "error"}
          />
        ) : null}

        <Field error={fieldErrors?.image?.[0]} label="Imagem do card">
          <div
            className="relative flex aspect-[4/5] w-full max-w-[240px] cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-dashed border-white/[0.16] bg-white/[0.03] transition-colors data-[dragging=true]:border-action/60 data-[dragging=true]:bg-action/[0.06]"
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
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL, next/image can't optimize it and doesn't need to.
              <img
                alt=""
                className="size-full object-contain"
                onLoad={(event) => {
                  const img = event.currentTarget;
                  setRatioWarning(!isRecommendedTipImageRatio(img.naturalWidth, img.naturalHeight));
                }}
                src={previewUrl}
              />
            ) : (
              <p className="px-4 text-center text-xs leading-5 text-muted-2">
                Arraste uma imagem aqui ou clique para escolher
                <br />
                (recomendado 1080×1350 · 4:5)
              </p>
            )}
          </div>

          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label="Selecionar imagem do card"
            className="mt-2 w-full min-w-0 text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-foreground"
            name="image"
            onChange={(event) => applyFile(event.target.files?.[0])}
            ref={inputRef}
            type="file"
          />

          {file ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-2">
              <span className="truncate">{file.name}</span>
              <span>·</span>
              <span>{formatFileSize(file.size)}</span>
              <span>·</span>
              <span>{file.type}</span>
              <button
                className="font-semibold text-danger hover:underline"
                onClick={() => applyFile(undefined)}
                type="button"
              >
                Remover
              </button>
            </div>
          ) : null}

          {ratioWarning ? (
            <p className="mt-2 text-xs leading-5 text-action-soft">
              Esta imagem foge da proporção recomendada (4:5, ex. 1080×1350). Ela ainda pode ser usada -
              revise o preview ao lado.
            </p>
          ) : null}

          <p className="mt-2 text-xs leading-5 text-muted-2">
            JPEG, PNG ou WebP · até 10 MB · obrigatória para publicar.
          </p>
        </Field>

        <Field error={fieldErrors?.title?.[0]} label="Título">
          <Input
            maxLength={160}
            minLength={3}
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </Field>

        <Select
          error={fieldErrors?.category?.[0]}
          label="Categoria"
          name="category"
          onValueChange={setCategory}
          options={categoryOptions}
          placeholder="Selecione uma categoria"
          required
          value={category}
        />

        <Field
          error={fieldErrors?.displayOrder?.[0]}
          hint="Menor valor aparece primeiro na listagem."
          label="Ordem de exibição"
        >
          <Input defaultValue={0} min={0} name="displayOrder" required type="number" />
        </Field>

        <Field
          error={fieldErrors?.summary?.[0]}
          hint="Aparece na listagem do usuário, abaixo do título."
          label="Resumo (opcional)"
        >
          <Textarea
            maxLength={280}
            name="summary"
            onChange={(event) => setSummary(event.target.value)}
            rows={2}
            value={summary}
          />
        </Field>

        <Field
          error={fieldErrors?.content?.[0]}
          hint="Se vazio, o card só mostra a imagem (sem tela de detalhe com texto)."
          label="Descrição completa (opcional)"
        >
          <Textarea maxLength={4000} name="content" rows={5} />
        </Field>

        <Field
          error={fieldErrors?.altText?.[0]}
          hint="Texto alternativo da imagem, para leitores de tela. Se vazio, usa o título."
          label="Texto alternativo (opcional)"
        >
          <Input maxLength={200} name="altText" />
        </Field>

        <Select
          label="Desafio relacionado (opcional)"
          name="challengeId"
          options={challengeOptions}
          placeholder="Nenhum"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            error={fieldErrors?.startsAt?.[0]}
            hint="Opcional - card só aparece a partir desta data."
            label="Início da exibição"
          >
            <Input name="startsAt" type="datetime-local" />
          </Field>
          <Field
            error={fieldErrors?.endsAt?.[0]}
            hint="Opcional - card some após esta data."
            label="Fim da exibição"
          >
            <Input name="endsAt" type="datetime-local" />
          </Field>
        </div>

        <SubmitButtons hasFile={Boolean(file)} />
      </form>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-2">
          Preview - como o usuário vai ver
        </p>
        <div className="max-w-[280px]">
          <TipCard
            altText={null}
            category={category || null}
            imageUrl={previewUrl}
            summary={summary || null}
            title={title || "Título do card"}
          />
        </div>
      </div>
    </div>
  );
}
