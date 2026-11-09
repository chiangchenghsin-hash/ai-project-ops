#!/usr/bin/env node
/**
 * BACKGROUND: Ten disciplines in SKILL.md were prose. An AI could skip every
 * one of them and still finish a turn. This Stop hook converts six of them into
 * machine-checked invariants; a missing step blocks the turn with exit 2 and a
 * stderr reason, so "I forgot" is no longer a valid completion path. Two
 * further invariants are reported but never block (three-state discipline:
 * UNCERTAIN is not FAIL).
 * CONDITIONS: Node >= 18. Root = AIOPS_ROOT or parent of scripts/. Reads
 * docs/evidence/session.json written by session-start.js. If that snapshot is
 * absent the gate degrades to WARN, never a false block. Set
 * DISCIPLINE_GATE_DRYRUN=1 to report without blocking. Internal exceptions are
 * fail-open (exit 0 + GATE-DEGRADED), matching the local CDP gate convention.
 * Exit: 0 pass/degraded, 2 invariant failed (blocks the Stop hook).
 * VERSION: 1.0.0 - initial six hard + two soft invariants (C5 discipline layer).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = process.env.AIOPS_ROOT || path.resolve(__dirname, '..');
const EVID = path.join(ROOT, 'docs/evidence');
const DRYRUN = process.env.DISCIPLINE_GATE_DRYRUN === '1';
const p = (f) => path.join(ROOT, f);
const readJson = (f) => JSON.parse(fs.readFileSync(p(f), 'utf8'));
const exists = (f) => fs.existsSync(p(f));

function edgesFrom(file) {
  if (!exists(file)) return null;
  const d = readJson(file);
  const arr = Array.isArray(d) ? d : (d.edges || d.dependencies || d.links || d.relations || []);
  if (!Array.isArray(arr)) return null;
  return arr.map(e => Array.isArray(e)
      ? { from: String(e[0] ?? ''), to: String(e[1] ?? '') }
      : {
        from: String(e.from ?? e.src ?? e.source ?? e.a ?? ''),
        to: String(e.to ?? e.dst ?? e.target ?? e.b ?? ''),
      }).filter(e => e.from && e.to);
}

function graphCheck(edges) {
  const adj = {}, nodes = new Set();
  edges.forEach(e => { nodes.add(e.from); nodes.add(e.to); (adj[e.from] ||= []).push(e.to); });
  const dangling = edges.filter(e => !nodes.has(e.from) || !nodes.has(e.to));
  const color = {}, stack = [];
  let cycles = 0;
  function dfs(n) {
    color[n] = 1; stack.push(n);
    (adj[n] || []).forEach(m => {
      if (color[m] === 1) cycles++;
      else if (!color[m]) dfs(m);
    });
    stack.pop(); color[n] = 2;
  }
  nodes.forEach(n => { if (!color[n]) dfs(n); });
  const targets = new Set(edges.map(e => e.to));
  const orphans = [...nodes].filter(n => !adj[n] && !targets.has(n));
  return { nodes: nodes.size, edges: edges.length, cycles, dangling: dangling.length,
           orphans, orphans_reported: true };
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(p(file))).digest('hex');
}

function run() {
  if (process.env.DISABLE_DISCIPLINE_GATE === '1') {
    console.log('GATE-DEGRADED (DISABLE_DISCIPLINE_GATE=1): no invariants checked');
    return 0;
  }
  let session = null;
  try { session = readJson('docs/evidence/session.json'); } catch (_) { /* absent */ }
  const sid = session && session.session_id;
  const hard = [], soft = [];
  const add = (id, ok, why) => (id.startsWith('I7') || id.startsWith('I8') ? soft : hard)
    .push({ id, status: ok ? 'PASS' : (id.startsWith('I7') || id.startsWith('I8') ? 'UNCERTAIN' : 'FAIL'), why });

  /* I1 - issue ledger touched this session */
  let touched = false, deltaCount = 0;
  try {
    const d = readJson('docs/evidence/issue-delta.json');
    deltaCount = d.events.length;
    touched = d.events.some(e => e.session_id === sid && e.action);
  } catch (_) { /* no delta file */ }
  add('I1', touched, 'issue-delta.json events=' + deltaCount +
    '; needs one event for session ' + (sid || 'UNKNOWN'));

  /* I2 - one new PDCA entry */
  const log = exists('docs/TASK-LOG.md') ? fs.readFileSync(p('docs/TASK-LOG.md'), 'utf8') : '';
  const entries = (log.match(/^### /gm) || []).length;
  const grew = !!session && (entries > session.pdca_entries || log.length > session.pdca_bytes + 80);
  add('I2', grew, 'PDCA entries now=' + entries + ', snapshot=' + (session ? session.pdca_entries : 'ABSENT'));

  /* I3 - templates instantiated, never handwritten */
  const plan = exists('docs/PLAN.md') ? fs.readFileSync(p('docs/PLAN.md'), 'utf8') : '';
  const scaffolded = exists('docs/TASK-LOG.md') && exists('docs/PLAN.md') &&
    /ai-project-ops\.plan\/1\.0|Plan template/.test(plan);
  add('I3', scaffolded, 'docs/TASK-LOG.md=' + exists('docs/TASK-LOG.md') +
    ' docs/PLAN.md=' + exists('docs/PLAN.md') + ' template-marker=' + /ai-project-ops\.plan\/1\.0|Plan template/.test(plan));

  /* I4/I5 - structure gate and task relationships, RECOMPUTED here, never
     trusted from an AI-written declaration */
  const edges = edgesFrom('assets/linked-gantt-board/data/module-deps.json');
  let g = null;
  if (edges) {
    g = graphCheck(edges);
    fs.mkdirSync(EVID, { recursive: true });
    fs.writeFileSync(p('docs/evidence/structure-gate.json'),
      JSON.stringify({ schema: 'ai-project-ops.structure-gate/1.0', session_id: sid || null,
        computed_at: new Date().toISOString(), source: 'data/module-deps.json', ...g }, null, 2) + '\n');
  }
  add('I4', !!g && g.cycles === 0, g ? 'DAG cycles=' + g.cycles + ' nodes=' + g.nodes : 'no dependency data');
  add('I5', !!g && g.dangling === 0 && g.orphans_reported,
    g ? 'dangling=' + g.dangling + ' orphans=' + g.orphans.length + ' orphans_reported=true' : 'no dependency data');

  /* I6 - the new PDCA text carries real evidence, not prose */
  const tail = log.slice(-4000);
  const evidence = /(PASS|FAIL|UNCERTAIN|exit[_ ]?code|EXIT=|MATCH|sha256|\d+\/\d+)/.test(tail);
  add('I6', grew && evidence, 'evidence tokens in tail=' + evidence + ', grew=' + grew);

  /* I7/I8 - soft: validator report and frozen-artifact integrity */
  let v = 'ABSENT';
  try {
    const r = readJson('docs/evidence/validation-report.json');
    v = (r.failed === 0 || r.summary?.failed === 0) ? 'GREEN' : 'RED';
  } catch (_) { /* absent */ }
  add('I7', v === 'GREEN', 'validation-report.json status=' + v + ' (UNCERTAIN is non-blocking)');

  let frozen = 'ABSENT';
  try {
    const m = readJson('docs/evidence/freeze-manifest.json');
    const actual = sha256('docs/evidence/effectiveness-freeze.json');
    frozen = actual === m.freeze_file_sha256 ? 'MATCH' : 'MISMATCH';
  } catch (_) { /* absent */ }
  add('I8', frozen === 'MATCH' || frozen === 'ABSENT',
    'freeze hash=' + frozen + ' (MISMATCH would be an E07 veto, reported separately)');

  /* I9 - PRD-to-action adversarial gate. HARD when the plan artifacts exist,
     UNCERTAIN when they are absent (three-state: missing evidence is not a
     negative result). This closes the documentation-only gap left by G3. */
  const prdReady = exists('scripts/prd-to-action.js') && exists('docs/PRD.md') &&
    exists('docs/evidence/milestones.json') &&
    exists('assets/linked-gantt-board/data/milestone-plan.json');
  let i9 = { id: 'I9', status: 'UNCERTAIN',
    why: 'PRD artifacts absent -> not scored (three-state, non-blocking)' };
  if (prdReady) {
    try {
      const r = spawnSync(process.execPath, [p('scripts/prd-to-action.js')],
        { encoding: 'utf8', timeout: 15000, cwd: ROOT });
      i9 = r.status === 0
        ? { id: 'I9', status: 'PASS', why: 'prd-to-action.js exit 0 (10/10 gates)' }
        : { id: 'I9', status: 'FAIL', why: 'prd-to-action.js exit ' + r.status +
            '; fix: node scripts/prd-to-action.js' };
    } catch (e) {
      i9 = { id: 'I9', status: 'UNCERTAIN', why: 'gate spawn failed: ' + e.message };
    }
  }
  hard.push(i9);

  /* I10 - benchmark adoption. R17 researched five competitor groups and the
     conclusion was never wired into templates or a gate. This invariant makes
     "we researched it and forgot it" a detectable failure. */
  const adoptReady = exists('scripts/benchmark-adoption.js') &&
    exists('docs/competitive-synthesis.md') &&
    exists('docs/BENCHMARK-ADOPTION.md') &&
    exists('templates/registry.json');
  let i10 = { id: 'I10', status: 'UNCERTAIN',
    why: 'benchmark artifacts absent -> not scored (three-state, non-blocking)' };
  if (adoptReady) {
    try {
      const r = spawnSync(process.execPath, [p('scripts/benchmark-adoption.js')],
        { encoding: 'utf8', timeout: 15000, cwd: ROOT });
      i10 = r.status === 0
        ? { id: 'I10', status: 'PASS', why: 'benchmark-adoption.js exit 0 (adoption chain green)' }
        : { id: 'I10', status: 'FAIL', why: 'benchmark-adoption.js exit ' + r.status +
            '; fix: node scripts/benchmark-adoption.js' };
    } catch (e) {
      i10 = { id: 'I10', status: 'UNCERTAIN', why: 'gate spawn failed: ' + e.message };
    }
  }
  hard.push(i10);

  const failed = hard.filter(x => x.status === 'FAIL');
  const report = {
    schema: 'ai-project-ops.discipline-gate/1.0',
    session_id: sid || null, checked_at: new Date().toISOString(), dryrun: DRYRUN,
    version: '1.0.0', hard, soft,
    verdict: failed.length ? 'FAIL' : 'PASS',
    blocked: failed.length > 0 && !DRYRUN,
  };
  try {
    fs.mkdirSync(EVID, { recursive: true });
    fs.writeFileSync(p('docs/evidence/gate-report.json'), JSON.stringify(report, null, 2) + '\n');
  } catch (e) { process.stderr.write('gate report write failed: ' + e.message + '\n'); }

  hard.concat(soft).forEach(x => console.log(x.status.padEnd(9) + x.id + ' :: ' + x.why));
  if (failed.length) {
    process.stderr.write('\n[DISCIPLINE GATE] BLOCKED. ' + failed.length + ' invariant(s) missing:\n');
    failed.forEach(x => process.stderr.write('  - ' + x.id + ': ' + x.why +
      '\n    fix: ' + ({
        I1: 'node scripts/issue.js list ; then add/update, or no-new --reason "..."',
        I2: 'append one PDCA entry to docs/TASK-LOG.md',
        I3: 'node scripts/scaffold.js',
        I4: 'fix a cycle in data/module-deps.json',
        I5: 'fix dangling dependency ids in data/module-deps.json',
        I6: 'paste real command output in the Check section',
        I9: 'node scripts/prd-to-action.js and fix the reported gate',
        I10: 'node scripts/benchmark-adoption.js and restore the missing landing',
      })[x.id] + '\n'));
    if (DRYRUN) { console.log('DRYRUN: would block, exiting 0'); return 0; }
    return 2;
  }
  console.log('DISCIPLINE GATE PASS (' + hard.length + ' hard / ' + soft.length + ' soft)');
  return 0;
}

try { process.exit(run()); }
catch (e) {
  process.stderr.write('GATE-DEGRADED (fail-open): ' + e.message + '\n');
  process.exit(0);
}
