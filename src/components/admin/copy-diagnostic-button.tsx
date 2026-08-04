"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CopyDiagnosticButton({ text, label = "Copiar diagnóstico" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      leadingIcon={
        copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />
      }
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      size="sm"
      type="button"
      variant="secondary"
    >
      {copied ? "Copiado" : label}
    </Button>
  );
}
