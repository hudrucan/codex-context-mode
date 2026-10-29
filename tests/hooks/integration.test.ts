import { runtimeCacheDir } from "../../hooks/runtime-paths.mjs";
/**
 * Hook Integration Tests
 *
 * Consolidated from:
 * - tests/hook-integration.test.ts (pre-tool-use.mjs hook tests)
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { basename, join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  rmdirSync,
  readdirSync,
  existsSync,
  unlinkSync,
} from "node:fs";

// Robust recursive delete — fs.rmSync silently no-ops on Windows when the
// target path lives under a tmpdir whose name contains non-ASCII chars (#454).
function rmSyncRobust(dir: string) {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
  if (!existsSync(dir)) return;
  try {
    for (const name of readdirSync(dir)) {
      try { unlinkSync(resolve(dir, name)); } catch {}
    }
    rmdirSync(dir);
  } catch {}
}
import { tmpdir } from "node:os";

// ═══════════════════════════════════════════════════════════════════════
// Hook Integration Tests -- pre-tool-use.mjs
// ═══════════════════════════════════════════════════════════════════════

const __dirname = dirname(fileURLToPath(import.meta.url));
// Simulate modern Codex capabilities in an isolated temp/cache directory.
const savedTmpEnv = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR };
const codexHookTemp = mkdtempSync(join(tmpdir(), "ctx-codex-hooks-"));
process.env.TEMP = process.env.TMP = process.env.TMPDIR = codexHookTemp;
writeFileSync(join(codexHookTemp, "context-mode-codex-caps.json"), JSON.stringify({ at: Date.now(), supported: true }));
afterAll(() => {
  for (const [key, value] of Object.entries(savedTmpEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  rmSync(codexHookTemp, { recursive: true, force: true });
});
const HOOK_PATH = join(__dirname, "..", "..", "hooks", "codex", "pre-tool-use.mjs");

// Clean guidance throttle markers before each test so guidance fires fresh.
// Subprocess hooks scope markers two ways (#298): the legacy ppid-based dir
// (kept as fallback when no sessionId is passed) and the sessionId-scoped dir
// (derived from getSessionId which falls back to `pid-${process.ppid}` when
// the hook payload has no session_id).
const _wid = process.env.VITEST_WORKER_ID;
const _guidanceSuffix = _wid ? `${process.pid}-w${_wid}` : String(process.pid);
const _guidanceDir = resolve(runtimeCacheDir(), `codex-context-mode-guidance-${_guidanceSuffix}`);
const _sessionGuidanceDir = resolve(runtimeCacheDir(), `codex-context-mode-guidance-s-pid-${process.pid}`);

// MCP readiness sentinel — subprocess hooks check process.ppid (= this test's pid)
// Use the same sentinel directory that isMCPReady() scans: /tmp on Unix, tmpdir() on Windows.
// On macOS, tmpdir() returns /var/folders/... but isMCPReady() hardcodes /tmp — if we write
// the sentinel to tmpdir(), CI environments (with no running MCP server in /tmp) will fail
// because isMCPReady() returns false and all mcpRedirect() calls become passthrough (#347).
const mcpSentinelDir = runtimeCacheDir();
const mcpSentinel = resolve(mcpSentinelDir, `context-mode-mcp-ready-${process.pid}`);

beforeEach(() => {
  rmSyncRobust(_guidanceDir);
  rmSyncRobust(_sessionGuidanceDir);
  writeFileSync(mcpSentinel, String(process.pid));
});

afterEach(() => {
  try { unlinkSync(mcpSentinel); } catch {}
});

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runHook(input: Record<string, unknown>, env?: Record<string, string>, { bom = false } = {}): HookResult {
  const json = JSON.stringify({ ...input, cwd: input.cwd ?? env?.CONTEXT_MODE_PROJECT_DIR ?? process.cwd() });
  const result = spawnSync("node", [HOOK_PATH], {
    input: bom ? "\uFEFF" + json : json,
    encoding: "utf-8",
    timeout: 30_000,
    env: { ...process.env, CONTEXT_MODE_MCP_SENTINEL_DIR: mcpSentinelDir, ...env },
  });
  const rawOutput = (result.stdout ?? "").trim();
  const passthrough = rawOutput === JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse" } });
  return {
    exitCode: result.status ?? 1,
    stdout: passthrough ? "" : rawOutput,
    stderr: (result.stderr ?? "").trim(),
  };
}

/**
 * Assert hook redirects Bash command via `permissionDecision: "deny"` + reason.
 *
 * CC v2.1.x Bash tool ignores `updatedInput.command` substitution under
 * `permissionDecision: "allow"` — original command runs unchanged. Only
 * `permissionDecision: "deny"` is honored for Bash blocking (verified via
 * /diagnose Phase 4 forced-deny probe). The claude-code formatter now emits
 * a deny shape for modify intent and surfaces the routing guidance via
 * `permissionDecisionReason`.
 */
