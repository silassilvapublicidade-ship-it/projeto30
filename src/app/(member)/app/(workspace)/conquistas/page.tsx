import { Medal } from "lucide-react";

import { MemberEmptyPage } from "@/components/member/member-empty-page";

export default function ConquistasPage() {
  return (
    <MemberEmptyPage
      description="Conquistas serão liberadas a partir de eventos reais da jornada. Nesta fase, nenhum selo é exibido sem ter sido conquistado."
      icon={Medal}
      title="Conquistas"
    />
  );
}
