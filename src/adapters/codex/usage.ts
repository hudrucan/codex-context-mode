/**
 * Codex 0.164.0 usage from rollout token_count records.
 *
 * Responses input/output totals already include cached/reasoning details.
 * parseCodexUsage returns disjoint pricing buckets and the inclusive provider
 * counters separately. Cache-write details also come from inclusive input.
 * See codex-rs/codex-api/src/sse/responses.rs and protocol/src/protocol.rs at
 * tag rust-v0.164.0. No shared adapter/pricing semantics are changed here.
 *
 * last_token_usage is a response delta, not proof of a newly completed turn:
 * repeated token_count snapshots require separate semantic investigation.
 * The legacy extractor below gates physical lines, not equal token amounts.
 */

import {
  type AgentUsageCounts,
  type SessionEvent,
  buildAgentUsageEvent,
} from "../../session/extract.js";
import { readCodexRollout, codexUsageSnapshot } from "./rollout.js";
export { findCodexRollout } from "./rollout.js";

/** Codex incremental TokenUsage (protocol.rs:2000). All fields optional/defensive. */
function toNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Inclusive provider counters, kept separate from the disjoint pricing buckets. */
export interface CodexRawUsage {
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}

export interface CodexUsageCounts extends AgentUsageCounts {
  raw_usage: CodexRawUsage;
}

/**
 * Map one codex `token_count` payload's `info.last_token_usage` to the
 * buildAgentUsageEvent input shape, or null when there is nothing to record.
 *
 * @param payload  the `event_msg.payload` object (payload.type === "token_count")
 * @param modelId  model resolved from the enclosing turn_context/session_meta
 *
 * Returns null when:
 *   - payload is not a token_count, or
 *   - info is null/absent (session-start ping or interrupted turn), or
 *   - last_token_usage sums to zero across every billable bucket.
 */
export function parseCodexUsage(
  payload: unknown,
  modelId: string,
): CodexUsageCounts | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.type === "string" && p.type !== "token_count") return null;

  const info = p.info;
  if (!info || typeof info !== "object") return null; // no completed-turn usage
  const last = (info as Record<string, unknown>).last_token_usage;
  if (!last || typeof last !== "object") return null;
  const u = last as Record<string, unknown>;

  const raw_usage: CodexRawUsage = {
    input_tokens: toNum(u.input_tokens),
    cached_input_tokens: toNum(u.cached_input_tokens),
    cache_write_input_tokens: toNum(u.cache_write_input_tokens),
    output_tokens: toNum(u.output_tokens),
    reasoning_output_tokens: toNum(u.reasoning_output_tokens),
    total_tokens: toNum(u.total_tokens),
  };
  // Codex 0.164.0 copies inclusive Responses usage plus its input/output
  // details. Reasoning is already in output. Split input exactly once across
  // uncached, cache-read and cache-write buckets; unknown write rates fall back
  // to the input rate in the shared catalog. Other adapters are unchanged.
  const input = Math.max(0, raw_usage.input_tokens);
  const cache_read_tokens = Math.min(input, Math.max(0, raw_usage.cached_input_tokens));
  const cache_creation_tokens = Math.min(input - cache_read_tokens, Math.max(0, raw_usage.cache_write_input_tokens));
  const input_tokens = input - cache_read_tokens - cache_creation_tokens;
  const output_tokens = Math.max(0, raw_usage.output_tokens);

  if (
    input_tokens <= 0 &&
    output_tokens <= 0 &&
    cache_read_tokens <= 0 &&
    cache_creation_tokens <= 0
  ) {
    return null;
  }

  return {
    model_id: typeof modelId === "string" ? modelId : "",
    input_tokens,
    output_tokens,
    cache_creation_tokens,
    cache_read_tokens,
    native_cost_usd: null, // codex rollout carries no native USD; catalog derives
    raw_usage,
  };
}

