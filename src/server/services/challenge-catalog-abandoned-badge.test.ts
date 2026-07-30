import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Live-validation of the Etapa B abandon flow found a real bug here: the
// catalog grid card kept showing an abandoned challenge as "Disponível"
// with a working "Participar" button, because CatalogChallenge.enrollment
// was only ever populated from the active/paused map - so
// getChallengeDisplayStatus never saw enrollmentStatus: "abandoned" at
// all. This locks in the fix: visibility gating and the display badge now
// read from two DIFFERENT maps.
describe("challenge-catalog.service - abandoned enrollment still shows its own badge", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "server", "services", "challenge-catalog.service.ts"),
    "utf8",
  );

  it("keeps a separate active-only map for catalog VISIBILITY gating", () => {
    expect(source).toContain("activeEnrollmentByChallengeId");
    expect(source).toContain("hasLiveEnrollment: activeEnrollmentByChallengeId.has(challenge.id)");
  });

  it("builds a most-recent-any-status map for the DISPLAY badge, independent of visibility", () => {
    expect(source).toContain("latestEnrollmentByChallengeId");
    expect(source).toContain("latestEnrollmentByChallengeId.get(challenge.id)");
  });

  it("never uses the active-only map to populate the card's enrollment badge", () => {
    const catalogMapIndex = source.indexOf(".map((challenge) => {");
    const catalogMapBody = source.slice(catalogMapIndex, catalogMapIndex + 400);
    expect(catalogMapBody).not.toContain("activeEnrollmentByChallengeId.get(challenge.id)");
  });
});
