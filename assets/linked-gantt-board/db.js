/**
 * BACKGROUND: Replaces ad-hoc JSON/state files as the panel's only store. Jobs
 * hand off JSON files; this module imports them into SQLite, the single source
 * of truth for human edits (PUT) and job output (import). It also owns the S2
 * ACK command-loop table, the S4 backup/restore contract and the in-memory
 * READ-ONLY fallback used when SQLite is unavailable.
 * CONDITIONS: Node >= 22.5 (built-in node:sqlite, experimental); writable ./data;
 * DB file ./data/panel.db (never commit); SQLite backups in ./data/backups/.
 * Demo seed is isolated in ./data/demo-seed.json; GET /api/state advertises the
 * DEMO flag plus blocking-signal inputs (deps). All timestamps are local hour
 * strings YYYY-MM-DDTHH:00. Import returns {name, rows}; unknown name -> throw.
 * GRACEFUL DEGRADATION: if require('node:sqlite') fails, this module starts in
 * READ-ONLY demo mode serving seeded in-memory state (no disk writes). In that
 * mode state.degraded = true and state.degraded_reason carries the failure text;
 * write endpoints return a readOnly marker instead of persisting.
 * VERSION: 2.0.0 - English localization, isolated DEMO seed, DEMO/DEGRADED flags,
 * acks command loop (ACK/IN_PROGRESS/DONE/REJECTED), rejections.json PDCA entries,
 * /healthz + backup/restore inputs, deps for blocking signals.
 */
let DatabaseSync = null;
let DEGRADED = false;
let DEGRADED_REASON = '';
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {
  DEGRADED = true;
  DEGRADED_REASON = 'node:sqlite unavailable: ' + String((e && e.message) || e);
}

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const BACKUPS = path.join(DATA, 'backups');
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(BACKUPS, { recursive: true });

const DEMO_SEED = JSON.parse(fs.readFileSync(path.join(DATA, 'demo-seed.json'), 'utf8'));
const DEMO = DEMO_SEED.DEMO === true;

let db = null;
let MEM = null;

