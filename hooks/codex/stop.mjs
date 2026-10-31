#!/usr/bin/env node
import "./platform.mjs";
import "../suppress-stderr.mjs";
import { readStdin, parseStdin, getSessionId, getSessionDBPath,
  getInputProjectDir, resolveConfigDir, CODEX_OPTS } from "../session-helpers.mjs";
import { createSessionLoaders } from "../session-loaders.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOOK_DIR = dirname(fileURLToPath(import.meta.url));
const { loadSessionDB, loadProjectAttribution } = createSessionLoaders(HOOK_DIR);
let db;
try {
  const input = parseStdin(await readStdin());
  const projectDir = getInputProjectDir(input, CODEX_OPTS);
  const sessionId = getSessionId(input, CODEX_OPTS);
  const { SessionDB } = await loadSessionDB();
  db = new SessionDB({ dbPath: getSessionDBPath(CODEX_OPTS, projectDir) });
  db.ensureSession(sessionId, projectDir);
  // Stop is a turn boundary, not terminal shutdown.
  db.insertEvent(sessionId, {
    type: "turn_end", category: "session", priority: 1,
    data: JSON.stringify({
      stop_hook_active: input.stop_hook_active ?? false,
      last_assistant_message: typeof input.last_assistant_message === "string"
        ? input.last_assistant_message.slice(0, 2000) : null,
    }),
  }, "Stop");

  try {
    const { findCodexRollout, readCodexUsageIncremental } = await import(
      pathToFileURL(join(HOOK_DIR, "..", "codex-usage.bundle.mjs")).href
    );
    const { resolveProjectAttributions } = await loadProjectAttribution();
    for (;;) {
      const expected = db.getUsageCursor(sessionId);
      const path = findCodexRollout(sessionId, resolveConfigDir(CODEX_OPTS), expected);
      if (!path) break;
      const { events, cursor } = readCodexUsageIncremental(path, expected);
      if (cursor === expected) break;
      const attributions = resolveProjectAttributions(events, {
        sessionOriginDir: db.getSessionStats(sessionId)?.project_dir || projectDir,
        inputProjectDir: projectDir,
        workspaceRoots: Array.isArray(input.workspace_roots) ? input.workspace_roots : [],
        lastKnownProjectDir: db.getLatestAttributedProjectDir(sessionId),
      });
      if (db.bulkInsertEvents(sessionId, events, "Stop", attributions, undefined,
          { expected, next: cursor })) break;
      // Another Stop committed this prefix while we read. Re-read its cursor
      // and process only the remaining suffix; never overwrite a newer cursor.
      // Session cleanup can also remove the metadata row between read/commit.
      db.ensureSession(sessionId, projectDir);
    }
  } catch {
    // Cost capture is best effort. A failed read/commit leaves its cursor and
    // usage unchanged so the next Stop can retry, while turn_end stays stored.
  }
} catch {
  // Hook failures must not break the Codex turn.
} finally {
  try { db?.close(); } catch { /* Best-effort hook teardown. */ }
}
process.stdout.write("{}\n");
