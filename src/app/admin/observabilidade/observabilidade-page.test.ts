import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("/admin/observabilidade (overview)", () => {
  const source = readSource("src", "app", "admin", "observabilidade", "page.tsx");

  it("requires an admin session and reads the caller's role for redaction-aware rendering", () => {
    expect(source).toContain("const admin = await requireAdminUser();");
    expect(source).toContain('const isSuperAdmin = admin.role === "super_admin";');
  });

  it("is titled Central Operacional while keeping the /admin/observabilidade route", () => {
    expect(source).toContain("Central Operacional");
    expect(source).toContain("Saúde do sistema, alertas e diagnósticos em um só lugar.");
  });

  it("shows the status banner, then at most the single top-priority alert, before the executive summary", () => {
    const bannerIndex = source.indexOf("<ObservabilityStatusBanner");
    const topAlertIndex = source.indexOf("topAlert ?");
    const summaryIndex = source.indexOf("<CockpitBlockCard");
    expect(bannerIndex).toBeGreaterThan(-1);
    expect(topAlertIndex).toBeGreaterThan(bannerIndex);
    expect(summaryIndex).toBeGreaterThan(topAlertIndex);
  });

  it("never shows more than one alert prominently - the rest are just counted, never repeated as their own cards", () => {
    expect(source).toContain("const [topAlert] = alerts;");
    expect(source).toContain("outro(s) ponto(s) nas seções abaixo");
    expect(source).not.toMatch(/alerts\.map\(/);
  });

  it("renders the 4 executive summary cards (Sistema, Usuários, Notificações, Conteúdo)", () => {
    expect(source).toContain('title="Sistema"');
    expect(source).toContain('title="Usuários"');
    expect(source).toContain('title="Notificações"');
    expect(source).toContain('title="Conteúdo"');
  });

  it("groups notifications, sharing/uploads, users/onboarding and version into collapsible sections instead of ~16 separate metric cards", () => {
    expect(source).toContain("<ObservabilitySection");
    const sectionTitles = [...source.matchAll(/<ObservabilitySection[\s\S]*?title="([^"]+)"/g)].map((m) => m[1]);
    expect(sectionTitles).toEqual(
      expect.arrayContaining(["Notificações", "Compartilhamentos e uploads", "Usuários e onboarding", "Versão e deploy"]),
    );
  });

  it("never uses a CTA/action label as a metric value - the 'Ver Compartilhamentos' bug is gone", () => {
    expect(source).not.toContain('value="Ver Compartilhamentos"');
    expect(source).toContain("Auditoria de Storage: ainda não disponível");
  });

  it("does not fabricate a Storage-audit CTA that doesn't exist yet", () => {
    expect(source).not.toContain("Executar auditoria");
  });

  it("zero-value metrics render as reassuring text via StatLine, not a bare 0", () => {
    expect(source).toContain("Nenhuma campanha falhou");
    expect(source).toContain("Cards com falha: nenhum");
    expect(source).toContain("Uploads com falha: nenhum");
    expect(source).toContain("Nenhum onboarding pendente");
  });

  it("names onboarding as pending, never as 'preso'", () => {
    expect(source).not.toMatch(/preso/i);
    expect(source).toContain("pendente");
  });

  it("caps the default error list at 5 per the redesign, and hides the filter form entirely when there has never been an error", () => {
    expect(source).toContain("const PAGE_SIZE = 5;");
    expect(source).toContain("!hasEverHadErrors");
  });

  it("filters by area/severity/status via a GET form - server-side, paginated, never loading everything at once", () => {
    expect(source).toContain('method="get"');
    expect(source).toContain("listSystemErrorEvents({ area, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, severity, status })");
    expect(source).toContain("<AdminPagination");
  });

  it("only accepts filter values that are real enum members - never passes an arbitrary query string straight to the RPC", () => {
    expect(source).toContain("isSystemErrorArea(areaParam)");
    expect(source).toContain("SYSTEM_ERROR_SEVERITIES as readonly string[]).includes(severityParam)");
  });

  it("shows a restricted-view notice for non-super_admin instead of silently hiding what changed", () => {
    expect(source).toContain("!isSuperAdmin");
    expect(source).toContain("Visão limitada");
  });

  it("offers a 'copy version' button in the version/deploy section", () => {
    expect(source).toContain('label="Copiar versão"');
  });

  it("shows the version, environment, commit, service worker and last migration - all build-time/config data, never a CLI call", () => {
    expect(source).toContain("APP_VERSION");
    expect(source).toContain("deployInfo.environment");
    expect(source).toContain("deployInfo.commitShaShort");
    expect(source).toContain("SERVICE_WORKER_VERSION");
    expect(source).toContain("LATEST_MIGRATION_ID");
    expect(source).not.toMatch(/exec\(|execSync|child_process/);
  });
});

describe("/admin/observabilidade/[id] (detail + resolution)", () => {
  const source = readSource("src", "app", "admin", "observabilidade", "[id]", "page.tsx");

  it("requires an admin session and 404s on an unknown occurrence", () => {
    expect(source).toContain("const admin = await requireAdminUser();");
    expect(source).toContain("notFound();");
  });

  it("only renders the resolution form for super_admin", () => {
    const formIndex = source.indexOf("action={resolveSystemErrorEventAction}");
    expect(formIndex).toBeGreaterThan(-1);
    const guardIndex = source.lastIndexOf("isSuperAdmin ?", formIndex);
    expect(guardIndex).toBeGreaterThan(-1);
  });

  it("only shows user_id / postgres_code / metadata to super_admin", () => {
    expect(source).toContain("Usuário afetado (visível apenas para super administradores)");
    expect(source).toContain("event.metadata_safe");
  });

  it("offers the copy-diagnostic button built from the safe fields only", () => {
    expect(source).toContain("<CopyDiagnosticButton text={diagnosticText} />");
    expect(source).toContain("buildDiagnosticCopyText({");
  });

  it("the resolution form lets super_admin set status, a note and the fixing version - matching Parte N", () => {
    const formStart = source.indexOf("action={resolveSystemErrorEventAction}");
    const formEnd = source.indexOf("</form>", formStart);
    const form = source.slice(formStart, formEnd);
    expect(form).toContain('name="status"');
    expect(form).toContain('name="resolutionNote"');
    expect(form).toContain('name="resolvedInVersion"');
  });
});
