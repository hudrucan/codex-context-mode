import { describe, it, expect } from "vitest";
import { resolveProjectDir, resolveCodexRequestContext } from "../../src/util/project-dir.js";
describe("Codex workspace isolation from foreign environment", () => {
  const foreign = ["CLAUDE_PROJECT_DIR", "GEMINI_PROJECT_DIR", "VSCODE_CWD", "OPENCODE_PROJECT_DIR", "PI_PROJECT_DIR", "PI_WORKSPACE_DIR", "IDEA_INITIAL_DIRECTORY", "CURSOR_CWD", "QWEN_PROJECT_DIR"];
  it.each(foreign)("ignores %s and keeps explicit workspace priority", key => {
    const base = { cwd: "/fallback", pwd: "/shell", codexHome: "/missing-codex-home" };
    expect(resolveProjectDir({ ...base, env: { [key]: "/leak" } })).toBe("/shell");
    expect(resolveProjectDir({ ...base, env: { [key]: "/leak", CONTEXT_MODE_PROJECT_DIR: "/own" } })).toBe("/own");
  });
  it.each(foreign)("does not let %s substitute for MCP thread identity", key => {
    const saved = process.env[key];
    try { process.env[key] = "/leak"; expect(resolveCodexRequestContext(undefined, "/missing-codex-home")).toBeNull(); }
    finally { if (saved === undefined) delete process.env[key]; else process.env[key] = saved; }
  });
});
