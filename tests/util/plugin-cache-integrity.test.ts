import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
// @ts-expect-error explicit build-time packaging helper
import { packagePlugin } from "../../scripts/package-plugin.mjs";
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, {recursive:true,force:true,maxRetries:10,retryDelay:100}); });
describe("immutable plugin startup integrity", () => {
  it.each(["server.bundle.mjs","cli.bundle.mjs","html-transform.bundle.cjs","hooks/session-db.bundle.mjs","hooks/session-extract.bundle.mjs","hooks/session-snapshot.bundle.mjs","hooks/security.bundle.mjs","hooks/codex-usage.bundle.mjs"])("fails before creating state when %s is absent", asset => {
    const root = mkdtempSync(join(tmpdir(), "ctx partial plugin "));
    roots.push(root);
    const plugin = packagePlugin(join(root, "plugin with spaces"));
    rmSync(join(plugin, asset));
    const state = join(root, "runtime");
    const p = spawnSync(process.execPath, [join(plugin, "start.mjs")], {cwd:plugin,env:{...process.env,HOME:root,USERPROFILE:root,CODEX_HOME:join(root,".codex"),CODEX_CONTEXT_MODE_HOME:state},encoding:"utf8",timeout:5000});
    expect(p.status).toBe(1);
    expect(p.stderr).toContain("Incomplete codex-context-mode plugin: missing " + asset);
    expect(p.stderr).toContain("Build/package the plugin before installing it");
    expect(existsSync(state)).toBe(false);
    expect(existsSync(join(plugin, "node_modules"))).toBe(false);
  });
});
