/** Legacy Claude paths are retained only for deny-policy compatibility. */
import { resolve } from "node:path";
import { homedir } from "node:os";
import { resolveCodexConfigDir } from "../adapters/codex/paths.js";

export function resolveClaudeConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  const envVal = env.CLAUDE_CONFIG_DIR;
  if (envVal && envVal.trim() !== "") {
    if (envVal.startsWith("~")) {
      return resolve(homedir(), envVal.replace(/^~[/\\]?/, ""));
    }
    return resolve(envVal);
  }
  return resolve(homedir(), ".claude");
}

/** Resolve the global settings.json path, honoring CLAUDE_CONFIG_DIR. */
export function resolveClaudeGlobalSettingsPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolve(resolveClaudeConfigDir(env), "settings.json");
}

/** Codex settings plus legacy Claude deny policies, read-only security inputs. */
export function resolveAdapterGlobalSettingsPaths(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const paths = [resolve(resolveCodexConfigDir(env), "settings.json")];

  // Always include claude global  // Always include claude global as fallback (defense in depth).
  const claudePath = resolveClaudeGlobalSettingsPath(env);
  if (!paths.includes(claudePath)) {
    paths.push(claudePath);
  }

  return paths;
}