const p = (n) => String(n).padStart(2, '0');
function iso(d) {
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}
function at(deltaHours) {
  const base = new Date();
  base.setMinutes(0, 0, 0);
  return iso(new Date(base.getTime() + deltaHours * 3600000));
}
function dateOnly(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

if (!DEGRADED) {
  db = new DatabaseSync(path.join(DATA, 'panel.db'));
  db.exec('PRAGMA journal_mode=WAL;');
  db.exec(`
CREATE TABLE IF NOT EXISTS columns (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, color TEXT NOT NULL, sort INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, owner TEXT NOT NULL,
  owner_type TEXT NOT NULL, role TEXT NOT NULL, handoff TEXT NOT NULL,
  status TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0, placeholder INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'M', billed REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 0,
  parent_id TEXT NOT NULL DEFAULT '', baseline_start TEXT NOT NULL DEFAULT '',
  baseline_end TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS task_deps (
  from_id TEXT NOT NULL, to_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'FS',
  lag INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (from_id, to_id)
);
CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, outcome TEXT NOT NULL,
  start TEXT NOT NULL, end TEXT NOT NULL, ongoing INTEGER NOT NULL DEFAULT 0,
  req INTEGER NOT NULL DEFAULT 0, in_t INTEGER NOT NULL DEFAULT 0,
  out_t INTEGER NOT NULL DEFAULT 0, cache_r INTEGER NOT NULL DEFAULT 0,
  billed INTEGER NOT NULL DEFAULT 0, fresh INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY, source TEXT NOT NULL, title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '', reply TEXT NOT NULL DEFAULT '',
  enddate TEXT NOT NULL DEFAULT '', urgent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
);
CREATE TABLE IF NOT EXISTS notifications (
  ts TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info', read INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS jobs (
  job_name TEXT PRIMARY KEY, last_run TEXT NOT NULL, ok INTEGER NOT NULL DEFAULT 1,
  summary TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS acks (
  id TEXT PRIMARY KEY, snapshot_hash TEXT NOT NULL, command TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ACK', reject_reason TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL, updated TEXT NOT NULL
);
`);
  /* R20: a database created before the relationship layer lacks the new
     columns, and CREATE TABLE IF NOT EXISTS never adds them. Add them once. */
  const taskCols = db.prepare('PRAGMA table_info(tasks)').all().map((r) => r.name);
  [
    ['parent_id', "TEXT NOT NULL DEFAULT ''"],
    ['baseline_start', "TEXT NOT NULL DEFAULT ''"],
    ['baseline_end', "TEXT NOT NULL DEFAULT ''"],
  ].forEach((c) => {
    if (taskCols.indexOf(c[0]) < 0) db.exec('ALTER TABLE tasks ADD COLUMN ' + c[0] + ' ' + c[1]);
  });
  const depCols = db.prepare('PRAGMA table_info(task_deps)').all().map((r) => r.name);
  if (depCols.indexOf('lag') < 0) db.exec('ALTER TABLE task_deps ADD COLUMN lag INTEGER NOT NULL DEFAULT 0');
}

function seed() {
  const cols = DEMO_SEED.columns;
  const c = db.prepare('INSERT OR IGNORE INTO columns(id,label,color,sort) VALUES(?,?,?,?)');
  cols.forEach((r) => c.run(...r));

  if (db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n === 0) {
    const rows = DEMO_SEED.tasks;
    const ins = db.prepare(`INSERT INTO tasks
      (id,title,owner,owner_type,role,handoff,status,start,end,progress,placeholder,tier,billed,cost,sort)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    rows.forEach((r, i) => {
      const [id, title, owner, ot, role, handoff, status, s, e, prog, ph, tier, billed, cost] = r;
      ins.run(id, title, owner, ot, role, handoff, status, at(s), at(e), prog, ph, tier, billed * 1e6, cost, i);
    });
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM issues').get().n === 0) {
    const issues = DEMO_SEED.issues;
    const ins = db.prepare(`INSERT INTO issues(id,source,title,detail,reply,enddate,urgent,status)
      VALUES(?,?,?,?,?,?,?,?)`);
    issues.forEach((r) => {
      const [id, source, title, detail, reply, dayDelta, urgent, status] = r;
      ins.run(id, source, title, detail, reply, dateOnly(dayDelta), urgent, status);
    });
  }

  db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)').run('next_command', '');
}

function totalsFrom(rounds) {
  return {
    billed: rounds.reduce((a, r) => a + Number(r.billed || 0), 0),
    fresh: rounds.reduce((a, r) => a + Number(r.fresh || 0), 0),
    cost: rounds.reduce((a, r) => a + Number(r.cost || 0), 0),
    n: rounds.length,
  };
}

function importHandoff(name) {
  if (DEGRADED) return readOnly({ name, rows: 0 });
  const allowed = ['rounds', 'notifications', 'status', 'module-notes', 'module-deps'];
  if (!allowed.includes(name)) throw new Error('unknown handoff: ' + name);
  const file = path.join(DATA, name + '.json');
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);

  if (name === 'rounds') {
    const list = Array.isArray(data) ? data : (data.rounds || []);
    db.exec('DELETE FROM rounds');
    const ins = db.prepare(`INSERT INTO rounds
      (id,name,outcome,start,end,ongoing,req,in_t,out_t,cache_r,billed,fresh,cost)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    list.forEach((r) => ins.run(
      String(r.id), r.name || '', r.outcome || '', r.start || '', r.end || '',
      r.ongoing ? 1 : 0, Number(r.req || 0), Number(r.in || 0), Number(r.out || 0),
      Number(r.cacheR || 0), Number(r.billed || 0), Number(r.fresh || 0), Number(r.cost || 0),
    ));
    return { name, rows: list.length };
  }
  if (name === 'notifications') {
    const list = (Array.isArray(data) ? data : []).slice(0, 50);
    db.exec('DELETE FROM notifications');
    const ins = db.prepare('INSERT OR REPLACE INTO notifications(ts,title,body,level,read) VALUES(?,?,?,?,?)');
    list.forEach((n) => ins.run(String(n.ts), n.title || '', n.body || '', n.level || 'info', n.read ? 1 : 0));
    return { name, rows: list.length };
  }
  if (name === 'status') {
    const pairs = Object.entries(data || {});
    db.exec('DELETE FROM jobs');
    const ins = db.prepare('INSERT INTO jobs(job_name,last_run,ok,summary) VALUES(?,?,?,?)');
    pairs.forEach(([k, v]) => ins.run(k, String(v.last_run || ''), v.ok ? 1 : 0, String(v.summary || '')));
    return { name, rows: pairs.length };
  }
  const ins = db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)');
  ins.run('handoff_' + name, JSON.stringify(data));
  return { name, rows: Object.keys(data || {}).length };
}

function importAll() {
  if (DEGRADED) {
    return ['rounds', 'notifications', 'status', 'module-notes', 'module-deps']
      .map((name) => readOnly({ name, rows: 0 }));
  }
  return ['rounds', 'notifications', 'status', 'module-notes', 'module-deps'].map(importHandoff);
}

/** READ-ONLY demo mode marker returned by write endpoints when SQLite is unavailable. */
function readOnly(extra) {
  return Object.assign({ readOnly: true, degraded: true, reason: DEGRADED_REASON }, extra || {});
}

/** Build the seeded in-memory state used by READ-ONLY demo mode. */
function buildMemory() {
  const columns = DEMO_SEED.columns.map(([id, label, color, sort]) => ({ id, label, color, sort }));
  const tasks = DEMO_SEED.tasks.map((r, i) => {
    const [id, title, owner, ot, role, handoff, status, s, e, prog, ph, tier, billed, cost] = r;
    return {
      id, title, owner, owner_type: ot, role, handoff, status,
      start: at(s), end: at(e), progress: prog, placeholder: ph, tier,
      billed: billed * 1e6, cost, sort: i,
    };
  });
  const issues = DEMO_SEED.issues.map((r) => {
    const [id, source, title, detail, reply, dayDelta, urgent, status] = r;
    return { id, source, title, detail, reply, enddate: dateOnly(dayDelta), urgent, status };
  });
  const roundsJson = JSON.parse(fs.readFileSync(path.join(DATA, 'rounds.json'), 'utf8'));
  const rounds = (roundsJson.rounds || []).map((x) => ({
    id: String(x.id), name: x.name || '', outcome: x.outcome || '', start: x.start || '', end: x.end || '',
    ongoing: x.ongoing ? 1 : 0, req: Number(x.req || 0), in_t: Number(x.in || 0), out_t: Number(x.out || 0),
    cache_r: Number(x.cacheR || 0), billed: Number(x.billed || 0), fresh: Number(x.fresh || 0), cost: Number(x.cost || 0),
  }));
  const notifications = JSON.parse(fs.readFileSync(path.join(DATA, 'notifications.json'), 'utf8'))
    .map((n) => ({ ts: String(n.ts), title: n.title || '', body: n.body || '', level: n.level || 'info', read: n.read ? 1 : 0 }));
  const status = JSON.parse(fs.readFileSync(path.join(DATA, 'status.json'), 'utf8'));
  const jobs = Object.entries(status).map(([k, v]) => ({
    job_name: k, last_run: String(v.last_run || ''), ok: v.ok ? 1 : 0, summary: String(v.summary || ''),
  }));
  const deps = JSON.parse(fs.readFileSync(path.join(DATA, 'module-deps.json'), 'utf8'));
  return {
    tasks, columns, rounds, issues, notifications, jobs, acks: [], deps,
    meta: { next_command: '' }, totals: totalsFrom(rounds),
    demo: DEMO, DEMO, degraded: true, degraded_reason: DEGRADED_REASON, now: iso(new Date()),
  };
}

function readDeps() {
  if (DEGRADED) return MEM ? MEM.deps : { nodes: [], edges: [] };
  const r = db.prepare("SELECT value FROM meta WHERE key='handoff_module-deps'").get();
  return r ? JSON.parse(r.value) : { nodes: [], edges: [] };
}

function state() {
  if (DEGRADED) {
    const m = JSON.parse(JSON.stringify(MEM));
    m.now = iso(new Date());
    return m;
  }
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY sort').all();
  const columns = db.prepare('SELECT * FROM columns ORDER BY sort').all();
  const rounds = db.prepare('SELECT * FROM rounds ORDER BY id').all();
  const issues = db.prepare('SELECT * FROM issues ORDER BY id').all();
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY ts DESC LIMIT 50').all();
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY job_name').all();
  const acks = db.prepare('SELECT * FROM acks ORDER BY created DESC, id DESC').all();
  const meta = {};
  db.prepare('SELECT key,value FROM meta').all().forEach((r) => { if (!r.key.startsWith('handoff_')) meta[r.key] = r.value; });
  return {
    tasks, columns, rounds, issues, notifications, jobs, acks, deps: readDeps(),
    task_deps: listTaskDeps(), meta,
    totals: totalsFrom(rounds), demo: DEMO, DEMO, degraded: false, degraded_reason: '',
    /* R19 D4: the service reports where its data lives. A verifier that builds
       the path from its own location reads the wrong tree when the two are not
       co-located, which produced both false reds and false greens. */
    data_dir: DATA,
    now: iso(new Date()),
  };
}

function task(id) {
  if (DEGRADED) return MEM.tasks.filter((t) => t.id === id)[0];
  return db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
}

function updateTask(id, patch) {
  if (DEGRADED) return readOnly({ id, patch });
  const cur = task(id);
  if (!cur) throw new Error('task not found: ' + id);
  /* R20: a parent must exist and must not be the task itself, otherwise the
     tree holds a pointer to nothing or a one-node loop. */
  if (Object.prototype.hasOwnProperty.call(patch, 'parent_id') && patch.parent_id) {
    if (patch.parent_id === id) throw new Error('a task cannot be its own parent');
    if (!task(patch.parent_id)) throw new Error('parent not found: ' + patch.parent_id);
    /* R22: a parent that already sits under this task would close a loop in
       the tree. Walk the candidate's parent chain; if it meets this task,
       refuse. */
    if (parentReaches(patch.parent_id, id)) throw new Error('parent cycle: ' + patch.parent_id + ' is already under ' + id);
  }
  const fields = ['title', 'owner', 'owner_type', 'role', 'handoff', 'status', 'start', 'end', 'progress', 'placeholder', 'tier', 'billed', 'cost', 'sort', 'parent_id', 'baseline_start', 'baseline_end'];
  const sets = [];
  const vals = [];
  fields.forEach((f) => { if (Object.prototype.hasOwnProperty.call(patch, f)) { sets.push(f + '=?'); vals.push(patch[f]); } });
  if (!sets.length) return cur;
  vals.push(id);
  db.prepare(`UPDATE tasks SET ${sets.join(',')} WHERE id=?`).run(...vals);
  return task(id);
}

function createTask(input) {
  if (DEGRADED) return readOnly({ id: 'demo_readonly' });
  const id = 't_' + Math.random().toString(36).slice(2, 9);
  const sort = db.prepare('SELECT COALESCE(MAX(sort),0)+1 AS n FROM tasks').get().n;
  /* R22: a child must not point at a parent that does not exist. */
  if (input.parent_id && !task(input.parent_id)) throw new Error('parent not found: ' + input.parent_id);
  db.prepare(`INSERT INTO tasks(id,title,owner,owner_type,role,handoff,status,start,end,progress,placeholder,tier,billed,cost,sort,parent_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, input.title || 'New work unit', input.owner || 'Unassigned', input.owner_type || 'main',
    input.role || '', input.handoff || '', input.status || db.prepare('SELECT id FROM columns ORDER BY sort LIMIT 1').get().id,
    input.start || iso(new Date()), input.end || iso(new Date(Date.now() + 12 * 3600000)),
    Number(input.progress || 0), input.placeholder ? 1 : 0, input.tier || 'S',
    Number(input.billed || 0), Number(input.cost || 0), sort,
    input.parent_id || '',
  );
  return task(id);
}

/* ---- R20 task relationships: precedence edges and the baseline ---------- */

function listTaskDeps() {
  if (DEGRADED) return [];
  return db.prepare('SELECT from_id AS "from", to_id AS "to", type, lag FROM task_deps ORDER BY from_id, to_id').all();
}

function setTaskDep(from, to, type, lag) {
  if (DEGRADED) return readOnly({ from, to, type, lag });
  if (!from || !to || from === to) throw new Error('a dependency needs two different tasks');
  if (!task(from) || !task(to)) throw new Error('unknown task in dependency');
  const t = String(type || 'FS').toUpperCase();
  if (['FS', 'SS', 'FF', 'SF'].indexOf(t) < 0) throw new Error('unknown dependency type: ' + type);
  const lg = Math.round(Number(lag) || 0);
  /* R20: a dependency graph with a cycle has no topological order, so the
     critical path is undefined. Refuse the edge that would close one. */
  if (reaches(to, from)) throw new Error('cyclic dependency: ' + to + ' already reaches ' + from);
  db.prepare('INSERT OR REPLACE INTO task_deps(from_id,to_id,type,lag) VALUES(?,?,?,?)').run(from, to, t, lg);
  return { from, to, type: t, lag: lg };
}

/**
 * R22: true when `ancestorId` appears on `id`'s parent chain. A stored loop
 * counts as a reach, so corrupt data cannot talk the guard into a yes.
 */
function parentReaches(id, ancestorId) {
  const seen = {};
  let cur = task(id);
  while (cur && cur.parent_id) {
    if (cur.parent_id === ancestorId) return true;
    if (seen[cur.parent_id]) return true;
    seen[cur.parent_id] = true;
    cur = task(cur.parent_id);
  }
  return false;
}

/** True when `target` is reachable from `start` along existing edges. */
function reaches(start, target) {
  const rows = db.prepare('SELECT from_id, to_id FROM task_deps').all();
  const map = {};
  rows.forEach((r) => { (map[r.from_id] = map[r.from_id] || []).push(r.to_id); });
  const seen = {};
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === target) return true;
    if (seen[cur]) continue;
    seen[cur] = true;
    (map[cur] || []).forEach((n) => stack.push(n));
  }
  return false;
}

function deleteTaskDep(from, to) {
  if (DEGRADED) return readOnly({ from, to });
  db.prepare('DELETE FROM task_deps WHERE from_id=? AND to_id=?').run(from, to);
  return { from, to };
}

/**
 * Freeze the current window as the baseline for every scheduled task.
 * Idempotent: running it again simply overwrites with the newer plan.
 */
function snapshotBaseline() {
  if (DEGRADED) return readOnly({ ok: false, error: 'read-only demo mode' });
  const res = db.prepare(
    "UPDATE tasks SET baseline_start=start, baseline_end=end WHERE placeholder=0 AND start<>'' AND end<>''",
  ).run();
  return { ok: true, snapshotted: res.changes };
}

function deleteTask(id) {
  if (DEGRADED) return readOnly({ id });
  /* R20: a deleted task must not leave dangling edges or orphaned children.
     Children are lifted to root rather than deleted - deleting a parent must
     not silently destroy the work beneath it. */
  db.prepare('DELETE FROM task_deps WHERE from_id=? OR to_id=?').run(id, id);
  db.prepare("UPDATE tasks SET parent_id='' WHERE parent_id=?").run(id);
  db.prepare('DELETE FROM tasks WHERE id=?').run(id);
  return { id };
}

function createColumn(input) {
  if (DEGRADED) return readOnly({ id: 'demo_readonly' });
  const id = 'c_' + Math.random().toString(36).slice(2, 8);
  const sort = db.prepare('SELECT COALESCE(MAX(sort),0)+1 AS n FROM columns').get().n;
  db.prepare('INSERT INTO columns(id,label,color,sort) VALUES(?,?,?,?)').run(id, input.label || 'New status', input.color || '#8e8e93', sort);
  return db.prepare('SELECT * FROM columns WHERE id=?').get(id);
}

function updateColumn(id, patch) {
  if (DEGRADED) return readOnly({ id });
  const cur = db.prepare('SELECT * FROM columns WHERE id=?').get(id);
  if (!cur) throw new Error('column not found');
  db.prepare('UPDATE columns SET label=?, color=? WHERE id=?').run(patch.label ?? cur.label, patch.color ?? cur.color, id);
  return db.prepare('SELECT * FROM columns WHERE id=?').get(id);
}

function deleteColumn(id) {
  if (DEGRADED) return readOnly({ id });
  const all = db.prepare('SELECT * FROM columns ORDER BY sort').all();
  if (all.length <= 1) throw new Error('at least one column required');
  const fallback = all.filter((c) => c.id !== id)[0];
  db.prepare('UPDATE tasks SET status=? WHERE status=?').run(fallback.id, id);
  db.prepare('DELETE FROM columns WHERE id=?').run(id);
  return { id, fallback: fallback.id, moved: db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE status=?').get(fallback.id).n };
}

function moveColumn(id, dir) {
  if (DEGRADED) return readOnly({ columns: MEM.columns });
  const all = db.prepare('SELECT * FROM columns ORDER BY sort').all();
  const i = all.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return all;
  const [c] = all.splice(i, 1);
  all.splice(j, 0, c);
  const up = db.prepare('UPDATE columns SET sort=? WHERE id=?');
  all.forEach((x, k) => up.run(k, x.id));
  return db.prepare('SELECT * FROM columns ORDER BY sort').all();
}

function updateIssue(id, patch) {
  if (DEGRADED) return readOnly({ id });
  const cur = db.prepare('SELECT * FROM issues WHERE id=?').get(id);
  if (!cur) throw new Error('issue not found');
  db.prepare('UPDATE issues SET reply=?,enddate=?,urgent=?,status=? WHERE id=?').run(
    patch.reply ?? cur.reply, patch.enddate ?? cur.enddate,
    patch.urgent === undefined ? cur.urgent : (patch.urgent ? 1 : 0),
    patch.status ?? cur.status, id,
  );
  return db.prepare('SELECT * FROM issues WHERE id=?').get(id);
}

function setCommand(text) {
  if (DEGRADED) return readOnly({ next_command: String(text || '') });
  db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run('next_command', String(text || ''));
  return { next_command: String(text || '') };
}

/* ---- Project charter: first-principles framing shown on every view ------ */
const CHARTER_KEYS = ['project_purpose', 'project_resources', 'project_evaluation'];

/**
 * Write charter fields. Only the three charter keys are accepted, so this door
 * cannot be used to overwrite the next command, the handoff imports, or the ACK
 * loop. Values are project text and may hold any language: the package CJK gate
 * covers files on disk, not this runtime table.
 */
function setCharter(patch) {
  const out = {};
  CHARTER_KEYS.forEach((k) => {
    if (!patch || patch[k] === undefined) return;
    out[k] = String(patch[k] || '');
  });
  if (DEGRADED) return readOnly(out);
  CHARTER_KEYS.forEach((k) => {
    if (out[k] === undefined) return;
    db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(k, out[k]);
  });
  return out;
}

/* ---- S2 ACK command loop ------------------------------------------------ */

/** Append a PDCA-style rejection entry to data/rejections.json. docs/evidence is
 *  owned by another subagent, so the reason is emitted here and in the ACK row. */
function writeRejection(row) {
  const file = path.join(DATA, 'rejections.json');
  let arr = [];
  try { arr = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  arr.push({
    id: row.id, ts: iso(new Date()), snapshot_hash: row.snapshot_hash, command: row.command,
    reason: row.reject_reason,
    pdca: {
      plan: 'Reject the command ACK',
      do: 'Record reason in ACK row and rejections.json',
      check: 'ACK.state=REJECTED',
      act: 'Human re-issues a corrected command',
    },
  });
  fs.writeFileSync(file, JSON.stringify(arr, null, 2) + '\n', 'utf8');
}

function listAcks() {
  if (DEGRADED) return MEM.acks.slice();
  return db.prepare('SELECT * FROM acks ORDER BY created DESC, id DESC').all();
}

function createAck(input) {
  if (DEGRADED) return readOnly({ id: 'demo_readonly', state: 'ACK' });
  const id = 'ack_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const now = iso(new Date());
  const hash = String(input.snapshot_hash || '');
  const command = String(input.command || '');
  db.prepare('INSERT INTO acks(id,snapshot_hash,command,state,reject_reason,created,updated) VALUES(?,?,?,?,?,?,?)')
    .run(id, hash, command, 'ACK', '', now, now);
  return db.prepare('SELECT * FROM acks WHERE id=?').get(id);
}

function updateAck(id, patch) {
  if (DEGRADED) return readOnly({ id });
  const cur = db.prepare('SELECT * FROM acks WHERE id=?').get(id);
  if (!cur) throw new Error('ack not found: ' + id);
  const action = String(patch.action || '');
  let nextState = cur.state;
  let reason = cur.reject_reason;
  if (action === 'approve') {
    nextState = 'IN_PROGRESS';
  } else if (action === 'done') {
    nextState = 'DONE';
  } else if (action === 'reject') {
    const r = patch.reason === undefined ? patch.reject_reason : patch.reason;
    if (!r || !String(r).trim()) throw new Error('reject requires a reason');
    nextState = 'REJECTED';
    reason = String(r).trim();
  } else {
    throw new Error('unknown ack action: ' + action);
  }
  const now = iso(new Date());
  db.prepare('UPDATE acks SET state=?, reject_reason=?, updated=? WHERE id=?').run(nextState, reason, now, id);
  const row = db.prepare('SELECT * FROM acks WHERE id=?').get(id);
  if (action === 'reject') writeRejection(row);
  return row;
}

/* ---- S4 backup / restore ------------------------------------------------ */

function backup() {
  if (DEGRADED) return readOnly({ ok: false, error: 'read-only demo mode: backup unavailable' });
  fs.mkdirSync(BACKUPS, { recursive: true });
  const name = 'panel-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.db';
  const file = path.join(BACKUPS, name);
  const sqlFile = file.replace(/\\/g, '/').replace(/'/g, "''");
  db.exec("VACUUM INTO '" + sqlFile + "'");
  /* R19 D4: report where the artifact really is. A caller that rebuilds the
     path from its own directory gets a false red on existence and a false
     green on cleanup when the server writes somewhere else. */
  return { ok: true, file: name, dir: 'data/backups', path: file, data_dir: DATA, bytes: fs.statSync(file).size };
}

function restore(name) {
  if (DEGRADED) return readOnly({ ok: false, error: 'read-only demo mode: restore unavailable' });
  if (!/^[A-Za-z0-9_.-]+\.db$/.test(name)) throw new Error('invalid backup name');
  const src = path.join(BACKUPS, name);
  if (!fs.existsSync(src)) throw new Error('backup not found: ' + name);
  const target = path.join(DATA, 'panel.db');
  db.close();
  for (const suf of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(target + suf); } catch (_e) { /* absent */ }
  }
  fs.copyFileSync(src, target);
  db = new DatabaseSync(target);
  db.exec('PRAGMA journal_mode=WAL;');
  return { ok: true, restored: name };
}

function snapshot() {
  const s = state();
  const open = s.issues.filter((x) => x.status !== 'done');
  const done = s.issues.filter((x) => x.status === 'done');
  const today = dateOnly(0);
  const soon = dateOnly(2);
  const overdue = open.filter((x) => x.enddate && x.enddate < today);
  const urgent = open.filter((x) => x.urgent);
  const replies = open.filter((x) => x.reply.trim()).map((x) => `${x.id}=${x.reply.trim().slice(0, 30)}`);
  const last = s.rounds[s.rounds.length - 1];
  const stamp = iso(new Date()).replace('T', ' ');
  const billedM = (s.totals.billed / 1e6).toFixed(1) + 'M';
  const lines = [
    `[project snapshot ${stamp}]`,
    `Next command: ${s.meta.next_command || '(empty)'}`,
    `Todos ${s.tasks.filter((t) => t.status === 'done').length}/${s.tasks.length} | overdue: ${overdue.length ? overdue.map((x) => x.id).join(',') : 'none'}`,
    `Issues open ${open.length}/${s.issues.length} | overdue ${overdue.length} | urgent ${urgent.length} | due<=48h ${open.filter((x) => x.enddate && x.enddate <= soon && x.enddate >= today).length} | done ${done.length}`,
    `Replies filled: ${replies.length ? replies.join('; ') : 'none'}`,
    `Total spend (measured): billed ${billedM} tokens / $${Number(s.totals.cost).toFixed(2)} (meter, read-only)`,
    `Latest round: ${last ? `${last.id} ${last.name} [${last.start} -> ${last.end}]` : 'none'}`,
  ];
  return { text: lines.join('\n') };
}

function degradedInfo() {
  return { degraded: DEGRADED, reason: DEGRADED_REASON, demo: DEMO };
}

if (!DEGRADED) {
  seed();
  importAll();
} else {
  MEM = buildMemory();
}

module.exports = {
  db, state, task, updateTask, createTask, deleteTask,
  createColumn, updateColumn, deleteColumn, moveColumn,
  updateIssue, setCommand, setCharter, snapshot, importHandoff, importAll,
  createAck, listAcks, updateAck, backup, restore, degradedInfo,
  listTaskDeps, setTaskDep, deleteTaskDep, snapshotBaseline,
  DEMO, DEGRADED, DEGRADED_REASON,
};
