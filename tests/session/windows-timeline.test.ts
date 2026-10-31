import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionDB } from "../../src/session/db.js";

const open: SessionDB[] = [];
afterEach(() => { for (const db of open.splice(0)) db.cleanup(); });

describe("timeline canonical project matching", () => {
  it("finds legacy separator/trailing-slash rows without including neighboring projects/worktrees", () => {
    const db = new SessionDB({ dbPath: join(mkdtempSync(join(tmpdir(), "timeline-path-")), "session.db") });
    open.push(db);
    const projects = ["C:\\Users\\me\\repo\\", "C:/Users/me/repo/", "C:/Users/me/repo-other", "C:/Users/me/repo/worktree"];
    projects.forEach((p, i) => {
      db.ensureSession(`s${i}`, p);
      db.insertEvent(`s${i}`, { type: "user_prompt", category: "user-prompt", data: `CANONICAL_MARKER_${i}`, priority: 1 });
      // Explicit legacy row: no migration or write-time normalization required.
      db.db.prepare("UPDATE session_events SET project_dir = ? WHERE session_id = ?").run(p, `s${i}`);
    });
    for (const p of ["C:\\Users\\me\\repo", "C:/Users/me/repo///"]) {
      expect(db.searchEvents("CANONICAL_MARKER", 10, p, "user-prompt").map(r => r.session_id)).toEqual(["s0", "s1"]);
      expect(db.getSessionIdsForProject(p).sort()).toEqual(["s0", "s1"]);
    }
    if (process.platform === "win32" || process.platform === "darwin") {
      expect(db.searchEvents("CANONICAL_MARKER", 10, "c:/users/ME/REPO").map(r => r.session_id)).toEqual(["s0", "s1"]);
    }
    expect(db.searchEvents("CANONICAL_MARKER", 10, "C:/Users/me/repo/worktree").map(r => r.session_id)).toEqual(["s3"]);
    expect(db.searchEvents("CANONICAL_MARKER", 10, "C:/elsewhere")).toEqual([]);
  });

  it("preserves drive and filesystem roots rather than matching an empty project", () => {
    const db = new SessionDB({ dbPath: join(mkdtempSync(join(tmpdir(), "timeline-root-")), "session.db") });
    open.push(db);
    for (const [sid, p] of [["unix", "/"], ["drive", "C:\\"]]) {
      db.ensureSession(sid, p);
      db.insertEvent(sid, { type: "decision", category: "decision", data: "ROOT_MARKER", priority: 1 });
    }
    expect(db.searchEvents("ROOT_MARKER", 10, "/").map(r => r.session_id)).toEqual(["unix"]);
    expect(db.searchEvents("ROOT_MARKER", 10, "C:/").map(r => r.session_id)).toEqual(["drive"]);
  });

  it("uses full Unicode canonicalization rather than SQLite's ASCII-only LOWER", () => {
    const db = new SessionDB({ dbPath: join(mkdtempSync(join(tmpdir(), "timeline-unicode-")), "session.db") });
    open.push(db);
    db.ensureSession("own", "C:\\Users\\Đặng\\Repo\\");
    db.insertEvent("own", { type: "user_prompt", category: "user-prompt", data: "UNICODE_MARKER", priority: 1 });
    db.ensureSession("other", "C:/Users/Đặng/Repo-other");
    db.insertEvent("other", { type: "user_prompt", category: "user-prompt", data: "UNICODE_MARKER", priority: 1 });
    const path = process.platform === "win32" || process.platform === "darwin"
      ? "c:/users/đặng/repo/" : "C:/Users/Đặng/Repo/";
    expect(db.searchEvents("UNICODE_MARKER", 10, path).map(r => r.session_id)).toEqual(["own"]);
    expect(db.getSessionIdsForProject(path)).toEqual(["own"]);
  });
});
