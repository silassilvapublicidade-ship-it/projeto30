import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

const coreSource = readSource("src", "features", "member", "member-navigation.core.ts");
const mobileSource = readSource("src", "components", "member", "member-navigation.tsx");
const sidebarSource = readSource("src", "components", "member", "member-sidebar.tsx");

describe("member-navigation.core.ts - single source of truth (Parte I)", () => {
  it("removes Leitura from the navigation entirely", () => {
    expect(coreSource).not.toContain("/app/leitura");
    expect(coreSource).not.toMatch(/label: "Leitura"/);
  });

  it("PRIMARY_MOBILE_ITEMS has exactly 4 daily-use items, in the exact order Dashboard, Hoje, Jornada, Desafios", () => {
    const block = coreSource.match(/export const PRIMARY_MOBILE_ITEMS[^;]*;/)?.[0] ?? "";
    expect(block).toContain("DASHBOARD_ITEM, HOJE_ITEM, JORNADA_ITEM, DESAFIOS_ITEM");
  });

  it("DESKTOP_SIDEBAR_GROUPS gives desktop direct access to everything - Dicas included in Principal, unlike mobile - and never links to /app/mais itself (Mais doesn't make sense on desktop)", () => {
    const block = coreSource.match(/export const DESKTOP_SIDEBAR_GROUPS[\s\S]*?\n\];/)?.[0] ?? "";
    expect(block).toContain("DASHBOARD_ITEM, HOJE_ITEM, DESAFIOS_ITEM, JORNADA_ITEM, DICAS_ITEM");
    expect(block).toContain('title: "Principal"');
    expect(block).toContain('title: "Minha evolução"');
    expect(block).toContain('title: "Suporte e conta"');
    expect(block).toContain('title: "Administração"');
    expect(block).toContain("CONQUISTAS_ITEM, DIARIO_ITEM");
    expect(block).toContain("FEEDBACK_ITEM, CONFIGURACOES_ITEM");
    expect(block).toContain("items: [ADMIN_ITEM]");
    expect(block).not.toContain("/app/mais");
  });

  it("drops Editar perfil, Notificações and Instalar aplicativo from the desktop groups - they already have their own entry point in the same sidebar (avatar block and bell icon) or aren't a desktop pattern", () => {
    const block = coreSource.match(/export const DESKTOP_SIDEBAR_GROUPS[\s\S]*?\n\];/)?.[0] ?? "";
    expect(block).not.toContain("EDITAR_PERFIL_ITEM");
    expect(block).not.toContain("NOTIFICACOES_ITEM");
    expect(block).not.toContain("INSTALAR_APP_ITEM");
    expect(block).not.toContain("SAIR_ITEM");
  });

  it("ADMIN_ITEM is flagged adminOnly and points to /admin - the one central permission rule both surfaces obey", () => {
    expect(coreSource).toContain("adminOnly: true");
    expect(coreSource).toContain('href: "/admin"');
  });

  it("MAIS_ACTIVE_PREFIXES lists every route that moved out of the primary mobile bar", () => {
    const block = coreSource.match(/export const MAIS_ACTIVE_PREFIXES = \[([\s\S]*?)\];/)?.[1] ?? "";
    for (const prefix of [
      "/app/mais",
      "/app/conquistas",
      "/app/diario",
      "/app/dicas",
      "/app/configuracoes",
      "/app/feedback",
      "/app/perfil",
      "/app/notificacoes",
    ]) {
      expect(block).toContain(prefix);
    }
  });

  it("isMemberRouteActive matches exact and nested routes, never a loose string prefix across different routes", () => {
    expect(coreSource).toContain(
      "return pathname === href || pathname.startsWith(`${href}/`);",
    );
  });

  it("filterNavItemsByRole/filterNavGroupsByRole centralize the permission rule - never a per-component isAdminRole check duplicated ad hoc", () => {
    expect(coreSource).toContain("export function filterNavItemsByRole");
    expect(coreSource).toContain("!item.adminOnly || isAdmin");
    expect(coreSource).toContain("export function filterNavGroupsByRole");
  });
});

