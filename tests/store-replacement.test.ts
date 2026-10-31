import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContentStore } from "../src/store.js";
import { loadDatabase } from "../src/db-base.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ctx-replacement-")); roots.push(root);
  const path = join(root, "index.db"), store = new ContentStore(path);
  const Database = loadDatabase(), db = new Database(path);
  return { store, db, path };
}
function integrity(path: string) {
  // Use a fresh FTS handle after writes by the sibling connection.
  const Database = loadDatabase(), db = new Database(path);
  try { return db.prepare("PRAGMA integrity_check").all(); }
  finally { db.close(); }
}

test("replacement removes all legacy duplicates, preserves other sources, attribution and empty labels", () => {
  const { store, db, path } = fixture();
  try {
    store.index({ content: "# Old\nlegacyoldmarker", source: "shared" });
    store.index({ content: "# Keep\nindependentmarker", source: "other" });
    const duplicate = Number(db.prepare("INSERT INTO sources(label) VALUES ('shared')").run().lastInsertRowid);
    for (const table of ["chunks", "chunks_trigram"]) db.prepare(`INSERT INTO ${table}(title,content,source_id) VALUES (?,?,?)`).run("Legacy", "duplicatemarker", duplicate);
    expect(integrity(path)).toEqual([{ integrity_check: "ok" }]);
    const result = store.index({ content: "# New\n```ts\nconst preserved = 'đúng ✓';\n```", source: "shared", attribution: { sessionId: "session", eventId: "event" } });
    expect(integrity(path)).toEqual([{ integrity_check: "ok" }]);
    expect(db.prepare("SELECT id FROM sources WHERE label='shared'").all()).toEqual([{ id: result.sourceId }]);
    const columns = "title,content,source_id,content_type,source_category,session_id,event_id,timestamp";
    const porter = db.prepare(`SELECT ${columns} FROM chunks ORDER BY rowid`).all();
    expect(db.prepare(`SELECT ${columns} FROM chunks_trigram ORDER BY rowid`).all()).toEqual(porter);
    expect(porter).toHaveLength(2);
    expect(porter[1]).toMatchObject({ source_id: result.sourceId, session_id: "session", event_id: "event", content_type: "code" });
    expect(store.search("legacyoldmarker")).toHaveLength(0);
    expect(store.search("duplicatemarker")).toHaveLength(0);
    expect(store.search("independentmarker")).toHaveLength(1);
    store.indexPlainText("", "shared");
    expect(db.prepare("SELECT count(*) AS n FROM sources WHERE label='shared'").get()).toEqual({ n: 1 });
    expect(store.search("preserved")).toHaveLength(0);
    store.indexPlainText("emptylabelmarker", "");
    store.indexPlainText("replacementmarker", "");
    expect(store.search("emptylabelmarker")).toHaveLength(0);
    expect(store.search("replacementmarker")).toHaveLength(1);
    expect(integrity(path)).toEqual([{ integrity_check: "ok" }]);
  } finally { db.close(); store.close(); }
});

test("a failed replacement rolls back the new source and both FTS deletes", () => {
  const { store, db } = fixture();
  try {
    const original = store.indexPlainText("atomicoriginalmarker", "shared");
    db.exec("CREATE TRIGGER fail_replacement BEFORE DELETE ON sources BEGIN SELECT RAISE(ABORT, 'injected replacement failure'); END");
    expect(() => store.indexPlainText("atomicnewmarker", "shared")).toThrow("injected replacement failure");
    expect(db.prepare("SELECT id FROM sources").all()).toEqual([{ id: original.sourceId }]);
    for (const table of ["chunks", "chunks_trigram"]) {
      expect(db.prepare(`SELECT content FROM ${table}`).all()).toEqual([{ content: "atomicoriginalmarker" }]);
    }
    db.exec("DROP TRIGGER fail_replacement");
    store.indexPlainText("atomicnewmarker", "shared");
    expect(store.search("atomicoriginalmarker")).toHaveLength(0);
    expect(store.search("atomicnewmarker")).toHaveLength(1);
  } finally { db.close(); store.close(); }
});
