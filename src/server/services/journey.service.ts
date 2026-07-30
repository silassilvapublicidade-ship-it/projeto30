import "server-only";

import { calculateChallengeDay, getDateOnlyInTimeZone } from "@/features/challenges/date.core";
import { getJourneyDayState } from "@/features/journey/journey-day-state.core";
import type { JourneyDayState } from "@/features/journey/journey-day-state.core";
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

  const { data: enrollments } = await supabase
    .from("challenge_enrollments")
    .select("id,status,current_day,completion_percent,challenge_id")
    .in("status", ["active", "paused", "abandoned"])
    .order("joined_at", { ascending: false });

  const enrollmentRows = enrollments ?? [];
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
  daysCompleted: number;
  daysRemaining: number;
  durationDays: number;
  endDate: string | null;
  pointsTotal: number;
  startDate: string | null;
  status: Tables<"challenge_enrollments">["status"];
  streakCurrent: number;
};

export type JourneyDetail = {
  calendarDays: JourneyCalendarDay[];
  notStarted: boolean;
  officialStartDate: string | null;
  selectedDay: JourneyDayDetail | null;
  summary: JourneySummary;
};

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
        hasLog: Boolean(log),
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
      hasLog: Boolean(log),
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
        ? await supabase.from("habits").select("id,title,points").in("id", habitIds)
        : { data: [] as Array<Pick<Tables<"habits">, "id" | "points" | "title">> };
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

  const daysCompleted = calendarDays.filter((day) => day.state === "completed").length;

  return {
    calendarDays,
    notStarted,
    officialStartDate: challenge.start_date,
    selectedDay,
    summary: {
      challengeName: challenge.name,
      completionPercent: enrollment.completion_percent,
      currentDay: todayDayNumber,
      daysCompleted,
      daysRemaining: Math.max(0, challenge.duration_days - daysCompleted),
      durationDays: challenge.duration_days,
      endDate: challenge.end_date,
      pointsTotal: enrollment.points_total,
      startDate: challenge.start_date,
      status: enrollment.status,
      streakCurrent: enrollment.streak_current,
    },
  };
}
