#!/usr/bin/env node
// Installed assets are immutable. Startup never installs, rebuilds or fetches.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
if (!process.env.CONTEXT_MODE_PROJECT_DIR && !/[/\\]\.codex[/\\]plugins[/\\]/.test(process.cwd()) && resolve(process.cwd()) !== root) {
  process.env.CONTEXT_MODE_PROJECT_DIR = process.cwd();
  process.env.CONTEXT_MODE_PROJECT_DIR_SOURCE = "cwd";
}
process.env.CONTEXT_MODE_PLATFORM = "codex";
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 5)) throw new Error("codex-context-mode requires Node.js >= 22.5 with SQLite FTS5");
for (const asset of ["server.bundle.mjs", "cli.bundle.mjs", "html-transform.bundle.cjs", "hooks/session-db.bundle.mjs", "hooks/session-extract.bundle.mjs", "hooks/session-snapshot.bundle.mjs", "hooks/codex-usage.bundle.mjs", "hooks/security.bundle.mjs"]) {
  if (!existsSync(resolve(root, asset))) throw new Error("Incomplete codex-context-mode plugin: missing " + asset + ". Build/package the plugin before installing it.");
}
await import("./server.bundle.mjs");
