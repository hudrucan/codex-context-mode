import { createHash } from "node:crypto";
import { openSync, closeSync, fstatSync, readSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

interface ByteCursor {
  version: 1;
  path: string;
  identity: string;
  offset: number;
  line: number;
  model: string;
  prefixHash: string;
  head: string;
  anchor: string;
  lastUsageSnapshot?: string;
  legacyLine?: number;
}

function parseCursor(value: string | null): ByteCursor | null {
  if (!value) return null;
  try {
    const c = JSON.parse(value);
    if (c.version !== 1 || typeof c.path !== "string" || !isAbsolute(c.path) ||
        typeof c.identity !== "string" || typeof c.model !== "string" ||
        (c.lastUsageSnapshot !== undefined && typeof c.lastUsageSnapshot !== "string") ||
        (c.legacyLine !== undefined && (!Number.isSafeInteger(c.legacyLine) || c.legacyLine < 0)) ||
        !Number.isSafeInteger(c.offset) || c.offset < 0 ||
        !Number.isSafeInteger(c.line) || c.line < 0 ||
        ![c.prefixHash, c.head, c.anchor].every(v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v))) return null;
    return c;
  } catch { return null; }
}

/** Reuse a cached path only inside the physical sessions root and for this ID. */
export function findCodexRollout(sessionId: string, codexHome: string, cursor: string | null): string | null {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) return null;
  const root = join(resolve(codexHome), "sessions");
  let physicalRoot: string;
  try { physicalRoot = realpathSync(root); } catch { return null; }
  const valid = (path: string) => {
    const name = basename(path);
    if (!name.startsWith("rollout-") || !name.endsWith(`-${sessionId}.jsonl`)) return false;
    try {
      const rel = relative(physicalRoot, realpathSync(path));
      return rel !== "" && !isAbsolute(rel) && rel !== ".." && !rel.startsWith("..\\") &&
        !rel.startsWith("../") && statSync(path).isFile();
    } catch { return false; }
  };
  const cached = parseCursor(cursor)?.path;
  if (cached && valid(cached)) return cached;
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile() && valid(path)) return path;
    }
  }
  return null;
}

const EMPTY_HASH = createHash("sha256").digest("hex");

/**
 * Codex 0.164.0 session::update_rate_limits re-emits the unchanged usage info.
 * Equal last deltas alone are NOT duplicates: a new response advances the
 * cumulative counters. Without those counters there is no proof to suppress.
 */
export function codexUsageSnapshot(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const info = (payload as { info?: { total_token_usage?: Record<string, unknown>; last_token_usage?: unknown } }).info;
  const total = info?.total_token_usage;
  if (!total || !info?.last_token_usage ||
      !["input_tokens", "output_tokens", "total_tokens"].every(k => typeof total[k] === "number" && Number.isFinite(total[k]))) return undefined;
  const ordered = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === "object") return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordered(v)]),
    );
    return value;
  };
  return JSON.stringify(ordered([total, info.last_token_usage]));
}

function extendHash(hash: string, line: Buffer): string {
  return createHash("sha256").update(hash).update(line).update("\n").digest("hex");
}

/**
 * Only newline-terminated physical records are committed. Reads are bounded by
 * the file size observed on entry; partial UTF-8/JSON remains on disk for the
 * next call. Memory scales with new usage records and the largest JSONL line,
 * not the historical rollout string.
 */
