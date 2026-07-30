import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Strips // line comments and /* */ block comments so source-text
// assertions about actual JSX/code can't be tripped up by prose in a
// docblock that happens to mention the same tag names it's explaining why
// the component avoids (e.g. this file's own comments discuss "<option>").
function stripJsComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// This project's test setup runs in a plain Node environment (no jsdom/RTL,
// see vitest.config.ts) - real interaction (keyboard nav, focus, legibility
// in a real browser) is verified live during visual validation. These tests
// lock in the accessibility/behavior contract at the source level: this
// component exists specifically to fix a real bug (native <option> popups
// rendering white-on-white in this dark-only app), so its ARIA/keyboard/
// portal contract must never silently regress.
describe("Select primitive - never uses a native <option>", () => {
  const source = readFileSync(join(process.cwd(), "src", "components", "ui", "select.tsx"), "utf8");

  it("never renders a native <select> or <option> element", () => {
    const code = stripJsComments(source);
    expect(code).not.toMatch(/<select[\s>]/);
    expect(code).not.toMatch(/<option[\s>]/);
  });

  it("carries the actual value via a hidden input, so it still works inside a plain form action", () => {
    expect(source).toContain('<input name={name} required={required} type="hidden" value={value} />');
  });
});

describe("Select primitive - accessibility contract (listbox pattern)", () => {
  const source = readFileSync(join(process.cwd(), "src", "components", "ui", "select.tsx"), "utf8");

  it("wires the trigger with aria-haspopup=listbox, aria-expanded and aria-controls", () => {
    expect(source).toContain('aria-haspopup="listbox"');
    expect(source).toContain("aria-expanded={open}");
    expect(source).toContain("aria-controls={listboxId}");
    expect(source).toContain("id={listboxId}");
  });

  it("uses role=listbox / role=option, matching the WAI-ARIA listbox pattern", () => {
    expect(source).toContain('role="listbox"');
    expect(source).toContain('role="option"');
    expect(source).toContain("aria-selected={isSelected}");
  });

  it("associates a visible label via aria-labelledby on both the trigger and the listbox", () => {
    const code = stripJsComments(source);
    expect(code).toContain("aria-labelledby={labelId}");
    const listboxDivIndex = code.indexOf('role="listbox"');
    const listboxBlock = code.slice(Math.max(0, listboxDivIndex - 400), listboxDivIndex);
    expect(listboxBlock).toContain("aria-labelledby={labelId}");
  });

  it("supports an error message linked via aria-describedby", () => {
    expect(source).toContain("aria-describedby={error ? errorId : undefined}");
    expect(source).toContain("id={errorId}");
  });

  it("closes on Escape and returns focus to the trigger", () => {
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("triggerRef.current?.focus()");
  });

  it("closes when a pointer event lands outside both the trigger and the portaled listbox", () => {
    expect(source).toContain("handlePointerDown");
    expect(source).toContain("rootRef.current?.contains(target)");
    expect(source).toContain("listRef.current?.contains(target)");
  });

  it("supports ArrowUp/ArrowDown/Home/End/Enter keyboard navigation across options", () => {
    expect(source).toContain('"ArrowDown"');
    expect(source).toContain('"ArrowUp"');
    expect(source).toContain('"Home"');
    expect(source).toContain('"End"');
    expect(source).toContain('event.key === "Enter"');
  });

  it("opening via ArrowDown/ArrowUp/Enter/Space on the trigger is also supported", () => {
    const handlerStart = source.indexOf("function handleTriggerKeyDown");
    const handlerBody = source.slice(handlerStart, handlerStart + 400);
    expect(handlerBody).toContain('"ArrowDown"');
    expect(handlerBody).toContain('"ArrowUp"');
    expect(handlerBody).toContain('"Enter"');
    expect(handlerBody).toContain('" "');
  });

  it("focuses the currently-selected option (or the first) when it opens", () => {
    expect(source).toContain("items.find((item) => item.dataset.value === value)");
    expect(source).toContain("(selected ?? items[0])?.focus()");
  });

  it("shows a check mark next to the selected option", () => {
    expect(source).toContain("isSelected ? (");
    expect(source).toContain("<Check ");
  });
});

describe("Select primitive - portal + fixed positioning (same anti-clipping fix as DropdownMenu)", () => {
  const source = readFileSync(join(process.cwd(), "src", "components", "ui", "select.tsx"), "utf8");

  it("renders the listbox through a portal into document.body", () => {
    expect(source).toContain('import { createPortal } from "react-dom";');
    expect(source).toContain("createPortal(");
    expect(source).toContain("document.body,");
  });

  it("positions with `fixed`, computed from the trigger's real getBoundingClientRect()", () => {
    expect(source).toContain('className="fixed z-50');
    const updatePositionStart = source.indexOf("function updatePosition");
    const body = source.slice(updatePositionStart, updatePositionStart + 700);
    expect(body).toContain("trigger.getBoundingClientRect()");
  });

  it("flips above the trigger when there isn't enough viewport room below", () => {
    const updatePositionStart = source.indexOf("function updatePosition");
    const body = source.slice(updatePositionStart, updatePositionStart + 700);
    expect(body).toContain("window.innerHeight");
    expect(body).toContain("rect.top - MENU_GAP - listHeight");
  });

  it("recomputes position on window resize and on scroll of any nested scrollable ancestor while open", () => {
    expect(source).toContain('window.addEventListener("resize", handleReposition)');
    expect(source).toContain('document.addEventListener("scroll", handleReposition, true)');
  });

  it("matches the trigger's width so the listbox never looks detached from its field", () => {
    expect(source).toContain("width: rect.width");
    expect(source).toContain("width: position?.width");
  });
});

describe("Select primitive - defense in depth for any remaining native control", () => {
  const source = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

  it("declares color-scheme: dark globally, so native popups (date pickers, etc.) also render legibly", () => {
    expect(source).toContain("color-scheme: dark;");
  });
});
