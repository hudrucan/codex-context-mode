import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
const json = (p: string) => JSON.parse(readFileSync(resolve(root, p), "utf8"));
describe("single Codex plugin contract", () => {
  it("has canonical identity and one host-policy-neutral local MCP", () => {
    const plugin = json(".codex-plugin/plugin.json"), pkg = json("package.json"), mcp = json(".mcp.json");
    expect(plugin.name).toBe("codex-context-mode"); expect(pkg.name).toBe(plugin.name);
    expect(plugin.version).toBe(pkg.version); expect(plugin.mcpServers).toBe("./.mcp.json");
    expect(plugin.hooks).toBe("./hooks/hooks.json"); expect(plugin.skills).toBe("./skills/");
    expect(Object.keys(mcp.mcpServers)).toEqual(["codex-context-mode"]);
    expect(mcp.mcpServers["codex-context-mode"]).toEqual({command: "node", args: ["./start.mjs"], cwd: ".", env: {CONTEXT_MODE_PLATFORM: "codex"}});
    expect(readdirSync(resolve(root, ".codex-plugin"))).toEqual(["plugin.json"]);
    expect(pkg.scripts.postinstall).toBeUndefined(); expect(pkg.scripts.setup).toBeUndefined();
  });
  it("bundles exactly six namespace-local skills", () => {
    const names = readdirSync(resolve(root, "skills")).filter(n => existsSync(resolve(root, "skills", n, "SKILL.md"))).sort();
    expect(names).toEqual(["doctor", "index", "main", "purge", "search", "stats"]);
    for (const name of names) expect(readFileSync(resolve(root, "skills", name, "SKILL.md"), "utf8")).toMatch(new RegExp("^name: " + name + "$", "m"));
  });
  it("keeps PascalCase events and six safe kebab-case hook commands", () => {
    const hooks = json("hooks/hooks.json").hooks;
    const names = {PreToolUse:"pre-tool-use",PostToolUse:"post-tool-use",SessionStart:"session-start",PreCompact:"pre-compact",UserPromptSubmit:"user-prompt-submit",Stop:"stop"};
    expect(Object.keys(hooks).sort()).toEqual(Object.keys(names).sort());
    for (const [event, file] of Object.entries(names)) {
      expect(hooks[event]).toHaveLength(1); expect(hooks[event][0].hooks).toHaveLength(1);
      expect(hooks[event][0].hooks[0].command).toBe('node "${PLUGIN_ROOT}/hooks/codex/' + file + '.mjs"');
      expect(existsSync(resolve(root, "hooks/codex/" + file + ".mjs"))).toBe(true);
    }
    expect(hooks.PreToolUse[0].matcher).toContain("read_file");
  });
  it("preserves attribution and excludes separate legacy installers", () => {
    expect(json("package.json").license).toBe("Elastic-2.0");
    expect(readFileSync(resolve(root, "NOTICE"), "utf8")).toContain("Mert");
    for (const p of ["configs/codex/hooks.json", "configs/codex/config.toml", "scripts/postinstall.mjs", "hooks/ensure-deps.mjs"]) expect(existsSync(resolve(root, p))).toBe(false);
  });
});
