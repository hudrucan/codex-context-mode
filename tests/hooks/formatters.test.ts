import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Dynamic import for .mjs modules
let claudeCodeFormat: (decision: unknown) => unknown;
let geminiCliFormat: (decision: unknown) => unknown;
let vscodeCopilotFormat: (decision: unknown) => unknown;
let cursorFormat: (decision: unknown) => unknown;
// Kimi has no standalone formatter — same convention as codex; the only
// source of truth is the central registry in hooks/core/formatters.mjs.
let kimiFormat: (decision: unknown) => unknown;
// agy has no standalone formatter either — same central-registry convention.
let agyFormat: (decision: unknown) => unknown;
// codex has no standalone formatter — central registry only. It takes an
// optional capability hint ({ codexSupportsRewrite }) threaded by the hook (#845).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose test seams over .mjs
let codexFormat: (decision: unknown, opts?: any) => unknown;
// codex capability detection helpers (#845, hooks/core/codex-caps.mjs).
let parseCodexVersion: (raw: unknown) => number[] | null;
let versionGte: (a: number[], b: number[]) => boolean;
let codexSupportsUpdatedInput: (io?: any) => boolean;
let MIN_REWRITE_VERSION: number[];

beforeAll(async () => {
  const coreMod = await import("../../hooks/core/formatters.mjs");
  codexFormat = (decision: unknown, opts?: Record<string, unknown>) =>
    coreMod.formatDecision("codex", decision as { action: string } | null, opts);

  const capsMod = await import("../../hooks/core/codex-caps.mjs");
  parseCodexVersion = capsMod.parseCodexVersion;
  versionGte = capsMod.versionGte;
  codexSupportsUpdatedInput = capsMod.codexSupportsUpdatedInput;
  MIN_REWRITE_VERSION = capsMod.MIN_REWRITE_VERSION;
});

// ─── Shared test decisions ───────────────────────────────

const denyDecision = {
  action: "deny",
  reason: "WebFetch blocked. Use fetch_and_index instead.",
};

const askDecision = {
  action: "ask",
};

const modifyDecision = {
  action: "modify",
  updatedInput: {
    command: 'echo "context-mode: curl/wget blocked."',
  },
};

const contextDecision = {
  action: "context",
  additionalContext: "<context_guidance>Use execute_file instead</context_guidance>",
};

// ─── Codex formatter (#845) ──────────────────────────────
// hooks/core/formatters.mjs owns Codex PreToolUse formatting → "Hook formatting"
// maps here per CONTRIBUTING.md. Capability detection (codex-caps.mjs) is part of
// the same #845 feature, so its unit tests live here too rather than a new file.
describe("codex formatter (#845)", () => {
  describe("modify", () => {
    it("capable Codex: emits permissionDecision:allow + updatedInput (command rewrite)", () => {
      const out = codexFormat(modifyDecision, { codexSupportsRewrite: true }) as {
        hookSpecificOutput: Record<string, unknown>;
      };
      expect(out.hookSpecificOutput).toEqual({
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        updatedInput: { command: 'echo "context-mode: curl/wget blocked."' },
      });
    });

    it("incapable Codex: FAILS CLOSED as a deny carrying the extracted guidance", () => {
      const out = codexFormat(modifyDecision, { codexSupportsRewrite: false }) as {
        hookSpecificOutput: Record<string, unknown>;
      };
      expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
      expect(out.hookSpecificOutput.permissionDecisionReason).toBe("context-mode: curl/wget blocked.");
      expect(out.hookSpecificOutput).not.toHaveProperty("updatedInput");
    });

    it("incapable Codex: never silently passes a command redirect through", () => {
      expect(codexFormat(modifyDecision, { codexSupportsRewrite: false })).not.toBeNull();
    });

    it("incapable Codex: non-command rewrite (Agent prompt) is dropped, not denied", () => {
      const promptModify = { action: "modify", updatedInput: { prompt: "routing block" } };
      expect(codexFormat(promptModify, { codexSupportsRewrite: false })).toBeNull();
    });

    it("defaults to fail-closed when no capability hint is given", () => {
      const out = codexFormat(modifyDecision) as { hookSpecificOutput: Record<string, unknown> };
      expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
    });
  });

  describe("context", () => {
    it("capable Codex: surfaces additionalContext", () => {
      const out = codexFormat(contextDecision, { codexSupportsRewrite: true });
      expect(out).toEqual({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: contextDecision.additionalContext,
        },
      });
    });

    it("incapable Codex: drops the advisory nudge (no rejected shape emitted)", () => {
      expect(codexFormat(contextDecision, { codexSupportsRewrite: false })).toBeNull();
    });
  });

  describe("deny / ask", () => {
    it("deny still emits permissionDecision:deny with the reason", () => {
      const out = codexFormat(denyDecision) as { hookSpecificOutput: Record<string, unknown> };
      expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
      expect(out.hookSpecificOutput.permissionDecisionReason).toBe(denyDecision.reason);
    });

    it("ask is dropped — Codex rejects permissionDecision:ask", () => {
      expect(codexFormat(askDecision)).toBeNull();
      expect(codexFormat(askDecision, { codexSupportsRewrite: true })).toBeNull();
    });
  });
});

// ─── Codex capability detection (#845) ───────────────────
describe("codexSupportsUpdatedInput (#845)", () => {
  let dir: string;
  let cachePath: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cm-codex-caps-"));
    cachePath = join(dir, "caps.json");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("parseCodexVersion parses the version line, null on garbage", () => {
    expect(parseCodexVersion("codex-cli 0.141.0")).toEqual([0, 141, 0]);
    expect(parseCodexVersion("codex 0.139.2\n")).toEqual([0, 139, 2]);
    expect(parseCodexVersion("no version")).toBeNull();
  });

  it("versionGte compares major/minor/patch (equal → true)", () => {
    expect(versionGte([0, 141, 0], MIN_REWRITE_VERSION)).toBe(true);
    expect(versionGte([0, 140, 9], [0, 141, 0])).toBe(false);
    expect(versionGte([1, 0, 0], [0, 141, 0])).toBe(true);
  });

  it("true for a supported version, false (fail closed) for older", () => {
    expect(codexSupportsUpdatedInput({ runVersion: () => "codex-cli 0.141.0", now: () => 1000, cachePath })).toBe(true);
    rmSync(cachePath, { force: true });
    expect(codexSupportsUpdatedInput({ runVersion: () => "codex-cli 0.140.0", now: () => 1000, cachePath })).toBe(false);
  });

  it("fails closed when codex is absent / probe throws", () => {
    expect(
      codexSupportsUpdatedInput({ runVersion: () => { throw new Error("ENOENT"); }, now: () => 1000, cachePath }),
    ).toBe(false);
  });

  it("serves a fresh cached result without re-probing, re-probes after TTL", () => {
    codexSupportsUpdatedInput({ runVersion: () => "codex-cli 0.141.0", now: () => 1000, cachePath });
    expect(
      codexSupportsUpdatedInput({ runVersion: () => { throw new Error("must not run within TTL"); }, now: () => 1000 + 60_000, cachePath }),
    ).toBe(true);
    expect(
      codexSupportsUpdatedInput({ runVersion: () => "codex-cli 0.140.0", now: () => 1000 + 2 * 60 * 60 * 1000, cachePath }),
    ).toBe(false);
  });
});
