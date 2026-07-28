import {
  TodayExperience,
  type TodayJourneyNotice,
} from "@/components/member/today-experience";
import { getMemberContext } from "@/server/services/member-area.service";

type HojePageProps = {
  searchParams: Promise<{
    journey?: string;
    message?: string;
  }>;
};

function getNotice(params: { journey?: string; message?: string }) {
  const notices: Record<string, TodayJourneyNotice> = {
    error: {
      title: "Ação não salva",
      description:
        params.message ??
        "Não foi possível concluir agora. Seus dados anteriores foram preservados.",
      tone: "error",
    },
    finalized: {
      title: "Dia finalizado",
      description: "Pontos, sequência e conquistas foram recalculados no servidor.",
      tone: "success",
    },
    habit: {
      title: "Missão atualizada",
      description: "O progresso do dia foi recalculado com os dados salvos.",
      tone: "success",
    },
    joined: {
      title: "Ciclo iniciado",
      description: "Seu Dia 1 foi preparado com base na data e no seu fuso.",
      tone: "success",
    },
    journal: {
      title: "Reflexão salva",
      description: "Seu diário permanece privado por padrão.",
      tone: "success",
    },
  };

  return params.journey ? (notices[params.journey] ?? null) : null;
}

export default async function HojePage({ searchParams }: HojePageProps) {
  const params = await searchParams;
  const context = await getMemberContext({ ensureTodayLog: true });

  return <TodayExperience context={context} notice={getNotice(params)} />;
}
