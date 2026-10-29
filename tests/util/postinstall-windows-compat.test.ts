import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, win32 } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(resolve("scripts/postinstall.mjs"), "utf8");
const ast = ts.createSourceFile("postinstall.mjs", source, ts.ScriptTarget.Latest, true);
const guard = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "isSafeWindowsPath");
const repair = ast.statements.find(n => ts.isIfStatement(n) && n.expression.getText(ast) === 'process.platform === "win32" && process.env.npm_config_global === "true"');

function simulate(options: { platform?: string; global?: string; existing?: boolean; unsafe?: boolean } = {}) {
  expect(guard).toBeDefined();
  expect(repair).toBeDefined();
  const prefix = "C:\\Users\\Desk Agent\\AppData\\Roaming\\npm";
  const pkgRoot = options.unsafe ? "C:\\fork&unsafe\\context-mode" : win32.join(prefix, "node_modules", "context-mode");
  const staleShim = "C:\\nvm4w\\nodejs\\context-mode.cmd";
  const expectedPackage = "C:\\nvm4w\\nodejs\\node_modules\\context-mode";
  const commands: string[] = [], writes: Array<[string, string]> = [], directories: string[] = [];
  const exists = new Set([pkgRoot, win32.join(prefix, "node_modules")]);
  if (options.existing) exists.add(expectedPackage);
  runInNewContext(`${guard!.getText(ast)}\n${repair!.getText(ast)}`, {
    process: { platform: options.platform ?? "win32", env: { npm_config_global: options.global ?? "true", npm_config_prefix: prefix } },
    pkgRoot, dirname: win32.dirname, join: win32.join, resolve: win32.resolve,
    existsSync: (path: string) => exists.has(path),
    mkdirSync: (path: string) => { directories.push(path); exists.add(path); },
    readFileSync: () => '@node "%~dp0\\node_modules\\context-mode\\build\\cli.js" %*',
    writeFileSync: (path: string, text: string) => writes.push([path, text]),
    execSync: (command: string) => { commands.push(command); return command === "where context-mode.cmd" ? staleShim : ""; },
    console: { log() {}, warn() {} },
  });
  return { commands, writes, directories, expectedPackage, pkgRoot, staleShim };
}

describe("Windows postinstall compatibility without agent registry repairs", () => {
  it("repairs nvm4w junctions and stale CLI shims", () => {
    const result = simulate();
    expect(result.commands).toContain(`mklink /J "${result.expectedPackage}" "${result.pkgRoot}"`);
    expect(result.writes).toEqual([[result.staleShim, '@node "%~dp0\\node_modules\\context-mode\\cli.bundle.mjs" %*']]);
    expect(result.commands.join("\n")).not.toMatch(/\.claude|openclaw|installed_plugins/);
  });

  it.each([{ platform: "linux" }, { global: "false" }])("does not repair outside Windows global installs (%j)", (options) => {
    const result = simulate(options);
    expect(result.commands).toEqual([]);
    expect(result.writes).toEqual([]);
    expect(result.directories).toEqual([]);
  });

  it("preserves an existing junction target", () => {
    expect(simulate({ existing: true }).commands.some(cmd => cmd.startsWith("mklink"))).toBe(false);
  });

  it("does not interpolate unsafe paths into cmd.exe", () => {
    expect(simulate({ unsafe: true }).commands.some(cmd => cmd.startsWith("mklink"))).toBe(false);
  });
});
