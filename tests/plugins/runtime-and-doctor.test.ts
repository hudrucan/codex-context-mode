import { afterEach, describe, expect, it, vi } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CodexAdapter } from "../../src/adapters/codex/index.js";
import { assertMutablePath, runtimePaths } from "../../src/runtime-paths.js";
import { ensureWritableStorageDir, resolveDefaultSessionDir } from "../../src/session/db.js";
const roots: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const p of roots.splice(0)) rmSync(p, { recursive: true, force: true }); });
function host(extra = "") {
  const root = mkdtempSync(join(tmpdir(), "ctx-doctor-")); roots.push(root);
  const ch = join(root, ".codex"); mkdirSync(ch); vi.stubEnv("CODEX_HOME", ch);
  writeFileSync(join(ch, "config.toml"), '[plugins."codex-context-mode@local"]\nenabled = true\n' + extra);
  return { root, ch, adapter: new CodexAdapter() };
}
describe("clean runtime paths", () => {
  it("is beside Codex home, independent of CODEX_HOME or old storage hints", () => {
    const home = resolve("test home with spaces");
    const p = runtimePaths({ CODEX_HOME: "other", CONTEXT_MODE_DATA_DIR: "old", CONTEXT_MODE_SESSION_DIR: "old" }, home);
    expect(p.root).toBe(join(home, ".codex-context-mode"));
    expect(p.sessions).toBe(join(p.root, "data/sessions"));
    expect(p.stats).toBe(join(p.root, "data/stats"));
    expect(p.temporary).toBe(join(p.root, "cache/tmp"));
    expect(() => runtimePaths({ CODEX_CONTEXT_MODE_HOME: "relative" }, home)).toThrow("absolute");
  });
  it("refuses mutable state inside the source/plugin assets", () => {
    const path = resolve("data");
    expect(() => assertMutablePath(path)).toThrow("code installation");
    expect(() => assertMutablePath(resolve("..cache"))).toThrow("code installation");
    expect(() => ensureWritableStorageDir({kind:"session",path,source:"default",envVar:null})).toThrow("code installation");
  });
  it("refuses junction/symlink aliases into code assets", () => {
    const f = host(), link = join(f.root, "source alias");
    symlinkSync(resolve(), link, process.platform === "win32" ? "junction" : "dir");
    expect(() => assertMutablePath(join(link, "future/cache"))).toThrow("code installation");
  });
});
describe("read-only plugin diagnostics", () => {
  it("accepts one plugin and ignores unrelated hooks/plugins", () => {
    const f = host('\n[plugins."codex-lazier@local"]\nenabled = true\n[[hooks.Stop]]\ncommand = "node unrelated-hook.mjs"\n');
    expect(f.adapter.validateHooks(resolve()).filter(c => c.status === "fail")).toEqual([]);
    expect(() => f.adapter.configureAllHooks()).toThrow("plugin management");
  });
  it.each(['\n[mcp_servers.context-mode]\ncommand="node"\n', '\n[mcp_servers.codex-context-mode]\ncommand="node"\n', '\n[plugins."context-mode@upstream"]\nenabled=false\n', '\n[plugins."codex-context-mode@duplicate"]\nenabled=true\n'])("detects duplicate/stale registration: %s", extra => {
    expect(host(extra).adapter.checkPluginRegistration().status).toBe("fail");
  });
  it("detects only Context Mode standalone hooks, skills and upstream caches", () => {
    const f = host('\n[[hooks.Stop]]\ncommand = "node /old/context-mode/hooks/codex/stop.mjs"\n');
    mkdirSync(join(f.ch, "skills/ctx-doctor"), {recursive:true});
    mkdirSync(join(f.ch, "plugins/cache/context-mode"), {recursive:true});
    writeFileSync(join(f.ch, "hooks.json"), JSON.stringify({hooks:{Stop:[{hooks:[{command:"node /old/context-mode/stop.mjs"}]}]}}));
    const failures = f.adapter.validateHooks(resolve()).filter(c => c.status === "fail").map(c => c.check);
    expect(failures).toEqual(expect.arrayContaining(["Native user-hook duplicates", "Standalone user hooks", "Standalone skills", "Stale upstream installation"]));
  });
  it("detects upstream caches inside another marketplace", () => {
    const f = host();
    mkdirSync(join(f.ch, "plugins/cache/other-market/context-mode/1.0"), {recursive:true});
    expect(f.adapter.validateHooks(resolve()).find(c => c.check === "Stale upstream installation")?.status).toBe("fail");
  });
  it("detects quoted and normalized legacy MCP aliases", () => {
    expect(host("\n[mcp_servers.'context_mode']\ncommand=\"node\"\n").adapter.checkPluginRegistration().status).toBe("fail");
    expect(host("\n[ mcp_servers.codex_context_mode ]\ncommand=\"node\"\n").adapter.checkPluginRegistration().status).toBe("fail");
  });
});
