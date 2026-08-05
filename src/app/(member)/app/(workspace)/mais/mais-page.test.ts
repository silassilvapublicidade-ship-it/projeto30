import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("/app/mais - definitive secondary hub, reads the central nav definition", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "mais", "page.tsx");

  it("reuses getMemberContext() - no new query just to render this page (Parte O)", () => {
    expect(source).toContain("const context = await getMemberContext();");
    const otherDataCalls = source.match(/await get[A-Z]\w*\(/g) ?? [];
    expect(otherDataCalls).toEqual(["await getMemberContext("]);
  });

  it("reads MORE_HUB_GROUPS from the central navigation module - never a second, page-local array", () => {
    expect(source).toContain('from "@/features/member/member-navigation.core"');
    expect(source).toContain("MORE_HUB_GROUPS");
    expect(source).not.toMatch(/const \w+Items[:=]/);
  });

  it("filters groups by role centrally, same helper the sidebar uses", () => {
    expect(source).toContain("filterNavGroupsByRole(MORE_HUB_GROUPS, isAdmin)");
  });

  it("fires member_more_opened once per view, with no personal metadata (Parte Q)", () => {
    expect(source).toContain('recordAnalyticsEvent({ eventName: "member_more_opened", source: "server" });');
  });

  it("renders the header with avatar, name, day/challenge context and an edit-profile button", () => {
    expect(source).toContain("<MaisHeader context={context} />");
  });
});

describe("member-navigation.core.ts - MORE_HUB_GROUPS matches the exact structure and copy requested", () => {
  const source = readSource("src", "features", "member", "member-navigation.core.ts");

  it("Minha evolução: Dicas, Conquistas, Diário with the exact descriptions given", () => {
    const block = source.match(/export const MORE_HUB_GROUPS[\s\S]*?title: "Minha evolução",\s*\},/)?.[0] ?? "";
    expect(block).toContain("Conteúdos para apoiar sua jornada.");
    expect(block).toContain("Veja seus marcos e compartilhamentos.");
    expect(block).toContain("Relembre suas reflexões e registros.");
  });

  it("Suporte: Enviar feedback and Meus feedbacks with the exact descriptions given", () => {
    expect(source).toContain("Encontrou um problema ou teve uma ideia?");
    expect(source).toContain("Acompanhe seus relatos e respostas.");
  });

  it("Conta e preferências: Editar perfil, Configurações, Notificações with the exact descriptions given", () => {
    expect(source).toContain("Atualize sua foto e informações pessoais.");
    expect(source).toContain("Gerencie sua conta e preferências.");
    expect(source).toContain("Escolha quais lembretes deseja receber.");
  });

  it("Aplicativo has only Instalar Projeto 30, shown only when applicable (the widget itself decides visibility)", () => {
    const block = source.match(/\{ items: \[INSTALAR_APP_ITEM\], title: "Aplicativo" \}/);
    expect(block).not.toBeNull();
  });

  it("Área administrativa and Sessão are their own dedicated groups, not merged into one 'Sistema' group", () => {
    expect(source).toContain('{ items: [ADMIN_ITEM], title: "Área administrativa" }');
    expect(source).toContain('{ items: [SAIR_ITEM], title: "Sessão" }');
  });
});

describe("MaisHeader - top section", () => {
  const source = readSource("src", "components", "member", "mais-header.tsx");

  it("shows avatar, name, admin badge and an Editar perfil button, with no new query", () => {
    expect(source).toContain("<MemberAvatar");
    expect(source).toContain("showRoleBadge");
    expect(source).toContain("<ProfileEditLink");
    expect(source).not.toMatch(/await get[A-Z]/);
  });

  it("never shows the email as its own field - Parte E: 'não mostrar e-mail em destaque' (only used as a last-resort display-name fallback, same convention as ProfileHeader)", () => {
    expect(source).not.toMatch(/<[a-z]+[^>]*>\s*\{profile\.email\}/);
    expect(source).not.toContain("context.profile.email}</");
  });
});

describe("MaisGroupCard - reusable, scalable building block reading the central item shape (Parte E)", () => {
  const source = readSource("src", "components", "member", "mais-group-card.tsx");

  it("is a single card per group, not a flat giant list", () => {
    expect(source).toContain("<Card");
  });

  it("shows a description only when the item provides one - not forced on every row", () => {
    expect(source).toContain("{item.description ? <span");
  });

  it("has a discreet chevron and hover/touch feedback on every plain-link row", () => {
    expect(source).toContain("<ChevronRight");
    expect(source).toContain("hover:bg-white/[0.05]");
    expect(source).toContain("active:scale-[0.99]");
  });

  it("renders install-app and sign-out as their own special cases, never as a plain chevron link", () => {
    expect(source).toContain('item.special === "install-app"');
    expect(source).toContain('item.special === "sign-out"');
    expect(source).toContain("<InstallAppPrompt");
    expect(source).toContain("<SignOutForm");
  });
});
