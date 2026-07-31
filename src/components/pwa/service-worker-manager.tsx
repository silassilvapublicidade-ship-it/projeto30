"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Registers /sw.js and, when a new version has finished installing in the
 * background, shows an explicit "Atualizar agora" prompt instead of
 * swapping the app out from under the user. The new worker sits in the
 * "waiting" state (see sw.js - install never calls skipWaiting) until this
 * component posts SKIP_WAITING to it, which only happens on a real click.
 */
export function ServiceWorkerManager() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | undefined;

    function handleControllerChange() {
      // A new worker can only become the controller after skipWaiting(),
      // which this component only ever triggers from the explicit "Atualizar
      // agora" click - so a single guarded reload here can't loop.
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;

        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
        }

        reg.addEventListener("updatefound", () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(installingWorker);
            }
          });
        });
      })
      .catch(() => {
        // A failed SW registration must never block the app itself.
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      void registration;
    };
  }, []);

  if (!waitingWorker) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="safe-fixed-bottom fixed inset-x-4 z-[300] mx-auto flex max-w-md flex-col gap-3 rounded-[var(--radius-card)] border border-white/[0.10] bg-matte/96 p-4 shadow-[var(--shadow-lift)] backdrop-blur sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <p className="text-sm leading-6 text-foreground">Uma nova versão do Projeto 30 está disponível.</p>
      <Button
        onClick={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })}
        size="sm"
        variant="secondary"
      >
        Atualizar agora
      </Button>
    </div>
  );
}
