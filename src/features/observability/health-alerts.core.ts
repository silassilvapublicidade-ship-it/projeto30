export type HealthAlertTone = "critical" | "warning" | "info";

export type HealthAlert = {
  tone: HealthAlertTone;
  title: string;
  description: string;
  href?: string;
};

/**
 * Entrada mínima necessária para montar os alertas (Parte Q, painel de
 * Observabilidade / Parte E, cockpit: cada alerta explica o que aconteceu,
 * o impacto e a ação sugerida - nunca só "HTTP 410"). Espelha o shape de
 * SystemHealthOverview sem importar o service (server-only), então esta
 * função pode ser testada isoladamente. Única fonte de verdade da regra de
 * alertas - reutilizada por /admin/observabilidade E pelo cockpit
 * (/admin), nunca reimplementada.
 */
export type HealthAlertInput = {
  openCriticalErrors24h: number;
  campaignsFailed24h: number;
  campaignsPartial24h: number;
  deliveriesRetry: number;
  subscriptionsRevoked24h: number;
  cardsFailed24h: number;
  uploadsFailed24h: number;
  onboardingStuck: number;
  lastCronRun: { lastSeenAt: string } | null;
};

const HOUR_MS = 60 * 60 * 1000;

// Limiares documentados (Parte E pede "volume anormal", não qualquer
// ocorrência) - abaixo disso o evento é ruído operacional normal, não um
// alerta que mereça um dos 5 slots do cockpit.
const DELIVERIES_RETRY_BACKLOG_THRESHOLD = 10;
const SUBSCRIPTIONS_REVOKED_ABNORMAL_THRESHOLD = 10;

/**
 * Ordem = prioridade (Parte E): erros críticos, cron, campanha falha,
 * campanha parcial, backlog de retry, uploads, cards, onboarding,
 * subscriptions. O chamador decide quantos exibir (o cockpit corta em 5;
 * a Observabilidade pode mostrar todos).
 */
export function buildHealthAlerts(overview: HealthAlertInput, now: Date = new Date()): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  if (overview.openCriticalErrors24h > 0) {
    alerts.push({
      tone: "critical",
      title: `${overview.openCriticalErrors24h} erro(s) crítico(s) nas últimas 24h`,
      description:
        "Uma funcionalidade parou de funcionar para pelo menos um usuário. Abra a Observabilidade para ver o que é e investigar.",
      href: "/admin/observabilidade?severity=critical",
    });
  }

  if (!overview.lastCronRun) {
    alerts.push({
      tone: "critical",
      title: "O cron de notificações nunca rodou",
      description:
        "Nenhuma execução foi registrada ainda. Campanhas agendadas e lembretes automáticos não estão sendo processados.",
      href: "/admin/observabilidade",
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
        href: "/admin/observabilidade",
      });
    }
  }

  if (overview.campaignsFailed24h > 0) {
    alerts.push({
      tone: "critical",
      title: `${overview.campaignsFailed24h} campanha(s) de notificação falharam`,
      description:
        "Nenhum destinatário recebeu a campanha. Abra a campanha em Notificações para ver os destinatários afetados e decidir se vale reenviar.",
      href: "/admin/notificacoes",
    });
  }

  if (overview.campaignsPartial24h > 0) {
    alerts.push({
      tone: "warning",
      title: `${overview.campaignsPartial24h} campanha(s) entregaram só parcialmente`,
      description:
        "Parte dos destinatários não recebeu a notificação (geralmente push indisponível). A campanha já está marcada como parcialmente falha para revisão.",
      href: "/admin/notificacoes",
    });
  }

  if (overview.deliveriesRetry >= DELIVERIES_RETRY_BACKLOG_THRESHOLD) {
    alerts.push({
      tone: "warning",
      title: `${overview.deliveriesRetry} notificações acumuladas em nova tentativa`,
      description:
        "Falharam temporariamente (ex.: dispositivo momentaneamente indisponível) e serão tentadas novamente automaticamente. Um número alto pode indicar um problema maior no envio.",
      href: "/admin/notificacoes",
    });
  }

  if (overview.uploadsFailed24h > 0) {
    alerts.push({
      tone: "warning",
      title: `${overview.uploadsFailed24h} upload(s) falharam nas últimas 24h`,
      description:
        "Um envio de imagem (provavelmente uma Dica) não foi concluído. Veja Erros recentes (área Uploads) para saber qual admin foi afetado.",
      href: "/admin/observabilidade?area=uploads",
    });
  }

  if (overview.cardsFailed24h > 0) {
    alerts.push({
      tone: "warning",
      title: `${overview.cardsFailed24h} card(s) de compartilhamento falharam ao gerar`,
      description:
        "Algum usuário tentou compartilhar uma conquista ou progresso e a imagem não foi gerada. Veja Erros recentes (área Compartilhamentos) para detalhes.",
      href: "/admin/observabilidade?area=compartilhamentos",
    });
  }

  if (overview.onboardingStuck >= 5) {
    alerts.push({
      tone: "warning",
      title: `${overview.onboardingStuck} usuários presos no onboarding há mais de 48h`,
      description:
        "Criaram conta mas não concluíram o cadastro inicial. Pode ser um problema real no fluxo ou apenas pessoas que desistiram - vale uma checada.",
      href: "/admin/usuarios",
    });
  }

  if (overview.subscriptionsRevoked24h >= SUBSCRIPTIONS_REVOKED_ABNORMAL_THRESHOLD) {
    alerts.push({
      tone: "info",
      title: `${overview.subscriptionsRevoked24h} dispositivos pararam de aceitar push nas últimas 24h`,
      description:
        "Volume acima do normal de desinstalações ou permissões revogadas. As inscrições já foram revogadas automaticamente - vale só confirmar se não houve uma falha ampla de push.",
      href: "/admin/observabilidade",
    });
  }

  return alerts;
}

/**
 * Resumo textual de 1 frase para a primeira dobra do cockpit (Parte B) -
 * nunca alarmista quando não há impacto real (Parte L).
 */
export function describeOperationalSummary(
  status: "saudavel" | "atencao" | "degradado" | "critico",
  alerts: HealthAlert[],
): string {
  if (status === "saudavel" || alerts.length === 0) {
    return "Sistema saudável. Nenhum erro crítico nas últimas 24 horas.";
  }

  const [topAlert] = alerts;
  const suffix = alerts.length > 1 ? ` e mais ${alerts.length - 1} ponto(s)` : "";

  return `${topAlert!.title}${suffix} — vale uma checada.`;
}
