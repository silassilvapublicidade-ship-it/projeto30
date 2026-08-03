import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("habitVisibilityFormSchema", () => {
  const source = readSource("src", "features", "admin", "challenge-editor.schemas.ts");

  it("mirrors the 6 types the CHECK constraint (migration 0050) actually accepts", () => {
    expect(source).toContain(
      'export const HABIT_VISIBILITY_TYPES = [\n  "all_days",\n  "first_day",\n  "last_day",\n  "from_day",\n  "between_days",\n  "specific_days",\n] as const;',
    );
  });

  it("validates between_days ordering and specific_days non-emptiness before hitting the server", () => {
    expect(source).toContain("data.type !== \"between_days\" || (\"from\" in data && data.from <= data.to)");
    expect(source).toContain("data.type !== \"specific_days\" || (\"days\" in data && data.days.length > 0)");
  });
});

describe("updateHabitVisibilityAction", () => {
  const source = readSource("src", "features", "admin", "challenge-editor.actions.ts");
  const fnStart = source.indexOf("export async function updateHabitVisibilityAction");
  const fnEnd = source.indexOf("export async function removeHabitAction");
  const body = source.slice(fnStart, fnEnd);

  it("is deliberately NOT gated by challengeHasParticipants - unlike addHabitAction/removeHabitAction", () => {
    expect(body).not.toContain("challengeHasParticipants");
    // sanity: addHabitAction (right above it) DOES still have the gate
    const addHabitBody = source.slice(
      source.indexOf("export async function addHabitAction"),
      fnStart,
    );
    expect(addHabitBody).toContain("challengeHasParticipants");
    expect(addHabitBody).toContain('redirectWithFeedback(challengeId, "structural-blocked");');
  });

  it("only ever updates visibility_config, never touches points/frequency/required/history", () => {
    expect(body).toContain('.update({ visibility_config: parsedVisibility.data })');
    expect(body).not.toContain("points:");
    expect(body).not.toContain("frequency_type:");
  });

  it("scopes the update by both habitId and challengeId - can't touch a habit from a different challenge", () => {
    expect(body).toContain('.eq("id", habitId)');
    expect(body).toContain('.eq("challenge_id", challengeId)');
  });
});

describe("Challenge editor page - per-habit visibility UI", () => {
  const source = readSource(
    "src",
    "app",
    "admin",
    "desafios",
    "[challengeId]",
    "editar",
    "page.tsx",
  );

  it("shows the visibility editor for EVERY existing habit, not gated by hasParticipants (unlike Remover)", () => {
    const habitsSection = source.slice(
      source.indexOf("<CardTitle>Hábitos"),
      source.indexOf('<CardTitle>Dias do ciclo'),
    );
    expect(habitsSection).toContain("<HabitVisibilityFields");
    expect(habitsSection).toContain("updateHabitVisibilityAction");
    // the visibility <details> block sits outside the `!hasParticipants` guard
    const detailsIndex = habitsSection.indexOf("<details");
    const removeGuardIndex = habitsSection.indexOf("{!hasParticipants ? (");
    const removeGuardEnd = habitsSection.indexOf(") : null}", removeGuardIndex);
    expect(detailsIndex).toBeGreaterThan(removeGuardEnd);
  });

  it("shows a human-readable visibility summary per habit via describeHabitVisibility", () => {
    expect(source).toContain(
      'import { describeHabitVisibility } from "@/features/journey/habit-visibility.core";',
    );
    expect(source).toContain("describeHabitVisibility(habit.visibility_config, challenge.duration_days)");
  });

  it("offers the same visibility fields at habit-creation time", () => {
    const createFormStart = source.indexOf('<form action={addHabitAction}');
    const createFormEnd = source.indexOf("</form>", createFormStart);
    const createForm = source.slice(createFormStart, createFormEnd);
    expect(createForm).toContain("<HabitVisibilityFields");
  });
});
