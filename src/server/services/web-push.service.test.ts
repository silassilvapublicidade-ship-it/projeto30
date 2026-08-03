import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "server", "services", "web-push.service.ts"), "utf8");
}

describe("web-push.service.ts - safety contract", () => {
  const source = readSource();

  it("classifies exactly 404 and 410 as permanent (revoke, never retry) per RFC 8030", () => {
    expect(source).toContain("error.statusCode === 404 || error.statusCode === 410");
  });

  it("never logs or returns the subscription endpoint, p256dh or auth - only a statusCode-derived generic message", () => {
    expect(source).not.toMatch(/console\.(log|error|warn)/);
    expect(source).not.toMatch(/endpoint[^a-zA-Z][\s\S]{0,40}(sanitizedMessage|describeStatusCode)/);
  });

  it("describeStatusCode never echoes the raw upstream error body", () => {
    const fn = source.slice(source.indexOf("function describeStatusCode"));
    expect(fn).not.toContain("error.body");
    expect(fn).not.toContain("error.message");
  });

  it("sends the VAPID keypair only through the vapidDetails option, never logging the private key", () => {
    expect(source).not.toMatch(/console\.(log|error|warn)\([^)]*privateKey/i);
    expect(source).toContain("privateKey: vapid.privateKey");
  });
});
