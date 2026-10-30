#!/usr/bin/env node
// Codex manifest, launcher and runtime sibling integrity gate.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const explicit = process.argv.indexOf("--root");
const root = explicit >= 0 ? resolve(process.argv[explicit + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];
function readJson(rel) {
  try { return JSON.parse(readFileSync(resolve(root, rel), "utf8")); }
  catch { violations.push("missing or invalid JSON: " + rel); return null; }
}
function check(ok, message) { if (!ok) violations.push(message); }
const plugin = readJson(".codex-plugin/plugin.json");
const mcp = readJson(".mcp.json");
const hooks = readJson("hooks/hooks.json");
const marketplace = readJson(".agents/plugins/marketplace.json");
const pkg = readJson("package.json");
const entry = mcp?.mcpServers?.["codex-context-mode"];
check(plugin?.name === "codex-context-mode", "Plugin name drift");
check(pkg?.name === plugin?.name && pkg?.version === plugin?.version, "Package/plugin identity drift");
check(plugin?.interface?.displayName === "codex-context-mode" && marketplace?.interface?.displayName === "codex-context-mode", "Product display name drift");
check(marketplace?.name === "hudrucan", "Marketplace ID drift");
check(Object.keys(mcp?.mcpServers ?? {}).length === 1, "Exactly one MCP required");
check(entry?.default_tools_approval_mode === undefined, "Plugin must preserve host approval policy");
check(JSON.stringify((existsSync(resolve(root, "skills")) ? readdirSync(resolve(root, "skills")) : []).filter(n => existsSync(resolve(root, "skills", n, "SKILL.md"))).sort()) === JSON.stringify(["doctor", "index", "main", "purge", "search", "stats"]), "Exactly six bundled skills required");
check(plugin?.mcpServers === "./.mcp.json", "Codex MCP reference drift");
check(plugin?.hooks === "./hooks/hooks.json", "Codex hook reference drift");
check(plugin?.skills === "./skills/", "Codex skills reference drift");
check(entry?.command === "node" && JSON.stringify(entry?.args) === JSON.stringify(["./start.mjs"]) && entry?.cwd === ".", "Codex launcher command/cwd drift");
check(entry?.env?.CONTEXT_MODE_PLATFORM === "codex", "Codex platform declaration drift");
check(Array.isArray(marketplace?.plugins) && marketplace.plugins.length === 1 && marketplace.plugins[0].name === "codex-context-mode" && marketplace.plugins[0].source?.source === "local", "Codex marketplace source drift");
for (const rel of ["start.mjs", "server.bundle.mjs", "cli.bundle.mjs", "html-transform.bundle.cjs", "hooks/codex-usage.bundle.mjs", "hooks/session-db.bundle.mjs", "hooks/session-extract.bundle.mjs", "hooks/session-snapshot.bundle.mjs", "hooks/security.bundle.mjs", "skills"]) check(existsSync(resolve(root, rel)), "missing runtime asset: " + rel);
check(Object.keys(hooks?.hooks ?? {}).length === 6, "Exactly six native hook events required");
for (const event of ["PreToolUse", "PostToolUse", "PreCompact", "SessionStart", "UserPromptSubmit", "Stop"]) {
  const entries = hooks?.hooks?.[event];
  check(Array.isArray(entries) && entries.length === 1 && entries[0].hooks?.length === 1, "expected one Codex hook: " + event);
  for (const group of entries ?? []) for (const hook of group.hooks ?? []) {
    const match = hook.command?.match(/\$\{PLUGIN_ROOT\}\/(hooks\/codex\/[a-z-]+\.mjs)/);
    check(Boolean(match && existsSync(resolve(root, match[1]))), "missing/invalid Codex hook target: " + event);
  }
}
if (violations.length) {
  process.stderr.write("asymmetric-drift: FAIL\n" + violations.map(v => "  - " + v).join("\n") + "\n");
  process.exitCode = 1;
} else process.stdout.write("asymmetric-drift: OK (Codex manifests, marketplace, hooks and runtime assets)\n");
