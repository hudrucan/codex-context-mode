/** Codex owns plugin installation, enablement, update, trust and removal. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { BaseAdapter } from "../base.js";
import { hashProjectDirCanonical } from "../../session/db.js";
import { runtimePaths, PLUGIN_NAME } from "../../runtime-paths.js";
import { resolveCodexConfigDir } from "./paths.js";
import { buildNodeCommand, type HookAdapter, type HookParadigm, type PlatformCapabilities, type DiagnosticResult, type HookRegistration, type PreToolUseEvent, type PostToolUseEvent, type PreCompactEvent, type SessionStartEvent, type PreToolUseResponse, type PostToolUseResponse, type PreCompactResponse, type SessionStartResponse } from "../types.js";

interface CodexHookInput { tool_name?: string; tool_input?: Record<string, unknown>; tool_response?: string; session_id?: string; cwd?: string; source?: string; }
type CodexVersionRunner = (file: string, args: string[], options: any) => string | Buffer;
interface CodexAdapterOptions { codexPluginListRunner?: CodexVersionRunner; }
export const HOOK_FILES = {
  PreToolUse: "pre-tool-use", PostToolUse: "post-tool-use", SessionStart: "session-start",
  PreCompact: "pre-compact", UserPromptSubmit: "user-prompt-submit", Stop: "stop",
} as const;
const MATCHER = "local_shell|shell|shell_command|exec_command|Bash|Shell|apply_patch|Edit|Write|read_file|Read|grep_files|ctx_execute|ctx_execute_file|ctx_batch_execute|ctx_fetch_and_index|ctx_search|ctx_index|mcp__";
export function probeCodexCliVersion(run: CodexVersionRunner = execFileSync): string | null {
  try { return String(process.platform === "win32"
    ? run("cmd.exe", ["/d", "/s", "/c", "codex --version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 })
    : run("codex", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 })).trim(); }
  catch { return null; }
}
export function parseCodexContextModePluginRoot(raw: string): string | null {
  try {
    const data = JSON.parse(raw);
    const plugins = Array.isArray(data) ? data : data.installed ?? [];
    const plugin = plugins.find((p: any) => p.name === PLUGIN_NAME && p.enabled !== false);
    if (plugin) return plugin.installedPath ?? plugin.root ?? null;
  } catch { /* readable CLI output */ }
  const line = raw.split(/\r?\n/).find(l => l.trim().startsWith(PLUGIN_NAME + "@") && l.includes("installed, enabled"));
  return line?.trim().split(/\s+/).slice(4).join(" ") || null;
}
function read(path: string): string { try { return readFileSync(path, "utf8"); } catch { return ""; } }
function sections(raw: string): Array<{name: string; body: string}> {
  const out: Array<{name: string; body: string}> = [];
  for (const line of raw.split(/\r?\n/)) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
    if (header) out.push({name: header[1].trim(), body: ""});
    else if (out.length) out[out.length - 1].body += line + "\n";
  }
  return out;
}
function ownedCommand(command: string) { return /(?:codex-context-mode|context-mode|hooks[/\\]codex[/\\])/.test(command); }
function staleUpstreamCache(root: string): boolean {
  try {
    for (const market of readdirSync(root, {withFileTypes:true})) {
      if (!market.isDirectory()) continue;
      if (market.name === "context-mode") return true;
      const plugins = readdirSync(join(root, market.name), {withFileTypes:true});
      if (plugins.some(p => p.isDirectory() && p.name === "context-mode")) return true;
    }
  } catch { /* No readable cache yet. Registration checks still run. */ }
  return false;
}

export class CodexAdapter extends BaseAdapter implements HookAdapter {
  constructor(_options: CodexAdapterOptions = {}) { super([".codex"]); }
  readonly name = "Codex";
  readonly paradigm: HookParadigm = "json-stdio";
  readonly capabilities: PlatformCapabilities = {preToolUse: true, postToolUse: true, preCompact: true, sessionStart: true, canModifyArgs: false, canModifyOutput: false, canInjectSessionContext: true};
  parsePreToolUseInput(raw: unknown): PreToolUseEvent {
    const input = raw as CodexHookInput;
    return {
      toolName: input.tool_name ?? "",
      toolInput: input.tool_input ?? {},
      sessionId: this.extractSessionId(input),
      projectDir: this.getProjectDir(input),
      raw,
    };
  }

