#!/usr/bin/env node
/**
 * BACKGROUND: Milestone and work-unit status lives in three stores that are
 * supposed to agree: docs/PRD.md (### M<N>: blocks with one "- Status:" line),
 * docs/evidence/milestones.json (milestones[].status) and
 * assets/linked-gantt-board/data/milestone-plan.json (milestones[].status and
 * work_units[].status plus progress). Before this script there was NO
 * write-back path after a PDCA round proved the work complete (audit issue
 * I-017), so the gantt kept showing stale in_progress, and nothing checked
 * that the three stores agree. This is the missing PDCA-to-plan write-back
 * path: run it from the Act step of a PDCA entry, with the evidence that
 * justifies each flip. A fourth layer sat disconnected from these three: the
 * SQLite panel database (data/panel.db) owns the task rows behind the Board
 * and Gantt pages while the plan behind the Milestone page never reached
 * them (audit issue I-018). The fix unifies the id space instead of mapping
 * ids: --seed-tasks materializes every plan work unit as a task row that
 * keeps its W id (and every plan relation as a task_deps row), so plan and
 * live layer share one id space and status can travel both ways by id.
 * CONDITIONS: Node >= 18, standard library only (fs, path). No network, no npm
 * deps, no Chrome. ROOT is derived from __dirname, so it runs from any cwd.
 * Every SQLite touch point guards with fs.existsSync(data/panel.db) BEFORE
 * requiring assets/linked-gantt-board/db.js, because requiring that module
 * CREATES panel.db as a module side effect. panel.db is transient
 * (scripts/verify.js deletes panel.db* around every run), so an absent file
 * is an expected three-state SKIP, never a failure; only --seed-tasks may
 * materialize it. db.js does not export at(), so the hour-offset to
 * hour-truncated local ISO conversion is inlined here as a mirror.
 * Modes plus help:
 *   --check (also the default when no arguments): for every milestone id in
 *   milestone-plan.json compare the status in all three stores and require
 *   equality inside the allowed set; for every work unit require status inside
 *   the allowed set, progress numeric 0..100, and progress === 100 exactly
 *   when status === 'done'; require exactly one "- Status:" line per PRD
 *   milestone block and no orphan Status lines. Prints one line per check,
 *   summary "PLAN-SYNC CHECK: <passed>/<total> passed", exit 0 when all pass,
 *   2 on any FAIL. When panel.db exists a SQLite coherence section follows:
 *   every plan work unit id must have a task row with the same status and
 *   every plan relation must match a task_deps row (from, to, type, lag
 *   equal). When panel.db is absent exactly one "SKIP  SQLite coherence" line
 *   prints and the exit code is decided by the file-level checks alone (the
 *   skip is not a failure and not counted in the summary).
 *   --set <ID:status[:progress]>[,<ID:status[:progress]>...] writes status
 *   back. Accepted forms: "node scripts/plan-sync.js --set M4:done", repeated
 *   flags "--set M4:done --set W10:done", comma form "--set M4:done,W10:done",
 *   and space-separated pairs after one --set; all forms may be mixed and
 *   pairs are applied in order. ID is M<N> (milestone: rewrites the PRD.md
 *   Status line plus milestones.json and milestone-plan.json) or W<N> (work
 *   unit: rewrites milestone-plan.json work_units[] only). The optional third
 *   field <progress> is an integer 0..100 and is W<N>-only (a third field on
 *   an M<N> id is an error). W<N> progress resolution is deterministic:
 *   status 'done' forces progress to 100 (a third field other than 100 is an
 *   error); a non-done status WITH a third field sets progress to it (100 is
 *   rejected as reserved for done, values outside 0..100 are rejected); a
 *   non-done status WITHOUT a third field leaves progress untouched when it
 *   is below 100 and REFUSES when it is 100, because leaving done demands an
 *   explicit progress (e.g. W11:in_progress:55). For W<N> ids the new status
 *   also propagates to the SQLite task row of the same id when panel.db
 *   exists and that row is seeded (the resolved progress travels with it
 *   when there is one, explicit or forced), so status travels both ways by
 *   id. Status must be one of pending / in_progress / done / skipped; any
 *   other value, an unknown id, or a progress rule violation exits 1 with
 *   nothing written (all pairs are validated before the first write). JSON
 *   writes preserve 2-space indent and a trailing newline. After writing,
 *   the --check suite runs automatically and the process exits with its code
 *   (0 or 2).
 *   --seed-tasks upserts every plan work unit as a SQLite task row keeping
 *   its W id (INSERT OR REPLACE, idempotent; role carries the milestone id,
 *   handoff is the literal 'from milestone-plan.json', sort is the plan order
 *   index, billed is stored in micro-units like demo-seed: billed*1e6, cost
 *   as-is) and every plan relation as a task_deps row. It materializes panel.db
 *   (that is this mode's whole job); the demo t* and p* rows are never
 *   touched.
 *   Each status a work unit carries gets a columns row keyed by the status
 *   itself so the board (task.status === column.id) can render it; 'skipped'
 *   is never coerced to 'done'. DEGRADED (node:sqlite unavailable) exits 1
 *   with the reason.
 *   --help prints usage and exits 0. --check, --set and --seed-tasks cannot
 *   be combined.
 * Every check prints "PASS  <label> :: <evidence>" or "FAIL  <label> ::
 * <evidence>"; a FAIL names the divergent store(s) and/or the broken rule.
 * VERSION: 1.1.1 - --set accepts <ID>:<status>:<progress>; leaving done
 * demands explicit progress (progress=100 reserved for done).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const P_PRD = path.join(ROOT, 'docs', 'PRD.md');
const P_MS = path.join(ROOT, 'docs', 'evidence', 'milestones.json');
const P_PLAN = path.join(ROOT, 'assets', 'linked-gantt-board', 'data', 'milestone-plan.json');
const P_DB = path.join(ROOT, 'assets', 'linked-gantt-board', 'data', 'panel.db');
const DBJS = path.join(ROOT, 'assets', 'linked-gantt-board', 'db.js');
const STATUSES = ['pending', 'in_progress', 'done', 'skipped'];
const USAGE = [
  'usage: node scripts/plan-sync.js [--check]',
  '       node scripts/plan-sync.js --set <ID:status[:progress]>[,<ID:status[:progress]>...] [--set ...]',
  '       node scripts/plan-sync.js --seed-tasks',
  '       node scripts/plan-sync.js --help',
  'IDs:  M<N> milestone -> writes docs/PRD.md + docs/evidence/milestones.json +',
  '      assets/linked-gantt-board/data/milestone-plan.json',
  '      W<N> work unit  -> writes milestone-plan.json work_units[] only',
  '      optional :<progress> (integer 0..100) is W<N>-only; M<N> rejects it',
  "      status 'done' forces progress to 100 (any other :<progress> errors);",
  '      non-done with :<progress> sets it (100 is reserved for status done,',
  '      values outside 0..100 error); non-done without :<progress> leaves',
  '      progress untouched below 100, but when it is 100 the pair must carry',
  '      an explicit :<progress> (leaving done, e.g. W11:in_progress:55)',
  '      plus, when panel.db exists and the W task row is seeded, propagates',
  '      status and the resolved progress to that task row',
  "status: 'pending' | 'in_progress' | 'done' | 'skipped'",
  '--seed-tasks  upserts plan work_units as SQLite task rows keeping their W',
  '      ids and plan relations as task_deps rows (idempotent; materializes',
  '      panel.db when absent; demo t*/p* rows are never touched)',
  '--check also runs a SQLite coherence section when panel.db exists (one',
  '      PASS/FAIL line per W id plus one relations summary line) and prints',
  '      exactly one SKIP line when panel.db is absent (transient runtime',
  '      state; not a failure)'
].join('\n');

