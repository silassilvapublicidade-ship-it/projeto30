import "server-only";

import { redirect } from "next/navigation";

import {
  calculateChallengeDay,
  getDateOnlyInTimeZone,
} from "@/features/challenges/date.core";
import { calculateDailyProgress } from "@/features/journey/progress.core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/types/database";

import { requireAuthUser } from "./auth-session.service";
import { getJourneyRpcClient, getSafeJourneyErrorMessage } from "./journey-rpc.service";

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
  "completed" | "in_progress" | "not_applicable" | "pending" | "skipped";

export type TodayMission = {
  actionLabel: string;
  category: string | null;
  description: string | null;
  habitId: string;
  habitLogId: string | null;
  habitType: Tables<"habits">["habit_type"];
  icon: string | null;
  id: string;
  note: string | null;
  points: number;
  required: boolean;
  state: TodayMissionState;
  statusLabel: string;
  targetLabel: string;
  title: string;
  valueJson: Json;
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
  journeyError: string | null;
  journeyState:
    | "cycle_ended"
    | "cycle_not_started"
    | "day_available"
    | "day_finalized"
    | "error"
    | "no_active_cycle";
  journalEntry: Pick<
    Tables<"journal_entries">,
    "content" | "difficulty" | "gratitude" | "mood" | "tomorrow_focus" | "victory"
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
  todayProgress: {
    applicableHabits: number;
    completedHabits: number;
    completionPercent: number;
    pointsEarned: number;
    pointsPotential: number;
    state: "complete" | "finalized" | "in_progress" | "not_started" | "partial";
  };
};

function getLocalDate(timezone: string) {
  return getDateOnlyInTimeZone(new Date(), timezone);
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

function getRuleInt(rulesConfig: Json, key: string, fallback: number) {
  const rules = isJsonRecord(rulesConfig) ? rulesConfig : {};
  const value = rules[key];

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return fallback;
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
    return [target, typeof unit === "string" ? unit : undefined]
      .filter(Boolean)
      .join(" ");
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

  const [{ data: dayHabitRows }, { data: habitLogRows }, { data: journalEntry }] =
    await Promise.all([
      supabase
        .from("challenge_day_habits")
        .select("id,habit_id,override_description,override_points,required,sort_order")
        .eq("challenge_day_id", challengeDay.id)
        .order("sort_order", { ascending: true }),
      todayLog
        ? supabase
            .from("habit_logs")
            .select("id,habit_id,status,value_json,note,completed_at")
            .eq("daily_log_id", todayLog.id)
        : Promise.resolve({ data: null }),
      todayLog
        ? supabase
            .from("journal_entries")
            .select("content,difficulty,gratitude,mood,tomorrow_focus,victory")
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
  const logsByHabitId = new Map((habitLogRows ?? []).map((log) => [log.habit_id, log]));

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
        habitId: habit.id,
        habitLogId: logsByHabitId.get(item.habit_id)?.id ?? null,
        habitType: habit.habit_type,
        icon: habit.icon,
        id: item.id,
        note: logsByHabitId.get(item.habit_id)?.note ?? null,
        points,
        required: item.required,
        state,
        statusLabel: getMissionStatusLabel(state),
        targetLabel: getMissionTargetLabel(habit, points),
        title: habit.title,
        valueJson: logsByHabitId.get(item.habit_id)?.value_json ?? {},
      },
    ];
  });

  return {
    journalEntry,
    todayChallengeDay: challengeDay,
    todayMissions,
  };
}

type GetMemberContextOptions = {
  ensureTodayLog?: boolean;
};

function getEmptyProgress(): MemberContext["todayProgress"] {
  return {
    applicableHabits: 0,
    completedHabits: 0,
    completionPercent: 0,
    pointsEarned: 0,
    pointsPotential: 0,
    state: "not_started",
  };
}

