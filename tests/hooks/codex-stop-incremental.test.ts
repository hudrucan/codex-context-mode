import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { SessionDB, resolveSessionDbPath } from "../../src/session/db.js";

describe("native Stop incremental capture", () => {
  it("commits concurrent usage once, preserves equal valid deltas and waits for a partial record", async () => {
    const root = mkdtempSync(join(tmpdir(), "native-stop-cas-"));
    const project = join(root, "project"); const home = join(root, "home");
    const codexHome = join(root, "codex"); const storage = join(root, "context");
    for (const p of [project, home, join(codexHome, "sessions"), storage, join(root, "tmp")]) mkdirSync(p, { recursive: true });
    const sid = "11111111-2222-4333-8444-555555555555";
    const path = join(codexHome, "sessions", `rollout-test-${sid}.jsonl`);
    const row = JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: {
      last_token_usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
    } } });
    writeFileSync(path, JSON.stringify({ type: "turn_context", payload: { model: "gpt-5" } }) + "\n" + row + "\n");
    const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: codexHome,
      CODEX_CONTEXT_MODE_HOME: storage, CONTEXT_MODE_SESSION_SUFFIX: "",
      TEMP: join(root, "tmp"), TMP: join(root, "tmp") };
    const invoke = () => new Promise<void>((done, reject) => {
      const child = spawn(process.execPath, [resolve("hooks/codex/stop.mjs")], { env, cwd: project, windowsHide: true });
      let output = ""; let error = "";
      const timeout = setTimeout(() => { child.kill(); reject(new Error("Stop did not finish")); }, 10_000);
      child.stdout.on("data", c => output += c); child.stderr.on("data", c => error += c);
      child.on("error", reject);
      child.on("close", code => {
        clearTimeout(timeout);
        if (code !== 0 || output.trim() !== "{}") reject(new Error(`Stop ${code}: ${error} ${output}`));
        else done();
      });
      child.stdin.end(JSON.stringify({ session_id: sid, cwd: project, last_assistant_message: "fixture" }));
    });
    const inspect = () => {
      const db = new SessionDB({ dbPath: resolveSessionDbPath({ projectDir: project, sessionsDir: join(storage, "data", "sessions") }) });
      try { return { rows: db.getEvents(sid, { type: "agent_usage" }), cursor: JSON.parse(db.getUsageCursor(sid)!) }; }
      finally { db.close(); }
    };
    // A one-shot cleanup between cursor read and commit must not leave Stop
    // retrying a missing metadata row forever.
    mkdirSync(join(storage, "data", "sessions"), { recursive: true });
    const seed = new SessionDB({ dbPath: resolveSessionDbPath({ projectDir: project, sessionsDir: join(storage, "data", "sessions") }) });
    seed.ensureSession(sid, project);
    seed.db.exec(`CREATE TABLE cleanup_once (done INTEGER);
      CREATE TRIGGER cleanup_during_capture BEFORE UPDATE OF usage_cursor ON session_meta
      WHEN (SELECT COUNT(*) FROM cleanup_once) = 0 BEGIN
        INSERT INTO cleanup_once VALUES (1);
        DELETE FROM session_meta WHERE session_id = OLD.session_id;
      END`);
    seed.close();
    await invoke();
    expect(inspect().rows).toHaveLength(1);
    await Promise.all(Array.from({ length: 4 }, invoke));
    expect(inspect().rows).toHaveLength(1);
    appendFileSync(path, row + "\n");
    await Promise.all(Array.from({ length: 4 }, invoke));
    expect(inspect().rows).toHaveLength(2);
    const settled = inspect().cursor.offset;
    appendFileSync(path, row.slice(0, -5));
    await Promise.all(Array.from({ length: 4 }, invoke));
    expect(inspect().cursor.offset).toBe(settled);
    expect(inspect().rows).toHaveLength(2);
    appendFileSync(path, row.slice(-5) + "\n");
    await Promise.all(Array.from({ length: 4 }, invoke));
    const final = inspect();
    expect(final.rows).toHaveLength(3);
    expect(final.cursor.offset).toBe(statSync(path).size);
    expect(final.rows.every(r => r.data.includes("tokens_in:100 tokens_out:20"))).toBe(true);
  });
});
