"use client";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl">
      <StatusCard
        description="Não foi possível carregar esta área administrativa agora. Tente novamente em alguns segundos."
        title="Algo não carregou"
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
