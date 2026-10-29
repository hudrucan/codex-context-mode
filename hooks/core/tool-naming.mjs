

/** Codex exposes bare context-mode tool names. */
export function getToolName(platform, bareTool) {
  return bareTool;
}

/**
 * Create a namer function bound to a specific platform.
 * Returns (bareTool) => platformSpecificToolName.
 */
export function createToolNamer(platform) {
  return (bareTool) => getToolName(platform, bareTool);
}

/** List of all known platform IDs. */
export const KNOWN_PLATFORMS = ["codex"];
