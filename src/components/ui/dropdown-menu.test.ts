import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// This project's test setup runs in a plain Node environment (no jsdom/RTL,
// see vitest.config.ts) - real interaction (keyboard nav, focus, outside
// click, positioning across scroll) is verified live in a real browser
// during visual validation. These tests lock in the accessibility/behavior
// contract at the source level, so a future edit can't silently drop
// ESC-to-close, aria wiring, focus restoration, or the portal/positioning
// fix without a test failing.
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

  it("closes when a pointer event lands outside both the trigger and the portaled menu", () => {
    expect(source).toContain("handlePointerDown");
    expect(source).toContain("rootRef.current?.contains(target)");
    expect(source).toContain("menuRef.current?.contains(target)");
    expect(source).toContain("!insideTrigger && !insideMenu");
  });

  it("supports ArrowUp/ArrowDown/Home/End roving focus across menu items", () => {
    expect(source).toContain('"ArrowDown"');
    expect(source).toContain('"ArrowUp"');
    expect(source).toContain('"Home"');
    expect(source).toContain('"End"');
  });

  it("moves focus to the first menu item when it opens, scoped to the portaled menu node", () => {
    expect(source).toContain("focusableMenuItems(menuRef.current)[0]?.focus()");
  });

  it("keyboard navigation also queries within the portaled menu node, not the trigger root", () => {
    const handlerStart = source.indexOf("function handleMenuKeyDown");
    const handlerBody = source.slice(handlerStart, handlerStart + 300);
    expect(handlerBody).toContain("focusableMenuItems(menuRef.current)");
  });

  it("skips disabled items when computing focusable menu items", () => {
    expect(source).toContain('[role="menuitem"]:not([aria-disabled="true"])');
  });
});

describe("DropdownMenu primitive - portal + fixed positioning (fixes table-overflow clipping)", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "components", "ui", "dropdown-menu.tsx"),
    "utf8",
  );

  it("renders the menu through a portal into document.body, not inline in the trigger's overflow ancestor", () => {
    expect(source).toContain('import { createPortal } from "react-dom";');
    expect(source).toContain("createPortal(");
    expect(source).toContain("document.body,");
  });

  it("positions the menu with `fixed`, never `absolute` (absolute would still be clipped by an overflow ancestor)", () => {
    const menuDivIndex = source.indexOf('className="fixed z-50');
    expect(menuDivIndex).toBeGreaterThan(-1);
  });

  it("computes position from the trigger's real getBoundingClientRect(), not a hardcoded offset", () => {
    const updatePositionStart = source.indexOf("function updatePosition");
    const body = source.slice(updatePositionStart, updatePositionStart + 800);
    expect(body).toContain("trigger.getBoundingClientRect()");
  });

  it("flips above the trigger when there isn't enough viewport room below", () => {
    const updatePositionStart = source.indexOf("function updatePosition");
    const body = source.slice(updatePositionStart, updatePositionStart + 800);
    expect(body).toContain("window.innerHeight");
    expect(body).toContain("rect.top - MENU_GAP - menuHeight");
  });

  it("clamps horizontally within the viewport so it never runs off either edge", () => {
    const updatePositionStart = source.indexOf("function updatePosition");
    const body = source.slice(updatePositionStart, updatePositionStart + 1200);
    expect(body).toContain("window.innerWidth");
    expect(body).toMatch(/Math\.min\(Math\.max\(left,/);
  });

  it("recomputes position on window resize and on scroll of any nested scrollable ancestor while open", () => {
    expect(source).toContain('window.addEventListener("resize", handleReposition)');
    expect(source).toContain('document.addEventListener("scroll", handleReposition, true)');
  });

  it("measures and positions before paint via useLayoutEffect, avoiding a flash at the wrong spot", () => {
    expect(source).toContain("useLayoutEffect(() => {");
    expect(source).toContain('visibility: position ? "visible" : "hidden"');
  });

  it("never reintroduces the bug by increasing z-index alone or using overflow: visible on an ancestor", () => {
    expect(source).not.toContain("overflow: visible");
    expect(source).not.toContain("overflow-visible");
  });
});
