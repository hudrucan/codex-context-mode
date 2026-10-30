/** Codex responses for normalized routing decisions. */

export const formatters = {
  "codex": {
    deny: (reason) => ({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
    // Codex still rejects permissionDecision:"ask" in PreToolUse (verified
    // against codex-cli 0.141.0 output_parser.rs). Keep dropping it.
    ask: () => null,
    // #845: modern Codex (>= 0.141.0) honors permissionDecision:"allow" +
    // updatedInput (command rewrite). Emit it when the running Codex supports
    // it; otherwise FAIL CLOSED — turn the redirect into an enforceable deny
    // carrying the same guidance, so the bytes-flood guard never silently
    // passes through. `codexSupportsRewrite` is detected at runtime by the
    // codex hook (hooks/core/codex-caps.mjs) and threaded in via formatDecision.
    modify: (updatedInput, { codexSupportsRewrite } = {}) => {
      if (codexSupportsRewrite) {
        return {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "allow",
            updatedInput,
          },
        };
      }
      const ui = updatedInput ?? {};
      // Only command redirects must fail closed. Non-command rewrites (e.g.
      // Agent prompt injection) are advisory — drop rather than block the tool.
      if (!("command" in ui)) return null;
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: codexRedirectReason(ui.command),
        },
      };
    },
    // #845: surface additionalContext on Codex builds that support it; older
    // builds ignore the field, so drop the advisory nudge rather than emit a
    // shape they reject.
    context: (additionalContext, { codexSupportsRewrite } = {}) =>
      codexSupportsRewrite
        ? { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext } }
        : null,
  }
};

// #845: routing wraps redirect guidance as `echo "<guidance>"`. Unwrap a command
// that is exactly `echo "<inner>"` (with optional surrounding whitespace) and
// return the inner string, or null when the shape doesn't match. Greedy: inner
// runs from the first `"` after `echo` to the last `"` before trailing space.
function unwrapEcho(command) {
  const s = String(command ?? "");
  // Match the regex `\s` class exactly: space, tab, newline, carriage return,
  // form feed, vertical tab (so behavior is identical to /^echo\s+"…"\s*$/).
  const isWs = (c) =>
    c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v";
  if (!s.startsWith("echo")) return null;
  let i = 4;
  if (i >= s.length || !isWs(s[i])) return null; // `echo` must be followed by whitespace
  while (i < s.length && isWs(s[i])) i++;
  if (s[i] !== "\"") return null; // payload must open with a quote
  let end = s.length;
  while (end > 0 && isWs(s[end - 1])) end--; // drop trailing whitespace
  if (end <= i + 1 || s[end - 1] !== "\"") return null; // must close with a quote
  return s.slice(i + 1, end - 1);
}

// Reverse the shell double-quote escaping routing applied: `\"` → `"`, `\\` → `\`.
function unescapeDquote(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && (s[i + 1] === "\"" || s[i + 1] === "\\")) {
      out += s[i + 1];
      i++;
    } else {
      out += s[i];
    }
  }
  return out;
}

// When Codex cannot rewrite the command we surface that guidance as the deny
// reason instead (mirrors the claude-code / antigravity-cli echo extraction).
function codexRedirectReason(command) {
  const inner = unwrapEcho(command);
  if (inner !== null) return unescapeDquote(inner);
  return "context-mode: command redirected. Use the codex-context-mode MCP tools (ctx_execute / ctx_fetch_and_index / ctx_search) so raw output stays out of the conversation.";
}

/**
 * Apply a formatter to a normalized routing decision.
 * Returns the platform-specific JSON response, or null for passthrough.
 *
 * `opts` carries optional per-platform capability hints (e.g. codex
 * `codexSupportsRewrite`). Formatters that ignore the extra argument are
 * unaffected.
 */
export function formatDecision(platform, decision, opts = {}) {
  if (!decision) return null;

  const fmt = formatters[platform];
  if (!fmt) return null;

  switch (decision.action) {
    case "deny": return fmt.deny(decision.reason);
    // Pass the reason to ask() too — platforms whose ask formatter ignores it
    // (legacy `ask: () => …`) are unaffected; copilot-cli surfaces it.
    case "ask": return fmt.ask(decision.reason);
    case "modify": return fmt.modify(decision.updatedInput, opts);
    case "context": return fmt.context(decision.additionalContext, opts);
    default: return null;
  }
}
