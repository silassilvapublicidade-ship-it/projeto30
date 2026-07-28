"use client";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl">
      <StatusCard
        description="Não foi possível carregar esta parte da sua jornada agora. Tente novamente em alguns segundos."
        title="Algo saiu do ritmo"
        tone="error"
      />
      <div className="mt-5">
        <Button onClick={reset} type="button" variant="secondary">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
