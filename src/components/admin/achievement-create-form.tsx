"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { AchievementCardPreview } from "@/components/admin/achievement-card-preview";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import {
  createAchievementAction,
  type AdminAchievementActionResult,
} from "@/features/admin/admin-achievements.actions";
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_RULE_TYPES } from "@/features/admin/admin-achievements.schemas";

const initialState: AdminAchievementActionResult = { ok: false, message: "" };

const iconOptions = ACHIEVEMENT_ICONS.map((icon) => ({ label: icon, value: icon }));

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} type="submit">
      {pending ? "Criando" : "Criar conquista"}
    </Button>
  );
}

type ChallengeOption = { id: string; name: string };

export function AchievementCreateForm({
  challenges,
  usedSlugsByChallengeId,
}: {
  challenges: ChallengeOption[];
  usedSlugsByChallengeId: Record<string, string[]>;
}) {
  const [state, formAction] = useActionState(createAchievementAction, initialState);
  const fieldErrors = state.ok ? undefined : state.fieldErrors;

  const [challengeId, setChallengeId] = useState("");
  const [ruleType, setRuleType] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [rarity, setRarity] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  const challengeOptions = challenges.map((challenge) => ({ label: challenge.name, value: challenge.id }));
  const ruleTypeOptions = useMemo(() => {
    const usedSlugs = usedSlugsByChallengeId[challengeId] ?? [];
    return ACHIEVEMENT_RULE_TYPES.filter((rule) => !usedSlugs.includes(rule.slug)).map((rule) => ({
      label: rule.label,
      value: rule.type,
    }));
  }, [challengeId, usedSlugsByChallengeId]);

  const selectedChallenge = challenges.find((challenge) => challenge.id === challengeId);
  const selectedRule = ACHIEVEMENT_RULE_TYPES.find((rule) => rule.type === ruleType);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <form action={formAction} className="space-y-4">
        {state.message ? (
          <StatusCard
            description={state.message}
            title={state.ok ? "Tudo certo" : "Revise os campos"}
            tone={state.ok ? "success" : "error"}
          />
        ) : null}

        <Select
          error={fieldErrors?.challengeId?.[0]}
          label="Desafio"
          name="challengeId"
          onValueChange={(value) => {
            setChallengeId(value);
            setRuleType("");
          }}
          options={challengeOptions}
          placeholder="Selecione um desafio"
          required
          value={challengeId}
        />

        <Select
          error={fieldErrors?.ruleType?.[0]}
          label="Tipo de regra"
          name="ruleType"
          onValueChange={(value) => {
            setRuleType(value);
            const rule = ACHIEVEMENT_RULE_TYPES.find((entry) => entry.type === value);
            if (rule && !name) {
              setName(rule.defaultName);
            }
          }}
          options={ruleTypeOptions}
          placeholder={
            challengeId
              ? ruleTypeOptions.length === 0
                ? "Todos os tipos já existem para este desafio"
                : "Selecione um tipo de regra"
              : "Selecione um desafio primeiro"
          }
          required
          value={ruleType}
        />

        <p className="-mt-2 text-xs leading-5 text-muted-2">
          O tipo de regra define quando a conquista é desbloqueada de verdade pelo motor do
          aplicativo - não é editável depois de criada. Os limiares (ex.: &quot;3 dias&quot;) são
          fixos no motor e apenas informativos aqui.
        </p>

        <Field error={fieldErrors?.name?.[0]} label="Nome">
          <Input
            maxLength={120}
            minLength={3}
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>

        <Field error={fieldErrors?.description?.[0]} label="Descrição (opcional)">
          <Textarea
            maxLength={280}
            name="description"
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            value={description}
          />
        </Field>

        <Select
          defaultValue={selectedRule?.defaultIcon ?? ""}
          label="Ícone (opcional)"
          name="icon"
          options={iconOptions}
          placeholder="Selecione um ícone"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field error={fieldErrors?.category?.[0]} hint="Ex.: consistência, leitura, marco." label="Categoria (opcional)">
            <Input
              maxLength={60}
              name="category"
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            />
          </Field>
          <Field error={fieldErrors?.rarity?.[0]} hint="Ex.: comum, rara, épica, lendária." label="Raridade (opcional)">
            <Input
              maxLength={60}
              name="rarity"
              onChange={(event) => setRarity(event.target.value)}
              value={rarity}
            />
          </Field>
        </div>

        <Field error={fieldErrors?.shareTitle?.[0]} hint="Se vazio, usa o nome da conquista." label="Título de compartilhamento (opcional)">
          <Input
            maxLength={120}
            name="shareTitle"
            onChange={(event) => setShareTitle(event.target.value)}
            value={shareTitle}
          />
        </Field>

        <Field error={fieldErrors?.shareMessage?.[0]} hint="Se vazio, usa a descrição." label="Mensagem de compartilhamento (opcional)">
          <Textarea
            maxLength={200}
            name="shareMessage"
            onChange={(event) => setShareMessage(event.target.value)}
            rows={2}
            value={shareMessage}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field error={fieldErrors?.pointsBonus?.[0]} label="Pontos bônus">
            <Input defaultValue={0} min={0} name="pointsBonus" type="number" />
          </Field>
          <Field error={fieldErrors?.sortOrder?.[0]} hint="Menor valor aparece primeiro." label="Ordem de exibição">
            <Input defaultValue={0} min={0} name="sortOrder" type="number" />
          </Field>
        </div>

        <SaveButton />
      </form>

      <AchievementCardPreview
        fields={{
          category: category || undefined,
          challengeName: selectedChallenge?.name,
          description: description || undefined,
          name: name || selectedRule?.defaultName || "Nova conquista",
          rarity: rarity || undefined,
          shareMessage: shareMessage || undefined,
          shareTitle: shareTitle || undefined,
        }}
      />
    </div>
  );
}
