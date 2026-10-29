import { describe, it, expect } from "vitest";
import { getToolName, createToolNamer, KNOWN_PLATFORMS } from "../../hooks/core/tool-naming.mjs";
import { createRoutingBlock, createReadGuidance, createGrepGuidance, createBashGuidance } from "../../hooks/routing-block.mjs";
describe("Codex tool naming and routing guidance", () => {
  it("uses bare ctx names for every guidance entrypoint", () => {
    const namer = createToolNamer("codex");
    expect(KNOWN_PLATFORMS).toEqual(["codex"]);
    expect(getToolName("codex", "ctx_search")).toBe("ctx_search");
    for (const render of [createRoutingBlock, createReadGuidance, createGrepGuidance, createBashGuidance]) {
      const output = render(namer);
      expect(output).toContain("ctx_");
      expect(output).not.toContain("mcp__plugin_context-mode");
    }
  });
});
