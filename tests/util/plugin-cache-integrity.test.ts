import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "../..");

function expectSafeRecovery(text: string) {
  expect(text).toMatch(/back up/i);
  expect(text).toContain("same reviewed local fork revision");
  expect(text).toContain("known-good backup");
  expect(text).toContain("separate candidate directory");
  expect(text).toContain("verify integrity before switching");
  expect(text).toContain("live installation intact for rollback");
  expect(text).not.toMatch(/rm\s+-[a-z]*r[a-z]*f|rmdir\s+\/s|Remove-Item|(?:npm|pnpm|bun)\s+(?:install|add|update)|npx\s+context-mode|git\s+(?:clone|reset|clean)/i);
}

describe("partial-install recovery diagnostics", () => {
  let fixture: string;

  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), "ctx-integrity-recovery-"));
    writeFileSync(join(fixture, "local-fork-marker.txt"), "preserve live checkout");
  });

  afterEach(() => {
    rmSync(fixture, { recursive: true, force: true });
  });

  it("keeps the partial-install marker and missing paths with safe recovery guidance", async () => {
    const helper = await import(pathToFileURL(join(ROOT, "scripts/plugin-cache-integrity.mjs")).href);
    const missing = [join(fixture, "server.bundle.mjs")];
    const report = helper.formatPartialInstallReport({ pluginRoot: fixture, missing });
    expect(report.split("\n")[0]).toBe("CONTEXT_MODE_PARTIAL_INSTALL");
    expect(report).toContain(`  pluginRoot: ${fixture}`);
    expect(report).toContain(`    - ${missing[0]}`);
    expectSafeRecovery(report);
    expect(readFileSync(join(fixture, "local-fork-marker.txt"), "utf8")).toBe("preserve live checkout");
  });

  it("keeps doctor FAIL and critical-file details when the integrity helper is missing", async () => {
    mkdirSync(join(fixture, "build/util"), { recursive: true });
    writeFileSync(join(fixture, "package.json"), JSON.stringify({ type: "module" }));
    const modulePath = join(fixture, "build/util/plugin-cache-integrity.js");
    copyFileSync(join(ROOT, "build/util/plugin-cache-integrity.js"), modulePath);
    const diagnostic = await import(pathToFileURL(modulePath).href);
    await diagnostic.ensurePluginCacheIntegrityLoaded();
    const result = diagnostic.checkPluginCacheIntegritySync(fixture);
    expect(result.status).toBe("FAIL");
    expect(result.detail).toContain("critical launch files missing");
    expect(result.detail).toContain("start.mjs");
    expect(result.detail).toContain("server.bundle.mjs");
    expect(result.detail).toContain("integrity helper also missing");
    expectSafeRecovery(result.detail);
  });

  it("production launcher still exits 2 with a safe partial-install report", () => {
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(join(fixture, "hooks"));
    // Isolate the integrity gate from dependency installation in this partial tree.
    writeFileSync(join(fixture, "hooks/ensure-deps.mjs"), "export {};\n");
    for (const dependency of ["turndown", "turndown-plugin-gfm", "@mixmark-io/domino"]) {
      mkdirSync(join(fixture, "node_modules", dependency), { recursive: true });
    }
    writeFileSync(join(fixture, "package.json"), JSON.stringify({
      type: "module", files: ["start.mjs", "server.bundle.mjs"],
    }));
    copyFileSync(join(ROOT, "start.mjs"), join(fixture, "start.mjs"));
    copyFileSync(join(ROOT, "scripts/plugin-cache-integrity.mjs"), join(fixture, "scripts/plugin-cache-integrity.mjs"));
    const env = { ...process.env };
    delete env.VITEST;
    const result = spawnSync(process.execPath, [join(fixture, "start.mjs")], {
      cwd: fixture, env, encoding: "utf8", timeout: 10_000, windowsHide: true,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("CONTEXT_MODE_PARTIAL_INSTALL");
    expect(result.stderr).toContain(join(fixture, "server.bundle.mjs"));
    expectSafeRecovery(result.stderr);
    expect(readFileSync(join(fixture, "local-fork-marker.txt"), "utf8")).toBe("preserve live checkout");
  });
});
