import "server-only";

import { calculateChallengeDay, getDateOnlyInTimeZone } from "@/features/challenges/date.core";
import { resolveDailyPrompt } from "@/features/journey/habit-daily-prompt.core";
import { getHabitPeriodRange } from "@/features/journey/habit-period.core";
import { getJourneyDayState } from "@/features/journey/journey-day-state.core";
import type { JourneyDayState } from "@/features/journey/journey-day-state.core";
import { readStreakMinimumCompletion } from "@/features/journey/rules.core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

import { requireAuthUser } from "./auth-session.service";

export type { JourneyDayState };

export type JourneyEnrollmentSummary = {
  challengeName: string;
  completionPercent: number;
  currentDay: number;
  durationDays: number;
  enrollmentId: string;
  status: Tables<"challenge_enrollments">["status"];
};

export type JourneyOverview = {
  enrollments: JourneyEnrollmentSummary[];
  localDate: string;
};

/**
 * Lean list for the challenge selector - deliberately does NOT reuse
 * getMemberContext(), which also computes today's missions/journal/progress
 * (irrelevant here and wasteful: Jornada only needs enough to render tabs).
 */
export async function getJourneyOverview(): Promise<JourneyOverview> {
  const user = await requireAuthUser("/app/jornada");
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const localDate = getDateOnlyInTimeZone(new Date(), profile?.timezone || "America/Sao_Paulo");

  // .eq("user_id", ...) is required even though RLS also applies: "Users
  // can read own enrollments" is `user_id = auth.uid() OR is_admin()`, so
  // for an admin viewer, RLS alone would return every user's enrollments,
  // not just their own - the same class of bug that leaked another user's
  // card onto Hoje (see member-area.service.ts).
  const { data: enrollments } = await supabase
    .from("challenge_enrollments")
    .select("id,status,current_day,completion_percent,challenge_id")
    .eq("user_id", user.id)
    .in("status", ["active", "paused", "abandoned"])
    .order("joined_at", { ascending: false });

  // Defense in depth, not the fix itself: the real fix is the .eq("user_id",
  // ...) filter above. This only guards the invariant that the SAME
  // enrollment row must never produce two tabs - it dedupes strictly by
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
  const challengeIds = Array.from(new Set(enrollmentRows.map((row) => row.challenge_id)));
  const { data: challenges } =
    challengeIds.length > 0
      ? await supabase.from("challenges").select("id,name,duration_days").in("id", challengeIds)
      : { data: [] as Array<Pick<Tables<"challenges">, "duration_days" | "id" | "name">> };
  const challengeById = new Map((challenges ?? []).map((challenge) => [challenge.id, challenge]));

  return {
    enrollments: enrollmentRows.flatMap((enrollment) => {
      const challenge = challengeById.get(enrollment.challenge_id);

      if (!challenge) {
        return [];
      }

      return [
        {
          challengeName: challenge.name,
          completionPercent: enrollment.completion_percent,
          currentDay: enrollment.current_day,
          durationDays: challenge.duration_days,
          enrollmentId: enrollment.id,
          status: enrollment.status,
        },
      ];
    }),
    localDate,
  };
}

export type JourneyCalendarDay = {
  completionPercent: number;
  dayNumber: number;
  state: JourneyDayState;
};

export type JourneyHabitDetail = {
  dailyPrompt: string;
  habitId: string;
  note: string | null;
  points: number;
  required: boolean;
  state: Tables<"habit_logs">["status"] | "pending";
  title: string;
};

export type JourneyDayDetail = {
  challengeDayTitle: string | null;
  completionPercent: number;
  dailyLogId: string | null;
  date: string | null;
  dayNumber: number;
  finalized: boolean;
  habits: JourneyHabitDetail[];
  journal: Pick<
    Tables<"journal_entries">,
    "content" | "difficulty" | "gratitude" | "mood" | "tomorrow_focus" | "victory"
  > | null;
  pointsEarned: number;
  state: JourneyDayState;
};

