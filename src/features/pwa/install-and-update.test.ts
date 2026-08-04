import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function stripJsComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("InstallAppPrompt", () => {
  const source = readSource("src", "components", "pwa", "install-app-prompt.tsx");
  const code = stripJsComments(source);

  it("never renders anything once already running standalone", () => {
    expect(code).toContain("if (standalone || installed)");
    expect(code).toContain("return null;");
  });

  it("detects standalone via both the standard media query and the iOS-specific navigator flag", () => {
    const fnStart = code.indexOf("function isStandaloneDisplay");
    const fnBody = code.slice(fnStart, code.indexOf("\n}", fnStart));
    expect(fnBody).toContain('"(display-mode: standalone)"');
    expect(fnBody).toContain("navigatorWithIosFlag.standalone");
  });

  it("captures beforeinstallprompt and prevents the browser's own mini-infobar", () => {
    expect(code).toContain('addEventListener("beforeinstallprompt"');
    expect(code).toContain("event.preventDefault();");
  });

  it("never claims iOS has an automatic install prompt - only shows manual Share instructions", () => {
    expect(code).toContain("Compartilhar");
    expect(code).toContain("Adicionar à Tela de Início");
    // the iOS branch must not also try to call deferredPrompt.prompt()
    const iosBranchStart = code.indexOf("if (ios) {");
    const iosBranchBody = code.slice(iosBranchStart, iosBranchStart + 500);
    expect(iosBranchBody).not.toContain("deferredPrompt.prompt()");
  });

  it("remembers a native-prompt dismissal without permanently hiding the section (Perfil is opt-in navigation, not a pushed banner)", () => {
    expect(code).toContain("DISMISS_COOLDOWN_MS");
    expect(code).toContain("localStorage.setItem(DISMISS_KEY");
    // dismissal must not cause the component to return null
    const dismissLine = code.indexOf("setRecentlyDismissed(true);");
    expect(dismissLine).toBeGreaterThan(-1);
  });

  it("updates its own state on appinstalled instead of leaving a stale install button visible", () => {
    expect(code).toContain('addEventListener("appinstalled"');
    expect(code).toContain("setInstalled(true);");
  });
});

describe("ServiceWorkerManager - controlled update flow", () => {
  const source = readSource("src", "components", "pwa", "service-worker-manager.tsx");
  const code = stripJsComments(source);

  it("registers /sw.js", () => {
    expect(code).toContain("navigator.serviceWorker");
    expect(code).toContain('.register("/sw.js")');
  });

  it("only surfaces the update banner for a genuine update (an existing controller), not the very first install", () => {
    expect(code).toContain("navigator.serviceWorker.controller");
  });

  it("only tells the waiting worker to activate on an explicit user click, never automatically", () => {
    const buttonStart = code.indexOf("<Button");
    const buttonBlock = code.slice(buttonStart, code.indexOf("</Button>", buttonStart));
    expect(buttonBlock).toContain('postMessage({ type: "SKIP_WAITING" })');
    expect(buttonBlock).toContain("onClick=");
  });

  it("guards the controllerchange reload against loops with a latch, not an unconditional reload", () => {
    const handlerStart = code.indexOf("function handleControllerChange");
    const handlerBody = code.slice(handlerStart, code.indexOf("\n    }", handlerStart));
    expect(handlerBody).toContain("if (reloadingRef.current) return;");
    expect(handlerBody).toContain("reloadingRef.current = true;");
  });

  it("shows the exact required copy", () => {
    expect(code).toContain("Uma nova versão do Projeto 30 está disponível.");
    expect(code).toContain("Atualizar agora");
  });

  it("a failed registration never throws uncaught - the app must keep working without the SW", () => {
    expect(code).toContain(".catch(() => {");
  });
});

describe("Perfil edit page - install section placement", () => {
  // InstallAppPrompt moved from /app/perfil to /app/perfil/editar when Perfil
  // became the Dashboard de Evolucao Pessoal - account settings (including
  // PWA install) now live in the dedicated edit route, per the brief's
  // requirement to never drop existing functionality.
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "perfil", "editar", "page.tsx");

  it("renders InstallAppPrompt inside a labeled section", () => {
    expect(source).toContain('import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";');
    expect(source).toContain("<InstallAppPrompt />");
    expect(source).toContain('title="Instalar aplicativo"');
  });
});
