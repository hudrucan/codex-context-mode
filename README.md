# Context Mode

This fork supports **Codex only**. Self-upgrade is disabled in the CLI and MCP; use a reviewed local checkout/release. Other agent integrations have been removed. Packaging, branding and release redesign are deferred to Phase C.

**The other half of the context problem.**

[![users](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fcdn.jsdelivr.net%2Fgh%2Fmksglu%2Fcontext-mode%40main%2Fstats.json&query=%24.message&label=users&color=brightgreen)](https://www.npmjs.com/package/context-mode) [![npm](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fcdn.jsdelivr.net%2Fgh%2Fmksglu%2Fcontext-mode%40main%2Fstats.json&query=%24.npm&label=npm&color=blue)](https://www.npmjs.com/package/context-mode) [![marketplace](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fcdn.jsdelivr.net%2Fgh%2Fmksglu%2Fcontext-mode%40main%2Fstats.json&query=%24.marketplace&label=marketplace&color=blue)](https://github.com/mksglu/context-mode) [![GitHub stars](https://img.shields.io/github/stars/mksglu/context-mode?style=flat&color=yellow)](https://github.com/mksglu/context-mode/stargazers) [![GitHub forks](https://img.shields.io/github/forks/mksglu/context-mode?style=flat&color=blue)](https://github.com/mksglu/context-mode/network/members) [![Last commit](https://img.shields.io/github/last-commit/mksglu/context-mode?color=green)](https://github.com/mksglu/context-mode/commits) [![License: ELv2](https://img.shields.io/badge/License-ELv2-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/1478479412700909750?label=Discord&logo=discord&color=5865f2)](https://discord.gg/DCN9jUgN5v)
[![Hacker News #1](https://img.shields.io/badge/Hacker%20News-%231%20%E2%80%A2%20570%2B%20points-ff6600?logo=ycombinator&logoColor=white)](https://news.ycombinator.com/item?id=47193064)

<p align="center">
<sub>Used across teams at</sub>
<br><br>
<a href="#"><img src="https://img.shields.io/badge/Microsoft-141414?style=flat" alt="Microsoft" /></a>
<a href="#"><img src="https://img.shields.io/badge/Google-141414?style=flat&logo=google&logoColor=white" alt="Google" /></a>
<a href="#"><img src="https://img.shields.io/badge/Meta-141414?style=flat&logo=meta&logoColor=white" alt="Meta" /></a>
<a href="#"><img src="https://img.shields.io/badge/Amazon-141414?style=flat" alt="Amazon" /></a>
<a href="#"><img src="https://img.shields.io/badge/IBM-141414?style=flat" alt="IBM" /></a>
<a href="#"><img src="https://img.shields.io/badge/NVIDIA-141414?style=flat&logo=nvidia&logoColor=white" alt="NVIDIA" /></a>
<a href="#"><img src="https://img.shields.io/badge/ByteDance-141414?style=flat&logo=bytedance&logoColor=white" alt="ByteDance" /></a>
<a href="#"><img src="https://img.shields.io/badge/Stripe-141414?style=flat&logo=stripe&logoColor=white" alt="Stripe" /></a>
<a href="#"><img src="https://img.shields.io/badge/Datadog-141414?style=flat&logo=datadog&logoColor=white" alt="Datadog" /></a>
<a href="#"><img src="https://img.shields.io/badge/Salesforce-141414?style=flat" alt="Salesforce" /></a>
<a href="#"><img src="https://img.shields.io/badge/GitHub-141414?style=flat&logo=github&logoColor=white" alt="GitHub" /></a>
<a href="#"><img src="https://img.shields.io/badge/Red%20Hat-141414?style=flat&logo=redhat&logoColor=white" alt="Red Hat" /></a>
<a href="#"><img src="https://img.shields.io/badge/Supabase-141414?style=flat&logo=supabase&logoColor=white" alt="Supabase" /></a>
<a href="#"><img src="https://img.shields.io/badge/Canva-141414?style=flat" alt="Canva" /></a>
<a href="#"><img src="https://img.shields.io/badge/Notion-141414?style=flat&logo=notion&logoColor=white" alt="Notion" /></a>
<a href="#"><img src="https://img.shields.io/badge/Hasura-141414?style=flat&logo=hasura&logoColor=white" alt="Hasura" /></a>
<a href="#"><img src="https://img.shields.io/badge/Framer-141414?style=flat&logo=framer&logoColor=white" alt="Framer" /></a>
<a href="#"><img src="https://img.shields.io/badge/Cursor-141414?style=flat&logo=cursor&logoColor=white" alt="Cursor" /></a>
</p>

## The Problem

Every MCP tool call dumps raw data into your context window. A Playwright snapshot costs 56 KB. Twenty GitHub issues cost 59 KB. One access log — 45 KB. After 30 minutes, 40% of your context is gone. And when the agent compacts the conversation to free space, it forgets which files it was editing, what tasks are in progress, and what you last asked for. On top of that, the agent wastes output tokens on filler, pleasantries, and verbose explanations — burning context from both sides.

### How Context Mode Solves It

Context Mode is an MCP server that solves all four sides of this problem:

1. **Context Saving** — Sandbox tools keep raw data out of the context window. 315 KB becomes 5.4 KB. 98% reduction.
2. **Session Continuity** — Every file edit, git operation, task, error, and user decision is tracked in SQLite. When the conversation compacts, context-mode doesn't dump this data back into context — it indexes events into FTS5 and retrieves only what's relevant via BM25 search. The model picks up exactly where you left off. If you don't `--continue`, previous session data is deleted immediately — a fresh session means a clean slate.
3. **Think in Code** — The LLM should program the analysis, not compute it. Instead of reading 50 files into context to count functions, the agent writes a script that does the counting and `console.log()`s only the result. One script replaces ten tool calls and saves 100x context. This is a mandatory paradigm for Codex: stop treating the LLM as a data processor, treat it as a code generator.

   ```js
   // Before: 47 × Read() = 700 KB.  After: 1 × ctx_execute() = 3.6 KB.
   ctx_execute("javascript", `
     const files = fs.readdirSync('src').filter(f => f.endsWith('.ts'));
     files.forEach(f => console.log(f + ': ' + fs.readFileSync('src/'+f,'utf8').split('\\n').length + ' lines'));
   `);
   ```
4. **No prose-style enforcement** — context-mode keeps raw data out of context but never dictates how the model writes its final answer. Brevity, completeness, formatting — your model's call (or yours via your own `CLAUDE.md` / `AGENTS.md`). Aggressive brevity prompts have been shown to degrade coding/reasoning benchmarks ([Moonshot AI on `kimi-k2.5`](https://github.com/anomalyco/opencode/issues/20258)) — the routing block stays focused on *where data goes*, not on *how the model talks*.

<a href="https://www.youtube.com/watch?v=QUHrntlfPo4">
  <picture>
    <img src="https://img.youtube.com/vi/QUHrntlfPo4/maxresdefault.jpg" alt="Watch context-mode demo on YouTube" width="100%">
  </picture>
</a>
<p align="center"><a href="https://www.youtube.com/watch?v=QUHrntlfPo4"><img src="https://img.shields.io/badge/%E2%96%B6%EF%B8%8F_Watch_Demo-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch on YouTube"></a></p>

## Install

Use the reviewed local checkout. Do not install an upstream npm release over this fork. Node.js >= 22.5 is required; native SQLite may require the build prerequisites below.

Build locally with the package-manager version pinned in package.json:

```sh
corepack pnpm install
corepack pnpm run build
```

For the Codex plugin, keep .codex-plugin/ and .agents/plugins/marketplace.json together with the runtime. Enable and trust hooks using the Codex plugin UI. The checked-in manifests provide MCP, skills and hooks.

For standalone MCP, copy the shape in .mcp.json.codex.example and set its absolute start.mjs path. Manual CLI configuration is in configs/codex/config.toml; hook commands use context-mode hook codex <event>.

Example manual PreToolUse entry (inside the hooks object):

```json
{"PreToolUse":[{"matcher":"local_shell|shell|shell_command|exec_command|Bash|Shell|apply_patch|Edit|Write|grep_files|ctx_execute|ctx_execute_file|ctx_batch_execute|ctx_fetch_and_index|ctx_search|ctx_index|mcp__","hooks":[{"type":"command","command":"context-mode hook codex pretooluse"}]}]}
```

CODEX_HOME controls native config and the default context-mode storage root. MCP requests route by verified thread identity; CONTEXT_MODE_PROJECT_DIR may explicitly pin a workspace when no transcript is available. The launcher-derived CWD is not an explicit pin. Missing trustworthy roots fail closed.

Keep existing AGENTS.md rules when incorporating configs/codex/AGENTS.md. Verify MCP with ctx stats and verify hook trust/execution separately.

<details>
<summary><strong>Build Prerequisites</strong> <sup>(CentOS, RHEL, Alpine)</sup></summary>

Context Mode uses [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) on Node.js, which ships prebuilt native binaries for most platforms. On glibc >= 2.31 systems (Ubuntu 20.04+, Debian 11+, Fedora 34+, macOS, Windows), `npm install` works without any build tools.

**Linux + Node.js >= 22.5:** Context Mode automatically uses the built-in `node:sqlite` module instead of `better-sqlite3`. This eliminates the native addon entirely, avoiding [sporadic SIGSEGV crashes](https://github.com/nodejs/node/issues/62515) caused by V8's `madvise(MADV_DONTNEED)` corrupting the addon's `.got.plt` section on Linux. No configuration needed — detection is automatic. **Linux + Node < 22.5 is unsupported** ([#564](https://github.com/mksglu/context-mode/issues/564)) — `npm install` will fail with remediation instructions.

**Bun users:** No native compilation needed. Context Mode automatically detects Bun and uses the built-in `bun:sqlite` module via a compatibility adapter. `better-sqlite3` and all its build dependencies are skipped entirely.

On older glibc systems (CentOS 7/8, RHEL 8, Debian 10), prebuilt binaries don't load and better-sqlite3 **automatically falls back to compiling from source** via `prebuild-install || node-gyp rebuild --release`. This requires a C++20 compiler (GCC 10+), Make, and Python with setuptools.

**Windows / missing binding self-heal:** if `better_sqlite3.node` ends up missing after install (e.g. `prebuild-install` not on cmd.exe PATH, no MSVC toolchain), the postinstall script and the runtime hook automatically re-fetch the prebuild and repair the binding — no manual `npm rebuild` needed (#408).

**CentOS 8 / RHEL 8** (glibc 2.28):

```bash
dnf install -y gcc-toolset-10-gcc gcc-toolset-10-gcc-c++ make python3 python3-setuptools
scl enable gcc-toolset-10 'npm install -g context-mode'
```

**CentOS 7 / RHEL 7** (glibc 2.17):

```bash
yum install -y centos-release-scl
yum install -y devtoolset-10-gcc devtoolset-10-gcc-c++ make python3
pip3 install setuptools
scl enable devtoolset-10 'npm install -g context-mode'
```

**Alpine Linux:**

Alpine prebuilt binaries (musl) are available in better-sqlite3 v12.8.0+. With the `^12.6.2` dependency range, `npm install` resolves to the latest 12.x and works without build tools on Alpine. If you pin an older version:

```bash
apk add build-base python3 py3-setuptools
npm install -g context-mode
```

</details>

## Tools

| Tool | What it does | Context saved |
|---|---|---|
| `ctx_batch_execute` | Run multiple commands + search multiple queries in ONE call. Opt-in `concurrency: 1-8` for I/O-bound batches. | 986 KB → 62 KB |
| `ctx_execute` | Run code in 12 languages. Only stdout enters context. | 56 KB → 299 B |
| `ctx_execute_file` | Process files in sandbox. Raw content never leaves. | 45 KB → 155 B |
| `ctx_index` | Chunk markdown into FTS5 with BM25 ranking. | 60 KB → 40 B |
| `ctx_search` | Query indexed content with multiple queries in one call. | On-demand retrieval |
| `ctx_fetch_and_index` | Fetch URL, chunk and index. Cache reuses content within TTL (default 24h, override per-call with `ttl: <ms>`). `ttl: 0` or `force: true` to bypass. Pass `requests: [{url, source}, ...]` + `concurrency: 1-8` for parallel multi-URL. | 60 KB → 40 B |
| `ctx_stats` | Show context savings, call counts, and session statistics. | — |
| `ctx_doctor` | Diagnose installation: runtimes, hooks, FTS5, versions. | — |
| `ctx_upgrade` | Upgrade to latest version from GitHub, rebuild, reconfigure hooks. | — |
| `ctx_purge` | Permanently deletes all indexed content from the knowledge base. | — |

## How the Sandbox Works

Each `ctx_execute` call spawns an isolated subprocess with its own process boundary. Scripts can't access each other's memory or state. The subprocess runs your code, captures stdout, and only that stdout enters the conversation context. The raw data — log files, API responses, snapshots — never leaves the sandbox.

Twelve language runtimes are available: JavaScript, TypeScript, Python, Shell, Ruby, Go, Rust, PHP, Perl, R, Elixir, and C#. Bun is auto-detected for 3-5x faster JS/TS execution.

Authenticated CLIs work through credential passthrough — `gh`, `aws`, `gcloud`, `kubectl`, `docker` inherit environment variables and config paths without exposing them to the conversation.

When output exceeds 5 KB and an `intent` is provided, Context Mode switches to intent-driven filtering: it indexes the full output into the knowledge base, searches for sections matching your intent, and returns only the relevant matches with a vocabulary of searchable terms for follow-up queries.

## How the Knowledge Base Works

The `ctx_index` tool chunks markdown content by headings while keeping code blocks intact, then stores them in a **SQLite FTS5** (Full-Text Search 5) virtual table. The SQLite backend is selected automatically at runtime: `bun:sqlite` on Bun, `node:sqlite` on Node.js >= 22.5, and `better-sqlite3` everywhere else. Search uses **BM25 ranking** — a probabilistic relevance algorithm that scores documents based on term frequency, inverse document frequency, and document length normalization. **Porter stemming** is applied at index time so "running", "runs", and "ran" match the same stem. Titles and headings are weighted **5x** in BM25 scoring for precise navigational queries.

When you call `ctx_search`, it returns relevant content snippets focused around matching query terms — not full documents, not approximations, the actual indexed content with smart extraction around what you're looking for. `ctx_fetch_and_index` extends this to URLs: fetch, convert HTML to markdown, chunk, index. The raw page never enters context. Use the `contentType` parameter to filter results by type (e.g. `code` or `prose`).

### Ranking: Reciprocal Rank Fusion

Search runs two parallel strategies and merges them with **Reciprocal Rank Fusion (RRF)**:

- **Porter stemming** — FTS5 MATCH with porter tokenizer. "caching" matches "cached", "caches", "cach".
- **Trigram substring** — FTS5 trigram tokenizer matches partial strings. "useEff" finds "useEffect", "authenticat" finds "authentication".

RRF merges both ranked lists into a single result set, so a document that ranks well in both strategies surfaces higher than one that ranks well in only one. This replaces the old cascading fallback approach where trigram results were only used if porter returned nothing.

### Proximity Reranking

Multi-term queries get an additional reranking pass. Results where query terms appear close together are boosted — `"session continuity"` ranks passages with adjacent terms higher than pages where "session" and "continuity" appear paragraphs apart.

### Fuzzy Correction

Levenshtein distance corrects typos before re-searching. "kuberntes" becomes "kubernetes", "autentication" becomes "authentication".

### Smart Snippets

Search results use intelligent extraction instead of truncation. Instead of returning the first N characters (which might miss the important part), Context Mode finds where your query terms appear in the content and returns windows around those matches.

### TTL Cache

Indexed content persists in a per-project SQLite database at `~/.context-mode/content/`. When `ctx_fetch_and_index` is called for a URL that was already indexed within its TTL window, the fetch is skipped entirely and the model searches the existing index directly.

- **Default TTL:** 24 hours. Override per-call with `ttl: <milliseconds>` (PR #666). Longer for stable specs, shorter for changelogs you want re-checked often.
- **Cache hit (within TTL):** Returns a cache hint (~0.3KB) instead of re-fetching (48KB+). Model proceeds to `ctx_search`.
- **Cache miss (TTL expired):** Re-fetches silently. No user action needed.
- **`ttl: 0`** or **`force: true`:** Bypasses cache and re-fetches regardless of freshness.
- **14-day cleanup:** Content databases and sources older than 14 days are removed on startup.

This means `--continue` sessions preserve indexed docs across restarts. No re-fetching, no wasted context tokens.

`ctx_stats` reports cache performance separately: hits, data avoided, network requests saved, and total context savings including cache.

### Progressive Throttling

- **Calls 1-3:** Normal results (2 per query)
- **Calls 4-8:** Reduced results (1 per query) + warning
- **Calls 9+:** Blocked — redirects to `ctx_batch_execute`

## Session Continuity

When the context window fills up, the agent compacts the conversation — dropping older messages to make room. Without session tracking, the model forgets which files it was editing, what tasks are in progress, what errors were resolved, and what you last asked for.

Context Mode captures every meaningful event during your session and persists them in a per-project SQLite database. When the conversation compacts (or you resume with `--continue`, `--resume`, or `/resume`), your working state is rebuilt automatically — the model continues from your last prompt without asking you to repeat anything.

> Resuming a non-latest session via `/resume <picker>` works the same way: the SessionStart hook detects the empty live-event table for the freshly issued session id and falls back to the most recent unconsumed snapshot for the project (`session_resume` table). The picker selects the conversation; context-mode rehydrates the prior working state.

Session continuity requires 5 hooks working together:

| Hook | Role | Claude Code | Gemini CLI | VS Code Copilot | JetBrains Copilot | GitHub Copilot CLI | Cursor | OpenCode | KiloCode | OpenClaw | Codex CLI | Antigravity | Antigravity CLI (`agy`) | Kiro | Zed | Pi | OMP |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **PreToolUse** | Enforces sandbox routing before tool execution | Yes | -- | -- | -- | Yes | Yes | -- | -- | -- | Yes | -- | Bounded | Yes | -- | ✓ (via tool_call event) | ✓ (via tool_call event) |
| **PostToolUse** | Captures events after each tool call | Yes | Yes | Yes | Yes | Yes | Yes | Plugin | Plugin | Plugin | Yes | -- | Yes (capture-only) | Yes | -- | ✓ (via tool_result event) | ✓ (via tool_result event) |
| **UserPromptSubmit** | Captures user decisions and corrections | Yes | -- | -- | -- | Yes | -- | Plugin (via chat.message) | Plugin (via chat.message) | -- | Yes | -- | -- | -- | -- | -- | -- |
| **Stop** | Captures assistant turn-end state | Yes | -- | -- | -- | Yes | Yes | -- | -- | -- | Yes | -- | Best-effort | -- | -- | -- | -- |
| **PreCompact** | Builds snapshot before compaction | Yes | Yes | Yes | Yes | Yes | -- | Plugin | Plugin | Plugin | Yes | -- | -- | -- | -- | ✓ (via session_before_compact) | ✓ (via session_before_compact) |
| **SessionStart** | Restores state after compaction or resume | Yes | Yes | Yes | Yes | Yes | -- | ✓ (via experimental.chat.system.transform) | ✓ (via experimental.chat.system.transform) | Plugin | Yes | -- | -- | -- | -- | ✓ (via session_start event) | ✓ (via session_start event) |
| | **Session completeness** | **Full** | **High** | **High** | **High** | **High** | **Partial** | **Full** | **Full** | **High** | **Partial** | **--** | **Partial** | **Partial** | **--** | **High** | **High** |

> **Note:** Full session continuity (capture + snapshot + restore) works on **Claude Code**, **Gemini CLI**, **VS Code Copilot**, **JetBrains Copilot**, **OpenCode**, and **KiloCode**. **GitHub Copilot CLI** uses its own camelCase hook config keys (`preToolUse`, `postToolUse`, `preCompact`, `sessionStart`, `userPromptSubmitted`, `agentStop`) and top-level hook responses; it captures prompt, tool, compaction, session-start, and stop events when the plugin hooks are installed. **OpenCode** and **KiloCode** use `experimental.chat.system.transform` as a SessionStart surrogate to inject the routing block and restore prior sessions, plus `chat.message` for user-prompt capture; full SessionStart hook support is not yet available ([#14808](https://github.com/sst/opencode/issues/14808), [#5409](https://github.com/sst/opencode/issues/5409)), but prior-session continuity and user-decision capture work fully. **Cursor** captures tool events via `preToolUse`/`postToolUse`, but `sessionStart` is currently rejected by Cursor's validator ([forum report](https://forum.cursor.com/t/unknown-hook-type-sessionstart/149566)), so session restore after compaction is not available yet. **OpenClaw** uses native gateway plugin hooks (`api.on()`) for full session continuity. **Pi Coding Agent** provides high session continuity via extension hooks (`tool_call`, `tool_result`, `session_start`, `session_before_compact`). **Codex CLI** provides partial hook-based session tracking through PreToolUse, PostToolUse, PreCompact, SessionStart, UserPromptSubmit, and Stop; MCP tools work. **Antigravity IDE** and **Zed** have no hook support in the current release, so session tracking is not available there. **Antigravity CLI (`agy`)** is separate from the IDE and supports bounded `PreToolUse`, capture-only `PostToolUse`, and best-effort `Stop` through its plugin hooks. **Kiro** captures tool events via native `preToolUse`/`postToolUse` hooks, but its SessionStart equivalent (`agentSpawn`) is not yet wired, so session restore after compaction is unavailable. **OMP** (Oh My Pi) ships full plugin-based hook support — `omp plugin install context-mode` registers `tool_call`, `tool_result`, `session_start`, and `session_before_compact` handlers and storage roots cleanly under `~/.omp/context-mode/` so OMP and Pi installs never share state.

<details>
<summary><strong>What gets captured</strong></summary>

Every tool call passes through hooks that extract structured events:

| Category | Events | Priority | Captured By |
|---|---|---|---|
| **Files** | read, edit, write, glob, grep | Critical (P1) | PostToolUse |
| **Tasks** | create, update, complete | Critical (P1) | PostToolUse |
| **Plans** | enter, exit, approved, rejected, file write | Critical (P1) | PostToolUse |
| **Rules** | CLAUDE.md / GEMINI.md / AGENTS.md paths + content | Critical (P1) | SessionStart |
| **User Prompts** | Every user message (for last-prompt restore) | Critical (P1) | UserPromptSubmit |
| **Decisions** | User corrections, preferences ("use X instead", "don't do Y") | High (P2) | UserPromptSubmit |
| **Git** | checkout, commit, merge, rebase, stash, push, pull, diff, status | High (P2) | PostToolUse |
| **Errors** | Tool failures, non-zero exit codes | High (P2) | PostToolUse |
| **Error Resolution** | Error → fix pairs detected across sequential tool calls | High (P2) | PostToolUse |
| **Constraints** | Discovered limitations ("not supported", "permission denied") | High (P2) | PostToolUse |
| **Blockers** | "blocked on", "waiting for", "depends on" — tracked until resolved | High (P2) | UserPromptSubmit |
| **Rejected Approaches** | Tool calls denied by user (PreToolUse → PostToolUse marker) | High (P2) | PreToolUse |
| **Environment** | cwd changes, venv, nvm, conda, worktree, package installs | High (P2) | PostToolUse |
| **Agent Findings** | Completed subagent results (first 500 chars) | High (P2) | PostToolUse |
| **Iteration Loops** | Same tool called 3+ times with similar input (retry detection) | High (P2) | PostToolUse |
| **Latency** | Tool calls exceeding 5s (tool name + duration in ms) | Normal (P3) | PreToolUse |
| **MCP Tools** | All `mcp__*` tool calls with usage counts | Normal (P3) | PostToolUse |
| **Subagents** | Agent tool launches and completions | Normal (P3) | PostToolUse |
| **Skills** | Slash command invocations | Normal (P3) | PostToolUse |
| **External Refs** | URLs, GitHub issue references (#123), deduped | Normal (P3) | PostToolUse |
| **Role** | Persona / behavioral directives ("act as senior engineer") | Normal (P3) | UserPromptSubmit |
| **Intent** | Session mode classification (investigate, implement, review) | Low (P4) | UserPromptSubmit |
| **Data** | Large user-pasted data references (>1 KB) | Low (P4) | UserPromptSubmit |

</details>

<details>
<summary><strong>How sessions survive compaction</strong></summary>

```
PreCompact fires
  → Read all session events from SQLite
  → Build priority-tiered XML snapshot (≤2 KB)
  → Store snapshot in session_resume table

SessionStart fires (source: "compact")
  → Retrieve stored snapshot
  → Write structured events file → auto-indexed into FTS5
  → Build Session Guide with 15 categories
  → Inject <session_knowledge> directive into context
  → Model continues from last user prompt with full working state
```

The snapshot is built in priority tiers — if the 2 KB budget is tight, lower-priority events (intent, MCP tool counts) are dropped first while critical state (active files, tasks, rules, decisions) is always preserved.

After compaction, the model receives a **Session Guide** — a structured narrative with actionable sections:

- **Last Request** — user's last prompt, so the model continues without asking "what were we doing?"
- **Tasks** — checkbox format with completion status (`[x]` completed, `[ ]` pending)
- **Plans** — plan mode entries, exits, approvals, and rejections
- **Key Decisions** — user corrections and preferences ("use X instead", "don't do Y")
- **Files Modified** — all files touched during the session
- **Unresolved Errors** — errors that haven't been fixed, plus error→fix resolution pairs
- **Constraints** — discovered limitations and boundaries
- **Blockers** — open and resolved blockers ("blocked on X", "waiting for Y")
- **Git** — operations performed (checkout, commit, push, status)
- **Project Rules** — CLAUDE.md / GEMINI.md / AGENTS.md paths
- **MCP Tools Used** — tool names with call counts
- **Subagent Tasks** — delegated work summaries + agent findings
- **Skills Used** — slash commands invoked
- **Rejected Approaches** — tool calls the user denied
- **External References** — URLs and GitHub issue references
- **Environment** — working directory, env variables, worktrees
- **Data References** — large data pasted during the session
- **Session Intent** — mode classification (implement, investigate, review, discuss)
- **User Role** — behavioral directives set during the session

Detailed event data is also indexed into FTS5 for on-demand retrieval via `ctx_search()`.

</details>



## Utility Commands

**Inside any AI session** — just type the command. The LLM calls the MCP tool automatically:

```
ctx stats       → context savings, call counts, session report
ctx doctor      → diagnose runtimes, hooks, FTS5, versions
ctx index       → index a local file or directory for later search
ctx search      → search previously indexed content
ctx upgrade     → disabled for this fork; use a reviewed local release
ctx purge       → permanently delete all indexed content from the knowledge base
ctx insight     → opens the hosted Insight dashboard in your browser
```

**From your terminal** — run directly without an AI session:

```bash
context-mode doctor
context-mode index . --source project:my-app
context-mode search "authentication middleware" --source project:my-app
context-mode upgrade         # disabled; exits without network/source writes
context-mode insight          # opens the hosted Insight dashboard in browser
```


Supported runtime: Codex.

## Benchmarks

| Scenario | Raw | Context | Saved |
|---|---|---|---|
| Playwright snapshot | 56.2 KB | 299 B | 99% |
| GitHub Issues (20) | 58.9 KB | 1.1 KB | 98% |
| Access log (500 requests) | 45.1 KB | 155 B | 100% |
| Context7 React docs | 5.9 KB | 261 B | 96% |
| Analytics CSV (500 rows) | 85.5 KB | 222 B | 100% |
| Git log (153 commits) | 11.6 KB | 107 B | 99% |
| Test output (30 suites) | 6.0 KB | 337 B | 95% |
| Repo research (subagent) | 986 KB | 62 KB | 94% |

Over a full session: 315 KB of raw output becomes 5.4 KB. Session time extends from ~30 minutes to ~3 hours.

[Full benchmark data with 21 scenarios →](BENCHMARK.md)

## Privacy & Architecture

Context Mode is not a CLI output filter or a cloud analytics dashboard. It operates at the MCP protocol layer — raw data stays in a sandboxed subprocess and never enters your context window. Web pages, API responses, file analysis, Playwright snapshots, log files — everything is processed in complete isolation.

**Nothing leaves your machine.** No telemetry, no cloud sync, no usage tracking, no account required. Your code, your prompts, your session data — all local. The SQLite databases live in your home directory and die when you're done.

This is a deliberate architectural choice, not a missing feature. Context optimization should happen at the source, not in a dashboard behind a per-seat subscription. Privacy-first is our philosophy — and every design decision follows from it. [License →](#license)

## Security

Context Mode enforces the same permission rules you already use — but extends them to the MCP sandbox. If you block `sudo`, it's also blocked inside `ctx_execute`, `ctx_execute_file`, and `ctx_batch_execute`.

**Zero setup required.** If you haven't configured any permissions, nothing changes. This only activates when you add rules.

```json
{
  "permissions": {
    "deny": [
      "Bash(sudo *)",
      "Bash(rm -rf /*)",
      "Read(.env)",
      "Read(**/.env*)"
    ],
    "allow": [
      "Bash(git:*)",
      "Bash(npm:*)"
    ]
  }
}
```

Add this to your project's `.codex/settings.json` (or `$CODEX_HOME/settings.json`, default `~/.codex/settings.json`, for global rules). These files use context-mode's permissions schema; they are separate from native Codex `config.toml`. Existing external `.claude/settings.json` and `.claude/settings.local.json` policies remain read-only compatibility inputs, including global policies under `CLAUDE_CONFIG_DIR`. Denies from any loaded policy take precedence over allows. Codex CLI enforcement also requires the Codex hooks to be configured and trusted.

The pattern is `Tool(what to match)` where `*` means "anything".

Commands chained with `&&`, `;`, or `|` are split — each part is checked separately. `echo hello && sudo rm -rf /tmp` is blocked because the `sudo` part matches the deny rule.

**deny** always wins over **allow**. More specific (project-level) rules override global ones.

### Project-boundary containment

`ctx_execute_file` is confined to the project root. A `path` that resolves **outside** the workspace — an absolute path like `/home/user/secrets`, a `../../` traversal, or a project-local symlink whose target escapes the project — is refused with a `File access blocked` error. This closes the [#852](https://github.com/mksglu/context-mode/issues/852) escape vector where an agent, denied an out-of-project read by the host sandbox, retried through the MCP sandbox (the host's MCP approval prompt cannot inspect the tool's input params, so the escape was invisible to the approver).

The guard is **on by default** and requires no configuration. To intentionally process a file outside the project (e.g. a shared log under `/var/log`), opt that path back in with the **same `permissions.allow` rule you already use for the host `Read` tool** — there is no context-mode-specific env flag:

```json
{
  "permissions": {
    "allow": ["Read(/var/log/**)"]
  }
}
```

context-mode reads that allow rule from project `.codex/settings.json` or `$CODEX_HOME/settings.json`, alongside legacy `.claude` policies. A matching deny still wins, so an out-of-project grant cannot bypass a security deny.

Reviewing the prompt: the `ctx_execute` / `ctx_execute_file` approval titles now read as code execution ("Run code in a sandbox…", "Run code over a file…") so an unfamiliar reviewer can recognise the action class even though the MCP prompt renders only the tool title and raw arguments. `ctx_execute` and `ctx_batch_execute` run arbitrary code and still inherit the process's filesystem access, so the boundary guard is a defense-in-depth layer for the *file-read* tool, not a full OS sandbox — treat approving any execution tool as approving arbitrary code, and keep host-level sandboxing enabled.

### Network fetch hardening

`ctx_fetch_and_index` blocks dangerous URL targets by default:

- **Schemes**: only `http:` and `https:` allowed (no `file://`, `gopher://`, `javascript:`, `data:`).
- **Cloud metadata + link-local**: `169.254.0.0/16` (incl. AWS/GCP/Azure IMDS endpoint `169.254.169.254`) hard-blocked even if a hostname resolves to it (DNS-rebinding defense).
- **Multicast / reserved**: `224.0.0.0/4`, `0.0.0.0/8`, IPv6 `ff00::/8`, `fe80::/10` blocked.
- **Loopback + RFC1918** (`localhost`, `127.x`, `10.x`, `172.16-31.x`, `192.168.x`, IPv6 `::1`, `fc00::/7`) **allowed by default** so local dev servers + internal-network fetches keep working.

For hosted/CI environments where you want to block private targets too, set:

```bash
export CTX_FETCH_STRICT=1
```

That blocks loopback + RFC1918 + ULA in addition to the always-blocked ranges. Useful when context-mode runs as a shared service, not on a developer's own machine.

`tool_input` for any `mcp__*` tool call is also redacted before persistence — the regex matcher in `src/session/extract.ts` masks `authorization`, `auth_token`, `access_token`, `refresh_token`, `bearer`, `token`, `secret`, `password`, `passwd`, `pwd`, `api_key` / `apikey` / `x_api_key`, `cookie` / `set-cookie`, `signature`, `private_key`, and `client_secret` (case-insensitive, hyphen/underscore-insensitive) to `[REDACTED]` so credentials in MCP arguments don't end up in the session DB.

### Storage environment variables

| Variable | Default | Purpose |
|---|---|---|
| `CONTEXT_MODE_DIR` | Codex default under CODEX_HOME/context-mode | Since v1.0.147. Absolute writable root for context-mode storage. Sessions and stats use `<root>/sessions`; indexed content uses `<root>/content`. Empty or whitespace-only values are treated as unset and shown by `ctx_doctor`; non-empty values must be absolute. `~` is not expanded. |

### Routing-guidance environment variables

| Variable | Default | Purpose |
|---|---|---|
| `CONTEXT_MODE_EXTERNAL_MCP_NUDGE_EVERY` | `10` | Cadence (in tool calls) at which the PreToolUse hook re-injects the "wrap large external-MCP payloads in `ctx_execute`" guidance. The original implementation ([#529](https://github.com/mksglu/context-mode/pull/529)) fired only once per session, which got lost after context compaction in MCP-heavy sessions (e.g. 50+ Jira/Slack/Notion calls — see [#567](https://github.com/mksglu/context-mode/issues/567) follow-up). The default re-fires every 10th matching call, keeping the guidance in the model's recent window. Range `[1, 100]`; invalid values fall back to `10`. Set to `1` for "every call" (most aggressive — adds ~250 tokens/call) or to a larger value for less frequent reminders. |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and TDD guidelines.

```bash
git clone https://github.com/mksglu/context-mode.git
cd context-mode && npm install && npm test
```

## License

Licensed under [Elastic License 2.0](LICENSE) (source-available). You can use it, fork it, modify it, and distribute it. Two things you can't do: offer it as a hosted/managed service, or remove the licensing notices. We chose ELv2 over MIT because MIT permits repackaging the code as a competing closed-source SaaS — ELv2 prevents that while keeping the source available to everyone.
