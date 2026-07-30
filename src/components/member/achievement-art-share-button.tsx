"use client";

import { useState } from "react";
import { Download, ImageIcon, Loader2, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ShareCardFormat = "story" | "feed";

type ShareCardResponse = {
  achievementName: string;
  format: ShareCardFormat;
  height: number;
  imageUrl: string;
  width: number;
};

const formatLabels: Record<ShareCardFormat, string> = {
  feed: "Feed (1080×1350)",
  story: "Story (1080×1920)",
};

/**
 * Generates a shareable image for an already-unlocked achievement (Story or
 * Feed preset) via GET /api/achievements/[id]/share-card, then offers
 * Web Share API (with the image file when supported), download, and a
 * text-only fallback. Never generates art for locked achievements or daily
 * progress - both are out of scope for this first version.
 */
export function AchievementArtShareButton({ userAchievementId }: { userAchievementId: string }) {
  const [open, setOpen] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState<ShareCardFormat | null>(null);
  const [result, setResult] = useState<ShareCardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(format: ShareCardFormat) {
    setLoadingFormat(format);
    setError(null);

    try {
      const response = await fetch(`/api/achievements/${userAchievementId}/share-card?format=${format}`);
      const data = (await response.json()) as ShareCardResponse | { error: string };

      if (!response.ok || "error" in data) {
        setError("error" in data ? data.error : "Não foi possível gerar a arte agora.");
        return;
      }

      setResult(data);
    } catch {
      setError("Não foi possível gerar a arte agora. Tente novamente.");
    } finally {
      setLoadingFormat(null);
    }
  }

  async function handleShareImage() {
    if (!result) return;

    try {
      const blob = await (await fetch(result.imageUrl)).blob();
      const file = new File([blob], `${result.format}.png`, { type: "image/png" });

      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: result.achievementName });
        return;
      }
    } catch {
      // Cai para o download abaixo.
    }
  }

  if (!open) {
    return (
      <Button
        leadingIcon={<ImageIcon aria-hidden="true" size={14} />}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="secondary"
      >
        Gerar arte
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[1rem] border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex flex-wrap gap-2">
        {(["story", "feed"] as const).map((format) => (
          <Button
            key={format}
            loading={loadingFormat === format}
            onClick={() => handleGenerate(format)}
            size="sm"
            type="button"
            variant={result?.format === format ? "primary" : "secondary"}
          >
            {formatLabels[format]}
          </Button>
        ))}
      </div>

      {loadingFormat ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Loader2 aria-hidden="true" className="animate-spin" size={12} />
          Gerando imagem...
        </p>
      ) : null}

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {result ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem publica em bucket do Supabase, sem otimizacao do next/image necessaria aqui */}
          <img
            alt={`Arte da conquista ${result.achievementName}`}
            className="w-full max-w-[220px] rounded-[0.75rem] border border-white/[0.08]"
            src={result.imageUrl}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              leadingIcon={<Share2 aria-hidden="true" size={14} />}
              onClick={handleShareImage}
              size="sm"
              type="button"
              variant="secondary"
            >
              Compartilhar
            </Button>
            <Button
              as="a"
              download={`projeto30-${result.format}.png`}
              href={result.imageUrl}
              leadingIcon={<Download aria-hidden="true" size={14} />}
              size="sm"
              variant="ghost"
            >
              Baixar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
