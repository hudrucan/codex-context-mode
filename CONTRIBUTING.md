# Contributing to codex-context-mode

Preserve upstream attribution and the Elastic License 2.0. See NOTICE and docs/UPSTREAM-CREDITS.md.

Use Node.js >=22.5 with SQLite FTS5 (Node 24 recommended). Install development dependencies explicitly with the package manager pinned in package.json, then run:

    npm run typecheck
    npm run build
    npm run package-plugin

Codex installs the generated local plugin through .agents/plugins/marketplace.json. See README.md for the native CLI commands and required hook review. Do not create separate MCP, skills or user-hook registrations.

Runtime code lives in start.mjs, the bundles, hooks and skills. All plugin-owned mutable state belongs under ~/.codex-context-mode/; CODEX_HOME holds Codex-owned configuration and transcripts. Startup and hooks must never install dependencies, rebuild, fetch upstream code, auto-trust hooks or change host security policy.

Use isolated temporary HOME, USERPROFILE, CODEX_HOME and CODEX_CONTEXT_MODE_HOME for lifecycle tests. The native lifecycle regression in tests/plugins/plugin-lifecycle.test.ts installs a real local plugin without node_modules and validates hooks, skills, MCP, session continuity, restart, enable/disable, local update and uninstall. Set CODEX_PLUGIN_TEST_CLI to the native Codex executable if discovery is unavailable.

Run relevant regression files with the existing Vitest configuration. Rebuild before tests that consume bundles. The manifest gate checks canonical IDs, one MCP, six skills, six hooks and complete runtime assets. Built bundles are tracked release artifacts; source changes must include matching regenerated bundles.

A source/test task does not authorize production registration changes, rollout, commit or push. Keep other plugins and Codex/C2C/Lazier state untouched.
