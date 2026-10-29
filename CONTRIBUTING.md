# Contributing to context-mode

This fork runs context-mode for Codex. The original project is by Mert Koseoğlu at [mksglu/context-mode](https://github.com/mksglu/context-mode). Preserve upstream attribution and the [Elastic License 2.0](LICENSE). Historical operating-skill credits are in [docs/UPSTREAM-CREDITS.md](docs/UPSTREAM-CREDITS.md).

## Local development

Use Node.js >= 22.5 and the package-manager version pinned in `package.json`. Native SQLite may require the build prerequisites listed in [README.md](README.md#install).

```sh
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm run build
corepack pnpm exec vitest run
```

The build compiles TypeScript, produces six runtime bundles, and checks bundle and Codex manifest integrity. Rebuild after changes to TypeScript: several tests and hooks consume compiled output.

For standalone development, adapt `.mcp.json.codex.example` with an absolute path to this checkout's `start.mjs`. The Codex plugin configuration lives in `.codex-plugin/`, with marketplace metadata in `.agents/plugins/marketplace.json`. Keep those manifests together. Hook configuration is in `configs/codex/config.toml`; enable and trust hooks in Codex when testing live behavior. Do not replace unrelated user configuration.

Self-upgrade is disabled for this fork. Use a reviewed local checkout; do not overwrite it with an upstream npm install or upgrade command. Packaging and release redesign are outside the source-debloat phase.

## Architecture and contracts

| Path | Responsibility |
|---|---|
| `start.mjs` | Production MCP launcher and workspace provenance |
| `src/server.ts` | MCP tools, request routing and security guards |
| `src/cli.ts` | Codex setup, diagnostics and hook dispatch |
| `src/adapters/codex/` | Codex configuration, paths, hooks and usage |
| `src/util/project-dir.ts` | Trusted project roots and per-thread workspace routing |
| `src/security.ts` | Bash/Read policies and project containment |
| `src/executor.ts`, `src/runtime.ts` | Sandboxed execution and runtime selection |
| `src/store.ts` | Persistent indexed content |
| `src/session/` | SQLite events, snapshots, analytics and continuity |
| `hooks/codex/` | Codex lifecycle and tool hooks |
| `hooks/session-helpers.mjs`, `hooks/session-loaders.mjs` | Shared session storage and loading helpers |
| `hooks/routing-block.mjs` | Context routing instructions |

Codex is the runtime host. `CODEX_HOME` controls native configuration and the default context-mode storage root. Preserve existing explicit storage overrides. Session and content databases persist under that root, with project and thread attribution maintained by the session helpers; they are not disposable temporary indexes.

Requests must keep verified thread identity and workspace attribution. An explicit `CONTEXT_MODE_PROJECT_DIR` pin differs from the launcher's inferred CWD. Missing trustworthy roots must fail closed. Do not reintroduce host detection or process-global workspace routing.

SessionStart restores the session goal and continuity context; PreCompact preserves state for the next context window. Keep resume/compact consumption and event attribution intact. Test the production launcher as well as direct server imports.

### Multi-writer SQLite

SessionDB and ContentStore support simultaneous writers. Write contention uses `withRetry()` and SQLite's `busy_timeout` (30000ms). Do not add exclusive locking or file locks to `SQLiteBase` or `applyWALPragmas`. Keep process-lifecycle coordination separate from database locking. See [the multi-writer ADR](docs/adr/0001-sessiondb-multi-writer.md).

### Security policies

Project-shared context-mode rules live in `.codex/settings.json`; global rules use `$CODEX_HOME/settings.json` (default `~/.codex/settings.json`). This permissions schema is separate from native Codex `config.toml`.

Legacy `.claude/settings.json`, `.claude/settings.local.json` and global Claude policies remain read-only security inputs. Preserve `CLAUDE_CONFIG_DIR` compatibility and explicit policy-path overrides. A deny from any policy wins over an allow. Keep Bash, Read, project-boundary and fail-closed enforcement consistent across MCP tools and Codex hooks.

## Validation

Add regressions to the existing domain test file when possible. Reproduce the defect, verify the intended behavior, and retain security assertions. Do not delete, skip or weaken tests merely to get a green run.

| Concern | Tests |
|---|---|
| Production launcher, Windows multi-repo routing and storage | `tests/integration/codex-launcher-workspace.test.ts`, `tests/integration/codex-workspace-isolation.test.ts` |
| Trusted roots and thread identity | `tests/util/project-dir.test.ts`, `tests/util/codex-session-cwd-resolution.test.ts`, `tests/util/codex-request-context.test.ts` |
| Policy loading and deny enforcement | `tests/security.test.ts`, `tests/core/deny-policy.test.ts`, `tests/hooks/require-security.test.ts` |
| Project containment | `tests/security/project-boundary-852.test.ts` |
| Goal, resume and compact | `tests/hooks/codex-goal-compact.test.ts`, `tests/session/continuity.test.ts`, `tests/session/session-snapshot.test.ts` |
| Windows installation compatibility | `tests/util/postinstall-windows-compat.test.ts` |
| Runtime and manifests | `tests/codex/`, `tests/plugins/codex-manifest.test.ts` |

Run affected tests after rebuilding, then the remaining full suite for wider changes. Report failures, skips and environment limitations explicitly. Shell-specific tests may require their intended runtime; do not silently rewrite their expectations. Check `git diff --check` before submitting.

For changes to indexing or output selection, compare before/after retrieval quality as well as test results. Framework instructions should explain tool use without imposing an unrelated prose style; keep personal style preferences in project instructions.

## Bug reports and pull requests

Include the exact triggering prompt, reproduction steps, OS, Node version, checkout revision and full error output. Use `node "/absolute/path/to/codex-context-mode/cli.bundle.mjs" doctor` or the `ctx_doctor` MCP tool for diagnostics.

Keep pull requests focused and use the existing template. Explain the behavior change and validation performed, including any checks that could not run. Live Codex verification should cover hook trust separately from MCP tool availability.

## Local pilot rollout procedure

This is a procedure for a later explicitly authorized rollout. Building, testing and packing the current checkout do not activate it. Keep the package/plugin identity unchanged and do not publish, install globally or update another checkout.

1. **Freeze the candidate.** Record the fork path, full HEAD, uncommitted diff (if any), package version, Node executable/version and the package dry-run file list. Use Node.js >= 22.5.0. Keep a separate candidate directory containing the reviewed source, all six built bundles, manifests, hooks, skills and locally installed dependencies. A marketplace Git clone does not carry uncommitted changes. Do not edit the candidate while piloting it.
2. **Back up before switching.** Record the currently working MCP launcher path, hook registration/trust state and relevant environment overrides. Stop only the context-mode writers using any storage that will be copied. Back up the current Codex config, hooks and permission files and all effective context-mode storage roots, including explicit overrides. Copy SQLite databases together with any WAL/SHM siblings while writers are stopped. Keep backups local and do not print credential-bearing configuration.
3. **Isolate the pilot.** Prefer a dedicated `CODEX_HOME` and two disposable repositories, leaving production storage untouched. Ensure inherited `CONTEXT_MODE_DIR`/`CONTEXT_MODE_DATA_DIR` or other existing storage overrides do not redirect the pilot into live data. Record their original values for restoration. If testing migrated data, use a stopped, backed-up copy in the pilot root, not the live database.
4. **Pin the candidate.** Merge the standalone examples from `configs/codex/config.toml` and `configs/codex/hooks.json` into the pilot configuration. Replace every example path with the candidate's absolute launcher and direct `hooks/codex/<event>.mjs` paths. The hooks use `node "<absolute script>"`. In PowerShell, pinning Node itself requires the call operator: `& "C:/Program Files/nodejs/node.exe" "C:/.../hooks/codex/<event>.mjs"`; merely quoting both paths produces a parser error before Node starts. MCP `command`/`args` are separate executable/argument fields and do not use this shell prefix. Keep one registration for the pilot, avoiding duplicate plugin and standalone hooks. Enable/trust hooks only for this intended pilot configuration. Preserve unrelated configuration and project instructions.
5. **Smoke-test before normal use.** Run local CLI diagnostics and MCP `ctx_doctor`/`ctx_stats`. Check hook execution separately. In two concurrent Codex threads, index distinct markers from the two scratch repositories and search them; each thread must retrieve only its own repository's marker. Verify missing/unknown thread roots fail closed. Confirm SQLite/content paths are under the pilot `CODEX_HOME` or the deliberately selected storage override, not `.claude` or production storage.
6. **Check security and continuity.** Use harmless fixture files and commands to verify Read/Bash denies from project `.codex` rules and a legacy `.claude` policy, including deny-over-allow behavior. Do not run destructive commands to test a deny. Set a distinct goal in each thread, compact/resume through Codex, and verify attribution, restored goal/state and single-consumption behavior. Record actual results; an available MCP server is not proof of hook trust or successful restore.
7. **Stop or accept deliberately.** Stop the pilot on any workspace, security, storage or continuity failure. A successful pilot still requires explicit authorization before changing a production registration or publishing a release.
8. **Rollback.** Stop the candidate's MCP/hook writers, restore the prior launcher, configuration, trust state and environment values from backup, then restart only the intended prior instance. With isolated pilot storage, leave production databases untouched and retain the pilot for diagnosis. If live storage was deliberately used, restore its stopped backup only after accounting for newer writes from other sessions; do not overwrite concurrent data blindly. Run the same routing, security and resume smoke tests against the restored instance and record the outcome.

The procedure has not been executed merely because repository validation passes. Report Windows/Bash/PowerShell limitations and any untested OS or Bun path separately from rollout readiness.
