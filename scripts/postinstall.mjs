/** Install native dependencies without modifying other agents' configuration. */
import { dirname, resolve, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { healBetterSqlite3Binding } from "./heal-better-sqlite3.mjs";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

{
  const isLinux = process.platform === "linux";
  const hasBun =
    typeof globalThis.Bun !== "undefined" ||
    typeof process.versions.bun === "string";
  const [majStr, minStr] = (process.versions.node ?? "0.0.0").split(".");
  const major = Number(majStr);
  const minor = Number(minStr);
  const hasModernNode =
    Number.isFinite(major) &&
    Number.isFinite(minor) &&
    (major > 22 || (major === 22 && minor >= 5));
  if (isLinux && !hasBun && !hasModernNode) {
    process.stderr.write(
      "\n" +
      "context-mode: install aborted\n" +
      "  Linux + Node " + (process.versions.node ?? "?") + " is unsupported.\n" +
      "  context-mode requires Node.js >= 22.5 (or Bun) on Linux to avoid the\n" +
      "  V8 madvise(MADV_DONTNEED) SIGSEGV affecting better-sqlite3 (1-4/hour).\n" +
      "  Tracking: https://github.com/nodejs/node/issues/62515\n" +
      "           https://github.com/mksglu/context-mode/issues/564\n" +
      "\n" +
      "  Fix: upgrade Node (recommended)\n" +
      "    nvm install 22.5 && nvm use 22.5\n" +
      "\n" +
      "  Or: run under Bun\n" +
      "    curl -fsSL https://bun.sh/install | bash\n" +
      "    bun add -g context-mode\n" +
      "\n",
    );
    process.exit(1);
  }
}


// Repair nvm4w npm shims before resolving native dependency installers.
function isSafeWindowsPath(p) {
  return !/[&|<>"^%\r\n]/.test(p);
}

if (process.platform === "win32" && process.env.npm_config_global === "true") {
  try {
    // npm prefix is where both the .cmd shims and node_modules live
    // Use npm_config_prefix env (set during install) or fall back to `npm config get prefix`
    // Note: `npm bin -g` was removed in npm v9+, so we use prefix instead
    const prefix = (
      process.env.npm_config_prefix ||
      execSync("npm config get prefix", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim()
    );

    const actualPkgDir = pkgRoot;

    // npm's .cmd shim uses %~dp0\node_modules\<pkg>\... to find the entry point.
    // On nvm4w, stale shims at C:\nvm4w\nodejs\ may exist alongside correct ones
    // at the npm prefix. We create junctions at ALL known shim locations.
    const shimDirs = new Set([prefix]);

    // Detect stale shim locations via `where` command
    try {
      const whereOutput = execSync("where context-mode.cmd", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      for (const line of whereOutput.split(/\r?\n/)) {
        if (line.endsWith("context-mode.cmd")) {
          shimDirs.add(dirname(line));
        }
      }
    } catch { /* where may fail if not installed yet */ }

    for (const shimDir of shimDirs) {
      const expectedPkgDir = join(shimDir, "node_modules", "context-mode");

      if (
        resolve(expectedPkgDir).toLowerCase() !== resolve(actualPkgDir).toLowerCase() &&
        !existsSync(expectedPkgDir)
      ) {
        const expectedNodeModules = join(shimDir, "node_modules");
        if (!existsSync(expectedNodeModules)) {
          mkdirSync(expectedNodeModules, { recursive: true });
        }

        // Create directory junction (no admin privileges needed on Windows 10+)
        // Validate paths to prevent cmd.exe injection via shell metacharacters
        if (!isSafeWindowsPath(expectedPkgDir) || !isSafeWindowsPath(actualPkgDir)) {
          console.warn(`  context-mode: skipping junction — path contains unsafe characters`);
        } else {
          execSync(`mklink /J "${expectedPkgDir}" "${actualPkgDir}"`, {
            shell: "cmd.exe",
            stdio: "pipe",
          });
          console.log(`\n  context-mode: created junction for nvm4w compatibility`);
          console.log(`    ${expectedPkgDir} → ${actualPkgDir}\n`);
        }
      }
    }

    // Also fix stale shims that reference old bin entry (build/cli.js → cli.bundle.mjs)
    try {
      const whereOutput = execSync("where context-mode.cmd", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      for (const line of whereOutput.split(/\r?\n/)) {
        if (line.endsWith("context-mode.cmd")) {
          const content = readFileSync(line, "utf-8");
          if (content.includes("build\\cli.js") || content.includes("build/cli.js")) {
            // Rewrite stale shim to use cli.bundle.mjs
            const fixed = content
              .replace(/build[\\\/]cli\.js/g, "cli.bundle.mjs");
            writeFileSync(line, fixed);
            console.log(`  context-mode: fixed stale shim at ${line}`);
          }
        }
      }
    } catch { /* best effort */ }
  } catch {
    // Best effort — don't block install. User can use npx as fallback.
  }
}

try { healBetterSqlite3Binding(pkgRoot); } catch { /* best effort — dependency errors surface on use */ }
