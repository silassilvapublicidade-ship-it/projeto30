"use client";

import { useEffect } from "react";

/**
 * Two layers, since Next.js's App Router has no built-in "block this
 * navigation" primitive (unlike the Pages Router's router.events):
 *
 * 1. `beforeunload` - covers tab close, refresh, and the browser/PWA chrome
 *    asking to leave. Standard-mandated generic browser prompt; the message
 *    string itself is ignored by every modern browser, only its presence
 *    matters.
 * 2. A capture-phase click listener on internal <a> links (every in-app
 *    Link renders one) - covers switching routes without a full reload
 *    (bottom nav, "Ver jornada completa", trocar de desafio). Shows a
 *    real confirm() and cancels the click if the member backs out. This is
 *    the same workaround most App Router apps use in the absence of a
 *    native hook; it does not catch router.push() calls that don't go
 *    through a real <a> element, but nothing in this flow currently
 *    navigates that way.
 *
 * Both listeners are only attached while `hasUnsavedChanges` is true, and
 * torn down immediately when it flips back to false (e.g. right after a
 * successful finalize) - a day with nothing edited never prompts anything.
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean, message: string) {
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function handleClickCapture(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;

      if (!link) {
        return;
      }

      const url = new URL(link.href, window.location.href);
      const isSamePageAnchor =
        url.pathname === window.location.pathname && url.search === window.location.search;
      const isExternal = url.origin !== window.location.origin;

      if (isSamePageAnchor || isExternal || link.target === "_blank") {
        return;
      }

      const confirmed = window.confirm(message);

      if (!confirmed) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [hasUnsavedChanges, message]);
}
