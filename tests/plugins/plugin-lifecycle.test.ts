import { afterAll, describe, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadDatabase } from "../../src/db-base.js";
import { runtimePaths } from "../../src/runtime-paths.js";
// @ts-expect-error build-time packaging helper is plain JavaScript
import { packagePlugin } from "../../scripts/package-plugin.mjs";

const codex = process.env.CODEX_PLUGIN_TEST_CLI ?? "codex";
const hasCodex = spawnSync(codex, ["--version"], { encoding: "utf8" }).status === 0;
const roots: string[] = [];
afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }); });

function fixture() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "codex plugin lifecycle ")));
  roots.push(root);
  const home = join(root, "user home"), ch = join(home, ".codex"), workspace = join(root, "workspace with spaces");
  for (const p of [ch, workspace, join(root, "tmp")]) mkdirSync(p, { recursive: true });
  const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => v !== undefined && !/^(CONTEXT_MODE_|CODEX_CONTEXT_MODE_|CLAUDE_|GEMINI_|PLUGIN_ROOT|NODE_OPTIONS)/.test(k))) as any;
  Object.assign(env, { HOME: home, USERPROFILE: home, CODEX_HOME: ch, CODEX_CONTEXT_MODE_HOME: join(home, ".codex-context-mode"), TEMP: join(root, "tmp"), TMP: join(root, "tmp"), CONTEXT_MODE_PROJECT_DIR: workspace });
  const marketplace = join(root, "local marketplace with spaces"), source = join(marketplace, "plugins", "codex-context-mode");
  packagePlugin(source);
  mkdirSync(join(marketplace, ".agents", "plugins"), { recursive: true });
  const manifest = JSON.parse(readFileSync(resolve(".agents/plugins/marketplace.json"), "utf8"));
  manifest.plugins[0].source.path = "./plugins/codex-context-mode";
  writeFileSync(join(marketplace, ".agents/plugins/marketplace.json"), JSON.stringify(manifest));
  // This policy belongs only to this disposable host. The plugin may not change it.
  writeFileSync(join(ch, "config.toml"), 'approval_policy = "never"\nsandbox_mode = "workspace-write"\n');
  return { root, home, ch, workspace, env, marketplace, source };
}
function cli(f: ReturnType<typeof fixture>, args: string[]) {
  const result = spawnSync(codex, args, { env: f.env, cwd: f.workspace, encoding: "utf8", timeout: 30_000, windowsHide: true });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr + result.stdout).toBe(0);
  return result.stdout ? JSON.parse(result.stdout) : {};
}
function appServer(f: ReturnType<typeof fixture>) {
  const child = spawn(codex, ["app-server", "--stdio"], { env: f.env, cwd: f.workspace, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  child.stderr.resume();
  let seq = 0;
  const pending = new Map<number, (r: any) => void>();
  const lines = createInterface({ input: child.stdout });
  lines.on("line", line => { try { const v = JSON.parse(line); if (v.id) { pending.get(v.id)?.(v); pending.delete(v.id); } } catch {} });
  function rpc(method: string, params: unknown): Promise<any> {
    return new Promise((accept, reject) => {
      const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(new Error("RPC timeout: " + method)); }, 25_000);
      pending.set(id, r => { clearTimeout(timer); if (r.error) reject(new Error(JSON.stringify(r.error))); else accept(r.result); });
      child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }
  return { rpc, async init() { await rpc("initialize", { clientInfo: { name: "plugin-lifecycle-test", version: "1.0" }, capabilities: { experimentalApi: true } }); child.stdin.write('{"method":"initialized"}\n'); }, async close() {
    lines.close(); child.stdin.end();
    if (child.exitCode !== null) return;
    await new Promise<void>(done => { const timer = setTimeout(() => child.kill(), 3000); child.once("exit", () => { clearTimeout(timer); done(); }); });
  } };
}
function digestTree(dir: string): string {
  const hash = createHash("sha256");
  function visit(p: string) { for (const entry of readdirSync(p, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) { const file = join(p, entry.name); hash.update(file); if (entry.isDirectory()) visit(file); else hash.update(readFileSync(file)); } }
  visit(dir); return hash.digest("hex");
}
async function mcp(f: ReturnType<typeof fixture>, installed: string, workspace = f.workspace) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(installed, "start.mjs")], cwd: installed, env: { ...f.env, CONTEXT_MODE_PROJECT_DIR: workspace, NODE_OPTIONS: "--require=" + JSON.stringify(join(f.root, "offline.cjs")) }, stderr: "pipe" });
  transport.stderr?.resume();
  const client = new Client({ name: "clean-plugin-test", version: "1.0" });
  await client.connect(transport);
  return client;
}
function text(result: any) { return (result.content ?? []).map((v: any) => v.text ?? "").join("\n"); }

