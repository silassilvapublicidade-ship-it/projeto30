"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getClientEnv } from "@/lib/env/client";

const SHARE_TEXT = "Estou construindo uma nova versão de mim mesmo com o Projeto 30. Vem comigo?";

/**
 * Web Share API quando disponível (a maioria dos navegadores mobile);
 * fallback para copiar o link (mesmo padrão de CopyDiagnosticButton) em
 * desktop/navegadores sem suporte - nunca falha silenciosamente.
 */
export function ShareAppButton() {
  const [copied, setCopied] = useState(false);
  const siteUrl = getClientEnv().NEXT_PUBLIC_SITE_URL;

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: SHARE_TEXT, url: siteUrl });
        return;
      } catch {
        // Usuário cancelou o compartilhamento nativo - nunca cai no fallback
        // de clipboard nesse caso (seria uma segunda ação surpresa).
        return;
      }
    }

    await navigator.clipboard.writeText(`${SHARE_TEXT} ${siteUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      className="w-full justify-start"
      leadingIcon={copied ? <Check aria-hidden="true" size={16} /> : <Share2 aria-hidden="true" size={16} />}
      onClick={handleShare}
      type="button"
      variant="ghost"
    >
      {copied ? "Link copiado" : "Compartilhar Projeto 30"}
    </Button>
  );
}
