import "../setup-home";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { getLifetimeStats } from "../../src/session/analytics.js";

/**
 * Issue #460 round-3: `getLifetimeStats` defaults sessionsDir/memoryRoot to
 * `~/.codex/...` when the caller does not pass overrides. Those defaults
 * MUST honor `CODEX_HOME` so users who relocate CC don't see
 * "no sessions found" in `ctx_stats` after the move.
 *
 * We can't directly inspect the resolved defaults (the function returns
 * aggregated counts, not paths), but we CAN pin the contract by:
 *   1. Set `CODEX_HOME=/tmp/X` (empty dir → 0 sessions, 0 events).
 *   2. Confirm the call returns the empty-result shape — no crash on
 *      missing `~/.codex/context-mode/sessions`, no fall-through to homedir.
 *   3. With whitespace-only env, must fall back without crashing.
 */
describe("getLifetimeStats CODEX_HOME routing (#460 round-3)", () => {
  let customCfg: string;
  let saved: string | undefined;

  beforeEach(() => {
    customCfg = mkdtempSync(join(tmpdir(), "ctx-stats-r3-"));
    saved = process.env.CODEX_HOME;
  });

  afterEach(() => {
    rmSync(customCfg, { recursive: true, force: true });
    if (saved === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = saved;
  });

  it("env=customDir → empty stats when relocated dir has no sessions/projects", () => {
    process.env.CODEX_HOME = customCfg;
    const stats = getLifetimeStats({ loadDatabase: () => null });
    expect(stats.totalEvents).toBe(0);
    expect(stats.totalSessions).toBe(0);
  });

  it("env='' empty → falls back to ~/.codex without crashing", () => {
    process.env.CODEX_HOME = "";
    const stats = getLifetimeStats({ loadDatabase: () => null });
    expect(typeof stats.totalEvents).toBe("number");
    expect(typeof stats.totalSessions).toBe("number");
  });

  it("env=' ' whitespace → falls back to ~/.codex without crashing", () => {
    process.env.CODEX_HOME = "   ";
    const stats = getLifetimeStats({ loadDatabase: () => null });
    expect(typeof stats.totalEvents).toBe("number");
    expect(typeof stats.totalSessions).toBe("number");
  });

  it("explicit override beats env (backward compat)", () => {
    process.env.CODEX_HOME = customCfg;
    // sessionsDir override: route to a known-empty path; result must be empty.
    const overrideEmpty = resolve(customCfg, "absent-on-purpose");
    const stats = getLifetimeStats({
      sessionsDir: overrideEmpty,
      memoryRoot: overrideEmpty,
      loadDatabase: () => null,
    });
    expect(stats.totalEvents).toBe(0);
    expect(stats.totalSessions).toBe(0);
  });
});
