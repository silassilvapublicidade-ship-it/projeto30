import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { cleanupOrphanFiles } from "./storage-audit.service";

/**
 * cleanupOrphanFiles is the safety-critical half of the Storage audit
 * (Parte A.6 of the module brief: "revalidar CADA arquivo antes de
 * excluir, nunca confiar na lista da auditoria anterior"). This is a real
 * behavioral test with the Supabase client boundary mocked - it asserts
 * the actual runtime decision (skip vs delete) for each path class, not
 * just that certain strings appear in the source file.
 */
function makeAdminMock(options: {
  referencedPaths: Set<string>;
  removeResult?: { error: { message: string } | null };
}) {
  const removeSpy = vi.fn(() => Promise.resolve(options.removeResult ?? { error: null }));
  const listSpy = vi.fn(() => Promise.resolve({ data: [{ name: "kept.webp", metadata: { size: 1024 } }] }));

  const admin = {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        not: vi.fn(() =>
          Promise.resolve({
            data:
              table === "content_items"
                ? [...options.referencedPaths].map((path) => ({ image_storage_path: path }))
                : [],
            error: null,
          }),
        ),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        list: listSpy,
        remove: removeSpy,
      })),
    },
  };

  return { admin, removeSpy, listSpy };
}

describe("cleanupOrphanFiles", () => {
  beforeEach(() => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as never);
  });

  it("rejects a bucket outside the allowlist before touching Storage at all", async () => {
    await expect(
      cleanupOrphanFiles({ bucket: "not-a-real-bucket" as never, paths: ["x.png"] }),
    ).rejects.toThrow("Bucket não permitido.");
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("skips a path that gained a reference since the audit ran (revalidation), never deletes it", async () => {
    const { admin, removeSpy } = makeAdminMock({ referencedPaths: new Set(["tips/now-referenced.webp"]) });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);

    const result = await cleanupOrphanFiles({ bucket: "tip-cards", paths: ["tips/now-referenced.webp"] });

    expect(result.skipped).toEqual([
      { path: "tips/now-referenced.webp", reason: "Arquivo passou a ter uma referência desde a auditoria." },
    ]);
    expect(result.deletedCount).toBe(0);
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("skips path-traversal and absolute-path attempts without ever calling Storage remove", async () => {
    const { admin, removeSpy } = makeAdminMock({ referencedPaths: new Set() });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);

    const result = await cleanupOrphanFiles({
      bucket: "tip-cards",
      paths: ["../etc/passwd", "/absolute/path.png"],
    });

    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.every((entry) => entry.reason === "Caminho inválido.")).toBe(true);
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("deletes only the paths that are still genuinely orphaned, and logs via admin_log_storage_cleanup", async () => {
    const { admin, removeSpy } = makeAdminMock({ referencedPaths: new Set() });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
    const rpcSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc: rpcSpy } as never);

    const result = await cleanupOrphanFiles({ bucket: "tip-cards", paths: ["tips/orphan.webp"] });

    expect(removeSpy).toHaveBeenCalledWith(["tips/orphan.webp"]);
    expect(result.deletedCount).toBe(1);
    expect(result.skipped).toEqual([]);
    expect(rpcSpy).toHaveBeenCalledWith(
      "admin_log_storage_cleanup",
      expect.objectContaining({ p_bucket: "tip-cards", p_deleted_count: 1, p_result: "success" }),
    );
  });

  it("throws (never returns a false success) when Storage remove itself fails", async () => {
    const { admin } = makeAdminMock({
      referencedPaths: new Set(),
      removeResult: { error: { message: "network down" } },
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);

    await expect(cleanupOrphanFiles({ bucket: "tip-cards", paths: ["tips/orphan.webp"] })).rejects.toThrow(
      "network down",
    );
  });
});
