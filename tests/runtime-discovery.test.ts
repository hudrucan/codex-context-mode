import { afterEach, describe, expect, test, vi } from "vitest";

const platform = process.platform;
afterEach(() => {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
  vi.unstubAllEnvs();
  vi.doUnmock("node:child_process");
  vi.doUnmock("node:fs");
  vi.resetModules();
});

async function runtime(probe: (command: string) => string) {
  Object.defineProperty(process, "platform", { value: "win32", configurable: true });
  vi.stubEnv("SHELL", "");
  vi.stubEnv("PATHEXT", ".EXE;.CMD;.BAT");
  const execSync = vi.fn(probe);
  vi.doMock("node:child_process", () => ({ execSync, execFileSync: vi.fn() }));
  vi.doMock("node:fs", () => ({ existsSync: (p: string) => String(p) === process.execPath }));
  return { ...await import("../src/runtime.js"), execSync };
}

describe("Windows discovery snapshot", () => {
  test("one lookup retains shim availability, Python validation and non-WSL shell order", async () => {
    const r = await runtime(command => {
      if (command === "where *") return [
        "C:\\npm\\TSX.CMD", "C:\\npm\\dotnet-script.cmd", "C:\\tools\\ruby",
        "C:\\Users\\X\\Microsoft\\WindowsApps\\python3.exe", "C:\\Python\\python3.exe",
        "C:\\Windows\\System32\\bash.exe", "D:\\MSYS\\usr\\bin\\bash.exe",
        "C:\\R\\Rscript.EXE",
        "C:\\libraries\\rustc.dll", "C:\\libraries\\php.txt",
      ].join("\r\n");
      if (command === '"python3" --version') return "Python 3.12.0";
      throw new Error(`Unexpected probe: ${command}`);
    });
    expect(r.detectRuntimes()).toMatchObject({
      javascript: process.execPath, typescript: "tsx", python: "python3",
      shell: "D:\\MSYS\\usr\\bin\\bash.exe", ruby: "ruby", r: "Rscript", csharp: "dotnet-script",
      rust: null, php: null,
    });
    expect(r.execSync.mock.calls.filter(([command]) => command.startsWith("where "))).toHaveLength(1);
  });

  test("Store-only Python aliases are never run; next detection observes new discovery", async () => {
    let generation = 0;
    const r = await runtime(command => {
      if (command === "where *") return generation++ === 0
        ? "C:\\Users\\X\\Microsoft\\WindowsApps\\python3.exe\r\nC:\\tools\\pwsh.exe\r\n"
        : "C:\\tools\\bun.cmd\r\nC:\\tools\\sh.exe\r\n";
      throw new Error(`Unexpected probe: ${command}`);
    });
    const first = r.detectRuntimes(), second = r.detectRuntimes();
    expect(first).toMatchObject({ python: null, shell: "pwsh" });
    expect(second).toMatchObject({ javascript: "bun", typescript: "bun", shell: "sh" });
    const calls = r.execSync.mock.calls.length;
    expect(r.hasBunRuntime(first)).toBe(false);
    expect(r.hasBunRuntime(second)).toBe(true);
    expect(r.execSync).toHaveBeenCalledTimes(calls);
    expect(r.execSync.mock.calls.every(([command]) => command === "where *")).toBe(true);
  });

  test("empty discovery uses normal fallbacks, while unsupported enumeration retains individual probes", async () => {
    let unsupported = false;
    const r = await runtime(command => {
      if (command === "where *") throw Object.assign(new Error("where"), { status: unsupported ? 2 : 1 });
      if (command === "where pwsh") return "C:\\tools\\pwsh.exe\r\n";
      throw new Error("not found");
    });
    expect(r.detectRuntimes()).toMatchObject({ python: null, shell: "cmd.exe", typescript: null });
    expect(r.execSync).toHaveBeenCalledTimes(1);
    unsupported = true;
    expect(r.detectRuntimes().shell).toBe("pwsh");
  });

  test("an unknown PATHEXT retains native per-command availability", async () => {
    const r = await runtime(command => {
      if (command === "where pwsh") return "C:\\tools\\pwsh.exe\r\n";
      throw new Error("not found");
    });
    vi.stubEnv("PATHEXT", "");
    expect(r.detectRuntimes()).toMatchObject({ shell: "pwsh", python: null });
  });
});
