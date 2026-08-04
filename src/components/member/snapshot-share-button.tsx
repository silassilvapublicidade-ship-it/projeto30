"use client";

import { useState } from "react";
import { Download, ImageIcon, Loader2, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { recordProfileDashboardEventAction } from "@/features/member/profile-dashboard.actions";

type ShareCardFormat = "story" | "feed";
type SnapshotProgressCardKind = "challenge_completed" | "challenge_progress" | "halfway" | "last_7_days" | "weekly_summary";

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
 * Mesma UI/fluxo de ProgressShareButton, para os 5 tipos que fotografam o
 * ESTADO da inscrição (metade do ciclo, últimos 7 dias, resumo semanal,
 * progresso do desafio, desafio concluído) - âncora enrollmentId em vez de
 * dailyLogId, rota /api/progress-share/enrollment/[enrollmentId]. A
 * disponibilidade real (Parte E item 18) é sempre revalidada no servidor:
 * este botão só aparece nos pontos da UI onde já sabemos que o marco é
 * genuíno, mas o backend nunca confia só nisso.
 */
export function SnapshotShareButton({
  enrollmentId,
  kind,
  label,
}: {
  enrollmentId: string;
  kind: SnapshotProgressCardKind;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState<ShareCardFormat | null>(null);
  const [result, setResult] = useState<ShareCardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guarda o formato tentado INDEPENDENTE de sucesso (Correções
  // obrigatórias pré-lançamento, Parte C) - mesma correção de
  // progress-share-button.tsx: "Tentar de novo" nunca pode depender de
  // result?.format, que so existe apos um sucesso ANTERIOR.
  const [lastAttemptedFormat, setLastAttemptedFormat] = useState<ShareCardFormat | null>(null);

  async function handleGenerate(format: ShareCardFormat) {
    if (loadingFormat) return; // nunca dois requests em voo pelo mesmo clique/duplo-clique
    setLastAttemptedFormat(format);
    setLoadingFormat(format);
    setError(null);

    try {
      const response = await fetch(`/api/progress-share/enrollment/${enrollmentId}?kind=${kind}&format=${format}`);
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
              onClick={() => lastAttemptedFormat && handleGenerate(lastAttemptedFormat)}
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