/**
 * Cursor-aware codex rollout reader for the Stop hook.
 *
 * The rollout grows every turn and the forward loop forwards ALL passed events
 * unconditionally, so re-summing the whole rollout each Stop would double-count
 * every prior turn. This walks only the `token_count` records NEW since the
 * last Stop, keyed by a per-session high-water cursor.
 *
 * The cursor is the 0-based LINE INDEX of the last `token_count` record we have
 * already processed (stored as a decimal string in the usage_cursor column).
 * Line index is a stable monotonic key here because codex APPENDS to the
 * rollout (it never rewrites/compacts a line in place), so a prior line's
 * position never shifts.
 *
 *   - sinceCursor null/empty → process ALL token_count records.
 *   - sinceCursor = "N"      → process only token_count records at line idx > N.
 *
 * Model resolution: we track the most-recent `model` seen on any preceding
 * `turn_context` (protocol.rs:1977) or `session_meta`; each token_count is
 * attributed to that model. Sums are grouped per-model and emitted via the
 * shared buildAgentUsageEvent path (so a session that switches models mid-run
 * yields one agent_usage event per model for the new slice).
 *
 * `cursor` returns the line index of the LAST line in the rollout (string),
 * so the next Stop resumes strictly past it. When the rollout is empty/
 * unparseable, the input cursor is returned unchanged. Same linear JSONL walk,
 * JSON.parse per line, NO regex.
 */
function buildCodexUsageEvents(records: Array<{ payload: unknown; model: string }>): SessionEvent[] {
  const sums = new Map<string, CodexUsageCounts>();
  for (const record of records) {
    const counts = parseCodexUsage(record.payload, record.model);
    if (!counts) continue;
    const sum = sums.get(record.model);
    if (!sum) { sums.set(record.model, counts); continue; }
    sum.input_tokens += counts.input_tokens;
    sum.output_tokens += counts.output_tokens;
    sum.cache_read_tokens += counts.cache_read_tokens;
    sum.cache_creation_tokens += counts.cache_creation_tokens;
    for (const field of Object.keys(sum.raw_usage) as Array<keyof CodexRawUsage>) {
      sum.raw_usage[field] += counts.raw_usage[field];
    }
  }
  const events: SessionEvent[] = [];
  for (const sum of sums.values()) {
    const event = buildAgentUsageEvent(sum);
    if (event) {
      event.data += ` model_id:${JSON.stringify(sum.model_id)} raw_usage:${JSON.stringify(sum.raw_usage)}`;
      events.push(event);
    }
  }
  return events;
}

export function extractCodexUsageSince(
  rollout: string,
  sinceCursor: string | null,
): { events: SessionEvent[]; cursor: string | null } {
  if (typeof rollout !== "string" || !rollout) return { events: [], cursor: sinceCursor };
  const since = sinceCursor === null ? -1 : Number.parseInt(sinceCursor, 10);
  let model = "";
  let last = -1;
  let lastUsageSnapshot: string | undefined;
  const records: Array<{ payload: unknown; model: string }> = [];
  for (const [i, line] of rollout.split("\n").entries()) {
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (!rec || typeof rec !== "object") continue;
    last = i;
    if ((rec.type === "turn_context" || rec.type === "session_meta") &&
        typeof rec.payload?.model === "string" && rec.payload.model.length > 0) model = rec.payload.model;
    if (rec.type === "event_msg" && rec.payload?.type === "token_count") {
      const snapshot = codexUsageSnapshot(rec.payload);
      if (!(i <= since) && (!snapshot || snapshot !== lastUsageSnapshot)) records.push({ payload: rec.payload, model });
      if (snapshot) lastUsageSnapshot = snapshot;
    }
  }
  return { events: buildCodexUsageEvents(records), cursor: last < 0 ? sinceCursor : String(last) };
}

/** Bounded byte-offset reader used by the native Stop hook. */
export function readCodexUsageIncremental(path: string, cursor: string | null) {
  const result = readCodexRollout(path, cursor);
  return { events: buildCodexUsageEvents(result.records), cursor: result.cursor, bytesRead: result.bytesRead };
}
