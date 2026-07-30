"use client";

import { useEffect } from "react";

/**
 * Next.js only auto-scrolls to top on navigation when the destination page's
 * first element isn't already visible at the current scroll position. Since
 * this route shares a scrollable layout with its parent list page, that
 * heuristic can miss and leave the page scrolled mid-content. Force it.
 */
export function ScrollToTopOnMount() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return null;
}
