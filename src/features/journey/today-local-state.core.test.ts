import { describe, expect, it } from "vitest";

import {
  buildFinalizeResponses,
  buildInitialLocalState,
  countPendingHabits,
  hasUnsavedChanges,
  setHabitNote,
  setHabitStatus,
  toProgressInput,
  type SourceMission,
} from "./today-local-state.core";

function mission(overrides: Partial<SourceMission> & { habitId: string }): SourceMission {
  return {
    frequencyType: "daily",
    note: null,
    required: true,
    state: "pending",
    ...overrides,
  };
}

describe("buildInitialLocalState", () => {
  it("seeds pending for a habit with no prior log", () => {
    const state = buildInitialLocalState([mission({ habitId: "h1" })]);
    expect(state.h1).toEqual({
      frequencyType: "daily",
      note: "",
      required: true,
      status: "pending",
    });
  });

  it("carries over an already-completed habit and its note (old partially-saved days, or reopening the same session)", () => {
    const state = buildInitialLocalState([
      mission({ habitId: "h1", state: "completed", note: "fiz 30 min" }),
    ]);
    expect(state.h1?.status).toBe("completed");
    expect(state.h1?.note).toBe("fiz 30 min");
  });

  it("carries over not_applicable", () => {
    const state = buildInitialLocalState([
      mission({ habitId: "h1", state: "not_applicable", required: false }),
    ]);
    expect(state.h1?.status).toBe("not_applicable");
  });

  it("folds in_progress and skipped (legacy quantity value_json / unused status) into pending", () => {
    const state = buildInitialLocalState([
      mission({ habitId: "h1", state: "in_progress" }),
      mission({ habitId: "h2", state: "skipped" }),
    ]);
    expect(state.h1?.status).toBe("pending");
    expect(state.h2?.status).toBe("pending");
  });
});

describe("setHabitStatus", () => {
  it("updates the status of an existing habit", () => {
    const initial = buildInitialLocalState([mission({ habitId: "h1" })]);
    const next = setHabitStatus(initial, "h1", "completed");
    expect(next.h1?.status).toBe("completed");
  });

  it("is a no-op for an unknown habit id (never crashes on a stale reference)", () => {
    const initial = buildInitialLocalState([mission({ habitId: "h1" })]);
    const next = setHabitStatus(initial, "does-not-exist", "completed");
    expect(next).toBe(initial);
  });

  it("returns the same reference when the status doesn't actually change (cheap re-render guard)", () => {
    const initial = buildInitialLocalState([mission({ habitId: "h1" })]);
    const next = setHabitStatus(initial, "h1", "pending");
    expect(next).toBe(initial);
  });

  it("coerces not_applicable back to pending for a required habit - mirrors the server's own coercion", () => {
    const initial = buildInitialLocalState([mission({ habitId: "h1", required: true })]);
    const next = setHabitStatus(initial, "h1", "not_applicable");
    expect(next.h1?.status).toBe("pending");
  });

  it("allows not_applicable for a habit that isn't required", () => {
    const initial = buildInitialLocalState([mission({ habitId: "h1", required: false })]);
    const next = setHabitStatus(initial, "h1", "not_applicable");
    expect(next.h1?.status).toBe("not_applicable");
  });

  it("allows toggling to not_realized (the explicit 'não' answer, distinct from untouched pending)", () => {
    const initial = buildInitialLocalState([mission({ habitId: "h1" })]);
    const next = setHabitStatus(initial, "h1", "not_realized");
    expect(next.h1?.status).toBe("not_realized");
  });
});

describe("setHabitNote", () => {
  it("updates the note without touching status", () => {
    const initial = buildInitialLocalState([mission({ habitId: "h1", state: "completed" })]);
    const next = setHabitNote(initial, "h1", "nova nota");
    expect(next.h1?.note).toBe("nova nota");
    expect(next.h1?.status).toBe("completed");
  });

  it("is a no-op for an unknown habit id", () => {
    const initial = buildInitialLocalState([mission({ habitId: "h1" })]);
    expect(setHabitNote(initial, "ghost", "x")).toBe(initial);
  });
});

