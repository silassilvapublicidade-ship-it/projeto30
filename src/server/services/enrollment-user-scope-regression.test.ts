import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Live production bug: Silas (an admin account) saw TWO identical "Desafio
// de Agosto" cards on /app/hoje. Root cause was NOT React, NOT a duplicate
// enrollment row, and NOT a JOIN fan-out: Silas and a QA account each held
// exactly one real, legitimate active enrollment in the same challenge. The
// bug is that "Users can read own enrollments" RLS is
// `user_id = auth.uid() OR public.is_admin()` (needed so the admin panel can
// list every participant) - so any app-layer query against
// challenge_enrollments that omits an explicit user_id filter and relies on
// RLS alone will, for an admin caller, silently return every user's rows,
// not just their own. getMemberContext() and getJourneyOverview() are
// "my own data" queries and had exactly this gap. This locks in both the
// explicit .eq("user_id", ...) fix and the defense-in-depth dedup-by-id
// safety net requested alongside it (the dedup alone, e.g. a Set() on
// challenge_id, would have HIDDEN the leak instead of fixing it - it must
// never be the only guard, and must never collapse two distinct real
// enrollments).
function readService(fileName: string) {
  return readFileSync(join(process.cwd(), "src", "server", "services", fileName), "utf8");
}

describe("challenge_enrollments 'my own data' reads are scoped by user_id, not RLS alone", () => {
  it("getMemberContext (/app/hoje) explicitly filters challenge_enrollments by the caller's user_id", () => {
    const source = readService("member-area.service.ts");
    const queryIndex = source.indexOf('.from("challenge_enrollments")');
    const queryBlock = source.slice(queryIndex, queryIndex + 200);
    expect(queryBlock).toContain('.eq("user_id", user.id)');
  });

  it("getJourneyOverview (/app/jornada tabs) explicitly filters challenge_enrollments by the caller's user_id", () => {
    const source = readService("journey.service.ts");
    const queryIndex = source.indexOf('.from("challenge_enrollments")');
    const queryBlock = source.slice(queryIndex, queryIndex + 200);
    expect(queryBlock).toContain('.eq("user_id", user.id)');
  });

  it("getMemberContext keeps a dedup-by-enrollment-id safety net as defense in depth, not as the fix", () => {
    const source = readService("member-area.service.ts");
    expect(source).toContain("seenEnrollmentIds");
    expect(source).toContain("Defense in depth, not the fix itself");
    // Must dedup by the row's own id, never by challenge_id - deduping by
    // challenge_id would silently merge two DIFFERENT real enrollments
    // (e.g. two different users', or a real re-enrollment history) into
    // one, which is exactly the "hide it with Set()" shortcut that was
    // explicitly ruled out.
    expect(source).not.toMatch(/new Set\([^)]*challenge_id\)\)[^;]*filter/);
  });

  it("getJourneyOverview keeps a dedup-by-enrollment-id safety net as defense in depth, not as the fix", () => {
    const source = readService("journey.service.ts");
    expect(source).toContain("seenEnrollmentIds");
    expect(source).toContain("Defense in depth, not the fix itself");
  });

  it("admin-facing participant queries intentionally stay unscoped by user_id (cross-user by design)", () => {
    const source = readService("admin-challenge-editor.service.ts");
    // Sanity guard: this file's challenge_enrollments reads are legitimately
    // "does this challenge have any participants system-wide" checks, scoped
    // by challenge_id instead. If a user_id-scoped read ever appears here it
    // signals the file's purpose shifted and this assumption needs review.
    expect(source).toContain('.from("challenge_enrollments")');
    expect(source).not.toContain('.eq("user_id"');
  });

  it("challenge-catalog member reads already scope challenge_enrollments by user_id (unaffected by this bug)", () => {
    const source = readService("challenge-catalog.service.ts");
    const occurrences = source.split('.from("challenge_enrollments")').length - 1;
    const userScoped = source.split('.eq("user_id", user.id)').length - 1;
    expect(occurrences).toBeGreaterThan(0);
    expect(userScoped).toBeGreaterThanOrEqual(occurrences);
  });
});
