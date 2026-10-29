/** Hooks use the same home-rooted mutable state layout as the bundled MCP. */
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

function physicalPath(path) {
  let ancestor = resolve(path);
  const tail = [];
  while (!existsSync(ancestor) && dirname(ancestor) !== ancestor) {
    tail.unshift(basename(ancestor));
    ancestor = dirname(ancestor);
  }
  return resolve(realpathSync.native(ancestor), ...tail);
}

export function runtimePaths(env = process.env, home = homedir()) {
  const override = env.CODEX_CONTEXT_MODE_HOME?.trim();
  if (override && !isAbsolute(override)) throw new Error("CODEX_CONTEXT_MODE_HOME must be absolute");
  const root = resolve(override || join(home, ".codex-context-mode"));
  return { root, data: join(root, "data"), sessions: join(root, "data", "sessions"), content: join(root, "data", "content"), stats: join(root, "data", "stats"), memory: join(root, "data", "memory"), cache: join(root, "cache"), logs: join(root, "logs"), temporary: join(root, "cache", "tmp") };
}

export function runtimeCacheDir() {
  const path = runtimePaths().temporary;
  const codeRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  let pkg;
  try { pkg = JSON.parse(readFileSync(join(codeRoot, "package.json"), "utf8")); } catch {}
  const rel = relative(physicalPath(codeRoot), physicalPath(path));
  if (pkg?.name === "codex-context-mode" && (rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel)))) {
    throw new Error("Plugin data must not be written inside the code installation");
  }
  mkdirSync(path, { recursive: true });
  return path;
}
