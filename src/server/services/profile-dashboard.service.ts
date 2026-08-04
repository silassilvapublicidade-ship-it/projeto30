import "server-only";

import { getDateOnlyInTimeZone, getPreviousDateOnly } from "@/features/challenges/date.core";
import { describeDayOverDayComparison } from "@/features/journey/progress-motivation.core";
import type { TimelineEventRow, TimelineEventType } from "@/features/profile/profile-evolution.core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

import { requireAuthUser } from "./auth-session.service";

export type ProfileEnrollmentSummary = {
  abandonedAt: string | null;
  achievementsUnlocked: number;
  challengeId: string;
  challengeName: string;
  challengeSlug: string;
  completedAt: string | null;
  completionPercent: number;
  coverImageUrl: string | null;
  currentDay: number;
  durationDays: number;
  enrollmentId: string;
  joinedAt: string;
  pausedAt: string | null;
  pointsTotal: number;
  status: Tables<"challenge_enrollments">["status"];
  streakBest: number;
  streakCurrent: number;
};

export type ProfileOverview = {
  enrollments: ProfileEnrollmentSummary[];
  joinedAt: string | null;
  totals: {
    achievementsUnlocked: number;
    challengesActive: number;
    challengesCompleted: number;
    daysAt100: number;
    daysFinalized: number;
    physicalActivityDays: number;
    pointsTotal: number;
    readingDays: number;
    reflectionDays: number;
    streakBestMax: number;
    streakCurrentMax: number;
  };
};

const EMPTY_OVERVIEW: ProfileOverview = {
  enrollments: [],
  joinedAt: null,
  totals: {
    achievementsUnlocked: 0,
    challengesActive: 0,
    challengesCompleted: 0,
    daysAt100: 0,
    daysFinalized: 0,
    physicalActivityDays: 0,
    pointsTotal: 0,
    readingDays: 0,
    reflectionDays: 0,
    streakBestMax: 0,
    streakCurrentMax: 0,
  },
};

type RawOverviewEnrollment = {
  abandoned_at: string | null;
  achievements_unlocked: number;
  challenge_id: string;
  challenge_name: string;
  challenge_slug: string;
  completed_at: string | null;
  completion_percent: number;
  cover_image_url: string | null;
  current_day: number;
  duration_days: number;
  enrollment_id: string;
  joined_at: string;
  paused_at: string | null;
  points_total: number;
  status: Tables<"challenge_enrollments">["status"];
  streak_best: number;
  streak_current: number;
};

type RawOverview = {
  enrollments: RawOverviewEnrollment[];
  joinedAt: string | null;
  totals: ProfileOverview["totals"];
};

/**
 * Uma unica RPC agregada (member_profile_overview) para cabecalho + resumo
 * + "meus desafios" - nunca N+1. Retorna defaults zerados (nunca um erro
 * visivel) se a RPC falhar, coerente com o resto do app: uma conta sem
 * historico deve ver estados vazios, nao uma tela quebrada.
 */
export async function getProfileOverview(): Promise<ProfileOverview> {
  await requireAuthUser("/app/perfil");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("member_profile_overview");

  if (error || !data) {
    return EMPTY_OVERVIEW;
  }

  const raw = data as unknown as RawOverview;

  return {
    enrollments: (raw.enrollments ?? []).map((enrollment) => ({
      abandonedAt: enrollment.abandoned_at,
      achievementsUnlocked: enrollment.achievements_unlocked,
      challengeId: enrollment.challenge_id,
      challengeName: enrollment.challenge_name,
      challengeSlug: enrollment.challenge_slug,
      completedAt: enrollment.completed_at,
      completionPercent: Number(enrollment.completion_percent),
      coverImageUrl: enrollment.cover_image_url,
      currentDay: enrollment.current_day,
      durationDays: enrollment.duration_days,
      enrollmentId: enrollment.enrollment_id,
      joinedAt: enrollment.joined_at,
      pausedAt: enrollment.paused_at,
      pointsTotal: enrollment.points_total,
      status: enrollment.status,
      streakBest: enrollment.streak_best,
      streakCurrent: enrollment.streak_current,
    })),
    joinedAt: raw.joinedAt ?? null,
    totals: raw.totals ?? EMPTY_OVERVIEW.totals,
  };
}

export type ProfileTimelinePage = {
  hasMore: boolean;
  items: TimelineEventRow[];
  nextCursorAt: string | null;
  nextCursorId: string | null;
};

const EMPTY_TIMELINE_PAGE: ProfileTimelinePage = {
  hasMore: false,
  items: [],
  nextCursorAt: null,
  nextCursorId: null,
};

type RawTimelinePage = {
  hasMore: boolean;
  items: TimelineEventRow[];
  nextCursorAt: string | null;
  nextCursorId: string | null;
};

