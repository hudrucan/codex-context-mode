import "../setup-home";
import { describe, it, expect, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CodexAdapter, parseCodexContextModePluginRoot, probeCodexCliVersion } from "../../src/adapters/codex/index.js";
import { resolveSessionDbPath, SessionDB } from "../../src/session/db.js";

function directHookCommand(event: string, root = "/ignored/plugin/root"): string {
  return `node "${join(root, "hooks", "codex", `${event}.mjs`).replace(/\\/g, "/")}"`;
}

function writeCodexPluginManifest(pluginRoot: string): void {
  const pluginDir = join(pluginRoot, ".codex-plugin");
  mkdirSync(pluginDir, { recursive: true });
  writeFileSync(join(pluginDir, "hooks.json"), JSON.stringify({
    hooks: new CodexAdapter().generateHookConfig(pluginRoot),
  }, null, 2), "utf-8");
}

function pluginEnabledSettings(extra = ""): string {
  return `[features]
hooks = true

[plugins."context-mode@context-mode"]
enabled = true

${extra}`;
}

function pluginListOutput(pluginRoot: string): string {
  return `Marketplace \`context-mode\`
/Users/test/.codex/.tmp/marketplaces/context-mode/.agents/plugins/marketplace.json

PLUGIN                    STATUS              VERSION  PATH
context-mode@context-mode  installed, enabled  1.0.162  ${pluginRoot}
`;
}

function adapterWithCodexPluginRoot(pluginRoot: string): CodexAdapter {
  return new CodexAdapter({
    codexPluginListRunner: () => pluginListOutput(pluginRoot),
  });
}

