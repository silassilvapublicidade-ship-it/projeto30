import type { Database } from "@/types/database";

/**
 * Mirrors the window used by admin_dashboard_overview, admin_challenge_detail
 * and admin_list_participants in supabase/migrations/0006_admin_analytics.sql.
 * A participant with an active enrollment and no daily_log activity inside
 * this window is considered inactive. Keep both definitions in sync.
 */
export const ADMIN_ACTIVE_WINDOW_DAYS = 3;

type UserRole = Database["public"]["Enums"]["user_role"];
type ChallengeStatus = Database["public"]["Enums"]["challenge_status"];
type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];
export type ParticipantActivity = "active" | "completed" | "inactive";

export function canViewReflections(role: UserRole): boolean {
  return role === "super_admin";
}

const challengeStatusLabels: Record<ChallengeStatus, string> = {
  active: "Ativo",
  archived: "Arquivado",
  draft: "Rascunho",
  ended: "Encerrado",
  paused: "Pausado",
};

export function describeChallengeStatus(status: ChallengeStatus): string {
  return challengeStatusLabels[status];
}

const enrollmentStatusLabels: Record<EnrollmentStatus, string> = {
  abandoned: "Abandonado",
  active: "Ativo",
  completed: "Concluído",
  paused: "Pausado",
  restarted: "Reiniciado",
};

export function describeEnrollmentStatus(status: EnrollmentStatus): string {
  return enrollmentStatusLabels[status];
}

const activityLabels: Record<ParticipantActivity, string> = {
  active: "Ativo",
  completed: "Concluiu",
  inactive: "Inativo",
};

export function describeActivity(activity: string): string {
  return activityLabels[activity as ParticipantActivity] ?? activity;
}

export function formatPercent(value: number | null | undefined): string {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  return `${Math.round(safe)}%`;
}

export function formatPoints(value: number | null | undefined): string {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  return new Intl.NumberFormat("pt-BR").format(safe);
}

export function formatCount(value: number | null | undefined): string {
  const safe = Number.isFinite(value) ? Number(value) : 0;
  return new Intl.NumberFormat("pt-BR").format(safe);
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
  year: "numeric",
});

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormatter.format(parsed);
}

export function formatChallengePeriod(
  startDate: string | null,
  endDate: string | null,
): string {
  if (!startDate && !endDate) {
    return "Sem data definida";
  }

  return `${formatDate(startDate)} — ${formatDate(endDate)}`;
}
