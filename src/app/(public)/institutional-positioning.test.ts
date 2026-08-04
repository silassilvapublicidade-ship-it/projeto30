import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const publicDirs = [
  join(process.cwd(), "src", "app", "(public)"),
  join(process.cwd(), "src", "components", "landing"),
  join(process.cwd(), "src", "components", "public"),
];

function collectTsxSources(): { path: string; source: string }[] {
  const files: { path: string; source: string }[] = [];

  for (const dir of publicDirs) {
    for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.tsx$/.test(entry.name)) {
        continue;
      }

      const fullPath = join(entry.parentPath ?? entry.path, entry.name);
      files.push({ path: fullPath, source: readFileSync(fullPath, "utf8") });
    }
  }

  return files;
}

describe("Institutional positioning guardrails (Parte L - o que não deve ser feito)", () => {
  const files = collectTsxSources();

  it("never promises weight loss, a cure, or a guaranteed spiritual/physical result anywhere public-facing", () => {
    const offenders = files.filter(({ source }) =>
      /promete emagrec|garante (a )?cura|resultado espiritual garantido|transformação completa em 30 dias/i.test(
        source,
      ),
    );
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("never introduces a public ranking or leaderboard between participants", () => {
    const offenders = files.filter(({ source }) => /ranking|leaderboard|classifica[çc][ãa]o geral/i.test(source));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it("never presents Silas as a coach, guru or religious authority outside the guarded /sobre negation", () => {
    const offenders = files.filter(({ path, source }) => {
      if (path.endsWith(join("sobre", "page.tsx"))) {
        return false;
      }
      return /Silas.{0,30}(coach|guru)/i.test(source);
    });
    expect(offenders.map((f) => f.path)).toEqual([]);
  });
});
