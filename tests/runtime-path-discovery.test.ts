import { afterEach, expect, test, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectRuntimes } from "../src/runtime.js";

const roots: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const p of roots.splice(0)) rmSync(p, { recursive: true, force: true }); });

test.skipIf(process.platform !== "win32")("wildcard discovery agrees with per-command where and refreshes PATH contents", () => {
  const root = mkdtempSync(join(tmpdir(), "ctx-discovery-")); roots.push(root);
  const first = join(root, "first path"), second = join(root, "second");
  mkdirSync(first); mkdirSync(second);
  writeFileSync(join(first, "RUBY.CMD"), "@echo off\r\necho ruby\r\n");
  writeFileSync(join(first, "python.cmd"), "@echo off\r\necho Python 3.12.0\r\n");
  writeFileSync(join(second, "dotnet-script.EXE"), "fixture");
  mkdirSync(join(second, "go.exe")); // where excludes directories.
  const system32 = join(process.env.SystemRoot!, "System32");
  vi.stubEnv("PATH", first + ";;" + second + ";" + system32);
  vi.stubEnv("PATHEXT", ".EXE;.CMD");
  vi.stubEnv("SHELL", "");
  const where = join(system32, "where.exe");
  for (const path of [first + ";;" + second + ";" + system32, '"' + first + '";' + second + ";" + system32]) {
    vi.stubEnv("PATH", path);
    const runtimes = detectRuntimes();
    for (const [key, command] of [["ruby", "ruby"], ["go", "go"], ["csharp", "dotnet-script"]] as const) {
      let found = false;
      try { found = !!String(execFileSync(where, [command], { stdio: "pipe" })).trim(); } catch {}
      expect(runtimes[key] !== null, `${path}: ${command}`).toBe(found);
    }
    expect(runtimes.python).toBe(path.startsWith('"') ? null : "python");
  }
  vi.stubEnv("PATH", first + ";" + system32);
  expect(detectRuntimes().rust).toBeNull();
  writeFileSync(join(first, "rustc"), "fixture");
  expect(detectRuntimes().rust).toBe("rustc");
  rmSync(join(first, "rustc"));
  expect(detectRuntimes().rust).toBeNull();
});
