import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("root cause: /app/configuracoes was the only place with a feedback link, and it was unreachable on mobile", () => {
  it("MemberMobileNavigation only ever renders mainItems, never secondaryItems - Configuracoes (where the old feedback link lived) was never reachable from the mobile bottom nav", () => {
    const source = readSource("src", "components", "member", "member-navigation.tsx");
    const mobileBody = source.slice(source.indexOf("export function MemberMobileNavigation"));
    expect(mobileBody).toContain("mainItems.map((item)");
    expect(mobileBody).not.toContain("secondaryItems");
  });

  it("still never adds Feedback to the primary bottom navigation - the fix is Dashboard + Configuracoes + error boundary, not a new tab", () => {
    const source = readSource("src", "components", "member", "member-navigation.tsx");
    expect(source).not.toMatch(/label: "Feedback"/);
  });
});

describe("fix: /app/configuracoes now has a titled, two-item help section", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "configuracoes", "page.tsx");

  it("has a visible section title, not buried at the end of the page without one", () => {
    expect(source).toContain("A ajuda do Projeto 30");
  });

  it("links to both /app/feedback (Enviar feedback) and /app/feedback/meus (Meus feedbacks) with the requested copy", () => {
    expect(source).toContain('href="/app/feedback"');
    expect(source).toContain("Encontrou um problema ou tem uma sugestão? Conte para nós.");
    expect(source).toContain('href="/app/feedback/meus"');
    expect(source).toContain("Acompanhe seus relatos e veja as respostas recebidas.");
  });
});

describe("fix: /app/feedback/meus empty state has a first-time CTA", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "feedback", "meus", "page.tsx");

  it("shows the exact empty-state copy and a CTA that leads straight to the form", () => {
    expect(source).toContain("Você ainda não enviou nenhum feedback.");
    expect(source).toContain("Enviar meu primeiro feedback");
  });
});

describe("fix: the success state after submitting links to Meus feedbacks, not just text mentioning it", () => {
  const source = readSource("src", "components", "member", "feedback-form.tsx");

  it("renders a real link/button to /app/feedback/meus after a successful submission", () => {
    const successBlockStart = source.indexOf("if (state.ok)");
    const successBlock = source.slice(successBlockStart, source.indexOf("}", source.indexOf("return (", successBlockStart)) + 400);
    expect(successBlock).toContain('href="/app/feedback/meus"');
  });
});

describe("error boundary still offers 'Relatar este problema' with the diagnostic code auto-filled", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "error.tsx");

  it("links to /app/feedback with the diagnostic code and route as query params, never a stack trace", () => {
    expect(source).toContain("Relatar este problema");
    expect(source).toContain("/app/feedback?tipo=problem");
    expect(source).toContain("diagnosticCode");
    expect(source).not.toContain("error.stack");
  });
});
