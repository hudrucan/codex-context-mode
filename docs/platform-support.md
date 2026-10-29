# Codex runtime and OS support

This plugin uses Node.js >=22.5 with SQLite FTS5. Node 24 is recommended and is the runtime validated on Windows. The distributable contains prebuilt JavaScript bundles and does not require node_modules at startup. It never installs or repairs dependencies automatically. If the selected Node build lacks SQLite/FTS5, use a supported runtime with those capabilities and run doctor.

The runtime root defaults to ~/.codex-context-mode/ on Windows, macOS and Linux. Native Codex configuration remains in CODEX_HOME (normally ~/.codex/). Code installation directories contain assets only. An absolute CODEX_CONTEXT_MODE_HOME can redirect mutable state for isolated testing.

Hook commands use Node with a quoted plugin-relative script path. Windows paths with spaces are exercised through PowerShell; an explicitly pinned quoted Node executable in a manually constructed command requires PowerShell's & operator. The shipped manifest uses the bare Node command and a quoted script argument.

Cross-platform path construction uses Node path/os APIs. Linux and macOS native lifecycle execution must be reported separately when not run; Windows results do not establish native behavior on other operating systems.

Execution code retains the existing shell selection and security rules. Bash-only snippets and tools are not automatically translated to PowerShell; prefer JavaScript when the requested analysis is platform-independent.

See [installation and trust](../README.md#build-and-install). Codex owns install/enable/update/uninstall and hook trust. Never substitute standalone registrations or an upstream installation.