export function readCodexRollout(path: string, value: string | null): {
  records: Array<{ payload: unknown; model: string }>; cursor: string; bytesRead: number;
} {
  const fd = openSync(path, "r");
  let bytesRead = 0;
  try {
    const stat = fstatSync(fd, { bigint: true });
    if (!stat.isFile() || stat.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Invalid rollout file");
    const size = Number(stat.size);
    const identity = `${stat.dev}:${stat.ino}:${stat.birthtimeNs}`;
    const read = (buffer: Buffer, position: number, length = buffer.length) => {
      const n = readSync(fd, buffer, 0, length, position); bytesRead += n; return n;
    };
    const digest = (start: number, end: number) => {
      const buffer = Buffer.alloc(end - start);
      if (read(buffer, start) !== buffer.length) throw new Error("Rollout truncated during read");
      return createHash("sha256").update(buffer).digest("hex");
    };
    const walk = (start: number, end: number, visit: (line: Buffer, nextOffset: number) => void) => {
      const buffer = Buffer.allocUnsafe(64 * 1024);
      let pending: Buffer[] = [];
      let pendingLength = 0;
      let position = start;
      while (position < end) {
        const n = read(buffer, position, Math.min(buffer.length, end - position));
        if (!n) throw new Error("Rollout truncated during read");
        let from = 0;
        for (let to = buffer.indexOf(10, from); to >= 0 && to < n; to = buffer.indexOf(10, from)) {
          const piece = buffer.subarray(from, to);
          const line = pendingLength ? Buffer.concat([...pending, piece], pendingLength + piece.length) : piece;
          visit(line, position + to + 1);
          pending = []; pendingLength = 0; from = to + 1;
        }
        if (from < n) {
          const piece = Buffer.from(buffer.subarray(from, n));
          pending.push(piece); pendingLength += piece.length;
        }
        position += n;
      }
    };

    const old = parseCursor(value);
    let keep = old !== null && old.offset <= size;
    if (keep && old) {
      keep = digest(0, Math.min(old.offset, 128)) === old.head &&
        digest(Math.max(0, old.offset - 128), old.offset) === old.anchor;
      // A replacement/copy may preserve the already-accounted prefix. Verify
      // that complete prefix once before reusing its offset/model. Ordinary
      // append/reuse never does this historical scan.
      if (keep && (old.identity !== identity || resolve(path) !== old.path)) {
        let hash = EMPTY_HASH;
        let boundary = 0;
        walk(0, old.offset, (line, next) => { hash = extendHash(hash, line); boundary = next; });
        keep = boundary === old.offset && hash === old.prefixHash;
      }
    }
    if (keep && old && old.identity === identity && old.path === resolve(path) && old.offset === size) {
      return { records: [], cursor: value!, bytesRead };
    }
    let offset = keep && old ? old.offset : 0;
    let lineNumber = keep && old ? old.line : 0;
    let model = keep && old ? old.model : "";
    let prefixHash = keep && old ? old.prefixHash : EMPTY_HASH;
    let lastUsageSnapshot = keep && old ? old.lastUsageSnapshot : undefined;
    const legacy = keep && old ? old.legacyLine ?? -1
      : !old && value !== null && /^\d+$/.test(value) ? Number(value) : -1;
    const records: Array<{ payload: unknown; model: string }> = [];
    walk(offset, size, (line, next) => {
      prefixHash = extendHash(prefixHash, line);
      offset = next;
      const index = lineNumber++;
      let record;
      try { record = JSON.parse(line.toString("utf8").replace(/^\uFEFF/, "")); } catch { return; }
      if (!record || typeof record !== "object") return;
      if ((record.type === "session_meta" || record.type === "turn_context") &&
          typeof record.payload?.model === "string" && record.payload.model.length > 0) model = record.payload.model;
      if (record.type === "event_msg" && record.payload?.type === "token_count") {
        const snapshot = codexUsageSnapshot(record.payload);
        if (index > legacy && (!snapshot || snapshot !== lastUsageSnapshot)) records.push({ payload: record.payload, model });
        if (snapshot) lastUsageSnapshot = snapshot;
      }
    });
    if (legacy >= lineNumber && offset === size) {
      // A numeric legacy cursor cannot point beyond a settled EOF. Treat a
      // shortened rollout as a fresh generation instead of silently skipping
      // its new usage. Pending unterminated legacy lines are handled below.
      const reset = readCodexRollout(path, null);
      reset.bytesRead += bytesRead;
      return reset;
    }
    const head = digest(0, Math.min(offset, 128));
    const anchor = digest(Math.max(0, offset - 128), offset);
    if (fstatSync(fd, { bigint: true }).size < stat.size ||
        (keep && old && (digest(0, Math.min(old.offset, 128)) !== old.head ||
          digest(Math.max(0, old.offset - 128), old.offset) !== old.anchor))) {
      throw new Error("Rollout changed during read");
    }
    const cursor: ByteCursor = { version: 1, path: resolve(path), identity, offset,
      line: lineNumber, model, prefixHash, head, anchor };
    if (lastUsageSnapshot) cursor.lastUsageSnapshot = lastUsageSnapshot;
    if (legacy >= lineNumber) cursor.legacyLine = legacy;
    const serialized = JSON.stringify(cursor);
    return { records, cursor: serialized, bytesRead };
  } finally { closeSync(fd); }
}
