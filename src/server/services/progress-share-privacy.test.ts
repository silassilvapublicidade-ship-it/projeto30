import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildProgressCardContent, type ProgressCardSource } from "@/features/achievements/progress-card.core";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

const BASE_SOURCE: ProgressCardSource = {
  achievementsUnlocked: 4,
  challengeName: "Desafio de Agosto",
  completionPercent: 61.3,
  dayNumber: 3,
  daysFinalized: 19,
  daysRemaining: 4,
  durationDays: 31,
  finalMessage: "Você concluiu Desafio de Agosto - 31 dias finalizados.",
  habitTitles: ["Treino", "Bíblia"],
  kind: "day_completed",
  logDate: "2026-08-03",
  pointsEarned: 110,
  pointsTotal: 1100,
  previousStreakBest: 5,
  streakBest: 9,
  streakValue: 8,
  weekAverageCompletion: 82.5,
  weekBestStreak: 5,
  weekDaysFinalized: 6,
  weekHabitsCompleted: 4,
  weekPoints: 480,
};

const ALL_KINDS: ProgressCardSource["kind"][] = [
  "day_completed",
  "streak_record",
  "streak_reached",
  "halfway",
  "last_7_days",
  "weekly_summary",
  "challenge_progress",
  "challenge_completed",
];

describe("PII absence - all 8 progress card kinds (Refinamento premium, Parte I)", () => {
  for (const kind of ALL_KINDS) {
    it(`${kind}: never includes an email or display name in the rendered content`, () => {
      const content = buildProgressCardContent({ ...BASE_SOURCE, kind });
      const serialized = JSON.stringify(content);
      expect(serialized).not.toMatch(/@|display_name|displayName/i);
    });
  }
});

describe("ownership - enrollment-snapshot-share.service.ts never trusts a client-supplied enrollmentId", () => {
  const source = readSource("src", "server", "services", "enrollment-snapshot-share.service.ts");

  it("requires an authenticated session before touching any enrollment", () => {
    expect(source).toContain('await requireAuthUser("/app/dashboard");');
  });

  it("only accepts an enrollment that appears in THIS user's own overview - never a raw table lookup by id alone", () => {
    expect(source).toContain("const overview = await getProfileOverview();");
    expect(source).toContain("overview.enrollments.find((row) => row.enrollmentId === enrollmentId)");
    expect(source).toContain('return { error: "Inscrição não encontrada para este usuário.", ok: false };');
  });

  it("revalidates real availability server-side for every kind - halfway, last_7_days, challenge_progress, challenge_completed", () => {
    expect(source).toContain('if (kind === "halfway" && enrollment.currentDay < halfwayDay)');
    expect(source).toContain('if (kind === "last_7_days" && (daysRemaining < 0 || daysRemaining > 6))');
    expect(source).toContain('if (kind === "challenge_progress" && enrollment.completionPercent <= 0)');
    expect(source).toContain('if (kind === "challenge_completed" && enrollment.status !== "completed")');
  });
});

describe("ownership - progress-share.service.ts (day-anchored kinds) never trusts a client-supplied dailyLogId", () => {
  const source = readSource("src", "server", "services", "progress-share.service.ts");

  it("only finds the daily log when it belongs to the authenticated user, via the enrollment join", () => {
    expect(source).toContain('.eq("enrollment.user_id", user.id)');
  });

  it("revalidates streak_reached's real availability (>= 3 days) server-side, never trusting the kind param alone", () => {
    expect(source).toContain(
      'if (kind === "streak_reached" && (dailyLog.streak_at_finalize === null || dailyLog.streak_at_finalize < 3))',
    );
  });
});

describe("ownership - both API routes require auth before any generation attempt", () => {
  it("/api/progress-share/[dailyLogId] requires auth first", () => {
    const source = readSource("src", "app", "api", "progress-share", "[dailyLogId]", "route.ts");
    const bodyStart = source.indexOf("export async function GET");
    const body = source.slice(bodyStart, bodyStart + 200);
    expect(body).toContain('await requireAuthUser("/app/dashboard");');
  });

  it("/api/progress-share/enrollment/[enrollmentId] requires auth first", () => {
    const source = readSource("src", "app", "api", "progress-share", "enrollment", "[enrollmentId]", "route.ts");
    const bodyStart = source.indexOf("export async function GET");
    const body = source.slice(bodyStart, bodyStart + 200);
    expect(body).toContain('await requireAuthUser("/app/dashboard");');
  });
});

describe("admin templates surface never exposes a way to inject arbitrary content into a rendered card", () => {
  it("the toggle action only ever writes the active boolean, validated by zod, gated by requireAdminUser", () => {
    const source = readSource("src", "features", "admin", "admin-share-templates.actions.ts");
    expect(source).toContain("await requireAdminUser();");
    expect(source).toContain("toggleSchema.safeParse");
    expect(source).toContain(".update({ active: parsed.data.active })");
  });
});
