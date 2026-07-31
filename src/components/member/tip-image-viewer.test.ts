import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function stripJsComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

// No jsdom/RTL in this project's test setup (Node environment only, see
// vitest.config.ts) - real gesture interaction, focus behavior and visual
// legibility are verified live in a real browser during production
// validation. These tests lock in the contract at the source level so the
// fullscreen/zoom/pan/download behavior this component exists for can't
// silently regress.
describe("TipImageViewer - fullscreen lightbox contract", () => {
  const source = readSource("src", "components", "member", "tip-image-viewer.tsx");
  const code = stripJsComments(source);

  it("renders the inline preview as a real <img> (not next/image) so it shows the stored resolution untouched", () => {
    expect(code).not.toContain('from "next/image"');
    expect(code).toContain("<img");
  });

  it("Portals the lightbox directly into document.body", () => {
    expect(code).toContain("createPortal(");
    expect(code).toContain("document.body,");
  });

  it("the lightbox is an accessible modal dialog", () => {
    expect(code).toContain('role="dialog"');
    expect(code).toContain('aria-modal="true"');
  });

  it("clicking the backdrop closes it, but clicking inside the stage does not", () => {
    expect(code).toMatch(/event\.target === overlayRef\.current/);
  });

  it("ESC closes the lightbox", () => {
    expect(code).toMatch(/event\.key === "Escape"/);
    expect(code).toContain("onClose();");
  });

  it("traps Tab focus inside the lightbox and cycles first/last focusable elements", () => {
    expect(code).toMatch(/event\.key !== "Tab"/);
    expect(code).toContain("event.shiftKey && document.activeElement === first");
    expect(code).toContain("!event.shiftKey && document.activeElement === last");
  });

  it("moves focus to the close button on open and restores it to the trigger on close", () => {
    expect(code).toContain("closeButtonRef.current?.focus();");
    expect(code).toContain("previouslyFocused?.focus();");
    expect(code).toContain("triggerRef.current?.focus();");
  });

  it("locks body scroll while open and restores it on close", () => {
    expect(code).toContain('document.body.style.overflow = "hidden";');
    expect(code).toContain("document.body.style.overflow = previousOverflow;");
  });

  it("defines real min/max zoom bounds", () => {
    expect(code).toContain("const MIN_SCALE = 1;");
    expect(code).toMatch(/const MAX_SCALE = [4-5];/);
  });

  it("has working zoom-in, zoom-out and reset controls that respect the bounds", () => {
    expect(code).toContain("const zoomIn = useCallback(() => zoomCentered(scaleRef.current + BUTTON_STEP)");
    expect(code).toContain("const zoomOut = useCallback(() => zoomCentered(scaleRef.current - BUTTON_STEP)");
    expect(code).toContain("const reset = useCallback(() => {");
    expect(code).toContain("clamp(nextScale, MIN_SCALE, MAX_SCALE)");
  });

  it("zooms toward the cursor/touch point rather than always the center", () => {
    const zoomAtStart = code.indexOf("const zoomAt = useCallback(");
    const zoomAtBody = code.slice(zoomAtStart, zoomAtStart + 900);
    expect(zoomAtBody).toContain("clientX - rect.left - rect.width / 2");
    expect(zoomAtBody).toContain("clientY - rect.top - rect.height / 2");
  });

  it("supports mouse wheel zoom", () => {
    expect(code).toContain('addEventListener("wheel", onWheel');
  });

  it("supports pinch-to-zoom via two simultaneous pointers", () => {
    expect(code).toContain("pointers.current.size === 2");
    expect(code).toContain("pinchOrigin.current");
    expect(code).toMatch(/Math\.hypot\(/);
  });

  it("supports double-click/double-tap to toggle zoom via a single unified pointer handler (not a separate onDoubleClick, which double-fires alongside pointer-based detection and cancels itself out)", () => {
    expect(code).not.toContain("onDoubleClick");
    expect(code).toContain("const toggleZoomAt = useCallback(");
    expect(code).toContain("DOUBLE_TAP_WINDOW_MS");
    expect(code).toContain("toggleZoomAt(event.clientX, event.clientY);");
  });

  it("pan only activates once zoomed in, and clamps translation to the scaled bounds", () => {
    expect(code).toContain("scaleRef.current > MIN_SCALE");
    expect(code).toContain("const getBoundsForScale = useCallback(");
    expect(code).toContain("clamp(drag.startPos.x + (event.clientX - drag.startX), -maxX, maxX)");
  });

  it("uses Pointer Events (covers both mouse and touch) rather than separate mouse/touch handlers", () => {
    expect(code).toContain("onPointerDown={handlePointerDown}");
    expect(code).toContain("onPointerMove={handlePointerMove}");
    expect(code).toContain("onPointerUp={endPointer}");
    expect(code).not.toContain("onTouchStart");
    expect(code).not.toContain("onMouseDown");
  });

  it("has loading and error states for the fullscreen image, with a working retry", () => {
    expect(code).toContain('useState<"loading" | "loaded" | "error">("loading")');
    expect(code).toContain("Não foi possível carregar a imagem.");
    expect(code).toContain("Tentar novamente");
    expect(code).toContain("setRetryCount((count) => count + 1)");
  });

  it("download button fetches, tracks loading/success/error, and triggers a real file save (not just a new tab)", () => {
    const downloadStart = code.indexOf("async function handleDownload");
    const downloadBody = code.slice(downloadStart, downloadStart + 900);
    expect(downloadBody).toContain('setDownloadState("loading")');
    expect(downloadBody).toContain("await fetch(downloadUrl)");
    expect(downloadBody).toContain("await response.blob()");
    expect(downloadBody).toContain("anchor.click();");
    expect(downloadBody).toContain('setDownloadState("success")');
    expect(downloadBody).toContain('setDownloadState("error")');
  });
});

describe("Detail page - uses TipImageViewer instead of a fixed-ratio static image", () => {
  const detailDir = ["src", "app", "(member)", "app", "(workspace)", "dicas", "[slug]"];
  const source = readSource(...detailDir, "page.tsx");

  it("imports TipImageViewer", () => {
    expect(source).toContain('import { TipImageViewer } from "@/components/member/tip-image-viewer";');
  });

  it("no longer forces a 16:9 box on a 4:5 portrait image (the original bug)", () => {
    expect(source).not.toContain("aspect-[16/9]");
  });

  it("wires the secure per-tip download route by id", () => {
    expect(source).toContain("downloadUrl={`/api/dicas/${tip.id}/download`}");
  });
});