async function ensureTodayLog({
  enrollmentId,
  supabase,
}: {
  enrollmentId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const rpc = getJourneyRpcClient(supabase);
  const { data, error } = await rpc.rpc<string>("ensure_today_daily_log", {
    target_enrollment_id: enrollmentId,
  });

  if (error) {
    return {
      error: getSafeJourneyErrorMessage(error),
      id: null,
    };
  }

  return {
    error: null,
    id: data,
  };
}

export async function getMemberContext(
  options: GetMemberContextOptions = {},
): Promise<MemberContext> {
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
  let journeyError: string | null = null;
  let journeyState: MemberContext["journeyState"] = "no_active_cycle";
  let journalEntry: MemberContext["journalEntry"] = null;
  let todayChallengeDay: MemberContext["todayChallengeDay"] = null;
  let todayMissions: TodayMission[] = [];
  let todayProgress = getEmptyProgress();

  if (enrollment) {
    const { data: challenge } = await supabase
      .from("challenges")
      .select("*")
      .eq("id", enrollment.challenge_id)
      .maybeSingle();

    const dayResult = challenge
      ? calculateChallengeDay({
          durationDays: challenge.duration_days,
          personalStartDate: enrollment.personal_start_date,
          targetDate: today,
        })
      : null;

    let ensuredDailyLogId: string | null = null;

    if (!challenge) {
      journeyState = "error";
      journeyError = "O ciclo desta inscricao nao foi encontrado.";
    } else if (dayResult?.status === "not_started") {
      journeyState = "cycle_not_started";
    } else if (dayResult?.status === "completed") {
      journeyState = "cycle_ended";
    } else if (options.ensureTodayLog) {
      const ensured = await ensureTodayLog({
        enrollmentId: enrollment.id,
        supabase,
      });

      ensuredDailyLogId = ensured.id;
      journeyError = ensured.error;
      journeyState = ensured.error ? "error" : "day_available";
    } else {
      journeyState = "day_available";
    }

    const { data: todayLog } = ensuredDailyLogId
      ? await supabase
          .from("daily_logs")
          .select("*")
          .eq("id", ensuredDailyLogId)
          .maybeSingle()
      : await supabase
          .from("daily_logs")
          .select("*")
          .eq("enrollment_id", enrollment.id)
          .eq("log_date", today)
          .maybeSingle();

    if (todayLog?.status === "finalized") {
      journeyState = "day_finalized";
    }

    activeEnrollment = {
      ...enrollment,
      current_day: dayResult?.dayNumber || enrollment.current_day,
      challenge,
      todayLog,
    };

    const todayData = await getTodayMissionData({
      challengeId: enrollment.challenge_id,
      currentDay: activeEnrollment.current_day,
      supabase,
      todayLog,
    });

    journalEntry = todayData.journalEntry;
    todayChallengeDay = todayData.todayChallengeDay;
    todayMissions = todayData.todayMissions;

    const progress = calculateDailyProgress({
      finalized: todayLog?.status === "finalized",
      habits: todayMissions.map((mission) => ({
        habitId: mission.habitId,
        status: mission.state === "in_progress" ? "pending" : mission.state,
        touched:
          mission.state === "in_progress" ||
          Boolean(mission.note) ||
          (isJsonRecord(mission.valueJson) && Object.keys(mission.valueJson).length > 0),
      })),
    });
    const rulesConfig = challenge?.rules_config ?? {};
    const pointsPotential =
      todayMissions.reduce((total, mission) => total + mission.points, 0) +
      getRuleInt(rulesConfig, "reflection_points", 10) +
      getRuleInt(rulesConfig, "finalize_day_points", 10) +
      getRuleInt(rulesConfig, "all_habits_bonus_points", 30);

    todayProgress = {
      ...progress,
      pointsEarned: todayLog?.points_earned ?? 0,
      pointsPotential,
    };
  }

  return {
    activeEnrollment,
    availableChallenge,
    journeyError,
    journeyState,
    journalEntry,
    preferences,
    profile,
    today,
    todayChallengeDay,
    todayLabel,
    todayMissions,
    todayProgress,
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