export type JourneySummary = {
  challengeName: string;
  completionPercent: number;
  currentDay: number;
  /** Any finalized day (completed/partial_kept/partial_lost) - never just
   * the 100% ones. See daysRemaining, the only current consumer. */
  daysFinalized: number;
  daysRemaining: number;
  durationDays: number;
  endDate: string | null;
  pointsTotal: number;
  startDate: string | null;
  status: Tables<"challenge_enrollments">["status"];
  streakCurrent: number;
  streakMinimumCompletion: number;
};

export type JourneyRecurringHabitProgress = {
  completed: number;
  frequencyType: Tables<"habits">["frequency_type"];
  habitId: string;
  label: string;
  target: number | null;
};

export type JourneyDetail = {
  calendarDays: JourneyCalendarDay[];
  notStarted: boolean;
  officialStartDate: string | null;
  recurringHabits: JourneyRecurringHabitProgress[];
  selectedDay: JourneyDayDetail | null;
  summary: JourneySummary;
};

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readShortTitle(habit: { title: string; validation_config: unknown }): string {
  const config = isJsonRecord(habit.validation_config) ? habit.validation_config : undefined;
  const shortTitle = config?.short_title;
  return typeof shortTitle === "string" && shortTitle.trim() ? shortTitle.trim() : habit.title;
}

function readTarget(validationConfig: unknown): number | null {
  const config = isJsonRecord(validationConfig) ? validationConfig : undefined;
  const target = config?.target;
  return typeof target === "number" && Number.isFinite(target) ? target : null;
}

/**
 * The "meta vs execução" split the member actually sees on Jornada: every
 * daily-frequency habit's ADESÃO NO CICLO (completed days / days lived so
 * far in this enrollment - never the full duration, so day 1 correctly
 * reads "0 de 1" instead of a misleading "0 de 31"), and every weekly/
 * monthly habit's progress within its CURRENT period (same period-range
 * logic as getPeriodProgressByHabitId in member-area.service.ts, kept as a
 * separate implementation here since this needs the full distinct habit
 * list for the challenge, not just today's missions). Read-only, never
 * touches points/streak/completion_percent - purely a different view over
 * habit_logs that already exist.
 */
async function getRecurringHabitProgress({
  challengeId,
  currentDay,
  enrollmentId,
  localDate,
  supabase,
}: {
  challengeId: string;
  currentDay: number;
  enrollmentId: string;
  localDate: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}): Promise<JourneyRecurringHabitProgress[]> {
  const { data: habitRows } = await supabase
    .from("habits")
    .select("id,title,frequency_type,validation_config")
    .eq("challenge_id", challengeId)
    .eq("active", true);

  const habits = habitRows ?? [];

  if (habits.length === 0 || currentDay < 1) {
    return [];
  }

  const dailyHabits = habits.filter((habit) => habit.frequency_type === "daily");
  const periodHabits = habits.filter((habit) => habit.frequency_type !== "daily");
  const results: JourneyRecurringHabitProgress[] = [];

  if (dailyHabits.length > 0) {
    const dailyHabitIds = dailyHabits.map((habit) => habit.id);
    const { data: completions } = await supabase
      .from("habit_logs")
      .select("habit_id, daily_logs!inner(enrollment_id)")
      .in("habit_id", dailyHabitIds)
      .eq("status", "completed")
      .eq("daily_logs.enrollment_id", enrollmentId);

    const completedByHabitId = new Map<string, number>();
    for (const row of completions ?? []) {
      completedByHabitId.set(row.habit_id, (completedByHabitId.get(row.habit_id) ?? 0) + 1);
    }

    for (const habit of dailyHabits) {
      results.push({
        completed: completedByHabitId.get(habit.id) ?? 0,
        frequencyType: "daily",
        habitId: habit.id,
        label: readShortTitle(habit),
        target: currentDay,
      });
    }
  }

  if (periodHabits.length > 0) {
    const habitsByFrequency = new Map<"monthly" | "weekly", typeof periodHabits>();
    for (const habit of periodHabits) {
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

        const completedByHabitId = new Map<string, number>();
        for (const row of completions ?? []) {
          completedByHabitId.set(row.habit_id, (completedByHabitId.get(row.habit_id) ?? 0) + 1);
        }

        for (const habit of group) {
          results.push({
            completed: completedByHabitId.get(habit.id) ?? 0,
            frequencyType: frequency,
            habitId: habit.id,
            label: readShortTitle(habit),
            target: readTarget(habit.validation_config),
          });
        }
      }),
    );
  }

  return results;
}