function assertRedirect(result: HookResult, substringInReason: string) {
  assert.equal(result.exitCode, 0);
  const hso = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(hso.hookEventName, "PreToolUse");
  if (hso.updatedInput) {
    assert.equal(hso.permissionDecision, "allow");
    assert.ok(hso.updatedInput.command.includes(substringInReason));
  } else {
    assert.equal(hso.permissionDecision, "deny");
    assert.ok(hso.permissionDecisionReason.includes(substringInReason));
  }
}
/** Assert hook denies with permissionDecision: deny */
function assertDeny(result: HookResult, substringInReason: string) {
  assert.equal(result.exitCode, 0, `Expected exit 0, got ${result.exitCode}`);
  assert.ok(result.stdout.length > 0, "Expected non-empty stdout for deny");
  const parsed = JSON.parse(result.stdout);
  const hso = parsed.hookSpecificOutput;
  assert.ok(hso, "Expected hookSpecificOutput in response");
  assert.equal(hso.permissionDecision, "deny", `Expected permissionDecision=deny`);
  assert.ok(
    hso.permissionDecisionReason.includes(substringInReason),
    `Expected permissionDecisionReason to contain "${substringInReason}", got: ${hso.permissionDecisionReason}`,
  );
}

function assertPassthrough(result: HookResult) {
  assert.equal(result.exitCode, 0, `Expected exit 0, got ${result.exitCode}`);
  assert.equal(result.stdout, "");
}

function assertHookSpecificOutput(result: HookResult, key: string) {
  assert.equal(result.exitCode, 0, `Expected exit 0, got ${result.exitCode}`);
  assert.ok(result.stdout.length > 0, "Expected non-empty stdout for hookSpecificOutput");
  const parsed = JSON.parse(result.stdout);
  assert.ok(parsed.hookSpecificOutput, "Expected hookSpecificOutput in response");
  assert.equal(parsed.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.ok(
    parsed.hookSpecificOutput[key] !== undefined,
    `Expected hookSpecificOutput.${key} to be defined`,
  );
}

describe("Bash: Redirected Commands", () => {
  test("Bash + curl: redirected to echo via updatedInput", () => {
    const result = runHook({
      tool_name: "Bash",
      tool_input: { command: "curl -s http://example.com" },
    });
    assertRedirect(result, "context-mode");
  });

  test("Bash + wget: redirected to echo via updatedInput", () => {
    const result = runHook({
      tool_name: "Bash",
      tool_input: { command: "wget http://example.com/file.tar.gz" },
    });
    assertRedirect(result, "context-mode");
  });

  test("Bash + node -e with inline HTTP call: redirected to echo", () => {
    const result = runHook({
      tool_name: "Bash",
      tool_input: { command: `node -e "fetch('http://api.example.com/data')"` },
    });
    assertRedirect(result, "context-mode");
  });

  test("Bash + ./gradlew build: redirected to execute sandbox (Issue #38)", () => {
    const result = runHook({
      tool_name: "Bash",
      tool_input: { command: "./gradlew build --info" },
    });
    assertRedirect(result, "Build tool redirected");
  });

  test("Bash + mvn package: redirected to execute sandbox (Issue #38)", () => {
    const result = runHook({
      tool_name: "Bash",
      tool_input: { command: "mvn clean package -DskipTests" },
    });
    assertRedirect(result, "Build tool redirected");
  });
});

describe("Bash: Allowed Commands", () => {
  // After #463 the Bash routing nudge is short-circuited for structurally-
  // bounded commands (pwd, whoami, git status, mkdir, --version probes,
  // etc.) — those return null. Use unbounded commands here so we still pin
  // the "normal Bash command → context guidance" path end-to-end.
  test("Bash + npm install: additionalContext with BASH_GUIDANCE", () => {
    const result = runHook({
      tool_name: "Bash",
      tool_input: { command: "npm install" },
    });
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.hookSpecificOutput.additionalContext, "Expected additionalContext for Bash");
    assert.ok(
      parsed.hookSpecificOutput.additionalContext.includes("<context_guidance>"),
      "Expected <context_guidance> in Bash additionalContext",
    );
  });

  test("Bash + find /: additionalContext with BASH_GUIDANCE", () => {
    const result = runHook({
      tool_name: "Bash",
      tool_input: { command: "find /etc -name '*.conf'" },
    });
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.hookSpecificOutput.additionalContext, "Expected additionalContext for Bash");
    assert.ok(
      parsed.hookSpecificOutput.additionalContext.includes("<context_guidance>"),
      "Expected <context_guidance> in Bash additionalContext",
    );
  });

  test("Bash + git status: short-circuited by #463 allowlist (no nudge)", () => {
    // Pre-#463 this returned BASH_GUIDANCE context. Now it short-circuits
    // before the throttle: result is null and the hook emits nothing.
    const result = runHook({
      tool_name: "Bash",
      tool_input: { command: "git status" },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trim(), "", "Expected empty stdout — null decision should not emit a hook payload");
  });
});

