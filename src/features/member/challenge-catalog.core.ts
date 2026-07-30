import type { Database } from "@/types/database";

type ChallengeStatus = Database["public"]["Enums"]["challenge_status"];
type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];
export type HabitFrequencyType = Database["public"]["Enums"]["habit_frequency_type"];

/**
 * Official shape for challenges.theme_config - the JSONB column formalized
 * as a real content standard instead of a narrow set of new relational
 * columns. Any challenge may set a subset of these keys; unset keys fall
 * back to the relational columns (name, description) or to a generic
 * visual fallback (gradient cover). The column keeps whatever other ad-hoc
 * keys a given challenge already stores - this type only documents the
 * subset every catalog card/detail page can rely on.
 */
export type ChallengeThemeConfig = {
  /** Public cover image URL. Absent = catalog/detail use the gradient fallback. */
  cover_image_url?: string | undefined;
  /** Main CTA button label, e.g. "Vem comigo!". Purely presentational - the
   * actual enabled/disabled/label-by-status logic stays in getChallengeCta. */
  cta_label?: string | undefined;
  /** Small supporting text shown under/near the CTA. */
  cta_supporting_text?: string | undefined;
  /** Short marketing headline, distinct from the relational `name` column. */
  headline?: string | undefined;
  /** Complementary message shown near the hero (e.g. under the tagline). */
  hero_message?: string | undefined;
  /** One-liner used on catalog cards, distinct from the full `description` column. */
  short_description?: string | undefined;
  /** Secondary headline / subtitle. */
  subheadline?: string | undefined;
  /** Motivational one-liner. */
  tagline?: string | undefined;
};

function readOptionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function parseChallengeThemeConfig(themeConfig: unknown): ChallengeThemeConfig {
  if (!themeConfig || typeof themeConfig !== "object") {
    return {};
  }

  const source = themeConfig as Record<string, unknown>;
  return {
    cover_image_url: readOptionalString(source, "cover_image_url"),
    cta_label: readOptionalString(source, "cta_label"),
    cta_supporting_text: readOptionalString(source, "cta_supporting_text"),
    headline: readOptionalString(source, "headline"),
    hero_message: readOptionalString(source, "hero_message"),
    short_description: readOptionalString(source, "short_description"),
    subheadline: readOptionalString(source, "subheadline"),
    tagline: readOptionalString(source, "tagline"),
  };
}

/**
 * Canonical shape for habits.validation_config's goal-related keys, used to
 * describe a habit's frequency and target on the catalog detail page and on
 * the Hoje screen (weekly/monthly progress).
 */
export type HabitGoalConfig = {
  label?: string | undefined;
  short_title?: string | undefined;
  target?: number | undefined;
  unit?: string | undefined;
};

export function parseHabitGoalConfig(validationConfig: unknown): HabitGoalConfig {
  if (!validationConfig || typeof validationConfig !== "object") {
    return {};
  }

  const source = validationConfig as Record<string, unknown>;
  const target = source.target;
  return {
    label: readOptionalString(source, "label"),
    short_title: readOptionalString(source, "short_title"),
    target: typeof target === "number" ? target : undefined,
    unit: readOptionalString(source, "unit"),
  };
}

const frequencyLabels: Record<HabitFrequencyType, string> = {
  daily: "Diária",
  monthly: "Mensal",
  weekly: "Semanal",
};

export function describeHabitFrequency(frequencyType: HabitFrequencyType): string {
  return frequencyLabels[frequencyType];
}

const frequencyPeriodSuffix: Record<HabitFrequencyType, string> = {
  daily: "por dia",
  monthly: "no mês",
  weekly: "na semana",
};

/**
 * Human-readable goal for a habit, e.g. "3 Litros por dia" or "4 Sessões na
 * semana". Falls back to just the frequency label when there's no numeric
 * target/unit (checklist-style habits).
 */
