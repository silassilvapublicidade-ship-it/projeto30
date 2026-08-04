import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("ProfileHeader - Dashboard de Evolucao Pessoal (Parte 3)", () => {
  const source = readSource("src", "components", "member", "profile-header.tsx");

  it("never renders the member's email - privacy (Parte 18)", () => {
    expect(source).not.toContain("email");
  });

  it("shows a role badge only for admin/super_admin, never for a plain member", () => {
    expect(source).toContain('const showRoleBadge = role === "admin" || role === "super_admin";');
  });

  it("only shows the full name when it differs from the display name - never duplicated", () => {
    expect(source).toContain("fullName && fullName !== displayName");
  });

  it("carries the exact motivational tagline from the brief", () => {
    expect(source).toContain("Você está construindo uma nova versão de si mesmo.");
  });

  it("always renders the edit-profile entry point - never hidden (Parte 14)", () => {
    expect(source).toContain("<ProfileEditLink />");
  });
});

describe("ProfileEditLink", () => {
  const source = readSource("src", "components", "member", "profile-edit-link.tsx");

  it("links to the dedicated settings route", () => {
    expect(source).toContain('href="/app/perfil/editar"');
  });

  it("fires profile_edit_clicked without blocking navigation (fire-and-forget)", () => {
    expect(source).toContain('void recordProfileDashboardEventAction("profile_edit_clicked");');
  });
});

describe("ProfileMetricsGrid - resumo principal (Parte 4)", () => {
  const source = readSource("src", "components", "member", "profile-metrics-grid.tsx");

  it("only shows challenge filter chips when there is more than one enrollment", () => {
    expect(source).toContain("{enrollments.length > 1 ? (");
  });

  it("always labels which scope is shown - Geral vs the selected challenge name, never ambiguous", () => {
    expect(source).toContain('Resumo · {selected ? selected.challengeName : "Geral"}');
  });

  it("the account-wide grid uses account-wide fields (daysFinalized, challengesCompleted), never per-enrollment fields", () => {
    const generalBlockStart = source.indexOf('label="Dias finalizados"');
    const generalBlockEnd = source.indexOf("</section>");
    expect(generalBlockStart).toBeGreaterThan(-1);
    const generalBlock = source.slice(generalBlockStart, generalBlockEnd);
    expect(generalBlock).toContain("totals.daysFinalized");
    expect(generalBlock).toContain("totals.challengesCompleted");
  });

  it("the per-challenge grid never fabricates account-wide day counts for a single enrollment", () => {
    const branchStart = source.indexOf("{selected ? (");
    const branchEnd = source.indexOf(") : (", branchStart);
    expect(branchStart).toBeGreaterThan(-1);
    expect(branchEnd).toBeGreaterThan(branchStart);
    const perChallengeBlock = source.slice(branchStart, branchEnd);
    expect(perChallengeBlock).toContain('label="Dia atual"');
    expect(perChallengeBlock).not.toContain("totals.daysFinalized");
  });

  it("the challenge filter is a real navigable URL (?desafio=), never client state", () => {
    expect(source).toContain("href={`/app/dashboard?desafio=${enrollment.challengeId}`}");
  });
});

describe("ProfileChallengesSection - Meus desafios (Parte 6)", () => {
  const source = readSource("src", "components", "member", "profile-challenges-section.tsx");

  it("buckets enrollments into em andamento / pausados / concluidos / abandonados", () => {
    expect(source).toContain('{ key: "active", label: "Em andamento", statuses: ["active"] }');
    expect(source).toContain('{ key: "paused", label: "Pausados", statuses: ["paused"] }');
    expect(source).toContain('{ key: "completed", label: "Concluídos", statuses: ["completed"] }');
    expect(source).toContain('{ key: "abandoned", label: "Abandonados", statuses: ["abandoned", "restarted"] }');
  });

  it("never exposes a destructive action (pause/abandon) directly on a dashboard card", () => {
    expect(source).not.toMatch(/Pausar|Abandonar/);
  });

  it("shows the exact empty-state copy from the brief with an Explorar desafios CTA", () => {
    expect(source).toContain("Você ainda não iniciou um desafio.");
    expect(source).toContain("Explorar desafios");
  });

  it("shows progress, streak and points on every card - never a bare cover image", () => {
    expect(source).toContain("enrollment.completionPercent");
    expect(source).toContain("{enrollment.streakCurrent}d sequência");
    expect(source).toContain("pointsTotal.toLocaleString");
  });
});

describe("ChallengeOpenLink", () => {
  const source = readSource("src", "components", "member", "challenge-open-link.tsx");

  it("fires profile_challenge_opened with the real challenge/enrollment ids before navigating", () => {
    expect(source).toContain(
      'void recordProfileDashboardEventAction("profile_challenge_opened", { challengeId, enrollmentId });',
    );
  });
});

