/** Mutable plugin state is separate from Codex configuration and code assets. */
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const PLUGIN_NAME = "codex-context-mode";

/** Resolve existing symlink/junction ancestors even before state directories exist. */
function physicalPath(path: string): string {
  let ancestor = resolve(path);
  const tail: string[] = [];
  while (!existsSync(ancestor) && dirname(ancestor) !== ancestor) {
    tail.unshift(basename(ancestor));
    ancestor = dirname(ancestor);
  }
  return resolve(realpathSync.native(ancestor), ...tail);
}

export function runtimePaths(env: NodeJS.ProcessEnv = process.env, home = homedir()) {
  const override = env.CODEX_CONTEXT_MODE_HOME?.trim();
  if (override && !isAbsolute(override)) throw new Error("CODEX_CONTEXT_MODE_HOME must be absolute");
  const root = resolve(override || join(home, ".codex-context-mode"));
  return { root, data: join(root, "data"), sessions: join(root, "data", "sessions"), content: join(root, "data", "content"), stats: join(root, "data", "stats"), memory: join(root, "data", "memory"), cache: join(root, "cache"), logs: join(root, "logs"), temporary: join(root, "cache", "tmp") };
}

/** Refuse state overrides that would turn installed code into writable state. */
export function assertMutablePath(path: string): void {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [process.env.PLUGIN_ROOT, process.env.CLAUDE_PLUGIN_ROOT, here, dirname(here)]) {
    if (!candidate) continue;
    let pkg: { name?: string };
    try { pkg = JSON.parse(readFileSync(join(candidate, "package.json"), "utf8")); } catch { continue; }
    if (pkg.name !== PLUGIN_NAME) continue;
    const rel = relative(physicalPath(candidate), physicalPath(path));
    if (rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel))) throw new Error("Plugin data must not be written inside the code installation: " + path);
  }
}

export function runtimeCacheDir(): string {
  const path = runtimePaths().temporary;
  assertMutablePath(path);
  mkdirSync(path, { recursive: true });
  return path;
}
