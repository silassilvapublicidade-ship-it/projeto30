import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    join(
      process.cwd(),
      "src",
      "app",
      "api",
      "admin",
      "conquistas",
      "preview-card",
      "route.ts",
    ),
    "utf8",
  );
}

/**
 * Regression coverage for the achievement preview-card route: it must stay
 * a pure, ephemeral render - no persistence, no storage upload, no
 * service-role client - since it renders drafts that were never saved and
 * may never be.
 */
describe("achievement preview-card route", () => {
  const source = readSource();

  it("requires an authenticated admin before rendering anything", () => {
    expect(source).toContain("await requireAdminUser()");
  });

  it("validates the request body through the typed preview schema, not raw JSON", () => {
    expect(source).toContain("achievementPreviewSchema.safeParse(body)");
  });

  it("reuses the real content-builder and renderer, not a bespoke preview implementation", () => {
    expect(source).toContain("buildAchievementCardContent(");
    expect(source).toContain("renderAchievementShareCardImage(");
  });

  it("never persists anything - no storage upload, no service-role client, no share_cards write", () => {
    expect(source).not.toContain("createSupabaseAdminClient");
    expect(source).not.toContain(".storage.");
    expect(source).not.toContain("share_cards");
    expect(source).not.toContain(".insert(");
    expect(source).not.toContain(".upsert(");
  });

  it("feeds a synthetic unlock date/display name instead of reading a real user_achievements row", () => {
    expect(source).not.toContain(".from(\"user_achievements\")");
    expect(source).not.toContain("userAchievementId");
    expect(source).toContain("unlockedAt: new Date().toISOString()");
  });

  it("returns the ImageResponse directly instead of wrapping it in JSON", () => {
    expect(source).toContain("return renderAchievementShareCardImage(content, parsedConfig.data);");
  });
});
