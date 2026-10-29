# Context Mode for Codex

This fork supports **Codex only**: sandboxed code execution, SQLite FTS5 search, and session continuity. Self-upgrade is disabled in both CLI and MCP. Use a reviewed local checkout; do not install an upstream npm release over this fork.

Derived from [context-mode by Mert Koseoğlu](https://github.com/mksglu/context-mode), under [Elastic License 2.0](LICENSE). Package and plugin identity remain `context-mode`. Historical skill credits are in [docs/UPSTREAM-CREDITS.md](docs/UPSTREAM-CREDITS.md).

## Install

Node.js **>= 22.5.0** is required by the package. Use the package-manager version pinned in `package.json`:

```sh
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm run build
```

Run these commands inside the reviewed fork checkout. The build produces six bundles and validates their imports and Codex manifests. See [OS and SQLite requirements](docs/platform-support.md) for native dependency prerequisites.

### Standalone Codex configuration

Merge [configs/codex/config.toml](configs/codex/config.toml) into `$CODEX_HOME/config.toml` (default `~/.codex/config.toml`). Replace the absolute example path with this fork's launcher:

```toml
[features]
hooks = true

[mcp_servers.context-mode]
command = "node"
args = ["/absolute/path/to/codex-context-mode/start.mjs"]

[mcp_servers.context-mode.env]
CONTEXT_MODE_PLATFORM = "codex"
```

On Windows, use forward slashes in TOML, for example `D:/repos/codex-context-mode/start.mjs`. You may pin `command` to the absolute Node executable as well. Do not use a bare `context-mode` command or an npm package runner: either could select an upstream global installation instead of the local fork.

The equivalent MCP JSON example is [.mcp.json.codex.example](.mcp.json.codex.example). Merge [configs/codex/hooks.json](configs/codex/hooks.json) into the hooks configuration for the same Codex home. Replace **every** absolute CLI bundle path with the same reviewed checkout. Example PreToolUse entry inside the hooks object:

```json
{"PreToolUse":[{"matcher":"local_shell|shell|shell_command|exec_command|Bash|Shell|apply_patch|Edit|Write|grep_files|ctx_execute|ctx_execute_file|ctx_batch_execute|ctx_fetch_and_index|ctx_search|ctx_index|mcp__","hooks":[{"type":"command","command":"node \"/absolute/path/to/codex-context-mode/cli.bundle.mjs\" hook codex pretooluse"}]}]}
```

Enable and trust the hooks in Codex. MCP availability alone does not prove hooks are running. Incorporate [configs/codex/AGENTS.md](configs/codex/AGENTS.md) without replacing existing project rules.

### Codex plugin assets

The plugin uses [.codex-plugin/plugin.json](.codex-plugin/plugin.json), its sibling MCP/hooks manifests, `skills/`, and [.agents/plugins/marketplace.json](.agents/plugins/marketplace.json). The marketplace source materializes a Git checkout; it does not include uncommitted changes. For an uncommitted local pilot, use the absolute-path standalone setup above. Do not enable duplicate plugin and standalone registrations for the same pilot.

A [local pilot procedure with backup, smoke tests and rollback](CONTRIBUTING.md#local-pilot-rollout-procedure) is available. Preparing or building a candidate does not activate it.

## Tools

| Tool | Function |
|---|---|
| `ctx_execute` | Run code in a subprocess; return printed output. |
| `ctx_execute_file` | Read a permitted file into `FILE_CONTENT` and run code over it. |
| `ctx_batch_execute` | Run bounded command batches and retrieve relevant output. |
| `ctx_index` | Index a local path or supplied content into persistent SQLite FTS5. |
| `ctx_search` | Search indexed content with BM25, stemming and substring retrieval. |
| `ctx_fetch_and_index` | Fetch HTTP(S) content, index it, and reuse cached content within its TTL. |
| `ctx_stats` | Show session statistics and context savings. |
| `ctx_doctor` | Report runtimes, hooks, FTS5 and local installation diagnostics. |
| `ctx_upgrade` | **Disabled**; returns status and generates no upgrade command. |
| `ctx_purge` | Destructively purge an explicitly selected session or project. |
| `ctx_insight` | Open the external hosted Insight URL in the default browser. |

For large outputs, write code to count, filter or summarize the data and print the result. Use native file reading when preparing an edit. Context routing does not dictate the prose style of answers.

JavaScript, TypeScript, Python, Shell, Ruby, Go, Rust, PHP, Perl, R, Elixir and C# are supported execution languages when the corresponding runtime is installed. Shell code must match the detected shell: Windows may use PowerShell rather than Bash. Use JavaScript for portable filesystem and process analysis.

CLI commands must also pin the local bundle:

```sh
node "/absolute/path/to/codex-context-mode/cli.bundle.mjs" doctor
node "/absolute/path/to/codex-context-mode/cli.bundle.mjs" index . --source project:my-app
node "/absolute/path/to/codex-context-mode/cli.bundle.mjs" search "authentication middleware" --source project:my-app
```

`ctx upgrade` and `/context-mode:ctx-upgrade` report the disabled status. They do not pull, reinstall, repair hooks or update npm global packages.

## Workspace routing and storage

MCP requests use verified thread identity to resolve their workspace. `CONTEXT_MODE_PROJECT_DIR` may explicitly pin a workspace when no transcript is available; launcher-inferred CWD is not an explicit pin. Missing trustworthy roots fail closed. Known thread routing takes precedence over an unrelated explicit root.

| Setting | Behavior |
|---|---|
| `CODEX_HOME` | Native Codex config/transcripts and default `context-mode/` storage root; defaults to `~/.codex`. |
| `CONTEXT_MODE_DIR` | Explicit absolute context-mode storage root: `<root>/sessions` and `<root>/content`. |
| `CONTEXT_MODE_DATA_DIR` | Existing data-root override: `<root>/context-mode/sessions` and `<root>/context-mode/content`. |

Keep existing explicit overrides when moving an installation. `CONTEXT_MODE_DIR` takes precedence over the default/data-root location. Do not use a shared storage override casually for a pilot. Session helpers preserve project/thread attribution and resume state; indexed content is persisted per project. See [CONTRIBUTING.md](CONTRIBUTING.md#architecture-and-contracts) for the SQLite multi-writer contract.

## Session continuity

Codex hooks capture relevant events and restore context after compaction or resume:

| Hook | Role |
|---|---|
| PreToolUse | Apply tool-routing and deny-policy checks. |
| PostToolUse | Capture tool results and session events. |
| UserPromptSubmit | Capture prompts, corrections and the active goal. |
| Stop | Capture turn-end state. |
| PreCompact | Save a continuity snapshot. |
| SessionStart | Restore eligible state and inject routing guidance. |

Verify all six hooks separately from MCP. Resume uses eligible snapshots and session attribution; it should not mix state between concurrent threads or repositories. The hooks and SQLite data remain local until an explicitly invoked tool or command performs a network operation.

## Security

Execution tools run arbitrary code in subprocesses with the process's filesystem and network access. This is not a full OS isolation boundary. Keep host sandboxing and approval controls enabled. Authenticated CLIs may inherit credentials through environment variables and config paths.

Context-mode reads its permissions schema from project `.codex/settings.json` and global `$CODEX_HOME/settings.json`. These are separate from native Codex `config.toml`. Existing `.claude/settings.json`, `.claude/settings.local.json` and global policies under `CLAUDE_CONFIG_DIR` remain **read-only compatibility inputs**, not supported host integrations. Explicit policy-path overrides are preserved.

```json
{
  "permissions": {
    "deny": ["Bash(sudo *)", "Bash(rm -rf /*)", "Read(.env)", "Read(**/.env*)"],
    "allow": ["Bash(git:*)", "Bash(npm:*)"]
  }
}
```

A deny from **any** loaded policy wins over an allow. A project allow cannot defeat a global deny. Bash-pattern rules are used for command checks; Read rules are used for file access. Unconfigured rules are not a replacement for host security controls.

### Project-boundary containment

`ctx_execute_file` refuses paths outside the resolved project, including traversal and symlink escapes, unless an existing `permissions.allow` Read rule grants the path. A matching deny still wins:

```json
{"permissions":{"allow":["Read(/var/log/**)"]}}
```

The approval title `Run code over a file (executes code, reads the given path)` describes the action. Other execution tools still run arbitrary code; file-tool containment does not restrict every filesystem operation a script could perform.

### Network and persistence

`ctx_fetch_and_index` accepts HTTP(S) only and blocks metadata/link-local and reserved targets. Loopback/private-network targets are allowed by default for local development; `CTX_FETCH_STRICT=1` additionally blocks those ranges. Scripts and authenticated CLIs can perform network requests when authorized.

MCP arguments are redacted for recognized credential keys before session persistence. That does not make arbitrary script output safe to publish. Databases persist under the configured storage root and may contain local project/session data. Back them up while their writers are stopped; do not assume they disappear when Codex exits.

`ctx_insight` opens an external website. The runtime also retains local session/usage telemetry; this fork does not claim that every invoked command is offline.

## Validation and contribution

See [CONTRIBUTING.md](CONTRIBUTING.md) for affected tests, Windows constraints and local pilot preparation. [BENCHMARK.md](BENCHMARK.md) preserves historical upstream measurements; those are not a fresh performance guarantee for this fork. Historical design decisions remain in [docs/adr](docs/adr).

## License and attribution

[Elastic License 2.0](LICENSE) applies. Preserve its notices and the original author's attribution. The fork's source is [hudrucan/codex-context-mode](https://github.com/hudrucan/codex-context-mode); the original project is [mksglu/context-mode](https://github.com/mksglu/context-mode). External skill credits remain in [docs/UPSTREAM-CREDITS.md](docs/UPSTREAM-CREDITS.md).
