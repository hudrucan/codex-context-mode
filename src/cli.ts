#!/usr/bin/env node
/** Local commands only. Codex owns plugin installation and lifecycle. */
import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve, dirname, join, basename, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CodexAdapter, probeCodexCliVersion } from "./adapters/codex/index.js";
import { ContentStore } from "./store.js";
import { loadDatabase } from "./db-base.js";
import { detectRuntimes, getRuntimeSummary } from "./runtime.js";
import { readToolDenyPatterns, evaluateFilePath } from "./security.js";
import { ensureWritableStorageDir, resolveContentStorageDir, StorageDirectoryError, formatStorageDirectoryError } from "./session/db.js";

const HOOK_MAP: Record<string,string> = {
  "pre-tool-use": "pre-tool-use", "post-tool-use": "post-tool-use", "session-start": "session-start",
  "pre-compact": "pre-compact", "user-prompt-submit": "user-prompt-submit", stop: "stop",
};
function getPluginRoot(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  return ["src", "build"].includes(basename(dir)) ? dirname(dir) : dir;
}
export function toUnixPath(path: string) { return path.replace(/\\/g, "/"); }

interface ParsedFlags {
  positional: string[];
  flags: Record<string, string | boolean | string[]>;
}

function parseFlags(argv: string[]): ParsedFlags {
  const positional: string[] = [];
  const flags: Record<string, string | boolean | string[]> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--") || arg === "--") {
      positional.push(arg);
      continue;
    }

    const raw = arg.slice(2);
    const eq = raw.indexOf("=");
    const key = eq >= 0 ? raw.slice(0, eq) : raw;
    const inlineValue = eq >= 0 ? raw.slice(eq + 1) : undefined;
    const next = argv[i + 1];
    const value =
      inlineValue !== undefined
        ? inlineValue
        : next && !next.startsWith("--")
          ? (i++, next)
          : true;

    if (key === "include" || key === "exclude") {
      const prev = flags[key];
      flags[key] = Array.isArray(prev) ? [...prev, String(value)] : [String(value)];
    } else {
      flags[key] = value;
    }
  }

  return { positional, flags };
}

function stringFlag(flags: ParsedFlags["flags"], key: string): string | undefined {
  const v = flags[key];
  if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

function boolFlag(flags: ParsedFlags["flags"], key: string): boolean {
  return flags[key] === true || flags[key] === "true";
}

function stringListFlag(flags: ParsedFlags["flags"], key: string): string[] | undefined {
  const v = flags[key];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string" && v.length > 0) return [v];
  return undefined;
}

function numberFlag(flags: ParsedFlags["flags"], key: string, opts: { min?: number } = {}): number | undefined {
  const raw = stringFlag(flags, key);
  if (!raw) return undefined;
  const n = Number(raw);
  const min = opts.min ?? 1;
  if (!Number.isInteger(n) || n < min) throw new Error(`--${key} must be an integer >= ${min}`);
  return n;
}

function extFlag(flags: ParsedFlags["flags"]): string[] | undefined {
  const raw = stringFlag(flags, "ext") ?? stringFlag(flags, "extensions");
  if (!raw) return undefined;
  const exts = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => (x.startsWith(".") ? x : `.${x}`));
  return exts.length > 0 ? exts : undefined;
}

function resolveCliProjectDir(projectFlag: string | undefined, fallback: string): string {
  if (projectFlag) return resolve(projectFlag);
  return resolve(fallback);
}

async function openCliContentStore(projectDir: string): Promise<{ store: ContentStore; dbPath: string; contentDir: string }> {
  const adapter = new CodexAdapter();
  const contentStorage = resolveContentStorageDir(() => adapter.getSessionDir());
  const contentDir = ensureWritableStorageDir(contentStorage);
  const { resolveContentStorePath } = await import("./session/db.js");
  const dbPath = resolveContentStorePath({ projectDir, contentDir });
  return { store: new ContentStore(dbPath), dbPath, contentDir };
}

function defaultSourceForPath(absPath: string): string {
  try {
    if (statSync(absPath).isDirectory()) return `project:${basename(absPath) || absPath}`;
  } catch { /* path errors are reported by the index command */ }
  return absPath;
}

function assertReadAllowed(path: string, projectDir: string): void {
  const denyGlobs = readToolDenyPatterns("Read", projectDir);
  const denied = evaluateFilePath(path, denyGlobs, process.platform === "win32", projectDir);
  if (denied.denied) {
    throw new Error(`Read denied by policy: ${path}`);
  }
}

