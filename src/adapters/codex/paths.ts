import { homedir } from "node:os";
import { resolve } from "node:path";

export function resolveCodexConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  const envVal = env.CODEX_HOME;
  if (envVal && envVal.trim() !== "") {
    if (envVal.startsWith("~")) {
      return resolve(homedir(), envVal.replace(/^~[/\\]?/, ""));
    }
    return resolve(envVal);
  }
  return resolve(homedir(), ".codex");
}
