import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("admin challenge deletion - actions", () => {
  const source = readSource("src", "features", "admin", "admin-challenges.actions.ts");

  it("requires an admin before attempting to delete", () => {
    const deleteActionStart = source.indexOf("export async function deleteChallengeAction");
    const deleteActionBody = source.slice(deleteActionStart, deleteActionStart + 400);
    expect(deleteActionBody).toContain("await requireAdminUser();");
  });

  it("performs a real delete against public.challenges, not a soft status change", () => {
    expect(source).toContain('supabase.from("challenges").delete().eq("id", parsedId.data)');
  });

  it("treats a foreign_key_violation (23503) as 'has history, cannot delete' rather than a generic error", () => {
    expect(source).toContain('error.code === "23503"');
    expect(source).toContain('"delete-blocked"');
  });
});

describe("admin challenge deletion - list page wiring", () => {
  const source = readSource("src", "app", "admin", "desafios", "page.tsx");

  it("delegates every row's actions (including delete) to the consolidated ChallengeRowActions menu", () => {
    expect(source).toContain("<ChallengeRowActions");
    expect(source).toContain("participantCount={challenge.participant_count}");
    // The old flat per-status button row (and its window.confirm-based
    // delete button) must not come back - status-conditional rendering now
    // lives inside ChallengeRowActions, not in this page.
    expect(source).not.toContain("DeleteChallengeButton");
    expect(source).not.toContain("ConfirmSubmitButton");
  });

  it("surfaces a 'cannot delete' explanation distinct from a generic error", () => {
    expect(source).toContain('"delete-blocked"');
    expect(source).toContain(
      "Este desafio possui participantes ou histórico e não pode ser excluído. Utilize Arquivar.",
    );
  });
});

