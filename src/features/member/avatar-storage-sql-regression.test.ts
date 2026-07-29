import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0007_profile_avatars.sql"),
    "utf8",
  );
}

describe("profile avatar storage SQL migration", () => {
  const migration = readMigration();

  it("creates the avatars bucket without failing if it already exists", () => {
    expect(migration).toContain("insert into storage.buckets (id, name, public)");
    expect(migration).toContain("values ('avatars', 'avatars', true)");
    expect(migration).toContain("on conflict (id) do nothing;");
  });

  it("scopes write policies to the authenticated user's own folder", () => {
    const writePolicies = [
      "Users can upload their own avatar",
      "Users can update their own avatar",
      "Users can delete their own avatar",
    ];

    for (const policyName of writePolicies) {
      expect(migration).toContain(`create policy "${policyName}"`);
    }

    const ownFolderChecks = migration.match(
      /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/g,
    );
    // insert (with check), update (using + with check), delete (using) = 4.
    expect(ownFolderChecks?.length).toBe(4);
  });

  it("restricts write policies to the authenticated role, not anon", () => {
    const toAuthenticatedCount = (migration.match(/to authenticated/g) ?? []).length;
    expect(toAuthenticatedCount).toBe(3);
  });

  it("allows public read access to avatar images", () => {
    expect(migration).toContain('create policy "Avatar images are publicly readable"');
    expect(migration).toContain("on storage.objects for select");
    expect(migration).toContain("using (bucket_id = 'avatars');");
  });
});