  parsePostToolUseInput(raw: unknown): PostToolUseEvent {
    const input = raw as CodexHookInput;
    return {
      toolName: input.tool_name ?? "",
      toolInput: input.tool_input ?? {},
      toolOutput: input.tool_response,
      sessionId: this.extractSessionId(input),
      projectDir: this.getProjectDir(input),
      raw,
    };
  }

  parsePreCompactInput(raw: unknown): PreCompactEvent {
    const input = raw as CodexHookInput;
    return {
      sessionId: this.extractSessionId(input),
      projectDir: this.getProjectDir(input),
      raw,
    };
  }

  parseSessionStartInput(raw: unknown): SessionStartEvent {
    const input = raw as CodexHookInput;
    const rawSource = input.source ?? "startup";

    let source: SessionStartEvent["source"];
    switch (rawSource) {
      case "compact":
        source = "compact";
        break;
      case "resume":
        source = "resume";
        break;
      case "clear":
        source = "clear";
        break;
      default:
        source = "startup";
    }

    return {
      sessionId: this.extractSessionId(input),
      source,
      projectDir: this.getProjectDir(input),
      raw,
    };
  }

  // ── Response formatting ────────────────────────────────
  // Codex CLI uses hookSpecificOutput wrapper for all hook responses.
  // Unlike Claude Code, Codex does NOT support updatedInput or updatedMCPToolOutput.

