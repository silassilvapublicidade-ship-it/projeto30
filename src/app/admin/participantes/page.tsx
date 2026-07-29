import { ArrowRight } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminParticipantsPage() {
  return (
    <Card tone="glass">
      <CardHeader>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-action-soft">
          Fase 2 · Analytics
        </p>
        <CardTitle className="text-xl">Participantes</CardTitle>
        <CardDescription>
          A gestão de participantes agora vive dentro de cada desafio, porque as
          métricas (progresso, pontos, sequência, atividade) só fazem sentido no
          contexto de um ciclo específico. Escolha um desafio em{" "}
          <span className="font-semibold text-foreground">Desafios</span> e abra
          &quot;Ver participantes&quot; para consultar, filtrar e paginar a lista real.
        </CardDescription>
      </CardHeader>
      <div className="mt-5">
        <Button as="a" href="/admin/desafios" trailingIcon={<ArrowRight aria-hidden="true" size={15} />}>
          Ir para desafios
        </Button>
      </div>
    </Card>
  );
}
