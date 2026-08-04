import { describe, expect, it } from "vitest";

import { resolveNextMilestone, type NextMilestoneInput } from "./dashboard-next-milestone.core";

const BASE: NextMilestoneInput = {
  applicableHabits: 5,
  closestLockedAchievement: null,
  completedHabits: 5,
  currentDay: 10,
  daysRemainingInChallenge: 21,
  durationDays: 31,
  streakBest: 3,
  streakCurrent: 3,
  todayFinalized: true,
};

describe("resolveNextMilestone - 7 prioridades do briefing (Parte C item 11)", () => {
  it("1) finalizar o dia vence tudo o resto quando o dia ainda nao terminou", () => {
    const result = resolveNextMilestone({ ...BASE, completedHabits: 2, streakBest: 10, todayFinalized: false });
    expect(result?.kind).toBe("finish_day");
    expect(result?.distance).toBe("2 de 5 hábitos concluídos hoje.");
    expect(result?.progress).toBeCloseTo(0.4);
  });

  it("dia sem habitos aplicaveis hoje nao aciona finish_day", () => {
    const result = resolveNextMilestone({ ...BASE, applicableHabits: 0, streakBest: 10, todayFinalized: false });
    expect(result?.kind).not.toBe("finish_day");
  });

  it("3) igualar o recorde quando ha gap real de sequencia", () => {
    const result = resolveNextMilestone({ ...BASE, streakBest: 5, streakCurrent: 4 });
    expect(result?.kind).toBe("tie_record");
    expect(result?.distance).toBe("Falta 1 dia para igualar seu recorde.");
  });

  it("sem gap de sequencia (streak ja no recorde) nao aciona tie_record", () => {
    const result = resolveNextMilestone({ ...BASE, closestLockedAchievement: null, currentDay: null, daysRemainingInChallenge: null, durationDays: null, streakBest: 3, streakCurrent: 3 });
    expect(result?.kind).not.toBe("tie_record");
  });

  it("4) desbloquear conquista mais proxima, so quando nao ha gap de sequencia", () => {
    const result = resolveNextMilestone({
      ...BASE,
      closestLockedAchievement: { current: 5, name: "Sete Leituras", target: 7 },
      currentDay: null,
      daysRemainingInChallenge: null,
      durationDays: null,
    });
    expect(result?.kind).toBe("unlock_achievement");
    expect(result?.distance).toBe("Mais 2 passos para desbloquear Sete Leituras.");
  });

  it("5) metade do ciclo, so quando nao ha marcos mais prioritarios", () => {
    const result = resolveNextMilestone({
      ...BASE,
      closestLockedAchievement: null,
      currentDay: 12,
      daysRemainingInChallenge: 19,
      durationDays: 31,
    });
    expect(result?.kind).toBe("reach_halfway");
    expect(result?.distance).toBe("Faltam 4 dias para chegar à metade do ciclo.");
  });

  it("6) ultima semana quando restam ate 7 dias e ja passou da metade", () => {
    const result = resolveNextMilestone({
      ...BASE,
      currentDay: 28,
      daysRemainingInChallenge: 3,
      durationDays: 31,
    });
    expect(result?.kind).toBe("final_week");
    expect(result?.distance).toBe("Faltam 3 dias para concluir este ciclo.");
  });

  it("7) concluir o desafio no ultimo dia exato", () => {
    const result = resolveNextMilestone({
      ...BASE,
      currentDay: 31,
      daysRemainingInChallenge: 0,
      durationDays: 31,
    });
    expect(result?.kind).toBe("complete_challenge");
  });

  it("retorna null quando nao ha nenhum marco com dado real por tras", () => {
    const result = resolveNextMilestone({
      applicableHabits: 0,
      closestLockedAchievement: null,
      completedHabits: 0,
      currentDay: null,
      daysRemainingInChallenge: null,
      durationDays: null,
      streakBest: 0,
      streakCurrent: 0,
      todayFinalized: true,
    });
    expect(result).toBeNull();
  });

  it("nunca retorna mais de um marco - sempre um objeto unico ou null", () => {
    const result = resolveNextMilestone({
      ...BASE,
      closestLockedAchievement: { current: 1, name: "X", target: 2 },
      streakBest: 5,
      streakCurrent: 4,
      todayFinalized: false,
    });
    expect(result).not.toBeNull();
    expect(typeof result?.kind).toBe("string");
  });
});
