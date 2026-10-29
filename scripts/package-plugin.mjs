#!/usr/bin/env node
/** Explicit build-time packaging; never called by MCP or hooks. */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function packagePlugin(destination) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const out = resolve(destination);
  if (existsSync(out)) {
    if (out === root || JSON.parse(readFileSync(join(out, "package.json"), "utf8")).name !== "codex-context-mode") throw new Error("Not a generated plugin package: " + out);
    rmSync(out, { recursive: true });
  }
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  mkdirSync(out, { recursive: true });
  // No dependency tree or mutable source state is copied into the plugin.
  for (const path of [".codex-plugin", ".mcp.json", "hooks", "skills", "start.mjs", "server.bundle.mjs", "cli.bundle.mjs", "html-transform.bundle.cjs", "LICENSE", "NOTICE", "README.md"]) {
    cpSync(join(root, path), join(out, path), { recursive: true });
  }
  writeFileSync(join(out, "package.json"), JSON.stringify({name: pkg.name, version: pkg.version, type: "module", license: pkg.license, engines: pkg.engines}, null, 2) + "\n");
  return out;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(packagePlugin(process.argv[2] ?? join("dist", "codex-context-mode")));
}
