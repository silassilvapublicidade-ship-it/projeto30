import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

import { requireAuthUser } from "./auth-session.service";

export type MemberProfile = Pick<
  Tables<"users">,
  | "avatar_url"
  | "display_name"
  | "email"
  | "id"
  | "name"
  | "onboarding_completed"
  | "timezone"
>;

export type ActiveEnrollment = Tables<"challenge_enrollments"> & {
  challenge: Tables<"challenges"> | null;
  todayLog: Tables<"daily_logs"> | null;
};

export type TodayMissionState =
  | "completed"
  | "in_progress"
  | "not_applicable"
  | "pending"
  | "skipped";

export type TodayMission = {
  actionLabel: string;
  category: string | null;
  description: string | null;
  habitType: Tables<"habits">["habit_type"];
  icon: string | null;
  id: string;
  points: number;
  required: boolean;
  state: TodayMissionState;
  statusLabel: string;
  targetLabel: string;
  title: string;
};

type HabitForMission = Pick<
  Tables<"habits">,
  | "category"
  | "description"
  | "habit_type"
  | "icon"
  | "id"
  | "points"
  | "title"
  | "validation_config"
>;

export type MemberContext = {
  activeEnrollment: ActiveEnrollment | null;
  availableChallenge: Tables<"challenges"> | null;
  journalEntry: Pick<
    Tables<"journal_entries">,
    "content" | "gratitude" | "mood" | "tomorrow_focus" | "victory"
  > | null;
  preferences: Tables<"user_preferences"> | null;
  profile: MemberProfile;
  today: string;
  todayChallengeDay: Pick<
    Tables<"challenge_days">,
    "day_number" | "id" | "message" | "theme" | "title"
  > | null;
  todayLabel: string;
  todayMissions: TodayMission[];
};

function getLocalDate(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(new Date());
}

function getTodayLabel(timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: timezone,
    weekday: "long",
  }).format(new Date());
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getFallbackProfile(user: Awaited<ReturnType<typeof requireAuthUser>>) {
  return {
    avatar_url: null,
    display_name: user.user_metadata.display_name ?? user.user_metadata.name ?? null,
    email: user.email ?? "",
    id: user.id,
    name: user.user_metadata.name ?? null,
    onboarding_completed: false,
    timezone: "America/Sao_Paulo",
  } satisfies MemberProfile;
}

function getMissionState(
  log: Pick<Tables<"habit_logs">, "status" | "value_json"> | undefined,
): TodayMissionState {
  if (!log) {
    return "pending";
  }

  if (log.status !== "pending") {
    return log.status;
  }

  return isJsonRecord(log.value_json) && Object.keys(log.value_json).length > 0
    ? "in_progress"
    : "pending";
}

function getMissionStatusLabel(state: TodayMissionState) {
  const labels: Record<TodayMissionState, string> = {
    completed: "Concluída",
    in_progress: "Em andamento",
    not_applicable: "Não se aplica",
    pending: "Pendente",
    skipped: "Pulada",
  };

  return labels[state];
}

function getMissionActionLabel(state: TodayMissionState) {
  const labels: Record<TodayMissionState, string> = {
    completed: "Rever",
    in_progress: "Continuar",
    not_applicable: "Ver detalhe",
    pending: "Começar",
    skipped: "Revisar",
  };

  return labels[state];
}

function getMissionTargetLabel(habit: HabitForMission, points: number) {
  const config = isJsonRecord(habit.validation_config)
    ? habit.validation_config
    : undefined;
  const target = config?.target ?? config?.goal ?? config?.amount ?? config?.minutes;
  const unit = config?.unit ?? config?.label ?? config?.metric;

  if (typeof target === "string" || typeof target === "number") {
    return [target, typeof unit === "string" ? unit : undefined].filter(Boolean).join(" ");
  }

  const fallbackByType: Record<Tables<"habits">["habit_type"], string> = {
    boolean: "Confirmar com honestidade",
    duration: "Registrar tempo dedicado",
    multiple_choice: "Escolher as opcoes realizadas",
    quantity: "Registrar quantidade",
    reading: "Concluir a leitura do dia",
    single_choice: "Escolher uma resposta",
    text: "Registrar uma resposta breve",
  };

  return points > 0
    ? `${fallbackByType[habit.habit_type]} · ${points} pts`
    : fallbackByType[habit.habit_type];
}

