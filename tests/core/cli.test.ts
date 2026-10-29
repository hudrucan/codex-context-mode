/**
 * Consolidated CLI tests
 *
 * Combines:
 *   - cli-bundle.test.ts (marketplace install support)
 *   - cli-hook-path.test.ts (forward-slash hook paths)
 *   - package-exports.test.ts (public API surface)
 */
import { describe, it, test, expect, beforeEach, afterEach } from "vitest";
import { strict as assert } from "node:assert";
import { readFileSync, existsSync, accessSync, constants, mkdirSync, writeFileSync, rmSync, readdirSync, cpSync, symlinkSync, lstatSync } from "node:fs";
import { resolve, join, dirname, sep } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { execSync, spawnSync } from "node:child_process";
import { toUnixPath } from "../../src/cli.js";
import { findMissingLaunchFiles } from "../../src/util/plugin-cache-integrity.js";

const ROOT = resolve(import.meta.dirname, "../..");

// ── cli.bundle.mjs — marketplace install support ──────────────────────

describe("cli.bundle.mjs — marketplace install support", () => {
  // ── Package configuration ─────────────────────────────────

  it("package.json files field includes cli.bundle.mjs", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
    expect(pkg.files).toContain("cli.bundle.mjs");
  });

  it("package.json files field includes Codex plugin files", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
    expect(pkg.files).toContain(".codex-plugin");
  });

  it("Codex plugin MCP manifest approves context-mode tools by default", () => {
    const mcp = JSON.parse(readFileSync(resolve(ROOT, ".codex-plugin", "mcp.json"), "utf-8"));
    expect(mcp.mcpServers["context-mode"].default_tools_approval_mode).toBe("approve");
  });

  it("package.json bundle script builds cli.bundle.mjs", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
    expect(pkg.scripts.bundle).toContain("cli.bundle.mjs");
    expect(pkg.scripts.bundle).toContain("src/cli.ts");
  });

  // ── Bundle artifact ────────────────────────────────────────

  it("cli.bundle.mjs exists after npm run bundle", () => {
    expect(existsSync(resolve(ROOT, "cli.bundle.mjs"))).toBe(true);
  });

  it("cli.bundle.mjs is readable", () => {
    expect(() => accessSync(resolve(ROOT, "cli.bundle.mjs"), constants.R_OK)).not.toThrow();
  });

  it("cli.bundle.mjs has shebang only on line 1 (Node.js strips it)", () => {
    const content = readFileSync(resolve(ROOT, "cli.bundle.mjs"), "utf-8");
    const lines = content.split("\n");
    expect(lines[0].startsWith("#!")).toBe(true);
    // No shebang on any other line (would cause SyntaxError)
    const shebangsAfterLine1 = lines.slice(1).filter(l => l.startsWith("#!"));
    expect(shebangsAfterLine1).toHaveLength(0);
  });

  // ── Source code contracts ──────────────────────────────────

  it("cli.ts getPluginRoot handles both build/ and root locations", () => {
    const src = readFileSync(resolve(ROOT, "src", "cli.ts"), "utf-8");
    // Must detect build/ subdirectory and go up, or stay at root
    expect(src).toContain('endsWith("/build")');
    expect(src).toContain('endsWith("\\\\build")');
  });

  it("cli.ts exposes index/search commands for terminal knowledge-base access", () => {
    const src = readFileSync(resolve(ROOT, "src", "cli.ts"), "utf-8");
    expect(src).toContain("context-mode index <path>");
    expect(src).toContain("context-mode search <query...>");
    expect(src).toContain('args[0] === "index"');
    expect(src).toContain('args[0] === "search"');
    expect(src).toContain("resolveContentStorePath");
    expect(src).toContain("searchWithFallback");
  });

  it("cli.ts upgrade doctor call prefers cli.bundle.mjs with fallback", () => {
    const src = readFileSync(resolve(ROOT, "src", "cli.ts"), "utf-8");
    expect(src).toContain("cli.bundle.mjs");
    expect(src).toContain("build");
    expect(src).toContain("cli.js");
    // Must use existsSync for fallback
    expect(src).toContain("existsSync");
  });

  // ── Skill files ────────────────────────────────────────────

  it("ctx-upgrade skill uses cli.bundle.mjs with fallback", () => {
    const skill = readFileSync(resolve(ROOT, "skills", "ctx-upgrade", "SKILL.md"), "utf-8");
    expect(skill).toContain("cli.bundle.mjs");
    expect(skill).toContain("build/cli.js");
    // Fallback pattern: try bundle first, then build
    expect(skill).toMatch(/CLI=.*cli\.bundle\.mjs.*\[ ! -f.*\].*build\/cli\.js/);
  });

  it("ctx-doctor skill uses cli.bundle.mjs with fallback", () => {
    const skill = readFileSync(resolve(ROOT, "skills", "ctx-doctor", "SKILL.md"), "utf-8");
    expect(skill).toContain("cli.bundle.mjs");
    expect(skill).toContain("build/cli.js");
    expect(skill).toMatch(/CLI=.*cli\.bundle\.mjs.*\[ ! -f.*\].*build\/cli\.js/);
  });

  it("ctx-index and ctx-search skills expose slash-style triggers", () => {
    const indexSkill = readFileSync(resolve(ROOT, "skills", "ctx-index", "SKILL.md"), "utf-8");
    const searchSkill = readFileSync(resolve(ROOT, "skills", "ctx-search", "SKILL.md"), "utf-8");
    expect(indexSkill).toContain("Trigger: /context-mode:ctx-index");
    expect(indexSkill).toContain("user-invocable: true");
    expect(indexSkill).toContain("context-mode index");
    expect(searchSkill).toContain("Trigger: /context-mode:ctx-search");
    expect(searchSkill).toContain("user-invocable: true");
    expect(searchSkill).toContain("context-mode search");
  });

  // ── .gitignore ─────────────────────────────────────────────

  it(".gitignore excludes bundle files (CI uses git add -f)", () => {
    const gitignore = readFileSync(resolve(ROOT, ".gitignore"), "utf-8");
    expect(gitignore).toContain("server.bundle.mjs");
    expect(gitignore).toContain("cli.bundle.mjs");
  });
});

// ── ABI-aware native binary caching (#148) ────────────────────────────

/**
 * Extract ensureNativeCompat from hooks/ensure-deps.mjs at test time.
 * ensure-deps.mjs is the shared bootstrap with side effects (auto-runs on import),
 * so we extract the function source via regex, wrap it as a temp ESM module,
 * and dynamically import it — tests always run against the real code.
 */
