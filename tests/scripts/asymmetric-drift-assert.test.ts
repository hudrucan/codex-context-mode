import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const roots: string[] = [];
afterEach(() => { for (const p of roots.splice(0)) rmSync(p, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ctx-codex-manifest-")); roots.push(root);
  for (const rel of [".codex-plugin", ".agents/plugins"]) cpSync(resolve(rel), join(root, rel), { recursive: true });
  cpSync(resolve("hooks/codex"), join(root, "hooks/codex"), { recursive: true });
  mkdirSync(join(root, "skills"));
  for (const rel of ["start.mjs", "server.bundle.mjs", "cli.bundle.mjs"]) writeFileSync(join(root, rel), "");
  return root;
}
function run(root: string) { return spawnSync(process.execPath, [resolve("scripts/assert-asymmetric-drift.mjs"), "--root", root], { encoding: "utf8" }); }
describe("Codex manifest integrity gate", () => {
  it("accepts the supported launcher, marketplace and hook layout", () => { expect(run(fixture()).status).toBe(0); });
  it.each(["start.mjs", "server.bundle.mjs", "cli.bundle.mjs", "skills", "hooks/codex/pretooluse.mjs", ".agents/plugins/marketplace.json"])("fails closed when %s is missing", rel => {
    const root = fixture(); rmSync(join(root, rel), { recursive: true });
    const result = run(root); expect(result.status).toBe(1); expect(result.stderr).toContain("FAIL");
  });
  it.each(["command", "cwd", "args"])("rejects launcher %s drift", field => {
    const root = fixture(), p = join(root, ".codex-plugin/mcp.json");
    const data = JSON.parse(readFileSync(p, "utf8")); data.mcpServers["context-mode"][field] = field === "args" ? ["./missing.mjs"] : "wrong";
    writeFileSync(p, JSON.stringify(data)); expect(run(root).status).toBe(1);
  });
});
