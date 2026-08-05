"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import {
  createLibraryContentAction,
  updateLibraryContentAction,
  type AdminLibraryActionResult,
} from "@/features/admin/admin-library.actions";
import {
  LIBRARY_DIFFICULTIES,
  LIBRARY_DIFFICULTY_LABELS,
  LIBRARY_PILLARS,
  LIBRARY_PILLAR_LABELS,
  suggestLibrarySlug,
  suggestsEnhancedReview,
} from "@/features/library/library.core";
import type { AdminLibraryContentFull } from "@/server/services/admin-library.service";

const initialState: AdminLibraryActionResult = { ok: false, message: "" };

const pillarOptions = LIBRARY_PILLARS.map((pillar) => ({ label: LIBRARY_PILLAR_LABELS[pillar], value: pillar }));
const difficultyOptions = LIBRARY_DIFFICULTIES.map((difficulty) => ({
  label: LIBRARY_DIFFICULTY_LABELS[difficulty],
  value: difficulty,
}));

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} loading={pending} type="submit">
      {pending ? "Salvando" : isEdit ? "Salvar alterações" : "Salvar rascunho"}
    </Button>
  );
}

export function LibraryContentForm({
  challenges,
  content,
}: {
  challenges: Array<{ id: string; name: string }>;
  content?: AdminLibraryContentFull;
}) {
  const isEdit = Boolean(content);
  const [state, formAction] = useActionState(
    isEdit ? updateLibraryContentAction : createLibraryContentAction,
    initialState,
  );
  const fieldErrors = state.ok ? undefined : state.fieldErrors;

  const [title, setTitle] = useState(content?.title ?? "");
  const [slug, setSlug] = useState(content?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [pillar, setPillar] = useState(content?.pillar ?? "");
  const [difficulty, setDifficulty] = useState(content?.difficulty ?? "beginner");
  const [relatedChallengeId, setRelatedChallengeId] = useState(content?.related_challenge_id ?? "");
  const [category, setCategory] = useState(content?.category ?? "");
  const [summary, setSummary] = useState(content?.summary ?? "");
  const [requiresEnhancedReview, setRequiresEnhancedReview] = useState(content?.requires_enhanced_review ?? false);

  const enhancedReviewSuggested = suggestsEnhancedReview(`${title} ${summary} ${category}`);
  const challengeOptions = [
    { label: "Nenhum", value: "" },
    ...challenges.map((challenge) => ({ label: challenge.name, value: challenge.id })),
  ];

  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      {isEdit ? <input name="contentId" type="hidden" value={content!.id} /> : null}

      {state.message ? (
        <StatusCard
          description={state.message}
          title={state.ok ? "Tudo certo" : "Revise os campos"}
          tone={state.ok ? "success" : "error"}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={fieldErrors?.title?.[0]} label="Título">
          <Input
            maxLength={160}
            minLength={3}
            name="title"
            onChange={(event) => {
              const nextTitle = event.target.value;
              setTitle(nextTitle);
              if (!slugTouched) {
                setSlug(suggestLibrarySlug(nextTitle));
              }
            }}
            required
            value={title}
          />
        </Field>
        <Field
          error={fieldErrors?.slug?.[0]}
          hint="Usado na URL - só letras minúsculas, números e hífens."
          label="Slug"
        >
          <Input
            disabled={isEdit}
            name="slug"
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
            value={slug}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          error={fieldErrors?.pillar?.[0]}
          label="Pilar"
          name="pillar"
          onValueChange={setPillar}
          options={pillarOptions}
          placeholder="Selecione um pilar"
          required
          value={pillar}
        />
        <Field label="Categoria (opcional)">
          <Input maxLength={80} name="category" onChange={(event) => setCategory(event.target.value)} value={category} />
        </Field>
        <Select label="Dificuldade" name="difficulty" onValueChange={setDifficulty} options={difficultyOptions} value={difficulty} />
      </div>

      <Field label="Subtítulo (opcional)">
        <Input maxLength={200} defaultValue={content?.subtitle ?? ""} name="subtitle" />
      </Field>

      <Field hint="Aparece na listagem e no card de destaque." label="Resumo (opcional)">
        <Textarea
          maxLength={400}
          name="summary"
          onChange={(event) => setSummary(event.target.value)}
          rows={2}
          value={summary}
        />
      </Field>

      <Field label="Introdução (opcional)">
        <Textarea defaultValue={content?.introduction ?? ""} maxLength={2000} name="introduction" rows={3} />
      </Field>

      <Field hint="Conteúdo principal - o corpo do texto." label="Conteúdo principal (opcional)">
        <Textarea defaultValue={content?.body ?? ""} maxLength={20000} name="body" rows={10} />
      </Field>

      <Field label="Aplicação prática (opcional)">
        <Textarea defaultValue={content?.practical_application ?? ""} maxLength={2000} name="practicalApplication" rows={2} />
      </Field>

      <Field label="Pergunta de reflexão (opcional)">
        <Textarea defaultValue={content?.reflection_question ?? ""} maxLength={500} name="reflectionQuestion" rows={2} />
      </Field>

      <Field label="Uma pequena ação (opcional)">
        <Textarea defaultValue={content?.small_action ?? ""} maxLength={500} name="smallAction" rows={2} />
      </Field>

      <Field label="Mensagem final (opcional)">
        <Textarea defaultValue={content?.final_message ?? ""} maxLength={1000} name="finalMessage" rows={2} />
      </Field>

      <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-2">Trecho bíblico (opcional)</p>
        <p className="text-xs leading-5 text-muted-2">
          Nunca cole um trecho gerado sem conferir a referência - a Bíblia nunca deve ser exibida com base em
          texto inventado.
        </p>
        <Field label="Referência (ex.: Salmos 23:1)">
          <Input defaultValue={content?.bible_reference ?? ""} maxLength={80} name="bibleReference" />
        </Field>
        <Field label="Trecho (cole o texto final conferido)">
          <Textarea defaultValue={content?.bible_excerpt ?? ""} maxLength={1000} name="bibleExcerpt" rows={2} />
        </Field>
      </div>

      <Field hint="Separe por vírgula." label="Tags (opcional)">
        <Input defaultValue={content?.tags?.join(", ") ?? ""} name="tags" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field hint="Estimativa em minutos." label="Tempo de leitura (opcional)">
          <Input defaultValue={content?.reading_time_minutes ?? ""} min={1} name="readingTimeMinutes" type="number" />
        </Field>
        <Select
          label="Desafio relacionado (opcional)"
          name="relatedChallengeId"
          onValueChange={setRelatedChallengeId}
          options={challengeOptions}
          placeholder="Nenhum"
          value={relatedChallengeId}
        />
      </div>

      <Field hint="Cole a URL de uma imagem já hospedada (ex.: reaproveitando uma capa existente)." label="URL da capa (opcional)">
        <Input defaultValue={content?.cover_image_url ?? ""} name="coverImageUrl" type="url" />
      </Field>

      <Checkbox
        defaultChecked={requiresEnhancedReview}
        description={
          enhancedReviewSuggested
            ? "Sugerido automaticamente: o texto menciona saúde, fé ou outro tema sensível."
            : "Marque para conteúdos sobre saúde, alimentação, treino, Bíblia, teologia ou apoio emocional."
        }
        label="Exigir revisão reforçada"
        name="requiresEnhancedReview"
        onChange={(event) => setRequiresEnhancedReview(event.target.checked)}
      />

      <div className="flex flex-wrap gap-2">
        <SubmitButton isEdit={isEdit} />
        <Button as="a" href="/admin/biblioteca" type="button" variant="ghost">
          {isEdit ? "Voltar" : "Cancelar"}
        </Button>
      </div>
    </form>
  );
}
