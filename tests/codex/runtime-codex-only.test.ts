import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { hashProjectDirCanonical } from "../../src/session/db.js";

const roots: string[] = [];
const cli = resolve("cli.bundle.mjs");

afterEach(() => {
  for (const root of roots.splice(0)) {
    expect(resolve(root).startsWith(realpathSync(tmpdir()) + sep)).toBe(true);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ctx-codex-only-cli-")));
  roots.push(root);
  const repo = join(root, "project with spaces");
  const codexHome = join(root, "custom-codex-home");
  mkdirSync(repo);
  writeFileSync(join(repo, "probe.txt"), "CodexOnlyCli regression marker");
  const env = {
    ...process.env, HOME: root, USERPROFILE: root, CODEX_HOME: codexHome,
    CLAUDE_CONFIG_DIR: join(root, ".claude"), CLAUDE_PROJECT_DIR: join(root, "wrong-repo"),
    GEMINI_PROJECT_DIR: join(root, "wrong-repo"), CONTEXT_MODE_PLATFORM: "gemini-cli",
  };
  delete env.CONTEXT_MODE_DIR;
  delete env.CONTEXT_MODE_DATA_DIR;
  const networkGuard = join(root, "no-upstream.cjs");
  writeFileSync(networkGuard, `
    const blocked = () => { console.error('UNEXPECTED_UPSTREAM_CALL'); throw new Error('UNEXPECTED_UPSTREAM_CALL'); };
    require('node:https').request = blocked;
    require('node:https').get = blocked;
    require('node:http').request = blocked;
    globalThis.fetch = blocked;
    const cp = require('node:child_process'), exec = cp.execFileSync;
    cp.execFileSync = (cmd, args, ...rest) => {
      if ((cmd === 'git' && ['clone', 'fetch', 'pull'].includes(args?.[0])) || (/npm/.test(cmd) && ['install', 'update'].includes(args?.[0]))) return blocked();
      return exec(cmd, args, ...rest);
    };
    require('node:module').syncBuiltinESMExports();
  `);
  const run = (args: string[]) => spawnSync(process.execPath, [cli, ...args], {
    cwd: repo, env: { ...env, NODE_OPTIONS: `${env.NODE_OPTIONS ?? ""} --require "${networkGuard.replace(/\\/g, "/")}"` }, encoding: "utf8", windowsHide: true, timeout: 20_000,
  });
  return { root, repo, codexHome, run };
}

describe("Codex-only CLI runtime", () => {
  it("indexes and searches under CODEX_HOME despite foreign platform signals", () => {
    const f = fixture();
    const indexed = f.run(["index", "probe.txt"]);
    expect(indexed.status, indexed.stdout + indexed.stderr).toBe(0);
    const found = f.run(["search", "CodexOnlyCli"]);
    expect(found.status, found.stdout + found.stderr).toBe(0);
    expect(found.stdout).toContain("CodexOnlyCli regression marker");
    const dbPath = join(f.root, ".codex-context-mode", "data", "content", `${hashProjectDirCanonical(f.repo)}.db`);
    expect(readFileSync(dbPath).subarray(0, 16).toString()).toBe("SQLite format 3\0");
    for (const other of [".claude", ".gemini", ".cursor", ".pi"]) {
      expect(existsSync(join(f.root, other, "context-mode"))).toBe(false);
    }
  });

  it("rejects a foreign upgrade platform before accessing the network", () => {
    const result = fixture().run(["upgrade", "--platform", "gemini-cli"]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("Installation and lifecycle belong to Codex plugin management");
  });

  it.each([{ flags: [] }, { flags: ["--platform", "codex"] }])("disables self-upgrade without network or source writes (%j)", ({ flags }) => {
    const f = fixture();
    const before = readFileSync(cli);
    const result = f.run(["upgrade", ...flags]);
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stdout + result.stderr).toContain("Installation and lifecycle belong to Codex plugin management");
    expect(result.stdout + result.stderr).not.toContain("UNEXPECTED_UPSTREAM_CALL");
    expect(readFileSync(cli).equals(before)).toBe(true);
    expect(existsSync(join(f.codexHome, "config.toml"))).toBe(false);
  });

  it("doctor reports local versions without checking npm upstream", () => {
    const result = fixture().run(["doctor"]);
    expect(result.error).toBeUndefined();
    expect(result.stdout).toContain("codex-context-mode doctor");
    expect(result.stdout + result.stderr).not.toContain("UNEXPECTED_UPSTREAM_CALL");
    expect(result.stdout + result.stderr).not.toContain("latest v");
  });

  it("does not dispatch another platform's hooks", () => {
    const result = fixture().run(["hook", "gemini-cli", "beforetool"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected hook codex");
  });
});
