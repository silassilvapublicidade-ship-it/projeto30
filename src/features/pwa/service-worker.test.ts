import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function stripJsComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

// public/sw.js is a hand-written vanilla service worker (see the file's own
// header comment for why Serwist/next-pwa were rejected: both hook into a
// webpack() config, and Next.js 16 fails `next build` outright on a webpack
// config once Turbopack is the default builder). No jsdom/RTL or SW test
// harness in this project (see vitest.config.ts) - these are source-level
// regression tests that lock in the safety contract; the actual runtime
// behavior (offline fallback, cache scoping, update flow) is validated live
// against a real browser during production validation.
describe("public/sw.js - safety contract", () => {
  const source = readSource("public", "sw.js");
  const code = stripJsComments(source);

  it("only ever intercepts GET requests - Server Actions/mutations must pass straight through", () => {
    expect(code).toContain('if (request.method !== "GET") return;');
  });

  it("never calls self.skipWaiting() from the install handler - updates wait for explicit user action", () => {
    const installStart = code.indexOf('addEventListener("install"');
    const installBody = code.slice(installStart, code.indexOf("});", installStart));
    expect(installBody).not.toContain("skipWaiting");
  });

  it("only skips waiting in response to an explicit SKIP_WAITING message from the client", () => {
    expect(code).toContain('addEventListener("message"');
    expect(code).toMatch(/event\.data\.type === "SKIP_WAITING"/);
    expect(code).toContain("self.skipWaiting();");
  });

  it("cleans up old versioned caches on activate", () => {
    const activateStart = code.indexOf('addEventListener("activate"');
    const activateBody = code.slice(activateStart, code.indexOf("});", activateStart) + 3);
    expect(activateBody).toContain("caches.delete(key)");
    expect(activateBody).toContain("!CURRENT_CACHES.includes(key)");
  });

  it("uses an allowlist for Network-First pages, matching exactly the round's spec (Hoje, Jornada, Desafios, Perfil, Conquistas, Dicas)", () => {
    expect(code).toContain('"/app/hoje"');
    expect(code).toContain('"/app/jornada"');
    expect(code).toContain('"/app/desafios"');
    expect(code).toContain('"/app/perfil"');
    expect(code).toContain('"/app/conquistas"');
    expect(code).toContain('"/app/dicas"');
  });

  it("never allowlists Admin, auth, Diário or Configurações for page caching", () => {
    const listStart = code.indexOf("const NETWORK_FIRST_PAGE_PATHS");
    const listEnd = code.indexOf("];", listStart);
    const list = code.slice(listStart, listEnd);
    expect(list).not.toContain("/admin");
    expect(list).not.toContain("/app/diario");
    expect(list).not.toContain("/app/configuracoes");
    expect(list).not.toContain("/login");
    expect(list).not.toContain("/cadastro");
  });

  it("tip images only get Stale-While-Revalidate when NOT referred from /admin", () => {
    const fnStart = code.indexOf("function isPublicTipImage");
    const fnBody = code.slice(fnStart, code.indexOf("\n}", fnStart));
    expect(fnBody).toContain('referrer.includes("/admin")');
    expect(fnBody).toContain("return false");
  });

  it("static assets (Next build output, icons, favicon) use Cache First", () => {
    const fnStart = code.indexOf("function isStaticAsset");
    const fnBody = code.slice(fnStart, code.indexOf("\n}", fnStart) + 2);
    expect(fnBody).toContain('"/_next/static/"');
    expect(fnBody).toContain('"/icons/"');
    expect(code).toContain("event.respondWith(cacheFirst(request, STATIC_CACHE));");
  });

  it("navigation failures fall back to the offline shell, never a bare network error", () => {
    expect(code).toContain('const OFFLINE_URL = "/offline.html";');
    expect(code).toContain("caches.match(OFFLINE_URL)");
  });

  it("precaches the offline page and icons on install", () => {
    const listStart = code.indexOf("const SHELL_ASSETS");
    const listEnd = code.indexOf("];", listStart);
    const list = code.slice(listStart, listEnd);
    expect(list).toContain("OFFLINE_URL");
    expect(list).toContain('"/icons/icon-192.png"');
    expect(list).toContain('"/icons/icon-512.png"');
  });
});

describe("public/offline.html - offline fallback page", () => {
  const source = readSource("public", "offline.html");

  it("uses the exact required copy", () => {
    const normalized = source.replace(/\s+/g, " ");
    expect(source).toContain("Você está sem conexão.");
    expect(normalized).toContain(
      "Alguns conteúdos já acessados continuam disponíveis. Para registrar progresso ou atualizar informações, conecte-se novamente.",
    );
  });

  it("has a retry action and a link back to already-cached content", () => {
    expect(source).toContain("Tentar novamente");
    expect(source).toContain('href="/app/hoje"');
  });

  it("automatically recovers when the network returns", () => {
    expect(source).toContain('addEventListener("online"');
    expect(source).toContain("window.location.reload()");
  });

  it("probes real connectivity instead of trusting navigator.onLine alone (which is unreliable right after a SW-served navigation)", () => {
    expect(source).toContain("probeConnectivity");
    expect(source).not.toContain("/favicon.ico");
  });

  it("is fully self-contained (inline CSS/JS, no dependency on Next's hashed build assets)", () => {
    expect(source).not.toMatch(/_next\/static/);
    expect(source).not.toMatch(/<link[^>]+rel="stylesheet"/);
  });
});
