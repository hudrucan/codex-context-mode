#!/usr/bin/env node
// Codex manifest, launcher and runtime sibling integrity gate.
import { existsSync, readFileSync } from "node:fs";
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
const mcp = readJson(".codex-plugin/mcp.json");
const hooks = readJson(".codex-plugin/hooks.json");
const marketplace = readJson(".agents/plugins/marketplace.json");
const entry = mcp?.mcpServers?.["context-mode"];
check(plugin?.mcpServers === "./.codex-plugin/mcp.json", "Codex MCP reference drift");
check(plugin?.hooks === "./.codex-plugin/hooks.json", "Codex hook reference drift");
check(plugin?.skills === "./skills/", "Codex skills reference drift");
check(entry?.command === "node" && JSON.stringify(entry?.args) === JSON.stringify(["./start.mjs"]) && entry?.cwd === ".", "Codex launcher command/cwd drift");
check(entry?.env?.CONTEXT_MODE_PLATFORM === "codex", "Codex platform declaration drift");
check(Array.isArray(marketplace?.plugins) && marketplace.plugins.some(p => p.name === "context-mode" && p.source?.source === "url" && p.source?.url === "./"), "Codex marketplace source drift");
for (const rel of ["start.mjs", "server.bundle.mjs", "cli.bundle.mjs", "skills"]) check(existsSync(resolve(root, rel)), "missing runtime asset: " + rel);
for (const event of ["PreToolUse", "PostToolUse", "PreCompact", "SessionStart", "UserPromptSubmit", "Stop"]) {
  const entries = hooks?.hooks?.[event];
  check(Array.isArray(entries) && entries.length > 0, "missing Codex hook: " + event);
  for (const group of entries ?? []) for (const hook of group.hooks ?? []) {
    const match = hook.command?.match(/\$\{PLUGIN_ROOT\}\/(hooks\/codex\/[a-z]+\.mjs)/);
    check(Boolean(match && existsSync(resolve(root, match[1]))), "missing/invalid Codex hook target: " + event);
  }
}
if (violations.length) {
  process.stderr.write("asymmetric-drift: FAIL\n" + violations.map(v => "  - " + v).join("\n") + "\n");
  process.exitCode = 1;
} else process.stdout.write("asymmetric-drift: OK (Codex manifests, marketplace, hooks and runtime assets)\n");
