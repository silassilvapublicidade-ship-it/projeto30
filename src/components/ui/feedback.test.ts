import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("EmptyState (Refinamento premium, Parte B item 6)", () => {
  const source = readSource("src", "components", "ui", "feedback.tsx");

  it("always renders icon, title and description - never a bare paragraph", () => {
    const body = source.slice(source.indexOf("export function EmptyState"));
    expect(body).toContain("<Icon aria-hidden=\"true\" size={19} />");
    expect(body).toContain("<h3");
    expect(body).toContain("{title}");
    expect(body).toContain("{description}");
  });

  it("accepts an optional icon override, defaulting to Inbox for callers that don't customize it", () => {
    expect(source).toContain("icon: Icon = Inbox,");
  });

  it("only renders the CTA slot when an action was actually provided", () => {
    const body = source.slice(source.indexOf("export function EmptyState"));
    expect(body).toContain("{action ? <div className=\"mt-5\">{action}</div> : null}");
  });
});
