import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// This project's test setup runs in a plain Node environment (no jsdom/RTL,
// see vitest.config.ts) - real interaction (keyboard nav, focus, outside
// click) is verified live in a real browser during visual validation. These
// tests lock in the accessibility/behavior contract at the source level, so
// a future edit can't silently drop ESC-to-close, aria wiring, or focus
// restoration without a test failing.
describe("DropdownMenu primitive - accessibility contract", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "components", "ui", "dropdown-menu.tsx"),
    "utf8",
  );

  it("wires the trigger with aria-haspopup, aria-expanded and aria-controls", () => {
    expect(source).toContain('aria-haspopup="menu"');
    expect(source).toContain("aria-expanded={open}");
    expect(source).toContain("aria-controls={menuId}");
    expect(source).toContain("id={menuId}");
  });

  it("uses role=menu / role=menuitem, matching the WAI-ARIA menu pattern", () => {
    expect(source).toContain('role="menu"');
    expect(source).toContain('role="menuitem"');
  });

  it("closes on Escape and returns focus to the trigger", () => {
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("triggerRef.current?.focus()");
  });

  it("closes when a pointer event lands outside the menu root", () => {
    expect(source).toContain("handlePointerDown");
    expect(source).toContain("!rootRef.current.contains(event.target as Node)");
  });

  it("supports ArrowUp/ArrowDown/Home/End roving focus across menu items", () => {
    expect(source).toContain('"ArrowDown"');
    expect(source).toContain('"ArrowUp"');
    expect(source).toContain('"Home"');
    expect(source).toContain('"End"');
  });

  it("moves focus to the first menu item when it opens", () => {
    expect(source).toContain("focusableMenuItems(rootRef.current)[0]?.focus()");
  });

  it("skips disabled items when computing focusable menu items", () => {
    expect(source).toContain('[role="menuitem"]:not([aria-disabled="true"])');
  });
});
