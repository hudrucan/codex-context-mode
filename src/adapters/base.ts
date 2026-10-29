/** Shared Codex storage and settings helpers. */
import { join, resolve } from "node:path";
import { accessSync, copyFileSync, constants, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { hashProjectDirCanonical } from "../session/db.js";

/**
 * Universal storage-root override. Returns the resolved absolute path when
 * `CONTEXT_MODE_DATA_DIR` is set to a non-blank value, otherwise `null` so
 * callers fall back to their platform-native default.
 *
 * Mirrors the `resolveClaudeConfigDir` contract for env-var handling
 * (whitespace guard, tilde expansion, relative-path resolution) so users
 * get one consistent set of rules across every override site.
 */
export function resolveContextModeDataRoot(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.CONTEXT_MODE_DATA_DIR;
  if (!raw || raw.trim() === "") return null;
  if (raw.startsWith("~")) {
    return resolve(homedir(), raw.replace(/^~[/\\]?/, ""));
  }
  return resolve(raw);
}

export abstract class BaseAdapter {
  constructor(protected readonly sessionDirSegments: string[]) {}

  getSessionDir(): string {
    const override = resolveContextModeDataRoot();
    const dir = override
      ? join(override, "context-mode", "sessions")
      : join(homedir(), ...this.sessionDirSegments, "context-mode", "sessions");
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
   * Issue #649: when `CONTEXT_MODE_DATA_DIR` is set, memory follows storage
   * to `<DATA_DIR>/context-mode/memory/` since persistent memory is
   * context-mode-owned state, not platform-native config.
   *
   * Issue #663: when `projectDir` is supplied the path is scoped via
   * `hashProjectDirCanonical(projectDir)` so two projects running in
   * parallel never share auto-memory contents. When omitted (legacy
   * callers), the unscoped path is returned for backwards compatibility.
   */
  getMemoryDir(projectDir?: string): string {
    const override = resolveContextModeDataRoot();
    const base = override
      ? join(override, "context-mode", "memory")
      : join(this.getConfigDir(), "memory");
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