/**
 * Timeline paginada por cursor composto (Parte 7/8/17) - nunca traz o
 * dataset completo. challengeId/types filtram no banco, nao no cliente.
 */
export async function getProfileTimeline(options: {
  challengeId?: string | undefined;
  cursorAt?: string | undefined;
  cursorId?: string | undefined;
  limit?: number | undefined;
  types?: TimelineEventType[] | undefined;
}): Promise<ProfileTimelinePage> {
  await requireAuthUser("/app/perfil");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("member_profile_timeline", {
    p_challenge_id: options.challengeId,
    p_cursor_at: options.cursorAt,
    p_cursor_id: options.cursorId,
    p_limit: options.limit ?? 20,
    p_types: options.types,
  });

  if (error || !data) {
    return EMPTY_TIMELINE_PAGE;
  }

  const raw = data as unknown as RawTimelinePage;

  return {
    hasMore: Boolean(raw.hasMore),
    items: raw.items ?? [],
    nextCursorAt: raw.nextCursorAt ?? null,
    nextCursorId: raw.nextCursorId ?? null,
  };
}

/**
 * "Hoje você já fez mais que ontem" (Parte 5), aplicado ao destaque de
 * evolução do dashboard - deliberadamente mais conservador que o card ao
 * vivo da tela Hoje (member-area.service.ts): so compara dois dias
 * FINALIZADOS (nunca o progresso em andamento de hoje, que o Perfil nao
 * teria motivo para conhecer sem chamar ensure_today_daily_log, um efeito
 * colateral que so a tela Hoje deve disparar). Retorna null sempre que
 * qualquer um dos dois lados nao existir - nunca fabrica a comparacao.
 */
export async function getPrimaryEnrollmentDayOverDayMessage(input: {
  enrollmentId: string;
  timezone: string;
}): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const today = getDateOnlyInTimeZone(new Date(), input.timezone);
  const yesterday = getPreviousDateOnly(today);

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("log_date, completion_percent")
    .eq("enrollment_id", input.enrollmentId)
    .eq("status", "finalized")
    .in("log_date", [today, yesterday]);

  const todayLog = logs?.find((log) => log.log_date === today);
  const yesterdayLog = logs?.find((log) => log.log_date === yesterday);

  if (!todayLog || !yesterdayLog) {
    return null;
  }

  return describeDayOverDayComparison({
    todayPercent: Number(todayLog.completion_percent),
    yesterdayPercent: Number(yesterdayLog.completion_percent),
  });
}

export type RecentEvolutionDay = {
  completionPercent: number;
  finalized: boolean;
  logDate: string;
};

/**
 * "Evolucao recente" (Parte 11) - uma unica query direta (RLS "Users can
 * read own daily logs" ja cobre isso, mesmo padrao de outras leituras
 * escopadas a UMA inscricao neste projeto), nunca todos os daily_logs do
 * usuario. Limitada a um unico enrollment por chamada - o dashboard decide
 * qual (o "principal") antes de chamar isto.
 */
export async function getRecentEvolutionDays(input: {
  days: 7 | 30;
  enrollmentId: string;
  timezone: string;
}): Promise<RecentEvolutionDay[]> {
  const supabase = await createSupabaseServerClient();
  const today = getDateOnlyInTimeZone(new Date(), input.timezone);
  let startDate = today;
  for (let i = 0; i < input.days - 1; i += 1) {
    startDate = getPreviousDateOnly(startDate);
  }

  const { data } = await supabase
    .from("daily_logs")
    .select("log_date, completion_percent, status")
    .eq("enrollment_id", input.enrollmentId)
    .gte("log_date", startDate)
    .lte("log_date", today)
    .order("log_date", { ascending: true });

  return (data ?? []).map((row) => ({
    completionPercent: Number(row.completion_percent),
    finalized: row.status === "finalized",
    logDate: row.log_date,
  }));
}

export type FaithMessage = {
  body: string;
  title: string;
};

/**
 * "Fe e proposito" (Parte 13) - reaproveita daily_motivation_messages
 * (Modulo G, categoria "fe") via a RPC minima member_pick_faith_message()
 * (a tabela em si so tem RLS de admin). Nunca hardcoded no componente;
 * retorna null quando o admin ainda nao cadastrou nenhuma mensagem elegivel
 * - a secao simplesmente nao renderiza, nunca um texto vazio ou inventado.
 */
export async function getFaithMessage(): Promise<FaithMessage | null> {
  await requireAuthUser("/app/perfil");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("member_pick_faith_message");

  if (error || !data) {
    return null;
  }

  const raw = data as unknown as FaithMessage;
  return raw.title && raw.body ? raw : null;
}
