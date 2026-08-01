import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    join(process.cwd(), "src", "features", "admin", "admin-achievements.actions.ts"),
    "utf8",
  );
}

describe("admin-achievements.actions - safety regression", () => {
  const source = readSource();

  it("requires an admin session before any mutation", () => {
    for (const fn of ["createAchievementAction", "updateAchievementAction", "deleteAchievementAction"]) {
      const start = source.indexOf(`export async function ${fn}`);
      expect(start, `${fn} should exist`).toBeGreaterThan(-1);
      const nextExportStart = source.indexOf("\nexport ", start + 1);
      const body = source.slice(start, nextExportStart === -1 ? undefined : nextExportStart);
      expect(body, `${fn} should call requireAdminUser`).toContain("await requireAdminUser()");
    }
  });

  it("createAchievementAction derives slug and rule_config from the fixed rule definition, never from raw client input", () => {
    const start = source.indexOf("export async function createAchievementAction");
    const end = source.indexOf("export async function updateAchievementAction");
    const body = source.slice(start, end);

    expect(body).toContain("getAchievementRuleDefinition(parsed.data.ruleType)");
    expect(body).toContain("slug: ruleDefinition.slug");
    expect(body).toContain("rule_config: ruleDefinition.ruleConfig");
    // The form schema has no "slug" or "ruleConfig" field at all, so there is
    // no client-controlled value these could have come from instead.
    expect(body).not.toContain("formData.get(\"slug\")");
    expect(body).not.toContain("formData.get(\"ruleConfig\")");
  });

  it("updateAchievementAction never writes challenge_id, slug or rule_config", () => {
    const start = source.indexOf("export async function updateAchievementAction");
    const end = source.indexOf("export type DeletePreviewResult");
    const body = source.slice(start, end);

    const updateCallStart = body.indexOf(".update({");
    const updateCallEnd = body.indexOf("})", updateCallStart);
    const updatePayload = body.slice(updateCallStart, updateCallEnd);

    expect(updatePayload).not.toContain("challenge_id");
    expect(updatePayload).not.toContain("slug");
    expect(updatePayload).not.toContain("rule_config");
  });

  it("deleteAchievementAction calls the safe-delete RPC, never a raw .delete() on the table", () => {
    const start = source.indexOf("export async function deleteAchievementAction");
    const body = source.slice(start);

    expect(body).toContain('supabase.rpc("admin_delete_achievement"');
    expect(body).not.toContain('.from("achievements").delete()');
    expect(body).toContain('error.code === "P0003"');
  });

  it("getAchievementDeletePreviewAction requires an admin session and validates the id before querying", () => {
    const start = source.indexOf("export async function getAchievementDeletePreviewAction");
    const end = source.indexOf("export async function deleteAchievementAction");
    const body = source.slice(start, end);

    expect(body).toContain("await requireAdminUser()");
    expect(body).toContain("achievementIdSchema.safeParse(achievementId)");
  });
});
