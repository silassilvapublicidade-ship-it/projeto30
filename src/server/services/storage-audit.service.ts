import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  classifyBucketObjects,
  computeStorageHealthStatus,
  extractStoragePathFromPublicUrl,
  isStorageBucketId,
  STORAGE_BUCKETS,
  summarizeBucketFindings,
  type BucketAuditSummary,
  type StorageBucketId,
  type StorageFinding,
  type StorageObjectInfo,
} from "@/features/admin/storage-audit.core";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

const LIST_PAGE_SIZE = 100;
const MAX_RECURSION_DEPTH = 6;

/**
 * A API .list() do Supabase Storage é de UM nível só (como "ls"). Alguns
 * buckets guardam objetos em 2-3 níveis de pasta (ex.:
 * achievements/{userId}/{userAchievementId}/{formato}.png) - esta função
 * desce recursivamente, paginando dentro de cada pasta (nunca carrega o
 * bucket inteiro de uma vez), tratando qualquer entrada sem "id" como
 * pasta (convenção do próprio Supabase Storage).
 */
async function listBucketObjectsRecursive(
  admin: AdminClient,
  bucket: StorageBucketId,
  prefix = "",
  depth = 0,
): Promise<StorageObjectInfo[]> {
  if (depth > MAX_RECURSION_DEPTH) {
    return [];
  }

  const results: StorageObjectInfo[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`Falha ao listar bucket ${bucket} (prefix="${prefix}"): ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = entry.id === null;

      if (isFolder) {
        const nested = await listBucketObjectsRecursive(admin, bucket, path, depth + 1);
        results.push(...nested);
        continue;
      }

      results.push({
        bucket,
        path,
        sizeBytes: typeof entry.metadata?.size === "number" ? entry.metadata.size : 0,
        mimeType: typeof entry.metadata?.mimetype === "string" ? entry.metadata.mimetype : null,
        createdAt: entry.created_at ?? null,
      });
    }

    if (data.length < LIST_PAGE_SIZE) {
      break;
    }
    offset += LIST_PAGE_SIZE;
  }

  return results;
}

type BucketReferenceConfig = {
  expectedTable: string;
  getReferencedPaths: (admin: AdminClient) => Promise<Set<string>>;
};

const BUCKET_REFERENCE_CONFIG: Record<StorageBucketId, BucketReferenceConfig> = {
  avatars: {
    expectedTable: "users.avatar_url",
    getReferencedPaths: async (admin) => {
      const { data, error } = await admin.from("users").select("avatar_url").not("avatar_url", "is", null);
      if (error) throw new Error(`Falha ao ler users.avatar_url: ${error.message}`);
      const paths = new Set<string>();
      for (const row of data ?? []) {
        const url = row.avatar_url;
        if (!url) continue;
        const path = extractStoragePathFromPublicUrl(url, "avatars");
        if (path) paths.add(path);
      }
      return paths;
    },
  },
  "challenge-covers": {
    expectedTable: "challenges.cover_image_url",
    getReferencedPaths: async (admin) => {
      const { data, error } = await admin.from("challenges").select("cover_image_url").not("cover_image_url", "is", null);
      if (error) throw new Error(`Falha ao ler challenges.cover_image_url: ${error.message}`);
      const paths = new Set<string>();
      for (const row of data ?? []) {
        const url = row.cover_image_url;
        if (!url) continue;
        const path = extractStoragePathFromPublicUrl(url, "challenge-covers");
        if (path) paths.add(path);
      }
      return paths;
    },
  },
  "tip-cards": {
    expectedTable: "content_items.image_storage_path",
    getReferencedPaths: async (admin) => {
      const { data, error } = await admin
        .from("content_items")
        .select("image_storage_path")
        .not("image_storage_path", "is", null);
      if (error) throw new Error(`Falha ao ler content_items.image_storage_path: ${error.message}`);
      return new Set((data ?? []).map((row) => row.image_storage_path).filter((v): v is string => Boolean(v)));
    },
  },
  "notification-images": {
    expectedTable: "notification_campaigns.image_url",
    getReferencedPaths: async (admin) => {
      const { data, error } = await admin
        .from("notification_campaigns")
        .select("image_url")
        .not("image_url", "is", null);
      if (error) throw new Error(`Falha ao ler notification_campaigns.image_url: ${error.message}`);
      const paths = new Set<string>();
      for (const row of data ?? []) {
        const url = row.image_url;
        if (!url) continue;
        const path = extractStoragePathFromPublicUrl(url, "notification-images");
        if (path) paths.add(path);
      }
      return paths;
    },
  },
  "achievement-share-cards": {
    expectedTable: "share_cards.storage_path",
    getReferencedPaths: async (admin) => {
      const { data, error } = await admin.from("share_cards").select("storage_path").not("storage_path", "is", null);
      if (error) throw new Error(`Falha ao ler share_cards.storage_path: ${error.message}`);
      return new Set((data ?? []).map((row) => row.storage_path).filter((v): v is string => Boolean(v)));
    },
  },
};

export type BucketAuditResult = {
  summary: BucketAuditSummary;
  findings: StorageFinding[];
};

async function auditSingleBucket(admin: AdminClient, bucket: StorageBucketId): Promise<BucketAuditResult> {
  const config = BUCKET_REFERENCE_CONFIG[bucket];
  const [objects, referencedPaths] = await Promise.all([
    listBucketObjectsRecursive(admin, bucket),
    config.getReferencedPaths(admin),
  ]);
  const findings = classifyBucketObjects(bucket, objects, referencedPaths, config.expectedTable);
  const summary = summarizeBucketFindings(bucket, objects, findings);
  return { summary, findings };
}

export type StorageAuditRunResult = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  bucketsAudited: StorageBucketId[];
  totalObjects: number;
  totalBytes: number;
  orphanCount: number;
  missingReferenceCount: number;
  suspiciousCount: number;
  status: ReturnType<typeof computeStorageHealthStatus>;
  buckets: BucketAuditResult[];
};

/**
 * Executa a auditoria real (leitura só, nunca deleta nada) e persiste
 * apenas o RESUMO em storage_audit_runs (Parte A.4 - "nunca apagar nada
 * durante a auditoria inicial"). Os achados por item ficam só na resposta
 * desta chamada - reabrir os detalhes ou acionar a limpeza dispara uma
 * nova auditoria ao vivo (é a própria "revalidação antes de excluir"
 * exigida na Parte A.6).
 */
export async function runStorageAudit(triggeredByAdminId: string | null): Promise<StorageAuditRunResult> {
  const admin = createSupabaseAdminClient();
  const startedAt = new Date();

  const buckets: BucketAuditResult[] = [];
  for (const bucket of STORAGE_BUCKETS) {
    buckets.push(await auditSingleBucket(admin, bucket));
  }

  const finishedAt = new Date();
  const totals = buckets.reduce(
    (acc, b) => ({
      totalObjects: acc.totalObjects + b.summary.totalObjects,
      totalBytes: acc.totalBytes + b.summary.totalBytes,
      orphanCount: acc.orphanCount + b.summary.orphanCount,
      missingReferenceCount: acc.missingReferenceCount + b.summary.missingReferenceCount,
      suspiciousCount: acc.suspiciousCount + b.summary.suspiciousCount,
    }),
    { totalObjects: 0, totalBytes: 0, orphanCount: 0, missingReferenceCount: 0, suspiciousCount: 0 },
  );

  const status = computeStorageHealthStatus(totals);

  await admin.from("storage_audit_runs").insert({
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    triggered_by: triggeredByAdminId,
    buckets_audited: [...STORAGE_BUCKETS],
    total_objects: totals.totalObjects,
    total_bytes: totals.totalBytes,
    orphan_count: totals.orphanCount,
    missing_reference_count: totals.missingReferenceCount,
    suspicious_count: totals.suspiciousCount,
    bucket_breakdown: buckets.map((b) => b.summary),
    status: "completed",
  });

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    bucketsAudited: [...STORAGE_BUCKETS],
    totalObjects: totals.totalObjects,
    totalBytes: totals.totalBytes,
    orphanCount: totals.orphanCount,
    missingReferenceCount: totals.missingReferenceCount,
    suspiciousCount: totals.suspiciousCount,
    status,
    buckets,
  };
}

export async function getLatestStorageAuditRun() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_get_latest_storage_audit_run");
  if (error) throw new Error(error.message);
  return data as {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    bucketsAudited: string[];
    totalObjects: number;
    totalBytes: number;
    orphanCount: number;
    missingReferenceCount: number;
    suspiciousCount: number;
    bucketBreakdown: BucketAuditSummary[];
  } | null;
}

export type OrphanCleanupSelection = {
  bucket: StorageBucketId;
  paths: string[];
};

export type OrphanCleanupResult = {
  bucket: StorageBucketId;
  deletedCount: number;
  freedBytes: number;
  skipped: { path: string; reason: string }[];
};

/**
 * Revalida CADA arquivo selecionado contra o estado atual (nunca confia
 * na lista da auditoria anterior, que pode estar minutos/horas
 * desatualizada) antes de excluir - bloqueia qualquer arquivo que tenha
 * ganhado uma referência nesse meio-tempo (Parte A.6). Chamado somente
 * depois que a Server Action já confirmou: papel super_admin e frase de
 * confirmação exata digitada pelo usuário.
 */
export async function cleanupOrphanFiles(selection: OrphanCleanupSelection): Promise<OrphanCleanupResult> {
  if (!isStorageBucketId(selection.bucket)) {
    throw new Error("Bucket não permitido.");
  }

  const admin = createSupabaseAdminClient();
  const config = BUCKET_REFERENCE_CONFIG[selection.bucket];
  const referencedPaths = await config.getReferencedPaths(admin);

  const stillOrphan: string[] = [];
  const skipped: { path: string; reason: string }[] = [];

  for (const path of selection.paths) {
    if (!path || path.includes("..") || path.startsWith("/")) {
      skipped.push({ path, reason: "Caminho inválido." });
      continue;
    }
    if (referencedPaths.has(path)) {
      skipped.push({ path, reason: "Arquivo passou a ter uma referência desde a auditoria." });
      continue;
    }
    stillOrphan.push(path);
  }

  let deletedCount = 0;
  let freedBytes = 0;

  if (stillOrphan.length > 0) {
    for (const path of stillOrphan) {
      const parentPrefix = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      const fileName = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
      const { data: listing } = await admin.storage.from(selection.bucket).list(parentPrefix, { search: fileName });
      const sizeBytes = listing?.find((entry) => entry.name === fileName)?.metadata?.size ?? 0;
      freedBytes += typeof sizeBytes === "number" ? sizeBytes : 0;
    }

    const { error: deleteError } = await admin.storage.from(selection.bucket).remove(stillOrphan);
    if (deleteError) {
      throw new Error(`Falha ao excluir arquivos de ${selection.bucket}: ${deleteError.message}`);
    }
    deletedCount = stillOrphan.length;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("admin_log_storage_cleanup", {
    p_bucket: selection.bucket,
    p_paths: stillOrphan,
    p_deleted_count: deletedCount,
    p_freed_bytes: freedBytes,
    p_result: deletedCount === selection.paths.length ? "success" : "partial",
  });

  return { bucket: selection.bucket, deletedCount, freedBytes, skipped };
}