/**
 * Everything the Jornada detail panel needs for ONE enrollment: the compact
 * calendar (one state per day, never mixing another challenge's days in)
 * and the full detail of a single selected day. Read-only by design - this
 * service never writes anything; editing a day only ever happens from
 * /app/hoje, and only for the current day.
 */
export async function getJourneyDetail({
  enrollmentId,
  selectedDayNumber,
}: {
  enrollmentId: string;
  selectedDayNumber?: number;
}): Promise<JourneyDetail | null> {
  const user = await requireAuthUser("/app/jornada");
  const supabase = await createSupabaseServerClient();

  const { data: enrollment } = await supabase
    .from("challenge_enrollments")
    .select("*")
    .eq("id", enrollmentId)
    .eq("user_id", user.id)
    .in("status", ["active", "paused", "abandoned"])
    .maybeSingle();

  if (!enrollment) {
    return null;
  }

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", enrollment.challenge_id)
    .maybeSingle();

  if (!challenge) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  const today = getDateOnlyInTimeZone(new Date(), profile?.timezone || "America/Sao_Paulo");

  const notStarted = Boolean(challenge.start_date && today < challenge.start_date);
  const dayResult = calculateChallengeDay({
    durationDays: challenge.duration_days,
    personalStartDate: enrollment.personal_start_date,
    targetDate: today,
  });
  const todayDayNumber = notStarted ? 0 : dayResult.dayNumber;
  const streakMinimumCompletion = readStreakMinimumCompletion(challenge.rules_config);

  const [{ data: days }, { data: logs }] = await Promise.all([
    supabase
      .from("challenge_days")
      .select("id,day_number,title,theme")
      .eq("challenge_id", enrollment.challenge_id)
      .order("day_number", { ascending: true }),
    supabase
      .from("daily_logs")
      .select("id,challenge_day_id,status,completion_percent,points_earned,log_date")
      .eq("enrollment_id", enrollment.id),
  ]);

  const journeyDays = days ?? [];
  const logsByDayId = new Map((logs ?? []).map((log) => [log.challenge_day_id, log]));

  const calendarDays: JourneyCalendarDay[] = journeyDays.map((day) => {
    const log = logsByDayId.get(day.id);
    return {
      completionPercent: log ? Number(log.completion_percent) : 0,
      dayNumber: day.day_number,
      state: getJourneyDayState({
        completionPercent: log ? Number(log.completion_percent) : 0,
        dayNumber: day.day_number,
        finalized: log?.status === "finalized",
        streakMinimumCompletion,
        todayDayNumber,
      }),
    };
  });

  const fallbackDayNumber = todayDayNumber > 0 ? todayDayNumber : 1;
  const requestedDayNumber = selectedDayNumber ?? fallbackDayNumber;
  const selectedChallengeDay =
    journeyDays.find((day) => day.day_number === requestedDayNumber) ?? null;

  let selectedDay: JourneyDayDetail | null = null;

  if (selectedChallengeDay) {
    const log = logsByDayId.get(selectedChallengeDay.id) ?? null;
    const state = getJourneyDayState({
      completionPercent: log ? Number(log.completion_percent) : 0,
      dayNumber: selectedChallengeDay.day_number,
      finalized: log?.status === "finalized",
      streakMinimumCompletion,
      todayDayNumber,
    });

    const [{ data: dayHabitRows }, { data: habitLogRows }, { data: journal }] = await Promise.all([
      supabase
        .from("challenge_day_habits")
        .select("habit_id,override_points,required,sort_order")
        .eq("challenge_day_id", selectedChallengeDay.id)
        .order("sort_order", { ascending: true }),
      log
        ? supabase
            .from("habit_logs")
            .select("habit_id,status,note")
            .eq("daily_log_id", log.id)
        : Promise.resolve({ data: null }),
      log
        ? supabase
            .from("journal_entries")
            .select("content,difficulty,gratitude,mood,tomorrow_focus,victory")
            .eq("daily_log_id", log.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const dayHabits = dayHabitRows ?? [];
    const habitIds = dayHabits.map((row) => row.habit_id);
    const { data: habitRows } =
      habitIds.length > 0
        ? await supabase
            .from("habits")
            .select("id,title,points,daily_prompt,validation_config")
            .in("id", habitIds)
        : {
            data: [] as Array<
              Pick<Tables<"habits">, "daily_prompt" | "id" | "points" | "title" | "validation_config">
            >,
          };
    const habitsById = new Map((habitRows ?? []).map((habit) => [habit.id, habit]));
    const logsByHabitId = new Map((habitLogRows ?? []).map((row) => [row.habit_id, row]));

    selectedDay = {
      challengeDayTitle: selectedChallengeDay.title ?? selectedChallengeDay.theme ?? null,
      completionPercent: log ? Number(log.completion_percent) : 0,
      dailyLogId: log?.id ?? null,
      date: log?.log_date ?? null,
      dayNumber: selectedChallengeDay.day_number,
      finalized: log?.status === "finalized",
      habits: dayHabits.flatMap((row) => {
        const habit = habitsById.get(row.habit_id);

        if (!habit) {
          return [];
        }

        const habitLog = logsByHabitId.get(row.habit_id);
        return [
          {
            dailyPrompt: resolveDailyPrompt(habit),
            habitId: row.habit_id,
            note: habitLog?.note ?? null,
            points: row.override_points ?? habit.points,
            required: row.required,
            state: habitLog?.status ?? "pending",
            title: habit.title,
          },
        ];
      }),
      journal: journal ?? null,
      pointsEarned: log?.points_earned ?? 0,
      state,
    };
  }

  // "Dias restantes" means days not yet lived/finalized - a finalized day
  // counts as no longer remaining regardless of its completion percent
  // (completed/partial_kept/partial_lost are all finalized). Counting only
  // state === "completed" here previously inflated daysRemaining by one for
  // every finalized-but-partial day, the same root confusion as the
  // calendar/detail state bug this round fixes.
  const daysFinalized = calendarDays.filter((day) =>
    ["completed", "partial_kept", "partial_lost"].includes(day.state),
  ).length;
  const recurringHabits = notStarted
    ? []
    : await getRecurringHabitProgress({
        challengeId: enrollment.challenge_id,
        currentDay: todayDayNumber,
        enrollmentId: enrollment.id,
        localDate: today,
        supabase,
      });

  return {
    calendarDays,
    notStarted,
    officialStartDate: challenge.start_date,
    recurringHabits,
    selectedDay,
    summary: {
      challengeName: challenge.name,
      completionPercent: enrollment.completion_percent,
      currentDay: todayDayNumber,
      daysFinalized,
      daysRemaining: Math.max(0, challenge.duration_days - daysFinalized),
      durationDays: challenge.duration_days,
      endDate: challenge.end_date,
      pointsTotal: enrollment.points_total,
      startDate: challenge.start_date,
      status: enrollment.status,
      streakCurrent: enrollment.streak_current,
      streakMinimumCompletion,
    },
  };
}
