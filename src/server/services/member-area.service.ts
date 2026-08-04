import "server-only";

import { redirect } from "next/navigation";

import {
  calculateChallengeDay,
  getDateOnlyInTimeZone,
  getPreviousDateOnly,
} from "@/features/challenges/date.core";
import { resolveDailyPrompt, resolveGoalLabel } from "@/features/journey/habit-daily-prompt.core";
import { getHabitPeriodRange } from "@/features/journey/habit-period.core";
import { isHabitVisibleOnDay } from "@/features/journey/habit-visibility.core";
import { calculateDailyProgress } from "@/features/journey/progress.core";
import { readRuleInt as getRuleInt } from "@/features/journey/rules.core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/types/database";

import { requireAuthUser } from "./auth-session.service";
import { getJourneyRpcClient, getSafeJourneyErrorMessage } from "./journey-rpc.service";

export type MemberProfile = Pick<
  Tables<"users">,
  | "avatar_url"
  | "city"
  | "display_name"
  | "email"
  | "id"
  | "name"
  | "onboarding_completed"
  | "role"
  | "timezone"
>;

export type ActiveEnrollment = Tables<"challenge_enrollments"> & {
  challenge: Tables<"challenges"> | null;
  todayLog: Tables<"daily_logs"> | null;
};

export type TodayMissionState =
  "completed" | "in_progress" | "not_applicable" | "pending" | "skipped";

export type MissionPeriodProgress = {
  completed: number;
  periodEnd: string;
  periodStart: string;
  target: number | null;
};

