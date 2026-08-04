import { describe, expect, it } from "vitest";

import {
  describeMissionCountdown,
  describeMissionState,
  describePointsContext,
  describeStreakContext,
} from "./dashboard-mission.core";

const BASE = {
  challengeStartDate: null as string | null,
  completionPercent: 0,
  journeyState: "day_available" as const,
  streakMinimumCompletion: 70,
  todayProgressState: "not_started" as const,
};

describe("describeMissionState - 8 estados do briefing", () => {
  it("desafio pausado - sem CTA, sem linguagem de culpa", () => {
    const result = describeMissionState({ ...BASE, journeyState: "cycle_paused" });
    expect(result.title).toBe("Este desafio está pausado.");
    expect(result.cta).toBeNull();
  });

  it("ciclo encerrado - CTA para a Jornada", () => {
    const result = describeMissionState({ ...BASE, journeyState: "cycle_ended" });
    expect(result.title).toBe("Este ciclo foi encerrado.");
    expect(result.cta).toEqual({ href: "/app/jornada", label: "Ver minha Jornada" });
  });

  it("desafio ainda nao comecou - mostra a data quando disponivel", () => {
    const result = describeMissionState({
      ...BASE,
      challengeStartDate: "2026-09-01",
      journeyState: "cycle_not_started",
    });
    expect(result.title).toBe("Este desafio começa em 01/09.");
    expect(result.cta).toBeNull();
  });

  it("desafio ainda nao comecou - fallback honesto sem data", () => {
    const result = describeMissionState({ ...BASE, journeyState: "cycle_not_started" });
    expect(result.title).toBe("Este desafio ainda não começou.");
  });

  it("dia nao iniciado - CTA Continuar meu dia", () => {
    const result = describeMissionState(BASE);
    expect(result.title).toBe("Seu dia está pronto para começar.");
    expect(result.cta).toEqual({ href: "/app/hoje", label: "Continuar meu dia" });
  });

  it("dia em andamento (touched, nada completo)", () => {
    const result = describeMissionState({ ...BASE, todayProgressState: "in_progress" });
    expect(result.title).toBe("Você já avançou hoje.");
  });

  it("dia parcial (alguns habitos completos, nao finalizado) usa a mesma copy de 'em andamento'", () => {
    const result = describeMissionState({ ...BASE, todayProgressState: "partial", completionPercent: 40 });
    expect(result.title).toBe("Você já avançou hoje.");
  });

  it("dia completo (100%, ainda nao finalizado) convida a finalizar", () => {
    const result = describeMissionState({ ...BASE, todayProgressState: "complete", completionPercent: 100 });
    expect(result.title).toBe("Você concluiu tudo que estava disponível hoje.");
    expect(result.cta).toEqual({ href: "/app/hoje", label: "Continuar meu dia" });
  });

  it("dia finalizado abaixo do minimo de streak - mensagem parcial, nunca de culpa", () => {
    const result = describeMissionState({
      ...BASE,
      completionPercent: 50,
      streakMinimumCompletion: 70,
      todayProgressState: "finalized",
    });
    expect(result.title).toBe("Dia finalizado. Cada ação contou.");
  });

  it("dia finalizado no minimo de streak ou acima - sequencia mantida", () => {
    const result = describeMissionState({
      ...BASE,
      completionPercent: 80,
      streakMinimumCompletion: 70,
      todayProgressState: "finalized",
    });
    expect(result.title).toBe("Dia finalizado e sequência mantida.");
  });

  it("dia finalizado 100% conta como sequencia mantida (>= minimo sempre)", () => {
    const result = describeMissionState({
      ...BASE,
      completionPercent: 100,
      streakMinimumCompletion: 70,
      todayProgressState: "finalized",
    });
    expect(result.title).toBe("Dia finalizado e sequência mantida.");
  });
});

describe("describeMissionCountdown", () => {
  it("nunca calcula para desafio inativo (pausado/encerrado/nao iniciado)", () => {
    expect(describeMissionCountdown({ currentDay: 5, durationDays: 31, isActive: false })).toBeNull();
  });

  it("ultimo dia", () => {
    expect(describeMissionCountdown({ currentDay: 31, durationDays: 31, isActive: true })).toBe(
      "Último dia. Continue firme.",
    );
  });

  it("faltam 3 dias ou menos - contagem explicita", () => {
    expect(describeMissionCountdown({ currentDay: 29, durationDays: 31, isActive: true })).toBe(
      "Faltam 3 dias para concluir este ciclo.",
    );
  });

  it("ultima semana (4 a 7 dias restantes)", () => {
    expect(describeMissionCountdown({ currentDay: 25, durationDays: 31, isActive: true })).toBe(
      "Última semana. Continue firme.",
    );
  });

  it("metade do desafio, fora da ultima semana", () => {
    expect(describeMissionCountdown({ currentDay: 16, durationDays: 31, isActive: true })).toBe(
      "Você chegou à metade do desafio.",
    );
  });

  it("nenhum marco relevante - retorna null (nunca uma contagem incorreta so para preencher espaco)", () => {
    expect(describeMissionCountdown({ currentDay: 10, durationDays: 31, isActive: true })).toBeNull();
  });

  it("nunca produz uma contagem negativa", () => {
    expect(describeMissionCountdown({ currentDay: 40, durationDays: 31, isActive: true })).toBeNull();
  });
});

describe("describePointsContext", () => {
  it("so mostra 'hoje'/'semana' quando o dado real e > 0 - nunca fabrica um zero", () => {
    const result = describePointsContext({ pointsThisWeek: null, pointsToday: null, pointsTotal: 390 });
    expect(result.totalLabel).toBe("390 pontos no total");
    expect(result.todayLabel).toBeNull();
    expect(result.weekLabel).toBeNull();
  });

  it("mostra +N hoje e +N nesta semana quando reais e positivos", () => {
    const result = describePointsContext({ pointsThisWeek: 160, pointsToday: 80, pointsTotal: 390 });
    expect(result.todayLabel).toBe("+80 hoje");
    expect(result.weekLabel).toBe("+160 nesta semana");
  });

  it("pontos hoje = 0 nao produz '+0 hoje'", () => {
    const result = describePointsContext({ pointsThisWeek: 0, pointsToday: 0, pointsTotal: 390 });
    expect(result.todayLabel).toBeNull();
    expect(result.weekLabel).toBeNull();
  });
});

describe("describeStreakContext", () => {
  it("mostra atual, recorde e a distancia para igualar", () => {
    const result = describeStreakContext({ streakBest: 7, streakCurrent: 3 });
    expect(result.currentLabel).toBe("Sequência atual: 3 dias.");
    expect(result.bestLabel).toBe("Seu recorde: 7 dias.");
    expect(result.gapMessage).toBe("Faltam 4 dias para igualar seu recorde.");
  });

  it("nunca mostra 'faltam 0 dias' quando ja esta no recorde", () => {
    const result = describeStreakContext({ streakBest: 5, streakCurrent: 5 });
    expect(result.gapMessage).toBeNull();
  });

  it("singular correto para 1 dia", () => {
    const result = describeStreakContext({ streakBest: 1, streakCurrent: 0 });
    expect(result.bestLabel).toBe("Seu recorde: 1 dia.");
    expect(result.gapMessage).toBe("Faltam 1 dia para igualar seu recorde.");
  });
});
