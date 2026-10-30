import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
describe("local marketplace layout", () => {
  it("uses one generated real directory, with no upstream/git/symlink source", () => {
    const market = JSON.parse(readFileSync(resolve(".agents/plugins/marketplace.json"), "utf8"));
    expect(market.name).toBe("hudrucan");
    expect(market.interface.displayName).toBe("codex-context-mode");
    expect(market.plugins).toHaveLength(1);
    expect(market.plugins[0].name).toBe("codex-context-mode");
    expect(market.plugins[0].source).toEqual({source:"local",path:"./dist/codex-context-mode"});
  });
});
