---
name: search
description: |
  Search codex-context-mode's persistent FTS5 knowledge base for previously indexed
  local project content, documentation, or session memory.
  Trigger: /codex-context-mode:search
user-invocable: true
---

# codex-context-mode search

Search indexed content without rereading raw sources into conversation context.

## Instructions

1. Prefer the `ctx_search` MCP tool when it is available.
2. Batch all related questions in one `queries` array.
3. Scope with `source` when the user names a project or indexed label.
4. Use short, specific queries of two to four technical terms.

```javascript
ctx_search({
  source: "project:<name>",
  queries: ["authentication middleware", "token refresh"],
  limit: 5
})
```

5. If MCP tools are unavailable, derive the plugin root from this skill location and invoke that local CLI bundle:

```bash
node "/absolute/path/to/codex-context-mode/cli.bundle.mjs" search "authentication middleware" --source project:<name> --limit 5
```

6. If the index is empty, tell the user to run `/codex-context-mode:index` or the local CLI index command first.

Use the actual reviewed plugin root; never fall back to a bare global package command or an upstream install.
