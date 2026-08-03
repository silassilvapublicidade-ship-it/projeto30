"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { AchievementCardPreview } from "@/components/admin/achievement-card-preview";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import {
  updateAchievementAction,
  type AdminAchievementActionResult,
} from "@/features/admin/admin-achievements.actions";
import { ACHIEVEMENT_ICONS, getAchievementRuleDefinitionBySlug } from "@/features/admin/admin-achievements.schemas";
import type { AdminAchievementRow } from "@/server/services/admin-achievements.service";

const initialState: AdminAchievementActionResult = { ok: false, message: "" };

const iconOptions = ACHIEVEMENT_ICONS.map((icon) => ({ label: icon, value: icon }));

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} type="submit">
      {pending ? "Salvando" : "Salvar conquista"}
    </Button>
  );
}

export function AchievementEditForm({ achievement }: { achievement: AdminAchievementRow }) {
  const [state, formAction] = useActionState(updateAchievementAction, initialState);
  const fieldErrors = state.ok ? undefined : state.fieldErrors;
  const ruleDefinition = getAchievementRuleDefinitionBySlug(achievement.slug);

  const [name, setName] = useState(achievement.name);
  const [description, setDescription] = useState(achievement.description ?? "");
  const [icon, setIcon] = useState(achievement.icon ?? "");
  const [category, setCategory] = useState(achievement.category ?? "");
  const [rarity, setRarity] = useState(achievement.rarity ?? "");
  const [shareTitle, setShareTitle] = useState(achievement.share_title ?? "");
  const [shareMessage, setShareMessage] = useState(achievement.share_message ?? "");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <form action={formAction} className="space-y-4">
        <input name="achievementId" type="hidden" value={achievement.id} />

        {state.message ? (
          <StatusCard
            description={state.message}
            title={state.ok ? "Tudo certo" : "Revise os campos"}
            tone={state.ok ? "success" : "error"}
          />
        ) : null}

        <div className="rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.03] p-3">
          <p className="text-xs text-muted-2">Desafio</p>
          <p className="text-sm font-semibold text-foreground">{achievement.challenge_name}</p>
          <p className="mt-2 text-xs text-muted-2">Tipo de regra (fixo)</p>
          <p className="text-sm text-foreground">{ruleDefinition?.label ?? achievement.slug}</p>
        </div>

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
          label="Ícone (opcional)"
          name="icon"
          onValueChange={setIcon}
          options={iconOptions}
          placeholder="Selecione um ícone"
          value={icon}
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
            <Input defaultValue={achievement.points_bonus} min={0} name="pointsBonus" type="number" />
          </Field>
          <Field error={fieldErrors?.sortOrder?.[0]} hint="Menor valor aparece primeiro." label="Ordem de exibição">
            <Input defaultValue={achievement.sort_order} min={0} name="sortOrder" type="number" />
          </Field>
        </div>

        <Switch
          defaultChecked={achievement.active}
          description="Conquistas inativas nunca são avaliadas para novos desbloqueios, mas o histórico de quem já desbloqueou é preservado."
          label="Ativa"
          name="active"
        />

        <SaveButton />
      </form>

      <AchievementCardPreview
        fields={{
          category: category || undefined,
          challengeName: achievement.challenge_name,
          description: description || undefined,
          icon: icon || undefined,
          name: name || achievement.name,
          rarity: rarity || undefined,
          shareMessage: shareMessage || undefined,
          shareTitle: shareTitle || undefined,
        }}
      />
    </div>
  );
}