describe("ProfileTimeline - linha do tempo (Parte 7/8)", () => {
  const source = readSource("src", "components", "member", "profile-timeline.tsx");

  it("is a client component (owns pagination state)", () => {
    expect(source.trimStart().startsWith('"use client";')).toBe(true);
  });

  it("offers all 5 filters from the core module (Tudo/Dias/Conquistas/Desafios/Recordes)", () => {
    expect(source).toContain("TIMELINE_FILTERS.map((filter) => (");
  });

  it("filter links preserve the current challenge scope", () => {
    expect(source).toContain('if (challengeId) params.set("desafio", challengeId);');
  });

  it("filter links point at /app/dashboard - the timeline's canonical home, not the old /app/perfil route", () => {
    expect(source).toContain("`/app/dashboard${query");
  });

  it("keys each row on event_type + event_source_id, never a plain index - required for the composite cursor's tied timestamps", () => {
    expect(source).toContain("key={`${event.event_type}:${event.event_source_id}`}");
  });

  it("Carregar mais only renders when the server said there's more, and paginates via the server action - never fetches everything up front", () => {
    expect(source).toContain("{hasMore ? (");
    expect(source).toContain("loadMoreProfileTimelineAction({");
  });

  it("load-more is guarded on having a real cursor - never sends a null cursor to the RPC", () => {
    expect(source).toContain("if (!cursorAt || !cursorId) return;");
  });

  it("shows the exact empty-state copy from the brief", () => {
    expect(source).toContain("Seus próximos registros aparecerão aqui.");
  });

  it("fires profile_timeline_filter_changed on filter click", () => {
    expect(source).toContain('void recordProfileDashboardEventAction("profile_timeline_filter_changed");');
  });
});

describe("ProfileAchievementsSummary - conquistas (Parte 9)", () => {
  const source = readSource("src", "components", "member", "profile-achievements-summary.tsx");

  it("reuses the existing achievement share buttons, never a new share implementation", () => {
    expect(source).toContain(
      'import { AchievementArtShareButton } from "@/components/member/achievement-art-share-button";',
    );
    expect(source).toContain(
      'import { AchievementShareButton } from "@/components/member/achievement-share-button";',
    );
  });

  it("links to /app/conquistas as the full list - never duplicates that page's content", () => {
    expect(source).toContain('href="/app/conquistas"');
    expect(source).toContain("Ver todas");
  });

  it("shows the exact empty-state copy from the brief", () => {
    expect(source).toContain("Sua primeira conquista começa com o primeiro passo.");
  });

  it("wraps share buttons in the profile-origin tracker, without replacing the existing share events", () => {
    expect(source).toContain("<ProfileAchievementShareTracker>");
  });
});

describe("ProfileAchievementShareTracker", () => {
  const source = readSource("src", "components", "member", "profile-achievement-share-tracker.tsx");

  it("is a non-visual bubbling wrapper (display: contents), never re-styles its children", () => {
    expect(source).toContain('className="contents"');
  });

  it("fires profile_achievement_shared additively via event bubbling, not by wrapping the existing handlers", () => {
    expect(source).toContain('void recordProfileDashboardEventAction("profile_achievement_shared");');
  });
});

describe("ProfileStatistics - estatisticas pessoais (Parte 10)", () => {
  const source = readSource("src", "components", "member", "profile-statistics.tsx");

  it("never invents a fabricated quantity (liters, pages, minutes) the system doesn't store", () => {
    const body = source.slice(source.indexOf("export function ProfileStatistics"));
    expect(body).not.toMatch(/litro|página|páginas|minuto/i);
  });

  it("labels boolean-derived stats as counts (Dias em que / Treinos registrados), matching the achievement engine's own categorization", () => {
    expect(source).toContain('{ label: "Dias em que leu", value: totals.readingDays }');
    expect(source).toContain('{ label: "Treinos registrados", value: totals.physicalActivityDays }');
  });

  it("only reads from the overview totals - no separate query, no client-side aggregation", () => {
    expect(source).toContain('import type { ProfileOverview } from "@/server/services/profile-dashboard.service";');
    expect(source).not.toContain("supabase");
  });
});

describe("ProfileRecentEvolution - evolucao recente (Parte 11)", () => {
  const source = readSource("src", "components", "member", "profile-recent-evolution.tsx");

  it("never imports a charting library - CSS-only bars", () => {
    expect(source).not.toMatch(/recharts|chart\.js|d3|victory/i);
  });

  it("period toggle is a real navigable URL (?periodo=7|30), never client state", () => {
    expect(source).toContain('href="/app/dashboard?periodo=7"');
    expect(source).toContain('href="/app/dashboard?periodo=30"');
  });

  it("exposes an accessible aggregate label plus a per-bar label for screen readers", () => {
    expect(source).toContain('role="img"');
    expect(source).toContain("aria-label={`");
  });

  it("shows the exact empty-state copy from the brief when there are zero days", () => {
    expect(source).toContain("Seus próximos registros aparecerão aqui.");
  });
});

describe("DashboardContextMessage / DashboardNextMilestone / ProfileFaithMessage", () => {
  it("context message renders a single message block, never two stacked", () => {
    const source = readSource("src", "components", "member", "dashboard-context-message.tsx");
    expect((source.match(/\{message\.text\}/g) ?? []).length).toBe(1);
  });

  it("next milestone never hardcodes a surprise achievement reveal", () => {
    const source = readSource("src", "components", "member", "dashboard-next-milestone.tsx");
    const body = source.slice(source.indexOf("export function DashboardNextMilestone"));
    expect(body).not.toMatch(/surpresa|secreta/i);
  });

  it("faith message renders nothing (not even a placeholder) when there's no eligible message", () => {
    const source = readSource("src", "components", "member", "profile-faith-message.tsx");
    expect(source).toContain("if (!message) {\n    return null;\n  }");
  });
});
