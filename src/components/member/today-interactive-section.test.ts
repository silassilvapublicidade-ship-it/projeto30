import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("TodayInteractiveSection - no per-click network call", () => {
  const source = readSource("src", "components", "member", "today-interactive-section.tsx");

  it("is a client component", () => {
    expect(source.trimStart().startsWith('"use client";')).toBe(true);
  });

  it("marking a habit only calls local setState, never a Server Action", () => {
    const missionRowStart = source.indexOf("function MissionRow(");
    const missionRowEnd = source.indexOf("function FinalizeSummaryPanel(");
    const missionRowBody = source.slice(missionRowStart, missionRowEnd);

    expect(missionRowBody).toContain("onClick={() => onStatusChange(");
    expect(missionRowBody).not.toContain("action={");
    expect(missionRowBody).not.toContain("finalizeDayWithResponsesAction");
  });

  it("the comment textarea updates local state on change, not on blur/submit to a server action", () => {
    expect(source).toContain("onChange={(event) => onNoteChange(event.target.value)}");
  });

  it("calls the batched finalize action exactly once, only from runFinalize", () => {
    const occurrences = source.split("finalizeDayWithResponsesAction(dailyLogId, responses)").length - 1;
    expect(occurrences).toBe(1);
  });

  it("the progress bar/habit counts are derived from local state via calculateDailyProgress, not server props", () => {
    expect(source).toContain("calculateDailyProgress({");
    expect(source).toContain("habits: toProgressInput(habitsState)");
  });
});

describe("TodayInteractiveSection - pending-habits confirmation flow", () => {
  const source = readSource("src", "components", "member", "today-interactive-section.tsx");

  it("opens the pending-habits modal instead of finalizing directly when any habit is still pending", () => {
    const submitHandler = source.slice(
      source.indexOf("function handleFinalizeSubmit"),
      source.indexOf("return (", source.indexOf("function handleFinalizeSubmit")),
    );
    expect(submitHandler).toContain("if (pendingCount > 0)");
    expect(submitHandler).toContain("setPendingModalOpen(true)");
    expect(submitHandler).toContain("return;");
  });

  it("uses the exact prescribed modal copy", () => {
    expect(source).toContain("Finalizar com hábitos pendentes?");
    expect(source).toContain(
      "Você ainda não respondeu todos os hábitos. Os itens pendentes serão registrados como não realizados e não gerarão pontuação.",
    );
    expect(source).toContain("Finalizar mesmo assim");
  });

  it("the modal's confirm action calls the same runFinalize used by the direct path - no separate code path that could diverge", () => {
    expect(source).toContain("formAction={() => runFinalize()}");
  });

  it("disables the finalize button only while the request is in flight, not while merely editing", () => {
    expect(source).toContain("disabled={!editable || isFinalizing}");
    expect(source).toContain("loading={isFinalizing}");
  });

  it("shows the exact prescribed button labels for each phase", () => {
    expect(source).toContain('"Dia finalizado" : isFinalizing ? "Finalizando..." : "Finalizar o dia"');
  });

  it("a failed finalize keeps local habit state intact and shows a retry-friendly error, never clears anything", () => {
    const runFinalizeBody = source.slice(
      source.indexOf("async function runFinalize"),
      source.indexOf("function handleFinalizeSubmit"),
    );
    expect(runFinalizeBody).not.toContain("setHabitsState(");
    expect(runFinalizeBody).toContain("setErrorMessage(result.message)");
  });
});

describe("TodayInteractiveSection - unsaved changes indicator and guard", () => {
  const source = readSource("src", "components", "member", "today-interactive-section.tsx");

  it("wires the exit guard with the prescribed warning copy", () => {
    expect(source).toContain("useUnsavedChangesGuard(");
    expect(source).toContain(
      "Você possui alterações que ainda não foram salvas. Finalize o dia ou continue editando.",
    );
  });

  it("shows the discreet inline reminder only while there are real unsaved changes", () => {
    expect(source).toContain("{unsaved ? (");
    expect(source).toContain("Alterações serão salvas ao finalizar o dia.");
  });

  it("never treats an already-finalized day as having unsaved changes", () => {
    expect(source).toContain("const editable = Boolean(dailyLogId) && !finalized;");
    expect(source).toContain("const unsaved = editable && hasUnsavedChanges(habitsState, baseline);");
  });
});

describe("TodayInteractiveSection - already-finalized day is read-only", () => {
  const source = readSource("src", "components", "member", "today-interactive-section.tsx");

  it("every interactive control is gated by the editable flag", () => {
    const missionRowStart = source.indexOf("function MissionRow(");
    const missionRowEnd = source.indexOf("function FinalizeSummaryPanel(");
    const missionRowBody = source.slice(missionRowStart, missionRowEnd);

    const disabledCount = (missionRowBody.match(/disabled=\{!editable\}/g) ?? []).length;
    expect(disabledCount).toBeGreaterThanOrEqual(4);
  });

  it("shows a summary panel (points, habit-by-habit results, finalized time) even when reopening an already-finalized day, not only right after finalizing", () => {
    expect(source).toContain("initialFinalized\n      ?");
    expect(source).toContain("justFinalized: false");
  });
});
