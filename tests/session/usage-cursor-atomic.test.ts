import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionDB } from "../../src/session/db.js";

const event = { type: "agent_usage", category: "cost", data: "tokens_in:100 tokens_out:20", priority: 2, data_hash: "" };
describe("atomic usage/cursor commit", () => {
  it("rejects stale readers and keeps valid identical deltas on distinct cursor advances", () => {
    const path = join(mkdtempSync(join(tmpdir(), "usage-cas-")), "session.db");
    const a = new SessionDB({ dbPath: path }); const b = new SessionDB({ dbPath: path });
    try {
      a.ensureSession("session", "/repo");
      const initial = b.getUsageCursor("session");
      expect(a.bulkInsertEvents("session", [event], "Stop", undefined, undefined, { expected: initial, next: "one" })).toBe(true);
      expect(b.bulkInsertEvents("session", [event], "Stop", undefined, undefined, { expected: initial, next: "two" })).toBe(false);
      expect(b.getEvents("session", { type: "agent_usage" })).toHaveLength(1);
      expect(b.bulkInsertEvents("session", [event], "Stop", undefined, undefined, { expected: "one", next: "two" })).toBe(true);
      expect(a.getEvents("session", { type: "agent_usage" })).toHaveLength(2);
      expect(a.getUsageCursor("session")).toBe("two");
      expect(a.bulkInsertEvents("session", [], "Stop", undefined, undefined, { expected: "two", next: "model-only" })).toBe(true);
      expect(b.getUsageCursor("session")).toBe("model-only");
    } finally { b.close(); a.cleanup(); }
  });

  it("rolls back the cursor if event insertion fails", () => {
    const db = new SessionDB({ dbPath: join(mkdtempSync(join(tmpdir(), "usage-rollback-")), "session.db") });
    try {
      db.ensureSession("session", "/repo");
      db.db.exec("CREATE TRIGGER fail_usage BEFORE INSERT ON session_events WHEN NEW.type = 'agent_usage' BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
      expect(() => db.bulkInsertEvents("session", [event], "Stop", undefined, undefined, { expected: null, next: "one" })).toThrow("injected failure");
      expect(db.getUsageCursor("session")).toBeNull();
      expect(db.getEvents("session")).toEqual([]);
      db.db.exec("DROP TRIGGER fail_usage");
      expect(db.bulkInsertEvents("session", [event], "Stop", undefined, undefined, { expected: null, next: "one" })).toBe(true);
    } finally { db.cleanup(); }
  });
});
