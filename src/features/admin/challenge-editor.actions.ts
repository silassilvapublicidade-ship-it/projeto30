"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { challengeHasParticipants } from "@/server/services/admin-challenge-editor.service";
import { requireAdminUser } from "@/server/services/admin-session.service";
import type { Json } from "@/types/database";

import {
  challengeCalendarSchema,
  challengeIdParamSchema,
  challengeIdentitySchema,
  challengeRulesSchema,
  habitIdParamSchema,
  habitSchema,
  habitVisibilityFormSchema,
} from "./challenge-editor.schemas";
import { mergeJsonConfig, suggestChallengeSlug } from "./challenge-editor.core";

function editorPath(challengeId: string) {
  return `/admin/desafios/${challengeId}/editar`;
}

function redirectWithFeedback(challengeId: string, feedback: string): never {
  redirect(`${editorPath(challengeId)}?feedback=${feedback}`);
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function createChallengeDraftAction(formData: FormData) {
  await requireAdminUser();

  const name = getFormValue(formData, "name") ?? "";
  const durationDaysRaw = getFormValue(formData, "durationDays") ?? "30";
  const parsedDuration = Number.parseInt(durationDaysRaw, 10);

  if (name.trim().length < 3 || Number.isNaN(parsedDuration) || parsedDuration < 1) {
    redirect("/admin/desafios/novo?feedback=invalid");
  }

  const slug = getFormValue(formData, "slug") ?? suggestChallengeSlug(name);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      description: getFormValue(formData, "description") ?? null,
      duration_days: parsedDuration,
      name: name.trim(),
      slug,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    const message = error?.code === "23505" ? "slug-taken" : "error";
    redirect(`/admin/desafios/novo?feedback=${message}`);
  }

  redirect(editorPath(data.id));
}

