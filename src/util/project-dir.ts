import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";


/** Workspace resolution for Codex; MCP requests use verified per-thread metadata. */

/**
 * Detect whether a path lives inside an agent plugin install tree —
 * specifically `<home>/.claude/plugins/cache/<plugin>/<plugin>/<version>/`,
 * `<home>/.codex/plugins/cache/<plugin>/<plugin>/<version>/`, or the
 * marketplace mirror under `<home>/.{claude,codex}/plugins/marketplaces/...`.
 *
 * Cross-OS: matches both POSIX (`/`) and Windows (`\`) path separators.
 * Independent of `home` location — we only care about the agent plugin
 * suffix pattern.
 */
export function isPluginInstallPath(p: string): boolean {
  if (!p) return false;
  return /[/\\]\.(claude|codex)[/\\]plugins[/\\](cache|marketplaces)[/\\]/.test(p);
}

/**
 * Issue #45 / c4529042182 — recover the project-cwd from a Codex CLI
 * session log when the spawned MCP child inherits a non-project cwd
 * (e.g. $HOME when Codex was launched from anywhere outside the project).
 *
 * Codex writes its session transcripts to either
 * `${CODEX_HOME ?? ~/.codex}/sessions/<uuid>.jsonl` (CLI) or a dated desktop
 * layout such as
 * `${CODEX_HOME ?? ~/.codex}/sessions/YYYY/MM/DD/rollout-*.jsonl`.
 * The cwd appears on `meta.cwd` for the CLI shape and on
 * `payload.cwd` in `type: "session_meta"` records for Codex Desktop. Codex
 * publishes NO workspace env var to its child MCP processes — so unlike
 * Claude/Pi/Cursor, we have no env signal at all. The session log is the
 * strongest available signal.
 *
 * Mirror of `resolveProjectDirFromTranscript` for Claude Code; differences:
 *   • Sessions may live flat or in a dated hierarchy (no per-project encoded
 *     subdir like Claude's `~/.claude/projects/<encoded>/`).
 *   • The cwd is nested on `meta.cwd` or `payload.cwd`, not top-level `cwd`.
 *
 * Returns `null` when:
 *   • `codexHome` or its `sessions/` subdir does not exist.
 *   • No `.jsonl` files exist or none has a parseable cwd string.
 *   • The newest log is older than `transcriptMaxAgeMs` (multi-window guard).
 *   • The resolved cwd points at a plugin install path (poisoned).
 */
