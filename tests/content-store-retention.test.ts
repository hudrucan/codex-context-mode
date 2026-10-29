import { afterEach, describe, expect, test } from "vitest";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, utimesSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ContentStore } from "../src/store.js";
import { loadDatabase } from "../src/db-base.js";
import { resolveContentStorePath } from "../src/session/db.js";
import { buildIsolatedEnvObject } from "./util/isolated-env.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const { fakeHome: root, env: isolated } = buildIsolatedEnvObject();
  roots.push(root);
  const storage = join(root, "storage");
  const content = join(storage, "content");
  const legacy = join(root, ".context-mode", "content");
  mkdirSync(content, { recursive: true });
  mkdirSync(legacy, { recursive: true });
  const current = resolveContentStorePath({ projectDir: root, contentDir: content });
  const env = { ...process.env, ...isolated } as Record<string, string>;
  for (const key of ["CONTEXT_MODE_SESSION_DIR", "CONTEXT_MODE_SESSION_DB", "CONTEXT_MODE_SESSION_SUFFIX", "CLAUDE_PLUGIN_ROOT", "CONTEXT_MODE_EMBEDDED_PLUGIN_TOOLS", "CONTEXT_MODE_BRIDGE_DEPTH"]) delete env[key];
  Object.assign(env, { CONTEXT_MODE_DIR: storage, CODEX_HOME: join(root, ".codex"), CONTEXT_MODE_DISABLE_VERSION_CHECK: "1" });
  return { root, content, legacy, current, env };
}

function seed(path: string, source = "retained") {
  const store = new ContentStore(path);
  store.index({ source, content: "# Retained documentation\nQuasar persistence sentinel remains searchable." });
  return store;
}

function age(path: string, hours: number) {
  const time = new Date(Date.now() - hours * 3600_000);
  utimesSync(path, time, time);
}

function verifyContent(path: string) {
  expect(existsSync(path), path).toBe(true);
  const store = new ContentStore(path);
  try {
    expect(store.search("quasar").length).toBeGreaterThan(0);
  } finally { store.close(); }
  const db = new (loadDatabase())(path);
  try {
    expect(db.prepare("PRAGMA integrity_check").all()).toEqual([{ integrity_check: "ok" }]);
  } finally { db.close(); }
}

async function withServer(f: ReturnType<typeof fixture>, run: (client: Client) => Promise<void>) {
  const client = new Client({ name: "content-retention-regression", version: "1.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("server.bundle.mjs")],
    cwd: f.root,
    env: f.env,
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    await run(client);
  } finally { await client.close(); }
}

async function search(client: Client) {
  const result = await client.callTool({ name: "ctx_search", arguments: { queries: ["quasar"] } });
  expect(result.isError, JSON.stringify(result)).not.toBe(true);
  return JSON.stringify(result);
}

describe("persistent content DB retention during MCP startup and first use", () => {
  test("recent peer DB and nonempty WAL older than one hour survive", async () => {
    const f = fixture();
    seed(f.current).close();
    // Copy a live WAL-mode DB to simulate an uncheckpointed process exit.
    const writerPath = join(f.root, "writer.db");
    const writer = seed(writerPath);
    const peer = join(f.content, "peer.db");
    try {
      for (const suffix of ["", "-wal", "-shm"]) copyFileSync(writerPath + suffix, peer + suffix);
    } finally { writer.close(); }
    age(peer + "-wal", 2);
    expect(statSync(peer + "-wal").size).toBeGreaterThan(0);
    expect(statSync(peer).mtimeMs).toBeGreaterThan(Date.now() - 3600_000);
    await withServer(f, async (client) => {
      expect(existsSync(peer)).toBe(true);
      await search(client);
      for (const suffix of ["", "-wal", "-shm"]) expect(existsSync(peer + suffix), suffix).toBe(true);
    });
    verifyContent(peer);
  });

  test.each([2, 24 * 30])("live peer DB survives with file age %i hours", async (hours) => {
    const f = fixture();
    seed(f.current).close();
    const peer = join(f.content, "live-peer.db");
    const writer = seed(peer);
    try {
      for (const suffix of ["", "-wal", "-shm"]) age(peer + suffix, hours);
      await withServer(f, async (client) => {
        await search(client);
        for (const suffix of ["", "-wal", "-shm"]) expect(existsSync(peer + suffix), suffix).toBe(true);
        expect(writer.search("quasar").length).toBeGreaterThan(0);
        verifyContent(peer);
      });
    } finally { writer.close(); }
    verifyContent(peer);
  });

  test.each(["peer", "legacy"])("closed %s DB survives startup, first use and shutdown", async (kind) => {
    const f = fixture();
    const path = join(kind === "peer" ? f.content : f.legacy, "old.db");
    seed(path).close();
    age(path, 24 * 30);
    seed(f.current).close();
    await withServer(f, async (client) => {
      expect(existsSync(path)).toBe(true);
      expect(await search(client)).toContain("Quasar persistence sentinel");
      verifyContent(path);
    });
    for (const dbPath of [f.current, path]) verifyContent(dbPath);
  });

  test("first use still removes only source rows older than 14 days", async () => {
    const f = fixture();
    const store = seed(f.current, "recent");
    for (const source of ["expired", "before-cutoff", "after-cutoff"]) {
      store.index({ source, content: `# ${source}\nQuasar ${source} documentation.` });
    }
    store.close();
    const db = new (loadDatabase())(f.current);
    try {
      db.exec(`
        UPDATE sources SET indexed_at = datetime('now', '-15 days') WHERE label = 'expired';
        UPDATE sources SET indexed_at = datetime('now', '-14 days', '-5 minutes') WHERE label = 'before-cutoff';
        UPDATE sources SET indexed_at = datetime('now', '-14 days', '+5 minutes') WHERE label = 'after-cutoff';
      `);
    } finally { db.close(); }
    await withServer(f, async (client) => {
      expect(await search(client)).toContain("Quasar persistence sentinel");
    });
    const retained = new ContentStore(f.current);
    try {
      expect(retained.getSourceMeta("expired")).toBeNull();
      expect(retained.getSourceMeta("before-cutoff")).toBeNull();
      expect(retained.getSourceMeta("after-cutoff")).not.toBeNull();
      expect(retained.getSourceMeta("recent")).not.toBeNull();
      expect(retained.cleanupStaleSources(14)).toBe(0);
    } finally { retained.close(); }
    const check = new (loadDatabase())(f.current);
    try {
      for (const table of ["chunks", "chunks_trigram"]) {
        const labels = check.prepare(`SELECT DISTINCT s.label FROM ${table} c JOIN sources s ON c.source_id = s.id ORDER BY s.label`).all();
        expect(labels).toEqual([{ label: "after-cutoff" }, { label: "recent" }]);
        expect(check.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE source_id NOT IN (SELECT id FROM sources)`).get()).toEqual({ n: 0 });
      }
    } finally { check.close(); }
    verifyContent(f.current);
  });

  test("session-scoped purge closes the persistent handle without deleting other content", async () => {
    const f = fixture();
    seed(f.current).close();
    await withServer(f, async (client) => {
      await search(client);
      const result = await client.callTool({ name: "ctx_purge", arguments: { confirm: true, scope: "session", sessionId: "12345678-1234-4234-8234-123456789abc" } });
      expect(result.isError).not.toBe(true);
      expect(existsSync(f.current)).toBe(true);
      expect(await search(client)).toContain("Quasar persistence sentinel");
    });
    verifyContent(f.current);
  });
});
