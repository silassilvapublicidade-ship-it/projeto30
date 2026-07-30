import { describe, expect, it } from "vitest";

import { getSafeJourneyErrorMessage } from "./journey-rpc-error.core";

describe("getSafeJourneyErrorMessage", () => {
  it("maps P0005 (challenge not started yet) to a distinct, user-facing message", () => {
    const message = getSafeJourneyErrorMessage({ code: "P0005", message: "raw db message" });
    expect(message).toBe("Este desafio ainda nao comecou oficialmente.");
  });

  it("keeps P0002/P0003/22023/42501 mapped to their own distinct messages", () => {
    const codes = ["P0002", "P0003", "22023", "42501"] as const;
    const messages = codes.map((code) => getSafeJourneyErrorMessage({ code, message: "x" }));

    expect(new Set(messages).size).toBe(codes.length);
  });

  it("falls back to a generic message for unmapped codes", () => {
    expect(getSafeJourneyErrorMessage({ code: "99999", message: "x" })).toBe(
      "Nao foi possivel salvar agora. Tente novamente em instantes.",
    );
  });

  it("handles a null error", () => {
    expect(getSafeJourneyErrorMessage(null)).toBe("Nao foi possivel concluir a acao agora.");
  });
});
