import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("abandonChallengeAction", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "features", "member", "challenge-abandonment.actions.ts"),
    "utf8",
  );

  it("requires authentication before calling the RPC", () => {
    expect(source).toContain('await requireAuthUser("/app/desafios");');
  });

  it("calls abandon_challenge_enrollment with the parsed enrollment id, never a raw client value", () => {
    expect(source).toContain('supabase.rpc("abandon_challenge_enrollment"');
    expect(source).toContain("target_enrollment_id: parsedId.data");
  });

  it("revalidates Hoje, Jornada and Desafios so the enrollment disappears/updates everywhere at once", () => {
    expect(source).toContain('revalidatePath("/app/desafios")');
    expect(source).toContain('revalidatePath("/app/hoje")');
    expect(source).toContain('revalidatePath("/app/jornada")');
  });

  it("redirects with a distinct success feedback code", () => {
    expect(source).toContain('redirect("/app/desafios?abandonFeedback=success")');
  });
});
