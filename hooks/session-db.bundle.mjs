import{createRequire as ve}from"node:module";import{existsSync as Re,unlinkSync as q,renameSync as be}from"node:fs";import{existsSync as Ee,mkdirSync as ge,readFileSync as me,realpathSync as pe}from"node:fs";import{homedir as _e}from"node:os";import{basename as Se,dirname as C,isAbsolute as W,join as l,relative as ye,resolve as x,sep as he}from"node:path";import{fileURLToPath as Te}from"node:url";var fe="codex-context-mode";function H(r){let e=x(r),t=[];for(;!Ee(e)&&C(e)!==e;)t.unshift(Se(e)),e=C(e);return x(pe.native(e),...t)}function y(r=process.env,e=_e()){let t=r.CODEX_CONTEXT_MODE_HOME?.trim();if(t&&!W(t))throw new Error("CODEX_CONTEXT_MODE_HOME must be absolute");let n=x(t||l(e,".codex-context-mode"));return{root:n,data:l(n,"data"),sessions:l(n,"data","sessions"),content:l(n,"data","content"),stats:l(n,"data","stats"),memory:l(n,"data","memory"),cache:l(n,"cache"),logs:l(n,"logs"),temporary:l(n,"cache","tmp")}}function h(r){let e=C(Te(import.meta.url));for(let t of[process.env.PLUGIN_ROOT,process.env.CLAUDE_PLUGIN_ROOT,e,C(e)]){if(!t)continue;let n;try{n=JSON.parse(me(l(t,"package.json"),"utf8"))}catch{continue}if(n.name!==fe)continue;let s=ye(H(t),H(r));if(s===""||s!==".."&&!s.startsWith(".."+he)&&!W(s))throw new Error("Plugin data must not be written inside the code installation: "+r)}}function V(){let r=y().temporary;return h(r),ge(r,{recursive:!0}),r}import{join as Le}from"node:path";var U=class{#e;constructor(e){this.#e=e}pragma(e){let n=this.#e.prepare(`PRAGMA ${e}`).all();if(!n||n.length===0)return;if(n.length>1)return n;let s=Object.values(n[0]);return s.length===1?s[0]:n[0]}exec(e){let t="",n=null;for(let a=0;a<e.length;a++){let i=e[a];if(n)t+=i,i===n&&(n=null);else if(i==="'"||i==='"')t+=i,n=i;else if(i===";"){let c=t.trim();c&&this.#e.prepare(c).run(),t=""}else t+=i}let s=t.trim();return s&&this.#e.prepare(s).run(),this}prepare(e){let t=this.#e.prepare(e);return{run:(...n)=>t.run(...n),get:(...n)=>{let s=t.get(...n);return s===null?void 0:s},all:(...n)=>t.all(...n),iterate:(...n)=>t.iterate(...n)}}transaction(e){return this.#e.transaction(e)}close(){this.#e.close()}},M=class{#e;constructor(e){this.#e=e}pragma(e){let n=this.#e.prepare(`PRAGMA ${e}`).all();if(!n||n.length===0)return;if(n.length>1)return n;let s=Object.values(n[0]);return s.length===1?s[0]:n[0]}exec(e){return this.#e.exec(e),this}prepare(e){let t=this.#e.prepare(e);return{run:(...n)=>t.run(...n),get:(...n)=>t.get(...n),all:(...n)=>t.all(...n),iterate:(...n)=>typeof t.iterate=="function"?t.iterate(...n):t.all(...n)[Symbol.iterator]()}}transaction(e){return(...t)=>{this.#e.exec("BEGIN");try{let n=e(...t);return this.#e.exec("COMMIT"),n}catch(n){throw this.#e.exec("ROLLBACK"),n}}}close(){this.#e.close()}},g=null;function Ne(r){let e=null;try{return e=new r(":memory:"),e.exec("CREATE VIRTUAL TABLE __fts5_probe USING fts5(x)"),!0}catch{return!1}finally{try{e?.close()}catch{}}}function De(r,e){let t=e!==void 0?e:globalThis.Bun;if(typeof t<"u"&&t!==null)return!0;let n=r??process.versions,[s,a]=(n.node??"0.0.0").split("."),i=Number(s),c=Number(a);return!Number.isFinite(i)||!Number.isFinite(c)?!1:i>22||i===22&&c>=5}function Ce(){if(!g){let r=ve(import.meta.url);if(globalThis.Bun){let e=r(["bun","sqlite"].join(":")).Database;g=function(n,s){let a=new e(n,{readonly:s?.readonly,create:!0}),i=new U(a);return s?.timeout&&i.pragma(`busy_timeout = ${s.timeout}`),i}}else if(De()){let e=null;try{({DatabaseSync:e}=r(["node","sqlite"].join(":")))}catch{e=null}e&&Ne(e)?g=function(n,s){let a=new e(n,{readOnly:s?.readonly??!1}),i=new M(a);return s?.timeout&&i.pragma(`busy_timeout = ${s.timeout}`),i}:g=r("better-sqlite3")}else g=r("better-sqlite3")}return g}function X(r){r.pragma("journal_mode = WAL"),r.pragma("synchronous = NORMAL");try{r.pragma("mmap_size = 268435456")}catch{}}function $(r){if(!Re(r))for(let e of["-wal","-shm"])try{q(r+e)}catch{}}function Oe(r){for(let e of["","-wal","-shm"])try{q(r+e)}catch{}}function P(r){try{r.pragma("wal_checkpoint(TRUNCATE)")}catch{}try{r.close()}catch{}}function G(r="context-mode"){return Le(V(),`${r}-${process.pid}.db`)}function Ae(r,e=[100,500,2e3]){let t;for(let n=0;n<=e.length;n++)try{return r()}catch(s){let a=s instanceof Error?s.message:String(s);if(!a.includes("SQLITE_BUSY")&&!a.includes("database is locked"))throw s;if(t=s instanceof Error?s:new Error(a),n<e.length){let i=e[n],c=Date.now();for(;Date.now()-c<i;);}}throw new Error(`SQLITE_BUSY: database is locked after ${e.length} retries. Original error: ${t?.message}`)}function we(r){return r.includes("SQLITE_CORRUPT")||r.includes("SQLITE_NOTADB")||r.includes("database disk image is malformed")||r.includes("file is not a database")}function xe(r){let e=Date.now();for(let t of["","-wal","-shm"])try{be(r+t,`${r}${t}.corrupt-${e}`)}catch{}}var T=Symbol.for("__context_mode_live_dbs_v3__"),I=(()=>{let r=globalThis;return r[T]||(r[T]=new Set,process.on("exit",()=>{for(let e of r[T])P(e);r[T].clear()})),r[T]})(),O=class{#e;#t;constructor(e){e!==":memory:"&&h(e);let t=Ce();this.#e=e,$(e);let n;try{n=new t(e,{timeout:3e4}),X(n)}catch(s){let a=s instanceof Error?s.message:String(s);if(we(a)){xe(e),$(e);try{n=new t(e,{timeout:3e4}),X(n)}catch(i){throw new Error(`Failed to create fresh DB after renaming corrupt file: ${i instanceof Error?i.message:String(i)}`)}}else throw s}this.#t=n,I.add(this.#t),this.initSchema(),this.prepareStatements()}get db(){return this.#t}get dbPath(){return this.#e}close(){I.delete(this.#t),P(this.#t)}withRetry(e){return Ae(e)}cleanup(){I.delete(this.#t),P(this.#t),Oe(this.#e)}};import{createHash as R}from"node:crypto";import{execFileSync as Ie}from"node:child_process";import{accessSync as Ue,constants as Me,mkdirSync as Pe,realpathSync as Fe}from"node:fs";import{dirname as ke,isAbsolute as je,join as L,resolve as te}from"node:path";var E="CODEX_CONTEXT_MODE_HOME",Be="sessions",Y="content",b=class extends Error{kind;path;overrideEnvVar;ignoredEnvVar;ignoredReason;constructor(e,t,n=E,s,a,i={}){super(a??Xe(e,t,i),{cause:s}),this.name="StorageDirectoryError",this.kind=e,this.path=t,this.overrideEnvVar=n,this.ignoredEnvVar=i.ignoredEnvVar,this.ignoredReason=i.ignoredReason}},w=new Map;function pt(r){return y(r.env??process.env).sessions}function He(r,e,t){return new b(r,e,E,void 0,[`Invalid ${E} for codex-context-mode ${r} directory: ${t}`,oe()].join(`
`))}function re(r){let e=process.env[E];if(e===void 0)return{kind:"unset"};let t=e.trim();if(!t)return{kind:"ignored-empty",ignoredEnvVar:E,ignoredReason:"empty"};if(!je(t))throw He(r,t,`${E} must be an absolute path.`);return{kind:"override",root:te(t)}}function We(r){return r.kind==="ignored-empty"?{ignoredEnvVar:r.ignoredEnvVar,ignoredReason:r.ignoredReason}:{}}function ne(r,e){let t=re(r);return t.kind!=="override"?null:{kind:r,path:L(t.root,"data",e),envVar:E,source:"override"}}function Ve(r,e,t){return{kind:r,path:te(e()),envVar:null,source:"default",...t}}function se(r){let e=re("session");return e.kind==="override"?{kind:"session",path:L(e.root,"data",Be),envVar:E,source:"override"}:Ve("session",r,We(e))}function _t(r){let e=ne("content",Y);if(e)return e;let t=se(r);return{kind:"content",path:L(ke(t.path),Y),envVar:t.envVar,source:t.source,ignoredEnvVar:t.ignoredEnvVar,ignoredReason:t.ignoredReason}}function St(r){let e=ne("stats","stats");if(e)return e;let t=se(r);return{kind:"stats",path:t.path===y().sessions?y().stats:t.path,envVar:t.envVar,source:t.source,ignoredEnvVar:t.ignoredEnvVar,ignoredReason:t.ignoredReason}}function yt(r){return r.message}function ht(r){return r.source==="override"&&r.envVar?`via ${r.envVar}`:r.ignoredEnvVar&&r.ignoredReason==="empty"?`default; ignored empty ${r.ignoredEnvVar}`:"default"}function Tt(){w.clear()}function ft(r){h(r.path);let e=[r.kind,r.path,r.source,r.envVar??"",r.ignoredEnvVar??"",r.ignoredReason??""].join("\0"),t=w.get(e);if(t instanceof b)throw t;if(t===r.path)return t;try{return Pe(r.path,{recursive:!0}),Ue(r.path,Me.W_OK),w.set(e,r.path),r.path}catch(n){let s=new b(r.kind,qe(n)??r.path,E,n,void 0,{ignoredEnvVar:r.ignoredEnvVar,ignoredReason:r.ignoredReason});throw w.set(e,s),s}}function Xe(r,e,t={}){return[`codex-context-mode ${r} directory is not writable: ${e}`,$e(t),oe()].filter(Boolean).join(`
`)}function $e(r){return r.ignoredEnvVar&&r.ignoredReason==="empty"?`Ignored empty ${r.ignoredEnvVar}; using adapter default.`:null}function oe(){return`Set ${E} to a writable absolute path.`}function qe(r){if(!r||typeof r!="object")return null;let e=r.path;return typeof e=="string"&&e.length>0?e:null}var m;function p(r){let e=r.replace(/\\/g,"/");return/^\/+$/.test(e)?"/":/^[A-Za-z]:\/+$/.test(e)?`${e.slice(0,2)}/`:e.replace(/\/+$/,"")}function v(r){let e=p(r);return process.platform==="win32"||process.platform==="darwin"?e.toLowerCase():e}var f="REPLACE(project_dir, '\\', '/')",K=`CASE
  WHEN RTRIM(${f}, '/') = '' AND project_dir <> '' THEN '/'
  WHEN LENGTH(RTRIM(${f}, '/')) = 2
    AND SUBSTR(${f}, 2, 2) = ':/'
    THEN SUBSTR(${f}, 1, 2) || '/'
  ELSE RTRIM(${f}, '/') END`,z=process.platform==="win32"||process.platform==="darwin"?`LOWER(${K})`:K;function Q(r){let e=r;try{e=Fe.native(r)}catch{}let t=p(e);return process.platform==="win32"||process.platform==="darwin"?t.toLowerCase():t}function ie(r,e){return Ie("git",["-C",r,...e],{encoding:"utf-8",timeout:2e3,stdio:["ignore","pipe","ignore"]}).trim()}function Ge(r){let e=ie(r,["rev-parse","--show-toplevel"]);return e.length>0?p(e):null}function Ye(r){let e=ie(r,["worktree","list","--porcelain"]).split(/\r?\n/).find(t=>t.startsWith("worktree "))?.replace("worktree ","")?.trim();return e?p(e):null}function Ke(r=process.cwd()){let e=process.env.CONTEXT_MODE_SESSION_SUFFIX;if(m&&m.projectDir===r&&m.envSuffix===e)return m.suffix;let t="";if(e!==void 0)t=e?`__${e}`:"";else try{let n=Ge(r),s=Ye(r);if(n&&s){let a=Q(n),i=Q(s);a!==i&&(t=`__${R("sha256").update(a).digest("hex").slice(0,8)}`)}}catch{}return m={projectDir:r,envSuffix:e,suffix:t},t}function vt(){m=void 0}function Rt(r){return R("sha256").update(p(r)).digest("hex").slice(0,16)}function ae(r){return R("sha256").update(v(r)).digest("hex").slice(0,16)}function bt(r){return L(r.contentDir,ae(r.projectDir)+".db")}function Lt(r){return ze({...r,ext:".db"})}function ze(r){let e=r.suffix??Ke(r.projectDir);return L(r.sessionsDir,ae(r.projectDir)+e+r.ext)}var J=1e3,Z=5;function A(r){let e=Number(r);return!Number.isFinite(e)||e<=0?0:Math.floor(e)}var o={insertEvent:"insertEvent",getEvents:"getEvents",getEventsByType:"getEventsByType",getEventsByPriority:"getEventsByPriority",getEventsByTypeAndPriority:"getEventsByTypeAndPriority",getEventCount:"getEventCount",getLatestAttributedProject:"getLatestAttributedProject",checkDuplicate:"checkDuplicate",evictLowestPriority:"evictLowestPriority",updateMetaLastEvent:"updateMetaLastEvent",ensureSession:"ensureSession",getSessionStats:"getSessionStats",getSessionRollup:"getSessionRollup",getMaxFileEdits:"getMaxFileEdits",getLatestCommitMessage:"getLatestCommitMessage",incrementCompactCount:"incrementCompactCount",getUsageCursor:"getUsageCursor",setUsageCursor:"setUsageCursor",compareUsageCursor:"compareUsageCursor",upsertResume:"upsertResume",getResume:"getResume",markResumeConsumed:"markResumeConsumed",claimLatestUnconsumedResume:"claimLatestUnconsumedResume",deleteEvents:"deleteEvents",deleteMeta:"deleteMeta",deleteResume:"deleteResume",getOldSessions:"getOldSessions",searchEvents:"searchEvents",incrementToolCall:"incrementToolCall",getToolCallTotals:"getToolCallTotals",getToolCallByTool:"getToolCallByTool",getEventBytesSummary:"getEventBytesSummary"},Qe=[["project_dir","TEXT NOT NULL DEFAULT ''"],["attribution_source","TEXT NOT NULL DEFAULT 'unknown'"],["attribution_confidence","REAL NOT NULL DEFAULT 0"],["bytes_avoided","INTEGER NOT NULL DEFAULT 0"],["bytes_returned","INTEGER NOT NULL DEFAULT 0"]];function ce(r){let e=r.pragma("table_xinfo(session_events)"),t=new Set(e.map(s=>s.name)),n=!1;for(let[s,a]of Qe)t.has(s)||(r.exec(`ALTER TABLE session_events ADD COLUMN ${s} ${a}`),n=!0);return n&&r.exec("CREATE INDEX IF NOT EXISTS idx_session_events_project ON session_events(session_id, project_dir)"),n}function Nt(r,e){let t=null;try{t=new e(r),ce(t)}catch{}finally{try{t?.close()}catch{}}}var ee=class extends O{constructor(e){super(e?.dbPath??G("session"))}stmt(e){return this.stmts.get(e)}initSchema(){try{let t=this.db.pragma("table_xinfo(session_events)").find(n=>n.name==="data_hash");t&&t.hidden!==0&&this.db.exec("DROP TABLE session_events")}catch{}this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 2,
        data TEXT NOT NULL,
        project_dir TEXT NOT NULL DEFAULT '',
        attribution_source TEXT NOT NULL DEFAULT 'unknown',
        attribution_confidence REAL NOT NULL DEFAULT 0,
        bytes_avoided INTEGER NOT NULL DEFAULT 0,
        bytes_returned INTEGER NOT NULL DEFAULT 0,
        source_hook TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        data_hash TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_events_type ON session_events(session_id, type);
      CREATE INDEX IF NOT EXISTS idx_session_events_priority ON session_events(session_id, priority);

      CREATE TABLE IF NOT EXISTS session_meta (
        session_id TEXT PRIMARY KEY,
        project_dir TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_event_at TEXT,
        event_count INTEGER NOT NULL DEFAULT 0,
        compact_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS session_resume (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        snapshot TEXT NOT NULL,
        event_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        consumed INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tool_calls (
        session_id TEXT NOT NULL,
        tool TEXT NOT NULL,
        calls INTEGER NOT NULL DEFAULT 0,
        bytes_returned INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (session_id, tool)
      );

      CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls(session_id);
    `);try{ce(this.db)}catch{}try{this.db.pragma("table_xinfo(session_meta)").some(t=>t.name==="usage_cursor")||this.db.exec("ALTER TABLE session_meta ADD COLUMN usage_cursor TEXT")}catch{}}prepareStatements(){this.stmts=new Map;let e=(t,n)=>{this.stmts.set(t,this.db.prepare(n))};e(o.insertEvent,`INSERT INTO session_events (
         session_id, type, category, priority, data,
         project_dir, attribution_source, attribution_confidence,
         bytes_avoided, bytes_returned,
         source_hook, data_hash
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),e(o.getEvents,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? ORDER BY id ASC LIMIT ?`),e(o.getEventsByType,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? AND type = ? ORDER BY id ASC LIMIT ?`),e(o.getEventsByPriority,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? AND priority >= ? ORDER BY id ASC LIMIT ?`),e(o.getEventsByTypeAndPriority,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? AND type = ? AND priority >= ? ORDER BY id ASC LIMIT ?`),e(o.getEventCount,"SELECT COUNT(*) AS cnt FROM session_events WHERE session_id = ?"),e(o.getLatestAttributedProject,`SELECT project_dir
       FROM session_events
       WHERE session_id = ? AND project_dir != ''
       ORDER BY id DESC
       LIMIT 1`),e(o.checkDuplicate,`SELECT 1 FROM (
         SELECT type, data_hash FROM session_events
         WHERE session_id = ? ORDER BY id DESC LIMIT ?
       ) AS recent
       WHERE recent.type = ? AND recent.data_hash = ?
       LIMIT 1`),e(o.evictLowestPriority,`DELETE FROM session_events WHERE id = (
         SELECT id FROM session_events WHERE session_id = ?
         ORDER BY priority ASC, id ASC LIMIT 1
       )`),e(o.updateMetaLastEvent,`UPDATE session_meta
       SET last_event_at = datetime('now'), event_count = event_count + 1
       WHERE session_id = ?`),e(o.ensureSession,"INSERT OR IGNORE INTO session_meta (session_id, project_dir) VALUES (?, ?)"),e(o.getSessionStats,`SELECT session_id, project_dir, started_at, last_event_at, event_count, compact_count
       FROM session_meta WHERE session_id = ?`),e(o.getSessionRollup,`SELECT
         COUNT(*) AS tool_calls,
         COALESCE(SUM(CASE WHEN category = 'error' THEN 1 ELSE 0 END), 0) AS errors,
         COUNT(DISTINCT type) AS unique_tools,
         COUNT(DISTINCT CASE WHEN category = 'file' THEN data END) AS unique_files,
         CASE WHEN SUM(CASE WHEN type = 'git_commit' THEN 1 ELSE 0 END) > 0 THEN 1 ELSE 0 END AS has_commit,
         CAST(COALESCE((MAX(strftime('%s', created_at)) - MIN(strftime('%s', created_at))) / 60.0, 0) AS INTEGER) AS duration_min,
         COALESCE(SUM(CASE WHEN type = 'external_ref' THEN 1 ELSE 0 END), 0) AS sources_indexed,
         CAST(COALESCE(SUM(bytes_avoided) / 1024.0, 0) AS INTEGER) AS total_chunks,
         COALESCE(SUM(CASE WHEN type IN ('file_search', 'file_glob') THEN 1 ELSE 0 END), 0) AS search_queries
       FROM session_events
       WHERE session_id = ?`),e(o.getMaxFileEdits,`SELECT COALESCE(MAX(c), 0) AS max_file_edits
       FROM (
         SELECT COUNT(*) AS c
         FROM session_events
         WHERE session_id = ? AND category = 'file' AND type IN ('file_edit', 'file_write')
         GROUP BY data
       )`),e(o.getLatestCommitMessage,`SELECT data
       FROM session_events
       WHERE session_id = ? AND type = 'git_commit'
       ORDER BY id DESC
       LIMIT 1`),e(o.incrementCompactCount,"UPDATE session_meta SET compact_count = compact_count + 1 WHERE session_id = ?"),e(o.getUsageCursor,"SELECT usage_cursor FROM session_meta WHERE session_id = ?"),e(o.setUsageCursor,"UPDATE session_meta SET usage_cursor = ? WHERE session_id = ?"),e(o.compareUsageCursor,"UPDATE session_meta SET usage_cursor = ? WHERE session_id = ? AND usage_cursor IS ?"),e(o.upsertResume,`INSERT INTO session_resume (session_id, snapshot, event_count)
       VALUES (?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         snapshot = excluded.snapshot,
         event_count = excluded.event_count,
         created_at = datetime('now'),
         consumed = 0`),e(o.getResume,"SELECT snapshot, event_count, consumed FROM session_resume WHERE session_id = ?"),e(o.markResumeConsumed,"UPDATE session_resume SET consumed = 1 WHERE session_id = ?"),e(o.claimLatestUnconsumedResume,`UPDATE session_resume
       SET consumed = 1
       WHERE id = (
         SELECT id FROM session_resume
         WHERE consumed = 0
           AND session_id != ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1
       )
       RETURNING session_id, snapshot`),e(o.deleteEvents,"DELETE FROM session_events WHERE session_id = ?"),e(o.deleteMeta,"DELETE FROM session_meta WHERE session_id = ?"),e(o.deleteResume,"DELETE FROM session_resume WHERE session_id = ?"),e(o.searchEvents,`SELECT id, session_id, category, type, data, created_at
       FROM session_events
       WHERE (${z} = ? OR project_dir = '')
         AND (data LIKE '%' || ? || '%' ESCAPE '\\' OR category LIKE '%' || ? || '%' ESCAPE '\\')
         AND (? IS NULL OR category = ?)
       ORDER BY id ASC
       LIMIT ?`),e(o.getOldSessions,"SELECT session_id FROM session_meta WHERE started_at < datetime('now', ? || ' days')"),e(o.incrementToolCall,`INSERT INTO tool_calls (session_id, tool, calls, bytes_returned)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(session_id, tool) DO UPDATE SET
         calls = calls + 1,
         bytes_returned = bytes_returned + excluded.bytes_returned,
         updated_at = datetime('now')`),e(o.getToolCallTotals,`SELECT COALESCE(SUM(calls), 0) AS calls,
              COALESCE(SUM(bytes_returned), 0) AS bytes_returned
       FROM tool_calls WHERE session_id = ?`),e(o.getToolCallByTool,`SELECT tool, calls, bytes_returned
       FROM tool_calls WHERE session_id = ? ORDER BY calls DESC`),e(o.getEventBytesSummary,`SELECT COALESCE(SUM(bytes_avoided), 0) AS bytes_avoided,
              COALESCE(SUM(bytes_returned), 0) AS bytes_returned
       FROM session_events WHERE session_id = ?`)}insertEvent(e,t,n="PostToolUse",s,a){let i=R("sha256").update(t.data).digest("hex").slice(0,16).toUpperCase(),c=String(s?.projectDir??t.project_dir??this._getSessionProjectDir(e)).trim(),_=String(s?.source??t.attribution_source??"unknown"),d=Number(s?.confidence??t.attribution_confidence??0),u=Number.isFinite(d)?Math.max(0,Math.min(1,d)):0,N=A(a?.bytesAvoided),S=A(a?.bytesReturned),D=this.db.transaction(()=>{if(this.stmt(o.checkDuplicate).get(e,Z,t.type,i))return;this.stmt(o.getEventCount).get(e).cnt>=J&&this.stmt(o.evictLowestPriority).run(e),this.stmt(o.insertEvent).run(e,t.type,t.category,t.priority,t.data,c,_,u,N,S,n,i),this.stmt(o.updateMetaLastEvent).run(e)});this.withRetry(()=>D())}bulkInsertEvents(e,t,n="PostToolUse",s,a,i){if(i&&i.next===i.expected&&t.length>0)throw new Error("Usage cursor must advance before inserting usage");if((!t||t.length===0)&&!i)return!0;if(t.length===1&&!i)return this.insertEvent(e,t[0],n,s?.[0],a?.[0]),!0;let c=t.map((d,u)=>{let N=R("sha256").update(d.data).digest("hex").slice(0,16).toUpperCase(),S=s?.[u],D=String(S?.projectDir??d.project_dir??this._getSessionProjectDir(e)??"").trim(),F=D===""?"":p(D),k=String(S?.source??d.attribution_source??"unknown"),j=Number(S?.confidence??d.attribution_confidence??0),ue=Number.isFinite(j)?Math.max(0,Math.min(1,j)):0,B=a?.[u],de=A(B?.bytesAvoided),le=A(B?.bytesReturned);return{event:d,dataHash:N,projectDir:F,attributionSource:k,attributionConfidence:ue,bytesAvoided:de,bytesReturned:le}}),_=this.db.transaction(()=>{if(i&&this.stmt(o.compareUsageCursor).run(i.next,e,i.expected).changes!==1)return!1;let d=this.stmt(o.getEventCount).get(e).cnt;for(let u of c)!i&&this.stmt(o.checkDuplicate).get(e,Z,u.event.type,u.dataHash)||(d>=J?this.stmt(o.evictLowestPriority).run(e):d++,this.stmt(o.insertEvent).run(e,u.event.type,u.event.category,u.event.priority,u.event.data,u.projectDir,u.attributionSource,u.attributionConfidence,u.bytesAvoided,u.bytesReturned,n,u.dataHash));return c.length>0&&this.stmt(o.updateMetaLastEvent).run(e),!0});return this.withRetry(()=>_())}getEvents(e,t){let n=t?.limit??1e3,s=t?.type,a=t?.minPriority;return s&&a!==void 0?this.stmt(o.getEventsByTypeAndPriority).all(e,s,a,n):s?this.stmt(o.getEventsByType).all(e,s,n):a!==void 0?this.stmt(o.getEventsByPriority).all(e,a,n):this.stmt(o.getEvents).all(e,n)}getEventCount(e){return this.stmt(o.getEventCount).get(e).cnt}getEventBytesSummary(e){let t=this.stmt(o.getEventBytesSummary).get(e);return{bytesAvoided:Number(t?.bytes_avoided??0),bytesReturned:Number(t?.bytes_returned??0)}}getLatestAttributedProjectDir(e){return this.stmt(o.getLatestAttributedProject).get(e)?.project_dir||null}_getSessionProjectDir(e){try{return this.db.prepare("SELECT project_dir FROM session_meta WHERE session_id = ?").get(e)?.project_dir||""}catch{return""}}searchEvents(e,t,n,s){try{let a=e.replace(/[%_]/g,c=>"\\"+c),i=s??null;if((process.platform==="win32"||process.platform==="darwin")&&/[^\x00-\x7f]/.test(n)){let c=["",...this.matchingProjectPaths(n)];return this.db.prepare(`SELECT id, session_id, category, type, data, created_at
          FROM session_events WHERE project_dir IN (${c.map(()=>"?").join(",")})
          AND (data LIKE '%' || ? || '%' ESCAPE '\\' OR category LIKE '%' || ? || '%' ESCAPE '\\')
          AND (? IS NULL OR category = ?) ORDER BY id ASC LIMIT ?`).all(...c,a,a,i,i,t)}return this.stmt(o.searchEvents).all(v(n),a,a,i,i,t)}catch{return[]}}getSessionIdsForProject(e){try{if((process.platform==="win32"||process.platform==="darwin")&&/[^\x00-\x7f]/.test(e)){let s=this.matchingProjectPaths(e);return s.length?this.db.prepare(`SELECT DISTINCT session_id FROM session_events
          WHERE project_dir IN (${s.map(()=>"?").join(",")})`).all(...s).map(i=>i.session_id):[]}let t=v(e);return this.db.prepare(`SELECT DISTINCT session_id
             FROM session_events
            WHERE ${z} = ?`).all(t).map(s=>s.session_id)}catch{return[]}}matchingProjectPaths(e){let t=v(e);return this.db.prepare("SELECT DISTINCT project_dir FROM session_events WHERE project_dir <> ''").all().map(s=>s.project_dir).filter(s=>v(s)===t)}ensureSession(e,t){this.stmt(o.ensureSession).run(e,t)}getSessionStats(e){return this.stmt(o.getSessionStats).get(e)??null}getSessionRollup(e){let t=this.stmt(o.getSessionRollup).get(e),n=this.stmt(o.getMaxFileEdits).get(e),s=this.stmt(o.getLatestCommitMessage).get(e),a=this.getSessionStats(e),i=(t?.tool_calls??0)>0?t?.unique_files??0:0,c=t?.errors??0,_=Math.min(i,c);return{tool_calls:t?.tool_calls??0,errors:t?.errors??0,unique_tools:t?.unique_tools??0,unique_files:t?.unique_files??0,max_file_edits:n?.max_file_edits??0,has_commit:t?.has_commit??0,commit_message:s?.data??"",edit_test_cycles:_,duration_min:t?.duration_min??0,compact_count:a?.compact_count??0,sources_indexed:t?.sources_indexed??0,total_chunks:t?.total_chunks??0,search_queries:t?.search_queries??0}}incrementCompactCount(e){this.stmt(o.incrementCompactCount).run(e)}getUsageCursor(e){return this.stmt(o.getUsageCursor).get(e)?.usage_cursor??null}setUsageCursor(e,t){this.stmt(o.setUsageCursor).run(t,e)}upsertResume(e,t,n){this.stmt(o.upsertResume).run(e,t,n??0)}getResume(e){return this.stmt(o.getResume).get(e)??null}markResumeConsumed(e){this.stmt(o.markResumeConsumed).run(e)}claimLatestUnconsumedResume(e){let t=this.stmt(o.claimLatestUnconsumedResume).get(e);return t?{sessionId:t.session_id,snapshot:t.snapshot}:null}getLatestSessionId(){try{return this.db.prepare("SELECT session_id FROM session_meta ORDER BY started_at DESC LIMIT 1").get()?.session_id??null}catch{return null}}incrementToolCall(e,t,n=0){let s=Number.isFinite(n)&&n>0?Math.round(n):0;try{this.stmt(o.incrementToolCall).run(e,t,s)}catch{}}getToolCallStats(e){try{let t=this.stmt(o.getToolCallTotals).get(e),n=this.stmt(o.getToolCallByTool).all(e),s={};for(let a of n)s[a.tool]={calls:a.calls,bytesReturned:a.bytes_returned};return{totalCalls:t?.calls??0,totalBytesReturned:t?.bytes_returned??0,byTool:s}}catch{return{totalCalls:0,totalBytesReturned:0,byTool:{}}}}deleteSession(e){this.db.transaction(()=>{this.stmt(o.deleteEvents).run(e),this.stmt(o.deleteResume).run(e),this.stmt(o.deleteMeta).run(e)})()}cleanupOldSessions(e=7){let t=`-${e}`,n=this.stmt(o.getOldSessions).all(t);for(let{session_id:s}of n)this.deleteSession(s);return n.length}pruneOrphanedEvents(){let e=this.db.prepare("DELETE FROM session_events WHERE session_id NOT IN (SELECT session_id FROM session_meta)").run();return Number(e.changes??0)}};export{ee as SessionDB,b as StorageDirectoryError,vt as _resetWorktreeSuffixCacheForTests,ce as applyMissingSessionEventsColumns,Tt as clearStorageDirectoryCheckCacheForTests,ht as describeStorageDirectorySource,Nt as ensureSessionEventsSchema,ft as ensureWritableStorageDir,yt as formatStorageDirectoryError,Ke as getWorktreeSuffix,ae as hashProjectDirCanonical,Rt as hashProjectDirLegacy,p as normalizeWorktreePath,_t as resolveContentStorageDir,bt as resolveContentStorePath,pt as resolveDefaultSessionDir,Lt as resolveSessionDbPath,ze as resolveSessionPath,se as resolveSessionStorageDir,St as resolveStatsStorageDir};
