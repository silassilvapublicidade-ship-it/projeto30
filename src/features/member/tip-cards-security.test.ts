import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("content_items RLS - member vs admin authorization", () => {
  const base = readMigration("0001_initial_schema.sql");
  const tipsAlignment = readMigration("0011_tips_content.sql");

  it("row level security is enabled on content_items", () => {
    expect(base).toContain("alter table public.content_items enable row level security;");
  });

  it("authenticated members can only read published content, never draft or archived directly via RLS", () => {
    expect(tipsAlignment).toContain(
      'create policy "Authenticated users can read published content"',
    );
    expect(tipsAlignment).toContain("to authenticated");
    expect(tipsAlignment).toContain("using (status = 'published')");
  });

  it("only admins (via is_admin()) can insert/update/delete - no separate member write policy exists", () => {
    expect(base).toContain('create policy "Admins can manage content"');
    expect(base).toContain("on public.content_items for all");
    expect(base).toContain("using (public.is_admin())");
    expect(base).toContain("with check (public.is_admin())");
  });

  it("the public/anonymous read policy was tightened to authenticated-only, not left wide open", () => {
    expect(tipsAlignment).toContain(
      'drop policy if exists "Anyone can read published content" on public.content_items;',
    );
  });
});

describe("tip-cards Storage bucket - authorization and hardening", () => {
  const bucketMigration = readMigration("0023_tip_cards.sql");
  const hardeningMigration = readMigration("0025_tip_cards_storage_hardening.sql");

  it("is publicly readable (published cards must be viewable without auth-gated image URLs)", () => {
    expect(bucketMigration).toContain("values ('tip-cards', 'tip-cards', true)");
    expect(bucketMigration).toContain("using (bucket_id = 'tip-cards');");
  });

  it("only admins can write to the bucket - members never upload directly", () => {
    expect(bucketMigration).toContain('create policy "Admins can manage tip cards"');
    expect(bucketMigration).toContain("bucket_id = 'tip-cards' and public.is_admin()");
    expect(bucketMigration).toContain("with check (bucket_id = 'tip-cards' and public.is_admin())");
  });

  it("enforces a 10 MB size limit and an image-only MIME allowlist at the Storage level, not just in application code", () => {
    expect(hardeningMigration).toContain("file_size_limit = 10485760");
    expect(hardeningMigration).toContain(
      "allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']",
    );
  });
});

describe("service-role key is never used from the browser", () => {
  it("all tip upload/delete server actions use the per-request session client, not the service-role admin client", () => {
    const actionsSource = readFileSync(
      join(process.cwd(), "src", "features", "admin", "admin-tips.actions.ts"),
      "utf8",
    );
    expect(actionsSource).not.toContain("createSupabaseAdminClient");
    expect(actionsSource).toContain("createSupabaseServerClient");
  });

  it("uploads happen exclusively inside 'use server' actions, never in a client component", () => {
    const actionsSource = readFileSync(
      join(process.cwd(), "src", "features", "admin", "admin-tips.actions.ts"),
      "utf8",
    );
    expect(actionsSource.startsWith('"use server";')).toBe(true);

    const uploaderSource = readFileSync(
      join(process.cwd(), "src", "components", "admin", "tip-image-uploader.tsx"),
      "utf8",
    );
    expect(uploaderSource).not.toContain("supabase.storage");
    expect(uploaderSource).not.toContain("SUPABASE_SERVICE_ROLE");
  });
});
