#!/usr/bin/env node
var Ke=Object.defineProperty;var ft=(n,t)=>()=>(n&&(t=n(n=0)),t);var ze=(n,t)=>{for(var e in t)Ke(n,e,{get:t[e],enumerable:!0})};import{existsSync as qe,mkdirSync as Qe,readFileSync as Ze,realpathSync as tn}from"node:fs";import{homedir as en}from"node:os";import{basename as nn,dirname as rt,isAbsolute as Bt,join as T,relative as sn,resolve as Et,sep as rn}from"node:path";import{fileURLToPath as on}from"node:url";function Ht(n){let t=Et(n),e=[];for(;!qe(t)&&rt(t)!==t;)e.unshift(nn(t)),t=rt(t);return Et(tn.native(t),...e)}function R(n=process.env,t=en()){let e=n.CODEX_CONTEXT_MODE_HOME?.trim();if(e&&!Bt(e))throw new Error("CODEX_CONTEXT_MODE_HOME must be absolute");let s=Et(e||T(t,".codex-context-mode"));return{root:s,data:T(s,"data"),sessions:T(s,"data","sessions"),content:T(s,"data","content"),stats:T(s,"data","stats"),memory:T(s,"data","memory"),cache:T(s,"cache"),logs:T(s,"logs"),temporary:T(s,"cache","tmp")}}function N(n){let t=rt(on(import.meta.url));for(let e of[process.env.PLUGIN_ROOT,process.env.CLAUDE_PLUGIN_ROOT,t,rt(t)]){if(!e)continue;let s;try{s=JSON.parse(Ze(T(e,"package.json"),"utf8"))}catch{continue}if(s.name!==Wt)continue;let r=sn(Ht(e),Ht(n));if(r===""||r!==".."&&!r.startsWith(".."+rn)&&!Bt(r))throw new Error("Plugin data must not be written inside the code installation: "+n)}}function ot(){let n=R().temporary;return N(n),Qe(n,{recursive:!0}),n}var Wt,U=ft(()=>{"use strict";Wt="codex-context-mode"});import{createRequire as an}from"node:module";import{existsSync as cn,unlinkSync as Xt,renameSync as ln}from"node:fs";import{join as un}from"node:path";function dn(n){let t=null;try{return t=new n(":memory:"),t.exec("CREATE VIRTUAL TABLE __fts5_probe USING fts5(x)"),!0}catch{return!1}finally{try{t?.close()}catch{}}}function hn(n,t){let e=t!==void 0?t:globalThis.Bun;if(typeof e<"u"&&e!==null)return!0;let s=n??process.versions,[r,o]=(s.node??"0.0.0").split("."),i=Number(r),a=Number(o);return!Number.isFinite(i)||!Number.isFinite(a)?!1:i>22||i===22&&a>=5}function G(){if(!F){let n=an(import.meta.url);if(globalThis.Bun){let t=n(["bun","sqlite"].join(":")).Database;F=function(s,r){let o=new t(s,{readonly:r?.readonly,create:!0}),i=new St(o);return r?.timeout&&i.pragma(`busy_timeout = ${r.timeout}`),i}}else if(hn()){let t=null;try{({DatabaseSync:t}=n(["node","sqlite"].join(":")))}catch{t=null}t&&dn(t)?F=function(s,r){let o=new t(s,{readOnly:r?.readonly??!1}),i=new _t(o);return r?.timeout&&i.pragma(`busy_timeout = ${r.timeout}`),i}:F=n("better-sqlite3")}else F=n("better-sqlite3")}return F}function W(n){n.pragma("journal_mode = WAL"),n.pragma("synchronous = NORMAL");try{n.pragma("mmap_size = 268435456")}catch{}}function X(n){if(!cn(n))for(let t of["-wal","-shm"])try{Xt(n+t)}catch{}}function bt(n){for(let t of["","-wal","-shm"])try{Xt(n+t)}catch{}}function V(n){try{n.pragma("wal_checkpoint(TRUNCATE)")}catch{}try{n.close()}catch{}}function Vt(n="context-mode"){return un(ot(),`${n}-${process.pid}.db`)}function D(n,t=[100,500,2e3]){let e;for(let s=0;s<=t.length;s++)try{return n()}catch(r){let o=r instanceof Error?r.message:String(r);if(!o.includes("SQLITE_BUSY")&&!o.includes("database is locked"))throw r;if(e=r instanceof Error?r:new Error(o),s<t.length){let i=t[s],a=Date.now();for(;Date.now()-a<i;);}}throw new Error(`SQLITE_BUSY: database is locked after ${t.length} retries. Original error: ${e?.message}`)}function Rt(n){return n.includes("SQLITE_CORRUPT")||n.includes("SQLITE_NOTADB")||n.includes("database disk image is malformed")||n.includes("file is not a database")}function pn(n){let t=Date.now();for(let e of["","-wal","-shm"])try{ln(n+e,`${n}${e}.corrupt-${t}`)}catch{}}var St,_t,F,B,yt,it,at=ft(()=>{"use strict";U();St=class{#t;constructor(t){this.#t=t}pragma(t){let s=this.#t.prepare(`PRAGMA ${t}`).all();if(!s||s.length===0)return;if(s.length>1)return s;let r=Object.values(s[0]);return r.length===1?r[0]:s[0]}exec(t){let e="",s=null;for(let o=0;o<t.length;o++){let i=t[o];if(s)e+=i,i===s&&(s=null);else if(i==="'"||i==='"')e+=i,s=i;else if(i===";"){let a=e.trim();a&&this.#t.prepare(a).run(),e=""}else e+=i}let r=e.trim();return r&&this.#t.prepare(r).run(),this}prepare(t){let e=this.#t.prepare(t);return{run:(...s)=>e.run(...s),get:(...s)=>{let r=e.get(...s);return r===null?void 0:r},all:(...s)=>e.all(...s),iterate:(...s)=>e.iterate(...s)}}transaction(t){return this.#t.transaction(t)}close(){this.#t.close()}},_t=class{#t;constructor(t){this.#t=t}pragma(t){let s=this.#t.prepare(`PRAGMA ${t}`).all();if(!s||s.length===0)return;if(s.length>1)return s;let r=Object.values(s[0]);return r.length===1?r[0]:s[0]}exec(t){return this.#t.exec(t),this}prepare(t){let e=this.#t.prepare(t);return{run:(...s)=>e.run(...s),get:(...s)=>e.get(...s),all:(...s)=>e.all(...s),iterate:(...s)=>typeof e.iterate=="function"?e.iterate(...s):e.all(...s)[Symbol.iterator]()}}transaction(t){return(...e)=>{this.#t.exec("BEGIN");try{let s=t(...e);return this.#t.exec("COMMIT"),s}catch(s){throw this.#t.exec("ROLLBACK"),s}}}close(){this.#t.close()}},F=null;B=Symbol.for("__context_mode_live_dbs_v3__"),yt=(()=>{let n=globalThis;return n[B]||(n[B]=new Set,process.on("exit",()=>{for(let t of n[B])V(t);n[B].clear()})),n[B]})(),it=class{#t;#e;constructor(t){t!==":memory:"&&N(t);let e=G();this.#t=t,X(t);let s;try{s=new e(t,{timeout:3e4}),W(s)}catch(r){let o=r instanceof Error?r.message:String(r);if(Rt(o)){pn(t),X(t);try{s=new e(t,{timeout:3e4}),W(s)}catch(i){throw new Error(`Failed to create fresh DB after renaming corrupt file: ${i instanceof Error?i.message:String(i)}`)}}else throw r}this.#e=s,yt.add(this.#e),this.initSchema(),this.prepareStatements()}get db(){return this.#e}get dbPath(){return this.#t}close(){yt.delete(this.#e),V(this.#e)}withRetry(t){return D(t)}cleanup(){yt.delete(this.#e),V(this.#e),bt(this.#t)}}});var oe={};ze(oe,{SessionDB:()=>Tt,StorageDirectoryError:()=>$,_resetWorktreeSuffixCacheForTests:()=>Pn,applyMissingSessionEventsColumns:()=>vt,clearStorageDirectoryCheckCacheForTests:()=>Nn,describeStorageDirectorySource:()=>wn,ensureSessionEventsSchema:()=>$n,ensureWritableStorageDir:()=>Ct,formatStorageDirectoryError:()=>vn,getWorktreeSuffix:()=>se,hashProjectDirCanonical:()=>L,hashProjectDirLegacy:()=>Mn,normalizeWorktreePath:()=>A,resolveContentStorageDir:()=>kt,resolveContentStorePath:()=>Un,resolveDefaultSessionDir:()=>Rn,resolveSessionDbPath:()=>Fn,resolveSessionPath:()=>re,resolveSessionStorageDir:()=>xt,resolveStatsStorageDir:()=>Cn});import{createHash as K}from"node:crypto";import{execFileSync as gn}from"node:child_process";import{accessSync as mn,constants as fn,mkdirSync as En,realpathSync as yn}from"node:fs";import{dirname as Sn,isAbsolute as _n,join as z,resolve as Qt}from"node:path";function Rn(n){return R(n.env??process.env).sessions}function Tn(n,t,e){return new $(n,t,x,void 0,[`Invalid ${x} for codex-context-mode ${n} directory: ${e}`,ee()].join(`
`))}function Zt(n){let t=process.env[x];if(t===void 0)return{kind:"unset"};let e=t.trim();if(!e)return{kind:"ignored-empty",ignoredEnvVar:x,ignoredReason:"empty"};if(!_n(e))throw Tn(n,e,`${x} must be an absolute path.`);return{kind:"override",root:Qt(e)}}function xn(n){return n.kind==="ignored-empty"?{ignoredEnvVar:n.ignoredEnvVar,ignoredReason:n.ignoredReason}:{}}function te(n,t){let e=Zt(n);return e.kind!=="override"?null:{kind:n,path:z(e.root,"data",t),envVar:x,source:"override"}}function kn(n,t,e){return{kind:n,path:Qt(t()),envVar:null,source:"default",...e}}function xt(n){let t=Zt("session");return t.kind==="override"?{kind:"session",path:z(t.root,"data",bn),envVar:x,source:"override"}:kn("session",n,xn(t))}function kt(n){let t=te("content",Gt);if(t)return t;let e=xt(n);return{kind:"content",path:z(Sn(e.path),Gt),envVar:e.envVar,source:e.source,ignoredEnvVar:e.ignoredEnvVar,ignoredReason:e.ignoredReason}}function Cn(n){let t=te("stats","stats");if(t)return t;let e=xt(n);return{kind:"stats",path:e.path===R().sessions?R().stats:e.path,envVar:e.envVar,source:e.source,ignoredEnvVar:e.ignoredEnvVar,ignoredReason:e.ignoredReason}}function vn(n){return n.message}function wn(n){return n.source==="override"&&n.envVar?`via ${n.envVar}`:n.ignoredEnvVar&&n.ignoredReason==="empty"?`default; ignored empty ${n.ignoredEnvVar}`:"default"}function Nn(){lt.clear()}function Ct(n){N(n.path);let t=[n.kind,n.path,n.source,n.envVar??"",n.ignoredEnvVar??"",n.ignoredReason??""].join("\0"),e=lt.get(t);if(e instanceof $)throw e;if(e===n.path)return e;try{return En(n.path,{recursive:!0}),mn(n.path,fn.W_OK),lt.set(t,n.path),n.path}catch(s){let r=new $(n.kind,Ln(s)??n.path,x,s,void 0,{ignoredEnvVar:n.ignoredEnvVar,ignoredReason:n.ignoredReason});throw lt.set(t,r),r}}function Dn(n,t,e={}){return[`codex-context-mode ${n} directory is not writable: ${t}`,An(e),ee()].filter(Boolean).join(`
`)}function An(n){return n.ignoredEnvVar&&n.ignoredReason==="empty"?`Ignored empty ${n.ignoredEnvVar}; using adapter default.`:null}function ee(){return`Set ${x} to a writable absolute path.`}function Ln(n){if(!n||typeof n!="object")return null;let t=n.path;return typeof t=="string"&&t.length>0?t:null}function A(n){let t=n.replace(/\\/g,"/");return/^\/+$/.test(t)?"/":/^[A-Za-z]:\/+$/.test(t)?`${t.slice(0,2)}/`:t.replace(/\/+$/,"")}function J(n){let t=A(n);return process.platform==="win32"||process.platform==="darwin"?t.toLowerCase():t}function Kt(n){let t=n;try{t=yn.native(n)}catch{}let e=A(t);return process.platform==="win32"||process.platform==="darwin"?e.toLowerCase():e}function ne(n,t){return gn("git",["-C",n,...t],{encoding:"utf-8",timeout:2e3,stdio:["ignore","pipe","ignore"]}).trim()}function On(n){let t=ne(n,["rev-parse","--show-toplevel"]);return t.length>0?A(t):null}function In(n){let t=ne(n,["worktree","list","--porcelain"]).split(/\r?\n/).find(e=>e.startsWith("worktree "))?.replace("worktree ","")?.trim();return t?A(t):null}function se(n=process.cwd()){let t=process.env.CONTEXT_MODE_SESSION_SUFFIX;if(j&&j.projectDir===n&&j.envSuffix===t)return j.suffix;let e="";if(t!==void 0)e=t?`__${t}`:"";else try{let s=On(n),r=In(n);if(s&&r){let o=Kt(s),i=Kt(r);o!==i&&(e=`__${K("sha256").update(o).digest("hex").slice(0,8)}`)}}catch{}return j={projectDir:n,envSuffix:t,suffix:e},e}function Pn(){j=void 0}function Mn(n){return K("sha256").update(A(n)).digest("hex").slice(0,16)}function L(n){return K("sha256").update(J(n)).digest("hex").slice(0,16)}function Un(n){return z(n.contentDir,L(n.projectDir)+".db")}function Fn(n){return re({...n,ext:".db"})}function re(n){let t=n.suffix??se(n.projectDir);return z(n.sessionsDir,L(n.projectDir)+t+n.ext)}function ct(n){let t=Number(n);return!Number.isFinite(t)||t<=0?0:Math.floor(t)}function vt(n){let t=n.pragma("table_xinfo(session_events)"),e=new Set(t.map(r=>r.name)),s=!1;for(let[r,o]of jn)e.has(r)||(n.exec(`ALTER TABLE session_events ADD COLUMN ${r} ${o}`),s=!0);return s&&n.exec("CREATE INDEX IF NOT EXISTS idx_session_events_project ON session_events(session_id, project_dir)"),s}function $n(n,t){let e=null;try{e=new t(n),vt(e)}catch{}finally{try{e?.close()}catch{}}}var x,bn,Gt,$,lt,j,Y,Yt,Jt,zt,qt,p,jn,Tt,q=ft(()=>{"use strict";at();U();x="CODEX_CONTEXT_MODE_HOME",bn="sessions",Gt="content",$=class extends Error{kind;path;overrideEnvVar;ignoredEnvVar;ignoredReason;constructor(t,e,s=x,r,o,i={}){super(o??Dn(t,e,i),{cause:r}),this.name="StorageDirectoryError",this.kind=t,this.path=e,this.overrideEnvVar=s,this.ignoredEnvVar=i.ignoredEnvVar,this.ignoredReason=i.ignoredReason}},lt=new Map;Y="REPLACE(project_dir, '\\', '/')",Yt=`CASE
  WHEN RTRIM(${Y}, '/') = '' AND project_dir <> '' THEN '/'
  WHEN LENGTH(RTRIM(${Y}, '/')) = 2
    AND SUBSTR(${Y}, 2, 2) = ':/'
    THEN SUBSTR(${Y}, 1, 2) || '/'
  ELSE RTRIM(${Y}, '/') END`,Jt=process.platform==="win32"||process.platform==="darwin"?`LOWER(${Yt})`:Yt;zt=1e3,qt=5;p={insertEvent:"insertEvent",getEvents:"getEvents",getEventsByType:"getEventsByType",getEventsByPriority:"getEventsByPriority",getEventsByTypeAndPriority:"getEventsByTypeAndPriority",getEventCount:"getEventCount",getLatestAttributedProject:"getLatestAttributedProject",checkDuplicate:"checkDuplicate",evictLowestPriority:"evictLowestPriority",updateMetaLastEvent:"updateMetaLastEvent",ensureSession:"ensureSession",getSessionStats:"getSessionStats",getSessionRollup:"getSessionRollup",getMaxFileEdits:"getMaxFileEdits",getLatestCommitMessage:"getLatestCommitMessage",incrementCompactCount:"incrementCompactCount",getUsageCursor:"getUsageCursor",setUsageCursor:"setUsageCursor",compareUsageCursor:"compareUsageCursor",upsertResume:"upsertResume",getResume:"getResume",markResumeConsumed:"markResumeConsumed",claimLatestUnconsumedResume:"claimLatestUnconsumedResume",deleteEvents:"deleteEvents",deleteMeta:"deleteMeta",deleteResume:"deleteResume",getOldSessions:"getOldSessions",searchEvents:"searchEvents",incrementToolCall:"incrementToolCall",getToolCallTotals:"getToolCallTotals",getToolCallByTool:"getToolCallByTool",getEventBytesSummary:"getEventBytesSummary"},jn=[["project_dir","TEXT NOT NULL DEFAULT ''"],["attribution_source","TEXT NOT NULL DEFAULT 'unknown'"],["attribution_confidence","REAL NOT NULL DEFAULT 0"],["bytes_avoided","INTEGER NOT NULL DEFAULT 0"],["bytes_returned","INTEGER NOT NULL DEFAULT 0"]];Tt=class extends it{constructor(t){super(t?.dbPath??Vt("session"))}stmt(t){return this.stmts.get(t)}initSchema(){try{let e=this.db.pragma("table_xinfo(session_events)").find(s=>s.name==="data_hash");e&&e.hidden!==0&&this.db.exec("DROP TABLE session_events")}catch{}this.db.exec(`
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
    `);try{vt(this.db)}catch{}try{this.db.pragma("table_xinfo(session_meta)").some(e=>e.name==="usage_cursor")||this.db.exec("ALTER TABLE session_meta ADD COLUMN usage_cursor TEXT")}catch{}}prepareStatements(){this.stmts=new Map;let t=(e,s)=>{this.stmts.set(e,this.db.prepare(s))};t(p.insertEvent,`INSERT INTO session_events (
         session_id, type, category, priority, data,
         project_dir, attribution_source, attribution_confidence,
         bytes_avoided, bytes_returned,
         source_hook, data_hash
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),t(p.getEvents,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? ORDER BY id ASC LIMIT ?`),t(p.getEventsByType,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? AND type = ? ORDER BY id ASC LIMIT ?`),t(p.getEventsByPriority,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? AND priority >= ? ORDER BY id ASC LIMIT ?`),t(p.getEventsByTypeAndPriority,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? AND type = ? AND priority >= ? ORDER BY id ASC LIMIT ?`),t(p.getEventCount,"SELECT COUNT(*) AS cnt FROM session_events WHERE session_id = ?"),t(p.getLatestAttributedProject,`SELECT project_dir
       FROM session_events
       WHERE session_id = ? AND project_dir != ''
       ORDER BY id DESC
       LIMIT 1`),t(p.checkDuplicate,`SELECT 1 FROM (
         SELECT type, data_hash FROM session_events
         WHERE session_id = ? ORDER BY id DESC LIMIT ?
       ) AS recent
       WHERE recent.type = ? AND recent.data_hash = ?
       LIMIT 1`),t(p.evictLowestPriority,`DELETE FROM session_events WHERE id = (
         SELECT id FROM session_events WHERE session_id = ?
         ORDER BY priority ASC, id ASC LIMIT 1
       )`),t(p.updateMetaLastEvent,`UPDATE session_meta
       SET last_event_at = datetime('now'), event_count = event_count + 1
       WHERE session_id = ?`),t(p.ensureSession,"INSERT OR IGNORE INTO session_meta (session_id, project_dir) VALUES (?, ?)"),t(p.getSessionStats,`SELECT session_id, project_dir, started_at, last_event_at, event_count, compact_count
       FROM session_meta WHERE session_id = ?`),t(p.getSessionRollup,`SELECT
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
       WHERE session_id = ?`),t(p.getMaxFileEdits,`SELECT COALESCE(MAX(c), 0) AS max_file_edits
       FROM (
         SELECT COUNT(*) AS c
         FROM session_events
         WHERE session_id = ? AND category = 'file' AND type IN ('file_edit', 'file_write')
         GROUP BY data
       )`),t(p.getLatestCommitMessage,`SELECT data
       FROM session_events
       WHERE session_id = ? AND type = 'git_commit'
       ORDER BY id DESC
       LIMIT 1`),t(p.incrementCompactCount,"UPDATE session_meta SET compact_count = compact_count + 1 WHERE session_id = ?"),t(p.getUsageCursor,"SELECT usage_cursor FROM session_meta WHERE session_id = ?"),t(p.setUsageCursor,"UPDATE session_meta SET usage_cursor = ? WHERE session_id = ?"),t(p.compareUsageCursor,"UPDATE session_meta SET usage_cursor = ? WHERE session_id = ? AND usage_cursor IS ?"),t(p.upsertResume,`INSERT INTO session_resume (session_id, snapshot, event_count)
       VALUES (?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         snapshot = excluded.snapshot,
         event_count = excluded.event_count,
         created_at = datetime('now'),
         consumed = 0`),t(p.getResume,"SELECT snapshot, event_count, consumed FROM session_resume WHERE session_id = ?"),t(p.markResumeConsumed,"UPDATE session_resume SET consumed = 1 WHERE session_id = ?"),t(p.claimLatestUnconsumedResume,`UPDATE session_resume
       SET consumed = 1
       WHERE id = (
         SELECT id FROM session_resume
         WHERE consumed = 0
           AND session_id != ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1
       )
       RETURNING session_id, snapshot`),t(p.deleteEvents,"DELETE FROM session_events WHERE session_id = ?"),t(p.deleteMeta,"DELETE FROM session_meta WHERE session_id = ?"),t(p.deleteResume,"DELETE FROM session_resume WHERE session_id = ?"),t(p.searchEvents,`SELECT id, session_id, category, type, data, created_at
       FROM session_events
       WHERE (${Jt} = ? OR project_dir = '')
         AND (data LIKE '%' || ? || '%' ESCAPE '\\' OR category LIKE '%' || ? || '%' ESCAPE '\\')
         AND (? IS NULL OR category = ?)
       ORDER BY id ASC
       LIMIT ?`),t(p.getOldSessions,"SELECT session_id FROM session_meta WHERE started_at < datetime('now', ? || ' days')"),t(p.incrementToolCall,`INSERT INTO tool_calls (session_id, tool, calls, bytes_returned)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(session_id, tool) DO UPDATE SET
         calls = calls + 1,
         bytes_returned = bytes_returned + excluded.bytes_returned,
         updated_at = datetime('now')`),t(p.getToolCallTotals,`SELECT COALESCE(SUM(calls), 0) AS calls,
              COALESCE(SUM(bytes_returned), 0) AS bytes_returned
       FROM tool_calls WHERE session_id = ?`),t(p.getToolCallByTool,`SELECT tool, calls, bytes_returned
       FROM tool_calls WHERE session_id = ? ORDER BY calls DESC`),t(p.getEventBytesSummary,`SELECT COALESCE(SUM(bytes_avoided), 0) AS bytes_avoided,
              COALESCE(SUM(bytes_returned), 0) AS bytes_returned
       FROM session_events WHERE session_id = ?`)}insertEvent(t,e,s="PostToolUse",r,o){let i=K("sha256").update(e.data).digest("hex").slice(0,16).toUpperCase(),a=String(r?.projectDir??e.project_dir??this._getSessionProjectDir(t)).trim(),u=String(r?.source??e.attribution_source??"unknown"),c=Number(r?.confidence??e.attribution_confidence??0),l=Number.isFinite(c)?Math.max(0,Math.min(1,c)):0,h=ct(o?.bytesAvoided),d=ct(o?.bytesReturned),g=this.db.transaction(()=>{if(this.stmt(p.checkDuplicate).get(t,qt,e.type,i))return;this.stmt(p.getEventCount).get(t).cnt>=zt&&this.stmt(p.evictLowestPriority).run(t),this.stmt(p.insertEvent).run(t,e.type,e.category,e.priority,e.data,a,u,l,h,d,s,i),this.stmt(p.updateMetaLastEvent).run(t)});this.withRetry(()=>g())}bulkInsertEvents(t,e,s="PostToolUse",r,o,i){if(i&&i.next===i.expected&&e.length>0)throw new Error("Usage cursor must advance before inserting usage");if((!e||e.length===0)&&!i)return!0;if(e.length===1&&!i)return this.insertEvent(t,e[0],s,r?.[0],o?.[0]),!0;let a=e.map((c,l)=>{let h=K("sha256").update(c.data).digest("hex").slice(0,16).toUpperCase(),d=r?.[l],g=String(d?.projectDir??c.project_dir??this._getSessionProjectDir(t)??"").trim(),f=g===""?"":A(g),m=String(d?.source??c.attribution_source??"unknown"),E=Number(d?.confidence??c.attribution_confidence??0),C=Number.isFinite(E)?Math.max(0,Math.min(1,E)):0,S=o?.[l],y=ct(S?.bytesAvoided),_=ct(S?.bytesReturned);return{event:c,dataHash:h,projectDir:f,attributionSource:m,attributionConfidence:C,bytesAvoided:y,bytesReturned:_}}),u=this.db.transaction(()=>{if(i&&this.stmt(p.compareUsageCursor).run(i.next,t,i.expected).changes!==1)return!1;let c=this.stmt(p.getEventCount).get(t).cnt;for(let l of a)!i&&this.stmt(p.checkDuplicate).get(t,qt,l.event.type,l.dataHash)||(c>=zt?this.stmt(p.evictLowestPriority).run(t):c++,this.stmt(p.insertEvent).run(t,l.event.type,l.event.category,l.event.priority,l.event.data,l.projectDir,l.attributionSource,l.attributionConfidence,l.bytesAvoided,l.bytesReturned,s,l.dataHash));return a.length>0&&this.stmt(p.updateMetaLastEvent).run(t),!0});return this.withRetry(()=>u())}getEvents(t,e){let s=e?.limit??1e3,r=e?.type,o=e?.minPriority;return r&&o!==void 0?this.stmt(p.getEventsByTypeAndPriority).all(t,r,o,s):r?this.stmt(p.getEventsByType).all(t,r,s):o!==void 0?this.stmt(p.getEventsByPriority).all(t,o,s):this.stmt(p.getEvents).all(t,s)}getEventCount(t){return this.stmt(p.getEventCount).get(t).cnt}getEventBytesSummary(t){let e=this.stmt(p.getEventBytesSummary).get(t);return{bytesAvoided:Number(e?.bytes_avoided??0),bytesReturned:Number(e?.bytes_returned??0)}}getLatestAttributedProjectDir(t){return this.stmt(p.getLatestAttributedProject).get(t)?.project_dir||null}_getSessionProjectDir(t){try{return this.db.prepare("SELECT project_dir FROM session_meta WHERE session_id = ?").get(t)?.project_dir||""}catch{return""}}searchEvents(t,e,s,r){try{let o=t.replace(/[%_]/g,a=>"\\"+a),i=r??null;if((process.platform==="win32"||process.platform==="darwin")&&/[^\x00-\x7f]/.test(s)){let a=["",...this.matchingProjectPaths(s)];return this.db.prepare(`SELECT id, session_id, category, type, data, created_at
          FROM session_events WHERE project_dir IN (${a.map(()=>"?").join(",")})
          AND (data LIKE '%' || ? || '%' ESCAPE '\\' OR category LIKE '%' || ? || '%' ESCAPE '\\')
          AND (? IS NULL OR category = ?) ORDER BY id ASC LIMIT ?`).all(...a,o,o,i,i,e)}return this.stmt(p.searchEvents).all(J(s),o,o,i,i,e)}catch{return[]}}getSessionIdsForProject(t){try{if((process.platform==="win32"||process.platform==="darwin")&&/[^\x00-\x7f]/.test(t)){let r=this.matchingProjectPaths(t);return r.length?this.db.prepare(`SELECT DISTINCT session_id FROM session_events
          WHERE project_dir IN (${r.map(()=>"?").join(",")})`).all(...r).map(i=>i.session_id):[]}let e=J(t);return this.db.prepare(`SELECT DISTINCT session_id
             FROM session_events
            WHERE ${Jt} = ?`).all(e).map(r=>r.session_id)}catch{return[]}}matchingProjectPaths(t){let e=J(t);return this.db.prepare("SELECT DISTINCT project_dir FROM session_events WHERE project_dir <> ''").all().map(r=>r.project_dir).filter(r=>J(r)===e)}ensureSession(t,e){this.stmt(p.ensureSession).run(t,e)}getSessionStats(t){return this.stmt(p.getSessionStats).get(t)??null}getSessionRollup(t){let e=this.stmt(p.getSessionRollup).get(t),s=this.stmt(p.getMaxFileEdits).get(t),r=this.stmt(p.getLatestCommitMessage).get(t),o=this.getSessionStats(t),i=(e?.tool_calls??0)>0?e?.unique_files??0:0,a=e?.errors??0,u=Math.min(i,a);return{tool_calls:e?.tool_calls??0,errors:e?.errors??0,unique_tools:e?.unique_tools??0,unique_files:e?.unique_files??0,max_file_edits:s?.max_file_edits??0,has_commit:e?.has_commit??0,commit_message:r?.data??"",edit_test_cycles:u,duration_min:e?.duration_min??0,compact_count:o?.compact_count??0,sources_indexed:e?.sources_indexed??0,total_chunks:e?.total_chunks??0,search_queries:e?.search_queries??0}}incrementCompactCount(t){this.stmt(p.incrementCompactCount).run(t)}getUsageCursor(t){return this.stmt(p.getUsageCursor).get(t)?.usage_cursor??null}setUsageCursor(t,e){this.stmt(p.setUsageCursor).run(e,t)}upsertResume(t,e,s){this.stmt(p.upsertResume).run(t,e,s??0)}getResume(t){return this.stmt(p.getResume).get(t)??null}markResumeConsumed(t){this.stmt(p.markResumeConsumed).run(t)}claimLatestUnconsumedResume(t){let e=this.stmt(p.claimLatestUnconsumedResume).get(t);return e?{sessionId:e.session_id,snapshot:e.snapshot}:null}getLatestSessionId(){try{return this.db.prepare("SELECT session_id FROM session_meta ORDER BY started_at DESC LIMIT 1").get()?.session_id??null}catch{return null}}incrementToolCall(t,e,s=0){let r=Number.isFinite(s)&&s>0?Math.round(s):0;try{this.stmt(p.incrementToolCall).run(t,e,r)}catch{}}getToolCallStats(t){try{let e=this.stmt(p.getToolCallTotals).get(t),s=this.stmt(p.getToolCallByTool).all(t),r={};for(let o of s)r[o.tool]={calls:o.calls,bytesReturned:o.bytes_returned};return{totalCalls:e?.calls??0,totalBytesReturned:e?.bytes_returned??0,byTool:r}}catch{return{totalCalls:0,totalBytesReturned:0,byTool:{}}}}deleteSession(t){this.db.transaction(()=>{this.stmt(p.deleteEvents).run(t),this.stmt(p.deleteResume).run(t),this.stmt(p.deleteMeta).run(t)})()}cleanupOldSessions(t=7){let e=`-${t}`,s=this.stmt(p.getOldSessions).all(e);for(let{session_id:r}of s)this.deleteSession(r);return s.length}pruneOrphanedEvents(){let t=this.db.prepare("DELETE FROM session_events WHERE session_id NOT IN (SELECT session_id FROM session_meta)").run();return Number(t.changes??0)}}});import{existsSync as Bs,statSync as Be}from"node:fs";import{resolve as st,dirname as Ot,join as Ue,basename as We,isAbsolute as Ws}from"node:path";import{fileURLToPath as Xe,pathToFileURL as Fe}from"node:url";import{execFileSync as ns}from"node:child_process";import{existsSync as fe,readFileSync as _e,readdirSync as Ee}from"node:fs";import{join as k}from"node:path";q();U();import{join as ie}from"node:path";import{accessSync as Hn,copyFileSync as Bn,constants as Wn,mkdirSync as Xn}from"node:fs";import{homedir as Vn}from"node:os";var ut=class{constructor(t){this.sessionDirSegments=t}sessionDirSegments;getSessionDir(){let t=R().sessions;return Xn(t,{recursive:!0}),t}getConfigDir(t){return ie(Vn(),...this.sessionDirSegments)}getInstructionFiles(){return["AGENTS.md","AGENTS.override.md"]}getMemoryDir(t){let e=R().memory;return t?ie(e,L(t)):e}backupSettings(){let t=this.getSettingsPath();try{Hn(t,Wn.R_OK);let e=t+".bak";return Bn(t,e),e}catch{return null}}};q();U();import{homedir as ae}from"node:os";import{resolve as wt}from"node:path";function dt(n=process.env){let t=n.CODEX_HOME;return t&&t.trim()!==""?t.startsWith("~")?wt(ae(),t.replace(/^~[/\\]?/,"")):wt(t):wt(ae(),".codex")}import{execFileSync as ce,execSync as Z}from"node:child_process";import{existsSync as tt}from"node:fs";var Gn=/^(bash|sh|zsh|dash|pwsh|powershell|cmd)(\.exe)?$/i;function le(n){let t=n.split(/[\\/]/);return t[t.length-1]??n}function Yn(n){return Gn.test(le(n))}function Jn(n){let t=n.toLowerCase().replace(/\//g,"\\");return/\\windows\\(?:system32|sysnative)\\bash\.exe$/.test(t)||/\\microsoft\\windowsapps\\bash\.exe$/.test(t)}function Kn(n){let t=n.toLowerCase().replace(/\//g,"\\");return/\\windows\\(?:system32|sysnative)\\cmd\.exe$/.test(t)}var O=process.platform==="win32";function Q(n){try{return Z(`where ${n}`,{encoding:"utf-8",stdio:"pipe"}).trim().split(/\r?\n/).map(t=>t.trim()).filter(Boolean)}catch{return[]}}function zn(){let n=["bun","node","tsx","ts-node","python3","python","py","bash","sh","pwsh","powershell","ruby","go","rustc","php","perl","Rscript","r","elixir","dotnet-script"],t=new Map(n.map(e=>[e.toLowerCase(),[]]));try{let e=process.env.PATHEXT?.toLowerCase().split(";");if(!e?.length||e.some(o=>!/^\.[a-z0-9]+$/.test(o)))return Q;let s=new Set(e),r=Z("where *",{encoding:"utf-8",stdio:"pipe",maxBuffer:4*1024*1024});for(let o of r.trim().split(/\r?\n/).map(i=>i.trim()).filter(Boolean)){let i=le(o).toLowerCase(),a=/\.[^.]+$/.exec(i)?.[0]??"";if(!t.has(i)&&!s.has(a))continue;let u=t.has(i)?i:i.slice(0,-a.length);t.get(u)?.push(o)}return o=>t.get(o.toLowerCase())??[]}catch(e){return e.status===1?()=>[]:Q}}function I(n){try{let t=O?`where ${n}`:`command -v ${n}`;return Z(t,{stdio:"pipe"}),!0}catch{return!1}}function Nt(n,t=Q){if(O){let e=t(n);if(e.length===0||e.filter(r=>!/\\Microsoft\\WindowsApps\\/i.test(r)).length===0)return!1}else if(!I(n))return!1;try{return O?Z(`"${n}" --version`,{stdio:"pipe",timeout:5e3}):ce(n,["--version"],{stdio:"pipe",timeout:1500}),!0}catch{return!1}}function qn(n=I){if(n("bun"))return!0;for(let t of ue())if(tt(t))return!0;return!1}function Qn(n=I){for(let e of ue())if(tt(e))return e;if(n("bun"))return"bun";let t=process.env.HOME??process.env.USERPROFILE??"";return O?`${t}\\.bun\\bin\\bun.exe`:`${t}/.bun/bin/bun`}function ue(){let n=process.env.HOME??process.env.USERPROFILE??"";if(O){let t=process.env.LOCALAPPDATA??"",e=process.env.APPDATA??"";return[...n?[`${n}\\.bun\\bin\\bun.exe`]:[],...t?[`${t}\\bun\\bin\\bun.exe`]:[],...e?[`${e}\\npm\\node_modules\\bun\\bin\\bun.exe`]:[]]}return n?[`${n}/.bun/bin/bun`]:[]}var Zn=["C:\\Program Files\\Git\\usr\\bin\\bash.exe","C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe"];function de(n=Q){let t=n("bash");for(let e of t){let s=e.toLowerCase();if(!(s.includes("system32")||s.includes("windowsapps"))){for(let r of Zn)if(tt(r))return r;return e}}return null}function ts(n=de(),t=I){return n??(t("sh")?"sh":t("pwsh")?"pwsh":t("powershell")?"powershell":"cmd.exe")}function b(n,t=["--version"]){try{if(process.platform==="win32"){let e=[n,...t].map(s=>/[\s"&|<>^()%!]/.test(s)?JSON.stringify(s):s).join(" ");return Z(e,{encoding:"utf-8",stdio:["pipe","pipe","pipe"],timeout:5e3}).trim().split(/\r?\n/)[0]}else return ce(n,t,{encoding:"utf-8",stdio:["pipe","pipe","pipe"],timeout:5e3}).trim().split(/\r?\n/)[0]}catch{return"unknown"}}function es(n,t={}){if(n)return n;let e=t.execPath??process.execPath,s=t.commandExists??I,r=e.split(/[\\/]/).pop().replace(/\.exe$/i,"");return ge.has(r)&&tt(e)?e:s("node")?"node":null}function he(){let n=O?zn():Q,t=O?u=>n(u).length>0:I,s=qn(t)?Qn(t):null,r=process.env.SHELL,o=process.platform==="win32",i=o?de(n):null,a=r&&tt(r)&&Yn(r)&&!(o&&Jn(r))&&!(o&&i&&Kn(r))?r:null;return{javascript:es(s,{commandExists:t}),typescript:s||(t("tsx")?"tsx":t("ts-node")?"ts-node":null),python:Nt("python3",n)?"python3":Nt("python",n)?"python":Nt("py",n)?"py":null,shell:a??(o?ts(i,t):I("bash")?"bash":"sh"),ruby:t("ruby")?"ruby":null,go:t("go")?"go":null,rust:t("rustc")?"rustc":null,php:t("php")?"php":null,perl:t("perl")?"perl":null,r:t("Rscript")?"Rscript":t("r")?"r":null,elixir:t("elixir")?"elixir":null,csharp:t("dotnet-script")?"dotnet-script":null}}function pe(n){let t=[],e=n.javascript?.endsWith("bun")??!1;return n.javascript?t.push(`  JavaScript: ${n.javascript} (${b(n.javascript)})${e?" \u26A1":""}`):t.push("  JavaScript: not available (install node or bun \u2014 host process is not a JS runtime)"),n.typescript?t.push(`  TypeScript: ${n.typescript} (${b(n.typescript)})`):t.push("  TypeScript: not available (install bun, tsx, or ts-node)"),n.python?t.push(`  Python:     ${n.python} (${b(n.python)})`):t.push("  Python:     not available"),t.push(`  Shell:      ${n.shell} (${b(n.shell)})`),n.ruby&&t.push(`  Ruby:       ${n.ruby} (${b(n.ruby)})`),n.go&&t.push(`  Go:         ${n.go} (${b(n.go,["version"])})`),n.rust&&t.push(`  Rust:       ${n.rust} (${b(n.rust)})`),n.php&&t.push(`  PHP:        ${n.php} (${b(n.php)})`),n.perl&&t.push(`  Perl:       ${n.perl} (${b(n.perl)})`),n.r&&t.push(`  R:          ${n.r} (${b(n.r)})`),n.elixir&&t.push(`  Elixir:     ${n.elixir} (${b(n.elixir)})`),n.csharp&&t.push(`  C#:         ${n.csharp} (${b(n.csharp)})`),e||(t.push(""),t.push("  Tip: Install Bun for 3-5x faster JS/TS execution \u2192 https://bun.sh")),t.join(`
`)}function me(n,t){let e=process.execPath.replace(/\\/g,"/"),s=n.replace(/\\/g,"/");return`"${e}" "${s}"`}var ge=new Set(["node","bun","deno"]);var ye={PreToolUse:"pre-tool-use",PostToolUse:"post-tool-use",SessionStart:"session-start",PreCompact:"pre-compact",UserPromptSubmit:"user-prompt-submit",Stop:"stop"},ss="local_shell|shell|shell_command|exec_command|Bash|Shell|apply_patch|Edit|Write|read_file|Read|grep_files|ctx_execute|ctx_execute_file|ctx_batch_execute|ctx_fetch_and_index|ctx_search|ctx_index|mcp__";function be(n=ns){try{return String(process.platform==="win32"?n("cmd.exe",["/d","/s","/c","codex --version"],{encoding:"utf8",stdio:["ignore","pipe","ignore"],timeout:5e3}):n("codex",["--version"],{encoding:"utf8",stdio:["ignore","pipe","ignore"],timeout:5e3})).trim()}catch{return null}}function Dt(n){try{return _e(n,"utf8")}catch{return""}}function rs(n){let t=[];for(let e of n.split(/\r?\n/)){let s=e.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);s?t.push({name:s[1].trim(),body:""}):t.length&&(t[t.length-1].body+=e+`
`)}return t}function Se(n){return/(?:codex-context-mode|context-mode|hooks[/\\]codex[/\\])/.test(n)}function os(n){try{for(let t of Ee(n,{withFileTypes:!0})){if(!t.isDirectory())continue;if(t.name==="context-mode"||Ee(k(n,t.name),{withFileTypes:!0}).some(s=>s.isDirectory()&&s.name==="context-mode"))return!0}}catch{}return!1}var et=class extends ut{constructor(t={}){super([".codex"])}name="Codex";paradigm="json-stdio";capabilities={preToolUse:!0,postToolUse:!0,preCompact:!0,sessionStart:!0,canModifyArgs:!1,canModifyOutput:!1,canInjectSessionContext:!0};parsePreToolUseInput(t){let e=t;return{toolName:e.tool_name??"",toolInput:e.tool_input??{},sessionId:this.extractSessionId(e),projectDir:this.getProjectDir(e),raw:t}}parsePostToolUseInput(t){let e=t;return{toolName:e.tool_name??"",toolInput:e.tool_input??{},toolOutput:e.tool_response,sessionId:this.extractSessionId(e),projectDir:this.getProjectDir(e),raw:t}}parsePreCompactInput(t){let e=t;return{sessionId:this.extractSessionId(e),projectDir:this.getProjectDir(e),raw:t}}parseSessionStartInput(t){let e=t,s=e.source??"startup",r;switch(s){case"compact":r="compact";break;case"resume":r="resume";break;case"clear":r="clear";break;default:r="startup"}return{sessionId:this.extractSessionId(e),source:r,projectDir:this.getProjectDir(e),raw:t}}formatPreToolUseResponse(t){return t.decision==="deny"?{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:t.reason??"Blocked by codex-context-mode hook"}}:t.decision==="context"&&t.additionalContext?{}:{}}formatPostToolUseResponse(t){return t.additionalContext?{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:t.additionalContext}}:{}}formatPreCompactResponse(t){return{}}formatSessionStartResponse(t){return t.context?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:t.context}}:{}}getConfigDir(t){return dt()}getSettingsPath(){return k(this.getConfigDir(),"config.toml")}getSessionDir(){return R().sessions}getInstructionFiles(){return["AGENTS.md","AGENTS.override.md"]}getMemoryDir(t){let e=R().memory;return t?k(e,L(t)):e}getProjectDir(t){return t?.cwd??process.env.CODEX_PROJECT_DIR??process.cwd()}getHooksPath(){return k(this.getConfigDir(),"hooks.json")}generateHookConfig(t){return Object.fromEntries(Object.entries(ye).map(([e,s])=>[e,[{matcher:e==="PreToolUse"?ss:"",hooks:[{type:"command",command:me(k(t,"hooks","codex",s+".mjs"))}]}]]))}readSettings(){return null}writeSettings(){throw new Error("Codex manages plugin configuration; no standalone installer is provided.")}configureAllHooks(){throw new Error("Install/enable codex-context-mode through Codex plugin management.")}backupSettings(){return null}setHookPermissions(){return[]}updatePluginRegistry(){throw new Error("Codex owns the plugin registry.")}getInstalledVersion(){return"plugin-managed"}getRoutingInstructions(){return"Use the bundled codex-context-mode:main skill and ctx_* MCP tools."}checkPluginRegistration(){let t=Dt(this.getSettingsPath()),e=rs(t),s=e.filter(i=>/^plugins\.(?:"codex-context-mode(?:@[^"]+)?"|'codex-context-mode(?:@[^']+)?'|codex-context-mode)$/.test(i.name)&&!/^\s*enabled\s*=\s*false/m.test(i.body)),r=e.some(i=>/^mcp_servers\.["']?(?:codex-context-mode|codex_context_mode|context-mode|context_mode)["']?(?:\.|$)/.test(i.name)),o=e.some(i=>/^plugins\.(?:"context-mode(?:@[^"]+)?"|'context-mode(?:@[^']+)?'|context-mode)$/.test(i.name));return r||s.length>1?{check:"MCP registration",status:"fail",message:"Duplicate/standalone codex-context-mode registrations; keep one codex-context-mode plugin."}:o?{check:"MCP registration",status:"fail",message:"Stale upstream context-mode plugin registration."}:{check:"MCP registration",status:s.length===1?"pass":"fail",message:s.length===1?"One codex-context-mode plugin enabled":"Install and enable codex-context-mode in Codex"}}validateHooks(t){let e=[this.checkPluginRegistration()],s=(c,l,h)=>e.push({check:c,status:l?"pass":"fail",message:h}),r;try{r=JSON.parse(_e(k(t,"hooks","hooks.json"),"utf8"))}catch{return s("Bundled hooks",!1,"Missing or invalid hooks/hooks.json"),e}s("Bundled hooks",Object.keys(r.hooks??{}).length===6,"Exactly six native Codex hooks required");for(let[c,l]of Object.entries(ye)){let h=r.hooks?.[c],d=h?.[0]?.hooks?.[0]?.command;s(c+" hook",h?.length===1&&h[0].hooks?.length===1&&typeof d=="string"&&d.includes("/hooks/codex/"+l+".mjs")&&fe(k(t,"hooks","codex",l+".mjs")),"Bundled "+c+" uses "+l+".mjs")}let i=Dt(this.getSettingsPath()).split(/\[\[hooks\./).slice(1).flatMap(c=>c.match(/^\s*command\s*=.*$/gm)??[]);s("Native user-hook duplicates",!i.some(Se),"No standalone codex-context-mode native hooks");let a=Dt(this.getHooksPath());if(a)try{let c=JSON.parse(a),l=Object.values(c.hooks??{}).flatMap(h=>Array.isArray(h)?h.flatMap(d=>(d.hooks??[]).map(g=>String(g.command??""))):[]);s("Standalone user hooks",!l.some(Se),"No separate codex-context-mode user hooks")}catch{s("Standalone user hooks",!1,"Invalid user hooks.json")}return s("Stale upstream installation",!os(k(this.getConfigDir(),"plugins","cache")),"No upstream context-mode cache in any marketplace"),s("Standalone skills",!["context-mode","ctx-doctor","ctx-index","ctx-search","ctx-stats","ctx-purge","ctx-upgrade","ctx-insight"].some(c=>fe(k(this.getConfigDir(),"skills",c))),"Skills are bundled, not installed separately"),e}extractSessionId(t){return t.session_id||"pid-"+process.ppid}};at();U();import{readFileSync as ve,unlinkSync as bs,existsSync as Rs,statSync as we,openSync as Ne,fstatSync as De,closeSync as Ae}from"node:fs";import{createHash as Le}from"node:crypto";import{join as Ts}from"node:path";import{readdirSync as is,statSync as as,lstatSync as cs,realpathSync as Re,existsSync as ls,readFileSync as us}from"node:fs";import{join as xe,extname as ds,relative as ke,sep as hs,resolve as ps}from"node:path";var gs=["node_modules",".git","dist","build",".next","coverage",".venv","__pycache__",".DS_Store"],ms=[".md",".mdx",".txt",".json",".yaml",".yml",".ts",".tsx",".js",".jsx",".py",".rs",".go",".sh"],fs=5,Es=200;function ys(n){let t="";for(let e=0;e<n.length;e++){let s=n[e];s==="*"?n[e+1]==="*"?(t+=".*",e++):t+="[^/]*":s==="?"?t+="[^/]":"\\^$.|+()[]{}".includes(s)?t+="\\"+s:t+=s}return new RegExp(`^${t}$`)}function Te(n,t){if(t.length===0)return!1;let e=n.split("/").pop()??n;for(let s of t){if(!s.includes("/")&&!s.includes("*")){if(e===s||n.split("/").includes(s))return!0;continue}let r=ys(s);if(r.test(n)||r.test(e))return!0}return!1}function Ss(n){let t=xe(n,".gitignore");if(!ls(t))return[];try{return us(t,"utf-8").split(/\r?\n/).map(s=>s.trim()).filter(s=>s.length>0&&!s.startsWith("#")&&!s.startsWith("!")).map(s=>s.replace(/^\//,"").replace(/\/$/,""))}catch{return[]}}function _s(n,t){return ke(n,t).split(hs).join("/")}function Ce(n,t={}){let{include:e,exclude:s,maxDepth:r=fs,maxFiles:o=Es,extensions:i,respectGitignore:a=!0,followSymlinks:u=!1}=t,c;try{c=Re(n)}catch{return{files:[],capped:!1,totalSeen:0}}let l=(i&&i.length>0?i:ms).map(S=>(S.startsWith(".")?S:"."+S).toLowerCase()),h=[...gs,...s??[],...a?Ss(c):[]],d=e??[],g=[],f=new Set([c]),m=0,E=!1;function C(S,y){if(E||y>r)return;let _;try{_=is(S,{withFileTypes:!0})}catch{return}for(let P of _){if(E)return;let M=xe(S,P.name),Mt=_s(c,M);if(Te(Mt,h))continue;let Ut=P.isDirectory(),Ft=P.isFile(),jt=!1;try{jt=cs(M).isSymbolicLink()}catch{continue}if(jt){if(!u)continue;let w;try{w=Re(M)}catch{continue}let mt=ke(c,w);if((mt.startsWith("..")||ps(mt)===w)&&mt.startsWith("..")||f.has(w))continue;f.add(w);try{let $t=as(w);Ut=$t.isDirectory(),Ft=$t.isFile()}catch{continue}}if(Ut){C(M,y+1);continue}if(!Ft)continue;let Je=ds(M).toLowerCase();if(l.includes(Je)&&!(d.length>0&&!Te(Mt,d))){if(m++,g.length>=o){E=!0;return}g.push(M)}}}return C(c,0),{files:g,capped:E,totalSeen:m}}var H=new Set(["the","and","for","are","but","not","you","all","can","had","her","was","one","our","out","has","his","how","its","may","new","now","old","see","way","who","did","get","got","let","say","she","too","use","will","with","this","that","from","they","been","have","many","some","them","than","each","make","like","just","over","such","take","into","year","your","good","could","would","about","which","their","there","other","after","should","through","also","more","most","only","very","when","what","then","these","those","being","does","done","both","same","still","while","where","here","were","much","update","updates","updated","deps","dev","tests","test","add","added","fix","fixed","run","running","using"]);function Ie(n){let t=new Set,e=[];for(let s of n){let r=s.toLowerCase();t.has(r)||(t.add(r),e.push(s))}return e}function xs(n,t="AND"){let e=Ie(n.replace(/['"(){}[\]*:^~]/g," ").split(/\s+/).filter(o=>o.length>0&&!["AND","OR","NOT","NEAR"].includes(o.toUpperCase())));if(e.length===0)return'""';let s=e.filter(o=>!H.has(o.toLowerCase()));return(s.length>0?s:e).map(o=>`"${o}"`).join(t==="OR"?" OR ":" ")}function ks(n,t="AND"){let e=n.replace(/["'(){}[\]*:^~]/g,"").trim();if(e.length<3)return"";let s=Ie(e.split(/\s+/).filter(i=>i.length>=3));if(s.length===0)return"";let r=s.filter(i=>!H.has(i.toLowerCase()));return(r.length>0?r:s).map(i=>`"${i}"`).join(t==="OR"?" OR ":" ")}function Cs(n,t){if(n.length===0)return t.length;if(t.length===0)return n.length;let e=Array.from({length:t.length+1},(s,r)=>r);for(let s=1;s<=n.length;s++){let r=[s];for(let o=1;o<=t.length;o++)r[o]=n[s-1]===t[o-1]?e[o-1]:1+Math.min(e[o],r[o-1],e[o-1]);e=r}return e[t.length]}function vs(n){return n<=4?1:n<=12?2:3}var ht=4096,ws=3,Ns=200,Ds=5e3,Oe=80,As=.5;function Ls(n,t){let e=[],s=n.indexOf(t);for(;s!==-1;)e.push(s),s=n.indexOf(t,s+1);return e}function Os(n,t,e=30){if(n.length<2||t.length<2)return 0;let s=0,r=Math.min(n.length,t.length)-1;for(let o=0;o<r;o++){let i=n[o],a=n[o+1],u=t[o].length,c=0;for(let l of i){let h=l+u,d=h+e;for(;c<a.length&&a[c]<h;)c++;c<a.length&&a[c]<=d&&(s++,c++)}}return s}function Is(n){if(n.length===0)return 1/0;if(n.length===1)return 0;let t=n,e=new Array(t.length).fill(0),s=1/0;for(;;){let r=1/0,o=-1/0,i=0;for(let u=0;u<t.length;u++){let c=t[u][e[u]];c<r&&(r=c,i=u),c>o&&(o=c)}let a=o-r;if(a<s&&(s=a),e[i]++,e[i]>=t[i].length)break}return s}var pt=class n{#t;#e;#o;#a;#c;#l;#u;#d;#h;#p;#g;#m;#f;#E;#y;#S;#_;#b;#R;#T;#x;#k;#C;#v;#w;#N;#D;#A;#L;#O;#I;#P;#M;#U;#F=0;static OPTIMIZE_EVERY=50;#n=new Map;static FUZZY_CACHE_SIZE=256;constructor(t){let e=G();this.#e=t??Ts(ot(),`content-${process.pid}.db`),this.#e!==":memory:"&&N(this.#e),X(this.#e);let s;try{s=new e(this.#e,{timeout:3e4}),W(s)}catch(r){let o=r instanceof Error?r.message:String(r);if(Rt(o)){bt(this.#e),X(this.#e);try{s=new e(this.#e,{timeout:3e4}),W(s)}catch(i){throw new Error(`Failed to create fresh DB after deleting corrupt file: ${i instanceof Error?i.message:String(i)}`)}}else throw r}this.#t=s,this.#X(),this.#V()}cleanup(){try{this.#t.close()}catch{}for(let t of["","-wal","-shm"])try{bs(this.#e+t)}catch{}}#X(){this.#t.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        code_chunk_count INTEGER NOT NULL DEFAULT 0,
        indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
        file_path TEXT,
        content_hash TEXT
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
        title,
        content,
        source_id UNINDEXED,
        content_type UNINDEXED,
        source_category UNINDEXED,
        session_id UNINDEXED,
        event_id UNINDEXED,
        timestamp UNINDEXED,
        tokenize='porter unicode61'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_trigram USING fts5(
        title,
        content,
        source_id UNINDEXED,
        content_type UNINDEXED,
        source_category UNINDEXED,
        session_id UNINDEXED,
        event_id UNINDEXED,
        timestamp UNINDEXED,
        tokenize='trigram'
      );

      CREATE TABLE IF NOT EXISTS vocabulary (
        word TEXT PRIMARY KEY
      );

      CREATE INDEX IF NOT EXISTS idx_sources_label ON sources(label);
    `);try{let t=this.#t.prepare("SELECT name FROM pragma_table_xinfo('chunks')").all(),e=new Set(t.map(s=>s.name));t.length>0&&!e.has("source_category")&&(this.#t.exec("DROP TABLE IF EXISTS chunks"),this.#t.exec("DROP TABLE IF EXISTS chunks_trigram"),this.#t.exec(`
          CREATE VIRTUAL TABLE chunks USING fts5(
            title,
            content,
            source_id UNINDEXED,
            content_type UNINDEXED,
            source_category UNINDEXED,
            session_id UNINDEXED,
            event_id UNINDEXED,
            timestamp UNINDEXED,
            tokenize='porter unicode61'
          );
          CREATE VIRTUAL TABLE chunks_trigram USING fts5(
            title,
            content,
            source_id UNINDEXED,
            content_type UNINDEXED,
            source_category UNINDEXED,
            session_id UNINDEXED,
            event_id UNINDEXED,
            timestamp UNINDEXED,
            tokenize='trigram'
          );
        `))}catch{}try{this.#t.exec("ALTER TABLE sources ADD COLUMN file_path TEXT")}catch{}try{this.#t.exec("ALTER TABLE sources ADD COLUMN content_hash TEXT")}catch{}}#V(){this.#a=this.#t.prepare("INSERT INTO sources (label, chunk_count, code_chunk_count, file_path, content_hash) VALUES (?, 0, 0, ?, ?)"),this.#c=this.#t.prepare("INSERT INTO sources (label, chunk_count, code_chunk_count, file_path, content_hash) VALUES (?, ?, ?, ?, ?)"),this.#l=this.#t.prepare("INSERT INTO chunks (title, content, source_id, content_type, source_category, session_id, event_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),this.#u=this.#t.prepare("INSERT INTO chunks_trigram (title, content, source_id, content_type, source_category, session_id, event_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),this.#d=this.#t.prepare("INSERT OR IGNORE INTO vocabulary (word) VALUES (?)"),this.#h=this.#t.prepare("SELECT 1 FROM sources WHERE label = ? AND id <> ? LIMIT 1"),this.#p=this.#t.prepare("DELETE FROM chunks WHERE source_id IN (SELECT id FROM sources WHERE label = ?)"),this.#g=this.#t.prepare("DELETE FROM chunks_trigram WHERE source_id IN (SELECT id FROM sources WHERE label = ?)"),this.#m=this.#t.prepare("DELETE FROM sources WHERE label = ? AND id <> ?"),this.#f=this.#t.prepare(`
      SELECT
        chunks.title,
        chunks.content,
        chunks.content_type,
        chunks.timestamp,
        sources.label,
        bm25(chunks, 5.0, 1.0) AS rank,
        highlight(chunks, 1, char(2), char(3)) AS highlighted,
        chunks.session_id
      FROM chunks
      JOIN sources ON sources.id = chunks.source_id
      WHERE chunks MATCH ?
      ORDER BY rank
      LIMIT ?
    `),this.#E=this.#t.prepare(`
      SELECT
        chunks.title,
        chunks.content,
        chunks.content_type,
        chunks.timestamp,
        sources.label,
        bm25(chunks, 5.0, 1.0) AS rank,
        highlight(chunks, 1, char(2), char(3)) AS highlighted,
        chunks.session_id
      FROM chunks
      JOIN sources ON sources.id = chunks.source_id
      WHERE chunks MATCH ? AND sources.label LIKE ? ESCAPE '\\'
      ORDER BY rank
      LIMIT ?
    `),this.#y=this.#t.prepare(`
      SELECT
        chunks.title,
        chunks.content,
        chunks.content_type,
        chunks.timestamp,
        sources.label,
        bm25(chunks, 5.0, 1.0) AS rank,
        highlight(chunks, 1, char(2), char(3)) AS highlighted,
        chunks.session_id
      FROM chunks
      JOIN sources ON sources.id = chunks.source_id
      WHERE chunks MATCH ? AND sources.label = ?
      ORDER BY rank
      LIMIT ?
    `),this.#S=this.#t.prepare(`
      SELECT
        chunks_trigram.title,
        chunks_trigram.content,
        chunks_trigram.content_type,
        chunks_trigram.timestamp,
        sources.label,
        bm25(chunks_trigram, 5.0, 1.0) AS rank,
        highlight(chunks_trigram, 1, char(2), char(3)) AS highlighted,
        chunks_trigram.session_id
      FROM chunks_trigram
      JOIN sources ON sources.id = chunks_trigram.source_id
      WHERE chunks_trigram MATCH ?
      ORDER BY rank
      LIMIT ?
    `),this.#_=this.#t.prepare(`
      SELECT
        chunks_trigram.title,
        chunks_trigram.content,
        chunks_trigram.content_type,
        chunks_trigram.timestamp,
        sources.label,
        bm25(chunks_trigram, 5.0, 1.0) AS rank,
        highlight(chunks_trigram, 1, char(2), char(3)) AS highlighted,
        chunks_trigram.session_id
      FROM chunks_trigram
      JOIN sources ON sources.id = chunks_trigram.source_id
      WHERE chunks_trigram MATCH ? AND sources.label LIKE ? ESCAPE '\\'
      ORDER BY rank
      LIMIT ?
    `),this.#b=this.#t.prepare(`
      SELECT
        chunks_trigram.title,
        chunks_trigram.content,
        chunks_trigram.content_type,
        chunks_trigram.timestamp,
        sources.label,
        bm25(chunks_trigram, 5.0, 1.0) AS rank,
        highlight(chunks_trigram, 1, char(2), char(3)) AS highlighted,
        chunks_trigram.session_id
      FROM chunks_trigram
      JOIN sources ON sources.id = chunks_trigram.source_id
      WHERE chunks_trigram MATCH ? AND sources.label = ?
      ORDER BY rank
      LIMIT ?
    `),this.#T=this.#t.prepare(`
      SELECT
        chunks.title,
        chunks.content,
        chunks.content_type,
        chunks.timestamp,
        sources.label,
        bm25(chunks, 5.0, 1.0) AS rank,
        highlight(chunks, 1, char(2), char(3)) AS highlighted,
        chunks.session_id
      FROM chunks
      JOIN sources ON sources.id = chunks.source_id
      WHERE chunks MATCH ? AND chunks.content_type = ?
      ORDER BY rank
      LIMIT ?
    `),this.#x=this.#t.prepare(`
      SELECT
        chunks.title,
        chunks.content,
        chunks.content_type,
        chunks.timestamp,
        sources.label,
        bm25(chunks, 5.0, 1.0) AS rank,
        highlight(chunks, 1, char(2), char(3)) AS highlighted,
        chunks.session_id
      FROM chunks
      JOIN sources ON sources.id = chunks.source_id
      WHERE chunks MATCH ? AND sources.label LIKE ? ESCAPE '\\' AND chunks.content_type = ?
      ORDER BY rank
      LIMIT ?
    `),this.#k=this.#t.prepare(`
      SELECT
        chunks.title,
        chunks.content,
        chunks.content_type,
        chunks.timestamp,
        sources.label,
        bm25(chunks, 5.0, 1.0) AS rank,
        highlight(chunks, 1, char(2), char(3)) AS highlighted,
        chunks.session_id
      FROM chunks
      JOIN sources ON sources.id = chunks.source_id
      WHERE chunks MATCH ? AND sources.label = ? AND chunks.content_type = ?
      ORDER BY rank
      LIMIT ?
    `),this.#C=this.#t.prepare(`
      SELECT
        chunks_trigram.title,
        chunks_trigram.content,
        chunks_trigram.content_type,
        chunks_trigram.timestamp,
        sources.label,
        bm25(chunks_trigram, 5.0, 1.0) AS rank,
        highlight(chunks_trigram, 1, char(2), char(3)) AS highlighted,
        chunks_trigram.session_id
      FROM chunks_trigram
      JOIN sources ON sources.id = chunks_trigram.source_id
      WHERE chunks_trigram MATCH ? AND chunks_trigram.content_type = ?
      ORDER BY rank
      LIMIT ?
    `),this.#v=this.#t.prepare(`
      SELECT
        chunks_trigram.title,
        chunks_trigram.content,
        chunks_trigram.content_type,
        chunks_trigram.timestamp,
        sources.label,
        bm25(chunks_trigram, 5.0, 1.0) AS rank,
        highlight(chunks_trigram, 1, char(2), char(3)) AS highlighted,
        chunks_trigram.session_id
      FROM chunks_trigram
      JOIN sources ON sources.id = chunks_trigram.source_id
      WHERE chunks_trigram MATCH ? AND sources.label LIKE ? ESCAPE '\\' AND chunks_trigram.content_type = ?
      ORDER BY rank
      LIMIT ?
    `),this.#w=this.#t.prepare(`
      SELECT
        chunks_trigram.title,
        chunks_trigram.content,
        chunks_trigram.content_type,
        chunks_trigram.timestamp,
        sources.label,
        bm25(chunks_trigram, 5.0, 1.0) AS rank,
        highlight(chunks_trigram, 1, char(2), char(3)) AS highlighted,
        chunks_trigram.session_id
      FROM chunks_trigram
      JOIN sources ON sources.id = chunks_trigram.source_id
      WHERE chunks_trigram MATCH ? AND sources.label = ? AND chunks_trigram.content_type = ?
      ORDER BY rank
      LIMIT ?
    `),this.#R=this.#t.prepare("SELECT word FROM vocabulary WHERE length(word) BETWEEN ? AND ?"),this.#N=this.#t.prepare("SELECT label, chunk_count as chunkCount FROM sources ORDER BY id DESC"),this.#D=this.#t.prepare(`SELECT c.title, c.content, c.content_type, s.label
       FROM chunks c
       JOIN sources s ON s.id = c.source_id
       WHERE c.source_id = ?
       ORDER BY c.rowid`),this.#A=this.#t.prepare("SELECT chunk_count FROM sources WHERE id = ?"),this.#L=this.#t.prepare("SELECT content FROM chunks WHERE source_id = ?"),this.#I=this.#t.prepare("SELECT label, chunk_count, code_chunk_count, indexed_at, file_path, content_hash FROM sources WHERE label = ?"),this.#O=this.#t.prepare(`
      SELECT
        (SELECT COUNT(*) FROM sources) AS sources,
        (SELECT COUNT(*) FROM chunks) AS chunks,
        (SELECT COUNT(*) FROM chunks WHERE content_type = 'code') AS codeChunks
    `),this.#P=this.#t.prepare("DELETE FROM chunks WHERE source_id IN (SELECT id FROM sources WHERE datetime(indexed_at) < datetime('now', '-' || ? || ' days'))"),this.#M=this.#t.prepare("DELETE FROM chunks_trigram WHERE source_id IN (SELECT id FROM sources WHERE datetime(indexed_at) < datetime('now', '-' || ? || ' days'))"),this.#U=this.#t.prepare("DELETE FROM sources WHERE datetime(indexed_at) < datetime('now', '-' || ? || ' days')")}setDenyChecker(t){this.#o=t}index(t){let{content:e,path:s,source:r,attribution:o}=t,i=typeof e=="string"&&e.length>0;if(!i&&!s)throw new Error("Either content or path must be provided");let a;if(i)a=e;else{let d=Ne(s,"r");try{if(!De(d).isFile())throw new Error(`refusing to index ${s}: not a regular file`);a=ve(d,"utf-8")}finally{Ae(d)}}let u=r??s??"untitled",c=this.#K(a),l=s??void 0,h=l?Le("sha256").update(a).digest("hex"):void 0;return D(()=>this.#s(c,u,a,l,h,o))}indexDirectory(t){let{path:e,source:s,attribution:r,perFileDeny:o,...i}=t,a=Ce(e,i),u=0,c=0,l=0,h=0;for(let d of a.files){if(o&&o(d)){l++;continue}try{let g=s?`${s}:${d}`:d,f=this.index({path:d,source:g,attribution:r});u++,c+=f.totalChunks}catch{h++}}return{filesIndexed:u,totalChunks:c,capped:a.capped,totalSeen:a.totalSeen,denied:l,failed:h,label:s??e}}indexPlainText(t,e,s=20,r,o=ht){if(!t||t.trim().length===0)return this.#s([],e,"",void 0,void 0,r);let i=this.#q(t,s,o);return D(()=>this.#s(i.map(a=>({...a,hasCode:!1})),e,t,void 0,void 0,r))}indexJSON(t,e,s=ht,r){if(!t||t.trim().length===0)return this.indexPlainText("",e,void 0,r,s);let o;try{o=JSON.parse(t)}catch{return this.indexPlainText(t,e,void 0,r,s)}let i=[];return this.#W(o,[],i,s),i.length===0?this.indexPlainText(t,e,void 0,r,s):D(()=>this.#s(i,e,t,void 0,void 0,r))}#s(t,e,s,r,o,i){let a=t.filter(d=>d.hasCode).length,u=i?.sessionId??"",c=i?.eventId??"",h=this.#t.transaction(()=>{let d=t.length===0?this.#a.run(e,r??null,o??null):this.#c.run(e,t.length,a,r??null,o??null),g=Number(d.lastInsertRowid);this.#h.get(e,g)&&(this.#p.run(e),this.#g.run(e),this.#m.run(e,g));let f=new Date().toISOString();for(let m of t){let E=m.hasCode?"code":"prose";this.#l.run(m.title,m.content,g,E,null,u,c,f),this.#u.run(m.title,m.content,g,E,null,u,c,f)}return g})();return s&&this.#J(s),this.#F++,this.#F%n.OPTIMIZE_EVERY===0&&this.#B(),{sourceId:h,label:e,totalChunks:t.length,codeChunks:a}}#j(t){return t.map(e=>({title:e.title,content:e.content,source:e.label,rank:e.rank,contentType:e.content_type,highlighted:e.highlighted,timestamp:e.timestamp??void 0,sessionId:e.session_id??""}))}#r(t,e){return e==="exact"?t:`%${t.replace(/\\/g,"\\\\").replace(/%/g,"\\%").replace(/_/g,"\\_")}%`}search(t,e=3,s,r="AND",o,i="like"){let a=xs(t,r),u,c;return s&&o?(u=i==="exact"?this.#k:this.#x,c=[a,this.#r(s,i),o,e]):s?(u=i==="exact"?this.#y:this.#E,c=[a,this.#r(s,i),e]):o?(u=this.#T,c=[a,o,e]):(u=this.#f,c=[a,e]),D(()=>this.#j(u.all(...c)))}searchTrigram(t,e=3,s,r="AND",o,i="like"){let a=ks(t,r);if(!a)return[];let u,c;return s&&o?(u=i==="exact"?this.#w:this.#v,c=[a,this.#r(s,i),o,e]):s?(u=i==="exact"?this.#b:this.#_,c=[a,this.#r(s,i),e]):o?(u=this.#C,c=[a,o,e]):(u=this.#S,c=[a,e]),D(()=>this.#j(u.all(...c)))}fuzzyCorrect(t){let e=t.toLowerCase().trim();if(e.length<3)return null;if(this.#n.has(e)){let c=this.#n.get(e)??null;return this.#n.delete(e),this.#n.set(e,c),c}let s=vs(e.length),r=this.#R.all(e.length-s,e.length+s),o=null,i=s+1,a=!1;for(let{word:c}of r){if(c===e){a=!0;break}let l=Cs(e,c);l<i&&(i=l,o=c)}let u=a?null:i<=s?o:null;if(this.#n.size>=n.FUZZY_CACHE_SIZE){let c=this.#n.keys().next().value;c!==void 0&&this.#n.delete(c)}return this.#n.set(e,u),u}#$(t,e,s,r,o="like"){let a=Math.max(e*2,10),u=this.search(t,a,s,"OR",r,o),c=this.searchTrigram(t,a,s,"OR",r,o),l=new Map,h=d=>`${d.source}::${d.title}`;for(let[d,g]of u.entries()){let f=h(g),m=l.get(f);m?m.score+=1/(60+d+1):l.set(f,{result:g,score:1/(60+d+1)})}for(let[d,g]of c.entries()){let f=h(g),m=l.get(f);m?m.score+=1/(60+d+1):l.set(f,{result:g,score:1/(60+d+1)})}return Array.from(l.values()).sort((d,g)=>g.score-d.score).slice(0,e).map(({result:d,score:g})=>({...d,rank:-g}))}#H(t,e){let s=e.toLowerCase().split(/\s+/).filter(i=>i.length>=2),r=s.filter(i=>!H.has(i)),o=r.length>0?r:s;return t.map(i=>{let a=i.title.toLowerCase(),u=o.filter(g=>a.includes(g)).length,c=i.contentType==="code"?.6:.3,l=u>0?c*(u/o.length):0,h=0,d=0;if(o.length>=2){let g=i.content.toLowerCase(),f=o.map(m=>Ls(g,m));if(!f.some(m=>m.length===0)){h=1/(1+Is(f)/Math.max(g.length,1));let E=Os(f,o);d=.5*Math.min(1,E/4)}}return{result:i,boost:l+h+d}}).sort((i,a)=>a.boost-i.boost||i.result.rank-a.result.rank).map(({result:i})=>i)}searchWithFallback(t,e=3,s,r,o="like",i){this.#Y();let a=i?Math.max(e*8,40):e,u=this.#G(i),c=this.#$(t,a,s,r,o),l=u?c.filter(u):c;if(l.length>0)return this.#H(l.slice(0,e),t).map(E=>({...E,matchLayer:"rrf"}));let h=t.toLowerCase().trim().split(/\s+/).filter(m=>m.length>=3&&!H.has(m)),d=h.join(" "),f=h.map(m=>this.fuzzyCorrect(m)??m).join(" ");if(f!==d){let m=this.#$(f,a,s,r,o),E=u?m.filter(u):m;if(E.length>0)return this.#H(E.slice(0,e),f).map(S=>({...S,matchLayer:"rrf-fuzzy"}))}return[]}#G(t){return t?e=>{let s=e.sessionId??"";return s===""||t.has(s)}:null}lastRefreshCount=0;#Y(){this.lastRefreshCount=0;let t=this.#t.prepare("SELECT label, file_path, content_hash, indexed_at FROM sources WHERE file_path IS NOT NULL").all();for(let e of t)try{if(!Rs(e.file_path)||this.#o&&this.#o(e.file_path))continue;let s=we(e.file_path).mtime,r=new Date(e.indexed_at+"Z");if(s<=r)continue;let o=Ne(e.file_path,"r"),i;try{if(!De(o).isFile())continue;i=ve(o,"utf-8")}finally{Ae(o)}if(Le("sha256").update(i).digest("hex")===e.content_hash)continue;this.index({content:i,path:e.file_path,source:e.label}),this.lastRefreshCount++}catch{}}getSourceMeta(t){let e=this.#I.get(t);return e?{label:e.label,chunkCount:e.chunk_count,codeChunkCount:e.code_chunk_count,indexedAt:e.indexed_at,filePath:e.file_path??null,contentHash:e.content_hash??null}:null}listSources(){return this.#N.all()}getIndexState(){let t=this.#t.prepare("SELECT COALESCE(SUM(chunk_count), 0) AS total_chunks, COUNT(*) AS total_sources, MAX(indexed_at) AS last_indexed_at FROM sources").get();return{totalChunks:t.total_chunks??0,totalSources:t.total_sources??0,lastIndexedAt:t.last_indexed_at??void 0}}getChunksBySource(t){return this.#D.all(t).map(s=>({title:s.title,content:s.content,source:s.label,rank:0,contentType:s.content_type}))}getDistinctiveTerms(t,e=40){let s=this.#A.get(t);if(!s||s.chunk_count<3)return[];let r=s.chunk_count,o=2,i=Math.max(3,Math.ceil(r*.4)),a=new Map;for(let l of this.#L.iterate(t)){let h=new Set(l.content.toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(d=>d.length>=3&&!H.has(d)));for(let d of h)a.set(d,(a.get(d)??0)+1)}return Array.from(a.entries()).filter(([,l])=>l>=o&&l<=i).map(([l,h])=>{let d=Math.log(r/h),g=Math.min(l.length/20,.5),f=/[_]/.test(l),m=l.length>=12,E=f?1.5:m?.8:0;return{word:l,score:d+g+E}}).sort((l,h)=>h.score-l.score).slice(0,e).map(l=>l.word)}getStats(){let t=this.#O.get();return{sources:t?.sources??0,chunks:t?.chunks??0,codeChunks:t?.codeChunks??0}}cleanupStaleSources(t){return this.#t.transaction(r=>(this.#P.run(r),this.#M.run(r),this.#U.run(r)))(t).changes}getDBSizeBytes(){try{return we(this.#e).size}catch{return 0}}#B(){try{this.#t.exec("INSERT INTO chunks(chunks) VALUES('optimize')"),this.#t.exec("INSERT INTO chunks_trigram(chunks_trigram) VALUES('optimize')")}catch{}}close(){this.#B(),V(this.#t)}#J(t){let e=t.toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(o=>o.length>=3&&!H.has(o)),s=[...new Set(e)],r=0;this.#t.transaction(()=>{for(let o of s){let i=this.#d.run(o);r+=i.changes}})(),r>0&&this.#n.clear()}#K(t,e=ht){let s=[],r=t.split(`
`),o=[],i=[],a="",u=()=>{let l=i.join(`
`).trim();if(l.length===0)return;let h=this.#et(o,a),d=i.some(y=>/^`{3,}/.test(y));if(Buffer.byteLength(l)<=e){s.push({title:h,content:l,hasCode:d}),i=[];return}let g=[],f=[],m="";for(let y of l.split(`
`)){let _=y.endsWith("\r")?y.slice(0,-1):y,P=_.match(/^(`{3,})/);!m&&P?m=P[1]:m&&_.trim()===m&&(m=""),f.push(y),!m&&_.trim()===""&&(g.push(f.join(`
`)),f=[])}f.length>0&&g.push(f.join(`
`));let E=[],C=1,S=()=>{if(E.length===0)return;let y=E.join(`
`).trim();if(y.length===0)return;let _=g.length>1?`${h} (${C})`:h;C++,s.push({title:_,content:y,hasCode:y.includes("```")}),E=[]};for(let y of g){E.push(y);let _=E.join(`
`);Buffer.byteLength(_)>e&&E.length>1&&(E.pop(),S(),E=[y])}S(),i=[]},c=0;for(;c<r.length;){let l=r[c],h=l.endsWith("\r")?l.slice(0,-1):l;if(/^[-_*]{3,}\s*$/.test(h)){u(),c++;continue}let d=h.match(/^(#{1,4})\s+(.+)$/);if(d){u();let f=d[1].length,m=d[2].trim();for(;o.length>0&&o[o.length-1].level>=f;)o.pop();o.push({level:f,text:m}),a=m,i.push(l),c++;continue}let g=h.match(/^(`{3,})(.*)?$/);if(g){let f=g[1],m=[l];for(c++;c<r.length;){if(m.push(r[c]),r[c].startsWith(f)&&r[c].trim()===f){c++;break}c++}i.push(...m);continue}i.push(l),c++}return u(),s}#z(t,e){if(Buffer.byteLength(t)<=e)return t;let s="",r=0;for(let o of t){let i=Buffer.byteLength(o);if(r+i>e)break;s+=o,r+=i}return s.length===0?[...t][0]??"":s}#i(t,e,s){let r=[],o=[],i=1,a=()=>{if(o.length===0)return;let u=o.join(`
`),c=i===1?e:`${e} (${i})`;r.push({title:c,content:u}),i++,o=[]};for(let u of t){if(Buffer.byteLength(u)>s){a();let l=u,h=1;for(;l.length>0;){let d=this.#z(l,s);if(d.length<l.length){let f=d.lastIndexOf(" "),m=d.lastIndexOf(`
`),E=Math.max(f,m);E>d.length*As&&(d=d.slice(0,E))}let g=i===1&&h===1?e:`${e} (${i}.${h})`;r.push({title:g,content:d}),l=l.slice(d.length),h++,i++}continue}let c=o.length>0?o.join(`
`)+`
`+u:u;Buffer.byteLength(c)>s&&o.length>0&&a(),o.push(u)}return a(),r}#q(t,e,s=ht){let r=t.split(/\n\s*\n/);if(r.length>=ws&&r.length<=Ns&&r.every(c=>Buffer.byteLength(c)<Ds))return r.flatMap((c,l)=>{let h=c.trim();if(h.length===0)return[];let d=h.split(`
`)[0].slice(0,Oe)||`Section ${l+1}`;return Buffer.byteLength(h)<=s?[{title:d,content:h}]:this.#i(h.split(`
`),d,s)});let o=t.split(`
`);if(o.length<=e)return Buffer.byteLength(t)<=s?[{title:"Output",content:t}]:this.#i(o,"Output",s);let i=[],u=Math.max(e-2,1);for(let c=0;c<o.length;c+=u){let l=o.slice(c,c+e);if(l.length===0)break;let h=c+1,d=Math.min(c+l.length,o.length),g=l[0]?.trim().slice(0,Oe),f=l.join(`
`);if(Buffer.byteLength(f)<=s)i.push({title:g||`Lines ${h}-${d}`,content:f});else{let m=this.#i(l,g||`Lines ${h}-${d}`,s);i.push(...m)}}return i}#W(t,e,s,r){let o=e.length>0?e.join(" > "):"(root)",i=JSON.stringify(t,null,2);if(Buffer.byteLength(i)<=r&&!(typeof t=="object"&&t!==null&&!Array.isArray(t)&&Object.values(t).some(u=>typeof u=="object"&&u!==null))){s.push({title:o,content:i,hasCode:!0});return}if(typeof t=="object"&&t!==null&&!Array.isArray(t)){let a=Object.entries(t);if(a.length>0){for(let[u,c]of a)this.#W(c,[...e,u],s,r);return}s.push({title:o,content:i,hasCode:!0});return}if(Array.isArray(t)){this.#tt(t,e,s,r);return}s.push({title:o,content:i,hasCode:!1})}#Q(t){if(t.length===0)return null;let e=t[0];if(typeof e!="object"||e===null||Array.isArray(e))return null;let s=["id","name","title","path","slug","key","label"],r=e;for(let o of s)if(o in r&&(typeof r[o]=="string"||typeof r[o]=="number"))return o;return null}#Z(t,e,s,r,o){let i=t?`${t} > `:"";if(!o)return e===s?`${i}[${e}]`:`${i}[${e}-${s}]`;let a=u=>String(u[o]);return r.length===1?`${i}${a(r[0])}`:r.length<=3?i+r.map(a).join(", "):`${i}${a(r[0])}\u2026${a(r[r.length-1])}`}#tt(t,e,s,r){let o=e.length>0?e.join(" > "):"(root)",i=this.#Q(t),a=[],u=0,c=l=>{if(a.length===0)return;let h=this.#Z(o,u,l,a,i);s.push({title:h,content:JSON.stringify(a,null,2),hasCode:!0})};for(let l=0;l<t.length;l++){a.push(t[l]);let h=JSON.stringify(a,null,2);Buffer.byteLength(h)>r&&a.length>1&&(a.pop(),c(l-1),a=[t[l]],u=l)}c(u+a.length-1)}#et(t,e){return t.length===0?e||"Untitled":t.map(s=>s.text).join(" > ")}};at();import{readFileSync as Us,realpathSync as Fs}from"node:fs";import{relative as oo,resolve as gt,sep as io}from"node:path";import{resolve as nt}from"node:path";import{homedir as Pe}from"node:os";function Ps(n=process.env){let t=n.CLAUDE_CONFIG_DIR;return t&&t.trim()!==""?t.startsWith("~")?nt(Pe(),t.replace(/^~[/\\]?/,"")):nt(t):nt(Pe(),".claude")}function Ms(n=process.env){return nt(Ps(n),"settings.json")}function Me(n=process.env){let t=[nt(dt(n),"settings.json")],e=Ms(n);return t.includes(e)||t.push(e),t}function js(n){let t=n.match(/^(\w+)\((.+)\)$/);return t?{tool:t[1],glob:t[2]}:null}function $s(n,t=!1){let e="",s=0;for(;s<n.length;)n[s]==="*"&&n[s+1]==="*"?s+2<n.length&&n[s+2]==="/"?(e+="(.*/)?",s+=3):(e+=".*",s+=2):n[s]==="*"?(e+="[^/]*",s++):n[s]==="?"?(e+="[^/]",s++):(e+=n[s].replace(/[.+^${}()|[\]\\\/\-]/g,"\\$&"),s++);return new RegExp(`^${e}$`,t?"i":"")}function At(n,t,e){return Hs(n,"deny",t,e)}function Hs(n,t,e,s){let r=[],o=a=>{let u;try{u=Us(a,"utf-8")}catch{return null}let c;try{c=JSON.parse(u)}catch{return null}let l=c?.permissions?.[t];if(!Array.isArray(l))return[];let h=[];for(let d of l){if(typeof d!="string")continue;let g=js(d);g&&g.tool===n&&h.push(g.glob)}return h};if(e){let a=o(gt(e,".codex","settings.json"));a!==null&&r.push(a);let u=o(gt(e,".claude","settings.local.json"));u!==null&&r.push(u);let c=o(gt(e,".claude","settings.json"));c!==null&&r.push(c)}let i=s!==void 0?[s]:Me();for(let a of i){let u=o(a);u!==null&&r.push(u)}return r}function Lt(n,t,e=process.platform==="win32"||process.platform==="darwin",s){let r=i=>i.replace(/\\/g,"/"),o=new Set;if(o.add(r(n)),s){let i=gt(s,n);o.add(r(i));try{o.add(r(Fs(i)))}catch{}}for(let i of t)for(let a of i){let u=$s(r(a),e);for(let c of o)if(u.test(c))return{denied:!0,matchedPattern:a}}return{denied:!1}}q();var je={"pre-tool-use":"pre-tool-use","post-tool-use":"post-tool-use","session-start":"session-start","pre-compact":"pre-compact","user-prompt-submit":"user-prompt-submit",stop:"stop"};function It(){let n=Ot(Xe(import.meta.url));return["src","build"].includes(We(n))?Ot(n):n}function Ro(n){return n.replace(/\\/g,"/")}function Ve(n){let t=[],e={};for(let s=0;s<n.length;s++){let r=n[s];if(!r.startsWith("--")||r==="--"){t.push(r);continue}let o=r.slice(2),i=o.indexOf("="),a=i>=0?o.slice(0,i):o,u=i>=0?o.slice(i+1):void 0,c=n[s+1],l=u!==void 0?u:c&&!c.startsWith("--")?(s++,c):!0;if(a==="include"||a==="exclude"){let h=e[a];e[a]=Array.isArray(h)?[...h,String(l)]:[String(l)]}else e[a]=l}return{positional:t,flags:e}}function v(n,t){let e=n[t];if(typeof e=="string"&&e.length>0)return e}function $e(n,t){return n[t]===!0||n[t]==="true"}function He(n,t){let e=n[t];if(Array.isArray(e))return e.filter(Boolean);if(typeof e=="string"&&e.length>0)return[e]}function Pt(n,t,e={}){let s=v(n,t);if(!s)return;let r=Number(s),o=e.min??1;if(!Number.isInteger(r)||r<o)throw new Error(`--${t} must be an integer >= ${o}`);return r}function Xs(n){let t=v(n,"ext")??v(n,"extensions");if(!t)return;let e=t.split(",").map(s=>s.trim()).filter(Boolean).map(s=>s.startsWith(".")?s:`.${s}`);return e.length>0?e:void 0}function Ge(n,t){return n?st(n):st(t)}async function Ye(n){let t=new et,e=kt(()=>t.getSessionDir()),s=Ct(e),{resolveContentStorePath:r}=await Promise.resolve().then(()=>(q(),oe)),o=r({projectDir:n,contentDir:s});return{store:new pt(o),dbPath:o,contentDir:s}}function Vs(n){try{if(Be(n).isDirectory())return`project:${We(n)||n}`}catch{}return n}function Gs(n,t){let e=At("Read",t);if(Lt(n,e,process.platform==="win32",t).denied)throw new Error(`Read denied by policy: ${n}`)}async function Ys(n){try{let t=Ve(n),e=t.positional[0];if(!e||e==="-h"||e==="--help")return console.log("Usage: codex-context-mode index <path> [--source label] [--project path] [--max-files n] [--max-depth n] [--ext .ts,.md]"),e?0:1;let s=Ws(e)?st(e):st(process.cwd(),e);if(!Bs(s))throw new Error(`Path does not exist: ${s}`);let r=Be(s),o=Ge(v(t.flags,"project"),r.isDirectory()?s:Ot(s)),i=v(t.flags,"source")??Vs(s),{store:a,dbPath:u}=await Ye(o);try{if(Gs(s,o),r.isDirectory()){let c=At("Read",o),l=a.indexDirectory({path:s,source:i,include:He(t.flags,"include"),exclude:He(t.flags,"exclude"),maxDepth:Pt(t.flags,"max-depth",{min:0}),maxFiles:Pt(t.flags,"max-files"),extensions:Xs(t.flags),respectGitignore:!$e(t.flags,"no-gitignore"),followSymlinks:$e(t.flags,"follow-symlinks"),perFileDeny:f=>{try{return Lt(f,c,process.platform==="win32",o).denied}catch{return!1}}}),h=l.capped?` (cap reached at ${l.filesIndexed} files)`:"",d=l.denied>0?`; ${l.denied} denied`:"",g=l.failed>0?`; ${l.failed} failed`:"";console.log(`Indexed ${l.filesIndexed} files (${l.totalChunks} sections) from ${s}${h}${d}${g}`)}else{let c=a.index({path:s,source:i});console.log(`Indexed ${c.totalChunks} sections (${c.codeChunks} with code) from ${s}`)}return console.log(`Source: ${i}`),console.log(`Project: ${o}`),console.log(`DB: ${u}`),0}finally{a.close()}}catch(t){let e=t instanceof Error?t.message:String(t);return console.error(`codex-context-mode index: ${e}`),1}}async function Js(n){try{let t=Ve(n),e=t.positional.join(" ").trim();if(!e||e==="-h"||e==="--help")return console.log("Usage: codex-context-mode search <query...> [--source label] [--project path] [--limit n] [--type code|prose]"),e?0:1;let s=Ge(v(t.flags,"project"),process.cwd()),{store:r,dbPath:o}=await Ye(s);try{let i=Pt(t.flags,"limit")??3,a=v(t.flags,"type");if(a&&a!=="code"&&a!=="prose")throw new Error("--type must be code or prose");let u=r.searchWithFallback(e,i,v(t.flags,"source"),a);if(u.length===0)return console.log(`No matches for: ${e}`),console.log(`Project: ${s}`),console.log(`DB: ${o}`),0;for(let[c,l]of u.entries()){let h=l.content.replace(/\s+/g," ").trim(),d=h.length>500?`${h.slice(0,500)}...`:h;console.log(`## ${c+1}. ${l.title}`),console.log(`Source: ${l.source}`),console.log(`Type: ${l.contentType}`),console.log(d),console.log("")}return 0}finally{r.close()}}catch(t){let e=t instanceof Error?t.message:String(t);return console.error(`codex-context-mode search: ${e}`),1}}async function Ks(){let n=new et;console.log("codex-context-mode doctor"),console.log(pe(he())),console.log("Codex CLI: "+(be()??"not found"));let t=n.validateHooks(It());for(let r of t)console.log("["+(r.status==="pass"?"OK":r.status.toUpperCase())+"] "+r.check+": "+r.message);let e=G(),s=new e(":memory:");try{s.exec("CREATE VIRTUAL TABLE probe USING fts5(value)"),console.log("[OK] SQLite FTS5")}finally{s.close()}return t.some(r=>r.status==="fail")?1:0}async function zs(){let n=process.argv.slice(2);if(["--help","-h","help"].includes(n[0])){console.log("codex-context-mode [doctor | index <path> | search <query> | hook codex <kebab-case-event>]"),console.log("Install, enable, update and uninstall through Codex plugin management.");return}if(n[0]==="index"){process.exitCode=await Ys(n.slice(1));return}if(n[0]==="search"){process.exitCode=await Js(n.slice(1));return}if(n[0]==="doctor"){process.exitCode=await Ks();return}if(n[0]==="hook"){if(n[1]!=="codex"||!je[n[2]])throw new Error("Expected hook codex <kebab-case-event>");await import(Fe(Ue(It(),"hooks","codex",je[n[2]]+".mjs")).href);return}if(n.length)throw new Error("Unknown command. Installation and lifecycle belong to Codex plugin management.");await import(Fe(Ue(It(),"start.mjs")).href)}process.argv[1]&&st(process.argv[1])===Xe(import.meta.url)&&zs().catch(n=>{console.error(n instanceof Error?n.message:String(n)),process.exitCode=1});export{Ro as toUnixPath};