async function indexCommand(argv: string[]): Promise<number> {
  try {
    const parsed = parseFlags(argv);
    const target = parsed.positional[0];
    if (!target || target === "-h" || target === "--help") {
      console.log("Usage: context-mode index <path> [--source label] [--project path] [--max-files n] [--max-depth n] [--ext .ts,.md]");
      return target ? 0 : 1;
    }

    const absPath = isAbsolute(target) ? resolve(target) : resolve(process.cwd(), target);
    if (!existsSync(absPath)) throw new Error(`Path does not exist: ${absPath}`);

    const st = statSync(absPath);
    const projectDir = resolveCliProjectDir(
      stringFlag(parsed.flags, "project"),
      st.isDirectory() ? absPath : dirname(absPath),
    );
    const source = stringFlag(parsed.flags, "source") ?? defaultSourceForPath(absPath);
    const { store, dbPath } = await openCliContentStore(projectDir);

    try {
      assertReadAllowed(absPath, projectDir);
      if (st.isDirectory()) {
        const denyGlobs = readToolDenyPatterns("Read", projectDir);
        const result = store.indexDirectory({
          path: absPath,
          source,
          include: stringListFlag(parsed.flags, "include"),
          exclude: stringListFlag(parsed.flags, "exclude"),
          maxDepth: numberFlag(parsed.flags, "max-depth", { min: 0 }),
          maxFiles: numberFlag(parsed.flags, "max-files"),
          extensions: extFlag(parsed.flags),
          respectGitignore: !boolFlag(parsed.flags, "no-gitignore"),
          followSymlinks: boolFlag(parsed.flags, "follow-symlinks"),
          perFileDeny: (filePath) => {
            try {
              return evaluateFilePath(filePath, denyGlobs, process.platform === "win32", projectDir).denied;
            } catch {
              return false;
            }
          },
        });
        const cap = result.capped ? ` (cap reached at ${result.filesIndexed} files)` : "";
        const denied = result.denied > 0 ? `; ${result.denied} denied` : "";
        const failed = result.failed > 0 ? `; ${result.failed} failed` : "";
        console.log(`Indexed ${result.filesIndexed} files (${result.totalChunks} sections) from ${absPath}${cap}${denied}${failed}`);
      } else {
        const result = store.index({ path: absPath, source });
        console.log(`Indexed ${result.totalChunks} sections (${result.codeChunks} with code) from ${absPath}`);
      }
      console.log(`Source: ${source}`);
      console.log(`Project: ${projectDir}`);
      console.log(`DB: ${dbPath}`);
      return 0;
    } finally {
      store.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`context-mode index: ${message}`);
    return 1;
  }
}

async function searchCommand(argv: string[]): Promise<number> {
  try {
    const parsed = parseFlags(argv);
    const query = parsed.positional.join(" ").trim();
    if (!query || query === "-h" || query === "--help") {
      console.log("Usage: context-mode search <query...> [--source label] [--project path] [--limit n] [--type code|prose]");
      return query ? 0 : 1;
    }

    const projectDir = resolveCliProjectDir(stringFlag(parsed.flags, "project"), process.cwd());
    const { store, dbPath } = await openCliContentStore(projectDir);
    try {
      const limit = numberFlag(parsed.flags, "limit") ?? 3;
      const type = stringFlag(parsed.flags, "type");
      if (type && type !== "code" && type !== "prose") throw new Error("--type must be code or prose");

      const results = store.searchWithFallback(
        query,
        limit,
        stringFlag(parsed.flags, "source"),
        type as "code" | "prose" | undefined,
      );
      if (results.length === 0) {
        console.log(`No matches for: ${query}`);
        console.log(`Project: ${projectDir}`);
        console.log(`DB: ${dbPath}`);
        return 0;
      }
      for (const [i, r] of results.entries()) {
        const content = r.content.replace(/\s+/g, " ").trim();
        const snippet = content.length > 500 ? `${content.slice(0, 500)}...` : content;
        console.log(`## ${i + 1}. ${r.title}`);
        console.log(`Source: ${r.source}`);
        console.log(`Type: ${r.contentType}`);
        console.log(snippet);
        console.log("");
      }
      return 0;
    } finally {
      store.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`context-mode search: ${message}`);
    return 1;
  }
}


async function doctor(): Promise<number> {
  const adapter = new CodexAdapter();
  console.log("codex-context-mode doctor");
  console.log(getRuntimeSummary(detectRuntimes()));
  console.log("Codex CLI: " + (probeCodexCliVersion() ?? "not found"));
  const checks = adapter.validateHooks(getPluginRoot());
  for (const check of checks) console.log("[" + (check.status === "pass" ? "OK" : check.status.toUpperCase()) + "] " + check.check + ": " + check.message);
  const Database = loadDatabase();
  const db = new Database(":memory:");
  try { db.exec("CREATE VIRTUAL TABLE probe USING fts5(value)"); console.log("[OK] SQLite FTS5"); }
  finally { db.close(); }
  return checks.some(c => c.status === "fail") ? 1 : 0;
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (["--help", "-h", "help"].includes(args[0])) {
    console.log("codex-context-mode [doctor | index <path> | search <query> | hook codex <kebab-case-event>]");
    console.log("Install, enable, update and uninstall through Codex plugin management.");
    return;
  }
  if (args[0] === "index") { process.exitCode = await indexCommand(args.slice(1)); return; }
  if (args[0] === "search") { process.exitCode = await searchCommand(args.slice(1)); return; }
  if (args[0] === "doctor") { process.exitCode = await doctor(); return; }
  if (args[0] === "hook") {
    if (args[1] !== "codex" || !HOOK_MAP[args[2]]) throw new Error("Expected hook codex <kebab-case-event>");
    await import(pathToFileURL(join(getPluginRoot(), "hooks", "codex", HOOK_MAP[args[2]] + ".mjs")).href); return;
  }
  if (args.length) throw new Error("Unknown command. Installation and lifecycle belong to Codex plugin management.");
  await import(pathToFileURL(join(getPluginRoot(), "start.mjs")).href);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
