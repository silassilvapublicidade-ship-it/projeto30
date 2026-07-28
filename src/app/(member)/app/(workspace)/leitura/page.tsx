import { BookOpen } from "lucide-react";

import { MemberEmptyPage } from "@/components/member/member-empty-page";

export default function LeituraPage() {
  return (
    <MemberEmptyPage
      description="Planos de leitura serão ligados aos ciclos publicados. A fundação já reserva o espaço sem inventar conteúdos."
      icon={BookOpen}
      title="Leitura"
    />
  );
}
