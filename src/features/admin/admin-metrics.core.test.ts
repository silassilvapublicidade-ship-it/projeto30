import { describe, expect, it } from "vitest";

import {
  canViewReflections,
  describeActivity,
  describeChallengeStatus,
  describeEnrollmentStatus,
  formatChallengePeriod,
  formatCount,
  formatDate,
  formatPercent,
  formatPoints,
} from "./admin-metrics.core";

describe("canViewReflections", () => {
  it("only allows super_admin to see reflections", () => {
    expect(canViewReflections("super_admin")).toBe(true);
    expect(canViewReflections("admin")).toBe(false);
    expect(canViewReflections("moderator")).toBe(false);
    expect(canViewReflections("user")).toBe(false);
  });
});

describe("status labels", () => {
  it("describes every challenge status in Portuguese", () => {
    expect(describeChallengeStatus("draft")).toBe("Rascunho");
    expect(describeChallengeStatus("active")).toBe("Ativo");
    expect(describeChallengeStatus("paused")).toBe("Pausado");
    expect(describeChallengeStatus("ended")).toBe("Encerrado");
    expect(describeChallengeStatus("archived")).toBe("Arquivado");
  });

  it("describes every enrollment status in Portuguese", () => {
    expect(describeEnrollmentStatus("active")).toBe("Ativo");
    expect(describeEnrollmentStatus("paused")).toBe("Pausado");
    expect(describeEnrollmentStatus("completed")).toBe("Concluído");
    expect(describeEnrollmentStatus("abandoned")).toBe("Abandonado");
    expect(describeEnrollmentStatus("restarted")).toBe("Reiniciado");
  });

  it("describes participant activity buckets", () => {
    expect(describeActivity("active")).toBe("Ativo");
    expect(describeActivity("inactive")).toBe("Inativo");
    expect(describeActivity("completed")).toBe("Concluiu");
  });

  it("falls back to the raw value for an unknown activity bucket", () => {
    expect(describeActivity("mystery")).toBe("mystery");
  });
});

describe("number formatting", () => {
  it("rounds and appends a percent sign", () => {
    expect(formatPercent(42.6)).toBe("43%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(null)).toBe("0%");
    expect(formatPercent(undefined)).toBe("0%");
  });

  it("formats counts and points with pt-BR grouping", () => {
    expect(formatCount(1000)).toBe("1.000");
    expect(formatPoints(2500)).toBe("2.500");
    expect(formatCount(null)).toBe("0");
  });
});

describe("date formatting", () => {
  it("formats an ISO date as dd/mm/yyyy", () => {
    expect(formatDate("2026-08-01T00:00:00.000Z")).toBe("01/08/2026");
  });

  it("returns an em dash for missing or invalid dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("builds a period label from start and end dates", () => {
    expect(formatChallengePeriod("2026-08-01", "2026-08-30")).toBe(
      "01/08/2026 — 30/08/2026",
    );
  });

  it("reports when no period is configured", () => {
    expect(formatChallengePeriod(null, null)).toBe("Sem data definida");
  });
});
