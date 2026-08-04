import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("DashboardMissionBlock - Sua missão de hoje (Parte A)", () => {
  const source = readSource("src", "components", "member", "dashboard-mission-block.tsx");

  it("renders nothing when there are no active/paused enrollments - never an empty shell", () => {
    expect(source).toContain("if (cards.length === 0) {\n    return null;\n  }");
  });

  it("features the first card only - never mixes habits/points visually across cards", () => {
    expect(source).toContain("featured={index === 0}");
  });

  it("shows only the compact summary (habits done/available/points), never a full checklist", () => {
    const start = source.indexOf("function MissionCard");
    const end = source.indexOf("\n/**", start);
    const body = source.slice(start, end);
    expect(body).toContain("hábito realizado");
    expect(body).not.toMatch(/checklist|todayMissions\.map/i);
  });

  it("the CTA only renders when one exists (paused/ended states have none)", () => {
    expect(source).toContain("{data.cta ? <DashboardMissionCtaLink");
  });

  it("only offers to share a finalized day, and only when today's daily_log id is known", () => {
    expect(source).toContain(
      "FINALIZED_STATE_KINDS.includes(data.stateKind) && data.todayDailyLogId",
    );
    expect(source).toContain('kind="day_completed"');
  });
});

describe("DashboardMissionCtaLink", () => {
  const source = readSource("src", "components", "member", "dashboard-mission-cta-link.tsx");

  it("fires dashboard_continue_day_clicked before navigating", () => {
    expect(source).toContain('void recordProfileDashboardEventAction("dashboard_continue_day_clicked");');
  });
});

describe("ProfileNextAchievement - bloco dedicado (Parte B item 10)", () => {
  const source = readSource("src", "components", "member", "profile-next-achievement.tsx");

  it("renders nothing when there is no calculable closest achievement - never a fabricated placeholder", () => {
    expect(source).toContain("if (!achievement) {\n    return null;\n  }");
  });

  it("links to the full achievements page", () => {
    expect(source).toContain('href="/app/conquistas"');
    expect(source).toContain("Ver conquistas");
  });

  it("shows the real remaining-steps distance, never a fabricated percent for boolean criteria (findClosestLockedAchievement already filters those out upstream)", () => {
    expect(source).toContain("const gap = achievement.target - achievement.current;");
  });
});

describe("ProfileMetricsGrid - metricas contextuais (Parte B item 12)", () => {
  const source = readSource("src", "components", "member", "profile-metrics-grid.tsx");

  it("only shows 'de N dias' on Dias finalizados when there is exactly one enrollment - never an ambiguous denominator across challenges", () => {
    expect(source).toContain("enrollments.length === 1 ? `de ${enrollments[0]!.durationDays} dias` : undefined");
  });

  it("only shows the points-today/this-week hint when scoped to a single enrollment", () => {
    expect(source).toContain("enrollments.length <= 1 && pointsContextHint ? pointsContextHint : undefined");
  });

  it("shows achievements total ('de N') only when a real total is known", () => {
    expect(source).toContain("achievementsTotal !== null ? `de ${achievementsTotal}` : undefined");
  });

  it("shows how many challenges are active alongside completed count", () => {
    expect(source).toContain("totals.challengesActive > 0");
    expect(source).toContain("em andamento");
  });
});

describe("ProfileTimeline - agrupamento por data e resumo do dia (Parte C)", () => {
  const source = readSource("src", "components", "member", "profile-timeline.tsx");

  it("groups events by date via the pure groupTimelineEventsByDate helper - never re-sorts or re-fetches", () => {
    expect(source).toContain("groupTimelineEventsByDate(items, today, yesterday)");
  });

  it("only shows the 'ver todos os hábitos' toggle when there are more than the truncated summary shows", () => {
    expect(source).toContain("event.habit_titles && event.habit_titles.length > 3");
  });

  it("fires timeline_event_expanded only on the transition into expanded, never on collapse", () => {
    expect(source).toContain("if (!expanded) {\n                void recordProfileDashboardEventAction(\"timeline_event_expanded\");\n              }");
  });

  it("halfway_reached has its own icon (Milestone), distinct from streak_record's Flame", () => {
    expect(source).toContain("halfway: Milestone");
    expect(source).toContain("record: Flame");
  });
});