async function loadEnsureNativeCompat(): Promise<(pluginRoot: string) => void> {
  const src = readFileSync(resolve(ROOT, "hooks", "ensure-deps.mjs"), "utf-8");
  const match = src.match(/^export function ensureNativeCompat\b[\s\S]*?^}/m);
  if (!match) throw new Error("ensureNativeCompat not found in hooks/ensure-deps.mjs");

  // Also extract hasModernSqlite if ensureNativeCompat calls it (#331)
  const helperMatch = src.match(/^function hasModernSqlite\b[\s\S]*?^}/m);
  const helpers = helperMatch ? helperMatch[0] + "\n" : "";

  // Extract codesignBinary and probeNativeInChildProcess helpers if present
  const replaceBinaryMatch = src.match(/^function replaceActiveNativeBinaryFromCache\b[\s\S]*?^}/m);
  const codesignMatch = src.match(/^(?:export\s+)?function codesignBinary\b[\s\S]*?^}/m);
  const probeMatch = src.match(/^function probeNativeInChildProcess\b[\s\S]*?^}/m);
  const replaceBinary = replaceBinaryMatch ? replaceBinaryMatch[0] + "\n" : "";
  const codesign = codesignMatch ? codesignMatch[0] + "\n" : "";
  const probe = probeMatch ? probeMatch[0] + "\n" : "";

  const tmpFile = join(tmpdir(), `abi-test-${Date.now()}.mjs`);
  writeFileSync(tmpFile, [
    'import { existsSync, copyFileSync, renameSync, unlinkSync } from "node:fs";',
    'import { resolve } from "node:path";',
    'import { createRequire } from "node:module";',
    'import { execSync } from "node:child_process";',
    helpers,
    codesign,
    replaceBinary,
    probe,
    `${match[0]}`,
  ].join("\n"));

  try {
    const mod = await import(tmpFile);
    return mod.ensureNativeCompat;
  } finally {
    rmSync(tmpFile, { force: true });
  }
}

