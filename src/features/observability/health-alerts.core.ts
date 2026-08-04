export type HealthAlertTone = "critical" | "warning" | "info";

export type HealthAlert = {
  tone: HealthAlertTone;
  title: string;
  description: string;
};

/**
 * Entrada mínima necessária para montar os alertas (Parte Q: cada alerta
 * explica o que aconteceu, o impacto e a ação sugerida - nunca só "HTTP
 * 410"). Espelha o shape de SystemHealthOverview sem importar o service
 * (server-only), então esta função pode ser testada isoladamente.
 */
export type HealthAlertInput = {
  campaignsFailed24h: number;
  campaignsPartial24h: number;
  subscriptionsRevoked24h: number;
  cardsFailed24h: number;
  uploadsFailed24h: number;
  onboardingStuck: number;
  lastCronRun: { lastSeenAt: string } | null;
};

const HOUR_MS = 60 * 60 * 1000;

export function buildHealthAlerts(overview: HealthAlertInput, now: Date = new Date()): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  if (overview.campaignsFailed24h > 0) {
    alerts.push({
      tone: "critical",
      title: `${overview.campaignsFailed24h} campanha(s) de notificação falharam`,
      description:
        "Nenhum destinatário recebeu a campanha. Abra a campanha em Notificações para ver os destinatários afetados e decidir se vale reenviar.",
    });
  }

  if (overview.campaignsPartial24h > 0) {
    alerts.push({
      tone: "warning",
      title: `${overview.campaignsPartial24h} campanha(s) entregaram só parcialmente`,
      description:
        "Parte dos destinatários não recebeu a notificação (geralmente push indisponível). A campanha já está marcada como parcialmente falha para revisão.",
    });
  }

  if (overview.subscriptionsRevoked24h > 0) {
    alerts.push({
      tone: "info",
      title: `${overview.subscriptionsRevoked24h} dispositivo(s) pararam de aceitar push nas últimas 24h`,
      description:
        "Os aparelhos desinstalaram o app ou revogaram a permissão de notificação. As inscrições já foram revogadas automaticamente - nenhuma ação necessária.",
    });
  }

  if (overview.cardsFailed24h > 0) {
    alerts.push({
      tone: "warning",
      title: `${overview.cardsFailed24h} card(s) de compartilhamento falharam ao gerar`,
      description:
        "Algum usuário tentou compartilhar uma conquista ou progresso e a imagem não foi gerada. Veja Erros recentes (área Compartilhamentos) para detalhes.",
    });
  }

  if (overview.uploadsFailed24h > 0) {
    alerts.push({
      tone: "warning",
      title: `${overview.uploadsFailed24h} upload(s) falharam nas últimas 24h`,
      description:
        "Um envio de imagem (provavelmente uma Dica) não foi concluído. Veja Erros recentes (área Uploads) para saber qual admin foi afetado.",
    });
  }

  if (overview.onboardingStuck >= 5) {
    alerts.push({
      tone: "warning",
      title: `${overview.onboardingStuck} usuários presos no onboarding há mais de 48h`,
      description:
        "Criaram conta mas não concluíram o cadastro inicial. Pode ser um problema real no fluxo ou apenas pessoas que desistiram - vale uma checada.",
    });
  }

  if (!overview.lastCronRun) {
    alerts.push({
      tone: "critical",
      title: "O cron de notificações nunca rodou",
      description:
        "Nenhuma execução foi registrada ainda. Campanhas agendadas e lembretes automáticos não estão sendo processados.",
    });
  } else {
    const lastRun = new Date(overview.lastCronRun.lastSeenAt);
    const hoursSince = (now.getTime() - lastRun.getTime()) / HOUR_MS;

    if (hoursSince > 36) {
      alerts.push({
        tone: "critical",
        title: "O cron de notificações não roda há mais de 36 horas",
        description:
          "A agenda é diária - algo está impedindo a execução. Campanhas agendadas e lembretes automáticos podem estar parados.",
      });
    }
  }

  return alerts;
}
