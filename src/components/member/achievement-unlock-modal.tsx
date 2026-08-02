"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronRight, Download, Loader2, Share2, Trophy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FinalizeDaySummary } from "@/features/member/journey.actions";

type UnlockedAchievement = FinalizeDaySummary["unlockedAchievements"][number];

type ShareCardResponse = {
  achievementName: string;
  format: "story" | "feed";
  height: number;
  imageUrl: string;
  width: number;
};

/**
 * One achievement's card art, pre-fetched as soon as it becomes the current
 * slide (a plain GET needs no user gesture) so "Compartilhar" is a single
 * tap with no visible wait once the member is looking at it.
 */
function useShareCard(userAchievementId: string) {
  const [result, setResult] = useState<ShareCardResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/achievements/${userAchievementId}/share-card?format=story`)
      .then(async (response) => {
        const data = (await response.json()) as ShareCardResponse | { error: string };
        if (cancelled) return;
        if (!response.ok || "error" in data) {
          setError(true);
          return;
        }
        setResult(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userAchievementId]);

  return { error, result };
}

function UnlockSlide({
  achievement,
  isLast,
  onAdvance,
}: {
  achievement: UnlockedAchievement;
  isLast: boolean;
  onAdvance: () => void;
}) {
  const { error, result } = useShareCard(achievement.userAchievementId);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (!result) return;
    setSharing(true);

    try {
      const blob = await (await fetch(result.imageUrl)).blob();
      const file = new File([blob], "conquista.png", { type: "image/png" });

      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: achievement.name });
      }
    } catch {
      // Sem Web Share API disponivel: o botao "Baixar" abaixo cobre o caso.
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center [animation:p30-celebrate-in_var(--motion-celebration)_var(--ease-premium)]">
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-action-soft">
        Conquista desbloqueada
      </span>

      <div className="flex aspect-[9/16] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-[1.25rem] border border-action/28 bg-[linear-gradient(180deg,rgba(255,106,0,0.14),rgba(255,255,255,0.02))]">
        {result ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem publica em bucket do Supabase, gerada sob demanda
          <img alt={`Arte da conquista ${achievement.name}`} className="size-full object-cover" src={result.imageUrl} />
        ) : error ? (
          <Trophy aria-hidden="true" className="text-action-soft" size={40} />
        ) : (
          <Loader2 aria-hidden="true" className="animate-spin text-action-soft" size={28} />
        )}
      </div>

      <div>
        <h2 className="font-display text-xl text-foreground">{achievement.name}</h2>
        {achievement.pointsBonus > 0 ? (
          <p className="mt-1 text-sm text-muted">+{achievement.pointsBonus} pontos de bônus</p>
        ) : null}
      </div>

      <div className="flex w-full flex-wrap justify-center gap-2">
        <Button
          disabled={!result}
          leadingIcon={<Share2 aria-hidden="true" size={14} />}
          loading={sharing}
          onClick={handleShare}
          size="sm"
          type="button"
        >
          Compartilhar
        </Button>
        {result ? (
          <Button
            as="a"
            download="projeto30-conquista.png"
            href={result.imageUrl}
            leadingIcon={<Download aria-hidden="true" size={14} />}
            size="sm"
            variant="ghost"
          >
            Baixar
          </Button>
        ) : null}
      </div>

      <Button
        onClick={onAdvance}
        size="sm"
        trailingIcon={isLast ? undefined : <ChevronRight aria-hidden="true" size={14} />}
        type="button"
        variant="secondary"
      >
        {isLast ? "Fechar" : "Próxima conquista"}
      </Button>
    </div>
  );
}

/**
 * Auto-opens right after a finalize response comes back with 1+ newly
 * unlocked achievements (today-interactive-section wires this). Shows every
 * one of them, one at a time, never a summarized/collapsed list - the
 * explicit product requirement is that a new achievement is never quietly
 * skipped. Native <dialog> for the same reason ConfirmDialog uses it: real
 * focus trap and ESC handling for free.
 */
/**
 * Owns which slide is showing. Keyed (by the caller, on the achievement list
 * itself) so a brand new finalize result - always a brand new
 * unlocked_achievements array - remounts this and naturally starts back at
 * slide 0, instead of resetting index via a setState-in-effect.
 */
function UnlockPager({
  achievements,
  onOpenChange,
}: {
  achievements: UnlockedAchievement[];
  onOpenChange: (open: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const current = achievements[index];

  if (!current) {
    return null;
  }

  const isLast = index === achievements.length - 1;

  return (
    <>
      {achievements.length > 1 ? (
        <p className="mb-3 text-center font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-2">
          {index + 1} de {achievements.length}
        </p>
      ) : null}

      <UnlockSlide
        achievement={current}
        isLast={isLast}
        onAdvance={() => {
          if (isLast) {
            onOpenChange(false);
            return;
          }
          setIndex((current) => current + 1);
        }}
      />
    </>
  );
}

export function AchievementUnlockModal({
  achievements,
  onOpenChange,
  open,
}: {
  achievements: UnlockedAchievement[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleClose() {
      onOpenChange(false);
    }

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onOpenChange]);

  if (achievements.length === 0) {
    return null;
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className="m-auto max-w-xs rounded-[var(--radius-card)] border border-white/[0.10] bg-matte/96 p-0 text-foreground shadow-[var(--shadow-lift)] backdrop:bg-black/70"
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onOpenChange(false);
        }
      }}
      ref={dialogRef}
    >
      <div className="relative p-5 sm:p-6">
        <button
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-full p-1 text-muted-2 transition-colors hover:text-foreground"
          onClick={() => onOpenChange(false)}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>

        <h2 className="sr-only" id={titleId}>
          Conquista desbloqueada
        </h2>

        <UnlockPager
          achievements={achievements}
          key={achievements.map((achievement) => achievement.userAchievementId).join(",")}
          onOpenChange={onOpenChange}
        />
      </div>
    </dialog>
  );
}
