import { describe, it, expect } from "vitest";
import { extractEvents } from "../../src/session/extract.js";

describe("Codex exec_command input normalization", () => {
  it("captures the same Git event for cmd and command", () => {
    const run = (tool_input: Record<string, unknown>) => extractEvents({
      tool_name: "exec_command", tool_input, tool_response: "abc1234 baseline entry",
    });
    expect(run({ cmd: "git log --oneline -2" })).toEqual(run({ command: "git log --oneline -2" }));
    expect(run({ cmd: "git log --oneline -2" }).some(e => e.category === "git" && e.data === "log")).toBe(true);
    expect(run({ cmd: "git status", command: "git log --oneline -2" })).toEqual(run({ command: "git log --oneline -2" }));
  });

  it("does not reinterpret another adapter's cmd field", () => {
    expect(extractEvents({ tool_name: "Bash", tool_input: { cmd: "git log --oneline -2" } }).some(e => e.category === "git")).toBe(false);
    expect(extractEvents({ tool_name: "exec_command", tool_input: { cmd: null } }).some(e => e.category === "git")).toBe(false);
  });
});
