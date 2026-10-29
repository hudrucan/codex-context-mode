#!/usr/bin/env node
import { execSync, spawn } from "node:child_process";
import { existsSync, chmodSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const originalCwd = process.cwd();
process.chdir(__dirname);

// Never promote a plugin cache directory into a project root.
const isPluginInstallPath = (p) =>
  /[/\\]\.(claude|codex)[/\\]plugins[/\\](cache|marketplaces)[/\\]/.test(p);
const safeOriginalCwd = isPluginInstallPath(originalCwd) ? null : originalCwd;

// Preserve inferred-CWD provenance across re-exec; request identity wins.
if (!process.env.CONTEXT_MODE_PROJECT_DIR && safeOriginalCwd) {
  process.env.CONTEXT_MODE_PROJECT_DIR = safeOriginalCwd;
  process.env.CONTEXT_MODE_PROJECT_DIR_SOURCE = "cwd";
}

// Codex SessionStart hooks provide routing instructions.

// ── Linux: re-exec with Bun to avoid better-sqlite3 SIGSEGV (#564) ──
// server.bundle.mjs has two SQLite paths: bun:sqlite (safe) or better-sqlite3
// (SIGSEGV on Linux under Node's V8). When invoked via node on Linux, detect
// a Bun installation and re-exec this file under Bun so the bundle takes the
// safe path. No-op when already running under Bun or on non-Linux platforms.
if (typeof globalThis.Bun === "undefined" && process.platform === "linux") {
  const bunCandidates = [
    process.env.BUN_INSTALL ? join(process.env.BUN_INSTALL, "bin", "bun") : null,
    join(homedir(), ".bun", "bin", "bun"),
    "/usr/local/bin/bun",
    "/usr/bin/bun",
  ].filter(Boolean);
  const bunBin = bunCandidates.find((p) => existsSync(p));
  if (bunBin) {
    const child = spawn(bunBin, [fileURLToPath(import.meta.url)], {
      stdio: ["pipe", "inherit", "inherit"],
      env: process.env,
    });
    const _keepAlive = setInterval(() => {}, 2147483647);
    let _escTerm;
    let _escKill;
    let _tearingDown = false;
    // #862: propagate parent death to the Bun child. When the MCP client (e.g.
    // Claude Code) exits, its end of our stdin pipe closes. The original proxy
    // ignored that ("end" was a no-op) and parked forever — so the child was
    // never told the session was gone: its stdin (this pipe) stayed open and its
    // direct parent (us) stayed alive, defeating BOTH paths of the child's
    // lifecycle guard (the stdio-EOF assist AND the ppid poll). The pair
    // orphaned to init and pinned a CPU core indefinitely. We now forward EOF
    // (graceful self-reap via the child's own watchdog), then escalate
    // SIGTERM → SIGKILL so a wedged child can never outlive its client. Still
    // re-execs under Bun first, so #564's SIGSEGV avoidance is untouched.
    const teardown = () => {
      if (_tearingDown) return;
      _tearingDown = true;
      clearInterval(_keepAlive);
      try {
        if (child.stdin && !child.stdin.destroyed) child.stdin.end();
      } catch {}
      // NOT unref'd: these short-lived timers are what hold the event loop
      // open through the teardown window (≤5 s). Liveness must not depend on
      // the top-level `await new Promise()` below surviving a future refactor
      // — if escalation is ever skipped, #862's orphan returns. child.on(
      // "exit") clears both the instant the child reaps cleanly.
      _escTerm = setTimeout(() => {
        try {
          child.kill("SIGTERM");
        } catch {}
      }, 2000);
      _escKill = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
        process.exit(0);
      }, 5000);
    };
    process.stdin.on("data", (chunk) => {
      if (!child.stdin.destroyed) child.stdin.write(chunk);
    });
    // EOF, pipe close, or pipe error all mean the client is gone — tear down.
    process.stdin.on("end", teardown);
    process.stdin.on("close", teardown);
    process.stdin.on("error", teardown);
    child.on("exit", (code) => {
      clearInterval(_keepAlive);
      if (_escTerm) clearTimeout(_escTerm);
      if (_escKill) clearTimeout(_escKill);
      process.exit(code ?? 0);
    });
    // Prevent rest of start.mjs from running — child owns the MCP session.
    process.stdin.resume();
    await new Promise(() => {}); // park until the child exits (see child 'exit')
  }
}

