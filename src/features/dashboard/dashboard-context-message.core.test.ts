import { describe, expect, it } from "vitest";

import { resolveDashboardContextMessage, type ContextMessageInput } from "./dashboard-context-message.core";

const BASE: ContextMessageInput = {
  challengeDayMessage: null,
  closestLockedAchievement: null,
  currentDay: 10,
  dayOverDayMessage: null,
  daysFinalized: 5,
  daysRemainingInChallenge: 21,
  durationDays: 31,
  faithMessage: null,
  streakBest: 5,
  streakCurrent: 3,
  todayCompletionPercent: null,
  todayFinalized: false,
};

describe("resolveDashboardContextMessage - 10 prioridades exatas do briefing", () => {
  it("1) dia concluido 100% vence tudo o mais", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      streakCurrent: 5, // empataria com o recorde (tier 2) se nao fosse a prioridade 1
      todayCompletionPercent: 100,
      todayFinalized: true,
    });
    expect(result.category).toBe("day_completed");
    expect(result.text).toBe("Você concluiu tudo que estava disponível hoje.");
  });

  it("1b) dia concluido abaixo de 100% usa a copy honesta de 'cada acao contou'", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      todayCompletionPercent: 60,
      todayFinalized: true,
    });
    expect(result.text).toBe("Seu dia foi finalizado, e cada ação contou.");
  });

  it("2) novo recorde - sequencia atual empata o recorde (e nao ha dia finalizado hoje)", () => {
    const result = resolveDashboardContextMessage({ ...BASE, streakBest: 4, streakCurrent: 4 });
    expect(result.category).toBe("new_record");
  });

  it("nunca declara recorde quando streakCurrent e 0", () => {
    const result = resolveDashboardContextMessage({ ...BASE, streakBest: 0, streakCurrent: 0, daysFinalized: 0 });
    expect(result.category).not.toBe("new_record");
  });

  it("3) sequencia perto do recorde (gap de 1 ou 2)", () => {
    const result = resolveDashboardContextMessage({ ...BASE, streakBest: 5, streakCurrent: 4 });
    expect(result.category).toBe("close_to_record");
    expect(result.text).toBe("Falta 1 dia para igualar seu recorde.");
  });

  it("gap de sequencia maior que 2 nao aciona o tier 3", () => {
    const result = resolveDashboardContextMessage({ ...BASE, streakBest: 10, streakCurrent: 3, currentDay: null, durationDays: null, daysRemainingInChallenge: null });
    expect(result.category).not.toBe("close_to_record");
  });

  it("4) conquista proxima (gap de 1 ou 2), so quando nao ha sequencia mais prioritaria", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      closestLockedAchievement: { current: 5, name: "Sete leituras", target: 7 },
      streakBest: 10,
      streakCurrent: 3,
    });
    expect(result.category).toBe("close_to_achievement");
    expect(result.text).toBe("Mais 2 passos podem desbloquear uma nova conquista.");
  });

  it("5) metade do desafio - so no dia exato", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      currentDay: 16,
      daysRemainingInChallenge: 15,
      durationDays: 31,
      streakBest: 10,
      streakCurrent: 3,
    });
    expect(result.category).toBe("halfway");
  });

  it("6) ultimos dias - ate 7 dias restantes (fora do range de contagem exata, usa a copy de reta final)", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      currentDay: 28,
      daysRemainingInChallenge: 4,
      durationDays: 31,
      streakBest: 10,
      streakCurrent: 3,
    });
    expect(result.category).toBe("final_stretch");
    expect(result.text).toBe("Última semana. Continue firme.");
  });

  it("6b) ultimos dias - contagem exata quando restam 3 dias ou menos", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      currentDay: 29,
      daysRemainingInChallenge: 2,
      durationDays: 31,
      streakBest: 10,
      streakCurrent: 3,
    });
    expect(result.category).toBe("final_stretch");
    expect(result.text).toBe("Faltam 2 dias para concluir este ciclo.");
  });

  it("6c) ultimos dias - copy exclusiva para o dia final (1 dia restante)", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      currentDay: 30,
      daysRemainingInChallenge: 1,
      durationDays: 31,
      streakBest: 10,
      streakCurrent: 3,
    });
    expect(result.text).toBe("Último dia. Continue firme.");
  });

  it("7) evolucao vs ontem - so quando ha comparacao real e nada mais prioritario", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      currentDay: null,
      dayOverDayMessage: "Hoje você já fez mais que ontem.",
      daysRemainingInChallenge: null,
      durationDays: null,
      streakBest: 10,
      streakCurrent: 3,
    });
    expect(result.category).toBe("vs_yesterday");
  });

  it("8) mensagem especifica do dia", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      challengeDayMessage: "Hoje é sobre recomeçar com intenção.",
      currentDay: null,
      daysRemainingInChallenge: null,
      durationDays: null,
      streakBest: 10,
      streakCurrent: 3,
    });
    expect(result.category).toBe("day_message");
    expect(result.text).toBe("Hoje é sobre recomeçar com intenção.");
  });

  it("9) mensagem de fe - so quando nada mais prioritario existe", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      currentDay: null,
      daysRemainingInChallenge: null,
      durationDays: null,
      faithMessage: "Continue firme. Deus também trabalha no processo.",
      streakBest: 10,
      streakCurrent: 3,
    });
    expect(result.category).toBe("faith");
  });

  it("10) fallback com dias finalizados reais", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      currentDay: null,
      daysFinalized: 8,
      daysRemainingInChallenge: null,
      durationDays: null,
      streakBest: 10,
      streakCurrent: 3,
    });
    expect(result.category).toBe("fallback");
    expect(result.text).toBe("Você já concluiu 8 dias deste ciclo.");
  });

  it("10b) fallback honesto quando absolutamente nada esta disponivel", () => {
    const result = resolveDashboardContextMessage({
      challengeDayMessage: null,
      closestLockedAchievement: null,
      currentDay: null,
      dayOverDayMessage: null,
      daysFinalized: 0,
      daysRemainingInChallenge: null,
      durationDays: null,
      faithMessage: null,
      streakBest: 0,
      streakCurrent: 0,
      todayCompletionPercent: null,
      todayFinalized: false,
    });
    expect(result.text).toBe("Sua jornada está prestes a começar.");
  });

  it("nunca mostra duas mensagens - sempre exatamente uma categoria", () => {
    const result = resolveDashboardContextMessage({
      ...BASE,
      challengeDayMessage: "Mensagem do dia",
      dayOverDayMessage: "Comparação com ontem",
      faithMessage: "Mensagem de fé",
      todayFinalized: true,
    });
    expect(typeof result.category).toBe("string");
    expect(typeof result.text).toBe("string");
  });
});