describe("WebFetch", () => {
  test("WebFetch + any URL: denied with sandbox redirect", () => {
    const result = runHook({
      tool_name: "WebFetch",
      tool_input: { url: "https://docs.example.com/api" },
    });
    assertDeny(result, "fetch_and_index");
    const parsed = JSON.parse(result.stdout);
    assert.ok(
      parsed.hookSpecificOutput.permissionDecisionReason.includes("https://docs.example.com/api"),
      "Expected original URL in reason",
    );
    // PR #683 follow-up (ADR-0003 amendment): the deny reason was reframed
    // affirmatively. The negative "Do NOT retry with curl" hint was replaced
    // by a positive imperative retry hint scoped to transient DNS errors and
    // by the ctx_fetch_and_index call instruction. Assert on the affirmative
    // wording instead of the dropped negation.
    assert.ok(
      /Retry the same call on a transient DNS error/.test(parsed.hookSpecificOutput.permissionDecisionReason),
      "Expected positive transient-DNS retry hint in reason",
    );
    assert.ok(
      /Call .*ctx_fetch_and_index/.test(parsed.hookSpecificOutput.permissionDecisionReason),
      "Expected explicit ctx_fetch_and_index call instruction in reason",
    );
  });
});

describe("Task (#241: no longer routed)", () => {
  test("Task tool returns empty stdout (passthrough, no routing)", () => {
    const result = runHook({
      tool_name: "Task",
      tool_input: { prompt: "Analyze this codebase and summarize the architecture." },
    });
    assert.equal(result.exitCode, 0, `Expected exit 0, got ${result.exitCode}`);
    // Task is no longer intercepted — hook produces no hookSpecificOutput
    assert.equal(result.stdout.trim(), "", "Expected empty stdout for passthrough");
  });

  test("TaskCreate returns empty stdout (passthrough)", () => {
    const result = runHook({
      tool_name: "TaskCreate",
      tool_input: { title: "my task" },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trim(), "", "Expected empty stdout for passthrough");
  });

  test("TaskUpdate returns empty stdout (passthrough)", () => {
    const result = runHook({
      tool_name: "TaskUpdate",
      tool_input: { id: "123", status: "done" },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trim(), "", "Expected empty stdout for passthrough");
  });
});

describe("Read", () => {
  test("Read + file_path: hookSpecificOutput with additionalContext nudge", () => {
    const result = runHook({
      tool_name: "Read",
      tool_input: { file_path: "/some/path/to/file.ts" },
    });
    assertHookSpecificOutput(result, "additionalContext");
    const parsed = JSON.parse(result.stdout);
    assert.ok(
      parsed.hookSpecificOutput.additionalContext.includes("ctx_"),
      "Expected nudge to mention context-mode",
    );
    assert.ok(
      parsed.hookSpecificOutput.additionalContext.includes("<context_guidance>"),
      "Expected <context_guidance> XML wrapper in Read nudge",
    );
  });
});

describe("Grep", () => {
  test("Grep + pattern: hookSpecificOutput with additionalContext nudge", () => {
    const result = runHook({
      tool_name: "Grep",
      tool_input: { pattern: "TODO", path: "/src" },
    });
    assertHookSpecificOutput(result, "additionalContext");
    const parsed = JSON.parse(result.stdout);
    assert.ok(
      parsed.hookSpecificOutput.additionalContext.includes("ctx_"),
      "Expected nudge to mention context-mode",
    );
    assert.ok(
      parsed.hookSpecificOutput.additionalContext.includes("<context_guidance>"),
      "Expected <context_guidance> XML wrapper in Grep nudge",
    );
  });
});

describe("Passthrough Tools", () => {
  test("Glob + pattern: passthrough", () => {
    const result = runHook({
      tool_name: "Glob",
      tool_input: { pattern: "**/*.ts" },
    });
    assertPassthrough(result);
  });

  test("WebSearch: passthrough", () => {
    const result = runHook({
      tool_name: "WebSearch",
      tool_input: { query: "typescript best practices" },
    });
    assertPassthrough(result);
  });

  test("Unknown tool (Edit): passthrough", () => {
    const result = runHook({
      tool_name: "Edit",
      tool_input: { file_path: "/tmp/test.ts", old_string: "foo", new_string: "bar" },
    });
    assertPassthrough(result);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// initSecurity loud-failure regression (#466)
// ═══════════════════════════════════════════════════════════════════════
describe("initSecurity loud-failure (#466)", () => {
  test("warns to stderr when build/security.js is missing", async () => {
    const ROUTING_PATH = join(__dirname, "..", "..", "hooks", "core", "routing.mjs");
    const missingBuildDir = join(tmpdir(), `ctx-no-build-${Date.now()}`);
    // Subprocess so the warning isn't deduped by a prior call in this process.
    const code = `
      const { initSecurity } = await import(${JSON.stringify(pathToFileURL(ROUTING_PATH).href)});
      const ok = await initSecurity(${JSON.stringify(missingBuildDir)});
      process.stdout.write(JSON.stringify({ ok }));
    `;
    const r = spawnSync("node", ["--input-type=module", "-e", code], {
      encoding: "utf-8",
      timeout: 10000,
      env: {
        ...process.env,
        CONTEXT_MODE_SUPPRESS_SECURITY_WARNING: "",
        // #558 v1.0.127: initSecurity is now bundle-first. To exercise the
        // "both missing → loud fail" contract, point the bundle test seam at
        // a non-existent path so neither the bundle nor build/security.js
        // can be loaded.
        CONTEXT_MODE_SECURITY_BUNDLE_PATH: join(missingBuildDir, "no-bundle.mjs"),
      },
    });
    assert.equal(r.status, 0, `subprocess failed: ${r.stderr}`);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, false, "initSecurity should return false when both bundle and security.js missing");
    assert.ok(
      r.stderr.includes("security deny patterns will NOT be enforced"),
      `expected loud warning on stderr, got: ${r.stderr}`,
    );
  });

  test("CONTEXT_MODE_SUPPRESS_SECURITY_WARNING silences the warning", async () => {
    const ROUTING_PATH = join(__dirname, "..", "..", "hooks", "core", "routing.mjs");
    const missingBuildDir = join(tmpdir(), `ctx-no-build-${Date.now()}-silent`);
    const code = `
      const { initSecurity } = await import(${JSON.stringify(pathToFileURL(ROUTING_PATH).href)});
      await initSecurity(${JSON.stringify(missingBuildDir)});
    `;
    const r = spawnSync("node", ["--input-type=module", "-e", code], {
      encoding: "utf-8",
      timeout: 10000,
      env: {
        ...process.env,
        CONTEXT_MODE_SUPPRESS_SECURITY_WARNING: "1",
        // #558 v1.0.127: bundle-first — hide the bundle so the warn-or-suppress
        // codepath actually runs (otherwise bundle loads and warning never fires).
        CONTEXT_MODE_SECURITY_BUNDLE_PATH: join(missingBuildDir, "no-bundle.mjs"),
      },
    });
    assert.equal(r.status, 0);
    assert.ok(
      !r.stderr.includes("security deny patterns will NOT be enforced"),
      `expected suppressed warning, got: ${r.stderr}`,
    );
  });
});

describe("Security Policy Enforcement", () => {
  let ISOLATED_HOME: string;
  let MOCK_PROJECT_DIR: string;
  let secEnv: Record<string, string>;

  beforeAll(() => {
    // Set up isolated temp dirs for security tests
    ISOLATED_HOME = join(tmpdir(), `hook-sec-home-${Date.now()}`);
    MOCK_PROJECT_DIR = join(tmpdir(), `hook-sec-project-${Date.now()}`);
    const mockClaudeDir = join(MOCK_PROJECT_DIR, ".claude");
    mkdirSync(join(ISOLATED_HOME, ".claude"), { recursive: true });
    mkdirSync(mockClaudeDir, { recursive: true });

    // Write deny/allow patterns to project settings
    writeFileSync(
      join(mockClaudeDir, "settings.json"),
      JSON.stringify({
        permissions: {
          deny: ["Bash(sudo *)", "Bash(rm -rf /*)", "Read(.env)", "Read(**/.env*)"],
          allow: ["Bash(git:*)", "Bash(ls:*)"],
        },
      }),
    );

    secEnv = { HOME: ISOLATED_HOME, USERPROFILE: ISOLATED_HOME, CODEX_HOME: join(ISOLATED_HOME, ".codex"), CLAUDE_CONFIG_DIR: join(ISOLATED_HOME, ".claude"), CONTEXT_MODE_PROJECT_DIR: MOCK_PROJECT_DIR };
  });

  afterAll(() => {
    try { rmSync(ISOLATED_HOME, { recursive: true, force: true }); } catch {}
    try { rmSync(MOCK_PROJECT_DIR, { recursive: true, force: true }); } catch {}
  });

  test("Security: Bash + sudo denied by deny pattern", () => {
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: "sudo apt install vim" } },
      secEnv,
    );
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
    assert.ok(parsed.hookSpecificOutput.permissionDecisionReason.includes("deny pattern"));
  });

  test("Security: Bash + git allowed, falls through to Stage 2", () => {
    // Use an unbounded command — `git status` now short-circuits via the
    // #463 allowlist before reaching the guidance branch, so it would no
    // longer exercise "falls through to Stage 2 routing → context guidance".
    const result = runHook(
      { tool_name: "Bash", tool_input: { command: "git diff" } },
      secEnv,
    );
    // git is in allow list -> falls through to Stage 2 routing
    // Stage 2: git diff is not in the structurally-bounded allowlist
    // (raw diff can be huge) -> additionalContext with BASH_GUIDANCE
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.hookSpecificOutput.additionalContext, "Allowed Bash command should get additionalContext");
    assert.ok(
      parsed.hookSpecificOutput.additionalContext.includes("<context_guidance>"),
      "Expected <context_guidance> in Bash additionalContext",
    );
  });

  test("Security: MCP execute + shell + sudo denied", () => {
    const result = runHook(
      {
        tool_name: "ctx_execute",
        tool_input: { language: "shell", code: "sudo rm -rf /" },
      },
      secEnv,
    );
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  });

  test("Security: MCP execute + python (non-shell) passthrough", () => {
    const result = runHook(
      {
        tool_name: "ctx_execute",
        tool_input: { language: "python", code: "print('hello')" },
      },
      secEnv,
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "", "Non-shell language should passthrough");
  });

  test("MCP execute enforces hook-input workspace deny rules over a stale environment (#756)", () => {
    const mainRepo = mkdtempSync(join(tmpdir(), "ctx-756-main-"));
    const worktree = mkdtempSync(join(tmpdir(), "ctx-756-worktree-"));
    try {
      mkdirSync(join(worktree, ".claude"), { recursive: true });
      writeFileSync(join(worktree, ".claude", "settings.json"), JSON.stringify({ permissions: { deny: ["Bash(pwd)", "Bash(ls *)"] } }));
      const result = runHook(
        {
          cwd: worktree,
          tool_name: "ctx_execute",
          tool_input: { language: "shell", code: "pwd" },
        },
        { ...secEnv, CONTEXT_MODE_PROJECT_DIR: mainRepo },
      );
      assert.equal(result.exitCode, 0);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
      assert.ok(parsed.hookSpecificOutput.permissionDecisionReason.includes("deny pattern"));
    } finally {
      rmSyncRobust(mainRepo);
      rmSyncRobust(worktree);
    }
  });

  test("Security: MCP execute_file + .env path denied", () => {
    const result = runHook(
      {
        tool_name: "ctx_execute_file",
        tool_input: { path: ".env", language: "shell", code: "cat" },
      },
      secEnv,
    );
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
    assert.ok(parsed.hookSpecificOutput.permissionDecisionReason.includes("Read deny pattern"));
  });

  test("Security: MCP execute_file + safe path passthrough", () => {
    const result = runHook(
      {
        tool_name: "ctx_execute_file",
        tool_input: { path: "src/app.ts", language: "javascript", code: "console.log('ok')" },
      },
      secEnv,
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "", "Safe path should passthrough");
  });

  test("Security: MCP execute_file + safe path but sudo in shell code denied", () => {
    const result = runHook(
      {
        tool_name: "ctx_execute_file",
        tool_input: { path: "src/app.sh", language: "shell", code: "sudo rm -rf /" },
      },
      secEnv,
    );
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  });

  test("Security: MCP batch_execute with sudo in one command denied", () => {
    const result = runHook(
      {
        tool_name: "ctx_batch_execute",
        tool_input: {
          commands: [
            { label: "list", command: "ls -la" },
            { label: "evil", command: "sudo rm -rf /" },
          ],
        },
      },
      secEnv,
    );
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  });

  test("MCP batch_execute enforces hook-input workspace deny rules (#756)", () => {
    const worktree = mkdtempSync(join(tmpdir(), "ctx-756-batch-worktree-"));
    try {
      mkdirSync(join(worktree, ".claude"), { recursive: true });
      writeFileSync(join(worktree, ".claude", "settings.json"), JSON.stringify({ permissions: { deny: ["Bash(pwd)", "Bash(ls *)"] } }));
      const result = runHook(
        {
          cwd: worktree,
          tool_name: "ctx_batch_execute",
          tool_input: {
            commands: [
              { label: "list", command: "ls -la" },
              { label: "git", command: "git log --oneline -5" },
            ],
          },
        },
        secEnv,
      );
      assert.equal(result.exitCode, 0);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
    } finally {
      rmSyncRobust(worktree);
    }
  });
});

describe("Plugin Tool Name Format in ROUTING_BLOCK", () => {
  // When installed via Claude Code plugin marketplace, tool names follow:
  //   mcp__plugin_<plugin-id>_<server-name>__<tool-name>
  // For context-mode: <tool-name>
  // The short form mcp__context-mode__* only works for direct MCP registration.

  const PLUGIN_PREFIX = "";
  const SHORT_PREFIX = "mcp__context-mode__";

  test("Agent routing block uses plugin-format tool names", () => {
    const result = runHook({ tool_name: "Agent", tool_input: { prompt: "Do something." } });
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    const prompt = parsed.hookSpecificOutput.updatedInput.prompt;
    assert.ok(prompt.includes(PLUGIN_PREFIX + "ctx_batch_execute"), "Expected plugin-format ctx_batch_execute");
    assert.ok(prompt.includes(PLUGIN_PREFIX + "ctx_search"), "Expected plugin-format ctx_search");
    assert.ok(prompt.includes(PLUGIN_PREFIX + "ctx_execute"), "Expected plugin-format ctx_execute");
    assert.ok(prompt.includes(PLUGIN_PREFIX + "ctx_fetch_and_index"), "Expected plugin-format ctx_fetch_and_index");
    assert.ok(!prompt.includes(SHORT_PREFIX + "ctx_batch_execute"), "Must not contain short-form ctx_batch_execute");
  });

  test("Read nudge uses plugin-format execute_file tool name", () => {
    const result = runHook({ tool_name: "Read", tool_input: { file_path: "/some/file.ts" } });
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    const ctx = parsed.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes(PLUGIN_PREFIX + "ctx_execute_file"), "Expected plugin-format ctx_execute_file in Read nudge");
    assert.ok(!ctx.includes(SHORT_PREFIX + "ctx_execute_file"), "Read nudge must not contain short-form ctx_execute_file");
  });

  test("Grep nudge uses plugin-format execute tool name", () => {
    const result = runHook({ tool_name: "Grep", tool_input: { pattern: "TODO" } });
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    const ctx = parsed.hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes(PLUGIN_PREFIX + "ctx_execute"), "Expected plugin-format ctx_execute in Grep nudge");
    assert.ok(!ctx.includes(SHORT_PREFIX + "ctx_execute"), "Grep nudge must not contain short-form ctx_execute");
  });

  test("WebFetch deny reason uses plugin-format fetch_and_index tool name", () => {
    const result = runHook({ tool_name: "WebFetch", tool_input: { url: "https://example.com" } });
    assert.equal(result.exitCode, 0);
    const parsed = JSON.parse(result.stdout);
    const reason = parsed.hookSpecificOutput.permissionDecisionReason;
    assert.ok(reason.includes(PLUGIN_PREFIX + "ctx_fetch_and_index"), "Expected plugin-format ctx_fetch_and_index in WebFetch deny");
    assert.ok(!reason.includes(SHORT_PREFIX + "ctx_fetch_and_index"), "WebFetch deny must not contain short-form");
  });

  test("Bash inline-HTTP redirect uses plugin-format execute tool name (in deny reason)", () => {
    // CC v2.1.x Bash tool ignores updatedInput.command — the formatter now
    // emits deny + permissionDecisionReason. The plugin-format tool name
    // assertion moves from updatedInput.command to permissionDecisionReason.
    const bashCmd = "python3 -c 'import requests; requests.get(url)'";
    const result = runHook({ tool_name: "Bash", tool_input: { command: bashCmd } });
    assertRedirect(result, "ctx_execute");
  });
});

