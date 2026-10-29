import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const repo = resolve(import.meta.dirname, "../..");
const events = ["PreToolUse", "PostToolUse", "SessionStart", "PreCompact", "UserPromptSubmit", "Stop"];
let root: string;
let fork: string;
let project: string;
let shell: string;

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "codex offline hooks ")));
  fork = join(root, "fork with spaces");
  project = join(root, "workspace with spaces");
  mkdirSync(fork);
  mkdirSync(join(project, ".codex"), { recursive: true });
  cpSync(join(repo, "hooks"), join(fork, "hooks"), { recursive: true });
  for (const file of ["cli.bundle.mjs", "package.json"]) copyFileSync(join(repo, file), join(fork, file));
  symlinkSync(realpathSync(join(repo, "node_modules")), join(fork, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  writeFileSync(join(project, ".codex/settings.json"), JSON.stringify({ permissions: { deny: ["Bash(echo OFFLINE_DENY)"] } }));
  if (process.platform === "win32") {
    shell = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", "exit 0"], { windowsHide: true }).error ? "powershell.exe" : "pwsh";
  }
});

afterAll(() => {
  if (!root) return;
  expect(resolve(root).startsWith(realpathSync(tmpdir()) + sep)).toBe(true);
  expect(root).toContain("codex offline hooks ");
  rmSync(root, { recursive: true, force: true });
});

function run(args: string[], executable = process.execPath) {
  const home = mkdtempSync(join(root, "storage "));
  for (const dir of ["user", "codex", "data", "tmp", "appdata"]) mkdirSync(join(home, dir));
  const keys = ["PATH", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "ProgramFiles", "ProgramFiles(x86)"];
  const env = Object.fromEntries(keys.filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]!])) as NodeJS.ProcessEnv;
  Object.assign(env, {
    HOME: join(home, "user"), USERPROFILE: join(home, "user"), CODEX_HOME: join(home, "codex"),
    CLAUDE_CONFIG_DIR: join(home, "user/.claude"), CONTEXT_MODE_DIR: join(home, "data/context-mode"),
    CONTEXT_MODE_DATA_DIR: join(home, "data"), CONTEXT_MODE_SESSION_SUFFIX: "",
    TEMP: join(home, "tmp"), TMP: join(home, "tmp"), APPDATA: join(home, "appdata"), LOCALAPPDATA: join(home, "appdata"),
  });
  return spawnSync(executable, args, {
    cwd: project, env, windowsHide: true, encoding: "utf8", timeout: 15_000,
    input: JSON.stringify({ session_id: "offline-hook-regression", cwd: project, workspace_roots: [project], source: "startup", prompt: "/goal offline hook regression", tool_name: "exec_command", tool_input: { command: "echo OFFLINE_DENY" }, tool_response: "harmless fixture" }),
  });
}

function output(result: ReturnType<typeof run>, event: string) {
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  const parsed = JSON.parse(result.stdout);
  if (event === "PreToolUse") {
    expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain("Bash(echo OFFLINE_DENY)");
  }
  return parsed;
}

describe("offline Codex hook entrypoints", () => {
  it.each(events)("runs %s directly and through CLI with identical stdin and isolated storage", event => {
    const direct = run([join(fork, `hooks/codex/${event.toLowerCase()}.mjs`)]);
    const dispatch = run([join(fork, "cli.bundle.mjs"), "hook", "codex", event.toLowerCase()]);
    expect(output(dispatch, event)).toEqual(output(direct, event));
  });
});

describe.skipIf(process.platform !== "win32")("PowerShell hook commands with Windows spaces", () => {
  it.each(events)("executes the shipped direct %s command", event => {
    const examples = JSON.parse(readFileSync(join(repo, "configs/codex/hooks.json"), "utf8"));
    const command = examples.hooks[event][0].hooks[0].command.replace("/absolute/path/to/codex-context-mode", fork.replace(/\\/g, "/"));
    output(run(["-NoProfile", "-NonInteractive", "-Command", command], shell), event);
  });

  it.each(["direct", "cli"])("supports an absolute pinned Node via & for the %s entrypoint", mode => {
    const target = mode === "cli" ? join(fork, "cli.bundle.mjs") : join(fork, "hooks/codex/pretooluse.mjs");
    const command = `& "${process.execPath}" "${target}"${mode === "cli" ? " hook codex pretooluse" : ""}`;
    output(run(["-NoProfile", "-NonInteractive", "-Command", command], shell), "PreToolUse");
  });

  it("exposes the original parser error before Node when a quoted executable lacks &", () => {
    const command = `"${process.execPath}" "${join(fork, "cli.bundle.mjs")}" hook codex pretooluse`;
    const result = run(["-NoProfile", "-NonInteractive", "-Command", command], shell);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/ParserError|UnexpectedToken/);
  });
});
