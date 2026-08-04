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

  it("shows the general status banner first, matching the required first-fold order", () => {
    const bannerIndex = source.indexOf("<ObservabilityStatusBanner");
    const alertsIndex = source.indexOf("{alerts.length > 0");
    const notifSectionIndex = source.indexOf("Saúde das notificações");
    expect(bannerIndex).toBeGreaterThan(-1);
    expect(alertsIndex).toBeGreaterThan(bannerIndex);
    expect(notifSectionIndex).toBeGreaterThan(alertsIndex);
  });

  it("renders the notifications, cards, uploads and onboarding health sections", () => {
    expect(source).toContain("Saúde das notificações");
    expect(source).toContain("Saúde dos cards");
    expect(source).toContain("Uploads e onboarding");
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

  it("offers a 'copy version info' button in the version/deploy section", () => {
    expect(source).toContain('label="Copiar informações da versão"');
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
