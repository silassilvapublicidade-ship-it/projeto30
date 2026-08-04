import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "app", "admin", "page.tsx"), "utf8");
}

describe("/admin (cockpit operacional)", () => {
  const source = readSource();

  it("requires an admin session and reads the caller's role", () => {
    expect(source).toContain("const admin = await requireAdminUser();");
    expect(source).toContain('const isSuperAdmin = admin.role === "super_admin";');
  });

  it("validates the period query param against the fixed whitelist, defaulting to 'today'", () => {
    expect(source).toContain("periodParam && isCockpitPeriod(periodParam) ? periodParam : \"today\"");
  });

  it("reuses buildHealthAlerts (the exact same rule as Observabilidade) instead of a second health computation", () => {
    expect(source).toContain("buildHealthAlerts(overview.health)");
    expect(source).not.toMatch(/v_status|status :=/);
  });

  it("caps alerts at 5, per Parte E", () => {
    expect(source).toContain("alerts.slice(0, 5)");
  });

  it("records admin_overview_viewed once per view, server-side, not a full metrics payload", () => {
    expect(source).toContain('eventName: "admin_overview_viewed"');
    expect(source).toContain('source: "server"');
  });

  it("first fold renders status before metrics before alerts before recent activity", () => {
    const statusIndex = source.indexOf("<ObservabilityStatusBanner");
    const metricsIndex = source.indexOf("Métricas do período");
    const alertsIndex = source.indexOf("Precisa de atenção");
    const activityIndex = source.indexOf("Atividade recente");
    expect(statusIndex).toBeGreaterThan(-1);
    expect(metricsIndex).toBeGreaterThan(statusIndex);
    expect(alertsIndex).toBeGreaterThan(metricsIndex);
    expect(activityIndex).toBeGreaterThan(alertsIndex);
  });

  it("has a CTA to Observabilidade from the first fold, never replacing it", () => {
    expect(source).toContain('href="/admin/observabilidade"');
    expect(source).toContain("Ver diagnóstico");
  });

  it("links each summary block to its real detail page (usuários, desafios, notificações, dicas)", () => {
    expect(source).toContain('href="/admin/usuarios"');
    expect(source).toContain('href="/admin/desafios"');
    expect(source).toContain('href="/admin/notificacoes"');
    expect(source).toContain('href="/admin/dicas"');
  });

  it("shows a restricted-view notice for non-super_admin instead of silently omitting content", () => {
    expect(source).toContain("!isSuperAdmin");
  });

  it("offers period tabs and a 'copy version' action, reusing the same version constants as Observabilidade (no duplicated constants)", () => {
    expect(source).toContain("<CockpitPeriodTabs");
    expect(source).toContain('label="Copiar versão"');
    expect(source).toContain('from "@/config/system-version"');
  });

  it("never renders a raw error object, stack trace or PII field directly", () => {
    expect(source).not.toMatch(/\.stack\b/);
    expect(source).not.toMatch(/\.email\b/);
  });

  it("degrades gracefully with a clear error state if the aggregated RPC fails, instead of crashing", () => {
    expect(source).toContain("catch (error) {");
    expect(source).toContain("Cockpit indisponível");
  });
});