export function resolveCodexSessionCwd(opts?: {
  /** Defaults to `process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex")`. */
  codexHome?: string;
  /** MCP calls must select their own thread, independent of other rollouts' mtimes. */
  sessionId?: string;
  /**
   * Optional freshness guard — Codex appends to the active log while the
   * session is running, so a stale log from days ago must not become a
   * global project-dir signal.
   */
  transcriptMaxAgeMs?: number;
  /** Test seam for transcriptMaxAgeMs. Defaults to Date.now(). */
  now?: number;
}): string | null {
  const sessionId = opts?.sessionId;
  if (sessionId !== undefined && !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) return null;
  const codexHome =
    opts?.codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  const sessionsDir = path.join(codexHome, "sessions");
  if (!fs.existsSync(sessionsDir)) return null;

  const MAX_SCAN_DEPTH = 4; // sessions/YYYY/MM/DD/<file>.jsonl plus one spare.
  const MAX_SCAN_ENTRIES = 10_000;
  let visitedEntries = 0;
  let bestPath: string | undefined;
  let bestMtime = 0;
  const visit = (dir: string, depth: number) => {
    if (visitedEntries >= MAX_SCAN_ENTRIES) return;
    let entries: string[];
    try { entries = fs.readdirSync(dir); } catch { return; }
    entries.sort().reverse();
    for (const entry of entries) {
      if (visitedEntries >= MAX_SCAN_ENTRIES) return;
      visitedEntries++;
      const fp = path.join(dir, entry);
      let stat;
      try { stat = fs.statSync(fp); } catch { continue; }
      if (stat.isDirectory()) {
        if (depth < MAX_SCAN_DEPTH) visit(fp, depth + 1);
        continue;
      }
      if (!stat.isFile() || !entry.endsWith(".jsonl")) continue;
      if (sessionId && entry !== `${sessionId}.jsonl` && !entry.endsWith(`-${sessionId}.jsonl`)) continue;
      const m = stat.mtimeMs;
      if (!bestPath || m > bestMtime) { bestMtime = m; bestPath = fp; }
    }
  };
  try {
    visit(sessionsDir, 0);
  } catch { return null; }

  if (!bestPath) return null;
  if (!sessionId && typeof opts?.transcriptMaxAgeMs === "number") {
    const nowMs = opts.now ?? Date.now();
    if (nowMs - bestMtime > opts.transcriptMaxAgeMs) return null;
  }

  // Read a bounded head chunk. Codex Desktop's first session_meta line can be
  // larger than Claude/Codex CLI metadata because it includes dynamic tool and
  // instruction fields, but the full transcript can still be tens of MB.
  try {
    const fd = fs.openSync(bestPath, "r");
    try {
      const buf = Buffer.alloc(1024 * 1024);
      const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
      const text = buf.subarray(0, bytes).toString("utf-8");
      for (const line of text.split("\n").slice(0, 10)) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as {
            type?: unknown;
            meta?: { cwd?: unknown; id?: unknown };
            payload?: { cwd?: unknown; id?: unknown };
          };
          const metadata = obj?.meta ?? (obj?.type === "session_meta" ? obj?.payload : undefined);
          if (sessionId && metadata?.id !== undefined && metadata.id !== sessionId) return null;
          const cwd = obj?.meta?.cwd ??
            (obj?.type === "session_meta" ? obj?.payload?.cwd : undefined);
          if (typeof cwd !== "string" || cwd.length === 0) continue;
          if (isPluginInstallPath(cwd)) return null;
          return cwd;
        } catch { return null; /* malformed session metadata line */ }
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch { return null; /* file vanished mid-read */ }
  return null;
}

/** Codex's MCP metadata is separate from model-supplied tool arguments. */
export function resolveCodexRequestContext(
  meta: Record<string, unknown> | undefined,
  codexHome?: string,
  explicitProjectDir?: string,
): { projectDir: string; sessionId?: string } | null {
  const sessionId = meta?.threadId ?? meta?.sessionId;
  if (sessionId !== undefined && (typeof sessionId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId))) {
    throw new Error("Invalid Codex thread identity in MCP metadata.");
  }
  const pinnedDir = explicitProjectDir && path.isAbsolute(explicitProjectDir) && !isPluginInstallPath(explicitProjectDir)
    ? explicitProjectDir : undefined;
  if (sessionId === undefined) return pinnedDir ? { projectDir: pinnedDir } : null;
  const projectDir = resolveCodexSessionCwd({ codexHome, sessionId }) ?? pinnedDir;
  if (!projectDir) {
    throw new Error("Cannot resolve this Codex thread's workspace; refusing to use another thread's repo.");
  }
  return { projectDir, sessionId };
}

/** Startup/CLI fallback only; request routing uses resolveCodexRequestContext. */
export function resolveProjectDir(opts: {
  env: Record<string, string | undefined>;
  cwd: string;
  pwd: string | undefined;
  transcriptMaxAgeMs?: number;
  nowMs?: number;
  codexHome?: string;
}): string {
  const pinned = opts.env.CONTEXT_MODE_PROJECT_DIR;
  if (pinned && !isPluginInstallPath(pinned)) return pinned;
  const fromCodex = resolveCodexSessionCwd({
    codexHome: opts.codexHome,
    transcriptMaxAgeMs: opts.transcriptMaxAgeMs,
    now: opts.nowMs,
  });
  if (fromCodex) return fromCodex;
  if (opts.pwd && !isPluginInstallPath(opts.pwd)) return opts.pwd;
  return opts.cwd;
}