export type TodayMission = {
  actionLabel: string;
  category: string | null;
  dailyPrompt: string;
  description: string | null;
  frequencyType: Tables<"habits">["frequency_type"];
  goalLabel: string | null;
  habitId: string;
  habitLogId: string | null;
  habitType: Tables<"habits">["habit_type"];
  icon: string | null;
  id: string;
  note: string | null;
  periodProgress: MissionPeriodProgress | null;
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
  | "daily_prompt"
  | "description"
  | "frequency_type"
  | "habit_type"
  | "icon"
  | "id"
  | "points"
  | "title"
  | "validation_config"
>;

export type JourneyState =
  | "cycle_ended"
  | "cycle_not_started"
  | "cycle_paused"
  | "day_available"
  | "day_finalized"
  | "error"
  | "no_active_cycle";

export type TodayProgress = {
  applicableHabits: number;
  completedHabits: number;
  completionPercent: number;
  pointsEarned: number;
  pointsPotential: number;
  state: "complete" | "finalized" | "in_progress" | "not_started" | "partial";
  streakMinimumCompletion: number;
  /** Yesterday's FINAL completion_percent for this enrollment, or null when
   * there's nothing real to compare against (no log yesterday, or it was
   * never finalized) - powers "hoje você fez mais que ontem" without ever
   * fabricating a comparison. */
  yesterdayCompletionPercent: number | null;
};

/**
 * Everything Hoje needs to render ONE challenge's card - own day, own
 * missions, own progress/points/streak, own journal entry. A member may
 * hold several of these simultaneously (one per active/paused enrollment);
 * nothing here is ever aggregated across enrollments, so progress/points/
 * streak from challenge A never leak into challenge B's card.
 */
export type EnrollmentDayContext = {
  enrollment: ActiveEnrollment;
  journalEntry: Pick<
    Tables<"journal_entries">,
    "content" | "difficulty" | "gratitude" | "mood" | "tomorrow_focus" | "victory"
  > | null;
  journeyError: string | null;
  journeyState: JourneyState;
  todayChallengeDay: Pick<
    Tables<"challenge_days">,
    "day_number" | "id" | "message" | "theme" | "title"
  > | null;
  todayMissions: TodayMission[];
  todayProgress: TodayProgress;
};

export type MemberContext = {
  availableChallenge: Tables<"challenges"> | null;
  /** One entry per active/paused enrollment - a member can hold several at once. */
  enrollments: EnrollmentDayContext[];
  preferences: Tables<"user_preferences"> | null;
  profile: MemberProfile;
  today: string;
  todayLabel: string;
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

function getFallbackProfile(user: Awaited<ReturnType<typeof requireAuthUser>>) {
  return {
    avatar_url: null,
    city: null,
    display_name: user.user_metadata.display_name ?? user.user_metadata.name ?? null,
    email: user.email ?? "",
    id: user.id,
    name: user.user_metadata.name ?? null,
    onboarding_completed: false,
    role: "user",
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
    completed: "Realizado",
    in_progress: "Em andamento",
    not_applicable: "Não se aplica",
    pending: "Não realizado",
    skipped: "Pulado",
  };

  return labels[state];
}

function getMissionActionLabel(state: TodayMissionState) {
  const labels: Record<TodayMissionState, string> = {
    completed: "Rever",
    in_progress: "Continuar",
    not_applicable: "Ver detalhe",
    pending: "Marcar como realizado",
    skipped: "Revisar",
  };

  return labels[state];
}

const frequencyPeriodSuffix: Record<Tables<"habits">["frequency_type"], string> = {
  daily: "",
  monthly: " no mês",
  weekly: " na semana",
};

function getMissionTargetLabel(habit: HabitForMission, points: number) {
  const config = isJsonRecord(habit.validation_config)
    ? habit.validation_config
    : undefined;
  const target = config?.target ?? config?.goal ?? config?.amount ?? config?.minutes;
  const unit = config?.unit ?? config?.label ?? config?.metric;

  if (typeof target === "string" || typeof target === "number") {
    return (
      [target, typeof unit === "string" ? unit : undefined].filter(Boolean).join(" ") +
      frequencyPeriodSuffix[habit.frequency_type]
    );
  }

  const fallbackByType: Record<Tables<"habits">["habit_type"], string> = {
    boolean: "Confirmar com honestidade",
    duration: "Marcar quando dedicar o tempo combinado",
    multiple_choice: "Escolher as opcoes realizadas",
    quantity: "Marcar quando atingir a meta combinada",
    reading: "Concluir a leitura do dia",
    single_choice: "Escolher uma resposta",
    text: "Registrar uma resposta breve",
  };

  return points > 0
    ? `${fallbackByType[habit.habit_type]} · ${points} pts`
    : fallbackByType[habit.habit_type];
}

async function getPeriodProgressByHabitId({
  enrollmentId,
  habits,
  localDate,
  supabase,
}: {
  enrollmentId: string;
  habits: HabitForMission[];
  localDate: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const progressByHabitId = new Map<string, MissionPeriodProgress>();
  const nonDailyHabits = habits.filter((habit) => habit.frequency_type !== "daily");

  if (nonDailyHabits.length === 0) {
    return progressByHabitId;
  }

  const habitsByFrequency = new Map<"monthly" | "weekly", HabitForMission[]>();
  for (const habit of nonDailyHabits) {
    const frequency = habit.frequency_type as "monthly" | "weekly";
    habitsByFrequency.set(frequency, [...(habitsByFrequency.get(frequency) ?? []), habit]);
  }

  await Promise.all(
    Array.from(habitsByFrequency.entries()).map(async ([frequency, group]) => {
      const { start, end } = getHabitPeriodRange(localDate, frequency);
      const habitIds = group.map((habit) => habit.id);

      const { data: completions } = await supabase
        .from("habit_logs")
        .select("habit_id, daily_logs!inner(log_date, enrollment_id)")
        .in("habit_id", habitIds)
        .eq("status", "completed")
        .eq("daily_logs.enrollment_id", enrollmentId)
        .gte("daily_logs.log_date", start)
        .lte("daily_logs.log_date", end);

      const completedCountByHabitId = new Map<string, number>();
      for (const row of completions ?? []) {
        completedCountByHabitId.set(
          row.habit_id,
          (completedCountByHabitId.get(row.habit_id) ?? 0) + 1,
        );
      }

      for (const habit of group) {
        const config = isJsonRecord(habit.validation_config) ? habit.validation_config : undefined;
        const target = config?.target;

        progressByHabitId.set(habit.id, {
          completed: completedCountByHabitId.get(habit.id) ?? 0,
          periodEnd: end,
          periodStart: start,
          target: typeof target === "number" ? target : null,
        });
      }
    }),
  );

  return progressByHabitId;
}

async function getTodayMissionData({
  challengeId,
  currentDay,
  durationDays,
  enrollmentId,
  localDate,
  supabase,
  todayLog,
}: {
  challengeId: string;
  currentDay: number;
  durationDays: number;
  enrollmentId: string;
  localDate: string;
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
      "id,title,description,category,habit_type,icon,points,validation_config,sort_order,frequency_type,daily_prompt,visibility_config",
    )
    .eq("challenge_id", challengeId)
    .in("id", habitIds);

  const habitsById = new Map((habits ?? []).map((habit) => [habit.id, habit]));
  const logsByHabitId = new Map((habitLogRows ?? []).map((log) => [log.habit_id, log]));
  const periodProgressByHabitId = await getPeriodProgressByHabitId({
    enrollmentId,
    habits: habits ?? [],
    localDate,
    supabase,
  });

  const todayMissions = (dayHabitRows ?? []).flatMap<TodayMission>((item) => {
    const habit = habitsById.get(item.habit_id);

    if (!habit) {
      return [];
    }

    // Backend-enforced (never CSS-only): an item scheduled outside today's
    // window never even reaches the client as a mission - it can't be
    // answered, doesn't count toward the percentage, and can't block
    // finalização, mirroring habit_visible_on_day() in
    // finalize_daily_log_with_responses/journey_recalculate_daily_log.
    if (!isHabitVisibleOnDay(habit.visibility_config, currentDay, durationDays)) {
      return [];
    }

    const state = getMissionState(logsByHabitId.get(item.habit_id));
    const points = item.override_points ?? habit.points;

    return [
      {
        actionLabel: getMissionActionLabel(state),
        category: habit.category,
        dailyPrompt: resolveDailyPrompt(habit),
        description: item.override_description ?? habit.description,
        frequencyType: habit.frequency_type,
        goalLabel: resolveGoalLabel(habit),
        habitId: habit.id,
        habitLogId: logsByHabitId.get(item.habit_id)?.id ?? null,
        habitType: habit.habit_type,
        icon: habit.icon,
        periodProgress: periodProgressByHabitId.get(habit.id) ?? null,
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

async function buildEnrollmentDayContext({
  ensureLog,
  enrollment,
  challenge,
  supabase,
  today,
}: {
  ensureLog: boolean;
  enrollment: Tables<"challenge_enrollments">;
  challenge: Tables<"challenges"> | null;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  today: string;
}): Promise<EnrollmentDayContext> {
  const dayResult = challenge
    ? calculateChallengeDay({
        durationDays: challenge.duration_days,
        pausedDaysOffset: enrollment.paused_days_offset,
        personalStartDate: enrollment.personal_start_date,
        targetDate: today,
      })
    : null;

  let journeyState: JourneyState = "day_available";
  let journeyError: string | null = null;
  let ensuredDailyLogId: string | null = null;
  // start_date is the challenge's official kickoff, distinct from
  // personal_start_date (when THIS user joined - always <= today, so
  // dayResult's own "not_started" never fires for it in practice). Early
  // enrollment windows (enrollment_start before start_date) are a valid
  // product decision, but execution - opening a day, marking habits,
  // finalizing, earning points - must wait for start_date itself.
  const notYetOfficiallyStarted = Boolean(
    challenge?.start_date && today < challenge.start_date,
  );
  // Either the whole challenge or just this participant's own enrollment
  // can be paused (Module C) - both read as "paused" here. Checked before
  // ensureTodayLog: the RPC would just reject with a generic error since it
  // requires both statuses = 'active', so this short-circuits into a real
  // "Pausado" message instead of the member seeing journeyState "error".
  const isPaused = enrollment.status === "paused" || challenge?.status === "paused";

  if (!challenge) {
    journeyState = "error";
    journeyError = "O ciclo desta inscricao nao foi encontrado.";
  } else if (challenge.status === "ended") {
    journeyState = "cycle_ended";
  } else if (isPaused) {
    journeyState = "cycle_paused";
  } else if (notYetOfficiallyStarted) {
    journeyState = "cycle_not_started";
  } else if (dayResult?.status === "not_started") {
    journeyState = "cycle_not_started";
  } else if (dayResult?.status === "completed") {
    journeyState = "cycle_ended";
  } else if (ensureLog) {
    const ensured = await ensureTodayLog({ enrollmentId: enrollment.id, supabase });
    ensuredDailyLogId = ensured.id;
    journeyError = ensured.error;
    journeyState = ensured.error ? "error" : "day_available";
  }

  const { data: todayLog } = ensuredDailyLogId
    ? await supabase.from("daily_logs").select("*").eq("id", ensuredDailyLogId).maybeSingle()
    : await supabase
        .from("daily_logs")
        .select("*")
        .eq("enrollment_id", enrollment.id)
        .eq("log_date", today)
        .maybeSingle();

  if (todayLog?.status === "finalized") {
    journeyState = "day_finalized";
  }

  const { data: yesterdayLog } = await supabase
    .from("daily_logs")
    .select("completion_percent")
    .eq("enrollment_id", enrollment.id)
    .eq("log_date", getPreviousDateOnly(today))
    .eq("status", "finalized")
    .maybeSingle();

  const activeEnrollment: ActiveEnrollment = {
    ...enrollment,
    current_day: dayResult?.dayNumber || enrollment.current_day,
    challenge,
    todayLog,
  };

  const todayData = await getTodayMissionData({
    challengeId: enrollment.challenge_id,
    currentDay: activeEnrollment.current_day,
    durationDays: challenge?.duration_days ?? Math.max(1, activeEnrollment.current_day),
    enrollmentId: enrollment.id,
    localDate: today,
    supabase,
    todayLog,
  });

  const progress = calculateDailyProgress({
    finalized: todayLog?.status === "finalized",
    habits: todayData.todayMissions.map((mission) => ({
      frequencyType: mission.frequencyType,
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
    todayData.todayMissions.reduce((total, mission) => total + mission.points, 0) +
    getRuleInt(rulesConfig, "reflection_points", 10) +
    getRuleInt(rulesConfig, "finalize_day_points", 10) +
    getRuleInt(rulesConfig, "all_habits_bonus_points", 30);

  return {
    enrollment: activeEnrollment,
    journalEntry: todayData.journalEntry,
    journeyError,
    journeyState,
    todayChallengeDay: todayData.todayChallengeDay,
    todayMissions: todayData.todayMissions,
    todayProgress: {
      ...progress,
      pointsEarned: todayLog?.points_earned ?? 0,
      pointsPotential,
      streakMinimumCompletion: getRuleInt(rulesConfig, "streak_minimum_completion", 70),
      yesterdayCompletionPercent: yesterdayLog ? Number(yesterdayLog.completion_percent) : null,
    },
  };
}

type GetMemberContextOptions = {
  ensureTodayLog?: boolean;
};

export async function getMemberContext(
  options: GetMemberContextOptions = {},
): Promise<MemberContext> {
  const user = await requireAuthUser("/app");
  const supabase = await createSupabaseServerClient();

  const { data: profileData } = await supabase
    .from("users")
    .select("id,email,name,display_name,avatar_url,timezone,onboarding_completed,city,role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData ?? getFallbackProfile(user);
  const timezone = profile.timezone || "America/Sao_Paulo";
  const today = getLocalDate(timezone);
  const todayLabel = getTodayLabel(timezone);

  const [{ data: enrollments }, { data: activeChallenges }, { data: preferences }] =
    await Promise.all([
      // .eq("user_id", ...) is required here even though RLS also applies:
      // "Users can read own enrollments" is `user_id = auth.uid() OR
      // is_admin()`, so for an admin viewer, relying on RLS alone returns
      // every user's active/paused enrollments, not just their own -
      // exactly the bug that showed a second, other-user's card on Hoje.
      supabase
        .from("challenge_enrollments")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "paused"])
        .order("joined_at", { ascending: false }),
      supabase
        .from("challenges")
        .select("*")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

  // Defense in depth, not the fix itself: the real fix is the .eq("user_id",
  // ...) filter above. This only guards the invariant that the SAME
  // enrollment row must never produce two cards - it dedupes strictly by
  // enrollment.id, so it can never merge two distinct real enrollments
  // (e.g. two different challenges, or two different users) into one.
  const seenEnrollmentIds = new Set<string>();
  const enrollmentRows = (enrollments ?? []).filter((enrollment) => {
    if (seenEnrollmentIds.has(enrollment.id)) {
      return false;
    }
    seenEnrollmentIds.add(enrollment.id);
    return true;
  });
  const enrolledChallengeIds = new Set(enrollmentRows.map((enrollment) => enrollment.challenge_id));
  const availableChallenge =
    (activeChallenges ?? []).find((challenge) => !enrolledChallengeIds.has(challenge.id)) ?? null;

  const challengeIds = Array.from(new Set(enrollmentRows.map((enrollment) => enrollment.challenge_id)));
  const { data: challengeRows } =
    challengeIds.length > 0
      ? await supabase.from("challenges").select("*").in("id", challengeIds)
      : { data: [] as Tables<"challenges">[] };
  const challengeById = new Map((challengeRows ?? []).map((challenge) => [challenge.id, challenge]));

  const enrollmentContexts = await Promise.all(
    enrollmentRows.map((enrollment) =>
      buildEnrollmentDayContext({
        challenge: challengeById.get(enrollment.challenge_id) ?? null,
        enrollment,
        ensureLog: Boolean(options.ensureTodayLog),
        supabase,
        today,
      }),
    ),
  );

  return {
    availableChallenge,
    enrollments: enrollmentContexts,
    preferences,
    profile,
    today,
    todayLabel,
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
  redirect(context.profile.onboarding_completed ? "/app/dashboard" : "/app/onboarding");
}
