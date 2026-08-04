import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SEARCH_DIRS = [
  join(process.cwd(), "src", "app"),
  join(process.cwd(), "src", "features"),
  join(process.cwd(), "src", "server"),
  join(process.cwd(), "src", "components"),
];

const FORBIDDEN_METADATA_KEY_PATTERN =
  /\b(password|senha|token|cookie|authorization|service_role|api[_-]?key|journal|diario|diary|note|comment|comentario|email)\s*:/i;

function collectTsSources(): { path: string; source: string }[] {
  const files: { path: string; source: string }[] = [];

  for (const dir of SEARCH_DIRS) {
    for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith(".test.ts")) {
        continue;
      }

      const fullPath = join(entry.parentPath ?? entry.path, entry.name);
      files.push({ path: fullPath, source: readFileSync(fullPath, "utf8") });
    }
  }

  return files;
}

/**
 * Static scan (Parte S): nenhum call site de recordSystemError deve montar
 * um objeto `metadata` contendo uma chave de conteúdo privado. A camada de
 * saneamento (sanitizeMetadata) já bloquearia a maior parte disso em
 * runtime, mas este teste garante que o próprio código-fonte nunca tenta
 * passar esses campos - defesa em profundidade, não apenas confiança no
 * saneador.
 */
describe("recordSystemError call sites never pass a forbidden metadata key", () => {
  const files = collectTsSources();
  const callSites = files.filter(({ source }) => source.includes("recordSystemError({"));

  it("finds at least the known integration points, so this guardrail is not accidentally testing nothing", () => {
    expect(callSites.length).toBeGreaterThanOrEqual(10);
  });

  it("never includes password/token/cookie/authorization/service_role/journal/note/comment/email as a metadata key", () => {
    const offenders: string[] = [];

    for (const { path, source } of callSites) {
      const matches = [...source.matchAll(/recordSystemError\(\{[\s\S]*?\}\);/g)];

      for (const match of matches) {
        const block = match[0];

        if (!block.includes("metadata:")) {
          continue;
        }

        const metadataBlock = block.slice(block.indexOf("metadata:"));

        if (FORBIDDEN_METADATA_KEY_PATTERN.test(metadataBlock)) {
          offenders.push(path);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("never passes a full free-text field (content/body/message body of a journal entry) as metadata", () => {
    const offenders = callSites
      .filter(({ source }) => /metadata:\s*\{[^}]*\b(content|body|reflection|reflexao)\b/i.test(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});

describe("system_error_events never becomes a dumping ground for raw error objects", () => {
  const files = collectTsSources();
  const callSites = files.filter(({ source }) => source.includes("recordSystemError({"));

  it("never passes an Error object or its .stack directly as the message", () => {
    const offenders = callSites
      .filter(({ source }) => /message:\s*(error|err|unexpectedError)\.(stack|toString\(\))/i.test(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});
