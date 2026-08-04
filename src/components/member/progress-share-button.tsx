"use client";

import { useState } from "react";
import { Download, ImageIcon, Loader2, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { recordProfileDashboardEventAction } from "@/features/member/profile-dashboard.actions";

type ShareCardFormat = "story" | "feed";
type ProgressCardKind = "day_completed" | "streak_record";

type ShareCardResponse = {
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
 * Compartilhamento premium de progresso (Parte D/23) - dia concluído ou
 * novo recorde de sequência, disponível no Dashboard e na Timeline (mesmo
 * daily_log_id serve como âncora nos dois lugares). Mesmo fluxo do card de
 * conquista: escolher Story/Feed -> gerar ou reaproveitar (idempotente por
 * payload_hash) -> preview -> Web Share API -> fallback de download. Nunca
 * gera automaticamente sem uma ação explícita do usuário.
 */
export function ProgressShareButton({ dailyLogId, kind, label }: { dailyLogId: string; kind: ProgressCardKind; label: string }) {
  const [open, setOpen] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState<ShareCardFormat | null>(null);
  const [result, setResult] = useState<ShareCardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(format: ShareCardFormat) {
    setLoadingFormat(format);
    setError(null);

    try {
      const response = await fetch(`/api/progress-share/${dailyLogId}?kind=${kind}&format=${format}`);
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
        await navigator.share({ files: [file], title: label });
        return;
      }
    } catch {
      // Cai para o download/compartilhamento textual abaixo.
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
        Compartilhar
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

      {error ? (
        <div className="flex items-center gap-2">
          <p className="text-xs text-danger">{error}</p>
          {loadingFormat === null ? (
            <button
              className="text-xs font-semibold text-action-soft underline"
              onClick={() => result?.format && handleGenerate(result.format)}
              type="button"
            >
              Tentar de novo
            </button>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem publica em bucket do Supabase, sem otimizacao do next/image necessaria aqui */}
          <img alt={label} className="w-full max-w-[220px] rounded-[0.75rem] border border-white/[0.08]" src={result.imageUrl} />
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
              download={`projeto30-${kind}-${result.format}.png`}
              href={result.imageUrl}
              leadingIcon={<Download aria-hidden="true" size={14} />}
              onClick={() => {
                void recordProfileDashboardEventAction("evolution_share_downloaded");
              }}
              size="sm"
              variant="ghost"
            >
              Baixar
            </Button>
          </div>
        </div>
      ) : null}

      {!result && !loadingFormat ? (
        <p className="text-xs text-muted-2">
          Prefere só compartilhar o texto? Copie: “{label}” — projeto30.app
        </p>
      ) : null}
    </div>
  );
}
