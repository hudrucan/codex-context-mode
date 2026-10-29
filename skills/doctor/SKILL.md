---
name: doctor
description: |
  Run Codex context-mode diagnostics: runtimes, hooks, FTS5 and local installation.
  Trigger: /codex-context-mode:doctor
user-invocable: true
---

# Context Mode Doctor

## Instructions

1. Call the `ctx_doctor` MCP tool and display the actual report. Keep its `[OK]`, `[FAIL]` and `[WARN]` statuses; do not turn an unrun check into PASS.
2. **Fallback** only when the MCP tool is unavailable: derive the plugin root from this skill's location (remove `skills/doctor`). Invoke Node on that root's `cli.bundle.mjs`, or `build/cli.js` if the bundle is absent. Use an argument array rather than shell interpolation:

```javascript
const {existsSync} = require("node:fs");
const {join} = require("node:path");
const {spawnSync} = require("node:child_process");
const pluginRoot = "/absolute/path/to/reviewed/codex-context-mode";
const cli = existsSync(join(pluginRoot, "cli.bundle.mjs"))
  ? join(pluginRoot, "cli.bundle.mjs") : join(pluginRoot, "build/cli.js");
const result = spawnSync(process.execPath, [cli, "doctor"], {encoding: "utf8"});
console.log(result.stdout, result.stderr, "exit:", result.status);
```

3. Report failures and unsupported runtimes. Use Node.js >= 22.5.0 for this fork. Do not follow an upstream global-install remedy or treat disabled update checks as a successful upgrade.
