# Codex Context Mode

A full local Codex plugin for code execution, SQLite FTS5 search and session continuity. Derived from [context-mode by Mert Koseoğlu](https://github.com/mksglu/context-mode), under [Elastic License 2.0](LICENSE); see [NOTICE](NOTICE) and [upstream credits](docs/UPSTREAM-CREDITS.md).

## Build and install

Requires Node.js >=22.5 with node:sqlite/FTS5 support (Node 24 recommended). Development dependencies are installed explicitly by the developer; neither startup nor hooks install dependencies or contact upstream.

From a reviewed checkout, run:

    npm run typecheck
    npm run build
    npm run package-plugin
    codex plugin marketplace add "/absolute/path/to/codex-context-mode"
    codex plugin add codex-context-mode@codex-context-mode

On Windows, quote paths with spaces. Use Codex plugin management to enable/disable, update/reinstall a rebuilt local release, and uninstall:

    codex plugin remove codex-context-mode@codex-context-mode

Do not separately register an MCP, copy skills, or install user hooks. The local marketplace points at the generated dist/codex-context-mode package; it uses neither a Git clone nor symlinks. Rebuild and repackage before installing source changes. No production configuration is modified by the build.

## Components and trust

One stdio MCP named codex-context-mode exposes the existing ctx_* APIs. Six bundled skills are discovered by Codex as codex-context-mode:main, :doctor, :index, :search, :stats and :purge. Hosted analytics and self-upgrade commands are removed.

Six command hooks use the required PascalCase Codex events and kebab-case filenames: PreToolUse, PostToolUse, SessionStart, PreCompact, UserPromptSubmit and Stop. They run with Node, with the plugin path quoted.

Codex registers the components together. Hooks still require the host's standard review of their exact definitions before execution. Installation never auto-trusts hooks or changes sandbox/approval/security policy. Review changed hashes after updates. See the [official plugin contract](https://developers.openai.com/plugins/build/plugins) and [native hooks contract](https://learn.chatgpt.com/docs/hooks).

Use ctx_doctor or the bundled doctor skill to detect stale upstream plugin caches/registrations and duplicate standalone MCP/hooks/skills. Diagnostics report problems without rewriting host configuration or touching other plugins.

## Runtime

All plugin-owned mutable state defaults to ~/.codex-context-mode/, beside ~/.codex/:

    data/content/     project SQLite FTS5 databases
    data/sessions/    session databases and continuity sidecars
    data/stats/       project statistics
    data/memory/      project-scoped memory
    cache/tmp/        execution files, markers and caches
    logs/             reserved for local diagnostics

CODEX_CONTEXT_MODE_HOME optionally selects an absolute external runtime root. Code assets and mutable state must remain separate; source/plugin-root overrides are rejected. Codex owns its own config, trust records and transcripts under CODEX_HOME, independently of this plugin.

This is a clean storage layout. It does not import, delete or migrate previous installations or databases. Uninstall removes plugin registrations/code through Codex; external runtime data remains until the user explicitly purges it. ctx_purge keeps its explicit confirmation and session/project scope. Expired source records are cleaned transactionally after 14 days; startup never unlinks persistent databases or their WAL/SHM files.

Network is used only by an explicitly requested network feature (for example ctx_fetch_and_index or user execution code), subject to the existing security boundaries.

## Validation

Focused tests include the real native Codex plugin lifecycle in a disposable CODEX_HOME, offline MCP boot without node_modules, all six hook commands through PowerShell on Windows, indexing/search, session continuity/restart, SQLite integrity, workspace isolation and security deny enforcement. Set CODEX_PLUGIN_TEST_CLI to a supported Codex executable; the native lifecycle test is explicitly skipped when one is unavailable. No test requires real production configuration or data.
