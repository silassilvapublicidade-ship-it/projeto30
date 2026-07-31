"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

import { Button } from "@/components/ui/button";

const DISMISS_KEY = "p30-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorWithIosFlag = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches || navigatorWithIosFlag.standalone === true
  );
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const windowWithMsStream = window as Window & { MSStream?: unknown };
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !windowWithMsStream.MSStream;
}

/**
 * Lives in Perfil (a page the member navigates to on purpose), so unlike a
 * proactive banner it doesn't need to hide itself after a dismissal - it
 * only needs to: never show once already installed, offer the real
 * `beforeinstallprompt` flow where the browser supports it, and fall back to
 * manual instructions on iOS (which never fires that event at all).
 */
export function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);
  const [recentlyDismissed, setRecentlyDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // standalone/ios/dismissed all depend on browser-only APIs (matchMedia,
    // navigator.userAgent, localStorage) that don't exist during SSR.
    // `standalone` defaults to true precisely so the server and the client's
    // first paint agree on rendering nothing, then this effect corrects it
    // post-hydration - the intentional SSR-safe version of this pattern, not
    // a case this lint rule's cascading-render concern actually applies to.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStandalone(isStandaloneDisplay());
    setIos(isIosDevice());

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    setRecentlyDismissed(Date.now() - dismissedAt < DISMISS_COOLDOWN_MS);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    function handleAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (standalone || installed) {
    return null;
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "dismissed") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      setRecentlyDismissed(true);
    }
  }

  if (deferredPrompt) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-muted">
          {recentlyDismissed
            ? "Você pode instalar o Projeto 30 quando quiser."
            : "Instale o Projeto 30 para abrir direto da tela inicial, em tela cheia."}
        </p>
        <Button leadingIcon={<Download aria-hidden="true" size={16} />} onClick={handleInstallClick}>
          Instalar Projeto 30
        </Button>
      </div>
    );
  }

  if (ios) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.03] p-4">
        <Share aria-hidden="true" className="mt-0.5 shrink-0 text-action-soft" size={18} />
        <p className="text-sm leading-6 text-muted">
          Toque em <strong className="text-foreground">Compartilhar</strong> e depois em{" "}
          <strong className="text-foreground">Adicionar à Tela de Início</strong> para instalar o Projeto
          30 no seu iPhone ou iPad.
        </p>
      </div>
    );
  }

  return (
    <p className="text-sm leading-6 text-muted">
      A instalação está disponível em navegadores compatíveis, como Chrome, Edge ou Safari.
    </p>
  );
}
