import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("/app/mais - the definitive hub for everything that isn't daily-use", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "mais", "page.tsx");

  it("reuses getMemberContext() - no new query just to render this page (Parte P)", () => {
    expect(source).toContain("const context = await getMemberContext();");
    const otherDataCalls = source.match(/await get[A-Z]\w*\(/g) ?? [];
    expect(otherDataCalls).toEqual(["await getMemberContext("]);
  });

  it("renders the Conta group with Editar perfil, Configurações, Notificações, Enviar feedback and Meus feedbacks", () => {
    const contaBlock = source.match(/const contaItems: MaisItem\[\] = \[([\s\S]*?)\];/)?.[1] ?? "";
    expect(contaBlock).toContain('href: "/app/perfil/editar"');
    expect(contaBlock).toContain('href: "/app/configuracoes"');
    expect(contaBlock).toContain('href: "/app/notificacoes"');
    expect(contaBlock).toContain('href: "/app/feedback"');
    expect(contaBlock).toContain('label: "Enviar feedback"');
    expect(contaBlock).toContain('href: "/app/feedback/meus"');
    expect(contaBlock).toContain('label: "Meus feedbacks"');
  });

  it("renders the Minha evolução group with Conquistas, Diário and Dicas, each with the exact copy requested", () => {
    const evolucaoBlock = source.match(/const evolucaoItems: MaisItem\[\] = \[([\s\S]*?)\];/)?.[1] ?? "";
    expect(evolucaoBlock).toContain('href: "/app/conquistas"');
    expect(evolucaoBlock).toContain("Veja todos os marcos desbloqueados.");
    expect(evolucaoBlock).toContain('href: "/app/diario"');
    expect(evolucaoBlock).toContain("Relembre sua caminhada.");
    expect(evolucaoBlock).toContain('href: "/app/dicas"');
  });

  it("renders an Aplicativo group with install prompt, share button and help link", () => {
    expect(source).toContain("Aplicativo");
    expect(source).toContain("<InstallAppPrompt");
    expect(source).toContain("<ShareAppButton");
    expect(source).toContain('href="/faq"');
  });

  it("only shows Área administrativa to admins - regular users must never see it exists (Parte K)", () => {
    expect(source).toContain("const isAdmin = isAdminRole(context.profile.role);");
    expect(source).toContain("{isAdmin ? (");
    expect(source).toContain('href="/admin"');
  });

  it("always offers Sair independent of admin role", () => {
    const adminBlockEnd = source.indexOf(") : null}", source.indexOf("Área administrativa"));
    expect(source.slice(adminBlockEnd)).toContain("<SignOutForm");
  });

  it("renders the header with avatar, name, day/challenge context and an edit-profile button", () => {
    expect(source).toContain("<MaisHeader context={context} />");
  });
});

describe("MaisHeader - top section (Parte F)", () => {
  const source = readSource("src", "components", "member", "mais-header.tsx");

  it("shows avatar, name, admin badge and an Editar perfil button, with no new query", () => {
    expect(source).toContain("<MemberAvatar");
    expect(source).toContain("showRoleBadge");
    expect(source).toContain("<ProfileEditLink");
    expect(source).not.toMatch(/await get[A-Z]/);
  });
});

describe("MaisGroupCard - reusable, scalable building block (Parte E)", () => {
  const source = readSource("src", "components", "member", "mais-group-card.tsx");

  it("is a single card per group, not a flat giant list - the design explicitly asked against a giant list", () => {
    expect(source).toContain("<Card");
  });

  it("shows a description only when the item provides one - not forced on every row", () => {
    expect(source).toContain("{item.description ? <span");
  });

  it("has a discreet chevron and hover/touch feedback on every row", () => {
    expect(source).toContain("<ChevronRight");
    expect(source).toContain("hover:bg-white/[0.05]");
    expect(source).toContain("active:scale-[0.99]");
  });
});

describe("ShareAppButton", () => {
  const source = readSource("src", "components", "member", "share-app-button.tsx");

  it("tries the native Web Share API first, falls back to clipboard - never fails silently", () => {
    expect(source).toContain("navigator.share");
    expect(source).toContain("navigator.clipboard.writeText");
  });
});
