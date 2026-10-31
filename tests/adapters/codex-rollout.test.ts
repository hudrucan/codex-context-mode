import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readCodexUsageIncremental, findCodexRollout } from "../../src/adapters/codex/usage.js";

vi.mock("node:fs", async (original) => {
  const mod = await original<typeof import("node:fs")>();
  return { ...mod, readdirSync: vi.fn(mod.readdirSync) };
});
afterEach(() => vi.clearAllMocks());

function fixture() {
  const root = fs.mkdtempSync(join(tmpdir(), "codex-byte-rollout-"));
  const dir = join(root, "sessions"); fs.mkdirSync(dir);
  return { root, path: join(dir, "rollout-test-session-one.jsonl") };
}
const model = (id = "gpt-5") => JSON.stringify({ type: "turn_context", payload: { model: id } }) + "\n";
const usage = (input = 100, output = 20) => JSON.stringify({ type: "event_msg", payload: {
  type: "token_count", info: { last_token_usage: { input_tokens: input, output_tokens: output,
    reasoning_output_tokens: 5, cached_input_tokens: 40, total_tokens: input + output } },
} }) + "\n";

describe("incremental Codex rollout bytes", () => {
  it("suppresses proven rate-limit re-emissions across Stops, not equal valid response deltas", () => {
    const f = fixture();
    const row = (total: number, limit: number) => JSON.stringify({ type: "event_msg", payload: {
      type: "token_count", info: {
        last_token_usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
        total_token_usage: { input_tokens: total, output_tokens: total / 5, total_tokens: total * 1.2 },
      }, rate_limits: { remaining: limit },
    } }) + "\n";
    fs.writeFileSync(f.path, model() + row(100, 90));
    const first = readCodexUsageIncremental(f.path, null);
    fs.appendFileSync(f.path, row(100, 80));
    const metadata = readCodexUsageIncremental(f.path, first.cursor);
    expect(metadata.events).toEqual([]);
    expect(metadata.cursor).not.toBe(first.cursor);
    fs.appendFileSync(f.path, row(200, 70));
    const second = readCodexUsageIncremental(f.path, metadata.cursor);
    expect(second.events[0].input_tokens).toBe(100);
    expect(second.events[0].output_tokens).toBe(20);
  });
  it("does not read the historical prefix on reuse, and retains the model for tail-only usage", () => {
    const f = fixture();
    const history = model() + (JSON.stringify({ type: "response_item", payload: "x".repeat(1000) }) + "\n").repeat(10000) + usage();
    fs.writeFileSync(f.path, history);
    const first = readCodexUsageIncremental(f.path, null);
    expect(first.events[0].input_tokens).toBe(60);
    const reuse = readCodexUsageIncremental(f.path, first.cursor);
    expect(reuse.events).toEqual([]);
    expect(reuse.cursor).toBe(first.cursor);
    expect(reuse.bytesRead).toBeLessThanOrEqual(256);
    fs.appendFileSync(f.path, usage(200));
    const appended = readCodexUsageIncremental(f.path, reuse.cursor);
    expect(appended.events[0].input_tokens).toBe(160);
    expect(appended.events[0].model_id).toBe("gpt-5");
    expect(appended.bytesRead).toBeLessThan(usage(200).length + 1024);
    expect(JSON.parse(appended.cursor).offset).toBe(fs.statSync(f.path).size);
  });

  it("keeps partial JSON/UTF-8 on disk and commits only newline-terminated records", () => {
    const f = fixture();fs.writeFileSync(f.path, model());
    const first = readCodexUsageIncremental(f.path, null);
    const row = Buffer.from(usage().replace('"token_count"', '"token_count","note":"đúng ✓"'));
    const split = row.indexOf(Buffer.from("✓")) + 1;
    fs.appendFileSync(f.path, row.subarray(0, split));
    const partial = readCodexUsageIncremental(f.path, first.cursor);
    expect(partial.cursor).toBe(first.cursor);
    expect(partial.events).toEqual([]);
    fs.appendFileSync(f.path, row.subarray(split, row.length - 1));
    expect(readCodexUsageIncremental(f.path, partial.cursor).events).toEqual([]);
    fs.appendFileSync(f.path, "\n");
    const complete = readCodexUsageIncremental(f.path, partial.cursor);
    expect(complete.events).toHaveLength(1);
    expect(JSON.parse(complete.cursor).offset).toBe(fs.statSync(f.path).size);
  });

  it("migrates a legacy line cursor once, including physical blank/malformed lines", () => {
    const f = fixture(); fs.writeFileSync(f.path, model() + usage() + "\nnot-json\n" + usage(200));
    const migrated = readCodexUsageIncremental(f.path, "1");
    expect(migrated.events).toHaveLength(1);
    expect(migrated.events[0].input_tokens).toBe(160);
    expect(JSON.parse(migrated.cursor).line).toBe(5);
    expect(readCodexUsageIncremental(f.path, migrated.cursor).events).toEqual([]);
  });

  it("does not replay an already-counted legacy final line when its newline arrives later", () => {
    const f = fixture();fs.writeFileSync(f.path, model() + usage().trimEnd());
    const migrated = readCodexUsageIncremental(f.path, "1");
    expect(migrated.events).toEqual([]);
    expect(JSON.parse(migrated.cursor).legacyLine).toBe(1);
    fs.appendFileSync(f.path, "\n" + usage(200));
    const appended = readCodexUsageIncremental(f.path, migrated.cursor);
    expect(appended.events).toHaveLength(1);
    expect(appended.events[0].input_tokens).toBe(160);
    expect(JSON.parse(appended.cursor).legacyLine).toBeUndefined();
  });

  it("resets a legacy cursor beyond a truncated settled EOF", () => {
    const f = fixture();fs.writeFileSync(f.path, model() + usage());
    expect(readCodexUsageIncremental(f.path, "200").events[0].input_tokens).toBe(60);
  });

  it("preserves model changes, null usage, and valid equal response deltas", () => {
    const f = fixture(); fs.writeFileSync(f.path, model() + usage() + usage());
    const first = readCodexUsageIncremental(f.path, null);
    expect(first.events[0].input_tokens).toBe(120);
    fs.appendFileSync(f.path, model("gpt-4.1") + JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: null } }) + "\n" + usage());
    const second = readCodexUsageIncremental(f.path, first.cursor);
    expect(second.events).toHaveLength(1);
    expect(second.events[0].model_id).toBe("gpt-4.1");
  });

  it("survives truncation and same-path replacement, without replaying a verified copied prefix", () => {
    const f = fixture(); const prefix = model() + usage(); fs.writeFileSync(f.path, prefix);
    const first = readCodexUsageIncremental(f.path, null);
    fs.renameSync(f.path, f.path + ".old"); fs.writeFileSync(f.path, prefix + usage(200));
    const copied = readCodexUsageIncremental(f.path, first.cursor);
    expect(copied.events).toHaveLength(1);
    expect(copied.events[0].input_tokens).toBe(160);
    fs.writeFileSync(f.path, model("gpt-4.1") + usage(50));
    const truncated = readCodexUsageIncremental(f.path, copied.cursor);
    expect(truncated.events[0].input_tokens).toBe(10);
    expect(truncated.events[0].model_id).toBe("gpt-4.1");
    expect(readCodexUsageIncremental(f.path, truncated.cursor).events).toEqual([]);
  });

  it("detects replacement changes inside a prefix even with unchanged head/anchor", () => {
    const f = fixture();const padding = JSON.stringify({ type: "response_item", payload: "x".repeat(300) }) + "\n";
    fs.writeFileSync(f.path, padding + model() + usage(100) + padding);
    const first = readCodexUsageIncremental(f.path, null);
    fs.renameSync(f.path, f.path + ".old"); fs.writeFileSync(f.path, padding + model() + usage(200) + padding);
    expect(readCodexUsageIncremental(f.path, first.cursor).events[0].input_tokens).toBe(160);
  });

  it("reuses a valid cached path without directory traversal, and rejects another session/outside root", () => {
    const f = fixture(); fs.writeFileSync(f.path, model() + usage());
    const cursor = readCodexUsageIncremental(f.path, null).cursor;
    vi.mocked(fs.readdirSync).mockClear();
    expect(findCodexRollout("session-one", f.root, cursor)).toBe(f.path);
    expect(fs.readdirSync).not.toHaveBeenCalled();
    expect(findCodexRollout("session-two", f.root, cursor)).toBeNull();
    const outside = join(f.root, "rollout-outside-session-one.jsonl"); fs.writeFileSync(outside, model());
    const bad = JSON.stringify({ ...JSON.parse(cursor), path: outside });
    expect(findCodexRollout("session-one", f.root, bad)).toBe(f.path);
    fs.renameSync(f.path, f.path + ".old");
    expect(findCodexRollout("session-one", f.root, bad)).toBeNull();
    const rotated = join(f.root, "sessions", "rollout-rotated-session-one.jsonl"); fs.writeFileSync(rotated, model());
    expect(findCodexRollout("session-one", f.root, cursor)).toBe(rotated);
    expect(findCodexRollout("../session-one", f.root, cursor)).toBeNull();
  });
});
