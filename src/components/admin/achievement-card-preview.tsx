"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export type AchievementPreviewFields = {
  category?: string | undefined;
  challengeName?: string | undefined;
  description?: string | undefined;
  name: string;
  rarity?: string | undefined;
  shareMessage?: string | undefined;
  shareTitle?: string | undefined;
};

/**
 * Genuinely renders the share-card art (not a mockup) by posting the
 * current draft field values to /api/admin/conquistas/preview-card, which
 * reuses the real content-builder + next/og renderer with synthetic unlock
 * data. Nothing here is persisted - the image blob only ever lives in this
 * component's local object URL, revoked on every regeneration/unmount.
 */
export function AchievementCardPreview({ fields }: { fields: AchievementPreviewFields }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<"feed" | "story">("feed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generatePreview() {
    if (!fields.name.trim()) {
      setError("Informe um nome antes de gerar a prévia.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/conquistas/preview-card", {
        body: JSON.stringify({ ...fields, format }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        setError("Não foi possível gerar a prévia agora.");
        return;
      }

      const blob = await response.blob();
      setImageUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return URL.createObjectURL(blob);
      });
    } catch {
      setError("Não foi possível gerar a prévia agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2">Prévia da arte</p>
        <div className="flex gap-2">
          <Button onClick={() => setFormat("feed")} size="xs" type="button" variant={format === "feed" ? "secondary" : "ghost"}>
            Feed
          </Button>
          <Button onClick={() => setFormat("story")} size="xs" type="button" variant={format === "story" ? "secondary" : "ghost"}>
            Story
          </Button>
          <Button loading={loading} onClick={generatePreview} size="xs" type="button">
            Gerar prévia
          </Button>
        </div>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Prévia da arte de compartilhamento da conquista"
          className="max-h-96 w-auto rounded-[var(--radius-control)] border border-white/[0.08]"
          src={imageUrl}
        />
      ) : (
        <p className="text-xs text-muted">
          Nenhuma prévia gerada ainda. Preencha os campos e clique em &quot;Gerar prévia&quot;.
        </p>
      )}
    </div>
  );
}
