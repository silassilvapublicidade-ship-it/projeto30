import { z } from "zod";

export const ADMIN_PAGE_SIZE = 20;

const challengeStatusValues = [
  "draft",
  "active",
  "paused",
  "ended",
  "archived",
] as const;

const enrollmentStatusValues = [
  "active",
  "paused",
  "completed",
  "abandoned",
  "restarted",
] as const;

const activityValues = ["active", "inactive", "completed"] as const;

const challengeSortValues = [
  "created_at",
  "participant_count",
  "average_progress",
  "name",
] as const;

const participantSortValues = [
  "joined_at",
  "completion_percent",
  "points_total",
  "streak_current",
  "last_activity_at",
] as const;

const sortDirValues = ["asc", "desc"] as const;

function toPage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function toOptionalEnum<T extends readonly string[]>(
  values: T,
  value: string | undefined,
): T[number] | undefined {
  return values.includes(value as T[number]) ? (value as T[number]) : undefined;
}

function toOptionalNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export type ChallengeListParams = {
  page: number;
  search?: string | undefined;
  sortBy: (typeof challengeSortValues)[number];
  sortDir: (typeof sortDirValues)[number];
  status?: (typeof challengeStatusValues)[number] | undefined;
};

export function parseChallengeListParams(
  searchParams: Record<string, string | string[] | undefined>,
): ChallengeListParams {
  const get = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    page: toPage(get("page")),
    search: get("search")?.trim() || undefined,
    sortBy: toOptionalEnum(challengeSortValues, get("sortBy")) ?? "created_at",
    sortDir: toOptionalEnum(sortDirValues, get("sortDir")) ?? "desc",
    status: toOptionalEnum(challengeStatusValues, get("status")),
  };
}

export type ParticipantListParams = {
  activity?: (typeof activityValues)[number] | undefined;
  maxProgress?: number | undefined;
  minProgress?: number | undefined;
  page: number;
  search?: string | undefined;
  sortBy: (typeof participantSortValues)[number];
  sortDir: (typeof sortDirValues)[number];
  status?: (typeof enrollmentStatusValues)[number] | undefined;
};

export function parseParticipantListParams(
  searchParams: Record<string, string | string[] | undefined>,
): ParticipantListParams {
  const get = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    activity: toOptionalEnum(activityValues, get("activity")),
    maxProgress: toOptionalNumber(get("maxProgress")),
    minProgress: toOptionalNumber(get("minProgress")),
    page: toPage(get("page")),
    search: get("search")?.trim() || undefined,
    sortBy: toOptionalEnum(participantSortValues, get("sortBy")) ?? "joined_at",
    sortDir: toOptionalEnum(sortDirValues, get("sortDir")) ?? "desc",
    status: toOptionalEnum(enrollmentStatusValues, get("status")),
  };
}

export function getOffset(page: number, pageSize: number = ADMIN_PAGE_SIZE) {
  return Math.max(0, (page - 1) * pageSize);
}

export function getTotalPages(totalCount: number, pageSize: number = ADMIN_PAGE_SIZE) {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

export const challengeIdSchema = z.uuid("Identificador de desafio invalido.");
export const enrollmentIdSchema = z.uuid("Identificador de participante invalido.");
