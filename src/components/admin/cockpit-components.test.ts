import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(name: string) {
  return readFileSync(join(process.cwd(), "src", "components", "admin", name), "utf8");
}

describe("CockpitAlertList", () => {
  const source = readSource("cockpit-alert-list.tsx");

  it("shows the empty/healthy state text required by Parte L", () => {
    expect(source).toContain("Tudo funcionando normalmente. Nenhum ponto exige atenção agora.");
  });

  it("every alert can link to its detail page via href, never a dead-end card", () => {
    expect(source).toContain("alert.href");
    expect(source).toContain("Ver detalhes");
  });
});

describe("CockpitRecentActivity", () => {
  const source = readSource("cockpit-recent-activity.tsx");

  it("shows the 'sem dados' state text required by Parte L", () => {
    expect(source).toContain("Não há atividade registrada neste período.");
  });

  it("translates admin_audit_logs action codes via describeAuditAction instead of showing raw codes", () => {
    expect(source).toContain("describeAuditAction(item.label)");
  });

  it("each row can link out, and shows time/action/area/responsible when available", () => {
    expect(source).toContain("item.link");
    expect(source).toContain("formatDateTime(item.occurred_at)");
    expect(source).toContain("item.actor_name");
  });
});

describe("CockpitBlockCard", () => {
  const source = readSource("cockpit-block-card.tsx");

  it("always renders title, headline, description and a CTA link - matching Parte D's required shape", () => {
    expect(source).toContain("{title}");
    expect(source).toContain("{headline}");
    expect(source).toContain("{description}");
    expect(source).toContain("{ctaLabel}");
  });

  it("status badge is optional - only the Saúde block needs one", () => {
    expect(source).toContain("status?: CockpitBlockStatus");
    expect(source).toContain("{status ? <Badge");
  });
});

describe("CockpitPeriodTabs", () => {
  const source = readSource("cockpit-period-tabs.tsx");

  it("offers exactly the 3 periods required by Parte I, nothing more complex", () => {
    expect(source).toContain("COCKPIT_PERIODS.map");
  });

  it("marks the active period for accessibility", () => {
    expect(source).toContain('aria-current={period === current ? "page" : undefined}');
  });
});

describe("Admin nav order (Parte N)", () => {
  const source = readSource("admin-navigation.tsx");
  const navItemsBlock = source.slice(source.indexOf("const navItems = ["), source.indexOf("];", source.indexOf("const navItems = [")));

  it("orders items exactly: Visão geral, Desafios, Usuários, Dicas, Notificações, Compartilhamentos, Observabilidade, then the rest", () => {
    const hrefs = [...navItemsBlock.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs.slice(0, 7)).toEqual([
      "/admin",
      "/admin/desafios",
      "/admin/usuarios",
      "/admin/dicas",
      "/admin/notificacoes",
      "/admin/compartilhamentos",
      "/admin/observabilidade",
    ]);
  });
});
