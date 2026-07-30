import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Server component pages under src/app can't be rendered by this project's
// .test.ts-only, no-DOM vitest config - matching the established pattern
// (admin-shell-content.test.ts, member-navigation-content.test.ts), this
// asserts on the source text of the editor page instead of rendering it.
function readEditorPageSource() {
  return readFileSync(
    join(process.cwd(), "src", "app", "admin", "desafios", "[challengeId]", "editar", "page.tsx"),
    "utf8",
  );
}

describe("challenge editor page - structural lock content", () => {
  const source = readEditorPageSource();

  it("disables the duration field once the challenge has participants", () => {
    expect(source).toContain('disabled={hasParticipants}');
  });

  it("only renders the add-habit form when there are no participants yet", () => {
    const habitsSectionStart = source.indexOf("Hábitos ({habits.length})");
    const afterHabitsSection = source.slice(habitsSectionStart);
    expect(afterHabitsSection).toContain("{!hasParticipants ? (");
  });

  it("always renders the identity form unconditionally (editorial changes stay free)", () => {
    const identityFormIndex = source.indexOf("updateChallengeIdentityAction");
    expect(identityFormIndex).toBeGreaterThan(-1);
    const before = source.slice(Math.max(0, identityFormIndex - 200), identityFormIndex);
    expect(before).not.toContain("hasParticipants ?");
  });

  it("only shows the publish action while the challenge is still a draft", () => {
    expect(source).toContain('challenge.status === "draft" ?');
  });
});
