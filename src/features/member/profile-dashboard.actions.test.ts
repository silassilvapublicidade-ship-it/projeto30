import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("profile-dashboard.actions.ts (Parte 21)", () => {
  const source = readSource("src", "features", "member", "profile-dashboard.actions.ts");

  it("is a server actions module", () => {
    expect(source.trimStart().startsWith('"use server";')).toBe(true);
  });

  it("narrows to exactly the 13 events named across both rounds - no more, no less", () => {
    expect(source).toContain(
      'const PROFILE_EVENT_NAMES = [\n  "profile_dashboard_viewed",\n  "profile_timeline_filter_changed",\n  "profile_challenge_opened",\n  "profile_achievement_shared",\n  "profile_edit_clicked",\n  "dashboard_mission_opened",\n  "dashboard_continue_day_clicked",\n  "dashboard_next_goal_clicked",\n  "timeline_event_expanded",\n  "evolution_share_started",\n  "evolution_share_completed",\n  "evolution_share_downloaded",\n  "share_template_previewed",\n] as const satisfies readonly AnalyticsEventName[];',
    );
  });

  it("rejects any event name outside the allowlist before touching auth or analytics", () => {
    expect(source).toContain("if (!PROFILE_EVENT_NAMES.includes(eventName)) {\n    return;\n  }");
  });

  it("requires auth before recording, and never forwards personal data in metadata", () => {
    const fnStart = source.indexOf("export async function recordProfileDashboardEventAction");
    const fnBody = source.slice(fnStart, source.indexOf("\n}\n", fnStart));
    expect(fnBody).toContain('await requireAuthUser("/app/dashboard");');
    expect(fnBody).not.toMatch(/email|diary|diário/i);
  });

  it("load-more delegates straight to the paginated service, never re-implements pagination in the action layer", () => {
    const fnStart = source.indexOf("export async function loadMoreProfileTimelineAction");
    const fnBody = source.slice(fnStart, source.indexOf("\n}\n", fnStart));
    expect(fnBody).toContain('await requireAuthUser("/app/dashboard");');
    expect(fnBody).toContain("return getProfileTimeline({");
  });
});
