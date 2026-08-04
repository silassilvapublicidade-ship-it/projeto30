import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "admin", "challenge-day-messages-editor.tsx"), "utf8");
}

describe("ChallengeDayMessagesEditor (Correções obrigatórias pré-lançamento, Parte D)", () => {
  const source = readSource();

  it("lists every day passed in, never a hardcoded subset", () => {
    expect(source).toContain("days.map((day) => (");
    expect(source).toContain("<DayMessageRow");
  });

  it("shows an empty state (never a broken/blank list) when no days exist yet", () => {
    expect(source).toContain("if (days.length === 0) {");
    expect(source).toContain("<EmptyState");
    expect(source).toContain("Gere a estrutura dos dias primeiro");
  });

  it("each row shows a clear content status - defined vs falling back to the default", () => {
    expect(source).toContain("Mensagem definida");
    expect(source).toContain("Usando padrão");
  });

  it("shows a simple preview of the saved message using the same visual language as the real mission card", () => {
    expect(source).toContain("<Sparkles");
    expect(source).toContain("italic leading-6 text-muted");
  });

  it("explains the fallback explicitly when a day has no message", () => {
    expect(source).toContain("mensagem motivacional padrão automaticamente");
    expect(source).toContain("Sem mensagem definida para este dia");
  });

  it("offers save, clear (with confirmation) and copy-to-range per day - never bulk-only or single-only", () => {
    expect(source).toContain("Salvar mensagem");
    expect(source).toContain("<ConfirmSubmitButton");
    expect(source).toContain("Limpar mensagem");
    expect(source).toContain("Duplicar para o intervalo");
  });

  it("the clear action reuses the same update action with an empty message, never a separate delete endpoint", () => {
    const clearFormStart = source.indexOf('input name="message" type="hidden" value=""');
    expect(clearFormStart).toBeGreaterThan(-1);
  });

  it("respects the shared max length constant, never a hardcoded number", () => {
    expect(source).toContain("maxLength={DAY_MESSAGE_MAX_LENGTH}");
  });

  it("never renders a free-form JSON textarea - the only text field is the plain message itself", () => {
    expect(source).not.toMatch(/JSON\.stringify|<textarea[^>]*name="config"/i);
  });
});