export async function updateChallengeIdentityAction(formData: FormData) {
  await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));
  const parsed = challengeIdentitySchema.safeParse({
    ctaLabel: getFormValue(formData, "ctaLabel"),
    ctaSupportingText: getFormValue(formData, "ctaSupportingText"),
    description: getFormValue(formData, "description"),
    headline: getFormValue(formData, "headline"),
    heroMessage: getFormValue(formData, "heroMessage"),
    name: getFormValue(formData, "name") ?? "",
    shortDescription: getFormValue(formData, "shortDescription"),
    slug: getFormValue(formData, "slug") ?? "",
    subheadline: getFormValue(formData, "subheadline"),
    tagline: getFormValue(formData, "tagline"),
    themeCategory: getFormValue(formData, "themeCategory"),
    visualStyle: getFormValue(formData, "visualStyle"),
  });

  if (!parsed.success) {
    redirectWithFeedback(challengeId, "invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from("challenges")
    .select("theme_config")
    .eq("id", challengeId)
    .maybeSingle();

  const themeConfig = mergeJsonConfig(current?.theme_config as Record<string, unknown> | null, {
    category: parsed.data.themeCategory,
    cta_label: parsed.data.ctaLabel,
    cta_supporting_text: parsed.data.ctaSupportingText,
    headline: parsed.data.headline,
    hero_message: parsed.data.heroMessage,
    short_description: parsed.data.shortDescription,
    subheadline: parsed.data.subheadline,
    tagline: parsed.data.tagline,
    visual_style: parsed.data.visualStyle,
  });

  // Editorial: sempre permitido, mesmo com participantes (ver
  // classifyChallengeField em challenge-editor.core.ts).
  const { error } = await supabase
    .from("challenges")
    .update({
      description: parsed.data.description ?? null,
      name: parsed.data.name,
      slug: parsed.data.slug,
      theme_config: themeConfig as unknown as Json,
    })
    .eq("id", challengeId);

  if (error) {
    redirectWithFeedback(challengeId, error.code === "23505" ? "slug-taken" : "error");
  }

  redirectWithFeedback(challengeId, "identity-success");
}

export async function updateChallengeCalendarAndRulesAction(formData: FormData) {
  await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));
  const hasParticipants = await challengeHasParticipants(challengeId);

  const calendarParsed = challengeCalendarSchema.safeParse({
    durationDays: getFormValue(formData, "durationDays") ?? "0",
    enrollmentEnd: getFormValue(formData, "enrollmentEnd"),
    enrollmentStart: getFormValue(formData, "enrollmentStart"),
    endDate: getFormValue(formData, "endDate"),
    startDate: getFormValue(formData, "startDate"),
  });
  const rulesParsed = challengeRulesSchema.safeParse({
    allHabitsBonusPoints: getFormValue(formData, "allHabitsBonusPoints"),
    allowAbandonment: formData.get("allowAbandonment") === "on",
    allowJoinAfterStart: formData.get("allowJoinAfterStart") === "on",
    finalizeDayPoints: getFormValue(formData, "finalizeDayPoints"),
    participantLimit: getFormValue(formData, "participantLimit"),
    reflectionPoints: getFormValue(formData, "reflectionPoints"),
    streakMinimumCompletion: getFormValue(formData, "streakMinimumCompletion"),
  });

  if (!calendarParsed.success || !rulesParsed.success) {
    redirectWithFeedback(challengeId, "invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from("challenges")
    .select("duration_days, rules_config")
    .eq("id", challengeId)
    .maybeSingle();

  if (!current) {
    redirectWithFeedback(challengeId, "error");
  }

  // Estrutural (duracao) so pode mudar sem participantes - operacional
  // (janela de inscricao, limite, pontos, permissoes) sempre pode.
  const durationChanged = calendarParsed.data.durationDays !== current.duration_days;

  if (durationChanged && hasParticipants) {
    redirectWithFeedback(challengeId, "structural-blocked");
  }

  const rulesConfig = mergeJsonConfig(current.rules_config as Record<string, unknown> | null, {
    all_habits_bonus_points: rulesParsed.data.allHabitsBonusPoints,
    allow_abandonment: rulesParsed.data.allowAbandonment,
    allow_join_after_start: rulesParsed.data.allowJoinAfterStart,
    enrollment_type: rulesParsed.data.enrollmentType,
    finalize_day_points: rulesParsed.data.finalizeDayPoints,
    participant_limit: rulesParsed.data.participantLimit,
    reflection_points: rulesParsed.data.reflectionPoints,
    streak_minimum_completion: rulesParsed.data.streakMinimumCompletion,
  });

  const { error } = await supabase
    .from("challenges")
    .update({
      duration_days: calendarParsed.data.durationDays,
      enrollment_end: calendarParsed.data.enrollmentEnd || null,
      enrollment_start: calendarParsed.data.enrollmentStart || null,
      end_date: calendarParsed.data.endDate || null,
      rules_config: rulesConfig as unknown as Json,
      start_date: calendarParsed.data.startDate || null,
    })
    .eq("id", challengeId);

  if (error) {
    redirectWithFeedback(challengeId, "error");
  }

  redirectWithFeedback(challengeId, "rules-success");
}

export async function generateChallengeDaysAction(formData: FormData) {
  await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_generate_challenge_days", {
    p_challenge_id: challengeId,
  });

  if (error) {
    redirectWithFeedback(challengeId, error.code === "22023" ? "draft-only" : "error");
  }

  redirectWithFeedback(challengeId, "days-generated");
}

export async function addHabitAction(formData: FormData) {
  await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));
  const hasParticipants = await challengeHasParticipants(challengeId);

  if (hasParticipants) {
    redirectWithFeedback(challengeId, "structural-blocked");
  }

  const parsed = habitSchema.safeParse({
    category: getFormValue(formData, "category"),
    description: getFormValue(formData, "description"),
    frequencyType: getFormValue(formData, "frequencyType") ?? "daily",
    habitType: getFormValue(formData, "habitType") ?? "boolean",
    icon: getFormValue(formData, "icon"),
    isRequired: formData.get("isRequired") === "on",
    points: getFormValue(formData, "points") ?? "10",
    sortOrder: getFormValue(formData, "sortOrder") ?? "0",
    title: getFormValue(formData, "title") ?? "",
    validationConfig: {
      label: getFormValue(formData, "validationLabel"),
      target: getFormValue(formData, "validationTarget"),
      unit: getFormValue(formData, "validationUnit"),
    },
  });

  const parsedVisibility = habitVisibilityFormSchema.safeParse({
    betweenFrom: getFormValue(formData, "visibilityBetweenFrom"),
    betweenTo: getFormValue(formData, "visibilityBetweenTo"),
    fromDay: getFormValue(formData, "visibilityFromDay"),
    specificDays: getFormValue(formData, "visibilitySpecificDays"),
    type: getFormValue(formData, "visibilityType") ?? "all_days",
  });

  if (!parsed.success || !parsedVisibility.success) {
    redirectWithFeedback(challengeId, "invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("habits").insert({
    category: parsed.data.category ?? null,
    challenge_id: challengeId,
    description: parsed.data.description ?? null,
    frequency_type: parsed.data.frequencyType,
    habit_type: parsed.data.habitType,
    icon: parsed.data.icon ?? null,
    is_required: parsed.data.isRequired,
    points: parsed.data.points,
    sort_order: parsed.data.sortOrder,
    title: parsed.data.title,
    validation_config: parsed.data.validationConfig,
    visibility_config: parsedVisibility.data,
  });

  if (error) {
    redirectWithFeedback(challengeId, "error");
  }

  redirectWithFeedback(challengeId, "habit-added");
}

