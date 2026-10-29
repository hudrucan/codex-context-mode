/** Shared Codex storage and settings helpers. */
import { join, resolve } from "node:path";
import { accessSync, copyFileSync, constants, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { hashProjectDirCanonical } from "../session/db.js";
import { runtimePaths } from "../runtime-paths.js";

export abstract class BaseAdapter {
  constructor(protected readonly sessionDirSegments: string[]) {}

  getSessionDir(): string {
    const dir = runtimePaths().sessions;
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Native Codex config is independent of context-mode storage overrides. */
  getConfigDir(_projectDir?: string): string {
    return join(homedir(), ...this.sessionDirSegments);
  }

  getInstructionFiles(): string[] {
    return ["AGENTS.md", "AGENTS.override.md"];
  }

  /**
   * Default: <configDir>/memory/<projectHash>. Always absolute (configDir is
   * absolute by contract). Adapters with a different memory dir name (e.g.,
   * codex uses "memories" plural) override this.
   *
   * Issue #663: when `projectDir` is supplied the path is scoped via
   * `hashProjectDirCanonical(projectDir)` so two projects running in
   * parallel never share auto-memory contents. When omitted (legacy
   * callers), the unscoped path is returned for backwards compatibility.
   */
  getMemoryDir(projectDir?: string): string {
    const base = runtimePaths().memory;
    if (!projectDir) return base;
    return join(base, hashProjectDirCanonical(projectDir));
  }

  backupSettings(): string | null {
    const settingsPath = this.getSettingsPath();
    try {
      accessSync(settingsPath, constants.R_OK);
      const backupPath = settingsPath + ".bak";
      copyFileSync(settingsPath, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  abstract getSettingsPath(): string;
}
