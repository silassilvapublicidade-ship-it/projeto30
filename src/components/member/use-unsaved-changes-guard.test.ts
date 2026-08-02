import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    join(process.cwd(), "src", "components", "member", "use-unsaved-changes-guard.ts"),
    "utf8",
  );
}

describe("useUnsavedChangesGuard", () => {
  const source = readSource();

  it("is a client-only hook", () => {
    expect(source.trimStart().startsWith('"use client";')).toBe(true);
  });

  it("only attaches listeners while there are real unsaved changes", () => {
    const effectBody = source.slice(source.indexOf("useEffect(() => {"), source.indexOf("}, [hasUnsavedChanges"));
    expect(effectBody).toContain("if (!hasUnsavedChanges) {\n      return;\n    }");
  });

  it("guards tab close/refresh via beforeunload, setting returnValue (required for the native prompt to appear)", () => {
    expect(source).toContain('window.addEventListener("beforeunload", handleBeforeUnload)');
    expect(source).toContain("event.preventDefault();");
    expect(source).toContain('event.returnValue = "";');
  });

  it("guards in-app link navigation via a capture-phase click listener, since the App Router has no native navigation-block hook", () => {
    expect(source).toContain('document.addEventListener("click", handleClickCapture, true)');
  });

  it("never prompts for an external link, a new-tab link, or a same-page anchor", () => {
    expect(source).toContain("if (isSamePageAnchor || isExternal || link.target === \"_blank\") {");
  });

  it("cancels the click (and stops it from reaching other handlers) only when the member backs out of the confirm", () => {
    const clickHandlerBody = source.slice(
      source.indexOf("function handleClickCapture"),
      source.indexOf("window.addEventListener(\"beforeunload\""),
    );
    expect(clickHandlerBody).toContain("if (!confirmed) {");
    expect(clickHandlerBody).toContain("event.preventDefault();");
    expect(clickHandlerBody).toContain("event.stopImmediatePropagation();");
  });

  it("tears down both listeners on cleanup, so a resolved/finalized day stops prompting immediately", () => {
    expect(source).toContain('window.removeEventListener("beforeunload", handleBeforeUnload)');
    expect(source).toContain('document.removeEventListener("click", handleClickCapture, true)');
  });
});