  formatPreToolUseResponse(response: PreToolUseResponse): unknown {
    if (response.decision === "deny") {
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            response.reason ?? "Blocked by context-mode hook",
        },
      };
    }
    if (response.decision === "context" && response.additionalContext) {
      // Codex does not support additionalContext in PreToolUse (fails open).
      // Context injection works via PostToolUse and SessionStart instead.
      return {};
    }
    // "allow" — return empty object for passthrough
    return {};
  }

  formatPostToolUseResponse(response: PostToolUseResponse): unknown {
    if (response.additionalContext) {
      return {
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: response.additionalContext,
        },
      };
    }
    return {};
  }

  formatPreCompactResponse(response: PreCompactResponse): unknown {
    // Codex PreCompact currently accepts only universal hook fields.
    // The hook script stores snapshots in context-mode's DB; SessionStart
    // injects them after compaction.
    return {};
  }

  formatSessionStartResponse(response: SessionStartResponse): unknown {
    if (response.context) {
      return {
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: response.context,
        },
      };
    }
    return {};
  }


  getConfigDir(_projectDir?: string) { return resolveCodexConfigDir(); }
  getSettingsPath() { return join(this.getConfigDir(), "config.toml"); }
  getSessionDir() { return runtimePaths().sessions; }
  getInstructionFiles() { return ["AGENTS.md", "AGENTS.override.md"]; }
  getMemoryDir(projectDir?: string) { const base = runtimePaths().memory; return projectDir ? join(base, hashProjectDirCanonical(projectDir)) : base; }
  getProjectDir(input?: CodexHookInput) { return input?.cwd ?? process.env.CODEX_PROJECT_DIR ?? process.cwd(); }
  getHooksPath() { return join(this.getConfigDir(), "hooks.json"); }
  generateHookConfig(pluginRoot: string): HookRegistration {
    return Object.fromEntries(Object.entries(HOOK_FILES).map(([event, name]) => [event, [{
      matcher: event === "PreToolUse" ? MATCHER : "",
      hooks: [{type: "command", command: buildNodeCommand(join(pluginRoot, "hooks", "codex", name + ".mjs"))}],
    }]]));
  }
  readSettings(): Record<string, unknown> | null { return null; }
  writeSettings(): never { throw new Error("Codex manages plugin configuration; no standalone installer is provided."); }
  configureAllHooks(): never { throw new Error("Install/enable codex-context-mode through Codex plugin management."); }
  backupSettings(): null { return null; }
  setHookPermissions(): string[] { return []; }
  updatePluginRegistry(): never { throw new Error("Codex owns the plugin registry."); }
  getInstalledVersion(): string { return "plugin-managed"; }
  getRoutingInstructions(): string { return "Use the bundled codex-context-mode:main skill and ctx_* MCP tools."; }
  checkPluginRegistration(): DiagnosticResult {
    const raw = read(this.getSettingsPath());
    const table = sections(raw);
    const canonical = table.filter(s => /^plugins\.(?:"codex-context-mode(?:@[^"]+)?"|'codex-context-mode(?:@[^']+)?'|codex-context-mode)$/.test(s.name) && !/^\s*enabled\s*=\s*false/m.test(s.body));
    const standalone = table.some(s => /^mcp_servers\.["']?(?:codex-context-mode|codex_context_mode|context-mode|context_mode)["']?(?:\.|$)/.test(s.name));
    const stale = table.some(s => /^plugins\.(?:"context-mode(?:@[^"]+)?"|'context-mode(?:@[^']+)?'|context-mode)$/.test(s.name));
    if (standalone || canonical.length > 1) return {check: "MCP registration", status: "fail", message: "Duplicate/standalone Context Mode registrations; keep one codex-context-mode plugin."};
    if (stale) return {check: "MCP registration", status: "fail", message: "Stale upstream context-mode plugin registration."};
    return {check: "MCP registration", status: canonical.length === 1 ? "pass" : "fail", message: canonical.length === 1 ? "One codex-context-mode plugin enabled" : "Install and enable codex-context-mode in Codex"};
  }
  validateHooks(pluginRoot: string): DiagnosticResult[] {
    const checks: DiagnosticResult[] = [this.checkPluginRegistration()];
    const add = (check: string, ok: boolean, message: string) => checks.push({check, status: ok ? "pass" : "fail", message});
    let config: any;
    try { config = JSON.parse(readFileSync(join(pluginRoot, "hooks", "hooks.json"), "utf8")); }
    catch { add("Bundled hooks", false, "Missing or invalid hooks/hooks.json"); return checks; }
    add("Bundled hooks", Object.keys(config.hooks ?? {}).length === 6, "Exactly six native Codex hooks required");
    for (const [event, file] of Object.entries(HOOK_FILES)) {
      const groups = config.hooks?.[event];
      const command = groups?.[0]?.hooks?.[0]?.command;
      add(event + " hook", groups?.length === 1 && groups[0].hooks?.length === 1 && typeof command === "string" && command.includes("/hooks/codex/" + file + ".mjs") && existsSync(join(pluginRoot, "hooks", "codex", file + ".mjs")), "Bundled " + event + " uses " + file + ".mjs");
    }
    const settings = read(this.getSettingsPath());
    const inlineCommands = settings.split(/\[\[hooks\./).slice(1).flatMap(s => s.match(/^\s*command\s*=.*$/gm) ?? []);
    add("Native user-hook duplicates", !inlineCommands.some(ownedCommand), "No standalone Context Mode native hooks");
    const userHooks = read(this.getHooksPath());
    if (userHooks) {
      try {
        const parsed = JSON.parse(userHooks);
        const commands = Object.values(parsed.hooks ?? {}).flatMap((groups: any) => Array.isArray(groups) ? groups.flatMap((g: any) => (g.hooks ?? []).map((h: any) => String(h.command ?? ""))) : []);
        add("Standalone user hooks", !commands.some(ownedCommand), "No separate Context Mode user hooks");
      } catch { add("Standalone user hooks", false, "Invalid user hooks.json"); }
    }
    add("Stale upstream installation", !staleUpstreamCache(join(this.getConfigDir(), "plugins", "cache")), "No upstream context-mode cache in any marketplace");
    const legacySkills = ["context-mode", "ctx-doctor", "ctx-index", "ctx-search", "ctx-stats", "ctx-purge", "ctx-upgrade", "ctx-insight"];
    add("Standalone skills", !legacySkills.some(name => existsSync(join(this.getConfigDir(), "skills", name))), "Skills are bundled, not installed separately");
    return checks;
  }
  private extractSessionId(input: CodexHookInput): string { return input.session_id || "pid-" + process.ppid; }
}
