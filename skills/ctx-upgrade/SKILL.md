---
name: ctx-upgrade
description: |
  Self-upgrade is disabled in this Codex-only fork.
  Report the disabled status; do not download, reinstall or rewrite source/hooks.
  Trigger: /context-mode:ctx-upgrade
user-invocable: true
---

# Context Mode Upgrade — Disabled

Self-upgrade is disabled. Use a reviewed local checkout and the documented local pilot procedure when an update is explicitly requested.

## Instructions

1. Call the `ctx_upgrade` MCP tool only to report its disabled status. An error response stating that self-upgrade is disabled is the expected result.
2. Display that status honestly. No upgrade command is generated; do not execute one, install an upstream package, or reconfigure hooks.
3. If the MCP tool is unavailable, report that self-upgrade is disabled. There is no shell fallback and no automatic download/install path.
4. Do not claim a pull, build, install or rollout occurred.