describe("admin challenge deletion - row action gating (ChallengeRowActions)", () => {
  const source = readSource("src", "components", "admin", "challenge-row-actions.tsx");

  // Regression: the previous version gated Excluir on
  // `status === "draft" && participantCount === 0`, which is exactly why
  // "Excluir" never appeared for an archived, zero-participant challenge
  // like "Projeto 30 - Validacao Interna" even though the business rule
  // (zero real history) allowed it. The fix drops the status condition -
  // canDelete is participantCount === 0 alone, in ANY status.
  it("allows deletion in any status once participantCount is zero (the fixed bug)", () => {
    expect(source).toContain("const canDelete = participantCount === 0;");
    expect(source).not.toContain('status === "draft" && participantCount === 0');
  });

  it("never renders Excluir for a challenge with any participant, regardless of status", () => {
    const canDeleteIndex = source.indexOf("canDelete");
    expect(canDeleteIndex).toBeGreaterThan(-1);
    // canDelete is the single gate for both the menu item and the dialog -
    // there must be no second, independent "show delete" condition that
    // could disagree with it.
    expect(source.match(/canDelete/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("gates permanent purge to super_admin, is_test challenges, archived status only", () => {
    expect(source).toContain(
      'const canPurge = isSuperAdmin && isTest && status === "archived";',
    );
  });

  it("renders Ver detalhes for every status (draft included)", () => {
    const menuStart = source.indexOf("<DropdownMenu label=");
    const menuBlock = source.slice(menuStart, menuStart + 400);
    expect(menuBlock).toContain(
      '<DropdownMenuItem href={`/admin/desafios/${challengeId}`}>Ver detalhes</DropdownMenuItem>',
    );
  });

  it("renders Editar only for draft/active, and Arquivar only for active/ended", () => {
    expect(source).toContain('status === "draft" || status === "active" ?');
    expect(source).toContain('status === "active" || status === "ended" ?');
  });

  it("always renders Duplicar regardless of status", () => {
    const duplicateIndex = source.indexOf("duplicateChallengeAsDraftAction");
    expect(duplicateIndex).toBeGreaterThan(-1);
    // Unlike Editar/Publicar/Arquivar, Duplicar's ActionForm is not wrapped
    // in a status condition.
    const before = source.slice(Math.max(0, duplicateIndex - 200), duplicateIndex);
    expect(before).not.toMatch(/status === "\w+"\s*\?\s*\($/);
  });

  it("shows a visual separator before any destructive action", () => {
    expect(source).toContain("const showDestructiveSeparator = canDelete || canPurge;");
    expect(source).toContain("{showDestructiveSeparator ? <DropdownMenuSeparator /> : null}");
  });

  it("styles Excluir as danger and Excluir permanentemente as critical", () => {
    const deleteItemIndex = source.indexOf("Excluir</DropdownMenuItem");
    expect(deleteItemIndex).toBe(-1); // rendered as children text, not inline closing tag
    expect(source).toContain('tone="danger"');
    expect(source).toContain('tone="critical"');
  });

  it("closes the menu when a status-transition form is submitted", () => {
    expect(source).toContain('<form action={action} onSubmit={close}>');
  });
});

describe("admin challenge deletion - permanent purge of test challenges", () => {
  const migrationSource = readSource(
    "supabase",
    "migrations",
    "0022_test_challenge_purge.sql",
  );
  const actionsSource = readSource("src", "features", "admin", "admin-challenges.actions.ts");
  const dialogSource = readSource(
    "src",
    "components",
    "admin",
    "purge-test-challenge-dialog.tsx",
  );

  it("adds an explicit is_test marker instead of inferring test data from archived status", () => {
    expect(migrationSource).toContain(
      "add column if not exists is_test boolean not null default false;",
    );
  });

  it("marks only the internal validation challenge as is_test, never touching other rows", () => {
    expect(migrationSource).toContain("where slug = 'projeto-30-validacao-interna';");
  });

  it("requires super_admin specifically, not just admin, inside the RPC", () => {
    expect(migrationSource).toContain("public.admin_require_super_admin();");
    expect(migrationSource).toContain("v_current_role <> 'super_admin'");
  });

  it("blocks the purge unless the challenge is explicitly marked is_test", () => {
    expect(migrationSource).toContain("if v_challenge.is_test is not true then");
  });

  it("validates both the exact challenge name and the exact confirmation phrase", () => {
    expect(migrationSource).toContain("if confirmation_phrase is distinct from 'EXCLUIR PERMANENTEMENTE' then");
    expect(migrationSource).toContain("if v_challenge.name is distinct from confirmation_name then");
  });

  it("locks the challenge row before deleting, to avoid a race with a fresh enrollment", () => {
    expect(migrationSource).toContain("where id = target_challenge_id\n  for update;");
  });

  it("removes restrict-constrained children before their parent in every case", () => {
    const deleteOrder = migrationSource.indexOf("delete from public.analytics_events");
    const habitLogsIndex = migrationSource.indexOf("delete from public.habit_logs", deleteOrder);
    const dayHabitsIndex = migrationSource.indexOf(
      "delete from public.challenge_day_habits",
      deleteOrder,
    );
    const dailyLogsIndex = migrationSource.indexOf("delete from public.daily_logs", deleteOrder);
    const daysIndex = migrationSource.indexOf("delete from public.challenge_days", deleteOrder);
    const enrollmentsIndex = migrationSource.indexOf(
      "delete from public.challenge_enrollments",
      deleteOrder,
    );
    const challengeIndex = migrationSource.indexOf("delete from public.challenges", deleteOrder);

    // habit_logs -> challenge_day_habits (restrict): habit_logs first.
    expect(habitLogsIndex).toBeLessThan(dayHabitsIndex);
    // daily_logs -> challenge_days (restrict): daily_logs first.
    expect(dailyLogsIndex).toBeLessThan(daysIndex);
    // challenge_enrollments -> challenges (restrict): enrollments first.
    expect(enrollmentsIndex).toBeLessThan(challengeIndex);
  });

  it("writes to admin_audit_logs before returning", () => {
    expect(migrationSource).toContain("insert into public.admin_audit_logs");
    expect(migrationSource).toContain("'admin_delete_test_challenge_permanently'");
  });

  it("revokes public/anon/authenticated execute by default and grants only to authenticated", () => {
    expect(migrationSource).toContain(
      "revoke execute on function public.admin_delete_test_challenge_permanently(uuid, text, text)\n  from public, anon, authenticated;",
    );
    expect(migrationSource).toContain(
      "grant execute on function public.admin_delete_test_challenge_permanently(uuid, text, text)\n  to authenticated;",
    );
  });

  it("the server action forwards confirmation fields without inventing its own authorization", () => {
    const actionStart = actionsSource.indexOf("export async function purgeTestChallengeAction");
    const actionBody = actionsSource.slice(actionStart, actionStart + 900);
    expect(actionBody).toContain('rpc("admin_delete_test_challenge_permanently"');
    expect(actionBody).toContain("confirmation_name: confirmationName");
    expect(actionBody).toContain("confirmation_phrase: confirmationPhrase");
  });

  it("the dialog requires the exact phrase EXCLUIR PERMANENTEMENTE in addition to the challenge name", () => {
    expect(dialogSource).toContain('const REQUIRED_PHRASE = "EXCLUIR PERMANENTEMENTE";');
    expect(dialogSource).toContain(
      "typedName !== challengeName || typedPhrase !== REQUIRED_PHRASE || !preview?.ok",
    );
  });

  it("fetches real server-computed counts before allowing confirmation, never trusting the row already on screen", () => {
    expect(dialogSource).toContain("getTestChallengePurgePreviewAction(challengeId)");
  });
});

describe("admin challenge deletion - confirmation UX (DeleteChallengeDialog)", () => {
  const source = readSource("src", "components", "admin", "delete-challenge-dialog.tsx");

  it("uses a real modal (ConfirmDialog), not window.confirm/window.prompt", () => {
    expect(source).toContain("ConfirmDialog");
    expect(source).not.toContain("window.confirm(");
    expect(source).not.toContain("window.prompt(");
  });

  it("shows the exact required warning text", () => {
    expect(source).toContain("Esta ação excluirá definitivamente este desafio.");
  });

  it("keeps the destructive submit disabled until the typed name matches exactly", () => {
    expect(source).toContain("confirmDisabled={typedName !== challengeName}");
  });

  it("resets the typed name when the dialog is closed, so a stale match can't linger for next time", () => {
    expect(source).toContain("setTypedName(\"\")");
  });
});

describe("admin challenge deletion - ConfirmDialog gating primitive", () => {
  const source = readSource("src", "components", "ui", "confirm-dialog.tsx");

  it("disables the submit button when confirmDisabled is set", () => {
    expect(source).toContain("disabled={confirmDisabled}");
  });

  it("also blocks submission at the form level, not just via the disabled button", () => {
    const formIndex = source.indexOf("<form\n");
    expect(formIndex).toBeGreaterThan(-1);
    const formBlock = source.slice(formIndex, formIndex + 700);
    expect(formBlock).toContain("onSubmit=");
    expect(formBlock).toContain("event.preventDefault()");
  });
});