describe("hasUnsavedChanges", () => {
  it("is false right after seeding from the baseline", () => {
    const baseline = buildInitialLocalState([mission({ habitId: "h1" })]);
    expect(hasUnsavedChanges(baseline, baseline)).toBe(false);
  });

  it("is true after a status change", () => {
    const baseline = buildInitialLocalState([mission({ habitId: "h1" })]);
    const edited = setHabitStatus(baseline, "h1", "completed");
    expect(hasUnsavedChanges(edited, baseline)).toBe(true);
  });

  it("is true after a note change", () => {
    const baseline = buildInitialLocalState([mission({ habitId: "h1" })]);
    const edited = setHabitNote(baseline, "h1", "algo");
    expect(hasUnsavedChanges(edited, baseline)).toBe(true);
  });

  it("is false again after toggling back to the original value - no phantom warning", () => {
    const baseline = buildInitialLocalState([mission({ habitId: "h1" })]);
    const edited = setHabitStatus(baseline, "h1", "completed");
    const reverted = setHabitStatus(edited, "h1", "pending");
    expect(hasUnsavedChanges(reverted, baseline)).toBe(false);
  });
});

describe("countPendingHabits", () => {
  it("counts only genuinely untouched habits, not not_realized/not_applicable/completed", () => {
    let state = buildInitialLocalState([
      mission({ habitId: "h1" }),
      mission({ habitId: "h2" }),
      mission({ habitId: "h3" }),
      mission({ habitId: "h4", required: false }),
    ]);
    state = setHabitStatus(state, "h1", "completed");
    state = setHabitStatus(state, "h2", "not_realized");
    state = setHabitStatus(state, "h4", "not_applicable");
    // h3 stays pending
    expect(countPendingHabits(state)).toBe(1);
  });
});

describe("buildFinalizeResponses", () => {
  it("maps not_realized to pending in the wire payload - the RPC only knows completed/not_applicable/pending", () => {
    const state = setHabitStatus(buildInitialLocalState([mission({ habitId: "h1" })]), "h1", "not_realized");
    const payload = buildFinalizeResponses(state);
    expect(payload).toEqual([{ habit_id: "h1", note: null, status: "pending" }]);
  });

  it("trims whitespace-only notes down to null", () => {
    const state = setHabitNote(buildInitialLocalState([mission({ habitId: "h1" })]), "h1", "   ");
    expect(buildFinalizeResponses(state)[0]?.note).toBeNull();
  });

  it("preserves a real note alongside completed status", () => {
    let state = buildInitialLocalState([mission({ habitId: "h1" })]);
    state = setHabitStatus(state, "h1", "completed");
    state = setHabitNote(state, "h1", "fiz cedo");
    expect(buildFinalizeResponses(state)[0]).toEqual({
      habit_id: "h1",
      note: "fiz cedo",
      status: "completed",
    });
  });
});

describe("toProgressInput", () => {
  it("maps not_realized to pending status but keeps it touched", () => {
    const state = setHabitStatus(buildInitialLocalState([mission({ habitId: "h1" })]), "h1", "not_realized");
    expect(toProgressInput(state)).toEqual([
      { frequencyType: "daily", habitId: "h1", status: "pending", touched: true },
    ]);
  });

  it("marks a genuinely untouched habit as not touched", () => {
    const state = buildInitialLocalState([mission({ habitId: "h1" })]);
    expect(toProgressInput(state)[0]).toMatchObject({ status: "pending", touched: false });
  });

  it("treats a note-only habit (no status change yet) as touched", () => {
    const state = setHabitNote(buildInitialLocalState([mission({ habitId: "h1" })]), "h1", "algo");
    expect(toProgressInput(state)[0]).toMatchObject({ status: "pending", touched: true });
  });

  it("passes completed and not_applicable through unchanged", () => {
    let state = buildInitialLocalState([
      mission({ habitId: "h1" }),
      mission({ habitId: "h2", required: false }),
    ]);
    state = setHabitStatus(state, "h1", "completed");
    state = setHabitStatus(state, "h2", "not_applicable");
    const input = toProgressInput(state);
    expect(input.find((item) => item.habitId === "h1")).toMatchObject({ status: "completed", touched: true });
    expect(input.find((item) => item.habitId === "h2")).toMatchObject({
      status: "not_applicable",
      touched: true,
    });
  });
});
