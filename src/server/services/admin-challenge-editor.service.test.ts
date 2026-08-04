import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "server", "services", "admin-challenge-editor.service.ts"), "utf8");
}

describe("getChallengeEditorData - days list (Correções obrigatórias pré-lançamento, Parte D)", () => {
  const source = readSource();

  it("fetches the real day rows (id, day_number, message), not just a count", () => {
    expect(source).toContain('.select("id, day_number, message")');
    expect(source).toContain('.order("day_number", { ascending: true })');
  });

  it("derives daysCount from the actual rows returned - never a separate, potentially-inconsistent count query", () => {
    expect(source).toContain("daysCount: days.length,");
  });

  it("exposes days on the returned data for the admin editor to list", () => {
    expect(source).toContain("days,");
    expect(source).toContain("export type ChallengeEditorDay = {");
  });
});
