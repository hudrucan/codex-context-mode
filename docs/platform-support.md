# Codex runtime and OS support

This fork supports Codex only. Removed host adapters, hooks and installation guides are not supported configurations. Historical ADRs retain their original context; external `.claude` permission files are read-only security inputs.

## Runtime requirements

The package requires **Node.js >= 22.5.0**. This floor matches `hasModernSqlite()` and the documentation regressions. A supported Node release with FTS5 is preferred for a local pilot. Bun compatibility remains in the core but has not been validated in this Windows pilot preparation.

| Runtime/backend | Selection |
|---|---|
| Node.js >= 22.5 with usable FTS5 | Built-in `node:sqlite`. |
| Node.js >= 22.5 without usable built-in FTS5 | `better-sqlite3` native fallback. |
| Bun | Existing `bun:sqlite` compatibility path; no new support claim from this phase. |

A Node 18 or Node 20 executable does not meet the package requirement. Do not use an upstream global install as a remedy; update the runtime and rebuild the reviewed local fork.

## Operating systems

| OS | Local requirements and limits |
|---|---|
| Windows | Use quoted absolute paths; forward slashes in TOML/JSON examples. Verify Node after nvm4w changes. Native SQLite repair and nvm4w compatibility regressions remain required. Shell execution may select PowerShell. |
| Linux | Use a supported Node runtime and verify FTS5 with local diagnostics. The native fallback may need a C++ toolchain, Make and Python. |
| macOS | Verify FTS5 and native fallback for the selected Node/architecture combination. The native fallback may require Xcode command-line tools and Python. |

Install dependencies **inside the reviewed checkout** with the pinned package manager. Native binary availability varies by Node ABI, OS and architecture. Do not assume a particular dependency version supplies a working prebuild.

Bash examples require Bash; PowerShell uses different syntax for loops, redirection, environment variables, pipelines and commands. The existing shell regression failures must be reported by test and cause, without skipping them or weakening assertions to obtain a green result.

### Known Windows shell limits

The current `execute_file` shell prelude emits Bash assignments and file loading even when shell detection selects PowerShell. File-content/path aliases therefore do not work reliably in that combination. Use JavaScript for file-processing smoke tests; a rollout requiring shell file processing remains blocked until the runtime issue is addressed separately.

PowerShell command errors can also return a successful process exit code where Bash would return nonzero. Bash-only syntax, POSIX utilities and CRLF-sensitive assertions are separate compatibility concerns. Do not interpret the failing environment-denylist fixtures as proof that environment filtering passed or failed: their Bash syntax prevents the intended assertions from being exercised correctly under PowerShell.

See [README setup](../README.md#install) and [local pilot/rollback procedure](../CONTRIBUTING.md#local-pilot-rollout-procedure). Preparing a candidate does not validate live hook trust, resume behavior or another OS.