describe("MemberMobileNavigation - exactly 5 touch targets (Parte C)", () => {
  it("renders PRIMARY_MOBILE_ITEMS (4) plus a 5th 'Mais' link - never a 6th item", () => {
    expect(mobileSource).toContain("PRIMARY_MOBILE_ITEMS.map((item)");
    expect(mobileSource).toContain('icon={MoreHorizontal}');
    expect(mobileSource).toContain('label="Mais"');
  });

  it("Mais shows a small badge (reusing the already-computed unread notification count, no new query) when there's something new to see", () => {
    expect(mobileSource).toContain("maisBadgeCount");
    expect(mobileSource).toContain("badgeCount={maisBadgeCount}");
    expect(mobileSource).toContain('badgeCount! > 9 ? "9+" : badgeCount');
  });

  it("never hardcodes Dicas, Conquistas, Diário, Configurações, Feedback or Notificações as their own tab - only PRIMARY_MOBILE_ITEMS + Mais are rendered", () => {
    for (const forbidden of ["/app/dicas", "/app/conquistas", "/app/diario", "/app/configuracoes", "/app/feedback", "/app/notificacoes"]) {
      expect(mobileSource).not.toContain(forbidden);
    }
  });

  it("Mais lights up via isMaisActive, imported from the central module - never a locally redefined rule", () => {
    expect(mobileSource).toContain('from "@/features/member/member-navigation.core"');
    expect(mobileSource).toContain("isMaisActive(pathname)");
  });

  it("every tab has aria-current when active and a minimum comfortable touch target (min-h-14 = 56px, well above 44px)", () => {
    expect(mobileSource).toContain('aria-current={active ? "page" : undefined}');
    expect(mobileSource).toContain("min-h-14");
  });

  it("labels never wrap or overflow - truncated within the tab", () => {
    expect(mobileSource).toContain("truncate");
  });

  it("stays inside the Safe Area via the shared safe-fixed-bottom utility, hidden on desktop (md:hidden)", () => {
    expect(mobileSource).toContain("safe-fixed-bottom");
    expect(mobileSource).toContain("md:hidden");
  });
});

describe("MemberDesktopSidebar - full, direct access (Parte B/L)", () => {
  it("reads DESKTOP_SIDEBAR_GROUPS from the central module and filters by role centrally", () => {
    expect(sidebarSource).toContain('from "@/features/member/member-navigation.core"');
    expect(sidebarSource).toContain("filterNavGroupsByRole(DESKTOP_SIDEBAR_GROUPS, isAdmin)");
  });

  it("renders group titles so the sections stay visually clear", () => {
    expect(sidebarSource).toContain("group.title");
  });

  it("special items (install-app, sign-out) render their real widget/form, never a dead <Link>", () => {
    expect(sidebarSource).toContain('item.special === "install-app"');
    expect(sidebarSource).toContain("<InstallAppPrompt");
    expect(sidebarSource).toContain('item.special === "sign-out"');
    expect(sidebarSource).toContain("<SignOutForm");
  });

  it("can scroll independently if the viewport is short - never clips Sair off-screen", () => {
    expect(sidebarSource).toContain("overflow-y-auto");
  });

  it("marks the active route via the same centralized isMemberRouteActive used everywhere else", () => {
    expect(sidebarSource).toContain("isMemberRouteActive(pathname, item.href!)");
  });

  it("visually emphasizes Dashboard and Hoje - the daily-use pair - inside their own sub-container, separate from the rest of Principal", () => {
    expect(sidebarSource).toContain('const isPrincipal = group.title === "Principal";');
    expect(sidebarSource).toContain("group.items.slice(0, 2)");
    expect(sidebarSource).toContain("group.items.slice(2)");
    expect(sidebarSource).toContain("emphasized");
  });

  it("never renders a 'Mais' link - on desktop it doesn't make sense, everything is already one click away", () => {
    expect(sidebarSource).not.toContain('href="/app/mais"');
    expect(sidebarSource).not.toContain("MoreHorizontal");
  });
});
