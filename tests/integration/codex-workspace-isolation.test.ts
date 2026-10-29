import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { hashProjectDirCanonical } from "../../src/session/db.js";

const alpha = "11111111-1111-4111-8111-111111111111";
const beta = "22222222-2222-4222-8222-222222222222";
let root: string;
let repoA: string;
let repoB: string;
let snapshotB: string;
let client: Client;

function text(result: unknown): string {
  const r = result as { content: Array<{ type: string; text?: string }> };
  return r.content.filter(c => c.type === "text").map(c => c.text ?? "").join("\n");
}

async function call(threadId: string, name: string, args: Record<string, unknown>) {
  return client.callTool({
    name, arguments: args,
    _meta: { threadId, sessionId: "33333333-3333-4333-8333-333333333333" },
  });
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "ctx-codex-mcp-isolation-"));
  repoA = join(root, "alpha");
  repoB = join(root, "beta");
  const codexHome = join(root, "codex-home");
  const sessions = join(codexHome, "sessions");
  const snapshots = join(codexHome, "context-mode", "sessions");
  for (const dir of [repoA, repoB, sessions, snapshots]) mkdirSync(dir, { recursive: true });
  mkdirSync(join(repoA, ".claude"));
  writeFileSync(join(repoA, ".claude", "settings.local.json"), JSON.stringify({ permissions: { deny: ["Bash(*CONTEXT_MODE_DENIED*)"] } }));
  for (const [id, repo, marker] of [[alpha, repoA, "ALPHA_PAYLOAD"], [beta, repoB, "BETA_PAYLOAD"]]) {
    writeFileSync(join(repo, "probe.txt"), marker);
    writeFileSync(join(sessions, `${id}.jsonl`), JSON.stringify({ type: "session_meta", payload: { id, cwd: repo } }) + "\n");
    writeFileSync(join(snapshots, `${hashProjectDirCanonical(repo)}-events.md`), `# Workspace continuity\n\nIsolation ${marker}_SNAPSHOT\n`);
  }
  snapshotB = join(snapshots, `${hashProjectDirCanonical(repoB)}-events.md`);
  const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === "string"));
  for (const key of ["CONTEXT_MODE_PROJECT_DIR", "CONTEXT_MODE_DIR", "CONTEXT_MODE_SESSION_SUFFIX", "CLAUDE_PROJECT_DIR", "CLAUDE_SESSION_ID", "CONTEXT_MODE_EMBEDDED_PLUGIN_TOOLS"]) delete env[key];
  env.CODEX_HOME = codexHome;
  env.CONTEXT_MODE_PLATFORM = "codex";
  const transport = new StdioClientTransport({
    command: process.execPath, args: ["--import", "tsx", resolve("src/server.ts")], env, stderr: "pipe",
  });
  client = new Client({ name: "codex-workspace-regression", version: "1.0.0" });
  await client.connect(transport);
}, 30_000);

afterAll(async () => {
  await client?.close();
  if (root) {
    expect(resolve(root).startsWith(resolve(tmpdir()) + sep)).toBe(true);
    rmSync(root, { recursive: true, force: true });
  }
});

describe.sequential("Codex shared MCP server workspace isolation", () => {
  it("executes concurrent calls in the correct repo", async () => {
    const [a, b] = await Promise.all([
      call(alpha, "ctx_execute", { language: "javascript", code: "await new Promise(r=>setTimeout(r,120)); console.log('CWD_RESULT='+process.cwd());" }),
      call(beta, "ctx_execute", { language: "javascript", code: "await new Promise(r=>setTimeout(r,10)); console.log('CWD_RESULT='+process.cwd());" }),
    ]);
    expect(text(a)).toContain(`CWD_RESULT=${repoA}`);
    expect(text(a)).not.toContain(`CWD_RESULT=${repoB}`);
    expect(text(b)).toContain(`CWD_RESULT=${repoB}`);
  });

  it("reads repo-relative files and keeps the cross-repo boundary", async () => {
    const a = await call(alpha, "ctx_execute_file", { path: "probe.txt", language: "javascript", code: "console.log(FILE_CONTENT);" });
    const b = await call(beta, "ctx_execute_file", { path: "probe.txt", language: "javascript", code: "console.log(FILE_CONTENT);" });
    expect(text(a)).toContain("ALPHA_PAYLOAD");
    expect(text(b)).toContain("BETA_PAYLOAD");
    const outside = await call(alpha, "ctx_execute_file", { path: join(repoB, "probe.txt"), language: "javascript", code: "console.log(FILE_CONTENT);" });
    expect(outside.isError).toBe(true);
    expect(text(outside)).toContain("outside the project root");
  });

  it("keeps content stores and continuity snapshots separate", async () => {
    const a = await call(alpha, "ctx_index", { content: "# Isolation fixture\n\nIsolation ALPHA_PAYLOAD_INDEXED", source: "isolation-fixture" });
    expect(a.isError).not.toBe(true);
    expect(existsSync(snapshotB)).toBe(true);
    const b = await call(beta, "ctx_index", { content: "# Isolation fixture\n\nIsolation BETA_PAYLOAD_INDEXED", source: "isolation-fixture" });
    expect(b.isError).not.toBe(true);
    const [aSearch, bSearch] = await Promise.all([
      call(alpha, "ctx_search", { queries: ["Isolation"], source: "isolation-fixture" }),
      call(beta, "ctx_search", { queries: ["Isolation"], source: "isolation-fixture" }),
    ]);
    expect(text(aSearch)).toContain("ALPHA_PAYLOAD_INDEXED");
    expect(text(aSearch)).not.toContain("BETA_PAYLOAD_INDEXED");
    expect(text(bSearch)).toContain("BETA_PAYLOAD_INDEXED");
    expect(text(bSearch)).not.toContain("ALPHA_PAYLOAD_INDEXED");
    const [aResume, bResume] = await Promise.all([
      call(alpha, "ctx_search", { queries: ["Isolation"], source: "session-events" }),
      call(beta, "ctx_search", { queries: ["Isolation"], source: "session-events" }),
    ]);
    expect(text(aResume)).toContain("ALPHA_PAYLOAD_SNAPSHOT");
    expect(text(aResume)).not.toContain("BETA_PAYLOAD_SNAPSHOT");
    expect(text(bResume)).toContain("BETA_PAYLOAD_SNAPSHOT");
    expect(text(bResume)).not.toContain("ALPHA_PAYLOAD_SNAPSHOT");
  });

  it("uses each repo's own deny rules", async () => {
    const code = "require('child_process').execSync('echo CONTEXT_MODE_DENIED'); console.log('COMMAND_RAN');";
    const a = await call(alpha, "ctx_execute", { language: "javascript", code });
    const b = await call(beta, "ctx_execute", { language: "javascript", code });
    expect(a.isError).toBe(true);
    expect(text(a)).toContain("security policy");
    expect(b.isError).not.toBe(true);
    expect(text(b)).toContain("COMMAND_RAN");
  });

  it("fails closed for unknown or missing calling identities", async () => {
    const unknown = await call("99999999-9999-4999-8999-999999999999", "ctx_execute", { language: "javascript", code: "console.log('SHOULD_NOT_RUN');" });
    expect(unknown.isError).toBe(true);
    expect(text(unknown)).toContain("refusing");
    const missing = await client.callTool({ name: "ctx_execute", arguments: { language: "javascript", code: "console.log('SHOULD_NOT_RUN');" } });
    expect(missing.isError).toBe(true);
    expect(text(missing)).toContain("refusing");
  });
});