async function getTodayMissionData({
  challengeId,
  currentDay,
  supabase,
  todayLog,
}: {
  challengeId: string;
  currentDay: number;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  todayLog: Tables<"daily_logs"> | null;
}) {
  const { data: challengeDay } = await supabase
    .from("challenge_days")
    .select("id,day_number,title,message,theme")
    .eq("challenge_id", challengeId)
    .eq("day_number", currentDay)
    .maybeSingle();

  if (!challengeDay) {
    return {
      journalEntry: null,
      todayChallengeDay: null,
      todayMissions: [],
    };
  }

  const [
    { data: dayHabitRows },
    { data: habitLogRows },
    { data: journalEntry },
  ] = await Promise.all([
    supabase
      .from("challenge_day_habits")
      .select(
        "id,habit_id,override_description,override_points,required,sort_order",
      )
      .eq("challenge_day_id", challengeDay.id)
      .order("sort_order", { ascending: true }),
    todayLog
      ? supabase
          .from("habit_logs")
          .select("habit_id,status,value_json")
          .eq("daily_log_id", todayLog.id)
      : Promise.resolve({ data: null }),
    todayLog
      ? supabase
          .from("journal_entries")
          .select("content,gratitude,mood,tomorrow_focus,victory")
          .eq("daily_log_id", todayLog.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const habitIds = (dayHabitRows ?? []).map((item) => item.habit_id);

  if (habitIds.length === 0) {
    return {
      journalEntry,
      todayChallengeDay: challengeDay,
      todayMissions: [],
    };
  }

  const { data: habits } = await supabase
    .from("habits")
    .select(
      "id,title,description,category,habit_type,icon,points,validation_config,sort_order",
    )
    .eq("challenge_id", challengeId)
    .in("id", habitIds);

  const habitsById = new Map((habits ?? []).map((habit) => [habit.id, habit]));
  const logsByHabitId = new Map(
    (habitLogRows ?? []).map((log) => [log.habit_id, log]),
  );

  const todayMissions = (dayHabitRows ?? []).flatMap<TodayMission>((item) => {
    const habit = habitsById.get(item.habit_id);

    if (!habit) {
      return [];
    }

    const state = getMissionState(logsByHabitId.get(item.habit_id));
    const points = item.override_points ?? habit.points;

    return [
      {
        actionLabel: getMissionActionLabel(state),
        category: habit.category,
        description: item.override_description ?? habit.description,
        habitType: habit.habit_type,
        icon: habit.icon,
        id: item.id,
        points,
        required: item.required,
        state,
        statusLabel: getMissionStatusLabel(state),
        targetLabel: getMissionTargetLabel(habit, points),
        title: habit.title,
      },
    ];
  });

  return {
    journalEntry,
    todayChallengeDay: challengeDay,
    todayMissions,
  };
}

export async function getMemberContext(): Promise<MemberContext> {
  const user = await requireAuthUser("/app");
  const supabase = await createSupabaseServerClient();

  const { data: profileData } = await supabase
    .from("users")
    .select("id,email,name,display_name,avatar_url,timezone,onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData ?? getFallbackProfile(user);
  const timezone = profile.timezone || "America/Sao_Paulo";
  const today = getLocalDate(timezone);
  const todayLabel = getTodayLabel(timezone);

  const [{ data: enrollment }, { data: availableChallenge }, { data: preferences }] =
    await Promise.all([
      supabase
        .from("challenge_enrollments")
        .select("*")
        .in("status", ["active", "paused"])
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("challenges")
        .select("*")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

  let activeEnrollment: ActiveEnrollment | null = null;
  let journalEntry: MemberContext["journalEntry"] = null;
  let todayChallengeDay: MemberContext["todayChallengeDay"] = null;
  let todayMissions: TodayMission[] = [];

  if (enrollment) {
    const [{ data: challenge }, { data: todayLog }] = await Promise.all([
      supabase
        .from("challenges")
        .select("*")
        .eq("id", enrollment.challenge_id)
        .maybeSingle(),
      supabase
        .from("daily_logs")
        .select("*")
        .eq("enrollment_id", enrollment.id)
        .eq("log_date", today)
        .maybeSingle(),
    ]);

    activeEnrollment = {
      ...enrollment,
      challenge,
      todayLog,
    };

    const todayData = await getTodayMissionData({
      challengeId: enrollment.challenge_id,
      currentDay: enrollment.current_day,
      supabase,
      todayLog,
    });

    journalEntry = todayData.journalEntry;
    todayChallengeDay = todayData.todayChallengeDay;
    todayMissions = todayData.todayMissions;
  }

  return {
    activeEnrollment,
    availableChallenge,
    journalEntry,
    preferences,
    profile,
    today,
    todayChallengeDay,
    todayLabel,
    todayMissions,
  };
}

export async function requireOnboardedMember() {
  const context = await getMemberContext();

  if (!context.profile.onboarding_completed) {
    redirect("/app/onboarding");
  }

  return context;
}

export async function redirectToMemberStart() {
  const context = await getMemberContext();
  redirect(context.profile.onboarding_completed ? "/app/hoje" : "/app/onboarding");
}

export async function joinFirstAvailableChallenge() {
  const user = await requireAuthUser("/app/hoje");
  const admin = createSupabaseAdminClient();

  const { data: existingEnrollment } = await admin
    .from("challenge_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["active", "paused"])
    .limit(1)
    .maybeSingle();

  if (existingEnrollment) {
    redirect("/app/hoje");
  }

  const { data: profile } = await admin
    .from("users")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();

  const timezone = profile?.timezone || "America/Sao_Paulo";
  const today = getLocalDate(timezone);

  const { data: challenge } = await admin
    .from("challenges")
    .select("id")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!challenge) {
    redirect("/app/hoje?state=no-cycle");
  }

  await admin.from("challenge_enrollments").insert({
    challenge_id: challenge.id,
    personal_start_date: today,
    user_id: user.id,
  });

  redirect("/app/hoje");
}
