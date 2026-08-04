import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("challenge-day-messages.actions.ts (Correções obrigatórias pré-lançamento, Parte D)", () => {
  const source = readSource("src", "features", "admin", "challenge-day-messages.actions.ts");

  it("is a server actions module", () => {
    expect(source.trimStart().startsWith('"use server";')).toBe(true);
  });

  describe("authorization", () => {
    it("both actions require an authenticated admin before touching anything", () => {
      const updateStart = source.indexOf("export async function updateChallengeDayMessageAction");
      const updateBody = source.slice(updateStart, source.indexOf("\n}\n", updateStart));
      expect(updateBody.indexOf("await requireAdminUser();")).toBeLessThan(updateBody.indexOf("supabase"));

      const copyStart = source.indexOf("export async function copyChallengeDayMessageToRangeAction");
      const copyBody = source.slice(copyStart, source.indexOf("\n}\n", copyStart));
      expect(copyBody.indexOf("await requireAdminUser();")).toBeLessThan(copyBody.indexOf("supabase"));
    });
  });

  describe("editorial - never blocked by hasParticipants, unlike structural fields", () => {
    it("never calls challengeHasParticipants - message editing stays free even on a published, populated challenge", () => {
      expect(source).not.toContain("challengeHasParticipants");
      expect(source).not.toContain("structural-blocked");
    });
  });

  describe("ownership/ existence validation", () => {
    it("confirms the challenge itself exists before writing", () => {
      const fnStart = source.indexOf("export async function updateChallengeDayMessageAction");
      const fnBody = source.slice(fnStart, source.indexOf("\n}\n", fnStart));
      expect(fnBody).toContain('.from("challenges")');
      expect(fnBody).toContain("if (!existingChallenge) {");
    });

    it("only ever targets a challenge_day that truly belongs to THIS challenge_id (never day_number alone)", () => {
      expect(source).toContain('.eq("challenge_id", challengeId)');
      expect(source).toContain('.eq("day_number", dayNumber)');
    });

    it("never creates a new challenge_day row here - only generateChallengeDaysAction may do that", () => {
      expect(source).not.toContain('.from("challenge_days").insert(');
    });

    it("rejects a day_number with no matching challenge_day, rather than silently no-op or creating one", () => {
      expect(source).toContain('redirectWithFeedback(challengeId, "message-day-not-found");');
    });
  });

  describe("clearing a message (fallback)", () => {
    it("an empty message clears the row to null - the app's existing fallback (getDailyMissionMessage) takes over automatically", () => {
      expect(source).toContain("const nextMessage = sanitized.length > 0 ? sanitized : null;");
    });

    it("never requires a message - a no-op save (same value) is valid, never rejected", () => {
      expect(source).toContain("if (nextMessage === day.message) {");
    });
  });

  describe("sanitization and length limit", () => {
    it("always sanitizes through the shared pure function before ever writing to the database", () => {
      expect(source).toContain("sanitizeDayMessage(parsed.data.message ?? \"\")");
    });

    it("validates the max length via the schema before sanitizing, never trusting client-side maxLength alone", () => {
      expect(source).toContain("challengeDayMessageSchema.safeParse(");
    });
  });

  describe("audit logging (admin_audit_logs)", () => {
    it("logs day number, previous text and new text for a single-day save", () => {
      const fnStart = source.indexOf("export async function updateChallengeDayMessageAction");
      const fnBody = source.slice(fnStart, source.indexOf("\n}\n", fnStart));
      expect(fnBody).toContain('action: "admin_update_challenge_day_message"');
      expect(fnBody).toContain("before_json: { dayNumber: parsed.data.dayNumber, message: day.message }");
      expect(fnBody).toContain("after_json: { dayNumber: parsed.data.dayNumber, message: nextMessage }");
      expect(fnBody).toContain("admin_user_id: admin.id");
    });

    it("logs one audit row per affected day on a range copy - never a single opaque batch row hiding which days changed", () => {
      const fnStart = source.indexOf("export async function copyChallengeDayMessageToRangeAction");
      const fnBody = source.slice(fnStart, source.indexOf("\n}\n", fnStart));
      expect(fnBody).toContain('action: "admin_copy_challenge_day_message"');
      expect(fnBody).toContain("targetDays.map((day) => ({");
    });

    it("never logs a secret or credential - only the editorial message text, which is already public content", () => {
      expect(source).not.toMatch(/password|token|secret|api[_-]?key/i);
    });
  });

  describe("revalidation - every surface that actually shows this content", () => {
    it("revalidates the editor/preview admin pages and the 3 member-facing surfaces the brief named", () => {
      const fnStart = source.indexOf("function revalidateMessageSurfaces");
      const fnBody = source.slice(fnStart, source.indexOf("\n}\n", fnStart));
      expect(fnBody).toContain("revalidatePath(editorPath(challengeId));");
      expect(fnBody).toContain('revalidatePath(`/admin/desafios/${challengeId}/preview`);');
      expect(fnBody).toContain('revalidatePath("/app/dashboard");');
      expect(fnBody).toContain('revalidatePath("/app/hoje");');
      expect(fnBody).toContain('revalidatePath("/app/jornada");');
    });

    it("both actions call the shared revalidation helper - never a bespoke, partial revalidation per action", () => {
      expect(source.match(/revalidateMessageSurfaces\(challengeId\);/g)?.length).toBe(2);
    });
  });

  describe("copy to range - safe batch semantics", () => {
    it("never crosses challenge boundaries - target days are queried scoped to the same challengeId as the source", () => {
      const fnStart = source.indexOf("export async function copyChallengeDayMessageToRangeAction");
      const fnBody = source.slice(fnStart, source.indexOf("\n}\n", fnStart));
      expect(fnBody).toContain('.eq("challenge_id", challengeId)');
    });

    it("excludes the source day itself from the target set - copying a day onto itself is a no-op, not an error", () => {
      expect(source).toContain('.neq("id", sourceDay.id)');
    });

    it("rejects an empty target range rather than silently doing nothing", () => {
      const fnStart = source.indexOf("export async function copyChallengeDayMessageToRangeAction");
      const fnBody = source.slice(fnStart, source.indexOf("\n}\n", fnStart));
      expect(fnBody).toContain("if (!targetDays || targetDays.length === 0) {");
    });
  });
});