function readStores() {
  const prd = fs.readFileSync(P_PRD, 'utf8');
  const ms = JSON.parse(fs.readFileSync(P_MS, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(P_PLAN, 'utf8'));
  return { prd, ms, plan };
}

function prdScan(text) {
  const eol = text.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const blocks = [];
  const orphanStatus = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^###\s+(M\d+):/);
    if (h) {
      cur = { id: h[1], status: [] };
      blocks.push(cur);
      continue;
    }
    if (/^##\s/.test(lines[i])) { cur = null; continue; }
    const f = lines[i].match(/^-\s*Status:\s*(.*)$/);
    if (f) {
      if (cur) cur.status.push({ idx: i, value: f[1].trim() });
      else orphanStatus.push(i + 1);
    }
  }
  return { eol, lines, blocks, orphanStatus };
}

function fmt(v) { return v === undefined || v === null ? 'MISSING' : String(v); }

function checkMilestones(prdScanRes, ms, plan, results) {
  const blockOf = {};
  prdScanRes.blocks.forEach((b) => { blockOf[b.id] = b; });
  const msOf = {};
  (ms.milestones || []).forEach((m) => { msOf[m.id] = m; });
  for (const m of (plan.milestones || [])) {
    const b = blockOf[m.id];
    const pv = b && b.status.length ? b.status[0].value : 'MISSING';
    const mv = msOf[m.id] ? msOf[m.id].status : 'MISSING';
    const sv = m.status;
    const reasons = [];
    if (pv !== sv || mv !== sv) {
      const divergent = [];
      if (pv !== sv) divergent.push('prd');
      if (mv !== sv) divergent.push('ms');
      if (sv === undefined) divergent.push('plan');
      reasons.push('divergent: ' + divergent.join(','));
    }
    for (const v of [pv, mv, sv]) {
      if (v !== 'MISSING' && STATUSES.indexOf(v) === -1) {
        reasons.push('value outside allowed set: ' + v);
      }
    }
    const ok = reasons.length === 0;
    results.push({
      ok,
      line: (ok ? 'PASS  ' : 'FAIL  ') + m.id + ' status :: prd=' + pv +
        ' ms=' + mv + ' plan=' + fmt(sv) + (ok ? '' : ' :: ' + reasons.join('; '))
    });
  }
}

function checkWorkUnits(plan, results) {
  for (const w of (plan.work_units || [])) {
    const reasons = [];
    const s = w.status;
    const p = w.progress;
    if (STATUSES.indexOf(s) === -1) reasons.push('status outside allowed set: ' + fmt(s));
    if (!(typeof p === 'number' && isFinite(p) && p >= 0 && p <= 100)) {
      reasons.push('progress not numeric 0..100: ' + fmt(p));
    }
    if (s === 'done' && p !== 100) reasons.push('done requires progress=100');
    if (p === 100 && s !== 'done') reasons.push('progress=100 requires status=done');
    const ok = reasons.length === 0;
    results.push({
      ok,
      line: (ok ? 'PASS  ' : 'FAIL  ') + w.id + ' status/progress :: status=' +
        fmt(s) + ' progress=' + fmt(p) + (ok ? '' : ' :: ' + reasons.join('; '))
    });
  }
}

function checkPrdShape(prdScanRes, plan, results) {
  const reasons = [];
  for (const b of prdScanRes.blocks) {
    if (b.status.length !== 1) {
      reasons.push(b.id + ' has ' + b.status.length + ' Status lines (want 1)');
    }
  }
  if (prdScanRes.orphanStatus.length) {
    reasons.push('orphan Status lines outside milestone blocks at line(s) ' +
      prdScanRes.orphanStatus.join(','));
  }
  const planIds = (plan.milestones || []).map((m) => m.id);
  const blockIds = prdScanRes.blocks.map((b) => b.id);
  for (const id of planIds) if (blockIds.indexOf(id) === -1) reasons.push('no PRD block for ' + id);
  for (const id of blockIds) if (planIds.indexOf(id) === -1) reasons.push('orphan PRD block ' + id);
  const ok = reasons.length === 0;
  results.push({
    ok,
    line: (ok ? 'PASS  ' : 'FAIL  ') + 'PRD Status lines :: ' + blockIds.length +
      ' blocks, ' + (ok ? 'exactly one Status line each, no orphans' : reasons.join('; '))
  });
}

/* mirror of db.js at(): hour offset -> local hour-truncated ISO timestamp
 * (base = now truncated to the hour + deltaHours * 3600000) */
function at(deltaHours) {
  const p2 = (n) => String(n).padStart(2, '0');
  const base = new Date();
  base.setMinutes(0, 0, 0);
  const d = new Date(base.getTime() + deltaHours * 3600000);
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
    'T' + p2(d.getHours()) + ':00';
}

/* crib: scripts/issue.js mirrorSQLite - guard on fs.existsSync(P_DB) BEFORE
 * require(DBJS), because requiring db.js CREATES panel.db as a side effect. */
function loadStore() {
  return require(DBJS);
}

function checkSqliteCoherence(plan) {
  const skip = (text) => ({ results: [], skip: text });
  if (!fs.existsSync(P_DB)) {
    return skip('SKIP  SQLite coherence :: no panel.db (transient runtime state; run --seed-tasks when the panel is up)');
  }
  let store;
  try { store = loadStore(); }
  catch (e) {
    return skip('SKIP  SQLite coherence :: cannot load db.js: ' + e.message);
  }
  if (store.DEGRADED) {
    return skip('SKIP  SQLite coherence :: DEGRADED: ' + store.DEGRADED_REASON);
  }
  const results = [];
  for (const w of (plan.work_units || [])) {
    const t = store.task(w.id);
    if (!t) {
      results.push({
        ok: false,
        line: 'FAIL  ' + w.id + ' seed :: no task row (run: node scripts/plan-sync.js --seed-tasks)'
      });
    } else if (t.status !== w.status) {
      results.push({
        ok: false,
        line: 'FAIL  ' + w.id + ' coherence :: plan=' + w.status + ' task=' + t.status
      });
    } else {
      results.push({
        ok: true,
        line: 'PASS  ' + w.id + ' coherence :: plan=' + w.status + ' task=' + t.status
      });
    }
  }
  const deps = store.listTaskDeps();
  const rels = plan.relations || [];
  let matched = 0;
  const bad = [];
  for (const r of rels) {
    const wantType = String(r.type || 'FS').toUpperCase();
    const wantLag = Math.round(Number(r.lag) || 0);
    const d = deps.filter((x) => x.from === r.from && x.to === r.to)[0];
    if (d && d.type === wantType && Number(d.lag) === wantLag) matched += 1;
    else bad.push(r.from + '>' + r.to);
  }
  const ok = matched === rels.length;
  results.push({
    ok,
    line: (ok ? 'PASS  ' : 'FAIL  ') + 'relations coherence :: ' + matched + '/' + rels.length +
      ' plan relations match task_deps' + (ok ? '' : ' :: mismatched: ' + bad.join(','))
  });
  return { results, skip: null };
}

function runCheck() {
  let stores;
  try { stores = readStores(); }
  catch (e) {
    console.log('FAIL  load :: ' + e.message);
    console.log('PLAN-SYNC CHECK: 0/1 passed');
    return 2;
  }
  const scan = prdScan(stores.prd);
  const results = [];
  checkMilestones(scan, stores.ms, stores.plan, results);
  checkWorkUnits(stores.plan, results);
  checkPrdShape(scan, stores.plan, results);
  const sq = checkSqliteCoherence(stores.plan);
  for (const r of sq.results) results.push(r);
  let passed = 0;
  for (const r of results) {
    console.log(r.line);
    if (r.ok) passed += 1;
  }
  if (sq.skip) console.log(sq.skip);
  console.log('PLAN-SYNC CHECK: ' + passed + '/' + results.length + ' passed');
  return passed === results.length ? 0 : 2;
}

function runSeedTasks() {
  let plan;
  try { plan = JSON.parse(fs.readFileSync(P_PLAN, 'utf8')); }
  catch (e) {
    console.error('FAIL  seed tasks :: cannot read milestone-plan.json: ' + e.message);
    return 1;
  }
  /* Creating panel.db is this mode's whole job, so no existsSync guard here. */
  const store = loadStore();
  if (store.DEGRADED) {
    console.log('FAIL  seed tasks :: DEGRADED: ' + store.DEGRADED_REASON);
    return 1;
  }
  const db = store.db;
  const units = plan.work_units || [];
  const rels = plan.relations || [];

  /* The board maps tasks to columns by task.status === column.id, so each
   * status needs a columns row whose id IS the status. createColumn generates
   * random c_ ids and cannot set one; rows are inserted exactly the way
   * db.js seed() inserts the demo vocabulary. */
  const labelOf = { pending: 'Pending', in_progress: 'In Progress', done: 'Done', skipped: 'Skipped' };
  const colorOf = { pending: '#8e8e93', in_progress: '#0071e3', done: '#34c759', skipped: '#ff9500' };
  const seen = [];
  for (const w of units) {
    if (STATUSES.indexOf(w.status) === -1) {
      console.error('FAIL  seed tasks :: ' + w.id + ' has status outside allowed set: ' + fmt(w.status));
      return 1;
    }
    if (seen.indexOf(w.status) === -1) seen.push(w.status);
  }
  let colsCreated = 0;
  for (const s of seen) {
    if (!db.prepare('SELECT id FROM columns WHERE id=?').get(s)) {
      const sort = db.prepare('SELECT COALESCE(MAX(sort),0)+1 AS n FROM columns').get().n;
      db.prepare('INSERT INTO columns(id,label,color,sort) VALUES(?,?,?,?)')
        .run(s, labelOf[s] || s, colorOf[s] || '#8e8e93', sort);
      colsCreated += 1;
    }
  }
  console.log('PASS  seed columns :: ' + seen.length + ' ensured (' + colsCreated + ' created)');

  const demoBefore = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE id NOT LIKE 'W%'").get().n;
  let created = 0, updated = 0;
  const ins = db.prepare(`INSERT OR REPLACE INTO tasks
    (id,title,owner,owner_type,role,handoff,status,start,end,progress,placeholder,tier,billed,cost,sort,parent_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  units.forEach((w, i) => {
    const existed = !!db.prepare('SELECT id FROM tasks WHERE id=?').get(w.id);
    ins.run(
      w.id, String(w.title || ''), String(w.owner || ''), String(w.owner_type || 'main'),
      String(w.milestone_id || ''), 'from milestone-plan.json', w.status,
      at(w.start_offset_h), at(w.end_offset_h), Number(w.progress || 0), 0,
      String(w.tier || 'S'), Number(w.billed || 0) * 1e6, Number(w.cost || 0), i, ''
    );
    if (existed) updated += 1; else created += 1;
  });
  console.log('PASS  seed tasks :: ' + units.length + ' upserted (' + created + ' created, ' + updated + ' updated)');

  const insDep = db.prepare('INSERT OR REPLACE INTO task_deps(from_id,to_id,type,lag) VALUES(?,?,?,?)');
  for (const r of rels) {
    insDep.run(r.from, r.to, String(r.type || 'FS').toUpperCase(), Math.round(Number(r.lag) || 0));
  }
  console.log('PASS  seed relations :: ' + rels.length + ' upserted');

  const demoAfter = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE id NOT LIKE 'W%'").get().n;
  if (demoAfter !== demoBefore) {
    console.log('FAIL  seed demo rows :: ' + demoBefore + ' -> ' + demoAfter);
    return 1;
  }
  console.log('PASS  seed demo rows :: ' + demoAfter + ' untouched');
  console.log('PLAN-SYNC SEED-TASKS: ' + units.length + ' tasks (' + created + ' created, ' +
    updated + ' updated), ' + rels.length + ' relations, ' + demoAfter + ' demo rows untouched');
  return 0;
}

function parsePairs(tokens) {
  const pairs = [];
  for (const t of tokens) {
    for (const piece of t.split(',')) {
      const trimmed = piece.trim();
      if (!trimmed) continue;
      const m = trimmed.match(/^(M\d+|W\d+):([A-Za-z_]+)(?::(\d+))?$/);
      if (!m) {
        console.error('invalid pair: ' + trimmed +
          ' (expected <ID>:<status>[:<progress>], e.g. W11:in_progress:55)');
        return null;
      }
      pairs.push({
        id: m[1],
        status: m[2],
        progress: m[3] === undefined ? undefined : Number(m[3])
      });
    }
  }
  return pairs;
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function propagateToTask(p) {
  const label = 'propagate ' + p.id + ' -> task ' + p.id;
  if (!fs.existsSync(P_DB)) {
    console.log('SKIP  ' + label + ' :: no panel.db');
    return;
  }
  let store;
  try { store = loadStore(); }
  catch (e) {
    console.log('SKIP  ' + label + ' :: cannot load db.js: ' + e.message);
    return;
  }
  if (store.DEGRADED) {
    console.log('SKIP  ' + label + ' :: DEGRADED: ' + store.DEGRADED_REASON);
    return;
  }
  if (!store.task(p.id)) {
    console.log('SKIP  ' + label + ' :: task not seeded');
    return;
  }
  const patch = { status: p.status };
  if (p.progress !== undefined) patch.progress = p.progress;
  store.updateTask(p.id, patch);
  console.log('PASS  ' + label + ' :: status=' + p.status +
    (p.progress === undefined ? '' : ' progress=' + p.progress));
}

function runSet(tokens) {
  const pairs = parsePairs(tokens);
  if (!pairs) return 1;
  if (!pairs.length) {
    console.error('--set requires at least one <ID:status[:progress]> pair');
    console.error(USAGE);
    return 1;
  }
  for (const p of pairs) {
    if (STATUSES.indexOf(p.status) === -1) {
      console.error('invalid status: ' + p.status +
        " (allowed values: 'pending', 'in_progress', 'done', 'skipped')");
      return 1;
    }
  }
  let stores;
  try { stores = readStores(); }
  catch (e) {
    console.error('load failed: ' + e.message);
    return 1;
  }
  const scan = prdScan(stores.prd);
  const blockOf = {};
  scan.blocks.forEach((b) => { blockOf[b.id] = b; });
  const msOf = {};
  (stores.ms.milestones || []).forEach((m) => { msOf[m.id] = m; });
  const wOf = {};
  (stores.plan.work_units || []).forEach((w) => { wOf[w.id] = w; });

  for (const p of pairs) {
    if (p.id.charAt(0) === 'M') {
      if (!msOf[p.id] || !blockOf[p.id]) {
        console.error('unknown id: ' + p.id);
        return 1;
      }
    } else {
      if (!wOf[p.id]) {
        console.error('unknown id: ' + p.id);
        return 1;
      }
    }
  }

  /* Resolve the W progress outcome for every pair BEFORE the first write:
   * done forces 100, explicit progress must respect the 0..100 range and the
   * progress=100<->done invariant, and leaving done (progress currently 100)
   * without an explicit progress is refused. M ids never carry progress. */
  for (const p of pairs) {
    if (p.id.charAt(0) === 'M') {
      if (p.progress !== undefined) {
        console.error(p.id + ': progress is only valid for W ids');
        return 1;
      }
    } else if (p.status === 'done') {
      if (p.progress !== undefined && p.progress !== 100) {
        console.error(p.id + ': progress is forced to 100 when status is done' +
          ' (got ' + p.progress + ')');
        return 1;
      }
      p.progress = 100;
    } else if (p.progress !== undefined) {
      if (p.progress === 100) {
        console.error(p.id + ': progress=100 is reserved for status done');
        return 1;
      }
      if (p.progress < 0 || p.progress > 100) {
        console.error(p.id + ': progress=' + p.progress + ' outside range 0..100');
        return 1;
      }
    } else if (wOf[p.id].progress === 100) {
      console.error(p.id + ': leaving done requires an explicit progress (e.g. ' +
        p.id + ':' + p.status + ':55); progress=100 is reserved for done');
      return 1;
    }
  }

  let prdTouched = false, msTouched = false, planTouched = false;
  for (const p of pairs) {
    if (p.id.charAt(0) === 'M') {
      const b = blockOf[p.id];
      if (b.status.length === 1) {
        scan.lines[b.status[0].idx] = '- Status: ' + p.status;
      } else {
        console.error('cannot write ' + p.id + ': PRD block has ' + b.status.length + ' Status lines');
        return 1;
      }
      msOf[p.id].status = p.status;
      const pm = (stores.plan.milestones || []).filter((m) => m.id === p.id)[0];
      if (!pm) {
        console.error('unknown id: ' + p.id);
        return 1;
      }
      pm.status = p.status;
      prdTouched = msTouched = planTouched = true;
    } else {
      const w = wOf[p.id];
      w.status = p.status;
      if (p.progress !== undefined) w.progress = p.progress;
      planTouched = true;
    }
  }

  if (prdTouched) fs.writeFileSync(P_PRD, scan.lines.join(scan.eol));
  if (msTouched) writeJson(P_MS, stores.ms);
  if (planTouched) writeJson(P_PLAN, stores.plan);

  for (const p of pairs) {
    if (p.id.charAt(0) === 'M') {
      console.log('PASS  set ' + p.id + ' ' + p.status + ' :: prd=' + p.status +
        ' ms=' + p.status + ' plan=' + p.status);
    } else {
      const w = wOf[p.id];
      console.log('PASS  set ' + p.id + ' ' + p.status + ' :: status=' + w.status +
        ' progress=' + w.progress);
    }
  }
  /* Status travels both ways by id: a W id with a seeded task row also updates
   * that row (the resolved progress rides along when the pair carries one). */
  for (const p of pairs) {
    if (p.id.charAt(0) === 'W') propagateToTask(p);
  }
  return runCheck();
}

function main() {
  const argv = process.argv.slice(2);
  const setTokens = [];
  let sawCheck = false, sawSet = false, sawSeed = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      console.log(USAGE);
      return 0;
    }
    if (a === '--check') {
      sawCheck = true;
      continue;
    }
    if (a === '--seed-tasks') {
      sawSeed = true;
      continue;
    }
    if (a === '--set') {
      sawSet = true;
      while (i + 1 < argv.length && argv[i + 1].charAt(0) !== '-') {
        setTokens.push(argv[++i]);
      }
      continue;
    }
    console.error('unknown argument: ' + a);
    console.error(USAGE);
    return 1;
  }
  const modes = (sawCheck ? 1 : 0) + (sawSet ? 1 : 0) + (sawSeed ? 1 : 0);
  if (modes > 1) {
    console.error('cannot combine --check, --set and --seed-tasks');
    console.error(USAGE);
    return 1;
  }
  if (sawSeed) return runSeedTasks();
  if (sawSet) return runSet(setTokens);
  return runCheck();
}

process.exit(main());
