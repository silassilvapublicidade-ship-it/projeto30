/**
 * Auditoria de Storage (Parte A). Regras puras de classificação por
 * bucket - nunca inventa bucket: os 5 abaixo são os únicos criados por
 * migration (grep de "insert into storage.buckets" em supabase/migrations,
 * confirmado nesta rodada). Cada bucket tem sua própria regra de "órfão"
 * porque cada um referencia o Storage de um jeito diferente (coluna de
 * path limpa vs. URL pública com query string, ownership por pasta vs.
 * escrita exclusiva de service-role).
 */
export const STORAGE_BUCKETS = [
  "avatars",
  "challenge-covers",
  "tip-cards",
  "notification-images",
  "achievement-share-cards",
] as const;

export type StorageBucketId = (typeof STORAGE_BUCKETS)[number];

export function isStorageBucketId(value: string): value is StorageBucketId {
  return (STORAGE_BUCKETS as readonly string[]).includes(value);
}

export const STORAGE_BUCKET_LABELS: Record<StorageBucketId, string> = {
  avatars: "Avatares",
  "challenge-covers": "Capas de desafio",
  "tip-cards": "Cards de dicas",
  "notification-images": "Imagens de notificação",
  "achievement-share-cards": "Cards de compartilhamento",
};

/**
 * MIME esperado por bucket - qualquer objeto fora disso é "suspeito"
 * (mesmo que o Storage já reforce isso na maioria, a auditoria audita o
 * estado real do objeto, não só a política de upload).
 */
export const STORAGE_BUCKET_EXPECTED_MIME_TYPES: Record<StorageBucketId, readonly string[]> = {
  avatars: ["image/jpeg", "image/png", "image/webp"],
  "challenge-covers": ["image/jpeg", "image/png", "image/webp"],
  "tip-cards": ["image/jpeg", "image/png", "image/webp"],
  "notification-images": ["image/jpeg", "image/png", "image/webp"],
  "achievement-share-cards": ["image/png"],
};

export type StorageFindingClassification = "orphan" | "missing_reference" | "suspicious";

export type StorageDiagnosticCode =
  | "STOR-ORPHAN-NO-DB-REFERENCE"
  | "STOR-ORPHAN-REPLACED-FILE"
  | "STOR-MISSING-FILE-FOR-REFERENCE"
  | "STOR-SUSPICIOUS-ZERO-BYTE"
  | "STOR-SUSPICIOUS-UNEXPECTED-MIME"
  | "STOR-SUSPICIOUS-UNEXPECTED-PREFIX";

export type StorageObjectInfo = {
  bucket: StorageBucketId;
  path: string;
  sizeBytes: number;
  mimeType: string | null;
  createdAt: string | null;
};

export type StorageFinding = {
  bucket: StorageBucketId;
  path: string;
  sizeBytes: number;
  mimeType: string | null;
  createdAt: string | null;
  classification: StorageFindingClassification;
  diagnosticCode: StorageDiagnosticCode;
  reason: string;
  expectedTable: string | null;
  relatedRecordId: string | null;
};

/**
 * Extrai o caminho relativo ao bucket a partir de uma URL pública do
 * Supabase Storage (formato .../storage/v1/object/public/{bucket}/{path}),
 * removendo qualquer query string (ex.: "?v=..." usado em notification
 * campaigns para cache-busting). Retorna null se a URL não pertence a
 * este bucket (ex.: avatar_url apontando para um serviço externo - Parte
 * A explicitamente NÃO trata isso como órfão, é um valor válido fora do
 * nosso Storage).
 */
export function extractStoragePathFromPublicUrl(url: string, bucket: StorageBucketId): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }
  const afterMarker = url.slice(markerIndex + marker.length);
  const withoutQuery = afterMarker.split("?")[0]?.split("#")[0] ?? "";
  return withoutQuery ? decodeURIComponent(withoutQuery) : null;
}

const EXPECTED_PREFIXES: Record<StorageBucketId, readonly string[]> = {
  avatars: [],
  "challenge-covers": ["challenges/"],
  "tip-cards": ["tips/"],
  "notification-images": ["campaigns/"],
  "achievement-share-cards": ["achievements/", "progress/"],
};

function hasExpectedPrefix(bucket: StorageBucketId, path: string): boolean {
  const prefixes = EXPECTED_PREFIXES[bucket];
  if (prefixes.length === 0) {
    return true;
  }
  return prefixes.some((prefix) => path.startsWith(prefix));
}

/**
 * Classifica os objetos reais de UM bucket contra o conjunto de paths
 * referenciados por registros no banco (já resolvido pelo service a
 * partir da coluna/URL correta daquele bucket). Pura - não acessa rede
 * nem banco, só compara os dois conjuntos - o que permite testar as
 * regras de "órfão" com os exemplos exatos que o usuário deu, sem
 * precisar de um banco real.
 *
 * - orphan: objeto real sem NENHUM registro apontando para ele.
 * - missing_reference: registro aponta para um path que não existe entre
 *   os objetos reais.
 * - suspicious: objeto referenciado E presente, mas com sinal de
 *   problema (zero bytes, MIME inesperado, fora do prefixo esperado).
 */
