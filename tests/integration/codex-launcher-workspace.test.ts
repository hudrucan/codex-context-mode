import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error explicit build-time packaging helper
import { packagePlugin } from "../../scripts/package-plugin.mjs";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { hashProjectDirCanonical } from "../../src/session/db.js";

const alpha = "11111111-1111-4111-8111-111111111111";
const beta = "22222222-2222-4222-8222-222222222222";
const unknown = "99999999-9999-4999-8999-999999999999";
const clients: Client[] = [];
const clientPaths = new Map<Client, { codexHome: string; claudeConfigDir: string; stderr: () => string }>();
let root: string;
let pluginDir: string;
let repoA: string;
let repoB: string;

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "ctx-codex-launcher-")));
  pluginDir = join(root, ".codex", "plugins", "cache", "codex-context-mode", "codex-context-mode", "1.0.169");
  repoA = join(root, "alpha");
  repoB = join(root, "beta");
  for (const dir of [repoA, repoB]) mkdirSync(dir, { recursive: true });
  packagePlugin(pluginDir);
}, 30_000);

afterAll(async () => {
  await Promise.all(clients.map(client => client.close()));
  if (root) {
    expect(resolve(root).startsWith(realpathSync(tmpdir()) + sep)).toBe(true);
    rmSync(root, { recursive: true, force: true });
  }
});