describe("Skill Commands", () => {
  const SKILLS_DIR = join(__dirname, "..", "..", "skills");

  test("bundles only the six plugin skills", () => {
    for (const name of ["main", "doctor", "index", "search", "stats", "purge"]) {
      const skill = join(SKILLS_DIR, name, "SKILL.md");
      assert.ok(existsSync(skill));
      assert.ok(readFileSync(skill, "utf8").includes("name: " + name));
    }
    for (const old of ["context-mode", "ctx-doctor", "ctx-index", "ctx-search", "ctx-stats", "ctx-purge", "ctx-upgrade", "ctx-insight"]) {
      assert.ok(!existsSync(join(SKILLS_DIR, old, "SKILL.md")));
    }
  });
});

describe("UTF-8 BOM handling (core/stdin.mjs path)", () => {
  test("pre-tool-use.mjs parses BOM-prefixed stdin without error", () => {
    const result = runHook({
      tool_name: "Glob",
      tool_input: { pattern: "**/*.ts" },
    }, undefined, { bom: true });
    assertPassthrough(result);
  });

  test("pre-tool-use.mjs handles BOM-prefixed Bash input correctly", () => {
    const result = runHook({
      tool_name: "Bash",
      tool_input: { command: "curl -s http://example.com" },
    }, undefined, { bom: true });
    assertRedirect(result, "context-mode");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// parseStdin — safe JSON parse for empty/malformed stdin (#322)
// ═══════════════════════════════════════════════════════════════════════

describe("parseStdin (#322)", () => {
  const HELPERS_PATH = join(__dirname, "..", "..", "hooks", "session-helpers.mjs");

  function runParseTest(raw: string): { parsed: boolean; result: unknown; error?: string } {
    const code = `
      const { parseStdin } = await import(${JSON.stringify(pathToFileURL(HELPERS_PATH).href)});
      try {
        const result = parseStdin(${JSON.stringify(raw)});
        process.stdout.write(JSON.stringify({ parsed: true, result }));
      } catch(e) {
        process.stdout.write(JSON.stringify({ parsed: false, error: e.message }));
      }
    `;
    const r = spawnSync("node", ["--input-type=module", "-e", code], {
      encoding: "utf-8",
      timeout: 10000,
    });
    return JSON.parse(r.stdout);
  }

  test("empty string returns empty object", () => {
    expect(runParseTest("").result).toEqual({});
  });

  test("whitespace-only returns empty object", () => {
    expect(runParseTest("   \n  ").result).toEqual({});
  });

  test("BOM-only returns empty object", () => {
    expect(runParseTest("\uFEFF").result).toEqual({});
  });

  test("valid JSON parsed correctly", () => {
    expect(runParseTest('{"source":"startup"}').result).toEqual({ source: "startup" });
  });

  test("BOM-prefixed JSON parsed correctly", () => {
    expect(runParseTest('\uFEFF{"source":"compact"}').result).toEqual({ source: "compact" });
  });

  test("malformed JSON throws", () => {
    const out = runParseTest("{broken");
    expect(out.parsed).toBe(false);
  });
});

describe("empty stdin resilience (#322)", () => {
  const PROJECT_ROOT = join(__dirname, "..", "..");

  function runHookWithEmptyStdin(hookPath: string): { exitCode: number } {
    const fakeHome = mkdtempSync(join(tmpdir(), "ctx-empty-stdin-"));
    const fakeProject = mkdtempSync(join(tmpdir(), "ctx-empty-project-"));
    try {
      const r = spawnSync("node", [join(PROJECT_ROOT, "hooks", hookPath)], {
        input: "",
        encoding: "utf-8",
        timeout: 15000,
        env: {
          ...process.env,
          HOME: fakeHome,
          CONTEXT_MODE_PROJECT_DIR: fakeProject,
          GEMINI_PROJECT_DIR: fakeProject,
          VSCODE_CWD: fakeProject,
          CURSOR_CWD: fakeProject,
          CONTEXT_MODE_SESSION_SUFFIX: "",
        },
      });
      return { exitCode: r.status ?? -1 };
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
      rmSync(fakeProject, { recursive: true, force: true });
    }
  }

  // All 6 adapters × their hook files
  const hooks = ["codex/session-start.mjs", "codex/pre-tool-use.mjs", "codex/post-tool-use.mjs", "codex/pre-compact.mjs", "codex/user-prompt-submit.mjs", "codex/stop.mjs"];

  for (const hook of hooks) {
    test(`${hook} exits 0 on empty stdin`, () => {
      expect(runHookWithEmptyStdin(hook).exitCode).toBe(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Issue #636 — PreToolUse hook fails on project paths containing spaces.
//
// The self-heal "legacy" branch in pre-tool-use.mjs (only fires when the
// plugin cache lives at a stale-version dir AND hooks.json is absent —
// typical for users who upgraded from <v1.0.108) used to write hook
// commands as the unquoted string `node ${path}`. When the plugin cache
// path contained spaces (Dropbox/iCloud display names, CODEX_HOME
// pointed at a synced folder), the resulting settings.json had a command
// like `node /Users/foo/Library/CloudStorage/Lucas Werneck/.../pre-tool-use.mjs`
// that /bin/sh word-split into pieces, producing the user-visible
// "Failed with non-blocking status code" spam on every tool call.
//
// Regression guard: the rewritten command must round-trip through
// /bin/sh -c without parse errors. Properly quoting the script path
// (via JSON.stringify) is sufficient.
// ═══════════════════════════════════════════════════════════════════════

describe("Issue #636: legacy settings.json rewrite quotes spaced paths", () => {
  // Skip on Windows — the legacy rewrite + /bin/sh assertion are POSIX-only.
  // Windows users go through normalize-hooks.mjs (#378/#582) which is already
  // covered by tests/hooks/windows-hooks-normalization.test.ts.
  const skipOnWindows = process.platform === "win32";

  // The legacy rewrite at hooks/pre-tool-use.mjs:124-135 is a self-contained
  // string mutation. We replicate it here verbatim against the FIXED code so
  // the regression is locked in even if future contributors restructure the
  // block. The test deliberately uses a *spaced* targetDir to mirror the
  // user-reported Dropbox/iCloud scenario from #636.
  function applyLegacyRewrite(command: string, targetDir: string): string | null {
    if (
      command &&
      command.includes(".mjs") &&
      command.includes("context-mode") &&
      !command.includes(targetDir)
    ) {
      const scriptMatch = command.match(/([a-z]+\.mjs)\s*"?\s*$/);
      if (scriptMatch) {
        const scriptPath = resolve(targetDir, "hooks", scriptMatch[1]);
        // MUST match the production form in hooks/pre-tool-use.mjs (#636 fix):
        // path is JSON.stringify'd so spaces inside targetDir survive
        // /bin/sh word-splitting at hook-spawn time.
        return `node ${JSON.stringify(scriptPath)}`;
      }
    }
    return null;
  }

  test.skipIf(skipOnWindows)(
    "rewritten command keeps spaced path quoted so /bin/sh sees one arg",
    () => {
      const spacedTargetDir =
        "/Users/foo/Library/CloudStorage/Dropbox-2olhares/Lucas Werneck/.claude/plugins/cache/context-mode/context-mode/1.0.140";
      const staleCommand =
        "node /old/path/context-mode/0.5.0/hooks/pre-tool-use.mjs";

      const rewritten = applyLegacyRewrite(staleCommand, spacedTargetDir);
      expect(rewritten).not.toBeNull();
      expect(rewritten).toContain("Lucas Werneck");
      expect(rewritten).toContain("/hooks/pre-tool-use.mjs");

      // CORE ASSERTION (#636): /bin/sh -c "<cmd>" must parse the path as
      // a single positional arg, not split on whitespace. Use `printf %s\n`
      // to enumerate the post-split argv — the OLD unquoted form yielded
      // 4 tokens (node, /Users/foo/.../Lucas, Werneck/..., pre-tool-use.mjs);
      // the FIXED form yields exactly 2 (node + quoted script path).
      const probe = spawnSync(
        "/bin/sh",
        ["-c", `set -- ${rewritten}; printf "%s\\n" "$#" "$@"`],
        { encoding: "utf-8", timeout: 5_000 },
      );
      expect(probe.status).toBe(0);
      const lines = probe.stdout.trim().split("\n");
      expect(lines[0]).toBe("2"); // exactly: node + script
      expect(lines[1]).toBe("node");
      expect(lines[2]).toBe(
        resolve(spacedTargetDir, "hooks", "pre-tool-use.mjs"),
      );
    },
  );

  test.skipIf(skipOnWindows)(
    "without the fix, /bin/sh would word-split the spaced path (red baseline)",
    () => {
      // Encode the OLD buggy form so we have a fail-loud regression baseline.
      // This documents what the bug looked like — if anyone ever reverts the
      // fix, the assertion above flips and this one stays as the diagnostic.
      const spacedTargetDir =
        "/Users/foo/Library/CloudStorage/Lucas Werneck/.claude/plugins/cache/context-mode/context-mode/1.0.140";
      const buggyForm =
        "node " + resolve(spacedTargetDir, "hooks", "pre-tool-use.mjs");
      const probe = spawnSync(
        "/bin/sh",
        ["-c", `set -- ${buggyForm}; printf "%s\\n" "$#"`],
        { encoding: "utf-8", timeout: 5_000 },
      );
      expect(probe.status).toBe(0);
      // Spaced path word-splits into multiple tokens — exactly the
      // pathological state the #636 fix prevents.
      const tokenCount = Number(probe.stdout.trim().split("\n")[0]);
      expect(tokenCount).toBeGreaterThan(2);
    },
  );
});