describe("CodexAdapter", () => {
  let adapter: CodexAdapter;

  beforeEach(() => {
    adapter = new CodexAdapter({
      codexPluginListRunner: () => {
        throw new Error("codex plugin list unavailable in unit tests");
      },
    });
  });

  // ── Capabilities ──────────────────────────────────────

  describe("capabilities", () => {
    it("preToolUse is true", () => {
      expect(adapter.capabilities.preToolUse).toBe(true);
    });

    it("postToolUse is true", () => {
      expect(adapter.capabilities.postToolUse).toBe(true);
    });

    it("sessionStart is true", () => {
      expect(adapter.capabilities.sessionStart).toBe(true);
    });

    it("preCompact is true", () => {
      expect(adapter.capabilities.preCompact).toBe(true);
    });

    it("canModifyArgs is false (Codex does not support updatedInput)", () => {
      expect(adapter.capabilities.canModifyArgs).toBe(false);
    });

    it("canModifyOutput is false (Codex does not support updatedMCPToolOutput)", () => {
      expect(adapter.capabilities.canModifyOutput).toBe(false);
    });

    it("canInjectSessionContext is true", () => {
      expect(adapter.capabilities.canInjectSessionContext).toBe(true);
    });

    it("paradigm is json-stdio", () => {
      expect(adapter.paradigm).toBe("json-stdio");
    });
  });

  // ── parsePreToolUseInput ──────────────────────────────

  describe("parsePreToolUseInput", () => {
    it("extracts tool_name from input", () => {
      const event = adapter.parsePreToolUseInput({
        tool_name: "Bash",
        tool_input: { command: "ls" },
        session_id: "s1",
        cwd: "/tmp",
        hook_event_name: "PreToolUse",
        model: "o3",
        permission_mode: "default",
        tool_use_id: "tu1",
        transcript_path: null,
        turn_id: "t1",
      });
      expect(event.toolName).toBe("Bash");
    });

    it("extracts session_id", () => {
      const event = adapter.parsePreToolUseInput({
        tool_name: "Bash",
        tool_input: { command: "ls" },
        session_id: "codex-123",
        cwd: "/proj",
        hook_event_name: "PreToolUse",
        model: "o3",
        permission_mode: "default",
        tool_use_id: "tu1",
        transcript_path: null,
        turn_id: "t1",
      });
      expect(event.sessionId).toBe("codex-123");
    });

    it("extracts projectDir from cwd", () => {
      const event = adapter.parsePreToolUseInput({
        tool_name: "Bash",
        tool_input: { command: "ls" },
        session_id: "s1",
        cwd: "/my/project",
        hook_event_name: "PreToolUse",
        model: "o3",
        permission_mode: "default",
        tool_use_id: "tu1",
        transcript_path: null,
        turn_id: "t1",
      });
      expect(event.projectDir).toBe("/my/project");
    });

    it("falls back to CODEX_PROJECT_DIR when cwd missing", () => {
      const savedCwd = process.env.CODEX_PROJECT_DIR;
      process.env.CODEX_PROJECT_DIR = "/env/project";
      try {
        const event = adapter.parsePreToolUseInput({
          tool_name: "Bash",
          tool_input: { command: "ls" },
          session_id: "s1",
          hook_event_name: "PreToolUse",
        });
        expect(event.projectDir).toBe("/env/project");
      } finally {
        if (savedCwd === undefined) delete process.env.CODEX_PROJECT_DIR;
        else process.env.CODEX_PROJECT_DIR = savedCwd;
      }
    });

    it("falls back to process.cwd() when cwd and env both missing", () => {
      const savedCwd = process.env.CODEX_PROJECT_DIR;
      delete process.env.CODEX_PROJECT_DIR;
      try {
        const event = adapter.parsePreToolUseInput({
          tool_name: "Bash",
          tool_input: { command: "ls" },
          session_id: "s1",
          hook_event_name: "PreToolUse",
        });
        expect(event.projectDir).toBe(process.cwd());
      } finally {
        if (savedCwd !== undefined) process.env.CODEX_PROJECT_DIR = savedCwd;
      }
    });

    it("post/precompact/sessionstart parsers also fall back to process.cwd()", () => {
      const savedCwd = process.env.CODEX_PROJECT_DIR;
      delete process.env.CODEX_PROJECT_DIR;
      try {
        const post = adapter.parsePostToolUseInput({ tool_name: "Bash" });
        expect(post.projectDir).toBe(process.cwd());

        const compact = adapter.parsePreCompactInput({ session_id: "s1" });
        expect(compact.projectDir).toBe(process.cwd());

        const start = adapter.parseSessionStartInput({ session_id: "s1" });
        expect(start.projectDir).toBe(process.cwd());
      } finally {
        if (savedCwd !== undefined) process.env.CODEX_PROJECT_DIR = savedCwd;
      }
    });
  });

  // ── formatPreToolUseResponse ──────────────────────────

  describe("formatPreToolUseResponse", () => {
    it("deny returns hookSpecificOutput with hookEventName and permissionDecision deny", () => {
      const resp = adapter.formatPreToolUseResponse({
        decision: "deny",
        reason: "blocked",
      });
      const hso = (resp as { hookSpecificOutput: Record<string, unknown> }).hookSpecificOutput;
      expect(hso.hookEventName).toBe("PreToolUse");
      expect(hso.permissionDecision).toBe("deny");
      expect(hso.permissionDecisionReason).toBe("blocked");
    });

    it("allow returns empty object (passthrough)", () => {
      const resp = adapter.formatPreToolUseResponse({ decision: "allow" });
      expect(resp).toEqual({});
    });
  });

  // ── parsePostToolUseInput ─────────────────────────────

  describe("parsePostToolUseInput", () => {
    it("extracts tool_response", () => {
      const event = adapter.parsePostToolUseInput({
        tool_name: "Bash",
        tool_input: { command: "echo hi" },
        tool_response: "hi\n",
        session_id: "s1",
        cwd: "/tmp",
        hook_event_name: "PostToolUse",
        model: "o3",
        permission_mode: "default",
        tool_use_id: "tu1",
        transcript_path: null,
        turn_id: "t1",
      });
      expect(event.toolOutput).toBe("hi\n");
    });
  });

  // ── formatPostToolUseResponse ─────────────────────────

  describe("formatPostToolUseResponse", () => {
    it("context injection returns hookEventName and additionalContext in hookSpecificOutput", () => {
      const resp = adapter.formatPostToolUseResponse({
        additionalContext: "extra info",
      });
      const hso = (resp as { hookSpecificOutput: Record<string, unknown> }).hookSpecificOutput;
      expect(hso.hookEventName).toBe("PostToolUse");
      expect(hso.additionalContext).toBe("extra info");
    });
  });

  // ── parseSessionStartInput ────────────────────────────

  describe("parseSessionStartInput", () => {
    it("extracts source field", () => {
      const event = adapter.parseSessionStartInput({
        session_id: "s1",
        cwd: "/proj",
        hook_event_name: "SessionStart",
        model: "o3",
        permission_mode: "default",
        source: "startup",
        transcript_path: null,
      });
      expect(event.source).toBe("startup");
    });

    it("extracts session_id", () => {
      const event = adapter.parseSessionStartInput({
        session_id: "codex-456",
        cwd: "/proj",
        hook_event_name: "SessionStart",
        model: "o3",
        permission_mode: "default",
        source: "resume",
        transcript_path: null,
      });
      expect(event.sessionId).toBe("codex-456");
    });
  });

  // ── formatSessionStartResponse ──────────────────────

  describe("formatSessionStartResponse", () => {
    it("context returns hookEventName and additionalContext in hookSpecificOutput", () => {
      const resp = adapter.formatSessionStartResponse({
        context: "routing block",
      });
      const hso = (resp as { hookSpecificOutput: Record<string, unknown> }).hookSpecificOutput;
      expect(hso.hookEventName).toBe("SessionStart");
      expect(hso.additionalContext).toBe("routing block");
    });

    it("empty context returns empty object", () => {
      const resp = adapter.formatSessionStartResponse({});
      expect(resp).toEqual({});
    });
  });


  it("uses plugin-managed installation", () => {
    expect(() => adapter.configureAllHooks()).toThrow("Codex plugin");
    expect(() => adapter.writeSettings()).toThrow("Codex manages");
    expect(adapter.getInstalledVersion()).toBe("plugin-managed");
    expect(adapter.getSessionDir()).toContain(".codex-context-mode");
    expect(Object.keys(adapter.generateHookConfig("/plugin with spaces"))).toHaveLength(6);
  });
});
