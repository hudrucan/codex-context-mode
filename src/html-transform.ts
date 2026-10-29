// Build-time dependency bundling: clean plugin installs need no node_modules.
import TurndownService from "turndown";
// @ts-expect-error upstream package does not publish declarations
import { gfm } from "turndown-plugin-gfm";
export { TurndownService, gfm };
