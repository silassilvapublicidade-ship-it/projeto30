import { NotebookPen } from "lucide-react";

import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { Card } from "@/components/ui/card";

export default function DiarioPage() {
  return (
    <MemberEmptyPage
      description="O diário será um espaço privado para registrar o que precisa ficar guardado entre você e sua jornada."
      icon={NotebookPen}
      title="Diário"
    >
      <Card className="p-5 sm:p-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-action-soft">
          Privado por padrão
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
          Nenhum texto é salvo nesta fase. Quando a escrita for ativada, suas entradas
          aparecerão aqui sem serem misturadas com dados de outros ciclos.
        </p>
      </Card>
    </MemberEmptyPage>
  );
}
