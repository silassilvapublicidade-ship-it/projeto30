import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { calculateChallengeDay } from "@/features/challenges/date.core";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

function sliceFunction(source: string, name: string, nextMarker: string) {
  const start = source.indexOf(name);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf(nextMarker, start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("calculateChallengeDay - pausedDaysOffset", () => {
  it("defaults to 0 (no-op) when omitted - identical to the pre-Module-C formula", () => {
    const withOffset = calculateChallengeDay({
      durationDays: 30,
      personalStartDate: "2026-08-01",
      targetDate: "2026-08-10",
    });
    const explicitZero = calculateChallengeDay({
      durationDays: 30,
      pausedDaysOffset: 0,
      personalStartDate: "2026-08-01",
      targetDate: "2026-08-10",
    });
    expect(withOffset).toEqual(explicitZero);
    expect(withOffset.dayNumber).toBe(10);
  });

  it("credits paused days back - a 4-day pause never costs the participant those days", () => {
    // Without offset, day 14 (Aug 1 -> Aug 14 elapsed = 13 days + 1).
    const withoutPause = calculateChallengeDay({
      durationDays: 30,
      personalStartDate: "2026-08-01",
      targetDate: "2026-08-14",
    });
    expect(withoutPause.dayNumber).toBe(14);

    // With a 4-day pause credited, the same calendar date reads as day 10 -
    // exactly as if those 4 days had never passed.
    const withPause = calculateChallengeDay({
      durationDays: 30,
      pausedDaysOffset: 4,
      personalStartDate: "2026-08-01",
      targetDate: "2026-08-14",
    });
    expect(withPause.dayNumber).toBe(10);
    expect(withPause.status).toBe("active");
  });

  it("keeps a challenge from completing early just because it was paused", () => {
    const result = calculateChallengeDay({
      durationDays: 5,
      pausedDaysOffset: 3,
      personalStartDate: "2026-08-01",
      targetDate: "2026-08-06",
    });
    // Without the offset this would already be day 6 (past duration=5,
    // status "completed"); with 3 days credited back it's still mid-cycle.
    expect(result.status).toBe("active");
    expect(result.dayNumber).toBe(3);
  });
});

describe("Migration 0029 - schema and RLS groundwork", () => {
  const migration = readSource("supabase", "migrations", "0029_challenge_lifecycle_columns.sql");

  it("adds challenges.paused_at and challenges.ended_at", () => {
    expect(migration).toContain("add column if not exists paused_at timestamptz");
    expect(migration).toContain("add column if not exists ended_at timestamptz");
  });

  it("adds a non-negative paused_days_offset to challenge_enrollments", () => {
    expect(migration).toContain("add column if not exists paused_days_offset integer not null default 0");
    expect(migration).toContain("check (paused_days_offset >= 0)");
  });

  it("widens challenge read access to include paused/ended, not just active - otherwise pausing breaks Hoje/Jornada via RLS for every enrolled participant", () => {
    expect(migration).toContain('drop policy if exists "Anyone can read active challenges"');
    expect(migration).toContain("status in ('active', 'paused', 'ended')");
  });

  it("extends the analytics_events whitelist with the 5 new lifecycle events", () => {
    for (const event of [
      "challenge_paused",
      "challenge_resumed",
      "challenge_ended",
      "enrollment_paused",
      "enrollment_resumed",
    ]) {
      expect(migration).toContain(`'${event}'`);
    }
  });
});

describe("Migration 0030 - journey engine offset plumbing", () => {
  const migration = readSource("supabase", "migrations", "0030_challenge_lifecycle_rpcs.sql");

  it("drops the old 2-arg journey_calculate_day overload before replacing it with the 3-arg version", () => {
    expect(migration).toContain("drop function if exists public.journey_calculate_day(date, date);");
    const body = sliceFunction(migration, "select (target_local_date - target_start_date)", "$$;");
    expect(body).toContain("- coalesce(p_paused_days_offset, 0)");
  });

  it("ensure_today_daily_log reads and passes the enrollment's paused_days_offset", () => {
    const body = sliceFunction(
      migration,
      "create or replace function public.ensure_today_daily_log",
      "create or replace function public.update_habit_log",
    );
    expect(body).toContain("ce.paused_days_offset");
    expect(body).toContain("enrollment_record.personal_start_date, local_date, enrollment_record.paused_days_offset");
  });

  it("update_habit_log now also checks challenge_status, not just enrollment_status (the gap found during audit)", () => {
    const body = sliceFunction(
      migration,
      "create or replace function public.update_habit_log",
      "create or replace function public.save_journal_entry",
    );
    expect(body).toContain("c.status as challenge_status");
    expect(body).toContain("daily_record.challenge_status <> 'active'::public.challenge_status");
  });

  it("save_journal_entry now also checks challenge_status, only when the day isn't already finalized", () => {
    const body = sliceFunction(
      migration,
      "create or replace function public.save_journal_entry",
      "-- record_analytics_event",
    );
    expect(body).toContain("c.status as challenge_status");
    expect(body).toContain("or daily_record.challenge_status <> 'active'::public.challenge_status");
  });
});

describe("Migration 0030 - whole-challenge pause/resume/end RPCs", () => {
  const migration = readSource("supabase", "migrations", "0030_challenge_lifecycle_rpcs.sql");

  it("admin_pause_challenge only allows active -> paused, stamps paused_at, logs to admin_audit_logs", () => {
    const body = sliceFunction(
      migration,
      "create or replace function public.admin_pause_challenge",
      "create or replace function public.admin_resume_challenge",
    );
    expect(body).toContain("perform public.admin_require_admin();");
    expect(body).toContain("if v_old_status <> 'active' then");
    expect(body).toContain("status = 'paused', paused_at = now()");
    expect(body).toContain(".admin_audit_logs");
  });

  it("admin_resume_challenge credits every active/paused enrollment's offset with the elapsed pause days, in whole calendar days", () => {
    const body = sliceFunction(
      migration,
      "create or replace function public.admin_resume_challenge",
      "create or replace function public.admin_end_challenge",
    );
    expect(body).toContain("if v_old_status <> 'paused' then");
    expect(body).toContain("v_pause_days := greatest(0, (now()::date - coalesce(v_paused_at, now())::date));");
    expect(body).toContain("paused_days_offset = paused_days_offset + v_pause_days");
    expect(body).toContain("status in ('active', 'paused')");
  });

  it("admin_end_challenge requires the exact challenge name and is one-way (active/paused -> ended only)", () => {
    const body = sliceFunction(
      migration,
      "create or replace function public.admin_end_challenge",
      "-- --",
    );
    expect(body).toContain("if v_old_status not in ('active', 'paused') then");
    expect(body).toContain("trim(p_confirmation_name) <> v_name");
    expect(body).toContain("errcode = 'P0008'");
    expect(body).toContain("status = 'ended', ended_at = now()");
  });
});

describe("Migration 0030 - individual enrollment pause/resume RPCs", () => {
  const migration = readSource("supabase", "migrations", "0030_challenge_lifecycle_rpcs.sql");

  it("admin_pause_enrollment/admin_resume_enrollment are admin-gated and independent of challenge-level status", () => {
    const pauseBody = sliceFunction(
      migration,
      "create or replace function public.admin_pause_enrollment",
      "create or replace function public.admin_resume_enrollment",
    );
    expect(pauseBody).toContain("perform public.admin_require_admin();");
    expect(pauseBody).toContain("if v_old_status <> 'active' then");
    expect(pauseBody).not.toContain("challenge_status");

    const start = migration.indexOf("create or replace function public.admin_resume_enrollment");
    const resumeBody = migration.slice(start);
    expect(resumeBody).toContain("if v_old_status <> 'paused' then");
    expect(resumeBody).toContain("paused_days_offset = paused_days_offset + v_pause_days");
  });
});

describe("Admin challenge lifecycle actions", () => {
  const source = readSource("src", "features", "admin", "admin-challenges.actions.ts");

  it("pauseChallengeAction / resumeChallengeAction call the matching RPCs", () => {
    const pauseBody = source.slice(
      source.indexOf("export async function pauseChallengeAction"),
      source.indexOf("export async function resumeChallengeAction"),
    );
    const resumeBody = source.slice(
      source.indexOf("export async function resumeChallengeAction"),
      source.indexOf("export async function endChallengeAction"),
    );
    expect(pauseBody).toContain('supabase.rpc("admin_pause_challenge"');
    expect(resumeBody).toContain('supabase.rpc("admin_resume_challenge"');
  });

  it("endChallengeAction requires a confirmation name and forwards it to the RPC (never trusts a client-side match)", () => {
    const body = source.slice(
      source.indexOf("export async function endChallengeAction"),
      source.indexOf("export async function pauseEnrollmentAction"),
    );
    expect(body).toContain('supabase.rpc("admin_end_challenge"');
    expect(body).toContain("p_confirmation_name: confirmationName");
    expect(body).toContain('"P0008"');
  });

  it("pauseEnrollmentAction / resumeEnrollmentAction call the matching RPCs", () => {
    const pauseBody = source.slice(
      source.indexOf("export async function pauseEnrollmentAction"),
      source.indexOf("export async function resumeEnrollmentAction"),
    );
    const resumeBody = source.slice(source.indexOf("export async function resumeEnrollmentAction"));
    expect(pauseBody).toContain('supabase.rpc("admin_pause_enrollment"');
    expect(resumeBody).toContain('supabase.rpc("admin_resume_enrollment"');
  });
});

describe("ChallengeRowActions - Pausar/Retomar/Encerrar wired into the dropdown", () => {
  const source = readSource("src", "components", "admin", "challenge-row-actions.tsx");

  it("only offers Pausar for active, Retomar for paused", () => {
    expect(source).toContain('status === "active" ? (\n              <ActionForm\n                action={pauseChallengeAction}');
    expect(source).toContain('status === "paused" ? (\n              <ActionForm\n                action={resumeChallengeAction}');
  });

  it("Encerrar opens a confirm-by-name dialog rather than submitting directly", () => {
    expect(source).toContain("setEndOpen(true)");
    expect(source).toContain("<EndChallengeDialog");
  });
});

describe("EndChallengeDialog - confirm-by-name, no destructive preview needed", () => {
  const source = readSource("src", "components", "admin", "end-challenge-dialog.tsx");

  it("stays disabled until the typed name matches exactly", () => {
    expect(source).toContain("confirmDisabled={typedName !== challengeName}");
  });
});

describe("Hoje (member-area.service.ts) - paused state handling", () => {
  const source = readSource("src", "server", "services", "member-area.service.ts");

  it("adds a distinct cycle_paused JourneyState", () => {
    expect(source).toContain('"cycle_paused"');
  });

  it("treats either the enrollment or the whole challenge being paused as the paused state", () => {
    const start = source.indexOf("const isPaused =");
    const line = source.slice(start, source.indexOf("\n", start));
    expect(line).toContain('enrollment.status === "paused"');
    expect(line).toContain('challenge?.status === "paused"');
  });

  it("checks isPaused before attempting ensureTodayLog, so a paused enrollment never hits the RPC's generic error path", () => {
    const fnStart = source.indexOf("async function buildEnrollmentDayContext");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, fnStart + 2500);
    const isPausedIndex = fnBody.indexOf("isPaused) {");
    const ensureLogIndex = fnBody.indexOf("ensureTodayLog({");
    expect(isPausedIndex).toBeGreaterThan(-1);
    expect(ensureLogIndex).toBeGreaterThan(-1);
    expect(isPausedIndex).toBeLessThan(ensureLogIndex);
  });

  it("passes paused_days_offset into calculateChallengeDay so the UI day number matches what the RPC enforces", () => {
    expect(source).toContain("pausedDaysOffset: enrollment.paused_days_offset");
  });
});

describe("Today experience UI - paused copy, never claims progress is lost", () => {
  const source = readSource("src", "components", "member", "today-experience.tsx");

  it("shows a dedicated PausedCard instead of falling through to the mission list", () => {
    expect(source).toContain('journeyState === "cycle_paused"');
    expect(source).toContain("<PausedCard");
  });

  it("copy explicitly reassures no day is lost during a pause", () => {
    expect(source.toLowerCase()).toContain("nenhum dia é perdido durante a pausa");
  });
});
