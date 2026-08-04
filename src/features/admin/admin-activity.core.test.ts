import { describe, expect, it } from "vitest";

import {
  COCKPIT_PERIODS,
  describeActivityCategory,
  describeAuditAction,
  isCockpitPeriod,
} from "./admin-activity.core";

describe("describeAuditAction", () => {
  it("translates known audit actions into a human label", () => {
    expect(describeAuditAction("admin_create_user")).toBe("Usuário criado");
    expect(describeAuditAction("admin_pause_challenge")).toBe("Desafio pausado");
    expect(describeAuditAction("admin_resolve_system_error_event")).toBe("Ocorrência atualizada");
  });

  it("never hides an unmapped action - falls back to a readable version instead of throwing or returning empty", () => {
    const result = describeAuditAction("admin_some_new_unmapped_action");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain("_");
  });
});

describe("describeActivityCategory", () => {
  it("translates known categories", () => {
    expect(describeActivityCategory("admin")).toBe("Admin");
    expect(describeActivityCategory("notificacoes")).toBe("Notificações");
    expect(describeActivityCategory("observabilidade")).toBe("Observabilidade");
  });
});

describe("isCockpitPeriod / COCKPIT_PERIODS", () => {
  it("accepts exactly today/24h/7d - the 3 periods the brief asks for, no more", () => {
    expect(COCKPIT_PERIODS).toEqual(["today", "24h", "7d"]);
    for (const period of COCKPIT_PERIODS) {
      expect(isCockpitPeriod(period)).toBe(true);
    }
  });

  it("rejects an arbitrary query string value", () => {
    expect(isCockpitPeriod("30d")).toBe(false);
    expect(isCockpitPeriod("")).toBe(false);
    expect(isCockpitPeriod("<script>")).toBe(false);
  });
});