describe.skipIf(!hasCodex)("native Codex plugin lifecycle (isolated host)", () => {
  it("installs one offline plugin, reviews six hooks, preserves data across restart and uninstalls", async () => {
    const f = fixture();
    cli(f, ["plugin", "marketplace", "add", f.marketplace, "--json"]);
    const added = cli(f, ["plugin", "add", "codex-context-mode@codex-context-mode", "--json"]);
    const installed = added.installedPath;
    expect(installed).toContain(" ");
    expect(existsSync(join(installed, "node_modules"))).toBe(false);
    const html = spawnSync(process.execPath, ["-e", 'const {TurndownService,gfm}=require(process.argv[1]);const td=new TurndownService();td.use(gfm);console.log(td.turndown("<h1>OfflineMarkup</h1><p>bundled text</p>"));', join(installed, "html-transform.bundle.cjs")], {env:f.env,cwd:installed,encoding:"utf8"});
    expect(html.status, html.stderr).toBe(0);
    expect(html.stdout).toContain("OfflineMarkup");
    const before = digestTree(installed);
    const listed = cli(f, ["plugin", "list", "--json"]);
    expect(listed.installed).toHaveLength(1);
    writeFileSync(join(f.root, "offline.cjs"), `
      const block = () => { throw new Error('STARTUP_NETWORK_OR_INSTALL'); };
      for (const name of ['node:http','node:https']) { const m = require(name); m.request=block; m.get=block; }
      globalThis.fetch=block;
      const cp=require('node:child_process');
      for (const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync']) {
        const original=cp[key]; cp[key]=function(cmd,...args) { if (/npm|pnpm|yarn|git(?:\\.exe)?$/i.test(String(cmd))) return block(); return original.call(this,cmd,...args); };
      }
      require('node:module').syncBuiltinESMExports();
    `);
    const server = appServer(f);
    try {
      await server.init();
      const hooks = (await server.rpc("hooks/list", { cwds: [f.workspace] })).data[0].hooks;
      expect(hooks).toHaveLength(6);
      expect(hooks.every((h: any) => h.source === "plugin" && h.enabled && h.trustStatus === "untrusted")).toBe(true);
      // Simulate explicit review of these exact definitions in the disposable host.
      const state = Object.fromEntries(hooks.map((h: any) => [h.key, { trusted_hash: h.currentHash }]));
      await server.rpc("config/batchWrite", { edits: [{ keyPath: "hooks.state", value: state, mergeStrategy: "upsert" }], reloadUserConfig: true });
      const trusted = (await server.rpc("hooks/list", { cwds: [f.workspace] })).data[0].hooks;
      expect(trusted.every((h: any) => h.trustStatus === "trusted")).toBe(true);
      const skills = (await server.rpc("skills/list", { cwds: [f.workspace] })).data[0].skills.filter((s: any) => s.path.includes(installed));
      expect(skills.map((s: any) => s.name).sort()).toEqual(["doctor", "index", "main", "purge", "search", "stats"].map(s => "codex-context-mode:" + s));
      const statuses = (await server.rpc("mcpServerStatus/list", {})).data;
      expect(statuses.map((s: any) => s.name)).toEqual(["codex-context-mode"]);
      expect(Object.keys(statuses[0].tools)).toHaveLength(9);
    } finally { await server.close(); }

    const payload = { cwd: f.workspace, session_id: "12345678-1234-4234-8234-123456789abc", source: "startup", prompt: "/goal Quasar continuity survives restart", tool_name: "exec_command", tool_input: { command: "echo harmless" }, tool_response: "Quasar output" };
    const manifest = JSON.parse(readFileSync(join(installed, "hooks/hooks.json"), "utf8"));
    function hook(event: string, input = payload) {
      const command = manifest.hooks[event][0].hooks[0].command.replaceAll("${PLUGIN_ROOT}", installed.replace(/\\/g, "/"));
      const ps = process.platform === "win32" ? "powershell.exe" : "/bin/sh";
      const args = process.platform === "win32" ? ["-NoProfile", "-NonInteractive", "-Command", command] : ["-c", command];
      const p = spawnSync(ps, args, { cwd: f.workspace, env: { ...f.env, NODE_OPTIONS: "--require=" + JSON.stringify(join(f.root, "offline.cjs")) }, input: JSON.stringify(input), encoding: "utf8", windowsHide: true, timeout: 20_000 });
      expect(p.status, p.stderr).toBe(0); return JSON.parse(p.stdout);
    }
    for (const event of ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PreCompact"]) hook(event);
    expect(JSON.stringify(hook("SessionStart", { ...payload, source: "compact" }))).toContain("Quasar continuity");
    hook("Stop");
    mkdirSync(join(f.workspace, ".codex"), { recursive: true });
    writeFileSync(join(f.workspace, ".codex/settings.json"), JSON.stringify({ permissions: { deny: ["Bash(echo DENY_PLUGIN)"] } }));
    const denied = hook("PreToolUse", { ...payload, tool_input: { command: "echo DENY_PLUGIN" } });
    expect(denied.hookSpecificOutput.permissionDecision).toBe("deny");
    const doc = join(f.workspace, "document with spaces.md");
    writeFileSync(doc, "# Quasar persistence\nPluginQuasarMarker searchable offline after restart.");
    let client = await mcp(f, installed);
    try {
      expect((await client.listTools()).tools.map(t => t.name)).not.toContain("ctx_upgrade");
      expect((await client.callTool({ name: "ctx_index", arguments: { path: doc, source: "clean-plugin-doc" } })).isError).not.toBe(true);
      expect(text(await client.callTool({ name: "ctx_search", arguments: { queries: ["PluginQuasarMarker"] } }))).toContain("PluginQuasarMarker");
      expect(text(await client.callTool({ name: "ctx_doctor", arguments: {} }))).not.toContain("[FAIL]");
      expect((await client.callTool({ name: "ctx_stats", arguments: {} })).isError).not.toBe(true);
      expect(text(await client.callTool({ name: "ctx_execute", arguments: { language: "javascript", code: 'console.log("OfflineExecutionMarker")' } }))).toContain("OfflineExecutionMarker");
    } finally { await client.close(); }
    client = await mcp(f, installed);
    try { expect(text(await client.callTool({ name: "ctx_search", arguments: { queries: ["PluginQuasarMarker"] } }))).toContain("PluginQuasarMarker"); }
    finally { await client.close(); }
    const peer = join(f.root, "peer workspace"); mkdirSync(peer);
    client = await mcp(f, installed, peer);
    try { expect(text(await client.callTool({ name: "ctx_search", arguments: { queries: ["PluginQuasarMarker"] } }))).not.toContain("PluginQuasarMarker searchable"); }
    finally { await client.close(); }
    const paths = runtimePaths(f.env, f.home);
    const Database = loadDatabase();
    for (const dir of [paths.content, paths.sessions]) {
      for (const name of readdirSync(dir).filter(n => n.endsWith(".db"))) {
        const db = new Database(join(dir, name));
        try { expect(Object.values(db.prepare("PRAGMA integrity_check").get()!)).toEqual(["ok"]); } finally { db.close(); }
      }
    }
    expect(digestTree(installed)).toBe(before);
    const config = readFileSync(join(f.ch, "config.toml"), "utf8");
    expect(config).toContain('approval_policy = "never"');
    expect(config).toContain('sandbox_mode = "workspace-write"');
    expect(config).not.toMatch(/\[mcp_servers\.|\[\[hooks\./);
    const disabled = appServer(f);
    try {
      await disabled.init();
      await disabled.rpc("config/batchWrite", {edits:[{keyPath:'plugins."codex-context-mode@codex-context-mode".enabled',value:false,mergeStrategy:"upsert"}],reloadUserConfig:true});
    } finally { await disabled.close(); }
    const reenabled = appServer(f);
    try {
      await reenabled.init();
      expect((await reenabled.rpc("hooks/list", {cwds:[f.workspace]})).data[0].hooks.filter((h: any) => h.enabled)).toHaveLength(0);
      expect((await reenabled.rpc("mcpServerStatus/list", {})).data).toHaveLength(0);
      await reenabled.rpc("config/batchWrite", {edits:[{keyPath:'plugins."codex-context-mode@codex-context-mode".enabled',value:true,mergeStrategy:"upsert"}],reloadUserConfig:true});
    } finally { await reenabled.close(); }
    const updatedManifest = join(f.source, ".codex-plugin/plugin.json");
    const release = JSON.parse(readFileSync(updatedManifest, "utf8"));
    release.version += "-local-update";
    writeFileSync(updatedManifest, JSON.stringify(release));
    const hookManifest = join(f.source, "hooks/hooks.json");
    const hookDefs = JSON.parse(readFileSync(hookManifest, "utf8"));
    hookDefs.hooks.Stop[0].hooks[0].command += " --local-update";
    writeFileSync(hookManifest, JSON.stringify(hookDefs));
    const updated = cli(f, ["plugin", "add", "codex-context-mode@codex-context-mode", "--json"]);
    expect(updated.version).toBe(release.version);
    const updatedHost = appServer(f);
    try {
      await updatedHost.init();
      const changedHooks = (await updatedHost.rpc("hooks/list", {cwds:[f.workspace]})).data[0].hooks;
      expect(changedHooks).toHaveLength(6);
      const changedStop = changedHooks.find((h: any) => h.eventName === "stop");
      expect(changedStop.command).toContain("--local-update");
      expect(changedStop.trustStatus).not.toBe("trusted");
    } finally { await updatedHost.close(); }
    expect(cli(f, ["plugin", "list", "--json"]).installed).toHaveLength(1);
    expect(existsSync(paths.content)).toBe(true);
    client = await mcp(f, updated.installedPath);
    try { expect(text(await client.callTool({name:"ctx_search",arguments:{queries:["PluginQuasarMarker"]}}))).toContain("PluginQuasarMarker"); }
    finally { await client.close(); }
    cli(f, ["plugin", "remove", "codex-context-mode@codex-context-mode", "--json"]);
    expect(cli(f, ["plugin", "list", "--json"]).installed).toHaveLength(0);
    expect(existsSync(updated.installedPath)).toBe(false);
    const uninstalled = appServer(f);
    try {
      await uninstalled.init();
      expect((await uninstalled.rpc("hooks/list", { cwds: [f.workspace] })).data[0].hooks).toHaveLength(0);
      expect((await uninstalled.rpc("mcpServerStatus/list", {})).data).toHaveLength(0);
      const skills = (await uninstalled.rpc("skills/list", { cwds: [f.workspace] })).data[0].skills;
      expect(skills.some((s: any) => s.path.includes(installed))).toBe(false);
    } finally { await uninstalled.close(); }
  }, 120_000);
});