export function classifyBucketObjects(
  bucket: StorageBucketId,
  objects: readonly StorageObjectInfo[],
  referencedPaths: ReadonlySet<string>,
  expectedTable: string,
): StorageFinding[] {
  const findings: StorageFinding[] = [];
  const realPaths = new Set(objects.map((object) => object.path));

  for (const object of objects) {
    const isReferenced = referencedPaths.has(object.path);

    if (!isReferenced) {
      findings.push({
        bucket,
        path: object.path,
        sizeBytes: object.sizeBytes,
        mimeType: object.mimeType,
        createdAt: object.createdAt,
        classification: "orphan",
        diagnosticCode: "STOR-ORPHAN-NO-DB-REFERENCE",
        reason: "Nenhum registro no banco referencia este arquivo.",
        expectedTable,
        relatedRecordId: null,
      });
      continue;
    }

    if (object.sizeBytes === 0) {
      findings.push({
        bucket,
        path: object.path,
        sizeBytes: object.sizeBytes,
        mimeType: object.mimeType,
        createdAt: object.createdAt,
        classification: "suspicious",
        diagnosticCode: "STOR-SUSPICIOUS-ZERO-BYTE",
        reason: "Arquivo com 0 bytes.",
        expectedTable,
        relatedRecordId: null,
      });
      continue;
    }

    const expectedMime = STORAGE_BUCKET_EXPECTED_MIME_TYPES[bucket];
    if (object.mimeType && !expectedMime.includes(object.mimeType)) {
      findings.push({
        bucket,
        path: object.path,
        sizeBytes: object.sizeBytes,
        mimeType: object.mimeType,
        createdAt: object.createdAt,
        classification: "suspicious",
        diagnosticCode: "STOR-SUSPICIOUS-UNEXPECTED-MIME",
        reason: `Tipo de arquivo inesperado (${object.mimeType}).`,
        expectedTable,
        relatedRecordId: null,
      });
      continue;
    }

    if (!hasExpectedPrefix(bucket, object.path)) {
      findings.push({
        bucket,
        path: object.path,
        sizeBytes: object.sizeBytes,
        mimeType: object.mimeType,
        createdAt: object.createdAt,
        classification: "suspicious",
        diagnosticCode: "STOR-SUSPICIOUS-UNEXPECTED-PREFIX",
        reason: "Caminho fora do prefixo esperado para este bucket.",
        expectedTable,
        relatedRecordId: null,
      });
    }
  }

  for (const referencedPath of referencedPaths) {
    if (!realPaths.has(referencedPath)) {
      findings.push({
        bucket,
        path: referencedPath,
        sizeBytes: 0,
        mimeType: null,
        createdAt: null,
        classification: "missing_reference",
        diagnosticCode: "STOR-MISSING-FILE-FOR-REFERENCE",
        reason: "Um registro no banco aponta para este arquivo, mas ele não existe no bucket.",
        expectedTable,
        relatedRecordId: null,
      });
    }
  }

  return findings;
}

export type BucketAuditSummary = {
  bucket: StorageBucketId;
  totalObjects: number;
  totalBytes: number;
  orphanCount: number;
  missingReferenceCount: number;
  suspiciousCount: number;
  recommendedAction: string;
};

export function summarizeBucketFindings(
  bucket: StorageBucketId,
  objects: readonly StorageObjectInfo[],
  findings: readonly StorageFinding[],
): BucketAuditSummary {
  const orphanCount = findings.filter((f) => f.classification === "orphan").length;
  const missingReferenceCount = findings.filter((f) => f.classification === "missing_reference").length;
  const suspiciousCount = findings.filter((f) => f.classification === "suspicious").length;

  let recommendedAction = "Nenhuma ação necessária.";
  if (missingReferenceCount > 0) {
    recommendedAction = "Investigar registros apontando para arquivos ausentes.";
  } else if (orphanCount > 0) {
    recommendedAction = "Revisar e, se confirmado, limpar arquivos órfãos.";
  } else if (suspiciousCount > 0) {
    recommendedAction = "Revisar arquivos suspeitos manualmente.";
  }

  return {
    bucket,
    totalObjects: objects.length,
    totalBytes: objects.reduce((sum, o) => sum + o.sizeBytes, 0),
    orphanCount,
    missingReferenceCount,
    suspiciousCount,
    recommendedAction,
  };
}

export type StorageHealthStatus = "saudavel" | "atencao" | "degradado" | "critico";

/**
 * Nunca classifica só por volume (Parte A explícita). O que importa é o
 * TIPO de achado: referência quebrada (registro apontando para nada) é
 * sempre mais grave que um órfão comum, que por sua vez é mais grave que
 * um "suspeito" isolado.
 */
export function computeStorageHealthStatus(input: {
  missingReferenceCount: number;
  orphanCount: number;
  suspiciousCount: number;
}): StorageHealthStatus {
  if (input.missingReferenceCount > 0) {
    return "critico";
  }
  if (input.suspiciousCount > 0) {
    return "degradado";
  }
  if (input.orphanCount > 0) {
    return "atencao";
  }
  return "saudavel";
}

export const ORPHAN_CLEANUP_CONFIRMATION_PHRASE = "EXCLUIR ARQUIVOS ÓRFÃOS";
