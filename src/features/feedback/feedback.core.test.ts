import { describe, expect, it } from "vitest";

import {
  categoriesForType,
  FEEDBACK_ATTACHMENT_PRIVACY_NOTICE,
  FEEDBACK_PRIVACY_NOTICE,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_SUBMITTED_MESSAGE,
  isFeedbackPriority,
  isFeedbackStatus,
  isFeedbackType,
  PROBLEM_CATEGORIES,
  SUGGESTION_CATEGORIES,
} from "./feedback.core";

describe("feedback type/category vocabulary", () => {
  it("only accepts the 3 defined feedback types - never an arbitrary string", () => {
    expect(isFeedbackType("problem")).toBe(true);
    expect(isFeedbackType("suggestion")).toBe(true);
    expect(isFeedbackType("rating")).toBe(true);
    expect(isFeedbackType("chat")).toBe(false);
  });

  it("categoriesForType maps 'problem' to the exact 7 sub-categories from the brief", () => {
    expect(categoriesForType("problem")).toEqual(PROBLEM_CATEGORIES);
    expect(PROBLEM_CATEGORIES).toEqual([
      "nao_funcionou",
      "erro_visual",
      "nao_salvou",
      "tela_nao_carregou",
      "notificacao",
      "compartilhamento",
      "outro",
    ]);
  });

  it("categoriesForType maps 'suggestion' to the exact 5 sub-categories from the brief", () => {
    expect(categoriesForType("suggestion")).toEqual(SUGGESTION_CATEGORIES);
    expect(SUGGESTION_CATEGORIES).toEqual(["melhoria", "conteudo", "facilidade_uso", "nova_ideia", "outro"]);
  });

  it("'rating' has no sub-category - sentiment covers it instead", () => {
    expect(categoriesForType("rating")).toEqual([]);
  });
});

describe("status/priority vocabulary", () => {
  it("status labels use the exact humanized wording given by the user", () => {
    expect(FEEDBACK_STATUS_LABELS).toEqual({
      new: "Novo",
      reviewing: "Em análise",
      planned: "Planejado",
      resolved: "Resolvido",
      closed: "Encerrado",
    });
  });

  it("isFeedbackStatus/isFeedbackPriority reject arbitrary values", () => {
    expect(isFeedbackStatus("new")).toBe(true);
    expect(isFeedbackStatus("archived")).toBe(false);
    expect(isFeedbackPriority("urgent")).toBe(true);
    expect(isFeedbackPriority("critical")).toBe(false);
  });
});

describe("required verbatim copy", () => {
  it("privacy notice matches the exact text required", () => {
    expect(FEEDBACK_PRIVACY_NOTICE).toBe(
      "Seu feedback será usado para melhorar a plataforma. Dados técnicos opcionais ajudam a identificar o problema e não incluem senha, diário ou conteúdo privado.",
    );
  });

  it("attachment privacy notice matches the exact text required", () => {
    expect(FEEDBACK_ATTACHMENT_PRIVACY_NOTICE).toBe(
      "Revise a imagem antes de enviar para garantir que ela não contenha informações pessoais.",
    );
  });

  it("submission confirmation matches the exact text required", () => {
    expect(FEEDBACK_SUBMITTED_MESSAGE).toBe("Obrigado por ajudar a melhorar o Projeto 30.");
  });
});