async function launch(
  overrides: Record<string, string> = {},
  options: { clientName?: string; platform?: string | null } = {},
) {
  const home = mkdtempSync(join(root, "home-"));
  const codexHome = join(home, "custom-codex-home");
  const sessions = join(codexHome, "sessions");
  mkdirSync(sessions, { recursive: true });
  for (const [id, cwd] of [[alpha, repoA], [beta, repoB]]) {
    writeFileSync(join(sessions, `${id}.jsonl`), JSON.stringify({ type: "session_meta", payload: { id, cwd } }) + "\n");
  }
  const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === "string"));
  for (const key of ["CODEX_CONTEXT_MODE_HOME", "CONTEXT_MODE_PLATFORM", "CONTEXT_MODE_PROJECT_DIR", "CONTEXT_MODE_PROJECT_DIR_SOURCE", "CONTEXT_MODE_DIR", "CONTEXT_MODE_DATA_DIR", "CONTEXT_MODE_SESSION_DIR", "CONTEXT_MODE_SESSION_SUFFIX", "CONTEXT_MODE_EMBEDDED_PLUGIN_TOOLS"]) delete env[key];
  Object.assign(env, {
    HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: join(home, ".claude"),
    CODEX_HOME: codexHome, VITEST: "true",
  }, options.platform === null ? {} : { CONTEXT_MODE_PLATFORM: options.platform ?? "codex" }, overrides);
  const networkGuard = join(home, "no-upstream.cjs");
  writeFileSync(networkGuard, `
    const blocked = () => { console.error('UNEXPECTED_UPSTREAM_CALL'); throw new Error('UNEXPECTED_UPSTREAM_CALL'); };
    require('node:https').request = blocked;
    require('node:https').get = blocked;
    globalThis.fetch = blocked;
    require('node:module').syncBuiltinESMExports();
  `);
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --require "${networkGuard.replace(/\\/g, "/")}"`;
  const transport = new StdioClientTransport({
    command: process.execPath, args: [join(pluginDir, "start.mjs")],
    cwd: repoB, env, stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", chunk => { stderr += chunk.toString(); });
  const client = new Client({ name: options.clientName ?? "codex-launcher-regression", version: "1.0.0" });
  clients.push(client);
  clientPaths.set(client, { codexHome, claudeConfigDir: env.CLAUDE_CONFIG_DIR, stderr: () => stderr });
  try {
    await client.connect(transport);
  } catch (cause) {
    throw new Error(`Production launcher failed: ${stderr}`, { cause });
  }
  return client;
}

async function probe(client: Client, threadId?: unknown) {
  const result = await client.callTool({
    name: "ctx_execute", arguments: { language: "javascript", code: "console.log('CWD_RESULT='+process.cwd());" },
    ...(threadId === undefined ? {} : { _meta: { threadId } }),
  });
  return {
    isError: result.isError,
    text: (result.content as Array<{ type: string; text?: string }>).filter(c => c.type === "text").map(c => c.text ?? "").join("\n"),
  };
}

describe("Codex workspace routing through production start.mjs", () => {
  it("enforces project Codex and legacy denies without leaking policies across threads", async () => {
    const codexPolicy = join(repoA, ".codex", "settings.json");
    const legacyPolicy = join(repoA, ".claude", "settings.json");
    mkdirSync(dirname(codexPolicy), { recursive: true });
    mkdirSync(dirname(legacyPolicy), { recursive: true });
    writeFileSync(codexPolicy, JSON.stringify({ permissions: {
      deny: ["Read(policy-secret.js)"], allow: ["Read(legacy-secret.js)"],
    } }));
    const legacyBytes = JSON.stringify({ permissions: {
      deny: ["Read(legacy-secret.js)"], allow: ["Read(policy-secret.js)"],
    } });
    writeFileSync(legacyPolicy, legacyBytes);
    for (const workspace of [repoA, repoB]) {
      for (const file of ["policy-secret.js", "legacy-secret.js"]) {
        writeFileSync(join(workspace, file), "console.log('POLICY_FILE_EXECUTED');\n");
      }
    }
    try {
      const client = await launch({}, { clientName: "codex-mcp-client", platform: null });
      for (const file of ["policy-secret.js", "legacy-secret.js"]) {
        const denied = await client.callTool({ name: "ctx_execute_file", _meta: { threadId: alpha },
          arguments: { language: "javascript", path: file, code: "console.log(FILE_CONTENT);" } });
        expect(denied.isError).toBe(true);
        expect(JSON.stringify(denied.content)).not.toContain("POLICY_FILE_EXECUTED");
        const allowed = await client.callTool({ name: "ctx_execute_file", _meta: { threadId: beta },
          arguments: { language: "javascript", path: file, code: "console.log(FILE_CONTENT);" } });
        expect(allowed.isError, JSON.stringify(allowed.content)).not.toBe(true);
        expect(JSON.stringify(allowed.content)).toContain("POLICY_FILE_EXECUTED");
      }
      expect(readFileSync(legacyPolicy, "utf8")).toBe(legacyBytes);
    } finally {
      rmSync(codexPolicy);
      rmSync(legacyPolicy);
      for (const workspace of [repoA, repoB]) {
        for (const file of ["policy-secret.js", "legacy-secret.js"]) rmSync(join(workspace, file));
      }
    }
  });

  it.each(["CONTEXT_MODE_DIR", "CODEX_CONTEXT_MODE_HOME"])("preserves %s across restart and concurrent repositories", async (key) => {
    const storage = mkdtempSync(join(root, "storage-"));
    const overrides = { [key]: storage };
    const first = await launch(overrides, { platform: null });
    const expectedContent = key === "CODEX_CONTEXT_MODE_HOME"
      ? join(storage, "data", "content") : join(storage, "content");
    for (const [threadId, repo, marker] of [[alpha, repoA, "ALPHA"], [beta, repoB, "BETA"]]) {
      const result = await first.callTool({ name: "ctx_index", _meta: { threadId }, arguments: { content: "StorageIsolation " + marker, source: "storage-fixture" } });
      expect(result.isError).not.toBe(true);
      const db = join(expectedContent, hashProjectDirCanonical(repo) + ".db");
      expect(readFileSync(db).subarray(0, 16).toString()).toBe("SQLite format 3\0");
    }
    expect(existsSync(join(clientPaths.get(first)!.codexHome, "context-mode", "content"))).toBe(false);
    await first.close();
    const resumed = await launch(overrides, { platform: null });
    const results = await Promise.all([alpha, beta].map(threadId => resumed.callTool({ name: "ctx_search", _meta: { threadId }, arguments: { queries: ["StorageIsolation"], source: "storage-fixture" } })));
    for (let i = 0; i < results.length; i++) {
      expect(results[i].isError).not.toBe(true);
      const output = (results[i].content as Array<{ text?: string }>).map(c => c.text ?? "").join("\n");
      expect(output).toContain(i === 0 ? "ALPHA" : "BETA");
      expect(output).not.toContain(i === 0 ? "BETA" : "ALPHA");
    }
  });

  it("does not generate an upstream upgrade command through MCP", async () => {
    const client = await launch({}, { clientName: "codex-mcp-client", platform: null });
    expect((await client.listTools()).tools.map(t => t.name)).not.toContain("ctx_upgrade");
  });

  it.each(["Codex", "codex-mcp-client"])("routes %s threads without a platform override", async (clientName) => {
    const client = await launch({}, { clientName, platform: null });
    const [a, b] = await Promise.all([probe(client, alpha), probe(client, beta)]);
    expect(a.isError).not.toBe(true);
    expect(b.isError).not.toBe(true);
    expect(a.text).toContain(`CWD_RESULT=${repoA}`);
    expect(b.text).toContain(`CWD_RESULT=${repoB}`);
  });

  it("fails closed for missing and unknown Codex threads without a platform override", async () => {
    const client = await launch({}, { clientName: "codex-mcp-client", platform: null });
    for (const threadId of [undefined, unknown]) {
      const result = await probe(client, threadId);
      expect(result.isError).toBe(true);
      expect(result.text).toContain("refusing");
    }
  });

  it("keeps Codex SQLite content and continuity under CODEX_HOME without a platform override", async () => {
    const client = await launch({}, { clientName: "codex-mcp-client", platform: null });
    const { codexHome, claudeConfigDir } = clientPaths.get(client)!;
    const codexSessions = join(dirname(codexHome), ".codex-context-mode", "data", "sessions");
    const claudeSessions = join(claudeConfigDir, "context-mode", "sessions");
    for (const dir of [codexSessions, claudeSessions]) mkdirSync(dir, { recursive: true });
    for (const [repo, marker] of [[repoA, "ALPHA"], [repoB, "BETA"]]) {
      const snapshot = `${hashProjectDirCanonical(repo)}-events.md`;
      writeFileSync(join(codexSessions, snapshot), `# Platform continuity\n\nPlatformIsolation CODEX_${marker}_CONTINUITY\n`);
      writeFileSync(join(claudeSessions, snapshot), `# Platform continuity\n\nPlatformIsolation CLAUDE_${marker}_DECOY\n`);
    }
    for (const [threadId, repo, marker, other] of [[alpha, repoA, "ALPHA", "BETA"], [beta, repoB, "BETA", "ALPHA"]]) {
      const index = await client.callTool({
        name: "ctx_index", _meta: { threadId },
        arguments: { content: `# Platform fixture\n\nPlatformIsolation CODEX_${marker}_INDEXED`, source: "platform-fixture" },
      });
      expect(index.isError).not.toBe(true);
      const contentDb = join(dirname(codexHome), ".codex-context-mode", "data", "content", `${hashProjectDirCanonical(repo)}.db`);
      expect(existsSync(contentDb)).toBe(true);
      expect(readFileSync(contentDb).subarray(0, 16).toString()).toBe("SQLite format 3\0");
      for (const [source, expected] of [["platform-fixture", `CODEX_${marker}_INDEXED`], ["session-events", `CODEX_${marker}_CONTINUITY`]]) {
        const result = await client.callTool({ name: "ctx_search", _meta: { threadId }, arguments: { queries: ["PlatformIsolation"], source } });
        expect(result.isError).not.toBe(true);
        const output = (result.content as Array<{ text?: string }>).map(c => c.text ?? "").join("\n");
        expect(output).toContain(expected);
        expect(output).not.toContain(`CODEX_${other}`);
        expect(output).not.toContain("CLAUDE_");
      }
      const snapshot = `${hashProjectDirCanonical(repo)}-events.md`;
      expect(existsSync(join(codexSessions, snapshot))).toBe(false);
      expect(existsSync(join(claudeSessions, snapshot))).toBe(true);
    }
    expect(existsSync(join(claudeConfigDir, "context-mode", "content"))).toBe(false);
    expect(readdirSync(claudeSessions).some(name => /\.db(?:-wal|-shm)?$/.test(name))).toBe(false);
  });

  it("routes unknown MCP clients through Codex thread identity", async () => {
    const result = await probe(await launch({}, { platform: null }), alpha);
    expect(result.isError).not.toBe(true);
    expect(result.text).toContain(`CWD_RESULT=${repoA}`);
  });

  it.each(["claude-code", "gemini-cli-mcp-client"])("uses only CODEX_HOME even for %s client identity", async (clientName) => {
    const client = await launch({}, { clientName, platform: null });
    const { codexHome, claudeConfigDir } = clientPaths.get(client)!;
    expect((await probe(client)).isError).toBe(true);
    const index = await client.callTool({ name: "ctx_index", _meta: { threadId: alpha }, arguments: { content: "CodexOnly platform fixture", source: "codex-only" } });
    expect(index.isError).not.toBe(true);
    const contentDb = join(dirname(codexHome), ".codex-context-mode", "data", "content", `${hashProjectDirCanonical(repoA)}.db`);
    expect(readFileSync(contentDb).subarray(0, 16).toString()).toBe("SQLite format 3\0");
    expect(existsSync(join(claudeConfigDir, "context-mode", "content"))).toBe(false);
    expect(existsSync(join(dirname(claudeConfigDir), ".gemini", "context-mode", "content"))).toBe(false);
  });

  it("ignores conflicting host identity and platform overrides", async () => {
    const client = await launch({}, { clientName: "claude-code", platform: "gemini-cli" });
    const result = await probe(client, alpha);
    expect(result.isError).not.toBe(true);
    expect(result.text).toContain(`CWD_RESULT=${repoA}`);
  });

  it("does not treat tool metadata as verified MCP client identity", async () => {
    const client = await launch({}, { platform: null });
    const result = await client.callTool({
      name: "ctx_execute", arguments: { language: "javascript", code: "console.log('CWD_RESULT='+process.cwd());" },
      _meta: { threadId: alpha, clientInfo: { name: "codex-mcp-client", version: "1.0.0" } },
    });
    expect(result.isError).not.toBe(true);
    const output = (result.content as Array<{ text?: string }>).map(c => c.text ?? "").join("\n");
    expect(output).toContain(`CWD_RESULT=${repoA}`);
  });

  it("rejects a missing identity instead of trusting the launcher's inferred CWD", async () => {
    const result = await probe(await launch());
    expect(result.isError).toBe(true);
    expect(result.text).toContain("refusing");
    expect(result.text).not.toContain("CWD_RESULT=");
  });

  it("rejects an unknown thread instead of falling back to inferred CWD or another transcript", async () => {
    const result = await probe(await launch(), unknown);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("refusing");
    expect(result.text).not.toContain("CWD_RESULT=");
  });

  it("isolates concurrent known threads despite a different launcher CWD", async () => {
    const client = await launch();
    const [a, b] = await Promise.all([probe(client, alpha), probe(client, beta)]);
    expect(a.isError).not.toBe(true);
    expect(b.isError).not.toBe(true);
    expect(a.text).toContain(`CWD_RESULT=${repoA}`);
    expect(b.text).toContain(`CWD_RESULT=${repoB}`);
  });

  it("honors an explicit workspace without a thread identity", async () => {
    const result = await probe(await launch({ CONTEXT_MODE_PROJECT_DIR: repoA }));
    expect(result.isError).not.toBe(true);
    expect(result.text).toContain(`CWD_RESULT=${repoA}`);
  });

  it("honors an explicit workspace when the calling thread has no transcript yet", async () => {
    const result = await probe(await launch({ CONTEXT_MODE_PROJECT_DIR: repoA }), unknown);
    expect(result.isError).not.toBe(true);
    expect(result.text).toContain(`CWD_RESULT=${repoA}`);
  });

  it("keeps known thread routing ahead of a different explicit root", async () => {
    const result = await probe(await launch({ CONTEXT_MODE_PROJECT_DIR: repoB }), alpha);
    expect(result.isError).not.toBe(true);
    expect(result.text).toContain(`CWD_RESULT=${repoA}`);
  });

  it("preserves inferred provenance when launcher environment is inherited on re-exec", async () => {
    const client = await launch({ CONTEXT_MODE_PROJECT_DIR: repoA, CONTEXT_MODE_PROJECT_DIR_SOURCE: "cwd" });
    expect((await probe(client)).isError).toBe(true);
    expect((await probe(client, unknown)).isError).toBe(true);
    expect((await probe(client, alpha)).text).toContain(`CWD_RESULT=${repoA}`);
  });

  it.each([".", "plugin"])("rejects an untrusted %s workspace without a transcript", async (workspace) => {
    const client = await launch({ CONTEXT_MODE_PROJECT_DIR: workspace === "plugin" ? pluginDir : workspace });
    expect((await probe(client)).isError).toBe(true);
    expect((await probe(client, unknown)).isError).toBe(true);
  });

  it("rejects malformed thread metadata even when an explicit workspace is configured", async () => {
    const result = await probe(await launch({ CONTEXT_MODE_PROJECT_DIR: repoA }), "../outside");
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Invalid Codex thread identity");
  });
});
