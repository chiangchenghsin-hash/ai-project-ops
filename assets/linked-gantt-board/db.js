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
 * VERSION: 2.6.0 - I-038 R32: planSync-class node CRUD behind the same
 * PUT /api/plan/structure door - create-milestone | create-work-unit |
 * update-node | delete-node. One atomic commit spans milestone-plan.json +
 * docs/evidence/milestones.json (membership + status) + docs/PRD.md (Status
 * lines; a new/deleted milestone's block rides the same commit because
 * prd-to-action gate C and plan-sync's PRD shape check both count blocks) +
 * the SQLite task rows: files land through tmp+rename with full restore of
 * every earlier rename, SQLite runs inside one transaction, and a failed
 * store rolls back all four. Validation first (plan-sync W status/progress
 * rules, PRD gate X's "0 or >= 2 work units per milestone" floor, empty-goal
 * and last-goal refusals) so a rejected op is a 400 with zero writes; fresh
 * M/W ids continue the M8+/W19+ series through the shared makeFreshIds
 * factory (collision-checked); create-work-unit on an empty milestone ships
 * the pair gate X requires. 2.5.0 - I-033: additive tasks.model (TEXT) + tasks.confidence
 * (REAL, nullable) columns with the lag/nature add-once migration; a one-time
 * migration backfill fills ONLY those new columns for pre-existing rows
 * (owner_type human -> model 'human', AI owners -> the model constant;
 * confidence 0.95/0.9/0.8/0.75 by owner type) so every OLD field and row
 * stays byte-identical; seed() writes the same new-column values for a fresh
 * demo DB; updateTask/createTask accept model/confidence (confidence
 * validated 0..1); GET /api/tasks/:id/audit (taskAudit) returns the desk
 * events naming the task plus the TASK-LOG entry ids naming it (same
 * mentionsNode derivation as enrichIssues/buildAnalysis).
 * 2.4.1 - I-031 R30 line 2 resolution: every accepted MOVE re-syncs
 * the gate-X-pinned docs/evidence/milestones.json sub_lines membership it
 * changes, atomically with milestone-plan.json (dual tmp + rename, rollback
 * to zero divergence on mid-way failure); M moves and W same-parent reorders
 * compute an empty delta and write the plan only; template apply stays
 * plan-only (new ids still await PRD adoption). 2.4.0 - I-031:
 * planStructureUpdate (move | apply-template) is the single validated, atomic
 * write path for data/milestone-plan.json behind PUT
 * /api/plan/structure; validatePlanStructure mirrors the plan-internal half of
 * the prd-to-action gate (goal coverage, sub_lines two-way membership,
 * topological main_line, acyclic relations, id stability) and throws before
 * any byte reaches disk so a failed op is 400 with zero writes; the additive
 * wbs_templates table + listTemplates/saveTemplate back /api/templates (six
 * built-in skeletons seeded at boot with the exact provenance line, subtree
 * save, apply instantiating fresh M/W ids with placeholder todo/0).
 * 2.3.0 - I-028/I-030: /api/state issues rows carry opened/updated
 * (new columns, backfilled by the issue.js mirror) plus a derived `evidence`
 * list of docs/TASK-LOG.md entry ids naming the issue id as a whole token
 * (same derivation as analysis.rounds; unreadable ledger -> []); task_deps
 * gains the frozen `nature` vocabulary ('' | mandatory | discretionary |
 * external) through setTaskDep/listTaskDep. 2.2.0 - I-020: /api/plan (readPlan)
 * carries `goals` from milestone-plan.json plus an `analysis` block keyed by
 * every milestone id and work-unit id (status, progress, cost, rounds, rework)
 * derived deterministically from the plan file and docs/TASK-LOG.md;
 * `analysis_note` records a ledger read failure instead of throwing.
 * 2.1.0 - desk_events log + /api/events (queryable history for the desk sheets)
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

/* I-033 card AI dimensions: the ONE model label every AI owner shows on its
 * card (a human owner shows 'human'), and the confidence band per owner type
 * (0.75..0.95). Pinned by selftest section 32; only the NEW columns ever
 * receive these values - no OLD column is touched. */
const MODEL_AI = 'claude';
const MODEL_BY_TYPE = { human: 'human', main: MODEL_AI, subagent: MODEL_AI, team: MODEL_AI };
const CONF_BY_TYPE = { human: 0.95, main: 0.9, subagent: 0.8, team: 0.75 };
function modelForType(ownerType) {
  return MODEL_BY_TYPE[ownerType] || MODEL_AI;
}
function confForType(ownerType) {
  return Object.prototype.hasOwnProperty.call(CONF_BY_TYPE, ownerType) ? CONF_BY_TYPE[ownerType] : 0.75;
}

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
  baseline_end TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '', confidence REAL
);
CREATE TABLE IF NOT EXISTS task_deps (
  from_id TEXT NOT NULL, to_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'FS',
  lag INTEGER NOT NULL DEFAULT 0, nature TEXT NOT NULL DEFAULT '',
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
  status TEXT NOT NULL DEFAULT 'open',
  opened TEXT NOT NULL DEFAULT '', updated TEXT NOT NULL DEFAULT ''
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
CREATE TABLE IF NOT EXISTS approval_actions (
  id TEXT PRIMARY KEY, action TEXT NOT NULL, actor TEXT NOT NULL,
  gate TEXT NOT NULL, requires_reason INTEGER NOT NULL DEFAULT 0,
  endpoint TEXT NOT NULL DEFAULT '', enforced INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS owner_scopes (
  owner_type TEXT PRIMARY KEY, may_act_alone TEXT NOT NULL,
  needs_ack TEXT NOT NULL, never_automatic TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS desk_events (
  id TEXT PRIMARY KEY, ts TEXT NOT NULL, unit TEXT NOT NULL,
  kind TEXT NOT NULL, detail TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_desk_events_unit_ts ON desk_events(unit, ts);
CREATE TABLE IF NOT EXISTS wbs_templates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, provenance TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'saved', payload TEXT NOT NULL, created TEXT NOT NULL
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
  /* I-033: the two AI-dimension columns, same add-once pattern as lag above.
     confidence stays nullable (REAL, no DEFAULT) so "unset" is a real NULL the
     card renders as a dash. */
  const hadModel = taskCols.indexOf('model') >= 0;
  const hadConf = taskCols.indexOf('confidence') >= 0;
  if (!hadModel) db.exec("ALTER TABLE tasks ADD COLUMN model TEXT NOT NULL DEFAULT ''");
  if (!hadConf) db.exec('ALTER TABLE tasks ADD COLUMN confidence REAL');
  if (!hadModel || !hadConf) {
    /* One-time migration backfill: fills ONLY the new columns on rows that
       predate them. Every OLD column value and row is left byte-identical;
       rows created later keep their own (possibly NULL) values. */
    db.prepare(`UPDATE tasks SET model = CASE owner_type WHEN 'human' THEN 'human' ELSE ? END
      WHERE model = ''`).run(MODEL_AI);
    db.prepare(`UPDATE tasks SET confidence = CASE owner_type
      WHEN 'human' THEN 0.95 WHEN 'main' THEN 0.9
      WHEN 'subagent' THEN 0.8 WHEN 'team' THEN 0.75 ELSE 0.75 END
      WHERE confidence IS NULL`).run();
  }
  const depCols = db.prepare('PRAGMA table_info(task_deps)').all().map((r) => r.name);
  if (depCols.indexOf('lag') < 0) db.exec('ALTER TABLE task_deps ADD COLUMN lag INTEGER NOT NULL DEFAULT 0');
  /* I-030: relationship nature; vocab frozen to the three lowercase words
     plus '' (unspecified). Same add-once pattern as lag above. */
  if (depCols.indexOf('nature') < 0) db.exec("ALTER TABLE task_deps ADD COLUMN nature TEXT NOT NULL DEFAULT ''");
  /* I-028: ledger timestamps on the rows the panel renders. */
  const issueCols = db.prepare('PRAGMA table_info(issues)').all().map((r) => r.name);
  if (issueCols.indexOf('opened') < 0) db.exec("ALTER TABLE issues ADD COLUMN opened TEXT NOT NULL DEFAULT ''");
  if (issueCols.indexOf('updated') < 0) db.exec("ALTER TABLE issues ADD COLUMN updated TEXT NOT NULL DEFAULT ''");
}

function seed() {
  const cols = DEMO_SEED.columns;
  const c = db.prepare('INSERT OR IGNORE INTO columns(id,label,color,sort) VALUES(?,?,?,?)');
  cols.forEach((r) => c.run(...r));

  if (db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n === 0) {
    const rows = DEMO_SEED.tasks;
    const ins = db.prepare(`INSERT INTO tasks
      (id,title,owner,owner_type,role,handoff,status,start,end,progress,placeholder,tier,billed,cost,sort,model,confidence)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    rows.forEach((r, i) => {
      const [id, title, owner, ot, role, handoff, status, s, e, prog, ph, tier, billed, cost] = r;
      ins.run(id, title, owner, ot, role, handoff, status, at(s), at(e), prog, ph, tier, billed * 1e6, cost, i,
        modelForType(ot), confForType(ot));
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

/* ---- C9 B1/B6: policy reference tables ---------------------------------
 * These are read-only reference tables seeded from the two JSON masters in
 * ./data. They are static: no PUT endpoint writes to them, so re-seeding from
 * the JSON on every boot keeps SQLite (the runtime source of truth) exactly in
 * sync with the versioned spec. The approval matrix rows carry the columns the
 * SPEC defines: id, action, actor, gate, requires_reason, endpoint, enforced.
 * ------------------------------------------------------------------------ */
function seedPolicy() {
  const matrix = JSON.parse(fs.readFileSync(path.join(DATA, 'approval-matrix.json'), 'utf8'));
  const scopes = JSON.parse(fs.readFileSync(path.join(DATA, 'owner-scope.json'), 'utf8'));
  db.exec('DELETE FROM approval_actions');
  const insAction = db.prepare(`INSERT INTO approval_actions
    (id,action,actor,gate,requires_reason,endpoint,enforced) VALUES(?,?,?,?,?,?,?)`);
  (matrix.actions || []).forEach((r) => insAction.run(
    String(r.id), String(r.action || ''), String(r.actor || ''), String(r.gate || ''),
    Number(r.requires_reason) ? 1 : 0, String(r.endpoint || ''), Number(r.enforced) ? 1 : 0,
  ));
  db.exec('DELETE FROM owner_scopes');
  const insScope = db.prepare(`INSERT INTO owner_scopes
    (owner_type,may_act_alone,needs_ack,never_automatic) VALUES(?,?,?,?)`);
  (scopes.owner_scopes || []).forEach((r) => insScope.run(
    String(r.owner_type), String(r.may_act_alone || ''),
    String(r.needs_ack || ''), String(r.never_automatic || ''),
  ));
}

/** All per-action approval rows (B1). SELECT-list fixes the response shape. */
function listApprovals() {
  if (DEGRADED) return [];
  return db.prepare(`SELECT id, action, actor, gate, requires_reason, endpoint, enforced
    FROM approval_actions ORDER BY id`).all();
}

/** Exactly four owner scopes (B6): human | main | subagent | team. */
function listOwnerScopes() {
  if (DEGRADED) return [];
  return db.prepare(`SELECT owner_type, may_act_alone, needs_ack, never_automatic
    FROM owner_scopes ORDER BY owner_type`).all();
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
    /* I-019 desk log: the status import feeds the jobs table, so it is the one
       handoff that gets history rows - one job/import event per job row. */
    pairs.forEach(([k, v]) => logDeskEvent('job', 'import',
      k + ' ok=' + (v.ok ? 1 : 0) + ' ' + String(v.summary || '')));
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
      /* I-033: degraded rows carry the same new-column values the SQLite
         migration backfills, so the card renders identically in both modes. */
      model: modelForType(ot), confidence: confForType(ot),
    };
  });
  const issues = DEMO_SEED.issues.map((r) => {
    const [id, source, title, detail, reply, dayDelta, urgent, status] = r;
    return { id, source, title, detail, reply, enddate: dateOnly(dayDelta), urgent, status,
      opened: '', updated: '', evidence: [] };
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
    const ps = effectiveMeta(m.meta);
    m.plan_state = ps.state; m.plan_fix_command = ps.fix_command;
    m.now = iso(new Date());
    return m;
  }
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY sort').all();
  const columns = db.prepare('SELECT * FROM columns ORDER BY sort').all();
  const rounds = db.prepare('SELECT * FROM rounds ORDER BY id').all();
  const issues = enrichIssues(db.prepare('SELECT * FROM issues ORDER BY id').all());
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY ts DESC LIMIT 50').all();
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY job_name').all();
  const acks = db.prepare('SELECT * FROM acks ORDER BY created DESC, id DESC').all();
  const meta = {};
  db.prepare('SELECT key,value FROM meta').all().forEach((r) => { if (!r.key.startsWith('handoff_')) meta[r.key] = r.value; });
  const ps = effectiveMeta(meta);
  return {
    tasks, columns, rounds, issues, notifications, jobs, acks, deps: readDeps(),
    task_deps: listTaskDeps(), meta,
    plan_state: ps.state, plan_fix_command: ps.fix_command,
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
  const fields = ['title', 'owner', 'owner_type', 'role', 'handoff', 'status', 'start', 'end', 'progress', 'placeholder', 'tier', 'billed', 'cost', 'sort', 'parent_id', 'baseline_start', 'baseline_end', 'model'];
  /* I-033: confidence is a 0..1 real or an explicit clear-to-NULL. */
  if (Object.prototype.hasOwnProperty.call(patch, 'confidence')) {
    const c = patch.confidence;
    if (c !== null && c !== undefined && c !== '') {
      const n = Number(c);
      if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error('confidence must be a number in 0..1');
    }
  }
  const sets = [];
  const vals = [];
  fields.forEach((f) => { if (Object.prototype.hasOwnProperty.call(patch, f)) { sets.push(f + '=?'); vals.push(patch[f]); } });
  if (Object.prototype.hasOwnProperty.call(patch, 'confidence')) {
    const c = patch.confidence;
    sets.push('confidence=?');
    vals.push(c === null || c === undefined || c === '' ? null : Number(c));
  }
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
  /* I-033: model (TEXT) and confidence (0..1 real, nullable) ride the same
     INSERT. Omitted values keep the column defaults ('' / NULL = dash). */
  let conf = null;
  if (input.confidence !== undefined && input.confidence !== null && input.confidence !== '') {
    conf = Number(input.confidence);
    if (!Number.isFinite(conf) || conf < 0 || conf > 1) throw new Error('confidence must be a number in 0..1');
  }
  db.prepare(`INSERT INTO tasks(id,title,owner,owner_type,role,handoff,status,start,end,progress,placeholder,tier,billed,cost,sort,parent_id,model,confidence)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, input.title || 'New work unit', input.owner || 'Unassigned', input.owner_type || 'main',
    input.role || '', input.handoff || '', input.status || db.prepare('SELECT id FROM columns ORDER BY sort LIMIT 1').get().id,
    input.start || iso(new Date()), input.end || iso(new Date(Date.now() + 12 * 3600000)),
    Number(input.progress || 0), input.placeholder ? 1 : 0, input.tier || 'S',
    Number(input.billed || 0), Number(input.cost || 0), sort,
    input.parent_id || '',
    input.model === undefined || input.model === null ? '' : String(input.model),
    conf,
  );
  return task(id);
}

/* ---- R20 task relationships: precedence edges and the baseline ---------- */

function listTaskDeps() {
  if (DEGRADED) return [];
  return db.prepare('SELECT from_id AS "from", to_id AS "to", type, lag, nature FROM task_deps ORDER BY from_id, to_id').all();
}

/** I-030: frozen nature vocabulary. '' = unspecified; no other string. */
const DEP_NATURES = ['', 'mandatory', 'discretionary', 'external'];

function setTaskDep(from, to, type, lag, nature) {
  if (DEGRADED) return readOnly({ from, to, type, lag, nature: nature === undefined || nature === null ? '' : String(nature) });
  if (!from || !to || from === to) throw new Error('a dependency needs two different tasks');
  if (!task(from) || !task(to)) throw new Error('unknown task in dependency');
  const t = String(type || 'FS').toUpperCase();
  if (['FS', 'SS', 'FF', 'SF'].indexOf(t) < 0) throw new Error('unknown dependency type: ' + type);
  const lg = Math.round(Number(lag) || 0);
  /* I-030: vocab frozen - exactly these three lowercase words, '' = unspecified. */
  const nat = nature === undefined || nature === null ? '' : String(nature);
  if (DEP_NATURES.indexOf(nat) < 0) {
    throw new Error('unknown dependency nature: ' + nat +
      " (allowed: '', mandatory, discretionary, external)");
  }
  /* R20: a dependency graph with a cycle has no topological order, so the
     critical path is undefined. Refuse the edge that would close one. */
  if (reaches(to, from)) throw new Error('cyclic dependency: ' + to + ' already reaches ' + from);
  db.prepare('INSERT OR REPLACE INTO task_deps(from_id,to_id,type,lag,nature) VALUES(?,?,?,?,?)').run(from, to, t, lg, nat);
  return { from, to, type: t, lag: lg, nature: nat };
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

/**
 * I-028a: the scripts/issue.js mirror target. INSERTs a missing row and
 * refreshes an existing one (upsert), so every CLI add/update/close lands in
 * panel.db instead of failing with "issue not found". Fields the caller omits
 * keep their stored value, or the column default on first insert. updateIssue
 * stays strict for the panel PUT path; its existing callers are unchanged.
 */
function upsertIssue(row) {
  if (DEGRADED) return readOnly({ id: row && row.id });
  const r = row || {};
  const id = String(r.id || '');
  if (!id) throw new Error('issue id required');
  const cur = db.prepare('SELECT * FROM issues WHERE id=?').get(id);
  const pick = (k, dflt) => (r[k] !== undefined && r[k] !== null ? r[k] : (cur ? cur[k] : dflt));
  const rec = [
    String(pick('source', 'ai-session')),
    String(pick('title', '')),
    String(pick('detail', '')),
    String(pick('reply', '')),
    String(pick('enddate', '')),
    pick('urgent', 0) ? 1 : 0,
    String(pick('status', 'open')),
    String(pick('opened', '')),
    String(pick('updated', '')),
  ];
  db.prepare(`INSERT OR REPLACE INTO issues
    (id,source,title,detail,reply,enddate,urgent,status,opened,updated)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id, ...rec);
  return db.prepare('SELECT * FROM issues WHERE id=?').get(id);
}

function setCommand(text) {
  const next = String(text || '');
  if (DEGRADED) return readOnly({ next_command: next });
  const cur = db.prepare("SELECT value FROM meta WHERE key='next_command'").get();
  db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run('next_command', next);
  /* I-019 desk log: only a real change of meta.next_command is history, so a
     double-save of the same text logs exactly one command/save event. */
  if (!cur || cur.value !== next) logDeskEvent('command', 'save', next.slice(0, 120));
  return { next_command: next };
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

/* ---- Milestone plan (PRD -> action ingest, invariant I9) ---------------
 * The plan file is owned by the PRD-ingest step, not by this service. When it
 * is absent we advertise an explicit PRD_NOT_INGESTED state with the exact fix
 * command, so the panel never shows a silent blank milestone area. The same
 * read seeds the project charter through /api/state, so every charter value on
 * screen originates from the plan (or from an explicit human edit), never from
 * hardcoded HTML. Values are ASCII-normalised: this is an English release.
 * ------------------------------------------------------------------------ */
const PLAN_FILE = path.join(DATA, 'milestone-plan.json');
/* I-031 move re-sync: prd-to-action gate X pins plan.sub_lines to this
   evidence file with exact JSON equality. The structure write path is
   authorized to re-sync ONLY the sub_lines membership a move changes here;
   docs/PRD.md and every other docs/ file stay untouched. */
const MILESTONES_FILE = path.join(__dirname, '..', '..', 'docs', 'evidence', 'milestones.json');
/* I-038 node CRUD: docs/PRD.md carries one Status line per milestone block.
   The structure write path is authorized to rewrite those Status lines, and
   (gate C / plan-sync shape forced) to add or remove the whole block of a
   milestone this same commit creates or deletes. No other docs file is ever
   touched. */
const PRD_FILE = path.join(__dirname, '..', '..', 'docs', 'PRD.md');
/* Plan-sync vocabulary: the one status set plan-sync.js and prd-to-action.js
   both accept for milestones and work units. */
const PLAN_STATUSES = ['pending', 'in_progress', 'done', 'skipped'];
const PLAN_FIX = 'node scripts/prd-to-action.js';
const PLAN_EMPTY_LABEL = 'PRD not ingested';
const PLAN_EMPTY_DETAIL = 'The milestone plan has no main line, sub-lines or relations because data/milestone-plan.json is missing.';
const PLAN_EMPTY_TEXT = PLAN_EMPTY_LABEL + ' - run: ' + PLAN_FIX;

function cleanText(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/g, '');
}
function isCharterPlaceholder(v) {
  return !v || /^\s*(not set\.?|purpose not set\.?|demo charter[\s\S]*)$/i.test(v);
}

/* ---- I-020 goal layer + analysis block ----------------------------------
 * GET /api/plan derives one analysis row per milestone id and work-unit id:
 * status and progress come from the plan file (a milestone averages its
 * sub-line progress), cost is the W cost field or the sum of the sub-line
 * costs, and rounds/rework come from docs/TASK-LOG.md - a round is a PDCA
 * entry whose text names the node as a whole token, rework counts those round
 * entries that contain the marker "rework-of" (R28 lock: rework-of entries
 * touching it). Deterministic derivation only,
 * no manual map. When the ledger cannot be read, the rows keep empty rounds
 * and analysis_note records why; this path never throws.
 * ------------------------------------------------------------------------ */
const TASK_LOG = path.join(__dirname, '..', '..', 'docs', 'TASK-LOG.md');
const LOG_FAIL = 'docs/TASK-LOG.md unreadable; rounds and rework are empty';

/** Parse docs/TASK-LOG.md into [{id, text}] PDCA entries in file order. */
function readPdcaEntries() {
  let raw;
  try { raw = fs.readFileSync(TASK_LOG, 'utf8'); }
  catch (e) {
    return { entries: [], error: LOG_FAIL + ': ' + String((e && e.message) || e) };
  }
  try {
    const entries = [];
    let cur = null;
    for (const line of raw.split(/\r?\n/)) {
      const h = line.match(/^###\s+\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\S+)?\s+(\S+)/);
      if (h) { cur = { id: h[1], parts: [line] }; entries.push(cur); continue; }
      if (cur) cur.parts.push(line);
    }
    return { entries: entries.map((e) => ({ id: e.id, text: e.parts.join('\n') })), error: '' };
  } catch (e) {
    return { entries: [], error: LOG_FAIL + ': ' + String((e && e.message) || e) };
  }
}

/** True when `id` occurs in `text` as a whole token (case-sensitive). */
function mentionsNode(text, id) {
  const token = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\b' + token + '\\b').test(text);
}

/**
 * I-028b: state() rows for the issue ledger. Every row keeps its SQLite
 * columns (id, source, title, detail, reply, enddate, urgent, status, opened,
 * updated) and gains the derived `evidence` list: docs/TASK-LOG.md entry ids
 * whose entry text names the issue id as a whole token - the same derivation
 * style as buildAnalysis rounds. An unreadable ledger yields evidence: [] and
 * never throws.
 */
function enrichIssues(rows) {
  const log = readPdcaEntries();
  return rows.map((i) => Object.assign({}, i, {
    evidence: log.entries.filter((e) => mentionsNode(e.text, i.id)).map((e) => e.id),
  }));
}

/**
 * I-033: the per-card audit trail behind GET /api/tasks/:id/audit. Two
 * deterministic sources, both keyed by the task id as a whole token:
 *  - desk events whose detail names the task (the I-019 history stream), and
 *  - docs/TASK-LOG.md PDCA entry ids naming it (the same mentionsNode
 *    derivation buildAnalysis uses for rounds). An unreadable ledger yields
 *    pdca: [] with the note recorded; this path never throws.
 */
function taskAudit(id) {
  const tid = String(id === undefined || id === null ? '' : id);
  const events = tid ? listEvents({ q: tid, limit: 50 }) : [];
  const log = readPdcaEntries();
  const pdca = tid ? log.entries.filter((e) => mentionsNode(e.text, tid)).map((e) => e.id) : [];
  return { id: tid, events, pdca, note: log.error || '' };
}

/** Milestone progress: mean of the sub-line progress values; an empty
 *  sub-line uses the ladder documented in docs/PRD.md (done -> 100,
 *  in_progress -> 50, otherwise 0). */
function milestoneProgress(m, members) {
  if (members.length) {
    const sum = members.reduce((a, w) => a + Number(w.progress || 0), 0);
    return Math.round((sum / members.length) * 100) / 100;
  }
  if (m.status === 'done') return 100;
  if (m.status === 'in_progress') return 50;
  return 0;
}

function round2(n) { return Math.round(Number(n || 0) * 100) / 100; }

/** analysis{} keyed by every milestone id and work-unit id + the ledger note. */
function buildAnalysis(plan) {
  const log = readPdcaEntries();
  const analysis = {};
  const wOf = {};
  (plan.work_units || []).forEach((w) => { wOf[w.id] = w; });
  const sub = plan.sub_lines || {};
  const nodes = (plan.milestones || []).map((m) => ({ m, w: null }))
    .concat((plan.work_units || []).map((w) => ({ m: null, w })));
  nodes.forEach((n) => {
    const id = n.m ? n.m.id : n.w.id;
    const members = n.m ? (sub[n.m.id] || []).map((x) => wOf[x]).filter(Boolean) : [];
    const hits = log.entries.filter((e) => mentionsNode(e.text, id));
    analysis[id] = {
      status: String((n.m || n.w).status || ''),
      progress: n.m ? milestoneProgress(n.m, members) : Number(n.w.progress || 0),
      cost: n.m ? round2(members.reduce((a, x) => a + Number(x.cost || 0), 0)) : round2(n.w.cost),
      rounds: hits.map((e) => e.id),
      rework: hits.filter((e) => e.text.indexOf('rework-of') !== -1).length,
    };
  });
  return { analysis, note: log.error };
}

/** goals[] pass-through with the frozen field names; absent -> empty layer. */
function readGoals(plan) {
  if (!Array.isArray(plan.goals)) return [];
  return plan.goals.map((g) => ({
    id: String((g && g.id) || ''),
    title: String((g && g.title) || ''),
    milestone_ids: Array.isArray(g && g.milestone_ids) ? g.milestone_ids.map(String) : [],
  }));
}

/** Read-only view of the PRD plan, or an explicit empty state. */
function readPlan() {
  let raw;
  try { raw = fs.readFileSync(PLAN_FILE, 'utf8'); }
  catch (_e) {
    return { available: false, state: 'PRD_NOT_INGESTED', label: PLAN_EMPTY_LABEL,
      detail: PLAN_EMPTY_DETAIL, fix_command: PLAN_FIX, message: PLAN_EMPTY_TEXT,
      charter: null, milestones: [], work_units: [], relations: [], main_line: [], sub_lines: {},
      goals: [], analysis: {}, analysis_note: 'milestone plan absent; analysis not derived' };
  }
  try {
    const plan = JSON.parse(raw);
    if (!plan || !Array.isArray(plan.milestones)) throw new Error('plan missing milestones[]');
    const ch = plan.charter || {};
    const derived = buildAnalysis(plan);
    return {
      available: true, state: 'READY', schema: String(plan.schema || ''),
      label: 'Milestone plan ready', detail: '', fix_command: PLAN_FIX, message: '',
      charter: {
        purpose: cleanText(ch.purpose), technical_resources: cleanText(ch.technical_resources),
        evaluation: cleanText(ch.evaluation), side_purpose: cleanText(ch.side_purpose),
      },
      milestones: plan.milestones || [], work_units: plan.work_units || [],
      relations: plan.relations || [], main_line: plan.main_line || [], sub_lines: plan.sub_lines || {},
      goals: readGoals(plan), analysis: derived.analysis, analysis_note: derived.note,
    };
  } catch (e) {
    return { available: false, state: 'PRD_INVALID', label: 'PRD plan invalid',
      detail: String((e && e.message) || e), fix_command: PLAN_FIX, message: PLAN_EMPTY_TEXT,
      charter: null, milestones: [], work_units: [], relations: [], main_line: [], sub_lines: {},
      goals: [], analysis: {}, analysis_note: 'milestone plan invalid; analysis not derived' };
  }
}

/** Effective charter: the plan wins over a placeholder, a real human edit wins
 *  over both. When no plan exists, say so explicitly instead of showing blank. */
function effectiveMeta(meta) {
  const ps = readPlan();
  const pc = ps.available ? (ps.charter || {}) : null;
  const eff = (key, pk) => {
    const cur = meta[key];
    if (!isCharterPlaceholder(cur)) return cur;
    if (pc && pc[pk]) return pc[pk];
    return PLAN_EMPTY_TEXT;
  };
  meta.project_purpose = eff('project_purpose', 'purpose');
  meta.project_resources = eff('project_resources', 'technical_resources');
  meta.project_evaluation = eff('project_evaluation', 'evaluation');
  meta.project_side_purpose = eff('project_side_purpose', 'side_purpose');
  return ps;
}

/* ---- I-031 goal-tree structure writes + WBS template library -------------
 * PUT /api/plan/structure runs planStructureUpdate: one validated, atomic
 * rewrite of milestone-plan.json per operation (move | apply-template).
 * Validation mirrors the plan-internal half of the prd-to-action gate: every
 * milestone sits in exactly one titled goal with a non-empty member list,
 * sub_lines membership is two-way consistent with work_units[].milestone_id,
 * main_line is a topological cover of every milestone id, relations stay
 * acyclic and dangling-free, and work-unit fields stay inside the frozen vocab
 * (status may be the I-031 placeholder 'todo' on template instances). Existing
 * ids are never rewritten; a failed validation throws BEFORE any byte reaches
 * disk, so the route answers 400 with zero writes. Array order follows sibling
 * order: goals[].milestone_ids, milestones[] and work_units[] are normalised
 * to tree order on every write. sub_lines arrays change only when membership
 * changes - their order is pinned byte-for-byte to docs/evidence/milestones.json
 * by prd-to-action gate X, so a same-parent work-unit reorder travels through
 * work_units[] array order, which is exactly what the renderer reads; a
 * cross-parent move re-syncs the changed sub_lines keys into that evidence
 * file through the same dual-store write (R30 line 2: every accepted move
 * kind keeps prd-to-action 10/10 and plan-sync --check green).
 * The template library is additive: a wbs_templates table behind GET/POST
 * /api/templates, six built-in skeletons seeded idempotently at boot (each
 * carrying the exact provenance line), subtree save from a G/M row, and apply
 * instantiating fresh ids that continue the M/W series through this same
 * validated write path with placeholder status/cost (todo / 0).
 * ------------------------------------------------------------------------ */
const TEMPLATE_PROVENANCE = 'inspired by Teambition public template categories; content authored fresh';

/* Six fresh generic WBS skeletons (4-6 allowed by the R30 lock). Shapes are
 * milestones[] -> work_units[{title}]; ids and live status are never stored -
 * apply() assigns fresh ones. Content authored fresh for this package. */
const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-launch', name: 'Product launch', kind: 'builtin',
    milestones: [
      { name: 'Launch planning', work_units: [
        { title: 'Define target segment' }, { title: 'Draft launch goals' } ] },
      { name: 'Launch build', work_units: [
        { title: 'Assemble launch assets' }, { title: 'Set up success analytics' } ] },
      { name: 'Launch day', work_units: [
        { title: 'Run go-live checklist' }, { title: 'Monitor first signals' } ] },
    ],
  },
  {
    id: 'builtin-release', name: 'Software release', kind: 'builtin',
    milestones: [
      { name: 'Release planning', work_units: [
        { title: 'Freeze release scope' }, { title: 'Draft rollout plan' } ] },
      { name: 'Release candidate', work_units: [
        { title: 'Run regression pass' }, { title: 'Triage blocking defects' } ] },
      { name: 'Release', work_units: [
        { title: 'Publish the build' }, { title: 'Watch the error budget' } ] },
    ],
  },
  {
    id: 'builtin-campaign', name: 'Market campaign', kind: 'builtin',
    milestones: [
      { name: 'Campaign planning', work_units: [
        { title: 'Pick audience and message' }, { title: 'Set campaign budget' } ] },
      { name: 'Campaign production', work_units: [
        { title: 'Produce campaign assets' }, { title: 'Review marketing claims' } ] },
      { name: 'Campaign run', work_units: [
        { title: 'Launch the channels' }, { title: 'Measure conversions' } ] },
    ],
  },
  {
    id: 'builtin-event', name: 'Event', kind: 'builtin',
    milestones: [
      { name: 'Event planning', work_units: [
        { title: 'Choose venue and date' }, { title: 'Draft the run of show' } ] },
      { name: 'Event preparation', work_units: [
        { title: 'Confirm the speakers' }, { title: 'Rehearse the program' } ] },
      { name: 'Event day', work_units: [
        { title: 'Run registration' }, { title: 'Capture attendee feedback' } ] },
    ],
  },
  {
    id: 'builtin-hiring', name: 'Hiring', kind: 'builtin',
    milestones: [
      { name: 'Role setup', work_units: [
        { title: 'Write the role scorecard' }, { title: 'Open the requisition' } ] },
      { name: 'Sourcing', work_units: [
        { title: 'Screen inbound applicants' }, { title: 'Schedule the interviews' } ] },
      { name: 'Decision', work_units: [
        { title: 'Run the final loop' }, { title: 'Send the offer' } ] },
    ],
  },
  {
    id: 'builtin-content', name: 'Content production', kind: 'builtin',
    milestones: [
      { name: 'Content planning', work_units: [
        { title: 'Pick topics and audience' }, { title: 'Build the content calendar' } ] },
      { name: 'Content draft', work_units: [
        { title: 'Draft the first pass' }, { title: 'Review for accuracy' } ] },
      { name: 'Content publish', work_units: [
        { title: 'Schedule publication' }, { title: 'Track engagement' } ] },
    ],
  },
];

/** Parse milestone-plan.json strictly; used by every structure write so a
 *  corrupt or absent file is a thrown error (route -> 400), never a write. */
function readPlanRaw() {
  const raw = fs.readFileSync(PLAN_FILE, 'utf8');
  const plan = JSON.parse(raw);
  if (!plan || !Array.isArray(plan.milestones)) throw new Error('plan missing milestones[]');
  return plan;
}

/** Render order for one milestone's work units: work_units[] array order
 *  first (the order a sibling move rewrites), sub_lines membership as the
 *  fallback for ids the work_units list does not carry. Mirrors the panel
 *  renderer so server and UI always agree on sibling position. */
function wuSeqOf(plan, mid) {
  const key = String(mid);
  const out = plan.work_units
    .filter((w) => String(w.milestone_id) === key)
    .map((w) => String(w.id));
  const sub = plan.sub_lines && Array.isArray(plan.sub_lines[key]) ? plan.sub_lines[key] : [];
  sub.forEach((id) => { if (out.indexOf(String(id)) < 0) out.push(String(id)); });
  return out;
}

/** Reorder milestones[] and work_units[] to tree order (goals -> milestone_ids
 *  -> work sequence). `seqs`, when given, supplies the per-milestone work
 *  sequence a move just computed; otherwise the current array order is kept.
 *  sub_lines is never rebuilt here - its key order and (for untouched
 *  membership) its array order are part of the frozen cross-store contract. */
function normalizePlanArrays(plan, seqs) {
  const wByM = seqs || {};
  if (!seqs) {
    plan.work_units.forEach((w) => {
      const k = String(w.milestone_id || '');
      if (!wByM[k]) wByM[k] = [];
      wByM[k].push(w);
    });
  }
  const msOrder = [];
  const wOrder = [];
  const seenM = {};
  const seenW = {};
  (Array.isArray(plan.goals) ? plan.goals : []).forEach((g) => {
    (g && Array.isArray(g.milestone_ids) ? g.milestone_ids : []).forEach((mid) => {
      const key = String(mid);
      if (seenM[key]) return;
      const m = plan.milestones.filter((x) => String(x.id) === key)[0];
      if (m) { msOrder.push(m); seenM[key] = true; }
      (wByM[key] || []).forEach((w) => {
        const wid = String(w.id);
        if (!seenW[wid]) { wOrder.push(w); seenW[wid] = true; }
      });
    });
  });
  plan.milestones.forEach((m) => {
    const k = String(m.id);
    if (!seenM[k]) { msOrder.push(m); seenM[k] = true; }
  });
  plan.work_units.forEach((w) => {
    const k = String(w.id);
    if (!seenW[k]) { wOrder.push(w); seenW[k] = true; }
  });
  plan.milestones = msOrder;
  plan.work_units = wOrder;
}

/**
 * Plan-internal invariants (the prd-to-action gate X / E half that does not
 * compare against docs/): throws with a specific reason on the first breach.
 * Status vocabulary is deliberately NOT enforced - I-031 template instances
 * carry the placeholder 'todo', which the gate only meets once the PRD adopts
 * the new ids (structure writes restore in tests before the gates re-run).
 */
function validatePlanStructure(plan) {
  const fail = (msg) => { throw new Error('structure validation failed: ' + msg); };
  if (!plan || !Array.isArray(plan.milestones) || !plan.milestones.length) fail('milestones[] missing or empty');
  if (!Array.isArray(plan.work_units)) fail('work_units[] missing');
  if (!Array.isArray(plan.goals)) fail('goals[] missing');
  const mIds = plan.milestones.map((m) => String((m && m.id) || ''));
  if (mIds.some((x) => !x)) fail('milestone without id');
  if (new Set(mIds).size !== mIds.length) fail('duplicate milestone id');
  const wIds = plan.work_units.map((w) => String((w && w.id) || ''));
  if (wIds.some((x) => !x)) fail('work unit without id');
  if (new Set(wIds).size !== wIds.length) fail('duplicate work unit id');
  const mSet = new Set(mIds);
  const wSet = new Set(wIds);
  mIds.forEach((id) => { if (wSet.has(id)) fail('id used as both milestone and work unit: ' + id); });

  /* Goals: every milestone exactly once, each goal titled with members. */
  const covered = new Set();
  plan.goals.forEach((g) => {
    const gid = g && g.id ? String(g.id) : '';
    if (!gid) fail('goal without id');
    if (!g.title) fail('goal ' + gid + ' without title');
    if (!Array.isArray(g.milestone_ids) || !g.milestone_ids.length) {
      fail('goal ' + gid + ' needs a non-empty milestone_ids');
    }
    g.milestone_ids.forEach((mid) => {
      const key = String(mid);
      if (!mSet.has(key)) fail(gid + ': unknown milestone ' + key);
      if (covered.has(key)) fail(key + ': covered by more than one goal');
      covered.add(key);
    });
  });
  mIds.forEach((id) => { if (!covered.has(id)) fail(id + ': no goal'); });

  /* sub_lines <-> milestone_id: two-way membership, exactly one list per id. */
  const sub = plan.sub_lines && typeof plan.sub_lines === 'object' ? plan.sub_lines : {};
  mIds.forEach((id) => {
    if (!Object.prototype.hasOwnProperty.call(sub, id)) fail(id + ': no sub_lines entry');
  });
  Object.keys(sub).forEach((k) => { if (!mSet.has(k)) fail('sub_lines key without milestone: ' + k); });
  const seenInSub = new Set();
  mIds.forEach((mid) => {
    const arr = Array.isArray(sub[mid]) ? sub[mid] : [];
    if (new Set(arr.map(String)).size !== arr.length) fail(mid + ': duplicate id in sub_lines');
    arr.forEach((raw) => {
      const wid = String(raw);
      if (!wSet.has(wid)) fail(mid + ': dangling sub_line id ' + wid);
      if (seenInSub.has(wid)) fail(wid + ' listed in more than one sub_lines');
      seenInSub.add(wid);
      const w = plan.work_units.filter((x) => String(x.id) === wid)[0];
      if (String(w.milestone_id) !== mid) {
        fail(wid + ': in sub_lines of ' + mid + ' but milestone_id=' + w.milestone_id);
      }
    });
  });
  wIds.forEach((id) => {
    const w = plan.work_units.filter((x) => String(x.id) === id)[0];
    if (!seenInSub.has(id)) fail(id + ': milestone_id ' + w.milestone_id + ' not listed in its sub_line');
  });

  /* main_line: exact cover in a topological order (gate E plan side). */
  const ml = plan.main_line;
  if (!Array.isArray(ml)) fail('main_line missing');
  if (ml.length !== mIds.length) fail('main_line length ' + ml.length + ' != ' + mIds.length);
  if (new Set(ml.map(String)).size !== ml.length) fail('duplicate id in main_line');
  const mlStr = ml.map(String);
  mIds.forEach((id) => { if (mlStr.indexOf(id) < 0) fail('missing id in main_line: ' + id); });
  const pos = {};
  mlStr.forEach((id, i) => { pos[id] = i; });
  plan.milestones.forEach((m) => {
    const id = String(m.id);
    const d = m.depends_on;
    const deps = Array.isArray(d) ? d.map(String)
      : (d ? String(d).split(/[,;\s]+/).filter(Boolean) : []);
    deps.forEach((dep) => {
      if (pos[dep] === undefined || pos[dep] >= pos[id]) fail('dep ' + dep + ' not before ' + id);
    });
    if (!(Number(m.start_offset_h) < Number(m.end_offset_h))) fail(id + ': offsets');
  });

  /* Relations: frozen types, no dangling ids, acyclic (gate E plan side). */
  const rels = Array.isArray(plan.relations) ? plan.relations : [];
  const relTypeOk = ['FS', 'SS', 'FF', 'SF'];
  rels.forEach((r) => {
    if (!wSet.has(String(r.from))) fail('dangling relation from ' + r.from);
    if (!wSet.has(String(r.to))) fail('dangling relation to ' + r.to);
    if (relTypeOk.indexOf(String(r.type)) < 0) fail('bad relation type: ' + r.type);
  });
  const indeg = {};
  const adj = {};
  wIds.forEach((id) => { indeg[id] = 0; adj[id] = []; });
  rels.forEach((r) => {
    const a = String(r.from); const b = String(r.to);
    adj[a].push(b); indeg[b] += 1;
  });
  const queue = wIds.filter((id) => indeg[id] === 0);
  let seenN = 0;
  const seenRel = {};
  while (queue.length) {
    const n = queue.shift();
    if (seenRel[n]) continue;
    seenRel[n] = true;
    seenN += 1;
    (adj[n] || []).forEach((t) => { indeg[t] -= 1; if (indeg[t] === 0) queue.push(t); });
  }
  if (seenN !== wIds.length) fail('cyclic relations (' + (wIds.length - seenN) + ' nodes unprocessed)');

  /* Work-unit fields (gate X plan side) minus the status vocabulary. */
  const ownerOk = ['human', 'main', 'subagent', 'team'];
  const tierOk = ['S', 'M', 'L', 'XL'];
  plan.work_units.forEach((w) => {
    const id = String(w.id);
    if (mSet.has(String(w.milestone_id)) === false) fail(id + ': bad milestone_id ' + w.milestone_id);
    if (ownerOk.indexOf(String(w.owner_type)) < 0) fail(id + ': bad owner_type');
    if (tierOk.indexOf(String(w.tier)) < 0) fail(id + ': bad tier');
    const p = Number(w.progress);
    if (!(Number.isFinite(p) && p >= 0 && p <= 100)) fail(id + ': progress');
    if (!(Number(w.start_offset_h) < Number(w.end_offset_h))) fail(id + ': offsets');
    if (typeof w.billed !== 'number' || typeof w.cost !== 'number') fail(id + ': billed/cost');
    if (!String(w.status === undefined || w.status === null ? '' : w.status).trim()) fail(id + ': empty status');
  });
  return true;
}

/**
 * Fresh ids continuing the existing M/W series, collision-checked against
 * every milestone and work-unit id in the plan. I-031 apply-template and
 * I-038 add-child share this factory so the series never forks: M8+/W19+
 * come out of the same max+1 walk either path takes.
 */
function makeFreshIds(plan) {
  const allIds = new Set();
  plan.milestones.forEach((m) => allIds.add(String(m.id)));
  plan.work_units.forEach((w) => allIds.add(String(w.id)));
  let nextM = 1;
  let nextW = 1;
  plan.milestones.forEach((m) => {
    const n = /^M(\d+)$/.exec(String(m.id));
    if (n) nextM = Math.max(nextM, Number(n[1]) + 1);
  });
  plan.work_units.forEach((w) => {
    const n = /^W(\d+)$/.exec(String(w.id));
    if (n) nextW = Math.max(nextW, Number(n[1]) + 1);
  });
  const freshM = () => {
    let id;
    do { id = 'M' + nextM; nextM += 1; } while (allIds.has(id));
    allIds.add(id);
    return id;
  };
  const freshW = () => {
    let id;
    do { id = 'W' + nextW; nextW += 1; } while (allIds.has(id));
    allIds.add(id);
    return id;
  };
  return { freshM, freshW };
}

/** Temp file + rename: readers never observe a half-written plan. */
function writePlanAtomic(plan) {
  const text = JSON.stringify(plan, null, 2) + '\n';
  const tmp = PLAN_FILE + '.tmp-' + process.pid + '-' + Date.now().toString(36);
  try {
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, PLAN_FILE);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_e) { /* already gone */ }
    throw e;
  }
}

/**
 * R30 line 2 (resolution): gate X compares plan.sub_lines to
 * docs/evidence/milestones.json with exact JSON equality (it pins main_line
 * and relations the same way, but a move never touches those two). Prepare
 * the evidence rewrite for ONLY the sub_lines keys this move actually
 * changes; null means the stores already agree and only the plan will write.
 * A missing/unparseable evidence file throws BEFORE any byte is written, so
 * the route answers 400 with zero writes.
 */
function prepareEvidenceSubLines(plan) {
  let bak;
  try { bak = fs.readFileSync(MILESTONES_FILE, 'utf8'); }
  catch (e) {
    throw new Error('evidence sync unavailable (milestones.json unreadable): ' + e.message);
  }
  let ms;
  try { ms = JSON.parse(bak); } catch (e) {
    throw new Error('evidence sync unavailable (milestones.json invalid): ' + e.message);
  }
  if (!ms || typeof ms !== 'object') {
    throw new Error('evidence sync unavailable (milestones.json not an object)');
  }
  const src = plan.sub_lines && typeof plan.sub_lines === 'object' ? plan.sub_lines : {};
  if (!ms.sub_lines || typeof ms.sub_lines !== 'object') ms.sub_lines = {};
  const delta = {};
  Object.keys(src).forEach((k) => {
    if (JSON.stringify(src[k]) !== JSON.stringify(ms.sub_lines[k])) delta[k] = src[k];
  });
  if (!Object.keys(delta).length) return null;
  Object.keys(delta).forEach((k) => { ms.sub_lines[k] = delta[k]; });
  return { bak, text: JSON.stringify(ms, null, 2) + '\n', keys: Object.keys(delta) };
}

/**
 * Dual-store write for moves: both tmp files land first, the evidence rename
 * goes first, the plan rename goes last. A failure at any step leaves both
 * stores on their original bytes (the only mid-way case - plan rename after a
 * successful evidence rename - restores the evidence file from its original
 * bytes before rethrowing), so no reader ever sees two diverged stores.
 */
function writeStructureStores(plan, evidence) {
  const planText = JSON.stringify(plan, null, 2) + '\n';
  const stamp = process.pid + '-' + Date.now().toString(36);
  const planTmp = PLAN_FILE + '.tmp-' + stamp;
  const msTmp = evidence ? MILESTONES_FILE + '.tmp-' + stamp : null;
  try {
    fs.writeFileSync(planTmp, planText, 'utf8');
    if (evidence) fs.writeFileSync(msTmp, evidence.text, 'utf8');
    if (evidence) fs.renameSync(msTmp, MILESTONES_FILE);
    try {
      fs.renameSync(planTmp, PLAN_FILE);
    } catch (e) {
      if (evidence) {
        try { fs.writeFileSync(MILESTONES_FILE, evidence.bak, 'utf8'); }
        catch (_rollback) { /* best effort; the original error still surfaces */ }
      }
      throw e;
    }
  } finally {
    try { if (fs.existsSync(planTmp)) fs.unlinkSync(planTmp); } catch (_e) { /* gone */ }
    try { if (msTmp && fs.existsSync(msTmp)) fs.unlinkSync(msTmp); } catch (_e) { /* gone */ }
  }
}

function structureMove(op) {
  const id = String((op && op.id) || '');
  const newParent = String((op && op.new_parent) || '');
  const index = op ? op.index : undefined;
  if (!id || !newParent) throw new Error('move requires id and new_parent');
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('move requires a non-negative integer index');
  }
  const plan = readPlanRaw();
  const mSet = new Set(plan.milestones.map((m) => String(m.id)));
  const wSet = new Set(plan.work_units.map((w) => String(w.id)));
  const isM = mSet.has(id);
  const isW = wSet.has(id);
  if (!isM && !isW) throw new Error('unknown node: ' + id);
  if (isM && isW) throw new Error('id used as both milestone and work unit: ' + id);

  if (isM) {
    const goals = plan.goals;
    const fromG = goals.filter((g) => g && Array.isArray(g.milestone_ids)
      && g.milestone_ids.map(String).indexOf(id) >= 0)[0];
    const toG = goals.filter((g) => g && String(g.id) === newParent)[0];
    if (!toG) throw new Error('unknown goal parent: ' + newParent);
    if (!fromG) throw new Error('milestone ' + id + ' is not in any goal');
    if (!Array.isArray(toG.milestone_ids)) toG.milestone_ids = [];
    if (fromG === toG) {
      const list = toG.milestone_ids.map(String);
      const fi = list.indexOf(id);
      if (fi < 0) throw new Error('milestone ' + id + ' missing from goal ' + newParent);
      list.splice(fi, 1);
      if (index > list.length) throw new Error('index ' + index + ' out of range (0..' + list.length + ')');
      list.splice(index, 0, id);
      toG.milestone_ids = list;
    } else {
      const fromList = fromG.milestone_ids.map(String);
      if (fromList.indexOf(id) < 0) throw new Error('milestone ' + id + ' missing from its goal');
      if (fromList.length <= 1) throw new Error('refusing to empty goal ' + String(fromG.id));
      const toList = toG.milestone_ids.map(String);
      if (index > toList.length) throw new Error('index ' + index + ' out of range (0..' + toList.length + ')');
      fromG.milestone_ids = fromList.filter((x) => x !== id);
      toList.splice(index, 0, id);
      toG.milestone_ids = toList;
    }
    normalizePlanArrays(plan);
  } else {
    const wObj = plan.work_units.filter((x) => String(x.id) === id)[0];
    const fromM = String(wObj.milestone_id || '');
    const toM = newParent;
    if (!mSet.has(toM)) throw new Error('unknown milestone parent: ' + toM);
    if (!fromM || !mSet.has(fromM)) throw new Error('work unit ' + id + ' sits under unknown milestone ' + fromM);
    const seqs = {};
    plan.work_units.forEach((w) => {
      const k = String(w.milestone_id || '');
      if (!seqs[k]) seqs[k] = [];
      seqs[k].push(w);
    });
    const oldSeq = seqs[fromM] || [];
    if (oldSeq.indexOf(wObj) < 0) throw new Error('work unit ' + id + ' missing from its milestone sequence');
    seqs[fromM] = oldSeq.filter((x) => x !== wObj);
    const tSeqIds = (seqs[toM] || []).map((x) => String(x.id)).filter((x) => x !== id);
    if (index > tSeqIds.length) throw new Error('index ' + index + ' out of range (0..' + tSeqIds.length + ')');
    tSeqIds.splice(index, 0, id);
    const byId = {};
    plan.work_units.forEach((w) => { byId[String(w.id)] = w; });
    seqs[toM] = tSeqIds.map((x) => byId[x]);
    wObj.milestone_id = toM;
    if (fromM !== toM) {
      const fromArr = Array.isArray(plan.sub_lines[fromM]) ? plan.sub_lines[fromM].slice() : [];
      plan.sub_lines[fromM] = fromArr.filter((x) => String(x) !== id);
      const toArr = Array.isArray(plan.sub_lines[toM]) ? plan.sub_lines[toM].slice() : [];
      if (toArr.map(String).indexOf(id) < 0) {
        toArr.splice(Math.min(index, toArr.length), 0, id);
        plan.sub_lines[toM] = toArr;
      }
    }
    normalizePlanArrays(plan, seqs);
  }
  validatePlanStructure(plan);
  /* R30 line 2: every accepted move kind keeps both gates green - the plan
     write carries the matching docs/evidence/milestones.json sub_lines
     re-sync (null when the stores already agree, e.g. M moves and W
     same-parent reorders). */
  const evidence = prepareEvidenceSubLines(plan);
  writeStructureStores(plan, evidence);
  return {
    ok: true, kind: 'move', id, new_parent: newParent, index,
    synced_sub_lines: evidence ? evidence.keys : [],
  };
}

function structureApply(op) {
  const target = String((op && op.target) || '');
  const templateId = String((op && op.template_id) || '');
  if (!target || !templateId) throw new Error('apply-template requires target and template_id');
  if (DEGRADED) throw new Error('read-only demo mode: structure writes unavailable');
  const row = db.prepare('SELECT id, name, payload FROM wbs_templates WHERE id=?').get(templateId);
  if (!row) throw new Error('template not found: ' + templateId);
  let payload;
  try { payload = JSON.parse(row.payload); } catch (e) {
    throw new Error('template payload invalid: ' + templateId);
  }
  const tplMs = payload && Array.isArray(payload.milestones) ? payload.milestones : [];
  const plan = readPlanRaw();
  const { freshM, freshW } = makeFreshIds(plan);
  let base = 0;
  plan.milestones.concat(plan.work_units).forEach((x) => {
    base = Math.max(base, Number(x.end_offset_h) || 0, Number(x.start_offset_h) || 0);
  });
  const goal = (plan.goals || []).filter((g) => g && String(g.id) === target)[0];
  const targetM = plan.milestones.filter((m) => String(m.id) === target)[0];
  if (!goal && !targetM) throw new Error('unknown apply target: ' + target);
  const addedM = [];
  const addedW = [];
  const placeW = (wid, mid, start, end, title) => {
    plan.work_units.push({
      id: wid, milestone_id: mid, title, owner: 'Unassigned', owner_type: 'main',
      start_offset_h: start, end_offset_h: end, status: 'todo', progress: 0,
      tier: 'S', billed: 0, cost: 0,
    });
    addedW.push(wid);
  };

  if (goal) {
    if (!tplMs.length) throw new Error('template has no milestones to instantiate');
    if (!plan.sub_lines || typeof plan.sub_lines !== 'object') plan.sub_lines = {};
    if (!Array.isArray(plan.main_line)) plan.main_line = [];
    let prev = plan.main_line.length ? String(plan.main_line[plan.main_line.length - 1]) : '';
    let cursor = base;
    tplMs.forEach((pm) => {
      const mid = freshM();
      const mStart = cursor + 4;
      const mEnd = mStart + 12;
      const titles = pm && Array.isArray(pm.work_units) ? pm.work_units : [];
      const n = Math.max(1, titles.length);
      const step = Math.max(1, Math.floor(12 / n));
      const wIdsNew = [];
      titles.forEach((wu, j) => {
        const wid = freshW();
        const wStart = mStart + j * step;
        let wEnd = Math.min(mEnd, wStart + step);
        if (wEnd <= wStart) wEnd = wStart + 1;
        placeW(wid, mid, wStart, wEnd, String((wu && wu.title) || ('Work unit ' + (j + 1))));
        wIdsNew.push(wid);
      });
      plan.milestones.push({
        id: mid,
        name: String((pm && pm.name) || mid),
        depends_on: prev ? [prev] : [],
        start_offset_h: mStart,
        end_offset_h: mEnd,
        status: 'todo',
        completion: 'Template instance of ' + row.name + '; acceptance criteria to be filled in.',
        verify: 'node scripts/prd-to-action.js',
      });
      plan.sub_lines[mid] = wIdsNew;
      goal.milestone_ids = (Array.isArray(goal.milestone_ids) ? goal.milestone_ids.map(String) : []).concat([mid]);
      plan.main_line.push(mid);
      prev = mid;
      addedM.push(mid);
      cursor = mEnd;
    });
  } else {
    const flat = [];
    tplMs.forEach((pm) => {
      (pm && Array.isArray(pm.work_units) ? pm.work_units : []).forEach((wu) => flat.push(wu));
    });
    if (!flat.length) throw new Error('template has no work units to instantiate under ' + target);
    const mid = String(targetM.id);
    const step = Math.max(1, Math.floor(12 / Math.max(1, flat.length)));
    const newIds = [];
    flat.forEach((wu, j) => {
      const wid = freshW();
      const wStart = base + 4 + j * step;
      const wEnd = wStart + step;
      placeW(wid, mid, wStart, wEnd, String((wu && wu.title) || ('Work unit ' + (j + 1))));
      newIds.push(wid);
    });
    if (!plan.sub_lines || typeof plan.sub_lines !== 'object') plan.sub_lines = {};
    const sub = Array.isArray(plan.sub_lines[mid]) ? plan.sub_lines[mid].slice() : [];
    plan.sub_lines[mid] = sub.concat(newIds);
  }
  normalizePlanArrays(plan);
  validatePlanStructure(plan);
  writePlanAtomic(plan);
  return {
    ok: true, kind: 'apply-template', target, template_id: templateId,
    added_milestones: addedM, added_work_units: addedW,
  };
}

/* ---- R32 / I-038: plan-sync-class node CRUD -----------------------------
 * create-milestone | create-work-unit | update-node | delete-node ride the
 * same PUT /api/plan/structure door. One commit spans FOUR stores:
 * milestone-plan.json, docs/evidence/milestones.json (membership + status),
 * docs/PRD.md (Status lines - a created/deleted milestone's whole block
 * travels with the same commit because prd-to-action gate C counts blocks
 * and plan-sync's PRD shape check refuses orphans, so the gates FORCE the
 * block add/remove; no other docs file is ever written) and the SQLite task
 * rows. Order: validate everything first (zero writes on any failure), then
 * BEGIN one SQLite transaction, write three tmp files, rename evidence ->
 * PRD -> plan (plan last, the I-031 pattern), COMMIT; any throw restores
 * every renamed store from its original bytes and rolls the transaction
 * back - a failed store rolls back all four.
 * Validation carries the plan-sync W rules verbatim (status vocabulary,
 * done <-> progress 100, leaving done demands explicit progress) and the
 * PRD gate X floor (a milestone keeps 0 or >= 2 work units; refusing a
 * landing at 1 keeps prd-to-action green after every delete class), plus
 * the empty-goal and last-goal refusals structureMove already established.
 * ------------------------------------------------------------------------ */

/** docs/PRD.md half: locate milestone blocks, their Status lines and the
 *  exclusive end of each block (next ### M<N>: or ## heading). Mirrors
 *  plan-sync's prdScan so both tools see the same registry. */
function prdMilestoneScan(text) {
  const eol = text.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let cur = null;
  for (let i = 0; i < lines.length; i += 1) {
    const h = lines[i].match(/^###\s+(M\d+):/);
    if (h) { cur = { id: h[1], start: i, statusIdx: -1 }; blocks.push(cur); continue; }
    if (/^##\s/.test(lines[i])) { cur = null; continue; }
    if (cur && cur.statusIdx === -1 && /^-\s*Status:/.test(lines[i])) cur.statusIdx = i;
  }
  blocks.forEach((b) => {
    let end = lines.length;
    for (let i = b.start + 1; i < lines.length; i += 1) {
      if (/^###\s+M\d+:/.test(lines[i]) || /^##\s/.test(lines[i])) { end = i; break; }
    }
    b.end = end;
  });
  return { eol, lines, blocks };
}

/** The seven-field PRD block a created milestone adopts (gate C shape). */
function prdBlockLinesOf(m) {
  const d = m.depends_on;
  const deps = Array.isArray(d) ? d.map(String)
    : (d ? String(d).split(/[,;\s]+/).filter(Boolean) : []);
  return [
    '### ' + m.id + ': ' + cleanText(String(m.name || m.id)),
    '- Depends on: ' + (deps.length ? deps.join(', ') : 'none'),
    '- Type: code',
    '- Has external deps: no',
    '- Files: assets/linked-gantt-board/data/milestone-plan.json, docs/evidence/milestones.json, docs/PRD.md',
    '- Completion: ' + cleanText(String(m.completion || '')),
    '- Verify: ' + String(m.verify || PLAN_FIX),
    '- Status: ' + String(m.status || 'pending'),
  ];
}

/**
 * Prepare both docs halves for the validated NEW plan. Returns
 * { evidence: {bak, text} | null, prd: {bak, text} | null }; null means that
 * store already agrees (the node CRUD writes nothing there - e.g. a work-unit
 * update never touches evidence or the PRD). Reading either docs file throws
 * BEFORE any byte is written, so an unreadable store is a 400 with zero
 * writes. Evidence keeps its own entry shape (type/files) and only syncs
 * membership, status and the depends_on edges a deletion orphans.
 */
function prepareNodeDocs(plan) {
  let evBak;
  try { evBak = fs.readFileSync(MILESTONES_FILE, 'utf8'); }
  catch (e) {
    throw new Error('node CRUD docs sync unavailable (milestones.json unreadable): ' + e.message);
  }
  let ms;
  try { ms = JSON.parse(evBak); } catch (e) {
    throw new Error('node CRUD docs sync unavailable (milestones.json invalid): ' + e.message);
  }
  if (!ms || typeof ms !== 'object') {
    throw new Error('node CRUD docs sync unavailable (milestones.json not an object)');
  }
  const planMs = {};
  (plan.milestones || []).forEach((m) => { planMs[String(m.id)] = m; });
  const oldList = Array.isArray(ms.milestones) ? ms.milestones : [];
  const dropped = new Set(oldList.map((e) => String(e.id)).filter((id) => !planMs[id]));
  const stripDeps = (depsRaw) => {
    if (!dropped.size) return depsRaw;
    if (Array.isArray(depsRaw)) {
      const out = depsRaw.map(String).filter((d) => !dropped.has(d));
      return out.length === depsRaw.length ? depsRaw : out;
    }
    if (typeof depsRaw === 'string' && depsRaw) {
      const parts = depsRaw.split(/[,;\s]+/).filter(Boolean);
      const out = parts.filter((d) => !dropped.has(d));
      return out.length === parts.length ? depsRaw : out.join(', ');
    }
    return depsRaw;
  };
  const kept = oldList.filter((e) => planMs[String(e.id)]).map((e) => {
    const pm = planMs[String(e.id)];
    return Object.assign({}, e, {
      status: String(pm.status === undefined ? e.status : pm.status),
      depends_on: stripDeps(e.depends_on),
    });
  });
  const newEntries = (plan.milestones || [])
    .filter((m) => !kept.some((e) => String(e.id) === String(m.id)))
    .map((m) => ({
      id: String(m.id),
      name: cleanText(String(m.name || m.id)),
      depends_on: Array.isArray(m.depends_on) ? m.depends_on.map(String)
        : (m.depends_on ? [String(m.depends_on)] : []),
      type: 'code',
      files: ['assets/linked-gantt-board/data/milestone-plan.json'],
      completion: cleanText(String(m.completion || '')),
      verify: String(m.verify || PLAN_FIX),
      status: String(m.status || 'pending'),
    }));
  const newMs = Object.assign({}, ms);
  newMs.milestones = kept.concat(newEntries);
  newMs.main_line = (plan.main_line || []).slice();
  newMs.sub_lines = plan.sub_lines || {};
  newMs.relations = (plan.relations || []).slice();
  const evidence = JSON.stringify(ms) !== JSON.stringify(newMs)
    ? { bak: evBak, text: JSON.stringify(newMs, null, 2) + '\n' }
    : null;

  let prdBak;
  try { prdBak = fs.readFileSync(PRD_FILE, 'utf8'); }
  catch (e) {
    throw new Error('node CRUD docs sync unavailable (PRD.md unreadable): ' + e.message);
  }
  const scan = prdMilestoneScan(prdBak);
  const blockOf = {};
  scan.blocks.forEach((b) => { blockOf[b.id] = b; });
  const planSet = new Set((plan.milestones || []).map((m) => String(m.id)));
  const lineEdits = [];
  scan.blocks.forEach((b) => {
    const pm = planMs[b.id];
    if (!pm) { lineEdits.push({ type: 'remove', at: b.start, end: b.end }); return; }
    if (b.statusIdx >= 0) {
      const want = '- Status: ' + String(pm.status || 'pending');
      if (scan.lines[b.statusIdx] !== want) lineEdits.push({ type: 'status', at: b.statusIdx, want });
    }
  });
  const adds = (plan.milestones || []).filter((m) => !blockOf[String(m.id)]);
  let prd = null;
  if (lineEdits.length || adds.length) {
    lineEdits.sort((a, b) => b.at - a.at).forEach((a) => {
      if (a.type === 'remove') scan.lines.splice(a.at, a.end - a.at);
      else scan.lines[a.at] = a.want;
    });
    if (adds.length) {
      let lastM = -1;
      scan.lines.forEach((ln, i) => { if (/^###\s+M\d+:/.test(ln)) lastM = i; });
      let term = scan.lines.length;
      for (let i = lastM + 1; i < scan.lines.length; i += 1) {
        if (/^##\s/.test(scan.lines[i])) { term = i; break; }
      }
      const ins = [];
      if (scan.lines[term - 1] !== '') ins.push('');
      adds.forEach((m) => { ins.push(...prdBlockLinesOf(m), ''); });
      scan.lines.splice(term, 0, ...ins);
    }
    prd = { bak: prdBak, text: scan.lines.join(scan.eol) };
  }
  return { evidence, prd };
}

/**
 * The four-store commit. SQLite first (BEGIN + DML), tmp files for every
 * changed store, renames evidence -> PRD -> plan, COMMIT. On ANY failure:
 * ROLLBACK the transaction and write every already-renamed store back from
 * its original bytes, so no reader and no gate ever observes a partial
 * commit. Tmp files are removed in finally.
 */
function writeNodeStores(plan, evidence, prd, sqliteApply) {
  const planBak = fs.readFileSync(PLAN_FILE, 'utf8');
  const planText = JSON.stringify(plan, null, 2) + '\n';
  const stamp = process.pid + '-' + Date.now().toString(36);
  const planTmp = PLAN_FILE + '.tmp-' + stamp;
  const msTmp = evidence ? MILESTONES_FILE + '.tmp-' + stamp : null;
  const prdT = prd ? PRD_FILE + '.tmp-' + stamp : null;
  const renamed = [];
  let began = false;
  try {
    if (sqliteApply) {
      db.exec('PRAGMA busy_timeout=4000');
      db.exec('BEGIN IMMEDIATE');
      began = true;
      sqliteApply(db);
    }
    fs.writeFileSync(planTmp, planText, 'utf8');
    if (evidence) fs.writeFileSync(msTmp, evidence.text, 'utf8');
    if (prd) fs.writeFileSync(prdT, prd.text, 'utf8');
    if (evidence) {
      fs.renameSync(msTmp, MILESTONES_FILE);
      renamed.push({ file: MILESTONES_FILE, bak: evidence.bak });
    }
    if (prd) {
      fs.renameSync(prdT, PRD_FILE);
      renamed.push({ file: PRD_FILE, bak: prd.bak });
    }
    fs.renameSync(planTmp, PLAN_FILE);
    renamed.push({ file: PLAN_FILE, bak: planBak });
    if (began) db.exec('COMMIT');
  } catch (e) {
    if (began) { try { db.exec('ROLLBACK'); } catch (_r) { /* already rolled back */ } }
    renamed.reverse().forEach((r) => {
      try { fs.writeFileSync(r.file, r.bak, 'utf8'); } catch (_x) { /* best effort; original error surfaces */ }
    });
    throw e;
  } finally {
    try { if (fs.existsSync(planTmp)) fs.unlinkSync(planTmp); } catch (_e) { /* gone */ }
    try { if (msTmp && fs.existsSync(msTmp)) fs.unlinkSync(msTmp); } catch (_e) { /* gone */ }
    try { if (prd && fs.existsSync(prdT)) fs.unlinkSync(prdT); } catch (_e) { /* gone */ }
  }
}

/** CREATE on a G row: a fresh milestone (M8+ series) under its goal. */
function structureCreateMilestone(op) {
  const goalId = String((op && op.parent) || '');
  if (!goalId) throw new Error('create-milestone requires parent (goal id)');
  const plan = readPlanRaw();
  const goal = (plan.goals || []).filter((g) => g && String(g.id) === goalId)[0];
  if (!goal) throw new Error('unknown goal parent: ' + goalId);
  const { freshM } = makeFreshIds(plan);
  const id = freshM();
  const name = cleanText(String((op && op.name) || 'New milestone')).trim() || 'New milestone';
  let base = 0;
  plan.milestones.concat(plan.work_units).forEach((x) => {
    base = Math.max(base, Number(x.end_offset_h) || 0, Number(x.start_offset_h) || 0);
  });
  const prev = plan.main_line.length ? String(plan.main_line[plan.main_line.length - 1]) : '';
  const completion = id + ' created from the plan tree add-child control: status '
    + PLAN_STATUSES[0] + ' in docs/PRD.md, docs/evidence/milestones.json and '
    + 'milestone-plan.json together; sub_lines ' + id + ': [] until work units '
    + 'are added under it.';
  const milestone = {
    id, name, depends_on: prev ? [prev] : [],
    start_offset_h: base + 4, end_offset_h: base + 16,
    status: PLAN_STATUSES[0], completion, verify: PLAN_FIX,
  };
  plan.milestones.push(milestone);
  goal.milestone_ids = (Array.isArray(goal.milestone_ids) ? goal.milestone_ids.map(String) : [])
    .concat([id]);
  plan.main_line.push(id);
  if (!plan.sub_lines || typeof plan.sub_lines !== 'object') plan.sub_lines = {};
  plan.sub_lines[id] = [];
  normalizePlanArrays(plan);
  validatePlanStructure(plan);
  const docs = prepareNodeDocs(plan);
  writeNodeStores(plan, docs.evidence, docs.prd, null);
  return {
    ok: true, kind: 'create-milestone', id, goal: goalId, status: milestone.status,
    synced: { evidence: !!docs.evidence, prd: !!docs.prd },
  };
}

/** CREATE on an M row: fresh work unit(s) (W19+ series). An empty milestone
 *  receives the pair PRD gate X needs (0 or >= 2 units), stated in the
 *  response so the UI can say why two rows appeared. */
function structureCreateWorkUnit(op) {
  const mid = String((op && op.parent) || '');
  if (!mid) throw new Error('create-work-unit requires parent (milestone id)');
  const plan = readPlanRaw();
  const target = plan.milestones.filter((m) => String(m.id) === mid)[0];
  if (!target) throw new Error('unknown milestone parent: ' + mid);
  const owned = plan.work_units.filter((w) => String(w.milestone_id) === mid).length;
  const pair = owned === 0;
  const count = pair ? 2 : 1;
  const { freshW } = makeFreshIds(plan);
  let base = 0;
  plan.milestones.concat(plan.work_units).forEach((x) => {
    base = Math.max(base, Number(x.end_offset_h) || 0, Number(x.start_offset_h) || 0);
  });
  const rawTitle = cleanText(String((op && op.title) || '')).trim();
  const added = [];
  const units = [];
  for (let i = 0; i < count; i += 1) {
    const id = freshW();
    const title = rawTitle
      ? (i === 0 ? rawTitle : rawTitle + ' (part ' + (i + 1) + ')')
      : 'Work unit ' + (i + 1);
    const s = base + 4 + i * 4;
    units.push({
      id, milestone_id: mid, title, owner: 'Unassigned', owner_type: 'main',
      start_offset_h: s, end_offset_h: s + 4,
      status: PLAN_STATUSES[0], progress: 0, tier: 'S', billed: 0, cost: 0,
    });
    added.push(id);
  }
  units.forEach((u) => plan.work_units.push(u));
  if (!plan.sub_lines || typeof plan.sub_lines !== 'object') plan.sub_lines = {};
  const sub = Array.isArray(plan.sub_lines[mid]) ? plan.sub_lines[mid].slice() : [];
  added.forEach((wid) => { if (sub.map(String).indexOf(wid) < 0) sub.push(wid); });
  plan.sub_lines[mid] = sub;
  normalizePlanArrays(plan);
  validatePlanStructure(plan);
  const docs = prepareNodeDocs(plan);
  const sqliteApply = (conn) => {
    const labelOf = { pending: 'Pending', in_progress: 'In Progress', done: 'Done', skipped: 'Skipped' };
    const colorOf = { pending: '#8e8e93', in_progress: '#0071e3', done: '#34c759', skipped: '#ff9500' };
    units.forEach((u) => {
      if (!conn.prepare('SELECT id FROM columns WHERE id=?').get(u.status)) {
        const colSort = conn.prepare('SELECT COALESCE(MAX(sort),0)+1 AS n FROM columns').get().n;
        conn.prepare('INSERT INTO columns(id,label,color,sort) VALUES(?,?,?,?)')
          .run(u.status, labelOf[u.status] || u.status, colorOf[u.status] || '#8e8e93', colSort);
      }
      if (conn.prepare('SELECT id FROM tasks WHERE id=?').get(u.id)) {
        throw new Error('task row already exists: ' + u.id);
      }
      const sort = conn.prepare('SELECT COALESCE(MAX(sort),0)+1 AS n FROM tasks').get().n;
      conn.prepare(`INSERT INTO tasks(id,title,owner,owner_type,role,handoff,status,start,end,
        progress,placeholder,tier,billed,cost,sort,parent_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(u.id, u.title, u.owner, u.owner_type, u.milestone_id, 'from milestone-plan.json',
          u.status, at(u.start_offset_h), at(u.end_offset_h), u.progress, 0, u.tier,
          u.billed, u.cost, sort, '');
    });
  };
  writeNodeStores(plan, docs.evidence, docs.prd, sqliteApply);
  return {
    ok: true, kind: 'create-work-unit', milestone: mid, added_work_units: added,
    pair,
    note: pair ? 'a milestone owning work units needs at least 2 (PRD gate X): created the pair'
      : '',
    synced: { evidence: !!docs.evidence, prd: !!docs.prd },
  };
}

/** Resolve a work-unit status/progress patch through the plan-sync rules:
 *  vocab check, done forces 100, 100 reserves done, leaving done demands an
 *  explicit progress. Mirrors scripts/plan-sync.js --set exactly, so the
 *  state the drawer can save is always a state --check accepts. */
function resolveWStatus(cur, patch) {
  const hasStatus = Object.prototype.hasOwnProperty.call(patch, 'status');
  const hasProgress = Object.prototype.hasOwnProperty.call(patch, 'progress');
  const curStatus = String(cur.status || 'pending');
  let status = curStatus;
  if (hasStatus) {
    status = String(patch.status === undefined || patch.status === null ? '' : patch.status);
    if (PLAN_STATUSES.indexOf(status) < 0) {
      throw new Error('status must be one of ' + PLAN_STATUSES.join(' / '));
    }
  }
  let progress = Number(cur.progress || 0);
  if (status === 'done') {
    if (hasProgress && Number(patch.progress) !== 100) {
      throw new Error('progress is forced to 100 when status is done');
    }
    progress = 100;
  } else if (hasProgress) {
    const p = Number(patch.progress);
    if (!Number.isFinite(p)) throw new Error('progress must be a number in 0..100');
    if (p === 100) throw new Error('progress=100 is reserved for status done');
    if (p < 0 || p > 100) throw new Error('progress must be a number in 0..100');
    progress = p;
  } else if (hasStatus && progress === 100) {
    throw new Error('leaving done requires an explicit progress (e.g. ' + cur.id + ':' + status + ':55)');
  }
  if (progress === 100 && status !== 'done') {
    throw new Error('progress=100 is reserved for status done');
  }
  return { status, progress };
}

/** UPDATE one G/M/W node through the four-store commit. */
function structureUpdateNode(op) {
  const id = String((op && op.id) || '');
  const raw = (op && op.patch && typeof op.patch === 'object') ? op.patch : {};
  if (!id) throw new Error('update-node requires id');
  const plan = readPlanRaw();
  const goal = (plan.goals || []).filter((g) => g && String(g.id) === id)[0];
  const msNode = plan.milestones.filter((m) => String(m.id) === id)[0];
  const wu = plan.work_units.filter((w) => String(w.id) === id)[0];
  const kinds = [goal ? 'goal' : '', msNode ? 'ms' : '', wu ? 'wu' : ''].filter(Boolean);
  if (kinds.length !== 1) throw new Error('unknown node: ' + id);
  const kind = kinds[0];
  const takeStr = (v, max, label) => {
    const s = cleanText(String(v === undefined || v === null ? '' : v)).trim();
    if (!s) throw new Error(label + ' must not be empty');
    if (s.length > max) throw new Error(label + ' too long (max ' + max + ')');
    return s;
  };
  const takeNum = (v, label) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(label + ' must be a number');
    return n;
  };
  const patch = {};
  const nameRaw = raw.name !== undefined ? raw.name : raw.title;
  if (nameRaw !== undefined) {
    patch.name = takeStr(nameRaw, 120, 'name');
  }
  if (raw.owner !== undefined) {
    patch.owner = cleanText(String(raw.owner === null ? '' : raw.owner)).slice(0, 80);
  }
  if (raw.notes !== undefined) {
    patch.notes = cleanText(String(raw.notes === null ? '' : raw.notes)).slice(0, 500);
  }
  if (kind !== 'goal' && raw.status !== undefined) {
    const s = String(raw.status === undefined || raw.status === null ? '' : raw.status);
    if (PLAN_STATUSES.indexOf(s) < 0) {
      throw new Error('status must be one of ' + PLAN_STATUSES.join(' / '));
    }
    patch.status = s;
  }
  if (raw.start_offset_h !== undefined) patch.start_offset_h = takeNum(raw.start_offset_h, 'start_offset_h');
  if (raw.end_offset_h !== undefined) patch.end_offset_h = takeNum(raw.end_offset_h, 'end_offset_h');
  if (patch.start_offset_h !== undefined && patch.end_offset_h !== undefined
      && !(patch.start_offset_h < patch.end_offset_h)) {
    throw new Error('start_offset_h must be before end_offset_h');
  }
  if (kind === 'wu' && raw.cost !== undefined) {
    const c = Number(raw.cost);
    if (!Number.isFinite(c) || c < 0) throw new Error('cost must be a number >= 0');
    patch.cost = c;
  }
  let wResolved = null;
  if (kind === 'wu') {
    wResolved = resolveWStatus(wu, raw);
    patch.status = wResolved.status;
    patch.progress = wResolved.progress;
  }

  if (kind === 'goal') {
    let dirty = false;
    if (patch.name !== undefined && patch.name !== String(goal.title || '')) {
      goal.title = patch.name; dirty = true;
    }
    if (patch.owner !== undefined && patch.owner !== String(goal.owner || '')) {
      goal.owner = patch.owner; dirty = true;
    }
    if (patch.notes !== undefined && patch.notes !== String(goal.notes || '')) {
      goal.notes = patch.notes; dirty = true;
    }
    if (!dirty) return { ok: true, kind: 'update-node', id, changed: false };
  } else if (kind === 'ms') {
    let dirty = false;
    if (patch.name !== undefined && patch.name !== String(msNode.name || '')) {
      msNode.name = patch.name; dirty = true;
    }
    if (patch.owner !== undefined && patch.owner !== String(msNode.owner || '')) {
      msNode.owner = patch.owner; dirty = true;
    }
    if (patch.notes !== undefined && patch.notes !== String(msNode.notes || '')) {
      msNode.notes = patch.notes; dirty = true;
    }
    if (patch.status !== undefined && patch.status !== String(msNode.status || '')) {
      msNode.status = patch.status; dirty = true;
    }
    if (patch.start_offset_h !== undefined) { msNode.start_offset_h = patch.start_offset_h; dirty = true; }
    if (patch.end_offset_h !== undefined) { msNode.end_offset_h = patch.end_offset_h; dirty = true; }
    if (!dirty) return { ok: true, kind: 'update-node', id, changed: false };
  } else {
    let dirty = false;
    if (patch.name !== undefined && patch.name !== String(wu.title || '')) {
      wu.title = patch.name; dirty = true;
    }
    if (patch.owner !== undefined && patch.owner !== String(wu.owner || '')) {
      wu.owner = patch.owner; dirty = true;
    }
    if (patch.notes !== undefined && patch.notes !== String(wu.notes || '')) {
      wu.notes = patch.notes; dirty = true;
    }
    if (patch.status !== undefined) { wu.status = patch.status; dirty = true; }
    if (patch.progress !== undefined) { wu.progress = patch.progress; dirty = true; }
    if (patch.cost !== undefined) { wu.cost = patch.cost; dirty = true; }
    if (patch.start_offset_h !== undefined) { wu.start_offset_h = patch.start_offset_h; dirty = true; }
    if (patch.end_offset_h !== undefined) { wu.end_offset_h = patch.end_offset_h; dirty = true; }
    if (!dirty) return { ok: true, kind: 'update-node', id, changed: false };
  }

  validatePlanStructure(plan);
  const docs = prepareNodeDocs(plan);
  let sqliteApply = null;
  if (kind === 'wu') {
    const taskPatch = {};
    if (patch.name !== undefined) taskPatch.title = patch.name;
    if (patch.owner !== undefined) taskPatch.owner = patch.owner;
    if (patch.cost !== undefined) taskPatch.cost = patch.cost;
    if (patch.status !== undefined) taskPatch.status = patch.status;
    if (patch.progress !== undefined) taskPatch.progress = patch.progress;
    if (Object.keys(taskPatch).length) {
      const row = task(id);
      if (!row) throw new Error('task not found: ' + id);
      sqliteApply = () => { updateTask(id, taskPatch); };
    }
  }
  writeNodeStores(plan, docs.evidence, docs.prd, sqliteApply);
  return {
    ok: true, kind: 'update-node', id, node_kind: kind, changed: true,
    status: kind === 'goal' ? undefined : (kind === 'ms' ? msNode.status : wu.status),
    synced: { evidence: !!docs.evidence, prd: !!docs.prd, sqlite: !!sqliteApply },
  };
}

/** DELETE one node with its cascade, after listing nothing (the dialog does
 *  that client-side from the plan it already holds). Refusals that would
 *  break a gate - a milestone landing at 1 work unit, emptying a goal, the
 *  last goal or last milestone - throw BEFORE any byte or row moves. */
function structureDeleteNode(op) {
  const id = String((op && op.id) || '');
  if (!id) throw new Error('delete-node requires id');
  const plan = readPlanRaw();
  const goal = (plan.goals || []).filter((g) => g && String(g.id) === id)[0];
  const msNode = plan.milestones.filter((m) => String(m.id) === id)[0];
  const wu = plan.work_units.filter((w) => String(w.id) === id)[0];
  const kinds = [goal ? 'goal' : '', msNode ? 'ms' : '', wu ? 'wu' : ''].filter(Boolean);
  if (kinds.length !== 1) throw new Error('unknown node: ' + id);
  const kind = kinds[0];
  const removedRelations = { n: 0 };
  const removedW = [];
  const dropWorkUnit = (wid) => {
    const before = plan.work_units.length;
    plan.work_units = plan.work_units.filter((w) => String(w.id) !== wid);
    if (plan.work_units.length === before) return;
    removedW.push(wid);
    Object.keys(plan.sub_lines || {}).forEach((k) => {
      const arr = plan.sub_lines[k];
      if (Array.isArray(arr)) plan.sub_lines[k] = arr.filter((x) => String(x) !== wid);
    });
    const relBefore = (plan.relations || []).length;
    plan.relations = (plan.relations || [])
      .filter((r) => String(r.from) !== wid && String(r.to) !== wid);
    removedRelations.n += relBefore - plan.relations.length;
  };
  const dropMilestone = (mid) => {
    plan.milestones = plan.milestones.filter((m) => String(m.id) !== mid);
    plan.main_line = (plan.main_line || []).filter((x) => String(x) !== mid);
    delete plan.sub_lines[mid];
    plan.milestones.forEach((m) => {
      const d = m.depends_on;
      if (Array.isArray(d)) {
        const hit = d.map(String).indexOf(mid) >= 0;
        if (hit) m.depends_on = d.map(String).filter((x) => x !== mid);
      } else if (d) {
        const parts = String(d).split(/[,;\s]+/).filter(Boolean);
        if (parts.indexOf(mid) >= 0) m.depends_on = parts.filter((x) => x !== mid).join(', ');
      }
    });
    (plan.goals || []).forEach((g) => {
      if (Array.isArray(g.milestone_ids)) {
        g.milestone_ids = g.milestone_ids.map(String).filter((x) => x !== mid);
      }
    });
    const wids = plan.work_units
      .filter((w) => String(w.milestone_id) === mid).map((w) => String(w.id));
    wids.forEach(dropWorkUnit);
  };

  if (kind === 'goal') {
    if ((plan.goals || []).length <= 1) {
      throw new Error('refusing to delete the last goal while milestones remain');
    }
    const mids = (Array.isArray(goal.milestone_ids) ? goal.milestone_ids : []).map(String);
    plan.goals = plan.goals.filter((g) => g !== goal);
    mids.forEach(dropMilestone);
  } else if (kind === 'ms') {
    const fromG = (plan.goals || []).filter((g) => Array.isArray(g.milestone_ids)
      && g.milestone_ids.map(String).indexOf(id) >= 0)[0];
    if (fromG && fromG.milestone_ids.length <= 1) {
      throw new Error('refusing to empty goal ' + String(fromG.id) + ' (delete the goal itself instead)');
    }
    if (plan.milestones.length <= 1) throw new Error('refusing to delete the last milestone');
    dropMilestone(id);
  } else {
    const mid = String(wu.milestone_id || '');
    const ownedAfter = plan.work_units
      .filter((w) => String(w.milestone_id) === mid && String(w.id) !== id).length;
    if (ownedAfter === 1) {
      throw new Error(mid + ' would keep 1 work unit; PRD gate X needs 0 or at least 2'
        + ' (delete the milestone to cascade both, or add another unit first)');
    }
    dropWorkUnit(id);
  }

  validatePlanStructure(plan);
  const docs = prepareNodeDocs(plan);
  const sqliteApply = removedW.length
    ? (conn) => {
      void conn;
      removedW.forEach((wid) => { deleteTask(wid); });
    }
    : null;
  writeNodeStores(plan, docs.evidence, docs.prd, sqliteApply);
  return {
    ok: true, kind: 'delete-node', id, node_kind: kind,
    removed_work_units: removedW.slice(),
    removed_relations: removedRelations.n,
    synced: { evidence: !!docs.evidence, prd: !!docs.prd, sqlite: !!sqliteApply },
  };
}

/** One door for every structure write: move | apply-template |
 *  create-milestone | create-work-unit | update-node | delete-node. Unknown
 *  ops and every validation failure throw (server -> 400) before any store
 *  is written. */
function planStructureUpdate(op) {
  const kind = String((op && op.kind) || '');
  if (DEGRADED) return readOnly({ ok: false, kind, op: 'planStructureUpdate' });
  if (kind === 'move') return structureMove(op);
  if (kind === 'apply-template') return structureApply(op);
  if (kind === 'create-milestone') return structureCreateMilestone(op);
  if (kind === 'create-work-unit') return structureCreateWorkUnit(op);
  if (kind === 'update-node') return structureUpdateNode(op);
  if (kind === 'delete-node') return structureDeleteNode(op);
  throw new Error('unknown structure op: ' + (kind || '(empty)')
    + ' (allowed: move, apply-template, create-milestone, create-work-unit, update-node, delete-node)');
}

/** Idempotent boot seed: INSERT OR IGNORE keeps saved templates intact. */
function seedTemplates() {
  if (DEGRADED) return;
  const ins = db.prepare(`INSERT OR IGNORE INTO wbs_templates
    (id, name, provenance, kind, payload, created) VALUES(?,?,?,?,?,?)`);
  const created = iso(new Date());
  BUILTIN_TEMPLATES.forEach((t) => {
    ins.run(t.id, t.name, TEMPLATE_PROVENANCE, 'builtin',
      JSON.stringify({ milestones: t.milestones }), created);
  });
}

/** GET /api/templates: built-ins first (kind, name), then saved subtrees. */
function listTemplates() {
  if (DEGRADED) return { templates: [] };
  const rows = db.prepare(
    'SELECT id, name, provenance, kind, created, payload FROM wbs_templates ORDER BY kind, name, id',
  ).all();
  return {
    templates: rows.map((r) => {
      let payload = {};
      try { payload = JSON.parse(r.payload); } catch (_e) { payload = {}; }
      const ms = payload && Array.isArray(payload.milestones) ? payload.milestones : [];
      return {
        id: String(r.id), name: String(r.name), provenance: String(r.provenance),
        kind: String(r.kind), created: String(r.created),
        n_milestones: ms.length,
        n_work_units: ms.reduce((a, m) => a + (m && Array.isArray(m.work_units) ? m.work_units.length : 0), 0),
      };
    }),
  };
}

/** POST /api/templates: save the plan subtree at source_node (G or M row)
 *  as a named template. Additive row only - the plan file is not touched. */
function saveTemplate(input) {
  const name = String((input && input.name) || '').trim();
  const src = String((input && input.source_node) || '').trim();
  if (DEGRADED) return readOnly({ id: '', name, source_node: src });
  if (!name) throw new Error('template name required');
  if (name.length > 60) throw new Error('template name too long (max 60)');
  if (!src) throw new Error('source_node required');
  const plan = readPlanRaw();
  const goal = (plan.goals || []).filter((g) => g && String(g.id) === src)[0];
  const ms = plan.milestones.filter((m) => String(m.id) === src)[0];
  if (!goal && !ms) throw new Error('unknown source node: ' + src);
  const milestones = [];
  if (goal) {
    (Array.isArray(goal.milestone_ids) ? goal.milestone_ids : []).forEach((mid) => {
      const m = plan.milestones.filter((x) => String(x.id) === String(mid))[0];
      if (!m) return;
      milestones.push({
        name: String(m.name || m.id),
        work_units: wuSeqOf(plan, String(m.id)).map((wid) => {
          const w = plan.work_units.filter((x) => String(x.id) === wid)[0];
          return { title: String((w && w.title) || wid) };
        }),
      });
    });
  } else {
    milestones.push({
      name: String(ms.name || ms.id),
      work_units: wuSeqOf(plan, String(ms.id)).map((wid) => {
        const w = plan.work_units.filter((x) => String(x.id) === wid)[0];
        return { title: String((w && w.title) || wid) };
      }),
    });
  }
  if (!milestones.length) throw new Error('source subtree has no milestones to save');
  const id = 'tpl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const provenance = 'saved from plan subtree ' + src;
  const created = iso(new Date());
  db.prepare(`INSERT INTO wbs_templates(id,name,provenance,kind,payload,created)
    VALUES(?,?,?,?,?,?)`).run(id, name, provenance, 'saved', JSON.stringify({ milestones }), created);
  return {
    id, name, provenance, kind: 'saved', created,
    n_milestones: milestones.length,
    n_work_units: milestones.reduce((a, m) => a + m.work_units.length, 0),
  };
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
  /* I-019 desk log: one ack/send event per ACK created. */
  logDeskEvent('ack', 'send', (hash + ' ' + command).trim().slice(0, 160));
  return db.prepare('SELECT * FROM acks WHERE id=?').get(id);
}

function updateAck(id, patch) {
  if (DEGRADED) return readOnly({ id });
  const cur = db.prepare('SELECT * FROM acks WHERE id=?').get(id);
  if (!cur) throw new Error('ack not found: ' + id);
  const action = String(patch.action || '');
  /* C9 B1: callers may request the target state directly (state: 'REJECTED')
     or use the original action verb (action: 'reject'). Both paths converge on
     the same locked rule: a REJECTED decision REQUIRES a written reason. */
  const requested = String(patch.state || '').toUpperCase();
  const rawReason = patch.reason === undefined ? patch.reject_reason : patch.reason;
  const isReject = action === 'reject' || requested === 'REJECTED';
  let nextState = cur.state;
  let reason = cur.reject_reason;
  if (isReject) {
    if (!rawReason || !String(rawReason).trim()) throw new Error('reject requires a reason');
    nextState = 'REJECTED';
    reason = String(rawReason).trim();
  } else if (action === 'approve' || requested === 'IN_PROGRESS') {
    nextState = 'IN_PROGRESS';
  } else if (action === 'done' || requested === 'DONE') {
    nextState = 'DONE';
  } else {
    throw new Error('unknown ack action: ' + (action || requested));
  }
  const now = iso(new Date());
  db.prepare('UPDATE acks SET state=?, reject_reason=?, updated=? WHERE id=?').run(nextState, reason, now, id);
  const row = db.prepare('SELECT * FROM acks WHERE id=?').get(id);
  if (isReject) writeRejection(row);
  /* I-019 desk log: one event per real decision change. A repeated identical
     action (double-click) resolves to the same state/reason and logs once;
     approved->kind 'approved', DONE->'done', REJECTED->'rejected' + reason. */
  if (nextState !== cur.state || reason !== cur.reject_reason) {
    const kind = nextState === 'REJECTED' ? 'rejected' : (nextState === 'DONE' ? 'done' : 'approved');
    logDeskEvent('ack', kind, nextState === 'REJECTED' ? reason : nextState);
  }
  return row;
}

/* ---- I-019 desk event history (queryable desk sheets) --------------------
 * One append-only stream behind the four Command desk sheets. The four units
 * are the desk sheets themselves; the API surface is GET/POST /api/events.
 * Hooks above funnel through logDeskEvent, which keeps the contract rule
 * "detail must not be empty" from ever failing a host write.
 * ------------------------------------------------------------------------ */
const EVENT_UNITS = ['command', 'ack', 'signal', 'job'];

/**
 * Queryable history per the frozen /api/events contract: optional exact unit
 * filter, optional case-insensitive substring match on detail, result capped
 * by limit (default 200, clamped 1..500), sorted ts DESC, id DESC.
 */
function listEvents(opts) {
  const o = opts || {};
  if (DEGRADED) return [];
  const unit = o.unit === undefined || o.unit === null ? '' : String(o.unit);
  if (unit && EVENT_UNITS.indexOf(unit) < 0) {
    throw new Error('unknown event unit: ' + (unit || '(empty)') + ' (allowed: ' + EVENT_UNITS.join(', ') + ')');
  }
  const q = String(o.q === undefined || o.q === null ? '' : o.q).toLowerCase();
  let limit = 200;
  if (o.limit !== undefined && o.limit !== null && o.limit !== '') {
    const n = Number(o.limit);
    if (Number.isFinite(n)) limit = Math.min(500, Math.max(1, Math.floor(n)));
  }
  /* q matching is case-insensitive on detail, so it runs in JS; the LIMIT is
     an over-fetch bound and the real cap is the slice after q, per contract. */
  const rows = db.prepare('SELECT * FROM desk_events ORDER BY ts DESC, id DESC LIMIT 5000').all();
  return rows
    .filter((r) => (!unit || r.unit === unit) && (!q || r.detail.toLowerCase().indexOf(q) >= 0))
    .slice(0, limit);
}

/** Append one desk event. Validates like the POST contract: unit must be one
 *  of command | ack | signal | job, kind non-empty after trim, detail trimmed,
 *  capped to 500 chars and non-empty - otherwise throw. */
function createEvent(input) {
  const i = input || {};
  if (DEGRADED) return readOnly({ id: 'demo_readonly', unit: String(i.unit || ''), kind: String(i.kind || ''), detail: String(i.detail || '') });
  const unit = i.unit === undefined || i.unit === null ? '' : String(i.unit);
  if (EVENT_UNITS.indexOf(unit) < 0) {
    throw new Error('unknown event unit: ' + (unit || '(empty)') + ' (allowed: ' + EVENT_UNITS.join(', ') + ')');
  }
  const kind = (i.kind === undefined || i.kind === null ? '' : String(i.kind)).trim();
  if (!kind) throw new Error('event kind must not be empty');
  const detail = (i.detail === undefined || i.detail === null ? '' : String(i.detail)).trim().slice(0, 500);
  if (!detail) throw new Error('event detail must not be empty');
  const id = 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const ts = iso(new Date());
  db.prepare('INSERT INTO desk_events(id,ts,unit,kind,detail) VALUES(?,?,?,?,?)').run(id, ts, unit, kind, detail);
  return { id, ts, unit, kind, detail };
}

/** Best-effort hook logger: the contract forbids an empty detail, so an empty
 *  computed detail is skipped instead of throwing inside a host write. */
function logDeskEvent(unit, kind, detail) {
  const d = String(detail === undefined || detail === null ? '' : detail).trim();
  if (!d) return null;
  return createEvent({ unit, kind, detail: d });
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
  const text = lines.join('\n');
  /* I-019 desk log: generating a snapshot is a user intent act - one
     command/generate event per call. */
  logDeskEvent('command', 'generate', String(text).replace(/\s+/g, ' ').slice(0, 120));
  return { text };
}

function degradedInfo() {
  return { degraded: DEGRADED, reason: DEGRADED_REASON, demo: DEMO };
}

if (!DEGRADED) {
  seed();
  importAll();
  seedPolicy();
  seedTemplates();
} else {
  MEM = buildMemory();
}

module.exports = {
  db, state, task, updateTask, createTask, deleteTask,
  createColumn, updateColumn, deleteColumn, moveColumn,
  updateIssue, upsertIssue, setCommand, setCharter, snapshot, importHandoff, importAll,
  plan: readPlan,
  planStructureUpdate, listTemplates, saveTemplate,
  createAck, listAcks, updateAck, backup, restore, degradedInfo,
  listTaskDeps, setTaskDep, deleteTaskDep, snapshotBaseline,
  listApprovals, listOwnerScopes,
  listEvents, createEvent, taskAudit,
  DEMO, DEGRADED, DEGRADED_REASON,
};