describe("ABI-aware native binary caching (#148)", () => {
  let tempDir: string;
  let releaseDir: string;
  let binaryPath: string;

  const currentAbi = process.versions.modules;

  function abiCachePath(abi: string = currentAbi): string {
    return join(releaseDir, `better_sqlite3.abi${abi}.node`);
  }

  function createFakeBinary(path: string, content: string = "fake-binary"): void {
    writeFileSync(path, content);
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "abi-test-"));
    releaseDir = join(tempDir, "node_modules", "better-sqlite3", "build", "Release");
    binaryPath = join(releaseDir, "better_sqlite3.node");
    mkdirSync(releaseDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("ensure-deps.mjs contains ensureNativeCompat function", () => {
    const src = readFileSync(resolve(ROOT, "hooks", "ensure-deps.mjs"), "utf-8");
    expect(src).toContain("function ensureNativeCompat");
    // ensure-deps.mjs auto-runs the function with root on import
    expect(src).toContain("ensureNativeCompat(root)");
  });

  test("cache hit: copies cached ABI binary to active path", async () => {
    const ensureNativeCompat = await loadEnsureNativeCompat();
    createFakeBinary(abiCachePath(), "abi-cached-binary");
    createFakeBinary(binaryPath, "old-binary");

    ensureNativeCompat(tempDir);

    expect(readFileSync(binaryPath, "utf-8")).toBe("abi-cached-binary");
  });

  test("missing release directory: does not throw", async () => {
    const ensureNativeCompat = await loadEnsureNativeCompat();
    rmSync(releaseDir, { recursive: true });

    expect(() => ensureNativeCompat(tempDir)).not.toThrow();
  });

  test("missing binary + no cache: does not throw", async () => {
    const ensureNativeCompat = await loadEnsureNativeCompat();
    expect(() => ensureNativeCompat(tempDir)).not.toThrow();
  });

  test("cache hit does not trigger rebuild", async () => {
    const ensureNativeCompat = await loadEnsureNativeCompat();
    createFakeBinary(abiCachePath(), "cached");
    createFakeBinary(binaryPath, "old");

    ensureNativeCompat(tempDir);

    expect(readFileSync(binaryPath, "utf-8")).toBe("cached");
  });

  test("cross-platform: ABI cache filename uses correct format", async () => {
    const ensureNativeCompat = await loadEnsureNativeCompat();
    createFakeBinary(binaryPath, "binary");

    // Trigger probe — will fail (fake binary) but outer catch swallows it
    ensureNativeCompat(tempDir);

    const files = readdirSync(releaseDir);
    const cacheFiles = files.filter(f => f.match(/^better_sqlite3\.abi\d+\.node$/));
    // Probe fails on fake binary, so no cache file is created — that's correct behavior
    expect(cacheFiles.length).toBeLessThanOrEqual(1);
  });

  test("multiple ABI caches coexist without interference", async () => {
    const ensureNativeCompat = await loadEnsureNativeCompat();
    createFakeBinary(join(releaseDir, "better_sqlite3.abi115.node"), "node20-binary");
    createFakeBinary(join(releaseDir, "better_sqlite3.abi137.node"), "node24-binary");
    createFakeBinary(binaryPath, "old");

    ensureNativeCompat(tempDir);

    const expected = currentAbi === "115" ? "node20-binary" : currentAbi === "137" ? "node24-binary" : undefined;
    if (expected) {
      expect(readFileSync(binaryPath, "utf-8")).toBe(expected);
    }

    expect(existsSync(join(releaseDir, "better_sqlite3.abi115.node"))).toBe(true);
    expect(existsSync(join(releaseDir, "better_sqlite3.abi137.node"))).toBe(true);
  });

  // ── Bun ABI cache seeding (#543) ────────────────────────────
  //
  // When ensureNativeCompat runs under Bun, it early-returns BEFORE writing
  // better_sqlite3.abi${N}.node — so the very next /ctx-upgrade run (which
  // checks for that file as the success marker) prints a spurious
  // "Native addon ABI cache missing" warning.
  //
  // Bun spoofs process.versions.modules to the Node ABI (e.g. 137 on
  // Darwin/Bun-1.2+, matching Node 24), so a plain file-copy of the active
  // better_sqlite3.node to the ABI-tagged path produces the CORRECT
  // filename for any subsequent Node boot at the same ABI level.
  //
  // The fix lives BEFORE the existing `if (typeof globalThis.Bun !== "undefined") return;`
  // guard inside ensureNativeCompat: if the active binary exists AND the
  // ABI cache file does NOT, copy active → cache, then early-return.
  //
  // @see https://github.com/mksglu/context-mode/issues/543

  describe("Bun ABI cache seeding (#543)", () => {
    let bunBackup: unknown;
    const hadBun = "Bun" in globalThis;

    beforeEach(() => {
      bunBackup = (globalThis as any).Bun;
      // Simulate Bun runtime without actually running under Bun.
      (globalThis as any).Bun = { version: "test-shim" };
    });

    afterEach(() => {
      if (hadBun) {
        (globalThis as any).Bun = bunBackup;
      } else {
        delete (globalThis as any).Bun;
      }
    });

    test("under Bun, with active .node but no abi cache: seeds the cache via copy", async () => {
      // Load AFTER the Bun shim is installed so the function captures it.
      const ensureNativeCompat = await loadEnsureNativeCompat();
      createFakeBinary(binaryPath, "active-binary-from-postinstall");
      // Cache file is intentionally absent — this is the #543 scenario.
      expect(existsSync(abiCachePath())).toBe(false);

      ensureNativeCompat(tempDir);

      // The fix: copy active → abi-tagged so the next /ctx-upgrade boot
      // (under Node) finds the marker file and reports "ABI cache present".
      expect(existsSync(abiCachePath())).toBe(true);
      expect(readFileSync(abiCachePath(), "utf-8")).toBe("active-binary-from-postinstall");
      // Active binary remains untouched.
      expect(readFileSync(binaryPath, "utf-8")).toBe("active-binary-from-postinstall");
    });

    test("under Bun, without active .node source: does not throw and does not create cache", async () => {
      const ensureNativeCompat = await loadEnsureNativeCompat();
      // No active binary present — Bun-only install or pre-postinstall state.
      expect(existsSync(binaryPath)).toBe(false);

      expect(() => ensureNativeCompat(tempDir)).not.toThrow();

      // No cache should be invented out of thin air.
      expect(existsSync(abiCachePath())).toBe(false);
    });

    test("under Bun, when abi cache already exists: does not overwrite", async () => {
      const ensureNativeCompat = await loadEnsureNativeCompat();
      createFakeBinary(binaryPath, "fresh-active");
      createFakeBinary(abiCachePath(), "preexisting-cache");

      ensureNativeCompat(tempDir);

      // Idempotent: existing cache must be preserved untouched.
      expect(readFileSync(abiCachePath(), "utf-8")).toBe("preexisting-cache");
    });

    test("under Bun, when nativeDir is missing entirely: does not throw and does not create cache", async () => {
      const ensureNativeCompat = await loadEnsureNativeCompat();
      // Remove the release directory before invocation.
      rmSync(releaseDir, { recursive: true, force: true });
      expect(existsSync(releaseDir)).toBe(false);

      expect(() => ensureNativeCompat(tempDir)).not.toThrow();

      // Cache MUST NOT be created because the source dir doesn't exist —
      // creating files inside a deleted directory would either throw or
      // re-materialize state the user explicitly removed.
      expect(existsSync(abiCachePath())).toBe(false);
    });

    test("under Bun, cache filename uses cross-platform resolve() (no hard-coded separators)", () => {
      // Source-contract guard: the fix must reuse the existing resolve()-based
      // path construction (nativeDir / binaryPath / abiCachePath are already
      // resolve()'d at the top of ensureNativeCompat). A future maintainer
      // adding hard-coded "/" or "\\" inside the Bun branch would break
      // Windows. We assert the fix lives inside ensureNativeCompat AND that
      // no new path concatenation with hard-coded separators appears in
      // the Bun branch.
      const src = readFileSync(resolve(ROOT, "hooks", "ensure-deps.mjs"), "utf-8");
      const fnMatch = src.match(/^export function ensureNativeCompat\b[\s\S]*?^}/m);
      expect(fnMatch).not.toBeNull();
      const body = fnMatch![0];
      // The fix must reference both source and destination paths.
      expect(body).toMatch(/binaryPath/);
      expect(body).toMatch(/abiCachePath/);
      // Cross-platform safety: no path string built with "\\" or "/" literals
      // inside the Bun gate region. We anchor on the Bun gate comment and
      // scan the surrounding region for forbidden hard-coded separators.
      const bunGateIdx = body.indexOf("Bun ships bun:sqlite");
      expect(bunGateIdx).toBeGreaterThan(-1);
      const bunRegion = body.slice(Math.max(0, bunGateIdx - 200), bunGateIdx + 600);
      // No string concatenation with hard-coded path separators in the Bun region.
      expect(bunRegion).not.toMatch(/["'][^"']*\\\\better_sqlite3/);
      expect(bunRegion).not.toMatch(/["']\/[^"']*better_sqlite3\.node["']/);
    });
  });
});

// ── bun:sqlite adapter (#45) ──────────────────────────────────────────

describe("bun:sqlite adapter (#45)", () => {
  /**
   * Helper: create an in-memory SQLite db that behaves like bun:sqlite.
   * Uses better-sqlite3 as engine but strips/alters methods to match bun:sqlite API:
   * - NO .pragma() method
   * - .get() returns null instead of undefined
   * - .exec() is alias for single-statement .run()
   */
  async function createBunLikeFake(dbPath?: string) {
    const { loadDatabase } = await import("../../src/db-base.js");
    const Database = loadDatabase();
    const real = new Database(dbPath ?? ":memory:");

    const wrapStatement = (stmt: any) => ({
      run: (...args: any[]) => stmt.run(...args),
      get: (...args: any[]) => {
        const r = stmt.get(...args);
        return r === undefined ? null : r; // bun returns null
      },
      all: (...args: any[]) => stmt.all(...args),
      iterate: (...args: any[]) => stmt.iterate(...args),
      columns: () => stmt.columns(),
    });

    return {
      prepare: (sql: string) => wrapStatement(real.prepare(sql)),
      exec: (sql: string) => real.exec(sql),
      transaction: (fn: any) => real.transaction(fn),
      close: () => real.close(),
      // NO .pragma() — bun:sqlite doesn't have it
    };
  }

  test("pragma: adapter.pragma() returns scalar for assignment", async () => {
    const { BunSQLiteAdapter } = await import("../../src/db-base.js");
    const dbFile = join(mkdtempSync(join(tmpdir(), "bun-adapter-")), "test.db");
    const fake = await createBunLikeFake(dbFile);
    const db = new BunSQLiteAdapter(fake);
    const result = db.pragma("journal_mode = WAL");
    expect(result).toBe("wal");
    db.close();
    rmSync(dbFile, { force: true });
  });

  test("pragma: adapter.pragma() returns rows for table_xinfo", async () => {
    const { BunSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createBunLikeFake();
    const db = new BunSQLiteAdapter(fake);
    fake.exec("CREATE TABLE test_tbl (id INTEGER PRIMARY KEY, name TEXT)");
    const rows = db.pragma("table_xinfo(test_tbl)");
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBe("id");
    expect(rows[1].name).toBe("name");
    db.close();
  });

  test("exec: adapter.exec() handles multi-statement SQL", async () => {
    const { BunSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createBunLikeFake();
    const db = new BunSQLiteAdapter(fake);
    db.exec(`
      CREATE TABLE t1 (id INTEGER PRIMARY KEY);
      CREATE TABLE t2 (id INTEGER PRIMARY KEY);
      INSERT INTO t1 VALUES (1);
      INSERT INTO t2 VALUES (2);
    `);
    const r1 = db.prepare("SELECT * FROM t1").all();
    const r2 = db.prepare("SELECT * FROM t2").all();
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
    db.close();
  });

  test("exec: adapter.exec() handles semicolons inside string literals", async () => {
    const { BunSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createBunLikeFake();
    const db = new BunSQLiteAdapter(fake);
    db.exec(`
      CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT);
      INSERT INTO t VALUES (1, 'hello; world');
      INSERT INTO t VALUES (2, 'foo "bar; baz" qux');
    `);
    const rows = db.prepare("SELECT * FROM t ORDER BY id").all() as any[];
    expect(rows).toHaveLength(2);
    expect(rows[0].val).toBe("hello; world");
    expect(rows[1].val).toBe('foo "bar; baz" qux');
    db.close();
  });

  test("get: adapter.prepare().get() returns undefined not null for missing row", async () => {
    const { BunSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createBunLikeFake();
    const db = new BunSQLiteAdapter(fake);
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    const result = db.prepare("SELECT * FROM t WHERE id = 999").get();
    expect(result).toBeUndefined(); // not null
    expect(result).not.toBeNull();
    db.close();
  });

  test("run: adapter.prepare().run() returns {changes, lastInsertRowid}", async () => {
    const { BunSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createBunLikeFake();
    const db = new BunSQLiteAdapter(fake);
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");
    const info = db.prepare("INSERT INTO t (name) VALUES (?)").run("test");
    expect(info.changes).toBe(1);
    expect(info.lastInsertRowid).toBe(1);
    db.close();
  });

  test("transaction: adapter.transaction() works", async () => {
    const { BunSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createBunLikeFake();
    const db = new BunSQLiteAdapter(fake);
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)");
    const insertMany = db.transaction((items: string[]) => {
      for (const item of items) {
        db.prepare("INSERT INTO t (val) VALUES (?)").run(item);
      }
    });
    insertMany(["a", "b", "c"]);
    const rows = db.prepare("SELECT * FROM t").all();
    expect(rows).toHaveLength(3);
    db.close();
  });

  test("loadDatabase: checks globalThis.Bun before choosing driver (#163)", () => {
    // Bun's require("better-sqlite3") returns a non-functional stub.
    // loadDatabase() must check globalThis.Bun FIRST and use bun:sqlite directly.
    const src = readFileSync(resolve(ROOT, "src", "db-base.ts"), "utf-8");
    const loadDbSection = src.slice(src.indexOf("function loadDatabase"), src.indexOf("return _Database"));
    // Must check Bun runtime before loading any driver
    expect(loadDbSection).toContain("globalThis");
    expect(loadDbSection).toContain("Bun");
    // Bun path must use bun:sqlite via BunSQLiteAdapter
    expect(loadDbSection).toContain("BunSQLiteAdapter");
    // Node path uses better-sqlite3
    expect(loadDbSection).toContain("better-sqlite3");
  });

  test("loadDatabase: falls back to BunSQLiteAdapter when better-sqlite3 unavailable", async () => {
    const { BunSQLiteAdapter } = await import("../../src/db-base.js");
    // BunSQLiteAdapter should be a class/constructor
    expect(typeof BunSQLiteAdapter).toBe("function");
    // Verify it provides the full better-sqlite3 interface
    const fake = await createBunLikeFake();
    const db = new BunSQLiteAdapter(fake);
    expect(typeof db.pragma).toBe("function");
    expect(typeof db.exec).toBe("function");
    expect(typeof db.prepare).toBe("function");
    expect(typeof db.transaction).toBe("function");
    expect(typeof db.close).toBe("function");
    db.close();
  });
});

// ── node:sqlite adapter (#228) ──────────────────────────────────────────

describe("node:sqlite adapter (#228)", () => {
  /**
   * Helper: create an in-memory SQLite db that behaves like node:sqlite's DatabaseSync.
   * Uses better-sqlite3 as engine but strips/alters methods to match node:sqlite API:
   * - NO .pragma() method
   * - NO .transaction() method
   * - .exec() supports multi-statement natively (better-sqlite3 already does)
   * - .get() returns undefined (same as better-sqlite3)
   * - .prepare() returns StatementSync-like objects
   */
  async function createNodeSQLiteFake(dbPath?: string) {
    const { loadDatabase } = await import("../../src/db-base.js");
    // Reset cached _Database to get fresh better-sqlite3
    const Database = loadDatabase();
    const real = new Database(dbPath ?? ":memory:");

    return {
      prepare: (sql: string) => {
        const stmt = real.prepare(sql);
        return {
          run: (...args: any[]) => stmt.run(...args),
          get: (...args: any[]) => stmt.get(...args),
          all: (...args: any[]) => stmt.all(...args),
          // node:sqlite doesn't have iterate() — has Symbol.iterator
          [Symbol.iterator]: (...args: any[]) => stmt.iterate(...args),
        };
      },
      exec: (sql: string) => real.exec(sql),
      // NO .pragma() — node:sqlite doesn't have it
      // NO .transaction() — node:sqlite doesn't have it
      close: () => real.close(),
    };
  }

  test("pragma: adapter.pragma() returns scalar for assignment", async () => {
    const { NodeSQLiteAdapter } = await import("../../src/db-base.js");
    const dbFile = join(mkdtempSync(join(tmpdir(), "node-adapter-")), "test.db");
    const fake = await createNodeSQLiteFake(dbFile);
    const db = new NodeSQLiteAdapter(fake);
    const result = db.pragma("journal_mode = WAL");
    expect(result).toBe("wal");
    db.close();
    rmSync(dbFile, { force: true });
  });

  test("pragma: adapter.pragma() returns rows for table_xinfo", async () => {
    const { NodeSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createNodeSQLiteFake();
    const db = new NodeSQLiteAdapter(fake);
    fake.exec("CREATE TABLE test_tbl (id INTEGER PRIMARY KEY, name TEXT)");
    const rows = db.pragma("table_xinfo(test_tbl)");
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBe("id");
    expect(rows[1].name).toBe("name");
    db.close();
  });

  test("exec: adapter.exec() handles multi-statement SQL", async () => {
    const { NodeSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createNodeSQLiteFake();
    const db = new NodeSQLiteAdapter(fake);
    db.exec(`
      CREATE TABLE t1 (id INTEGER PRIMARY KEY);
      CREATE TABLE t2 (id INTEGER PRIMARY KEY);
      INSERT INTO t1 VALUES (1);
      INSERT INTO t2 VALUES (2);
    `);
    const r1 = db.prepare("SELECT * FROM t1").all();
    const r2 = db.prepare("SELECT * FROM t2").all();
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
    db.close();
  });

  test("get: adapter.prepare().get() returns undefined for missing row", async () => {
    const { NodeSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createNodeSQLiteFake();
    const db = new NodeSQLiteAdapter(fake);
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    const result = db.prepare("SELECT * FROM t WHERE id = 999").get();
    expect(result).toBeUndefined();
    db.close();
  });

  test("run: adapter.prepare().run() returns {changes, lastInsertRowid}", async () => {
    const { NodeSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createNodeSQLiteFake();
    const db = new NodeSQLiteAdapter(fake);
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");
    const info = db.prepare("INSERT INTO t (name) VALUES (?)").run("test");
    expect(info.changes).toBe(1);
    expect(info.lastInsertRowid).toBe(1);
    db.close();
  });

  test("transaction: adapter.transaction() commits on success", async () => {
    const { NodeSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createNodeSQLiteFake();
    const db = new NodeSQLiteAdapter(fake);
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)");
    const insertMany = db.transaction((items: string[]) => {
      for (const item of items) {
        db.prepare("INSERT INTO t (val) VALUES (?)").run(item);
      }
    });
    insertMany(["a", "b", "c"]);
    const rows = db.prepare("SELECT * FROM t").all();
    expect(rows).toHaveLength(3);
    db.close();
  });

  test("transaction: adapter.transaction() rolls back on error", async () => {
    const { NodeSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createNodeSQLiteFake();
    const db = new NodeSQLiteAdapter(fake);
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)");
    const failingTx = db.transaction(() => {
      db.prepare("INSERT INTO t (val) VALUES (?)").run("should-rollback");
      throw new Error("intentional");
    });
    expect(() => failingTx()).toThrow("intentional");
    const rows = db.prepare("SELECT * FROM t").all();
    expect(rows).toHaveLength(0); // rolled back
    db.close();
  });

  test("loadDatabase: source uses hasModernSqlite() before choosing node:sqlite (#228, #551)", () => {
    const src = readFileSync(resolve(ROOT, "src", "db-base.ts"), "utf-8");
    const loadDbSection = src.slice(src.indexOf("function loadDatabase"), src.indexOf("return _Database"));
    // #551: gate widened from `process.platform === "linux"` to
    // hasModernSqlite() — Node 26 broke better-sqlite3 native compile on
    // macOS arm64, so we prefer node:sqlite on every platform that has it.
    expect(loadDbSection).toContain("hasModernSqlite()");
    expect(loadDbSection).not.toMatch(/process\.platform\s*===\s*"linux"/);
    // Must reference NodeSQLiteAdapter
    expect(loadDbSection).toContain("NodeSQLiteAdapter");
    // Must still have better-sqlite3 fallback
    expect(loadDbSection).toContain("better-sqlite3");
  });

  test("NodeSQLiteAdapter provides full better-sqlite3 interface", async () => {
    const { NodeSQLiteAdapter } = await import("../../src/db-base.js");
    const fake = await createNodeSQLiteFake();
    const db = new NodeSQLiteAdapter(fake);
    expect(typeof db.pragma).toBe("function");
    expect(typeof db.exec).toBe("function");
    expect(typeof db.prepare).toBe("function");
    expect(typeof db.transaction).toBe("function");
    expect(typeof db.close).toBe("function");
    db.close();
  });
});

// ── Shared dep bootstrap (#172) ──────────────────────────────────────

describe("hooks/ensure-deps.mjs — shared bootstrap", () => {
  it("ensure-deps.mjs exists and exports ensureDeps function", async () => {
    expect(existsSync(resolve(ROOT, "hooks", "ensure-deps.mjs"))).toBe(true);
    const mod = await import("../../hooks/ensure-deps.mjs");
    expect(typeof mod.ensureDeps).toBe("function");
  });

  it("start.mjs uses ensure-deps.mjs for native deps", () => {
    const src = readFileSync(resolve(ROOT, "start.mjs"), "utf-8");
    expect(src).toContain("ensure-deps.mjs");
    // better-sqlite3 should NOT be in start.mjs inline loop (handled by ensure-deps)
    expect(src).not.toMatch(/for.*\[.*"better-sqlite3"/s);
  });
});

// ── Cross-OS compatibility ────────────────────────────────────────────

describe("Cross-OS compatibility", () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
  const src = readFileSync(resolve(ROOT, "src", "cli.ts"), "utf-8");

  it("build script does not shell out to POSIX chmod command", () => {
    // Shell `chmod +x` is not available on Windows cmd.exe
    // Node.js fs.chmodSync is cross-platform and acceptable
    expect(pkg.scripts.build).not.toMatch(/\bchmod\s+\+x\b/);
  });

  it("postinstall script uses node for cross-platform compatibility", () => {
    // POSIX [ -n ... ] && printf || true fails on Windows cmd.exe
    expect(pkg.scripts.postinstall).not.toMatch(/\[ -n/);
    expect(pkg.scripts.postinstall).not.toContain("printf");
    expect(pkg.scripts.postinstall).toMatch(/^node /);
    // postinstall.mjs must be in files array for npm publish
    expect(pkg.files).toContain("scripts/postinstall.mjs");
  });
});

// ── Bin entry: cli.bundle.mjs ─────────────────────────────────────────

describe("Bin entry uses cli.bundle.mjs", () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));

  it("package.json bin points to cli.bundle.mjs, not build/cli.js", () => {
    expect(pkg.bin["context-mode"]).toBe("./cli.bundle.mjs");
  });

  it("package.json exports ./cli points to cli.bundle.mjs", () => {
    expect(pkg.exports["./cli"]).toBe("./cli.bundle.mjs");
  });

  it("server.ts ctx_doctor runs diagnostics in-process (no CLI dependency)", () => {
    const src = readFileSync(resolve(ROOT, "src", "server.ts"), "utf-8");
    const doctorSection = src.slice(src.indexOf("ctx_doctor"), src.indexOf("ctx_upgrade"));
    // Must NOT delegate to CLI — runs server-side
    expect(doctorSection).not.toContain('node "');
    // Must run actual checks
    expect(doctorSection).toContain("PolyglotExecutor");
    expect(doctorSection).toContain("FTS5");
  });

  it("doctor hook script discovery supports flat and nested hook config entries", () => {
    const helperSrc = readFileSync(resolve(ROOT, "src", "util", "hook-config.ts"), "utf-8");
    expect(helperSrc).toContain("export function getCommandsFromHookEntry");
    expect(helperSrc).toContain("(entry as { command?: unknown }).command");
    expect(helperSrc).toContain("Array.isArray(hooks)");
    expect(helperSrc).toContain("getCommandsFromHookEntry(entry)");
    expect(helperSrc).not.toContain("entry.hooks");

    for (const rel of ["src/cli.ts", "src/server.ts"]) {
      const src = readFileSync(resolve(ROOT, rel), "utf-8");
      expect(src).toContain('import { getHookScriptPaths } from "./util/hook-config.js";');
      expect(src).not.toContain("function getCommandsFromHookEntry");
      expect(src).not.toContain("function getHookScriptPaths");
    }
  });

  // ── Algo-D1: doctor consumes adapter.getHealthChecks ──
  //
  // The HookAdapter contract grew an OPTIONAL `getHealthChecks(pluginRoot)`
  // returning HealthCheck[] (src/adapters/types.ts). Doctor must iterate
  // `adapter.getHealthChecks?.(pluginRoot) ?? []` so claude-code's
  // direct-existsSync hook checks are surfaced WITHOUT going back through
  // the regex round-trip that produced the #548 doubled-path FAIL.
  // Adapters that don't override the optional method get nothing — they
  // don't have this class of check today.
  it("cli doctor invokes adapter.getHealthChecks(pluginRoot) (Algo-D1)", () => {
    const src = readFileSync(resolve(ROOT, "src", "cli.ts"), "utf-8");
    const doctorStart = src.indexOf("async function doctor");
    const doctorBody = src.slice(doctorStart, doctorStart + 8000);
    // Wiring: doctor must call the optional method via the safe-call
    // operator so adapters that don't override it are untouched.
    expect(doctorBody).toMatch(/adapter\.getHealthChecks\?\.\(pluginRoot\)/);
    // The result must be iterated and rendered with status branches —
    // not silently dropped. Match the same `result.status === "OK"`
    // shape the HealthCheck contract uses.
    expect(doctorBody).toContain('result.status === "OK"');
  });

  it("cli doctor renders hook warnings as WARN instead of FAIL", () => {
    const src = readFileSync(resolve(ROOT, "src", "cli.ts"), "utf-8");
    const loopStart = src.indexOf("for (const result of hookResults)");
    const loopEnd = src.indexOf("// Hook scripts exist", loopStart);
    const loop = src.slice(loopStart, loopEnd);

    expect(loop).toContain('result.status === "warn"');
    expect(loop).toContain("p.log.warn");
    expect(loop).toContain(": WARN");
  });

  it("server.ts registers empty prompts/resources handlers to avoid -32601 (#168)", () => {
    const src = readFileSync(resolve(ROOT, "src", "server.ts"), "utf-8");
    // Must register prompts capability so clients don't get Method not found
    expect(src).toContain("ListPromptsRequestSchema");
    // Must register resources capability
    expect(src).toContain("ListResourcesRequestSchema");
    // Must return empty arrays
    expect(src).toContain("prompts: []");
    expect(src).toContain("resources: []");
  });
});

// ── session-loaders.mjs fallback ──────────────────────────────────────

describe("session-loaders.mjs fallback to build/session/*.js", () => {
  test("session-loaders.mjs has loadModule fallback function", () => {
    const src = readFileSync(resolve(ROOT, "hooks", "session-loaders.mjs"), "utf-8");
    // Must have a loadModule helper that checks existsSync
    expect(src).toContain("loadModule");
    expect(src).toContain("existsSync");
  });

  test("session-loaders.mjs falls back to build/session/*.js paths", () => {
    const src = readFileSync(resolve(ROOT, "hooks", "session-loaders.mjs"), "utf-8");
    // Must reference the build/session fallback directory
    expect(src).toContain("build");
    expect(src).toContain("session");
    // Must reference specific build fallback filenames
    expect(src).toContain("db.js");
    expect(src).toContain("extract.js");
    expect(src).toContain("snapshot.js");
  });

  test("session-loaders.mjs still tries bundles first", () => {
    const src = readFileSync(resolve(ROOT, "hooks", "session-loaders.mjs"), "utf-8");
    // Bundle names must still be present
    expect(src).toContain("session-db.bundle.mjs");
    expect(src).toContain("session-extract.bundle.mjs");
    expect(src).toContain("session-snapshot.bundle.mjs");
  });

  test("session-loaders.mjs imports existsSync", () => {
    const src = readFileSync(resolve(ROOT, "hooks", "session-loaders.mjs"), "utf-8");
    expect(src).toMatch(/import\s*\{[^}]*existsSync[^}]*\}\s*from\s*["']node:fs["']/);
  });
});

// ── SKILL.md MCP-first pattern ────────────────────────────────────────

describe("SKILL.md prefers MCP tool over Bash", () => {
  it("ctx-doctor SKILL.md prefers MCP tool over Bash", () => {
    const skill = readFileSync(resolve(ROOT, "skills", "ctx-doctor", "SKILL.md"), "utf-8");
    // Must mention the MCP tool
    expect(skill).toContain("ctx_doctor");
    expect(skill).toContain("MCP tool");
    // MCP tool instruction must appear BEFORE the Bash fallback
    const mcpIdx = skill.indexOf("ctx_doctor");
    const fallbackIdx = skill.indexOf("Fallback");
    expect(mcpIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeGreaterThan(-1);
    expect(mcpIdx).toBeLessThan(fallbackIdx);
  });

  it("ctx-upgrade SKILL.md prefers MCP tool over Bash", () => {
    const skill = readFileSync(resolve(ROOT, "skills", "ctx-upgrade", "SKILL.md"), "utf-8");
    // Must mention the MCP tool
    expect(skill).toContain("ctx_upgrade");
    expect(skill).toContain("MCP tool");
    // MCP tool instruction must appear BEFORE the Bash fallback
    const mcpIdx = skill.indexOf("ctx_upgrade");
    const fallbackIdx = skill.indexOf("Fallback");
    expect(mcpIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeGreaterThan(-1);
    expect(mcpIdx).toBeLessThan(fallbackIdx);
  });
});

// ── Issue #181: upgrade must not delete sibling version dirs mid-session ──

describe("Cache dir safety (#181)", () => {
  const CLI_SOURCE = readFileSync(resolve(ROOT, "src/cli.ts"), "utf-8");
  const PRETOOLUSE_SOURCE = readFileSync(resolve(ROOT, "hooks/codex/pretooluse.mjs"), "utf-8");

  test("cli.ts upgrade does not rmSync sibling cache version dirs", () => {
    // The upgrade function must NOT contain a loop that deletes sibling version dirs.
    // Old pattern: filter dirs !== myDir → rmSync each in a loop
    const hasStaleCleanup = CLI_SOURCE.includes("stale cache dir");
    expect(hasStaleCleanup).toBe(false);
  });

  test("pretooluse.mjs does not nuke stale version dirs", () => {
    // Step 4 "Nuke stale version dirs" must not exist
    const hasNukeBlock = PRETOOLUSE_SOURCE.includes("Nuke stale version dirs");
    expect(hasNukeBlock).toBe(false);
  });
});

// ── PR #190 fix: getRuntimeSummary handles full bun path ──

describe("Runtime summary bun detection (#190)", () => {
  const RT_SOURCE = readFileSync(resolve(ROOT, "src", "runtime.ts"), "utf-8");

  test("getRuntimeSummary does not use exact === bun comparison", () => {
    // Full path like /home/user/.bun/bin/bun must be detected
    const summaryStart = RT_SOURCE.indexOf("getRuntimeSummary");
    const summaryBody = RT_SOURCE.slice(summaryStart, RT_SOURCE.indexOf("\nexport", summaryStart + 10));
    expect(summaryBody).not.toContain('=== "bun"');
  });
});

// ── Issue #225: Codex CLI hook dispatch ──────────────────────────────────

describe("Codex CLI hook dispatch (#225)", () => {
  const CLI_SOURCE = readFileSync(resolve(ROOT, "src", "cli.ts"), "utf-8");

  test("HOOK_MAP includes codex platform", () => {
    // Extract HOOK_MAP definition
    const mapStart = CLI_SOURCE.indexOf("const HOOK_MAP");
    const mapEnd = CLI_SOURCE.indexOf("};", mapStart) + 2;
    const hookMap = CLI_SOURCE.slice(mapStart, mapEnd);
    expect(hookMap).toContain('codex:');
  });

  test("codex HOOK_MAP has all Codex hook dispatches", () => {
    const mapStart = CLI_SOURCE.indexOf("const HOOK_MAP");
    const mapEnd = CLI_SOURCE.indexOf("};", mapStart) + 2;
    const hookMap = CLI_SOURCE.slice(mapStart, mapEnd);
    // Extract codex block
    const codexStart = hookMap.indexOf('codex:');
    const codexEnd = hookMap.indexOf("}", codexStart + 10) + 1;
    const codexBlock = hookMap.slice(codexStart, codexEnd);
    expect(codexBlock).toContain("pretooluse");
    expect(codexBlock).toContain("posttooluse");
    expect(codexBlock).toContain("precompact");
    expect(codexBlock).toContain("sessionstart");
    expect(codexBlock).toContain("userpromptsubmit");
    expect(codexBlock).toContain("stop");
  });

  test("codex hooks point to dedicated hooks/codex/ directory", () => {
    const mapStart = CLI_SOURCE.indexOf("const HOOK_MAP");
    const mapEnd = CLI_SOURCE.indexOf("};", mapStart) + 2;
    const hookMap = CLI_SOURCE.slice(mapStart, mapEnd);
    const codexStart = hookMap.indexOf('codex:');
    const codexEnd = hookMap.indexOf("}", codexStart + 10) + 1;
    const codexBlock = hookMap.slice(codexStart, codexEnd);
    expect(codexBlock).toContain("hooks/codex/pretooluse.mjs");
    expect(codexBlock).toContain("hooks/codex/posttooluse.mjs");
    expect(codexBlock).toContain("hooks/codex/precompact.mjs");
    expect(codexBlock).toContain("hooks/codex/sessionstart.mjs");
    expect(codexBlock).toContain("hooks/codex/userpromptsubmit.mjs");
    expect(codexBlock).toContain("hooks/codex/stop.mjs");
  });

  test("hooks/codex/pretooluse.mjs exists", () => {
    expect(existsSync(resolve(ROOT, "hooks/codex/pretooluse.mjs"))).toBe(true);
  });

  test("hooks/codex/posttooluse.mjs exists", () => {
    expect(existsSync(resolve(ROOT, "hooks/codex/posttooluse.mjs"))).toBe(true);
  });

  test("hooks/codex/sessionstart.mjs exists", () => {
    expect(existsSync(resolve(ROOT, "hooks/codex/sessionstart.mjs"))).toBe(true);
  });

  test("hooks/codex/precompact.mjs exists", () => {
    expect(existsSync(resolve(ROOT, "hooks/codex/precompact.mjs"))).toBe(true);
  });

  test("session-helpers.mjs exports CODEX_OPTS", () => {
    const helpers = readFileSync(resolve(ROOT, "hooks/session-helpers.mjs"), "utf-8");
    expect(helpers).toContain("export const CODEX_OPTS");
  });

  test("CODEX_OPTS uses .codex config dir", () => {
    const helpers = readFileSync(resolve(ROOT, "hooks/session-helpers.mjs"), "utf-8");
    const optsStart = helpers.indexOf("CODEX_OPTS");
    const optsEnd = helpers.indexOf("};", optsStart) + 2;
    const optsBlock = helpers.slice(optsStart, optsEnd);
    expect(optsBlock).toContain('".codex"');
  });

  test("configs/codex/hooks.json commands match HOOK_MAP platform name", () => {
    const hooksJson = JSON.parse(readFileSync(resolve(ROOT, "configs/codex/hooks.json"), "utf-8"));
    for (const [eventType, entries] of Object.entries(hooksJson.hooks)) {
      for (const entry of entries as any[]) {
        for (const hook of entry.hooks) {
          // Command must use "context-mode hook codex <event>"
          expect(hook.command).toMatch(/context-mode hook codex \w+/);
        }
      }
    }
  });

  test("CODEX_OPTS.projectDirEnv is undefined (Codex passes cwd in stdin, not env)", () => {
    const helpers = readFileSync(resolve(ROOT, "hooks/session-helpers.mjs"), "utf-8");
    const optsStart = helpers.indexOf("CODEX_OPTS");
    const optsEnd = helpers.indexOf("};", optsStart) + 2;
    const optsBlock = helpers.slice(optsStart, optsEnd);
    expect(optsBlock).toMatch(/projectDirEnv:\s*undefined/);
  });

  test("codex hooks include hookEventName in output (required by codex-rs)", () => {
    const posttooluse = readFileSync(resolve(ROOT, "hooks/codex/posttooluse.mjs"), "utf-8");
    expect(posttooluse).toContain('hookEventName: "PostToolUse"');

    const sessionstart = readFileSync(resolve(ROOT, "hooks/codex/sessionstart.mjs"), "utf-8");
    expect(sessionstart).toContain('hookEventName: "SessionStart"');
  });

  test("codex pretooluse formatter includes hookEventName in deny response", () => {
    const formatters = readFileSync(resolve(ROOT, "hooks/core/formatters.mjs"), "utf-8");
    const codexStart = formatters.indexOf('"codex"');
    const codexEnd = formatters.indexOf("},", codexStart + 50);
    const codexBlock = formatters.slice(codexStart, codexEnd);
    expect(codexBlock).toContain('hookEventName: "PreToolUse"');
  });
});

// ── better-sqlite3 binding self-heal (#408) ───────────────────────────────
//
// On Windows, `npm rebuild better-sqlite3` falls through to node-gyp when
// prebuild-install is not on cmd.exe PATH, then dies for users without
// MSVC. The fix is a 3-layer heal (spawn prebuild-install via
// process.execPath → `npm install better-sqlite3` → actionable stderr)
// shared between scripts/postinstall.mjs and hooks/ensure-deps.mjs via
// scripts/heal-better-sqlite3.mjs.
//
// Tests in this block cover:
//   - doctor() in src/cli.ts: clearer hint when FTS5 check fails on a
//     bindings-missing pattern.
//   - scripts/postinstall.mjs: calls the shared heal helper after the
//     existing nvm4w junction logic; mklink /J regression guard.
//   - scripts/heal-better-sqlite3.mjs: single source of truth — pins the
//     prebuild-install + npm install + Windows/#408 stderr surface so the
//     dedupe doesn't silently regress.

describe("better-sqlite3 binding self-heal (#408)", () => {
  const CLI_SRC = readFileSync(resolve(ROOT, "src", "cli.ts"), "utf-8");
  const POSTINSTALL_SRC = readFileSync(resolve(ROOT, "scripts", "postinstall.mjs"), "utf-8");
  const HEAL_SRC = readFileSync(resolve(ROOT, "scripts", "heal-better-sqlite3.mjs"), "utf-8");

  // Locate doctor()'s FTS5 / SQLite catch branch — the hint lives here.
  function ftsCatchBlock(): string {
    const ftsAnchor = CLI_SRC.indexOf("Checking FTS5 / SQLite");
    expect(ftsAnchor).toBeGreaterThan(-1);
    const catchIdx = CLI_SRC.indexOf("catch (err", ftsAnchor);
    expect(catchIdx).toBeGreaterThan(-1);
    const versionIdx = CLI_SRC.indexOf("Checking local versions", catchIdx);
    expect(versionIdx).toBeGreaterThan(catchIdx);
    return CLI_SRC.slice(catchIdx, versionIdx);
  }

  // ── doctor(): bindings-missing hint ────────────────────────────────
  describe("doctor: bindings-missing hint", () => {
    it("hint mentions `npm install better-sqlite3` as the primary remedy", () => {
      // On Windows `npm rebuild` falls through to node-gyp without MSVC,
      // while `npm install` re-runs prebuild-install and pulls a prebuilt.
      const block = ftsCatchBlock();
      expect(block).toContain("npm install better-sqlite3");
    });

    it("hint explains the Windows / prebuild-install root cause", () => {
      const block = ftsCatchBlock();
      const mentionsRootCause =
        /prebuild-install/i.test(block) || /Windows/i.test(block);
      expect(mentionsRootCause).toBe(true);
    });

    it("retains `npm rebuild better-sqlite3` as a non-Windows fallback", () => {
      // Existing rebuild hint is still valid on Linux/macOS where the
      // toolchain is present. The fix only augments — does not delete.
      const block = ftsCatchBlock();
      expect(block).toContain("npm rebuild better-sqlite3");
    });

    it("bindings-error detection branches on the bindings error message", () => {
      // Hint must be conditional on the actual bindings failure
      // signature (`Could not locate the bindings file` / `bindings`),
      // otherwise it would spam the install hint for unrelated FTS5 errors.
      const block = ftsCatchBlock();
      const detectsBindingsError =
        /bindings file/i.test(block) || /\bbindings\b/.test(block);
      expect(detectsBindingsError).toBe(true);
    });
  });

  // ── scripts/postinstall.mjs: delegates to shared helper ────────────
  describe("postinstall.mjs", () => {
    it("imports the shared heal helper", () => {
      // After dedupe, the inline 3-layer heal is gone — replaced by an
      // import + call to the shared helper. Match either bare or
      // explicit-extension import path.
      const importsHelper = /from\s+["']\.\/heal-better-sqlite3(?:\.mjs)?["']/.test(POSTINSTALL_SRC);
      expect(importsHelper).toBe(true);
      expect(POSTINSTALL_SRC).toContain("healBetterSqlite3Binding");
    });

    it("calls healBetterSqlite3Binding(pkgRoot) after the nvm4w junction logic", () => {
      // Order matters: the junction fix must run first so the heal can
      // resolve prebuild-install through the correct node_modules path.
      const junctionIdx = POSTINSTALL_SRC.indexOf("mklink /J");
      expect(junctionIdx).toBeGreaterThan(-1);
      const callIdx = POSTINSTALL_SRC.indexOf("healBetterSqlite3Binding(");
      expect(callIdx).toBeGreaterThan(junctionIdx);
    });

    it("existing Windows nvm4w junction logic (mklink /J) remains intact", () => {
      // Regression guard — Slice 3 must not have wiped the unrelated
      // Windows install fix.
      expect(/mklink\s+\/J/.test(POSTINSTALL_SRC)).toBe(true);
    });
  });

  // ── scripts/heal-better-sqlite3.mjs: single source of truth ────────
  describe("heal-better-sqlite3.mjs (shared helper)", () => {
    it("exports healBetterSqlite3Binding", () => {
      expect(/export\s+function\s+healBetterSqlite3Binding\s*\(/.test(HEAL_SRC)).toBe(true);
    });

    it("contains all three heal layers in one place (dedupe guarantee)", () => {
      // Layer A — prebuild-install via process.execPath
      expect(HEAL_SRC).toContain("prebuild-install");
      expect(HEAL_SRC).toContain("process.execPath");
      // Layer B — npm install fallback (NOT npm rebuild)
      expect(/install\s+better-sqlite3/.test(HEAL_SRC)).toBe(true);
      // Layer C — actionable stderr with Windows / #408 context
      const mentionsContext =
        /#408/.test(HEAL_SRC) ||
        (/Windows/i.test(HEAL_SRC) && /better-sqlite3/.test(HEAL_SRC));
      expect(mentionsContext).toBe(true);
      const writesStderr =
        /process\.stderr\.write\s*\(/.test(HEAL_SRC) ||
        /console\.(error|warn)\s*\(/.test(HEAL_SRC);
      expect(writesStderr).toBe(true);
    });

    it("ships in npm package (listed in package.json files array)", () => {
      const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
      expect(pkg.files).toContain("scripts/heal-better-sqlite3.mjs");
    });

    it("never throws — all layers wrapped in try/catch (best-effort posture)", () => {
      // Outer try/catch around the whole function body protects callers
      // (postinstall + ensure-deps) from blocking on a heal failure.
      expect(/function\s+healBetterSqlite3Binding[\s\S]{0,200}?try\s*\{/.test(HEAL_SRC)).toBe(true);
    });
  });
});

// ── Issue #564 — docs sync to hasModernSqlite() source of truth ────────
// README and docs/platform-support.md historically promised "Node 18+"
// (9 spots in README) and "Node >= 22.13" (platform-support), while the
// runtime gate (`hasModernSqlite()` in src/db-base.ts:226-244) uses 22.5.
// Three numbers, three contracts. v1.0.132 collapses them to one — the
// runtime gate is the canonical source.
describe("Issue #564 — docs match hasModernSqlite() source of truth", () => {
  const DB_BASE_SRC = readFileSync(resolve(ROOT, "src", "db-base.ts"), "utf-8");

  it("src/db-base.ts hasModernSqlite() uses the 22.5 floor (sanity / source of truth)", () => {
    // If this fails, the floor moved — the README + docs assertions
    // below need their threshold updated in lockstep. This test pins the
    // contract so the docs assertions can not silently drift.
    expect(DB_BASE_SRC).toContain("export function hasModernSqlite");
    // Inline major/minor compare must reference 22 and 5.
    expect(DB_BASE_SRC).toMatch(/major\s*===\s*22\s*&&\s*minor\s*>=\s*5/);
  });

  it("README.md does NOT promise Node.js 18+ on platforms where Linux is unsafe", () => {
    const readme = readFileSync(resolve(ROOT, "README.md"), "utf-8");
    // The literal string "Node.js 18+" must be gone from prerequisites
    // lines — it's a false promise on Linux.
    const nodeJs18PrereqLines = readme
      .split("\n")
      .filter((l) => /Node\.js\s+18\s*\+/.test(l));
    expect(nodeJs18PrereqLines).toEqual([]);
    // README must positively state the 22.5 (or Bun) floor somewhere.
    expect(readme).toMatch(/22\.5/);
  });

  it("docs/platform-support.md SQLite Backend Selection table uses 22.5, not 22.13", () => {
    const doc = readFileSync(resolve(ROOT, "docs", "platform-support.md"), "utf-8");
    // The literal "22.13" must be gone — it disagrees with hasModernSqlite().
    expect(doc).not.toMatch(/22\.13/);
    // The 22.5 floor must be present.
    expect(doc).toMatch(/22\.5/);
  });
});

// ── Issue #564 — doctor RED FAIL on Linux + Node < 22.5 + no Bun ──────
// Six prior fixes (#228, #331, #461, #540, #551, #556) silently assumed
// Node >= 22.5 on Linux. Reporter #564 hit SIGSEGV on Node 20 because
// engines.node was absent and doctor never flagged the unsafe config.
//
// Architect contract for v1.0.132: doctor MUST emit an explicit RED FAIL
// (not a warn / not a passing note) for the predicate
//   process.platform === "linux" && !hasModernSqlite() && globalThis.Bun === undefined
// linking to issue #564.
//
// Static-analysis assertion (same pattern as cli.test.ts:289, :820, :970):
// runtime spawning would need a fake-Linux fake-Node-20 environment that
// is not portable; asserting the gate exists in source catches the
// regression at PR time and is the precedent used elsewhere in this file.
describe("Issue #564 — doctor() flags Linux + Node < 22.5 + no Bun", () => {
  const CLI_SRC = readFileSync(resolve(ROOT, "src", "cli.ts"), "utf-8");

  function doctorBody(): string {
    const start = CLI_SRC.indexOf("async function doctor(");
    expect(start).toBeGreaterThan(-1);
    // doctor() spans ~300 lines; grab a generous window that ends before
    // the next top-level function declaration (`async function insight`).
    const end = CLI_SRC.indexOf("async function insight", start);
    expect(end).toBeGreaterThan(start);
    return CLI_SRC.slice(start, end);
  }

  it("doctor fails on Linux + Node < 22.5 + no bun (RED FAIL line)", () => {
    const body = doctorBody();
    // The Linux predicate must be in doctor().
    expect(body).toMatch(/process\.platform\s*===\s*["']linux["']/);
    // Must consult the 22.5 gate via hasModernSqlite (the source of truth
    // in src/db-base.ts:226-244) OR an equivalent inline major/minor check.
    const usesHelper = /hasModernSqlite/.test(body);
    const usesInlineGate =
      /process\.versions\.node/.test(body) && /22(?:\.5|[^0-9])/.test(body);
    expect(usesHelper || usesInlineGate).toBe(true);
    // Bun must be allowed through (Linux + Bun is fine).
    expect(body).toMatch(/globalThis\.Bun|hasBunRuntime|process\.versions\.bun/);
    // Must be a RED FAIL (architect mandate) — not a warn/info. Reuses
    // the existing FAIL surface: `p.log.error(color.red(... FAIL ...`.
    // We assert FAIL appears in the new block by matching against an
    // anchor unique to it (issue #564 reference).
    const issueIdx = body.indexOf("#564");
    expect(issueIdx).toBeGreaterThan(-1);
    // Look at a wide window around the #564 anchor — the comment block
    // sits above the predicate and the FAIL emission sits below, so we
    // grab text on both sides.
    const surrounding = body.slice(
      Math.max(0, issueIdx - 1500),
      issueIdx + 2000,
    );
    expect(surrounding).toMatch(/p\.log\.error/);
    expect(surrounding).toMatch(/FAIL/);
    // The block must increment criticalFails so the doctor exits non-zero.
    expect(surrounding).toMatch(/criticalFails\+\+/);
    // Remediation: must point users at 22.5+ (or Bun).
    expect(body).toMatch(/22\.5/);
  });
});
