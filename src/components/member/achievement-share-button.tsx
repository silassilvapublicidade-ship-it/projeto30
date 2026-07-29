"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAchievementShareText, type ShareableAchievement } from "@/features/achievements/achievement-sharing.core";

/**
 * Web Share API when available (mobile browsers mostly); falls back to
 * copying the message to the clipboard otherwise. Never attempts to publish
 * automatically to any social network - the user always chooses where the
 * shared text/link ends up.
 */
export function AchievementShareButton({
  achievement,
  displayName,
}: {
  achievement: ShareableAchievement;
  displayName?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const { message, title } = getAchievementShareText(achievement, displayName);

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: message, title });
        return;
      } catch {
        // User cancelled or the share sheet failed - fall through to clipboard.
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard unavailable (permissions/older browser) - nothing else to do silently.
      }
    }
  }

  return (
    <Button
      leadingIcon={
        copied ? (
          <Check aria-hidden="true" size={14} />
        ) : (
          <Share2 aria-hidden="true" size={14} />
        )
      }
      onClick={handleShare}
      size="sm"
      type="button"
      variant="secondary"
    >
      {copied ? "Copiado!" : "Compartilhar"}
    </Button>
  );
}
