import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("Web App Manifest", () => {
  const result = manifest();

  it("has the expected identity fields", () => {
    expect(result.name).toBe("Projeto 30");
    expect(result.short_name).toBe("Projeto 30");
    expect(result.description).toBeTruthy();
    expect(result.lang).toBe("pt-BR");
  });

  it("opens straight into the Dashboard, the primary member landing page - not the marketing site, not Hoje directly", () => {
    expect(result.start_url).toBe("/app/dashboard");
    expect(result.scope).toBe("/");
  });

  it("displays standalone", () => {
    expect(result.display).toBe("standalone");
  });

  it("uses the app's actual dark theme color, not a placeholder", () => {
    expect(result.background_color).toBe("#050505");
    expect(result.theme_color).toBe("#050505");
  });

  it("declares both a regular and a maskable icon at 192 and 512", () => {
    const icons = result.icons ?? [];
    const bySizeAndPurpose = (sizes: string, purpose: string) =>
      icons.some((icon) => icon.sizes === sizes && icon.purpose === purpose);

    expect(bySizeAndPurpose("192x192", "any")).toBe(true);
    expect(bySizeAndPurpose("512x512", "any")).toBe(true);
    expect(bySizeAndPurpose("192x192", "maskable")).toBe(true);
    expect(bySizeAndPurpose("512x512", "maskable")).toBe(true);
  });

  it("every declared icon file actually exists on disk", () => {
    for (const icon of result.icons ?? []) {
      const filePath = join(process.cwd(), "public", icon.src.replace(/^\//, ""));
      expect(() => readFileSync(filePath), `${icon.src} should exist in public/`).not.toThrow();
    }
  });

  it("declares the 4 required shortcuts", () => {
    const urls = (result.shortcuts ?? []).map((shortcut) => shortcut.url);
    expect(urls).toContain("/app/hoje");
    expect(urls).toContain("/app/desafios");
    expect(urls).toContain("/app/dicas");
    expect(urls).toContain("/app/conquistas");
  });
});

describe("Root layout - PWA metadata", () => {
  const source = readSource("src", "app", "layout.tsx");

  it("links the generated manifest", () => {
    expect(source).toContain('manifest: "/manifest.webmanifest"');
  });

  it("declares appleWebApp metadata for iOS standalone/status bar behavior", () => {
    expect(source).toMatch(/appleWebApp:\s*\{/);
    expect(source).toContain("capable: true");
    expect(source).toContain('statusBarStyle: "black-translucent"');
  });

  it("sets viewport-fit=cover for safe-area support", () => {
    expect(source).toContain('viewportFit: "cover"');
  });

  it("registers the service worker manager in the body", () => {
    expect(source).toContain("<ServiceWorkerManager />");
  });
});
