import { describe, expect, it } from "vitest";

import {
  ADMIN_ITEM,
  DESKTOP_SIDEBAR_GROUPS,
  DICAS_ITEM,
  EDITAR_PERFIL_ITEM,
  filterNavGroupsByRole,
  filterNavItemsByRole,
  isMaisActive,
  isMemberRouteActive,
  MORE_HUB_GROUPS,
  PRIMARY_MOBILE_ITEMS,
  SAIR_ITEM,
} from "./member-navigation.core";

describe("filterNavItemsByRole - real permission logic, not just a source-text regex", () => {
  it("drops adminOnly items for a regular user", () => {
    const items = [EDITAR_PERFIL_ITEM, ADMIN_ITEM, SAIR_ITEM];
    const filtered = filterNavItemsByRole(items, false);
    expect(filtered).toEqual([EDITAR_PERFIL_ITEM, SAIR_ITEM]);
  });

  it("keeps adminOnly items for an admin", () => {
    const items = [EDITAR_PERFIL_ITEM, ADMIN_ITEM, SAIR_ITEM];
    const filtered = filterNavItemsByRole(items, true);
    expect(filtered).toEqual(items);
  });
});

describe("filterNavGroupsByRole", () => {
  it("removes the Administração group entirely for a regular user - never an empty, confusing section", () => {
    const filtered = filterNavGroupsByRole(MORE_HUB_GROUPS, false);
    expect(filtered.some((group) => group.title === "Administração")).toBe(false);
  });

  it("keeps the Administração group, with ADMIN_ITEM inside, for an admin", () => {
    const filtered = filterNavGroupsByRole(MORE_HUB_GROUPS, true);
    const adminGroup = filtered.find((group) => group.title === "Administração");
    expect(adminGroup?.items).toEqual([ADMIN_ITEM]);
  });

  it("applies the same rule to the desktop sidebar groups - one rule, two surfaces", () => {
    const regularUserGroups = filterNavGroupsByRole(DESKTOP_SIDEBAR_GROUPS, false);
    expect(regularUserGroups.some((group) => group.title === "Administração")).toBe(false);

    const adminGroups = filterNavGroupsByRole(DESKTOP_SIDEBAR_GROUPS, true);
    const adminGroup = adminGroups.find((group) => group.title === "Administração");
    expect(adminGroup?.items).toEqual([ADMIN_ITEM]);
  });
});

describe("isMemberRouteActive - centralized route matching", () => {
  it("matches the exact route", () => {
    expect(isMemberRouteActive("/app/dashboard", "/app/dashboard")).toBe(true);
  });

  it("matches nested routes", () => {
    expect(isMemberRouteActive("/app/desafios/dieta-consciente", "/app/desafios")).toBe(true);
  });

  it("never matches a different route that merely shares a prefix string", () => {
    expect(isMemberRouteActive("/app/hojexyz", "/app/hoje")).toBe(false);
  });

  it("Dashboard never lights up on /app/perfil", () => {
    expect(isMemberRouteActive("/app/perfil", "/app/dashboard")).toBe(false);
  });

  it("Hoje never lights up on /app/jornada", () => {
    expect(isMemberRouteActive("/app/jornada", "/app/hoje")).toBe(false);
  });
});

describe("isMaisActive", () => {
  it("is active on every route that moved into the hub", () => {
    for (const route of [
      "/app/mais",
      "/app/dicas",
      "/app/dicas/algum-slug",
      "/app/conquistas",
      "/app/diario",
      "/app/configuracoes",
      "/app/configuracoes/notificacoes",
      "/app/feedback",
      "/app/feedback/meus",
      "/app/perfil/editar",
      "/app/notificacoes",
    ]) {
      expect(isMaisActive(route)).toBe(true);
    }
  });

  it("is never active on the 4 primary daily-use routes", () => {
    for (const item of PRIMARY_MOBILE_ITEMS) {
      expect(isMaisActive(item.href!)).toBe(false);
    }
  });
});

describe("DICAS_ITEM placement - desktop gets it directly, mobile only via Mais", () => {
  it("is part of DESKTOP_SIDEBAR_GROUPS' Principal group", () => {
    const principal = DESKTOP_SIDEBAR_GROUPS.find((group) => group.title === "Principal");
    expect(principal?.items).toContainEqual(DICAS_ITEM);
  });

  it("is never one of the 4 primary mobile items", () => {
    expect(PRIMARY_MOBILE_ITEMS).not.toContainEqual(DICAS_ITEM);
  });

  it("is inside MORE_HUB_GROUPS with its own description", () => {
    const evolucao = MORE_HUB_GROUPS.find((group) => group.title === "Minha evolução");
    const dicas = evolucao?.items.find((item) => item.href === "/app/dicas");
    expect(dicas?.description).toBe("Conteúdos para apoiar sua jornada.");
  });
});
