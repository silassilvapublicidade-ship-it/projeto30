import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

/**
 * Regression coverage for the confirmed root cause of "Algo não carregou" on
 * /admin/dicas/nova: Next.js caps Server Action request bodies at 1MB by
 * default (see node_modules/next/dist/docs .../serverActions.md). A tip
 * image upload past 1MB - trivial for a real phone photo, and well under
 * this app's own MAX_TIP_IMAGE_SIZE_BYTES validation - was rejected by the
 * framework itself before createTipCardAction's own code, or its own
 * file-size check, ever ran. Reproduced live in production: uploading a
 * 3.5MB JPEG through the real form crashed with a 500 whose digest
 * (4281499699@E394) matched Vercel's production logs exactly.
 */
describe("next.config.ts - Server Action body size limit covers real tip uploads", () => {
  const configSource = readSource("next.config.ts");
  const schemaSource = readSource("src", "features", "admin", "admin-tips.schemas.ts");

  it("configures experimental.serverActions.bodySizeLimit", () => {
    expect(configSource).toMatch(/serverActions:\s*\{[^}]*bodySizeLimit/s);
  });

  it("the configured limit is comfortably above the app's own max tip image size", () => {
    const sizeMatch = schemaSource.match(/MAX_TIP_IMAGE_SIZE_BYTES = (\d+) \* 1024 \* 1024/);
    expect(sizeMatch, "MAX_TIP_IMAGE_SIZE_BYTES should exist as N * 1024 * 1024").not.toBeNull();
    const maxImageMb = Number(sizeMatch![1]);

    const limitMatch = configSource.match(/bodySizeLimit:\s*"(\d+)mb"/);
    expect(limitMatch, 'bodySizeLimit should be set as a "<N>mb" string').not.toBeNull();
    const configuredMb = Number(limitMatch![1]);

    expect(configuredMb).toBeGreaterThan(maxImageMb);
  });

  it("no longer relies on Next's silent 1MB default for any Server Action in the app", () => {
    // A missing config means every "use server" action - not just tip
    // uploads - is capped at 1MB with no app-level control over the message.
    expect(configSource).not.toBe("");
    expect(configSource).toContain("experimental");
  });
});