// Ensure native dependencies + ABI compatibility (shared with hooks via ensure-deps.mjs)
// ensure-deps handles better-sqlite3 install + ABI cache/rebuild automatically (#148, #203)
import "./hooks/ensure-deps.mjs";
// Pure-JS runtime deps used only by `ctx_fetch_and_index` (HTML → Markdown
// pipeline runs in a sandboxed subprocess that `require.resolve()`s these at
// call time). Plugin distributions that bypass `npm install` — most notably
// codex's marketplace, which git-clones into `~/.codex/plugins/cache/<pkg>/`
// without installing dependencies — land here with no `node_modules/`.
//
// Before #634: synchronous `execSync("npm install …")` per package
// (turndown + turndown-plugin-gfm + @mixmark-io/domino) blocked MCP boot
// for ~15–25s cold. Codex's per-MCP `startup_timeout_sec` is 30s, so on
// any host where its prewarm + DNS already eats a few seconds the timer
// fires before context-mode replies to `initialize` and the MCP child is
// dropped with "MCP client for `context-mode` timed out after 30 seconds".
//
// Fix: spawn each `npm install` detached + unref'd so it runs in the
// background while the MCP server proceeds with its handshake. The deps
// land asynchronously, well before any LLM-driven `ctx_fetch_and_index`
// call can plausibly fire. If a user invokes that tool faster than the
// install completes, the subprocess's own `require.resolve("turndown")`
// failure surfaces a typed error to the caller — same posture as any
// other missing-runtime-dep situation in that code path.
{
  const NPM_INSTALL_BG_PKGS = ["turndown", "turndown-plugin-gfm", "@mixmark-io/domino"];
  const IS_WIN32 = process.platform === "win32";
  const NPM_BIN = IS_WIN32 ? "npm.cmd" : "npm";
  const NPM_FLAGS = ["--no-package-lock", "--no-save", "--silent", "--no-audit", "--no-fund"];
  // #861: on Windows the npm shim is `npm.cmd`, which needs `shell: true` to
  // run — but Node DROPS the `cwd` option when `shell: true`, so the spawned
  // cmd.exe inherits an arbitrary working dir (C:\Windows under Claude Code).
  // `npm install` then tries to create `C:\Windows\node_modules` → EPERM on
  // every boot, and a cmd.exe window flashes each time. Prefer running npm's
  // own CLI through node directly (no `.cmd` shim, no shell): `shell: false`
  // honors `cwd` and `windowsHide` suppresses the console window. Fall back to
  // the shim only when npm-cli.js can't be located, so a working host (e.g. a
  // POSIX layout where npm-cli.js isn't beside node) can never regress.
  const NPM_CLI_JS = resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const useNodeCli = existsSync(NPM_CLI_JS);
  for (const pkg of NPM_INSTALL_BG_PKGS) {
    if (existsSync(resolve(__dirname, "node_modules", pkg))) continue;
    try {
      const child = useNodeCli
        ? spawn(process.execPath, [NPM_CLI_JS, "install", pkg, ...NPM_FLAGS], {
            cwd: __dirname,
            stdio: "ignore",
            detached: true,
            shell: false,
            windowsHide: true,
          })
        : spawn(NPM_BIN, ["install", pkg, ...NPM_FLAGS], {
            cwd: __dirname,
            stdio: "ignore",
            detached: true,
            // npm on Windows ships as a `.cmd` shim — must go through cmd.exe.
            shell: IS_WIN32,
            windowsHide: true,
          });
      // #861: this EPERM was invisible for months behind stdio:"ignore" + an
      // empty error handler. Surface both spawn failures and non-zero exits.
      child.on("error", (err) => {
        process.stderr.write(
          `[context-mode] background install of ${pkg} failed to spawn: ${err?.message ?? err}\n`,
        );
      });
      child.on("exit", (code) => {
        if (code) {
          process.stderr.write(
            `[context-mode] background install of ${pkg} exited with code ${code}\n`,
          );
        }
      });
      child.unref();
    } catch { /* best effort — never block MCP boot */ }
  }
}

// Self-heal: create CLI shim if cli.bundle.mjs is missing (marketplace installs)
if (!existsSync(resolve(__dirname, "cli.bundle.mjs")) && existsSync(resolve(__dirname, "build", "cli.js"))) {
  const shimPath = resolve(__dirname, "cli.bundle.mjs");
  writeFileSync(shimPath, '#!/usr/bin/env node\nawait import("./build/cli.js");\n');
  if (process.platform !== "win32") chmodSync(shimPath, 0o755);
}

// ── Algo-D4: plugin cache integrity check ──
// Verify boot-critical siblings exist BEFORE importing server.bundle.mjs.
// Without this, a partial install (#550) gives an opaque downstream
// stack trace from `import("./server.bundle.mjs")`. With it, we emit a
// structured CONTEXT_MODE_PARTIAL_INSTALL stderr block + exit 2 so
// external monitoring grep + the user both see the actionable signal.
//
// Runs AFTER the heal layers above so missing files they can fix
// (cli.bundle.mjs shim, dangling symlinks, partial-install copy from
// the marketplace clone) get a chance first. Helper is shared with
// `ctx doctor` (Algo-D5) — single source of truth so boot + diagnostic
// agree byte-for-byte. Skipped under VITEST so the repo's own test
// invocations against in-tree start.mjs don't fail when running before
// `npm run build` produces the bundles.
if (!process.env.VITEST) {
  try {
    const { assertPluginCacheIntegrity, formatPartialInstallReport } =
      await import("./scripts/plugin-cache-integrity.mjs");
    const integrity = assertPluginCacheIntegrity({ pluginRoot: __dirname });
    if (!integrity.ok) {
      process.stderr.write(
        formatPartialInstallReport({
          pluginRoot: __dirname,
          missing: integrity.missing,
        }),
      );
      process.exit(2);
    }
  } catch (err) {
    // The helper itself failing is unexpected — keep boot moving rather
    // than blocking on a check infrastructure bug. The downstream
    // import will still surface the actual missing-bundle error.
    if (process.env.CONTEXT_MODE_DEBUG) {
      process.stderr.write(`[start.mjs] integrity check skipped: ${err}\n`);
    }
  }
}

// Bundle exists (CI-built) — start instantly
if (existsSync(resolve(__dirname, "server.bundle.mjs"))) {
  await import("./server.bundle.mjs");
} else {
  // Dev or npm install — full build
  if (!existsSync(resolve(__dirname, "node_modules"))) {
    try {
      execSync("npm install --silent", { cwd: __dirname, stdio: "pipe", timeout: 60000 });
    } catch { /* best effort */ }
  }
  if (!existsSync(resolve(__dirname, "build", "server.js"))) {
    try {
      execSync("npx tsc --silent", { cwd: __dirname, stdio: "pipe", timeout: 30000 });
    } catch { /* best effort */ }
  }
  await import("./build/server.js");
}