export function describeHabitGoal(params: {
  frequencyType: HabitFrequencyType;
  target?: number | undefined;
  unit?: string | undefined;
}): string {
  const { frequencyType, target, unit } = params;

  if (target === undefined || unit === undefined) {
    return describeHabitFrequency(frequencyType);
  }

  return `${target} ${unit} ${frequencyPeriodSuffix[frequencyType]}`;
}

/**
 * Whether a challenge belongs in the member-facing catalog/detail view at
 * all - regardless of who's asking (including admins browsing their own
 * member experience). A draft/paused/archived challenge is only visible to
 * someone CURRENTLY (active/paused) enrolled in it, so unpublishing never
 * strands an in-progress participant, but never leaks to anyone else -
 * not a regular user with an unrelated historical enrollment, and not an
 * admin's own member view (that's a separate concern from /admin, which
 * always shows everything).
 */
export function isChallengeVisibleInCatalog(params: {
  challengeStatus: ChallengeStatus;
  hasLiveEnrollment: boolean;
}): boolean {
  return (
    params.challengeStatus === "active" ||
    params.challengeStatus === "ended" ||
    params.hasLiveEnrollment
  );
}

export type ChallengeDisplayStatus =
  | "abandoned"
  | "available"
  | "coming_soon"
  | "completed"
  | "ended"
  | "joined"
  | "unavailable";

/**
 * Pure badge/status resolver for a single challenge card. Only looks at the
 * viewer's own enrollment for THIS challenge - a viewer may simultaneously
 * be enrolled in other challenges too, which has no bearing on this one.
 */
export function getChallengeDisplayStatus(params: {
  challengeStatus: ChallengeStatus;
  enrollmentStatus: EnrollmentStatus | null;
  enrollmentStart: string | null;
  localDate: string;
}): ChallengeDisplayStatus {
  const { challengeStatus, enrollmentStart, enrollmentStatus, localDate } = params;

  if (enrollmentStatus === "active" || enrollmentStatus === "paused") {
    return "joined";
  }

  if (enrollmentStatus === "completed") {
    return "completed";
  }

  if (enrollmentStatus === "abandoned" || enrollmentStatus === "restarted") {
    return "abandoned";
  }

  if (challengeStatus === "ended") {
    return "ended";
  }

  if (challengeStatus !== "active") {
    return "unavailable";
  }

  if (enrollmentStart && enrollmentStart > localDate) {
    return "coming_soon";
  }

  return "available";
}

export type ChallengeCta = {
  disabled: boolean;
  kind: "continue" | "info" | "join";
  label: string;
};

/**
 * CTA resolver. A viewer may hold active/paused enrollments in several
 * challenges at once - the only thing that ever disables "Participar" is
 * this specific challenge's own status/window, never another enrollment.
 */
export function getChallengeCta(displayStatus: ChallengeDisplayStatus): ChallengeCta {
  if (displayStatus === "joined") {
    return { disabled: false, kind: "continue", label: "Continuar desafio" };
  }

  if (displayStatus === "completed") {
    return { disabled: true, kind: "info", label: "Desafio concluído" };
  }

  if (displayStatus === "abandoned") {
    return { disabled: false, kind: "info", label: "Ver detalhes" };
  }

  if (displayStatus === "coming_soon") {
    return { disabled: true, kind: "info", label: "Em breve" };
  }

  if (displayStatus === "ended") {
    return { disabled: true, kind: "info", label: "Encerrado" };
  }

  if (displayStatus === "unavailable") {
    return { disabled: true, kind: "info", label: "Indisponível" };
  }

  return { disabled: false, kind: "join", label: "Participar" };
}

const displayStatusLabels: Record<ChallengeDisplayStatus, string> = {
  abandoned: "Abandonado",
  available: "Disponível",
  coming_soon: "Em breve",
  completed: "Concluído",
  ended: "Encerrado",
  joined: "Participando",
  unavailable: "Indisponível",
};

export function describeChallengeDisplayStatus(status: ChallengeDisplayStatus): string {
  return displayStatusLabels[status];
}
