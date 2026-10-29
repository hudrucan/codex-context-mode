import { describe, it, expect } from "vitest";
import { isPluginInstallPath, resolveProjectDir } from "../../src/util/project-dir.js";
describe("isPluginInstallPath", () => {
  it("matches macOS / Linux plugin cache paths", () => {
    expect(isPluginInstallPath("/Users/x/.claude/plugins/cache/context-mode/context-mode/1.0.112")).toBe(true);
    expect(isPluginInstallPath("/home/x/.claude/plugins/cache/foo/foo/1.0.0")).toBe(true);
    expect(isPluginInstallPath("/Users/x/.codex/plugins/cache/context-mode/context-mode/1.0.151")).toBe(true);
    expect(isPluginInstallPath("/home/x/.codex/plugins/cache/foo/foo/1.0.0")).toBe(true);
  });

  it("matches plugin marketplace paths", () => {
    expect(isPluginInstallPath("/Users/x/.claude/plugins/marketplaces/context-mode")).toBe(true);
    expect(isPluginInstallPath("/Users/x/.codex/plugins/marketplaces/context-mode")).toBe(true);
  });

  it("matches Windows plugin cache paths (backslash + drive letter)", () => {
    expect(isPluginInstallPath("C:\\Users\\x\\.claude\\plugins\\cache\\foo\\foo\\1.0.0")).toBe(true);
    expect(isPluginInstallPath("C:\\Users\\x\\.codex\\plugins\\cache\\foo\\foo\\1.0.0")).toBe(true);
  });

  it("returns false for ordinary project paths", () => {
    expect(isPluginInstallPath("/Users/x/Server/proj")).toBe(false);
    expect(isPluginInstallPath("/home/x/work/proj")).toBe(false);
    expect(isPluginInstallPath("C:\\Users\\x\\proj")).toBe(false);
  });

  it("returns false for unrelated .claude subpaths (e.g. session storage)", () => {
    // This path is under .claude but NOT under .claude/plugins/* — must not match.
    expect(isPluginInstallPath("/Users/x/.claude/projects/-Users-x-proj")).toBe(false);
    expect(isPluginInstallPath("/Users/x/.claude/context-mode/sessions/abc.db")).toBe(false);
  });

  it("returns false for empty / null-ish inputs", () => {
    expect(isPluginInstallPath("")).toBe(false);
    expect(isPluginInstallPath("/")).toBe(false);
  });
});
describe("Codex startup workspace fallback", () => {
  const base = { cwd: "/fallback", pwd: undefined, codexHome: "/missing-codex-home" };
  it("prefers an explicit workspace pin", () => {
    expect(resolveProjectDir({ ...base, env: { CONTEXT_MODE_PROJECT_DIR: "/pinned" } })).toBe("/pinned");
  });
  it("rejects plugin pins and uses shell PWD", () => {
    expect(resolveProjectDir({ ...base, pwd: "/real", env: { CONTEXT_MODE_PROJECT_DIR: "/x/.codex/plugins/cache/p/p/1/" } })).toBe("/real");
  });
  it("uses cwd if no trusted startup signal exists", () => {
    expect(resolveProjectDir({ ...base, env: {} })).toBe("/fallback");
  });
});
