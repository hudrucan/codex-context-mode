#!/usr/bin/env node
var We=Object.defineProperty;var ht=(n,t)=>()=>(n&&(t=n(n=0)),t);var Xe=(n,t)=>{for(var e in t)We(n,e,{get:t[e],enumerable:!0})};import{existsSync as Ve,mkdirSync as Ge,readFileSync as Ye,realpathSync as Je}from"node:fs";import{homedir as Ke}from"node:os";import{basename as ze,dirname as Z,isAbsolute as jt,join as T,relative as qe,resolve as gt,sep as Qe}from"node:path";import{fileURLToPath as Ze}from"node:url";function Ft(n){let t=gt(n),e=[];for(;!Ve(t)&&Z(t)!==t;)e.unshift(ze(t)),t=Z(t);return gt(Je.native(t),...e)}function R(n=process.env,t=Ke()){let e=n.CODEX_CONTEXT_MODE_HOME?.trim();if(e&&!jt(e))throw new Error("CODEX_CONTEXT_MODE_HOME must be absolute");let s=gt(e||T(t,".codex-context-mode"));return{root:s,data:T(s,"data"),sessions:T(s,"data","sessions"),content:T(s,"data","content"),stats:T(s,"data","stats"),memory:T(s,"data","memory"),cache:T(s,"cache"),logs:T(s,"logs"),temporary:T(s,"cache","tmp")}}function N(n){let t=Z(Ze(import.meta.url));for(let e of[process.env.PLUGIN_ROOT,process.env.CLAUDE_PLUGIN_ROOT,t,Z(t)]){if(!e)continue;let s;try{s=JSON.parse(Ye(T(e,"package.json"),"utf8"))}catch{continue}if(s.name!==$t)continue;let r=qe(Ft(e),Ft(n));if(r===""||r!==".."&&!r.startsWith(".."+Qe)&&!jt(r))throw new Error("Plugin data must not be written inside the code installation: "+n)}}function tt(){let n=R().temporary;return N(n),Ge(n,{recursive:!0}),n}var $t,L=ht(()=>{"use strict";$t="codex-context-mode"});import{createRequire as tn}from"node:module";import{existsSync as en,unlinkSync as Ht,renameSync as nn}from"node:fs";import{join as sn}from"node:path";function rn(n){let t=null;try{return t=new n(":memory:"),t.exec("CREATE VIRTUAL TABLE __fts5_probe USING fts5(x)"),!0}catch{return!1}finally{try{t?.close()}catch{}}}function on(n,t){let e=t!==void 0?t:globalThis.Bun;if(typeof e<"u"&&e!==null)return!0;let s=n??process.versions,[r,o]=(s.node??"0.0.0").split("."),i=Number(r),c=Number(o);return!Number.isFinite(i)||!Number.isFinite(c)?!1:i>22||i===22&&c>=5}function B(){if(!I){let n=tn(import.meta.url);if(globalThis.Bun){let t=n(["bun","sqlite"].join(":")).Database;I=function(s,r){let o=new t(s,{readonly:r?.readonly,create:!0}),i=new mt(o);return r?.timeout&&i.pragma(`busy_timeout = ${r.timeout}`),i}}else if(on()){let t=null;try{({DatabaseSync:t}=n(["node","sqlite"].join(":")))}catch{t=null}t&&rn(t)?I=function(s,r){let o=new t(s,{readOnly:r?.readonly??!1}),i=new ft(o);return r?.timeout&&i.pragma(`busy_timeout = ${r.timeout}`),i}:I=n("better-sqlite3")}else I=n("better-sqlite3")}return I}function j(n){n.pragma("journal_mode = WAL"),n.pragma("synchronous = NORMAL");try{n.pragma("mmap_size = 268435456")}catch{}}function $(n){if(!en(n))for(let t of["-wal","-shm"])try{Ht(n+t)}catch{}}function Et(n){for(let t of["","-wal","-shm"])try{Ht(n+t)}catch{}}function H(n){try{n.pragma("wal_checkpoint(TRUNCATE)")}catch{}try{n.close()}catch{}}function Bt(n="context-mode"){return sn(tt(),`${n}-${process.pid}.db`)}function D(n,t=[100,500,2e3]){let e;for(let s=0;s<=t.length;s++)try{return n()}catch(r){let o=r instanceof Error?r.message:String(r);if(!o.includes("SQLITE_BUSY")&&!o.includes("database is locked"))throw r;if(e=r instanceof Error?r:new Error(o),s<t.length){let i=t[s],c=Date.now();for(;Date.now()-c<i;);}}throw new Error(`SQLITE_BUSY: database is locked after ${t.length} retries. Original error: ${e?.message}`)}function yt(n){return n.includes("SQLITE_CORRUPT")||n.includes("SQLITE_NOTADB")||n.includes("database disk image is malformed")||n.includes("file is not a database")}function an(n){let t=Date.now();for(let e of["","-wal","-shm"])try{nn(n+e,`${n}${e}.corrupt-${t}`)}catch{}}var mt,ft,I,F,pt,et,nt=ht(()=>{"use strict";L();mt=class{#t;constructor(t){this.#t=t}pragma(t){let s=this.#t.prepare(`PRAGMA ${t}`).all();if(!s||s.length===0)return;if(s.length>1)return s;let r=Object.values(s[0]);return r.length===1?r[0]:s[0]}exec(t){let e="",s=null;for(let o=0;o<t.length;o++){let i=t[o];if(s)e+=i,i===s&&(s=null);else if(i==="'"||i==='"')e+=i,s=i;else if(i===";"){let c=e.trim();c&&this.#t.prepare(c).run(),e=""}else e+=i}let r=e.trim();return r&&this.#t.prepare(r).run(),this}prepare(t){let e=this.#t.prepare(t);return{run:(...s)=>e.run(...s),get:(...s)=>{let r=e.get(...s);return r===null?void 0:r},all:(...s)=>e.all(...s),iterate:(...s)=>e.iterate(...s)}}transaction(t){return this.#t.transaction(t)}close(){this.#t.close()}},ft=class{#t;constructor(t){this.#t=t}pragma(t){let s=this.#t.prepare(`PRAGMA ${t}`).all();if(!s||s.length===0)return;if(s.length>1)return s;let r=Object.values(s[0]);return r.length===1?r[0]:s[0]}exec(t){return this.#t.exec(t),this}prepare(t){let e=this.#t.prepare(t);return{run:(...s)=>e.run(...s),get:(...s)=>e.get(...s),all:(...s)=>e.all(...s),iterate:(...s)=>typeof e.iterate=="function"?e.iterate(...s):e.all(...s)[Symbol.iterator]()}}transaction(t){return(...e)=>{this.#t.exec("BEGIN");try{let s=t(...e);return this.#t.exec("COMMIT"),s}catch(s){throw this.#t.exec("ROLLBACK"),s}}}close(){this.#t.close()}},I=null;F=Symbol.for("__context_mode_live_dbs_v3__"),pt=(()=>{let n=globalThis;return n[F]||(n[F]=new Set,process.on("exit",()=>{for(let t of n[F])H(t);n[F].clear()})),n[F]})(),et=class{#t;#e;constructor(t){t!==":memory:"&&N(t);let e=B();this.#t=t,$(t);let s;try{s=new e(t,{timeout:3e4}),j(s)}catch(r){let o=r instanceof Error?r.message:String(r);if(yt(o)){an(t),$(t);try{s=new e(t,{timeout:3e4}),j(s)}catch(i){throw new Error(`Failed to create fresh DB after renaming corrupt file: ${i instanceof Error?i.message:String(i)}`)}}else throw r}this.#e=s,pt.add(this.#e),this.initSchema(),this.prepareStatements()}get db(){return this.#e}get dbPath(){return this.#t}close(){pt.delete(this.#e),H(this.#e)}withRetry(t){return D(t)}cleanup(){pt.delete(this.#e),H(this.#e),Et(this.#t)}}});var te={};Xe(te,{SessionDB:()=>St,StorageDirectoryError:()=>M,_resetWorktreeSuffixCacheForTests:()=>Nn,applyMissingSessionEventsColumns:()=>Tt,clearStorageDirectoryCheckCacheForTests:()=>Tn,describeStorageDirectorySource:()=>Rn,ensureSessionEventsSchema:()=>In,ensureWritableStorageDir:()=>Rt,formatStorageDirectoryError:()=>bn,getWorktreeSuffix:()=>Qt,hashProjectDirCanonical:()=>A,hashProjectDirLegacy:()=>Dn,normalizeWorktreePath:()=>C,resolveContentStorageDir:()=>bt,resolveContentStorePath:()=>An,resolveDefaultSessionDir:()=>fn,resolveSessionDbPath:()=>On,resolveSessionPath:()=>Zt,resolveSessionStorageDir:()=>_t,resolveStatsStorageDir:()=>_n});import{createHash as W}from"node:crypto";import{execFileSync as cn}from"node:child_process";import{accessSync as ln,constants as un,mkdirSync as dn,realpathSync as hn}from"node:fs";import{dirname as gn,isAbsolute as pn,join as X,resolve as Yt}from"node:path";function fn(n){return R(n.env??process.env).sessions}function En(n,t,e){return new M(n,t,x,void 0,[`Invalid ${x} for codex-context-mode ${n} directory: ${e}`,zt()].join(`
`))}function Jt(n){let t=process.env[x];if(t===void 0)return{kind:"unset"};let e=t.trim();if(!e)return{kind:"ignored-empty",ignoredEnvVar:x,ignoredReason:"empty"};if(!pn(e))throw En(n,e,`${x} must be an absolute path.`);return{kind:"override",root:Yt(e)}}function yn(n){return n.kind==="ignored-empty"?{ignoredEnvVar:n.ignoredEnvVar,ignoredReason:n.ignoredReason}:{}}function Kt(n,t){let e=Jt(n);return e.kind!=="override"?null:{kind:n,path:X(e.root,"data",t),envVar:x,source:"override"}}function Sn(n,t,e){return{kind:n,path:Yt(t()),envVar:null,source:"default",...e}}function _t(n){let t=Jt("session");return t.kind==="override"?{kind:"session",path:X(t.root,"data",mn),envVar:x,source:"override"}:Sn("session",n,yn(t))}function bt(n){let t=Kt("content",Wt);if(t)return t;let e=_t(n);return{kind:"content",path:X(gn(e.path),Wt),envVar:e.envVar,source:e.source,ignoredEnvVar:e.ignoredEnvVar,ignoredReason:e.ignoredReason}}function _n(n){let t=Kt("stats","stats");if(t)return t;let e=_t(n);return{kind:"stats",path:e.path===R().sessions?R().stats:e.path,envVar:e.envVar,source:e.source,ignoredEnvVar:e.ignoredEnvVar,ignoredReason:e.ignoredReason}}function bn(n){return n.message}function Rn(n){return n.source==="override"&&n.envVar?`via ${n.envVar}`:n.ignoredEnvVar&&n.ignoredReason==="empty"?`default; ignored empty ${n.ignoredEnvVar}`:"default"}function Tn(){rt.clear()}function Rt(n){N(n.path);let t=[n.kind,n.path,n.source,n.envVar??"",n.ignoredEnvVar??"",n.ignoredReason??""].join("\0"),e=rt.get(t);if(e instanceof M)throw e;if(e===n.path)return e;try{return dn(n.path,{recursive:!0}),ln(n.path,un.W_OK),rt.set(t,n.path),n.path}catch(s){let r=new M(n.kind,Cn(s)??n.path,x,s,void 0,{ignoredEnvVar:n.ignoredEnvVar,ignoredReason:n.ignoredReason});throw rt.set(t,r),r}}function xn(n,t,e={}){return[`codex-context-mode ${n} directory is not writable: ${t}`,kn(e),zt()].filter(Boolean).join(`
`)}function kn(n){return n.ignoredEnvVar&&n.ignoredReason==="empty"?`Ignored empty ${n.ignoredEnvVar}; using adapter default.`:null}function zt(){return`Set ${x} to a writable absolute path.`}function Cn(n){if(!n||typeof n!="object")return null;let t=n.path;return typeof t=="string"&&t.length>0?t:null}function C(n){let t=n.replace(/\\/g,"/");return/^\/+$/.test(t)?"/":/^[A-Za-z]:\/+$/.test(t)?`${t.slice(0,2)}/`:t.replace(/\/+$/,"")}function Xt(n){let t=n;try{t=hn.native(n)}catch{}let e=C(t);return process.platform==="win32"||process.platform==="darwin"?e.toLowerCase():e}function qt(n,t){return cn("git",["-C",n,...t],{encoding:"utf-8",timeout:2e3,stdio:["ignore","pipe","ignore"]}).trim()}function vn(n){let t=qt(n,["rev-parse","--show-toplevel"]);return t.length>0?C(t):null}function wn(n){let t=qt(n,["worktree","list","--porcelain"]).split(/\r?\n/).find(e=>e.startsWith("worktree "))?.replace("worktree ","")?.trim();return t?C(t):null}function Qt(n=process.cwd()){let t=process.env.CONTEXT_MODE_SESSION_SUFFIX;if(P&&P.projectDir===n&&P.envSuffix===t)return P.suffix;let e="";if(t!==void 0)e=t?`__${t}`:"";else try{let s=vn(n),r=wn(n);if(s&&r){let o=Xt(s),i=Xt(r);o!==i&&(e=`__${W("sha256").update(o).digest("hex").slice(0,8)}`)}}catch{}return P={projectDir:n,envSuffix:t,suffix:e},e}function Nn(){P=void 0}function Dn(n){return W("sha256").update(C(n)).digest("hex").slice(0,16)}function A(n){let t=C(n),e=process.platform==="darwin"||process.platform==="win32"?t.toLowerCase():t;return W("sha256").update(e).digest("hex").slice(0,16)}function An(n){return X(n.contentDir,A(n.projectDir)+".db")}function On(n){return Zt({...n,ext:".db"})}function Zt(n){let t=n.suffix??Qt(n.projectDir);return X(n.sessionsDir,A(n.projectDir)+t+n.ext)}function st(n){let t=Number(n);return!Number.isFinite(t)||t<=0?0:Math.floor(t)}function Tt(n){let t=n.pragma("table_xinfo(session_events)"),e=new Set(t.map(r=>r.name)),s=!1;for(let[r,o]of Ln)e.has(r)||(n.exec(`ALTER TABLE session_events ADD COLUMN ${r} ${o}`),s=!0);return s&&n.exec("CREATE INDEX IF NOT EXISTS idx_session_events_project ON session_events(session_id, project_dir)"),s}function In(n,t){let e=null;try{e=new t(n),Tt(e)}catch{}finally{try{e?.close()}catch{}}}var x,mn,Wt,M,rt,P,Vt,Gt,g,Ln,St,V=ht(()=>{"use strict";nt();L();x="CODEX_CONTEXT_MODE_HOME",mn="sessions",Wt="content",M=class extends Error{kind;path;overrideEnvVar;ignoredEnvVar;ignoredReason;constructor(t,e,s=x,r,o,i={}){super(o??xn(t,e,i),{cause:r}),this.name="StorageDirectoryError",this.kind=t,this.path=e,this.overrideEnvVar=s,this.ignoredEnvVar=i.ignoredEnvVar,this.ignoredReason=i.ignoredReason}},rt=new Map;Vt=1e3,Gt=5;g={insertEvent:"insertEvent",getEvents:"getEvents",getEventsByType:"getEventsByType",getEventsByPriority:"getEventsByPriority",getEventsByTypeAndPriority:"getEventsByTypeAndPriority",getEventCount:"getEventCount",getLatestAttributedProject:"getLatestAttributedProject",checkDuplicate:"checkDuplicate",evictLowestPriority:"evictLowestPriority",updateMetaLastEvent:"updateMetaLastEvent",ensureSession:"ensureSession",getSessionStats:"getSessionStats",getSessionRollup:"getSessionRollup",getMaxFileEdits:"getMaxFileEdits",getLatestCommitMessage:"getLatestCommitMessage",incrementCompactCount:"incrementCompactCount",getUsageCursor:"getUsageCursor",setUsageCursor:"setUsageCursor",upsertResume:"upsertResume",getResume:"getResume",markResumeConsumed:"markResumeConsumed",claimLatestUnconsumedResume:"claimLatestUnconsumedResume",deleteEvents:"deleteEvents",deleteMeta:"deleteMeta",deleteResume:"deleteResume",getOldSessions:"getOldSessions",searchEvents:"searchEvents",incrementToolCall:"incrementToolCall",getToolCallTotals:"getToolCallTotals",getToolCallByTool:"getToolCallByTool",getEventBytesSummary:"getEventBytesSummary"},Ln=[["project_dir","TEXT NOT NULL DEFAULT ''"],["attribution_source","TEXT NOT NULL DEFAULT 'unknown'"],["attribution_confidence","REAL NOT NULL DEFAULT 0"],["bytes_avoided","INTEGER NOT NULL DEFAULT 0"],["bytes_returned","INTEGER NOT NULL DEFAULT 0"]];St=class extends et{constructor(t){super(t?.dbPath??Bt("session"))}stmt(t){return this.stmts.get(t)}initSchema(){try{let e=this.db.pragma("table_xinfo(session_events)").find(s=>s.name==="data_hash");e&&e.hidden!==0&&this.db.exec("DROP TABLE session_events")}catch{}this.db.exec(`
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
    `);try{Tt(this.db)}catch{}try{this.db.pragma("table_xinfo(session_meta)").some(e=>e.name==="usage_cursor")||this.db.exec("ALTER TABLE session_meta ADD COLUMN usage_cursor TEXT")}catch{}}prepareStatements(){this.stmts=new Map;let t=(e,s)=>{this.stmts.set(e,this.db.prepare(s))};t(g.insertEvent,`INSERT INTO session_events (
         session_id, type, category, priority, data,
         project_dir, attribution_source, attribution_confidence,
         bytes_avoided, bytes_returned,
         source_hook, data_hash
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),t(g.getEvents,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? ORDER BY id ASC LIMIT ?`),t(g.getEventsByType,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? AND type = ? ORDER BY id ASC LIMIT ?`),t(g.getEventsByPriority,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? AND priority >= ? ORDER BY id ASC LIMIT ?`),t(g.getEventsByTypeAndPriority,`SELECT id, session_id, type, category, priority, data,
              project_dir, attribution_source, attribution_confidence,
              bytes_avoided, bytes_returned,
              source_hook, created_at, data_hash
       FROM session_events WHERE session_id = ? AND type = ? AND priority >= ? ORDER BY id ASC LIMIT ?`),t(g.getEventCount,"SELECT COUNT(*) AS cnt FROM session_events WHERE session_id = ?"),t(g.getLatestAttributedProject,`SELECT project_dir
       FROM session_events
       WHERE session_id = ? AND project_dir != ''
       ORDER BY id DESC
       LIMIT 1`),t(g.checkDuplicate,`SELECT 1 FROM (
         SELECT type, data_hash FROM session_events
         WHERE session_id = ? ORDER BY id DESC LIMIT ?
       ) AS recent
       WHERE recent.type = ? AND recent.data_hash = ?
       LIMIT 1`),t(g.evictLowestPriority,`DELETE FROM session_events WHERE id = (
         SELECT id FROM session_events WHERE session_id = ?
         ORDER BY priority ASC, id ASC LIMIT 1
       )`),t(g.updateMetaLastEvent,`UPDATE session_meta
       SET last_event_at = datetime('now'), event_count = event_count + 1
       WHERE session_id = ?`),t(g.ensureSession,"INSERT OR IGNORE INTO session_meta (session_id, project_dir) VALUES (?, ?)"),t(g.getSessionStats,`SELECT session_id, project_dir, started_at, last_event_at, event_count, compact_count
       FROM session_meta WHERE session_id = ?`),t(g.getSessionRollup,`SELECT
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
       WHERE session_id = ?`),t(g.getMaxFileEdits,`SELECT COALESCE(MAX(c), 0) AS max_file_edits
       FROM (
         SELECT COUNT(*) AS c
         FROM session_events
         WHERE session_id = ? AND category = 'file' AND type IN ('file_edit', 'file_write')
         GROUP BY data
       )`),t(g.getLatestCommitMessage,`SELECT data
       FROM session_events
       WHERE session_id = ? AND type = 'git_commit'
       ORDER BY id DESC
       LIMIT 1`),t(g.incrementCompactCount,"UPDATE session_meta SET compact_count = compact_count + 1 WHERE session_id = ?"),t(g.getUsageCursor,"SELECT usage_cursor FROM session_meta WHERE session_id = ?"),t(g.setUsageCursor,"UPDATE session_meta SET usage_cursor = ? WHERE session_id = ?"),t(g.upsertResume,`INSERT INTO session_resume (session_id, snapshot, event_count)
       VALUES (?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         snapshot = excluded.snapshot,
         event_count = excluded.event_count,
         created_at = datetime('now'),
         consumed = 0`),t(g.getResume,"SELECT snapshot, event_count, consumed FROM session_resume WHERE session_id = ?"),t(g.markResumeConsumed,"UPDATE session_resume SET consumed = 1 WHERE session_id = ?"),t(g.claimLatestUnconsumedResume,`UPDATE session_resume
       SET consumed = 1
       WHERE id = (
         SELECT id FROM session_resume
         WHERE consumed = 0
           AND session_id != ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1
       )
       RETURNING session_id, snapshot`),t(g.deleteEvents,"DELETE FROM session_events WHERE session_id = ?"),t(g.deleteMeta,"DELETE FROM session_meta WHERE session_id = ?"),t(g.deleteResume,"DELETE FROM session_resume WHERE session_id = ?"),t(g.searchEvents,`SELECT id, session_id, category, type, data, created_at
       FROM session_events
       WHERE (project_dir = ? OR project_dir = '')
         AND (data LIKE '%' || ? || '%' ESCAPE '\\' OR category LIKE '%' || ? || '%' ESCAPE '\\')
         AND (? IS NULL OR category = ?)
       ORDER BY id ASC
       LIMIT ?`),t(g.getOldSessions,"SELECT session_id FROM session_meta WHERE started_at < datetime('now', ? || ' days')"),t(g.incrementToolCall,`INSERT INTO tool_calls (session_id, tool, calls, bytes_returned)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(session_id, tool) DO UPDATE SET
         calls = calls + 1,
         bytes_returned = bytes_returned + excluded.bytes_returned,
         updated_at = datetime('now')`),t(g.getToolCallTotals,`SELECT COALESCE(SUM(calls), 0) AS calls,
              COALESCE(SUM(bytes_returned), 0) AS bytes_returned
       FROM tool_calls WHERE session_id = ?`),t(g.getToolCallByTool,`SELECT tool, calls, bytes_returned
       FROM tool_calls WHERE session_id = ? ORDER BY calls DESC`),t(g.getEventBytesSummary,`SELECT COALESCE(SUM(bytes_avoided), 0) AS bytes_avoided,
              COALESCE(SUM(bytes_returned), 0) AS bytes_returned
       FROM session_events WHERE session_id = ?`)}insertEvent(t,e,s="PostToolUse",r,o){let i=W("sha256").update(e.data).digest("hex").slice(0,16).toUpperCase(),c=String(r?.projectDir??e.project_dir??this._getSessionProjectDir(t)).trim(),u=String(r?.source??e.attribution_source??"unknown"),a=Number(r?.confidence??e.attribution_confidence??0),l=Number.isFinite(a)?Math.max(0,Math.min(1,a)):0,h=st(o?.bytesAvoided),d=st(o?.bytesReturned),p=this.db.transaction(()=>{if(this.stmt(g.checkDuplicate).get(t,Gt,e.type,i))return;this.stmt(g.getEventCount).get(t).cnt>=Vt&&this.stmt(g.evictLowestPriority).run(t),this.stmt(g.insertEvent).run(t,e.type,e.category,e.priority,e.data,c,u,l,h,d,s,i),this.stmt(g.updateMetaLastEvent).run(t)});this.withRetry(()=>p())}bulkInsertEvents(t,e,s="PostToolUse",r,o){if(!e||e.length===0)return;if(e.length===1){this.insertEvent(t,e[0],s,r?.[0],o?.[0]);return}let i=e.map((u,a)=>{let l=W("sha256").update(u.data).digest("hex").slice(0,16).toUpperCase(),h=r?.[a],d=String(h?.projectDir??u.project_dir??this._getSessionProjectDir(t)??"").trim(),p=d===""?"":C(d),m=String(h?.source??u.attribution_source??"unknown"),f=Number(h?.confidence??u.attribution_confidence??0),E=Number.isFinite(f)?Math.max(0,Math.min(1,f)):0,S=o?.[a],_=st(S?.bytesAvoided),Q=st(S?.bytesReturned);return{event:u,dataHash:l,projectDir:p,attributionSource:m,attributionConfidence:E,bytesAvoided:_,bytesReturned:Q}}),c=this.db.transaction(()=>{let u=this.stmt(g.getEventCount).get(t).cnt;for(let a of i)this.stmt(g.checkDuplicate).get(t,Gt,a.event.type,a.dataHash)||(u>=Vt?this.stmt(g.evictLowestPriority).run(t):u++,this.stmt(g.insertEvent).run(t,a.event.type,a.event.category,a.event.priority,a.event.data,a.projectDir,a.attributionSource,a.attributionConfidence,a.bytesAvoided,a.bytesReturned,s,a.dataHash));this.stmt(g.updateMetaLastEvent).run(t)});this.withRetry(()=>c())}getEvents(t,e){let s=e?.limit??1e3,r=e?.type,o=e?.minPriority;return r&&o!==void 0?this.stmt(g.getEventsByTypeAndPriority).all(t,r,o,s):r?this.stmt(g.getEventsByType).all(t,r,s):o!==void 0?this.stmt(g.getEventsByPriority).all(t,o,s):this.stmt(g.getEvents).all(t,s)}getEventCount(t){return this.stmt(g.getEventCount).get(t).cnt}getEventBytesSummary(t){let e=this.stmt(g.getEventBytesSummary).get(t);return{bytesAvoided:Number(e?.bytes_avoided??0),bytesReturned:Number(e?.bytes_returned??0)}}getLatestAttributedProjectDir(t){return this.stmt(g.getLatestAttributedProject).get(t)?.project_dir||null}_getSessionProjectDir(t){try{return this.db.prepare("SELECT project_dir FROM session_meta WHERE session_id = ?").get(t)?.project_dir||""}catch{return""}}searchEvents(t,e,s,r){try{let o=t.replace(/[%_]/g,c=>"\\"+c),i=r??null;return this.stmt(g.searchEvents).all(s,o,o,i,i,e)}catch{return[]}}getSessionIdsForProject(t){try{let e=C(t);return this.db.prepare(`SELECT DISTINCT session_id
             FROM session_events
            WHERE RTRIM(REPLACE(project_dir, '\\', '/'), '/') = ?`).all(e).map(r=>r.session_id)}catch{return[]}}ensureSession(t,e){this.stmt(g.ensureSession).run(t,e)}getSessionStats(t){return this.stmt(g.getSessionStats).get(t)??null}getSessionRollup(t){let e=this.stmt(g.getSessionRollup).get(t),s=this.stmt(g.getMaxFileEdits).get(t),r=this.stmt(g.getLatestCommitMessage).get(t),o=this.getSessionStats(t),i=(e?.tool_calls??0)>0?e?.unique_files??0:0,c=e?.errors??0,u=Math.min(i,c);return{tool_calls:e?.tool_calls??0,errors:e?.errors??0,unique_tools:e?.unique_tools??0,unique_files:e?.unique_files??0,max_file_edits:s?.max_file_edits??0,has_commit:e?.has_commit??0,commit_message:r?.data??"",edit_test_cycles:u,duration_min:e?.duration_min??0,compact_count:o?.compact_count??0,sources_indexed:e?.sources_indexed??0,total_chunks:e?.total_chunks??0,search_queries:e?.search_queries??0}}incrementCompactCount(t){this.stmt(g.incrementCompactCount).run(t)}getUsageCursor(t){return this.stmt(g.getUsageCursor).get(t)?.usage_cursor??null}setUsageCursor(t,e){this.stmt(g.setUsageCursor).run(e,t)}upsertResume(t,e,s){this.stmt(g.upsertResume).run(t,e,s??0)}getResume(t){return this.stmt(g.getResume).get(t)??null}markResumeConsumed(t){this.stmt(g.markResumeConsumed).run(t)}claimLatestUnconsumedResume(t){let e=this.stmt(g.claimLatestUnconsumedResume).get(t);return e?{sessionId:e.session_id,snapshot:e.snapshot}:null}getLatestSessionId(){try{return this.db.prepare("SELECT session_id FROM session_meta ORDER BY started_at DESC LIMIT 1").get()?.session_id??null}catch{return null}}incrementToolCall(t,e,s=0){let r=Number.isFinite(s)&&s>0?Math.round(s):0;try{this.stmt(g.incrementToolCall).run(t,e,r)}catch{}}getToolCallStats(t){try{let e=this.stmt(g.getToolCallTotals).get(t),s=this.stmt(g.getToolCallByTool).all(t),r={};for(let o of s)r[o.tool]={calls:o.calls,bytesReturned:o.bytes_returned};return{totalCalls:e?.calls??0,totalBytesReturned:e?.bytes_returned??0,byTool:r}}catch{return{totalCalls:0,totalBytesReturned:0,byTool:{}}}}deleteSession(t){this.db.transaction(()=>{this.stmt(g.deleteEvents).run(t),this.stmt(g.deleteResume).run(t),this.stmt(g.deleteMeta).run(t)})()}cleanupOldSessions(t=7){let e=`-${t}`,s=this.stmt(g.getOldSessions).all(e);for(let{session_id:r}of s)this.deleteSession(r);return s.length}pruneOrphanedEvents(){let t=this.db.prepare("DELETE FROM session_events WHERE session_id NOT IN (SELECT session_id FROM session_meta)").run();return Number(t.changes??0)}}});import{existsSync as Ms,statSync as Me}from"node:fs";import{resolve as q,dirname as Nt,join as Ae,basename as Ue,isAbsolute as Us}from"node:path";import{fileURLToPath as Fe,pathToFileURL as Oe}from"node:url";import{execFileSync as zn}from"node:child_process";import{existsSync as ue,readFileSync as pe,readdirSync as de}from"node:fs";import{join as k}from"node:path";V();L();import{join as ee}from"node:path";import{accessSync as Pn,copyFileSync as Mn,constants as Un,mkdirSync as Fn}from"node:fs";import{homedir as jn}from"node:os";var ot=class{constructor(t){this.sessionDirSegments=t}sessionDirSegments;getSessionDir(){let t=R().sessions;return Fn(t,{recursive:!0}),t}getConfigDir(t){return ee(jn(),...this.sessionDirSegments)}getInstructionFiles(){return["AGENTS.md","AGENTS.override.md"]}getMemoryDir(t){let e=R().memory;return t?ee(e,A(t)):e}backupSettings(){let t=this.getSettingsPath();try{Pn(t,Un.R_OK);let e=t+".bak";return Mn(t,e),e}catch{return null}}};V();L();import{homedir as ne}from"node:os";import{resolve as xt}from"node:path";function it(n=process.env){let t=n.CODEX_HOME;return t&&t.trim()!==""?t.startsWith("~")?xt(ne(),t.replace(/^~[/\\]?/,"")):xt(t):xt(ne(),".codex")}import{execFileSync as se,execSync as G}from"node:child_process";import{existsSync as J}from"node:fs";var $n=/^(bash|sh|zsh|dash|pwsh|powershell|cmd)(\.exe)?$/i;function Hn(n){let t=n.split(/[\\/]/);return t[t.length-1]??n}function Bn(n){return $n.test(Hn(n))}function Wn(n){let t=n.toLowerCase().replace(/\//g,"\\");return/\\windows\\(?:system32|sysnative)\\bash\.exe$/.test(t)||/\\microsoft\\windowsapps\\bash\.exe$/.test(t)}function Xn(n){let t=n.toLowerCase().replace(/\//g,"\\");return/\\windows\\(?:system32|sysnative)\\cmd\.exe$/.test(t)}var Y=process.platform==="win32";function y(n){try{let t=Y?`where ${n}`:`command -v ${n}`;return G(t,{stdio:"pipe"}),!0}catch{return!1}}function kt(n){if(Y)try{let e=G(`where ${n}`,{encoding:"utf-8",stdio:"pipe"}).trim().split(/\r?\n/).map(r=>r.trim()).filter(Boolean);if(e.length===0||e.filter(r=>!/\\Microsoft\\WindowsApps\\/i.test(r)).length===0)return!1}catch{return!1}else if(!y(n))return!1;try{return Y?G(`"${n}" --version`,{stdio:"pipe",timeout:5e3}):se(n,["--version"],{stdio:"pipe",timeout:1500}),!0}catch{return!1}}function Vn(){if(y("bun"))return!0;for(let n of re())if(J(n))return!0;return!1}function Gn(){for(let t of re())if(J(t))return t;if(y("bun"))return"bun";let n=process.env.HOME??process.env.USERPROFILE??"";return Y?`${n}\\.bun\\bin\\bun.exe`:`${n}/.bun/bin/bun`}function re(){let n=process.env.HOME??process.env.USERPROFILE??"";if(Y){let t=process.env.LOCALAPPDATA??"",e=process.env.APPDATA??"";return[...n?[`${n}\\.bun\\bin\\bun.exe`]:[],...t?[`${t}\\bun\\bin\\bun.exe`]:[],...e?[`${e}\\npm\\node_modules\\bun\\bin\\bun.exe`]:[]]}return n?[`${n}/.bun/bin/bun`]:[]}var Yn=["C:\\Program Files\\Git\\usr\\bin\\bash.exe","C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe"];function oe(){let n;try{n=G("where bash",{encoding:"utf-8",stdio:"pipe"}).trim().split(/\r?\n/).map(e=>e.trim()).filter(Boolean)}catch{return null}for(let t of n){let e=t.toLowerCase();if(!(e.includes("system32")||e.includes("windowsapps"))){for(let s of Yn)if(J(s))return s;return t}}return null}function Jn(n=oe()){return n??(y("sh")?"sh":y("pwsh")?"pwsh":y("powershell")?"powershell":"cmd.exe")}function b(n,t=["--version"]){try{if(process.platform==="win32"){let e=[n,...t].map(s=>/[\s"&|<>^()%!]/.test(s)?JSON.stringify(s):s).join(" ");return G(e,{encoding:"utf-8",stdio:["pipe","pipe","pipe"],timeout:5e3}).trim().split(/\r?\n/)[0]}else return se(n,t,{encoding:"utf-8",stdio:["pipe","pipe","pipe"],timeout:5e3}).trim().split(/\r?\n/)[0]}catch{return"unknown"}}function Kn(n,t={}){if(n)return n;let e=t.execPath??process.execPath,s=t.commandExists??y,r=e.split(/[\\/]/).pop().replace(/\.exe$/i,"");return ce.has(r)&&J(e)?e:s("node")?"node":null}function ie(){let t=Vn()?Gn():null,e=process.env.SHELL,s=process.platform==="win32",r=s?oe():null,o=e&&J(e)&&Bn(e)&&!(s&&Wn(e))&&!(s&&r&&Xn(e))?e:null;return{javascript:Kn(t),typescript:t||(y("tsx")?"tsx":y("ts-node")?"ts-node":null),python:kt("python3")?"python3":kt("python")?"python":kt("py")?"py":null,shell:o??(s?Jn(r):y("bash")?"bash":"sh"),ruby:y("ruby")?"ruby":null,go:y("go")?"go":null,rust:y("rustc")?"rustc":null,php:y("php")?"php":null,perl:y("perl")?"perl":null,r:y("Rscript")?"Rscript":y("r")?"r":null,elixir:y("elixir")?"elixir":null,csharp:y("dotnet-script")?"dotnet-script":null}}function ae(n){let t=[],e=n.javascript?.endsWith("bun")??!1;return n.javascript?t.push(`  JavaScript: ${n.javascript} (${b(n.javascript)})${e?" \u26A1":""}`):t.push("  JavaScript: not available (install node or bun \u2014 host process is not a JS runtime)"),n.typescript?t.push(`  TypeScript: ${n.typescript} (${b(n.typescript)})`):t.push("  TypeScript: not available (install bun, tsx, or ts-node)"),n.python?t.push(`  Python:     ${n.python} (${b(n.python)})`):t.push("  Python:     not available"),t.push(`  Shell:      ${n.shell} (${b(n.shell)})`),n.ruby&&t.push(`  Ruby:       ${n.ruby} (${b(n.ruby)})`),n.go&&t.push(`  Go:         ${n.go} (${b(n.go,["version"])})`),n.rust&&t.push(`  Rust:       ${n.rust} (${b(n.rust)})`),n.php&&t.push(`  PHP:        ${n.php} (${b(n.php)})`),n.perl&&t.push(`  Perl:       ${n.perl} (${b(n.perl)})`),n.r&&t.push(`  R:          ${n.r} (${b(n.r)})`),n.elixir&&t.push(`  Elixir:     ${n.elixir} (${b(n.elixir)})`),n.csharp&&t.push(`  C#:         ${n.csharp} (${b(n.csharp)})`),e||(t.push(""),t.push("  Tip: Install Bun for 3-5x faster JS/TS execution \u2192 https://bun.sh")),t.join(`
`)}function le(n,t){let e=process.execPath.replace(/\\/g,"/"),s=n.replace(/\\/g,"/");return`"${e}" "${s}"`}var ce=new Set(["node","bun","deno"]);var he={PreToolUse:"pre-tool-use",PostToolUse:"post-tool-use",SessionStart:"session-start",PreCompact:"pre-compact",UserPromptSubmit:"user-prompt-submit",Stop:"stop"},qn="local_shell|shell|shell_command|exec_command|Bash|Shell|apply_patch|Edit|Write|read_file|Read|grep_files|ctx_execute|ctx_execute_file|ctx_batch_execute|ctx_fetch_and_index|ctx_search|ctx_index|mcp__";function me(n=zn){try{return String(process.platform==="win32"?n("cmd.exe",["/d","/s","/c","codex --version"],{encoding:"utf8",stdio:["ignore","pipe","ignore"],timeout:5e3}):n("codex",["--version"],{encoding:"utf8",stdio:["ignore","pipe","ignore"],timeout:5e3})).trim()}catch{return null}}function Ct(n){try{return pe(n,"utf8")}catch{return""}}function Qn(n){let t=[];for(let e of n.split(/\r?\n/)){let s=e.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);s?t.push({name:s[1].trim(),body:""}):t.length&&(t[t.length-1].body+=e+`
`)}return t}function ge(n){return/(?:codex-context-mode|context-mode|hooks[/\\]codex[/\\])/.test(n)}function Zn(n){try{for(let t of de(n,{withFileTypes:!0})){if(!t.isDirectory())continue;if(t.name==="context-mode"||de(k(n,t.name),{withFileTypes:!0}).some(s=>s.isDirectory()&&s.name==="context-mode"))return!0}}catch{}return!1}var K=class extends ot{constructor(t={}){super([".codex"])}name="Codex";paradigm="json-stdio";capabilities={preToolUse:!0,postToolUse:!0,preCompact:!0,sessionStart:!0,canModifyArgs:!1,canModifyOutput:!1,canInjectSessionContext:!0};parsePreToolUseInput(t){let e=t;return{toolName:e.tool_name??"",toolInput:e.tool_input??{},sessionId:this.extractSessionId(e),projectDir:this.getProjectDir(e),raw:t}}parsePostToolUseInput(t){let e=t;return{toolName:e.tool_name??"",toolInput:e.tool_input??{},toolOutput:e.tool_response,sessionId:this.extractSessionId(e),projectDir:this.getProjectDir(e),raw:t}}parsePreCompactInput(t){let e=t;return{sessionId:this.extractSessionId(e),projectDir:this.getProjectDir(e),raw:t}}parseSessionStartInput(t){let e=t,s=e.source??"startup",r;switch(s){case"compact":r="compact";break;case"resume":r="resume";break;case"clear":r="clear";break;default:r="startup"}return{sessionId:this.extractSessionId(e),source:r,projectDir:this.getProjectDir(e),raw:t}}formatPreToolUseResponse(t){return t.decision==="deny"?{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:t.reason??"Blocked by codex-context-mode hook"}}:t.decision==="context"&&t.additionalContext?{}:{}}formatPostToolUseResponse(t){return t.additionalContext?{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:t.additionalContext}}:{}}formatPreCompactResponse(t){return{}}formatSessionStartResponse(t){return t.context?{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:t.context}}:{}}getConfigDir(t){return it()}getSettingsPath(){return k(this.getConfigDir(),"config.toml")}getSessionDir(){return R().sessions}getInstructionFiles(){return["AGENTS.md","AGENTS.override.md"]}getMemoryDir(t){let e=R().memory;return t?k(e,A(t)):e}getProjectDir(t){return t?.cwd??process.env.CODEX_PROJECT_DIR??process.cwd()}getHooksPath(){return k(this.getConfigDir(),"hooks.json")}generateHookConfig(t){return Object.fromEntries(Object.entries(he).map(([e,s])=>[e,[{matcher:e==="PreToolUse"?qn:"",hooks:[{type:"command",command:le(k(t,"hooks","codex",s+".mjs"))}]}]]))}readSettings(){return null}writeSettings(){throw new Error("Codex manages plugin configuration; no standalone installer is provided.")}configureAllHooks(){throw new Error("Install/enable codex-context-mode through Codex plugin management.")}backupSettings(){return null}setHookPermissions(){return[]}updatePluginRegistry(){throw new Error("Codex owns the plugin registry.")}getInstalledVersion(){return"plugin-managed"}getRoutingInstructions(){return"Use the bundled codex-context-mode:main skill and ctx_* MCP tools."}checkPluginRegistration(){let t=Ct(this.getSettingsPath()),e=Qn(t),s=e.filter(i=>/^plugins\.(?:"codex-context-mode(?:@[^"]+)?"|'codex-context-mode(?:@[^']+)?'|codex-context-mode)$/.test(i.name)&&!/^\s*enabled\s*=\s*false/m.test(i.body)),r=e.some(i=>/^mcp_servers\.["']?(?:codex-context-mode|codex_context_mode|context-mode|context_mode)["']?(?:\.|$)/.test(i.name)),o=e.some(i=>/^plugins\.(?:"context-mode(?:@[^"]+)?"|'context-mode(?:@[^']+)?'|context-mode)$/.test(i.name));return r||s.length>1?{check:"MCP registration",status:"fail",message:"Duplicate/standalone codex-context-mode registrations; keep one codex-context-mode plugin."}:o?{check:"MCP registration",status:"fail",message:"Stale upstream context-mode plugin registration."}:{check:"MCP registration",status:s.length===1?"pass":"fail",message:s.length===1?"One codex-context-mode plugin enabled":"Install and enable codex-context-mode in Codex"}}validateHooks(t){let e=[this.checkPluginRegistration()],s=(a,l,h)=>e.push({check:a,status:l?"pass":"fail",message:h}),r;try{r=JSON.parse(pe(k(t,"hooks","hooks.json"),"utf8"))}catch{return s("Bundled hooks",!1,"Missing or invalid hooks/hooks.json"),e}s("Bundled hooks",Object.keys(r.hooks??{}).length===6,"Exactly six native Codex hooks required");for(let[a,l]of Object.entries(he)){let h=r.hooks?.[a],d=h?.[0]?.hooks?.[0]?.command;s(a+" hook",h?.length===1&&h[0].hooks?.length===1&&typeof d=="string"&&d.includes("/hooks/codex/"+l+".mjs")&&ue(k(t,"hooks","codex",l+".mjs")),"Bundled "+a+" uses "+l+".mjs")}let i=Ct(this.getSettingsPath()).split(/\[\[hooks\./).slice(1).flatMap(a=>a.match(/^\s*command\s*=.*$/gm)??[]);s("Native user-hook duplicates",!i.some(ge),"No standalone codex-context-mode native hooks");let c=Ct(this.getHooksPath());if(c)try{let a=JSON.parse(c),l=Object.values(a.hooks??{}).flatMap(h=>Array.isArray(h)?h.flatMap(d=>(d.hooks??[]).map(p=>String(p.command??""))):[]);s("Standalone user hooks",!l.some(ge),"No separate codex-context-mode user hooks")}catch{s("Standalone user hooks",!1,"Invalid user hooks.json")}return s("Stale upstream installation",!Zn(k(this.getConfigDir(),"plugins","cache")),"No upstream context-mode cache in any marketplace"),s("Standalone skills",!["context-mode","ctx-doctor","ctx-index","ctx-search","ctx-stats","ctx-purge","ctx-upgrade","ctx-insight"].some(a=>ue(k(this.getConfigDir(),"skills",a))),"Skills are bundled, not installed separately"),e}extractSessionId(t){return t.session_id||"pid-"+process.ppid}};nt();L();import{readFileSync as be,unlinkSync as ms,existsSync as fs,statSync as Re,openSync as Te,fstatSync as xe,closeSync as ke}from"node:fs";import{createHash as Ce}from"node:crypto";import{join as Es}from"node:path";import{readdirSync as ts,statSync as es,lstatSync as ns,realpathSync as fe,existsSync as ss,readFileSync as rs}from"node:fs";import{join as ye,extname as os,relative as Se,sep as is,resolve as as}from"node:path";var cs=["node_modules",".git","dist","build",".next","coverage",".venv","__pycache__",".DS_Store"],ls=[".md",".mdx",".txt",".json",".yaml",".yml",".ts",".tsx",".js",".jsx",".py",".rs",".go",".sh"],us=5,ds=200;function hs(n){let t="";for(let e=0;e<n.length;e++){let s=n[e];s==="*"?n[e+1]==="*"?(t+=".*",e++):t+="[^/]*":s==="?"?t+="[^/]":"\\^$.|+()[]{}".includes(s)?t+="\\"+s:t+=s}return new RegExp(`^${t}$`)}function Ee(n,t){if(t.length===0)return!1;let e=n.split("/").pop()??n;for(let s of t){if(!s.includes("/")&&!s.includes("*")){if(e===s||n.split("/").includes(s))return!0;continue}let r=hs(s);if(r.test(n)||r.test(e))return!0}return!1}function gs(n){let t=ye(n,".gitignore");if(!ss(t))return[];try{return rs(t,"utf-8").split(/\r?\n/).map(s=>s.trim()).filter(s=>s.length>0&&!s.startsWith("#")&&!s.startsWith("!")).map(s=>s.replace(/^\//,"").replace(/\/$/,""))}catch{return[]}}function ps(n,t){return Se(n,t).split(is).join("/")}function _e(n,t={}){let{include:e,exclude:s,maxDepth:r=us,maxFiles:o=ds,extensions:i,respectGitignore:c=!0,followSymlinks:u=!1}=t,a;try{a=fe(n)}catch{return{files:[],capped:!1,totalSeen:0}}let l=(i&&i.length>0?i:ls).map(_=>(_.startsWith(".")?_:"."+_).toLowerCase()),h=[...cs,...s??[],...c?gs(a):[]],d=e??[],p=[],m=new Set([a]),f=0,E=!1;function S(_,Q){if(E||Q>r)return;let Ot;try{Ot=ts(_,{withFileTypes:!0})}catch{return}for(let ut of Ot){if(E)return;let O=ye(_,ut.name),Lt=ps(a,O);if(Ee(Lt,h))continue;let It=ut.isDirectory(),Pt=ut.isFile(),Mt=!1;try{Mt=ns(O).isSymbolicLink()}catch{continue}if(Mt){if(!u)continue;let w;try{w=fe(O)}catch{continue}let dt=Se(a,w);if((dt.startsWith("..")||as(dt)===w)&&dt.startsWith("..")||m.has(w))continue;m.add(w);try{let Ut=es(w);It=Ut.isDirectory(),Pt=Ut.isFile()}catch{continue}}if(It){S(O,Q+1);continue}if(!Pt)continue;let Be=os(O).toLowerCase();if(l.includes(Be)&&!(d.length>0&&!Ee(Lt,d))){if(f++,p.length>=o){E=!0;return}p.push(O)}}}return S(a,0),{files:p,capped:E,totalSeen:f}}var U=new Set(["the","and","for","are","but","not","you","all","can","had","her","was","one","our","out","has","his","how","its","may","new","now","old","see","way","who","did","get","got","let","say","she","too","use","will","with","this","that","from","they","been","have","many","some","them","than","each","make","like","just","over","such","take","into","year","your","good","could","would","about","which","their","there","other","after","should","through","also","more","most","only","very","when","what","then","these","those","being","does","done","both","same","still","while","where","here","were","much","update","updates","updated","deps","dev","tests","test","add","added","fix","fixed","run","running","using"]);function we(n){let t=new Set,e=[];for(let s of n){let r=s.toLowerCase();t.has(r)||(t.add(r),e.push(s))}return e}function ys(n,t="AND"){let e=we(n.replace(/['"(){}[\]*:^~]/g," ").split(/\s+/).filter(o=>o.length>0&&!["AND","OR","NOT","NEAR"].includes(o.toUpperCase())));if(e.length===0)return'""';let s=e.filter(o=>!U.has(o.toLowerCase()));return(s.length>0?s:e).map(o=>`"${o}"`).join(t==="OR"?" OR ":" ")}function Ss(n,t="AND"){let e=n.replace(/["'(){}[\]*:^~]/g,"").trim();if(e.length<3)return"";let s=we(e.split(/\s+/).filter(i=>i.length>=3));if(s.length===0)return"";let r=s.filter(i=>!U.has(i.toLowerCase()));return(r.length>0?r:s).map(i=>`"${i}"`).join(t==="OR"?" OR ":" ")}function _s(n,t){if(n.length===0)return t.length;if(t.length===0)return n.length;let e=Array.from({length:t.length+1},(s,r)=>r);for(let s=1;s<=n.length;s++){let r=[s];for(let o=1;o<=t.length;o++)r[o]=n[s-1]===t[o-1]?e[o-1]:1+Math.min(e[o],r[o-1],e[o-1]);e=r}return e[t.length]}function bs(n){return n<=4?1:n<=12?2:3}var at=4096,Rs=3,Ts=200,xs=5e3,ve=80,ks=.5;function Cs(n,t){let e=[],s=n.indexOf(t);for(;s!==-1;)e.push(s),s=n.indexOf(t,s+1);return e}function vs(n,t,e=30){if(n.length<2||t.length<2)return 0;let s=0,r=Math.min(n.length,t.length)-1;for(let o=0;o<r;o++){let i=n[o],c=n[o+1],u=t[o].length,a=0;for(let l of i){let h=l+u,d=h+e;for(;a<c.length&&c[a]<h;)a++;a<c.length&&c[a]<=d&&(s++,a++)}}return s}function ws(n){if(n.length===0)return 1/0;if(n.length===1)return 0;let t=n,e=new Array(t.length).fill(0),s=1/0;for(;;){let r=1/0,o=-1/0,i=0;for(let u=0;u<t.length;u++){let a=t[u][e[u]];a<r&&(r=a,i=u),a>o&&(o=a)}let c=o-r;if(c<s&&(s=c),e[i]++,e[i]>=t[i].length)break}return s}var ct=class n{#t;#e;#o;#a;#c;#l;#u;#d;#h;#g;#p;#m;#f;#E;#y;#S;#_;#b;#R;#T;#x;#k;#C;#v;#w;#N;#D;#A;#O;#L;#I;#P;#M;#U=0;static OPTIMIZE_EVERY=50;#n=new Map;static FUZZY_CACHE_SIZE=256;constructor(t){let e=B();this.#e=t??Es(tt(),`content-${process.pid}.db`),this.#e!==":memory:"&&N(this.#e),$(this.#e);let s;try{s=new e(this.#e,{timeout:3e4}),j(s)}catch(r){let o=r instanceof Error?r.message:String(r);if(yt(o)){Et(this.#e),$(this.#e);try{s=new e(this.#e,{timeout:3e4}),j(s)}catch(i){throw new Error(`Failed to create fresh DB after deleting corrupt file: ${i instanceof Error?i.message:String(i)}`)}}else throw r}this.#t=s,this.#W(),this.#X()}cleanup(){try{this.#t.close()}catch{}for(let t of["","-wal","-shm"])try{ms(this.#e+t)}catch{}}#W(){this.#t.exec(`
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
        `))}catch{}try{this.#t.exec("ALTER TABLE sources ADD COLUMN file_path TEXT")}catch{}try{this.#t.exec("ALTER TABLE sources ADD COLUMN content_hash TEXT")}catch{}}#X(){this.#a=this.#t.prepare("INSERT INTO sources (label, chunk_count, code_chunk_count, file_path, content_hash) VALUES (?, 0, 0, ?, ?)"),this.#c=this.#t.prepare("INSERT INTO sources (label, chunk_count, code_chunk_count, file_path, content_hash) VALUES (?, ?, ?, ?, ?)"),this.#l=this.#t.prepare("INSERT INTO chunks (title, content, source_id, content_type, source_category, session_id, event_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),this.#u=this.#t.prepare("INSERT INTO chunks_trigram (title, content, source_id, content_type, source_category, session_id, event_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),this.#d=this.#t.prepare("INSERT OR IGNORE INTO vocabulary (word) VALUES (?)"),this.#h=this.#t.prepare("DELETE FROM chunks WHERE source_id IN (SELECT id FROM sources WHERE label = ?)"),this.#g=this.#t.prepare("DELETE FROM chunks_trigram WHERE source_id IN (SELECT id FROM sources WHERE label = ?)"),this.#p=this.#t.prepare("DELETE FROM sources WHERE label = ?"),this.#m=this.#t.prepare(`
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
    `),this.#f=this.#t.prepare(`
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
      WHERE chunks MATCH ? AND sources.label = ?
      ORDER BY rank
      LIMIT ?
    `),this.#y=this.#t.prepare(`
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
      WHERE chunks_trigram MATCH ? AND sources.label LIKE ? ESCAPE '\\'
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
      WHERE chunks_trigram MATCH ? AND sources.label = ?
      ORDER BY rank
      LIMIT ?
    `),this.#R=this.#t.prepare(`
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
      WHERE chunks MATCH ? AND sources.label LIKE ? ESCAPE '\\' AND chunks.content_type = ?
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
      WHERE chunks MATCH ? AND sources.label = ? AND chunks.content_type = ?
      ORDER BY rank
      LIMIT ?
    `),this.#k=this.#t.prepare(`
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
      WHERE chunks_trigram MATCH ? AND sources.label LIKE ? ESCAPE '\\' AND chunks_trigram.content_type = ?
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
      WHERE chunks_trigram MATCH ? AND sources.label = ? AND chunks_trigram.content_type = ?
      ORDER BY rank
      LIMIT ?
    `),this.#b=this.#t.prepare("SELECT word FROM vocabulary WHERE length(word) BETWEEN ? AND ?"),this.#w=this.#t.prepare("SELECT label, chunk_count as chunkCount FROM sources ORDER BY id DESC"),this.#N=this.#t.prepare(`SELECT c.title, c.content, c.content_type, s.label
       FROM chunks c
       JOIN sources s ON s.id = c.source_id
       WHERE c.source_id = ?
       ORDER BY c.rowid`),this.#D=this.#t.prepare("SELECT chunk_count FROM sources WHERE id = ?"),this.#A=this.#t.prepare("SELECT content FROM chunks WHERE source_id = ?"),this.#L=this.#t.prepare("SELECT label, chunk_count, code_chunk_count, indexed_at, file_path, content_hash FROM sources WHERE label = ?"),this.#O=this.#t.prepare(`
      SELECT
        (SELECT COUNT(*) FROM sources) AS sources,
        (SELECT COUNT(*) FROM chunks) AS chunks,
        (SELECT COUNT(*) FROM chunks WHERE content_type = 'code') AS codeChunks
    `),this.#I=this.#t.prepare("DELETE FROM chunks WHERE source_id IN (SELECT id FROM sources WHERE datetime(indexed_at) < datetime('now', '-' || ? || ' days'))"),this.#P=this.#t.prepare("DELETE FROM chunks_trigram WHERE source_id IN (SELECT id FROM sources WHERE datetime(indexed_at) < datetime('now', '-' || ? || ' days'))"),this.#M=this.#t.prepare("DELETE FROM sources WHERE datetime(indexed_at) < datetime('now', '-' || ? || ' days')")}setDenyChecker(t){this.#o=t}index(t){let{content:e,path:s,source:r,attribution:o}=t,i=typeof e=="string"&&e.length>0;if(!i&&!s)throw new Error("Either content or path must be provided");let c;if(i)c=e;else{let d=Te(s,"r");try{if(!xe(d).isFile())throw new Error(`refusing to index ${s}: not a regular file`);c=be(d,"utf-8")}finally{ke(d)}}let u=r??s??"untitled",a=this.#J(c),l=s??void 0,h=l?Ce("sha256").update(c).digest("hex"):void 0;return D(()=>this.#s(a,u,c,l,h,o))}indexDirectory(t){let{path:e,source:s,attribution:r,perFileDeny:o,...i}=t,c=_e(e,i),u=0,a=0,l=0,h=0;for(let d of c.files){if(o&&o(d)){l++;continue}try{let p=s?`${s}:${d}`:d,m=this.index({path:d,source:p,attribution:r});u++,a+=m.totalChunks}catch{h++}}return{filesIndexed:u,totalChunks:a,capped:c.capped,totalSeen:c.totalSeen,denied:l,failed:h,label:s??e}}indexPlainText(t,e,s=20,r,o=at){if(!t||t.trim().length===0)return this.#s([],e,"",void 0,void 0,r);let i=this.#z(t,s,o);return D(()=>this.#s(i.map(c=>({...c,hasCode:!1})),e,t,void 0,void 0,r))}indexJSON(t,e,s=at,r){if(!t||t.trim().length===0)return this.indexPlainText("",e,void 0,r,s);let o;try{o=JSON.parse(t)}catch{return this.indexPlainText(t,e,void 0,r,s)}let i=[];return this.#B(o,[],i,s),i.length===0?this.indexPlainText(t,e,void 0,r,s):D(()=>this.#s(i,e,t,void 0,void 0,r))}#s(t,e,s,r,o,i){let c=t.filter(d=>d.hasCode).length,u=i?.sessionId??"",a=i?.eventId??"",h=this.#t.transaction(()=>{if(this.#h.run(e),this.#g.run(e),this.#p.run(e),t.length===0){let f=this.#a.run(e,r??null,o??null);return Number(f.lastInsertRowid)}let d=this.#c.run(e,t.length,c,r??null,o??null),p=Number(d.lastInsertRowid),m=new Date().toISOString();for(let f of t){let E=f.hasCode?"code":"prose";this.#l.run(f.title,f.content,p,E,null,u,a,m),this.#u.run(f.title,f.content,p,E,null,u,a,m)}return p})();return s&&this.#Y(s),this.#U++,this.#U%n.OPTIMIZE_EVERY===0&&this.#H(),{sourceId:h,label:e,totalChunks:t.length,codeChunks:c}}#F(t){return t.map(e=>({title:e.title,content:e.content,source:e.label,rank:e.rank,contentType:e.content_type,highlighted:e.highlighted,timestamp:e.timestamp??void 0,sessionId:e.session_id??""}))}#r(t,e){return e==="exact"?t:`%${t.replace(/\\/g,"\\\\").replace(/%/g,"\\%").replace(/_/g,"\\_")}%`}search(t,e=3,s,r="AND",o,i="like"){let c=ys(t,r),u,a;return s&&o?(u=i==="exact"?this.#x:this.#T,a=[c,this.#r(s,i),o,e]):s?(u=i==="exact"?this.#E:this.#f,a=[c,this.#r(s,i),e]):o?(u=this.#R,a=[c,o,e]):(u=this.#m,a=[c,e]),D(()=>this.#F(u.all(...a)))}searchTrigram(t,e=3,s,r="AND",o,i="like"){let c=Ss(t,r);if(!c)return[];let u,a;return s&&o?(u=i==="exact"?this.#v:this.#C,a=[c,this.#r(s,i),o,e]):s?(u=i==="exact"?this.#_:this.#S,a=[c,this.#r(s,i),e]):o?(u=this.#k,a=[c,o,e]):(u=this.#y,a=[c,e]),D(()=>this.#F(u.all(...a)))}fuzzyCorrect(t){let e=t.toLowerCase().trim();if(e.length<3)return null;if(this.#n.has(e)){let a=this.#n.get(e)??null;return this.#n.delete(e),this.#n.set(e,a),a}let s=bs(e.length),r=this.#b.all(e.length-s,e.length+s),o=null,i=s+1,c=!1;for(let{word:a}of r){if(a===e){c=!0;break}let l=_s(e,a);l<i&&(i=l,o=a)}let u=c?null:i<=s?o:null;if(this.#n.size>=n.FUZZY_CACHE_SIZE){let a=this.#n.keys().next().value;a!==void 0&&this.#n.delete(a)}return this.#n.set(e,u),u}#j(t,e,s,r,o="like"){let c=Math.max(e*2,10),u=this.search(t,c,s,"OR",r,o),a=this.searchTrigram(t,c,s,"OR",r,o),l=new Map,h=d=>`${d.source}::${d.title}`;for(let[d,p]of u.entries()){let m=h(p),f=l.get(m);f?f.score+=1/(60+d+1):l.set(m,{result:p,score:1/(60+d+1)})}for(let[d,p]of a.entries()){let m=h(p),f=l.get(m);f?f.score+=1/(60+d+1):l.set(m,{result:p,score:1/(60+d+1)})}return Array.from(l.values()).sort((d,p)=>p.score-d.score).slice(0,e).map(({result:d,score:p})=>({...d,rank:-p}))}#$(t,e){let s=e.toLowerCase().split(/\s+/).filter(i=>i.length>=2),r=s.filter(i=>!U.has(i)),o=r.length>0?r:s;return t.map(i=>{let c=i.title.toLowerCase(),u=o.filter(p=>c.includes(p)).length,a=i.contentType==="code"?.6:.3,l=u>0?a*(u/o.length):0,h=0,d=0;if(o.length>=2){let p=i.content.toLowerCase(),m=o.map(f=>Cs(p,f));if(!m.some(f=>f.length===0)){h=1/(1+ws(m)/Math.max(p.length,1));let E=vs(m,o);d=.5*Math.min(1,E/4)}}return{result:i,boost:l+h+d}}).sort((i,c)=>c.boost-i.boost||i.result.rank-c.result.rank).map(({result:i})=>i)}searchWithFallback(t,e=3,s,r,o="like",i){this.#G();let c=i?Math.max(e*8,40):e,u=this.#V(i),a=this.#j(t,c,s,r,o),l=u?a.filter(u):a;if(l.length>0)return this.#$(l.slice(0,e),t).map(E=>({...E,matchLayer:"rrf"}));let h=t.toLowerCase().trim().split(/\s+/).filter(f=>f.length>=3&&!U.has(f)),d=h.join(" "),m=h.map(f=>this.fuzzyCorrect(f)??f).join(" ");if(m!==d){let f=this.#j(m,c,s,r,o),E=u?f.filter(u):f;if(E.length>0)return this.#$(E.slice(0,e),m).map(_=>({..._,matchLayer:"rrf-fuzzy"}))}return[]}#V(t){return t?e=>{let s=e.sessionId??"";return s===""||t.has(s)}:null}lastRefreshCount=0;#G(){this.lastRefreshCount=0;let t=this.#t.prepare("SELECT label, file_path, content_hash, indexed_at FROM sources WHERE file_path IS NOT NULL").all();for(let e of t)try{if(!fs(e.file_path)||this.#o&&this.#o(e.file_path))continue;let s=Re(e.file_path).mtime,r=new Date(e.indexed_at+"Z");if(s<=r)continue;let o=Te(e.file_path,"r"),i;try{if(!xe(o).isFile())continue;i=be(o,"utf-8")}finally{ke(o)}if(Ce("sha256").update(i).digest("hex")===e.content_hash)continue;this.index({content:i,path:e.file_path,source:e.label}),this.lastRefreshCount++}catch{}}getSourceMeta(t){let e=this.#L.get(t);return e?{label:e.label,chunkCount:e.chunk_count,codeChunkCount:e.code_chunk_count,indexedAt:e.indexed_at,filePath:e.file_path??null,contentHash:e.content_hash??null}:null}listSources(){return this.#w.all()}getIndexState(){let t=this.#t.prepare("SELECT COALESCE(SUM(chunk_count), 0) AS total_chunks, COUNT(*) AS total_sources, MAX(indexed_at) AS last_indexed_at FROM sources").get();return{totalChunks:t.total_chunks??0,totalSources:t.total_sources??0,lastIndexedAt:t.last_indexed_at??void 0}}getChunksBySource(t){return this.#N.all(t).map(s=>({title:s.title,content:s.content,source:s.label,rank:0,contentType:s.content_type}))}getDistinctiveTerms(t,e=40){let s=this.#D.get(t);if(!s||s.chunk_count<3)return[];let r=s.chunk_count,o=2,i=Math.max(3,Math.ceil(r*.4)),c=new Map;for(let l of this.#A.iterate(t)){let h=new Set(l.content.toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(d=>d.length>=3&&!U.has(d)));for(let d of h)c.set(d,(c.get(d)??0)+1)}return Array.from(c.entries()).filter(([,l])=>l>=o&&l<=i).map(([l,h])=>{let d=Math.log(r/h),p=Math.min(l.length/20,.5),m=/[_]/.test(l),f=l.length>=12,E=m?1.5:f?.8:0;return{word:l,score:d+p+E}}).sort((l,h)=>h.score-l.score).slice(0,e).map(l=>l.word)}getStats(){let t=this.#O.get();return{sources:t?.sources??0,chunks:t?.chunks??0,codeChunks:t?.codeChunks??0}}cleanupStaleSources(t){return this.#t.transaction(r=>(this.#I.run(r),this.#P.run(r),this.#M.run(r)))(t).changes}getDBSizeBytes(){try{return Re(this.#e).size}catch{return 0}}#H(){try{this.#t.exec("INSERT INTO chunks(chunks) VALUES('optimize')"),this.#t.exec("INSERT INTO chunks_trigram(chunks_trigram) VALUES('optimize')")}catch{}}close(){this.#H(),H(this.#t)}#Y(t){let e=t.toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(o=>o.length>=3&&!U.has(o)),s=[...new Set(e)],r=0;this.#t.transaction(()=>{for(let o of s){let i=this.#d.run(o);r+=i.changes}})(),r>0&&this.#n.clear()}#J(t,e=at){let s=[],r=t.split(`
`),o=[],i=[],c="",u=()=>{let l=i.join(`
`).trim();if(l.length===0)return;let h=this.#tt(o,c),d=i.some(S=>/^`{3,}/.test(S));if(Buffer.byteLength(l)<=e){s.push({title:h,content:l,hasCode:d}),i=[];return}let p=l.split(/\n\n+/),m=[],f=1,E=()=>{if(m.length===0)return;let S=m.join(`

`).trim();if(S.length===0)return;let _=p.length>1?`${h} (${f})`:h;f++,s.push({title:_,content:S,hasCode:S.includes("```")}),m=[]};for(let S of p){m.push(S);let _=m.join(`

`);Buffer.byteLength(_)>e&&m.length>1&&(m.pop(),E(),m=[S])}E(),i=[]},a=0;for(;a<r.length;){let l=r[a];if(/^[-_*]{3,}\s*$/.test(l)){u(),a++;continue}let h=l.match(/^(#{1,4})\s+(.+)$/);if(h){u();let p=h[1].length,m=h[2].trim();for(;o.length>0&&o[o.length-1].level>=p;)o.pop();o.push({level:p,text:m}),c=m,i.push(l),a++;continue}let d=l.match(/^(`{3,})(.*)?$/);if(d){let p=d[1],m=[l];for(a++;a<r.length;){if(m.push(r[a]),r[a].startsWith(p)&&r[a].trim()===p){a++;break}a++}i.push(...m);continue}i.push(l),a++}return u(),s}#K(t,e){if(Buffer.byteLength(t)<=e)return t;let s="",r=0;for(let o of t){let i=Buffer.byteLength(o);if(r+i>e)break;s+=o,r+=i}return s.length===0?[...t][0]??"":s}#i(t,e,s){let r=[],o=[],i=1,c=()=>{if(o.length===0)return;let u=o.join(`
`),a=i===1?e:`${e} (${i})`;r.push({title:a,content:u}),i++,o=[]};for(let u of t){if(Buffer.byteLength(u)>s){c();let l=u,h=1;for(;l.length>0;){let d=this.#K(l,s);if(d.length<l.length){let m=d.lastIndexOf(" "),f=d.lastIndexOf(`
`),E=Math.max(m,f);E>d.length*ks&&(d=d.slice(0,E))}let p=i===1&&h===1?e:`${e} (${i}.${h})`;r.push({title:p,content:d}),l=l.slice(d.length),h++,i++}continue}let a=o.length>0?o.join(`
`)+`
`+u:u;Buffer.byteLength(a)>s&&o.length>0&&c(),o.push(u)}return c(),r}#z(t,e,s=at){let r=t.split(/\n\s*\n/);if(r.length>=Rs&&r.length<=Ts&&r.every(a=>Buffer.byteLength(a)<xs))return r.flatMap((a,l)=>{let h=a.trim();if(h.length===0)return[];let d=h.split(`
`)[0].slice(0,ve)||`Section ${l+1}`;return Buffer.byteLength(h)<=s?[{title:d,content:h}]:this.#i(h.split(`
`),d,s)});let o=t.split(`
`);if(o.length<=e)return Buffer.byteLength(t)<=s?[{title:"Output",content:t}]:this.#i(o,"Output",s);let i=[],u=Math.max(e-2,1);for(let a=0;a<o.length;a+=u){let l=o.slice(a,a+e);if(l.length===0)break;let h=a+1,d=Math.min(a+l.length,o.length),p=l[0]?.trim().slice(0,ve),m=l.join(`
`);if(Buffer.byteLength(m)<=s)i.push({title:p||`Lines ${h}-${d}`,content:m});else{let f=this.#i(l,p||`Lines ${h}-${d}`,s);i.push(...f)}}return i}#B(t,e,s,r){let o=e.length>0?e.join(" > "):"(root)",i=JSON.stringify(t,null,2);if(Buffer.byteLength(i)<=r&&!(typeof t=="object"&&t!==null&&!Array.isArray(t)&&Object.values(t).some(u=>typeof u=="object"&&u!==null))){s.push({title:o,content:i,hasCode:!0});return}if(typeof t=="object"&&t!==null&&!Array.isArray(t)){let c=Object.entries(t);if(c.length>0){for(let[u,a]of c)this.#B(a,[...e,u],s,r);return}s.push({title:o,content:i,hasCode:!0});return}if(Array.isArray(t)){this.#Z(t,e,s,r);return}s.push({title:o,content:i,hasCode:!1})}#q(t){if(t.length===0)return null;let e=t[0];if(typeof e!="object"||e===null||Array.isArray(e))return null;let s=["id","name","title","path","slug","key","label"],r=e;for(let o of s)if(o in r&&(typeof r[o]=="string"||typeof r[o]=="number"))return o;return null}#Q(t,e,s,r,o){let i=t?`${t} > `:"";if(!o)return e===s?`${i}[${e}]`:`${i}[${e}-${s}]`;let c=u=>String(u[o]);return r.length===1?`${i}${c(r[0])}`:r.length<=3?i+r.map(c).join(", "):`${i}${c(r[0])}\u2026${c(r[r.length-1])}`}#Z(t,e,s,r){let o=e.length>0?e.join(" > "):"(root)",i=this.#q(t),c=[],u=0,a=l=>{if(c.length===0)return;let h=this.#Q(o,u,l,c,i);s.push({title:h,content:JSON.stringify(c,null,2),hasCode:!0})};for(let l=0;l<t.length;l++){c.push(t[l]);let h=JSON.stringify(c,null,2);Buffer.byteLength(h)>r&&c.length>1&&(c.pop(),a(l-1),c=[t[l]],u=l)}a(u+c.length-1)}#tt(t,e){return t.length===0?e||"Untitled":t.map(s=>s.text).join(" > ")}};nt();import{readFileSync as As,realpathSync as Os}from"node:fs";import{relative as Zr,resolve as lt,sep as to}from"node:path";import{resolve as z}from"node:path";import{homedir as Ne}from"node:os";function Ns(n=process.env){let t=n.CLAUDE_CONFIG_DIR;return t&&t.trim()!==""?t.startsWith("~")?z(Ne(),t.replace(/^~[/\\]?/,"")):z(t):z(Ne(),".claude")}function Ds(n=process.env){return z(Ns(n),"settings.json")}function De(n=process.env){let t=[z(it(n),"settings.json")],e=Ds(n);return t.includes(e)||t.push(e),t}function Ls(n){let t=n.match(/^(\w+)\((.+)\)$/);return t?{tool:t[1],glob:t[2]}:null}function Is(n,t=!1){let e="",s=0;for(;s<n.length;)n[s]==="*"&&n[s+1]==="*"?s+2<n.length&&n[s+2]==="/"?(e+="(.*/)?",s+=3):(e+=".*",s+=2):n[s]==="*"?(e+="[^/]*",s++):n[s]==="?"?(e+="[^/]",s++):(e+=n[s].replace(/[.+^${}()|[\]\\\/\-]/g,"\\$&"),s++);return new RegExp(`^${e}$`,t?"i":"")}function vt(n,t,e){return Ps(n,"deny",t,e)}function Ps(n,t,e,s){let r=[],o=c=>{let u;try{u=As(c,"utf-8")}catch{return null}let a;try{a=JSON.parse(u)}catch{return null}let l=a?.permissions?.[t];if(!Array.isArray(l))return[];let h=[];for(let d of l){if(typeof d!="string")continue;let p=Ls(d);p&&p.tool===n&&h.push(p.glob)}return h};if(e){let c=o(lt(e,".codex","settings.json"));c!==null&&r.push(c);let u=o(lt(e,".claude","settings.local.json"));u!==null&&r.push(u);let a=o(lt(e,".claude","settings.json"));a!==null&&r.push(a)}let i=s!==void 0?[s]:De();for(let c of i){let u=o(c);u!==null&&r.push(u)}return r}function wt(n,t,e=process.platform==="win32"||process.platform==="darwin",s){let r=i=>i.replace(/\\/g,"/"),o=new Set;if(o.add(r(n)),s){let i=lt(s,n);o.add(r(i));try{o.add(r(Os(i)))}catch{}}for(let i of t)for(let c of i){let u=Is(r(c),e);for(let a of o)if(u.test(a))return{denied:!0,matchedPattern:c}}return{denied:!1}}V();var Le={"pre-tool-use":"pre-tool-use","post-tool-use":"post-tool-use","session-start":"session-start","pre-compact":"pre-compact","user-prompt-submit":"user-prompt-submit",stop:"stop"};function Dt(){let n=Nt(Fe(import.meta.url));return["src","build"].includes(Ue(n))?Nt(n):n}function fo(n){return n.replace(/\\/g,"/")}function je(n){let t=[],e={};for(let s=0;s<n.length;s++){let r=n[s];if(!r.startsWith("--")||r==="--"){t.push(r);continue}let o=r.slice(2),i=o.indexOf("="),c=i>=0?o.slice(0,i):o,u=i>=0?o.slice(i+1):void 0,a=n[s+1],l=u!==void 0?u:a&&!a.startsWith("--")?(s++,a):!0;if(c==="include"||c==="exclude"){let h=e[c];e[c]=Array.isArray(h)?[...h,String(l)]:[String(l)]}else e[c]=l}return{positional:t,flags:e}}function v(n,t){let e=n[t];if(typeof e=="string"&&e.length>0)return e}function Ie(n,t){return n[t]===!0||n[t]==="true"}function Pe(n,t){let e=n[t];if(Array.isArray(e))return e.filter(Boolean);if(typeof e=="string"&&e.length>0)return[e]}function At(n,t,e={}){let s=v(n,t);if(!s)return;let r=Number(s),o=e.min??1;if(!Number.isInteger(r)||r<o)throw new Error(`--${t} must be an integer >= ${o}`);return r}function Fs(n){let t=v(n,"ext")??v(n,"extensions");if(!t)return;let e=t.split(",").map(s=>s.trim()).filter(Boolean).map(s=>s.startsWith(".")?s:`.${s}`);return e.length>0?e:void 0}function $e(n,t){return n?q(n):q(t)}async function He(n){let t=new K,e=bt(()=>t.getSessionDir()),s=Rt(e),{resolveContentStorePath:r}=await Promise.resolve().then(()=>(V(),te)),o=r({projectDir:n,contentDir:s});return{store:new ct(o),dbPath:o,contentDir:s}}function js(n){try{if(Me(n).isDirectory())return`project:${Ue(n)||n}`}catch{}return n}function $s(n,t){let e=vt("Read",t);if(wt(n,e,process.platform==="win32",t).denied)throw new Error(`Read denied by policy: ${n}`)}async function Hs(n){try{let t=je(n),e=t.positional[0];if(!e||e==="-h"||e==="--help")return console.log("Usage: codex-context-mode index <path> [--source label] [--project path] [--max-files n] [--max-depth n] [--ext .ts,.md]"),e?0:1;let s=Us(e)?q(e):q(process.cwd(),e);if(!Ms(s))throw new Error(`Path does not exist: ${s}`);let r=Me(s),o=$e(v(t.flags,"project"),r.isDirectory()?s:Nt(s)),i=v(t.flags,"source")??js(s),{store:c,dbPath:u}=await He(o);try{if($s(s,o),r.isDirectory()){let a=vt("Read",o),l=c.indexDirectory({path:s,source:i,include:Pe(t.flags,"include"),exclude:Pe(t.flags,"exclude"),maxDepth:At(t.flags,"max-depth",{min:0}),maxFiles:At(t.flags,"max-files"),extensions:Fs(t.flags),respectGitignore:!Ie(t.flags,"no-gitignore"),followSymlinks:Ie(t.flags,"follow-symlinks"),perFileDeny:m=>{try{return wt(m,a,process.platform==="win32",o).denied}catch{return!1}}}),h=l.capped?` (cap reached at ${l.filesIndexed} files)`:"",d=l.denied>0?`; ${l.denied} denied`:"",p=l.failed>0?`; ${l.failed} failed`:"";console.log(`Indexed ${l.filesIndexed} files (${l.totalChunks} sections) from ${s}${h}${d}${p}`)}else{let a=c.index({path:s,source:i});console.log(`Indexed ${a.totalChunks} sections (${a.codeChunks} with code) from ${s}`)}return console.log(`Source: ${i}`),console.log(`Project: ${o}`),console.log(`DB: ${u}`),0}finally{c.close()}}catch(t){let e=t instanceof Error?t.message:String(t);return console.error(`codex-context-mode index: ${e}`),1}}async function Bs(n){try{let t=je(n),e=t.positional.join(" ").trim();if(!e||e==="-h"||e==="--help")return console.log("Usage: codex-context-mode search <query...> [--source label] [--project path] [--limit n] [--type code|prose]"),e?0:1;let s=$e(v(t.flags,"project"),process.cwd()),{store:r,dbPath:o}=await He(s);try{let i=At(t.flags,"limit")??3,c=v(t.flags,"type");if(c&&c!=="code"&&c!=="prose")throw new Error("--type must be code or prose");let u=r.searchWithFallback(e,i,v(t.flags,"source"),c);if(u.length===0)return console.log(`No matches for: ${e}`),console.log(`Project: ${s}`),console.log(`DB: ${o}`),0;for(let[a,l]of u.entries()){let h=l.content.replace(/\s+/g," ").trim(),d=h.length>500?`${h.slice(0,500)}...`:h;console.log(`## ${a+1}. ${l.title}`),console.log(`Source: ${l.source}`),console.log(`Type: ${l.contentType}`),console.log(d),console.log("")}return 0}finally{r.close()}}catch(t){let e=t instanceof Error?t.message:String(t);return console.error(`codex-context-mode search: ${e}`),1}}async function Ws(){let n=new K;console.log("codex-context-mode doctor"),console.log(ae(ie())),console.log("Codex CLI: "+(me()??"not found"));let t=n.validateHooks(Dt());for(let r of t)console.log("["+(r.status==="pass"?"OK":r.status.toUpperCase())+"] "+r.check+": "+r.message);let e=B(),s=new e(":memory:");try{s.exec("CREATE VIRTUAL TABLE probe USING fts5(value)"),console.log("[OK] SQLite FTS5")}finally{s.close()}return t.some(r=>r.status==="fail")?1:0}async function Xs(){let n=process.argv.slice(2);if(["--help","-h","help"].includes(n[0])){console.log("codex-context-mode [doctor | index <path> | search <query> | hook codex <kebab-case-event>]"),console.log("Install, enable, update and uninstall through Codex plugin management.");return}if(n[0]==="index"){process.exitCode=await Hs(n.slice(1));return}if(n[0]==="search"){process.exitCode=await Bs(n.slice(1));return}if(n[0]==="doctor"){process.exitCode=await Ws();return}if(n[0]==="hook"){if(n[1]!=="codex"||!Le[n[2]])throw new Error("Expected hook codex <kebab-case-event>");await import(Oe(Ae(Dt(),"hooks","codex",Le[n[2]]+".mjs")).href);return}if(n.length)throw new Error("Unknown command. Installation and lifecycle belong to Codex plugin management.");await import(Oe(Ae(Dt(),"start.mjs")).href)}process.argv[1]&&q(process.argv[1])===Fe(import.meta.url)&&Xs().catch(n=>{console.error(n instanceof Error?n.message:String(n)),process.exitCode=1});export{fo as toUnixPath};
