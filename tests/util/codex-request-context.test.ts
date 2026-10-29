import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { resolveCodexRequestContext, resolveCodexSessionCwd } from "../../src/util/project-dir.js";

const cleanup: string[] = [];
const alpha = "11111111-1111-4111-8111-111111111111";
const beta = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  for (const root of cleanup.splice(0)) {
    expect(resolve(root).startsWith(resolve(tmpdir()) + sep)).toBe(true);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ctx-codex-context-"));
  cleanup.push(root);
  const sessions = join(root, "sessions", "2026", "10", "27");
  mkdirSync(sessions, { recursive: true });
  function transcript(id: string, cwd: string, recordedId = id) {
    const file = join(sessions, `rollout-test-${id}.jsonl`);
    writeFileSync(file, JSON.stringify({ type: "session_meta", payload: { id: recordedId, cwd } }) + "\n");
    return file;
  }
  return { root, transcript };
}

describe("Codex request workspace identity", () => {
  it("uses the calling thread even when another repo is newer", () => {
    const f = fixture();
    const a = f.transcript(alpha, join(f.root, "alpha"));
    utimesSync(a, new Date(0), new Date(0));
    f.transcript(beta, join(f.root, "beta"));
    expect(resolveCodexRequestContext({ threadId: alpha, sessionId: beta }, f.root)).toEqual({
      projectDir: join(f.root, "alpha"), sessionId: alpha,
    });
    expect(resolveCodexSessionCwd({ codexHome: f.root, sessionId: alpha, transcriptMaxAgeMs: 1 })).toBe(join(f.root, "alpha"));
  });

  it("supports sessionId when the host has no threadId field", () => {
    const f = fixture();
    f.transcript(beta, join(f.root, "beta"));
    expect(resolveCodexRequestContext({ sessionId: beta }, f.root)?.sessionId).toBe(beta);
  });

  it("uses an explicit workspace when the calling thread has no transcript yet", () => {
    const f = fixture();
    f.transcript(beta, join(f.root, "beta"));
    expect(resolveCodexRequestContext({ threadId: alpha }, f.root, join(f.root, "pinned"))).toEqual({
      projectDir: join(f.root, "pinned"), sessionId: alpha,
    });
  });

  it("keeps a known thread's workspace instead of another configured root", () => {
    const f = fixture();
    f.transcript(alpha, join(f.root, "alpha"));
    expect(resolveCodexRequestContext({ threadId: alpha }, f.root, join(f.root, "beta"))).toEqual({
      projectDir: join(f.root, "alpha"), sessionId: alpha,
    });
  });

  it("supports an explicit workspace without a thread identity", () => {
    const f = fixture();
    expect(resolveCodexRequestContext(undefined, f.root, f.root)).toEqual({ projectDir: f.root });
  });

  it.each(["", ".", "relative/repo", "C:/Users/x/.codex/plugins/cache/context-mode/context-mode/1.0.169"])(
    "does not trust invalid workspace %s", (projectDir) => {
      const f = fixture();
      expect(resolveCodexRequestContext(undefined, f.root, projectDir)).toBeNull();
      expect(() => resolveCodexRequestContext({ threadId: alpha }, f.root, projectDir)).toThrow(/refusing/);
    },
  );

  it("rejects malformed thread metadata even with an explicit workspace", () => {
    const f = fixture();
    expect(() => resolveCodexRequestContext({ threadId: "../outside" }, f.root, f.root)).toThrow(/Invalid/);
  });

  it("does not fall back to a different thread for an unknown ID", () => {
    const f = fixture();
    f.transcript(beta, join(f.root, "beta"));
    expect(() => resolveCodexRequestContext({ threadId: alpha }, f.root)).toThrow(/refusing/);
  });

  it("checks the transcript identity rather than trusting its filename", () => {
    const f = fixture();
    f.transcript(alpha, join(f.root, "beta"), beta);
    expect(() => resolveCodexRequestContext({ threadId: alpha }, f.root)).toThrow(/refusing/);
  });

  it.each(["../outside", "", 42])("rejects invalid metadata identity %s", (threadId) => {
    const f = fixture();
    expect(() => resolveCodexRequestContext({ threadId }, f.root)).toThrow();
  });

  it("leaves metadata without Codex identity alone", () => {
    expect(resolveCodexRequestContext(undefined)).toBeNull();
    expect(resolveCodexRequestContext({ callId: "a-call" })).toBeNull();
  });
});