/**
 * Unlike addHabitAction/removeHabitAction, deliberately NOT gated by
 * challengeHasParticipants - visibility_config only controls WHEN an item
 * appears/can be answered, it never changes scoring, frequency or history,
 * so it's safe (and necessary) to fix even on a live challenge with real
 * participants, which is exactly the case that motivated this feature
 * (ações especiais como "Concluir o livro do mês" apareciam todo dia em um
 * ciclo já publicado).
 */
export async function updateHabitVisibilityAction(formData: FormData) {
  await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));
  const habitId = habitIdParamSchema.parse(formData.get("habitId"));

  const parsedVisibility = habitVisibilityFormSchema.safeParse({
    betweenFrom: getFormValue(formData, "visibilityBetweenFrom"),
    betweenTo: getFormValue(formData, "visibilityBetweenTo"),
    fromDay: getFormValue(formData, "visibilityFromDay"),
    specificDays: getFormValue(formData, "visibilitySpecificDays"),
    type: getFormValue(formData, "visibilityType") ?? "all_days",
  });

  if (!parsedVisibility.success) {
    redirectWithFeedback(challengeId, "invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("habits")
    .update({ visibility_config: parsedVisibility.data })
    .eq("id", habitId)
    .eq("challenge_id", challengeId);

  if (error) {
    redirectWithFeedback(challengeId, "error");
  }

  redirectWithFeedback(challengeId, "visibility-updated");
}

export async function removeHabitAction(formData: FormData) {
  await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));
  const habitId = habitIdParamSchema.parse(formData.get("habitId"));
  const hasParticipants = await challengeHasParticipants(challengeId);

  if (hasParticipants) {
    redirectWithFeedback(challengeId, "structural-blocked");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("challenge_id", challengeId);

  if (error) {
    redirectWithFeedback(challengeId, "error");
  }

  redirectWithFeedback(challengeId, "habit-removed");
}

export async function duplicateChallengeAsDraftAction(formData: FormData) {
  await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));
  const supabase = await createSupabaseServerClient();

  const [{ data: original }, { data: habits }] = await Promise.all([
    supabase.from("challenges").select("*").eq("id", challengeId).maybeSingle(),
    supabase.from("habits").select("*").eq("challenge_id", challengeId),
  ]);

  if (!original) {
    redirect("/admin/desafios?feedback=error");
  }

  const newSlug = `${original.slug}-copia-${randomUUID().slice(0, 8)}`;

  const { data: created, error } = await supabase
    .from("challenges")
    .insert({
      description: original.description,
      duration_days: original.duration_days,
      name: `${original.name} (cópia)`,
      rules_config: original.rules_config,
      slug: newSlug,
      status: "draft",
      theme_config: original.theme_config,
    })
    .select("id")
    .single();

  if (error || !created) {
    redirect("/admin/desafios?feedback=error");
  }

  if (habits && habits.length > 0) {
    await supabase.from("habits").insert(
      habits.map((habit) => ({
        active: habit.active,
        category: habit.category,
        challenge_id: created.id,
        description: habit.description,
        frequency_config: habit.frequency_config,
        frequency_type: habit.frequency_type,
        habit_type: habit.habit_type,
        icon: habit.icon,
        is_required: habit.is_required,
        points: habit.points,
        sort_order: habit.sort_order,
        title: habit.title,
        validation_config: habit.validation_config,
      })),
    );
  }

  // Inscricoes/logs/conquistas NUNCA sao copiados - o duplicado e sempre um
  // rascunho limpo, sem historico de participantes.
  redirect(editorPath(created.id));
}
