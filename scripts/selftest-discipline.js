#!/usr/bin/env node
/**
 * BACKGROUND: A gate that never fires is decoration. This self-test builds two
 * throwaway sandboxes and proves the discipline gate has DISCRIMINATION: a turn
 * that skips the issue ledger / PDCA / templates MUST be blocked (exit 2), and
 * the same turn after doing the three steps MUST pass (exit 0). Scenario B also
 * proves I3 fires on an UNFILLED scaffold (placeholder tokens present) and only
 * passes after the plan is filled - the MAT-01 conformance hole. This is the
 * failure-cell check required by the skill's three-state discipline.
 * CONDITIONS: Node >= 18, stdlib only. No network, no Chrome, no SQLite, no
 * writes outside os.tmpdir(). Exit 0 when all scenarios behave as frozen,
 * 1 otherwise. Prints one PASS/FAIL line per assertion with real output.
 * VERSION: 1.1.0 - I3 unfilled-plan negative control + compliant plan fill.
 * 1.0.0 - initial negative/positive gate discrimination test.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aiops-gate-'));
let failures = 0;
let total = 0;
const PASS = (label, ok, evidence) => {
  total++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label + ' :: ' + evidence);
  if (!ok) failures++;
};

function sandbox(name) {
  const d = path.join(TMP, name);
  fs.mkdirSync(path.join(d, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(d, 'templates'), { recursive: true });
  fs.mkdirSync(path.join(d, 'docs/evidence'), { recursive: true });
  fs.mkdirSync(path.join(d, 'assets/linked-gantt-board/data'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'scripts'))) {
    if (f.endsWith('.js')) fs.copyFileSync(path.join(ROOT, 'scripts', f), path.join(d, 'scripts', f));
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'templates'))) {
    fs.copyFileSync(path.join(ROOT, 'templates', f), path.join(d, 'templates', f));
  }
  fs.copyFileSync(path.join(ROOT, 'assets/linked-gantt-board/data/module-deps.json'),
    path.join(d, 'assets/linked-gantt-board/data/module-deps.json'));
  return d;
}
function run(d, script, args = []) {
  return spawnSync(process.execPath, [path.join(d, 'scripts', script), ...args],
    { env: { ...process.env, AIOPS_ROOT: d, AIOPS_SESSION: 'selftest-' + path.basename(d) },
      encoding: 'utf8' });
}
function gate(d) {
  const r = run(d, 'discipline-gate.js');
  let report = null;
  try { report = JSON.parse(fs.readFileSync(path.join(d, 'docs/evidence/gate-report.json'), 'utf8')); }
  catch (_) { /* absent */ }
  return { code: r.status, out: (r.stdout || '') + (r.stderr || ''), report };
}

/* Filled plan a compliant turn writes after scaffold: real marker text, zero
   angle-bracket placeholder tokens (I3 placeholder detector must stay quiet). */
const COMPLIANT_PLAN = [
  'ai-project-ops.plan/1.0 - filled plan (scaffold then fill in the same turn).',
  '',
  '# Project plan',
  '',
  '## 1. Purpose and non-goals',
  '- Purpose: Prove the discipline gate discriminates incomplete from complete turns.',
  '- Explicit non-goals: no network; no package installs; no writes outside the sandbox.',
  '',
  '## 2. Acceptance criteria (locked before work)',
  '| id | criterion | machine check | failure cell |',
  '|---|---|---|---|',
  '| A1 | Incomplete turn blocked | gate exit 2 with I1/I2/I3 named | gate exit 0 |',
  '| A2 | Complete turn passes | gate exit 0, no hard FAIL | any hard FAIL |',
  '',
  '## 3. Work breakdown (linked, not flat)',
  '| task id | owner | owner_type | depends_on | acceptance | evidence path |',
  '|---|---|---|---|---|---|',
  '| T1 | main | main | -> | both controls green | selftest stdout |',
  '',
  '## 4. Structure gate (section 7, default ON)',
  '- Symbol-level graph: assets/linked-gantt-board/data/module-deps.json',
  '- Structural rules: zero cycles; zero dangling ids.',
  '- Rebuild at: any module-deps.json edit.',
  '',
  '## 5. PDCA and issue ledger',
  '- Ledger: docs/TASK-LOG.md (main session owns the scoreboard).',
  '- Issues: node scripts/issue.js list at session start.',
  '- Every Check section pastes real command output.',
  '',
  '## 6. Delegation',
  '- One self-contained brief per package; exclusive file ownership.',
  '- A handback report is a claim, not proof. Re-run its key command.',
  '',
  '## 7. PRD-to-action backbone (I9)',
  '- Main line: M1 - M2 (sandbox stub; real package uses docs/PRD.md stores).',
  '- Sub-lines: M1: W1; M2: W2.',
  '- Relations: W1 to W2 (FS); acyclic.',
  '- Gate: node scripts/prd-to-action.js (absent here -> I9 UNCERTAIN, non-blocking).',
  '',
].join('\n');

try {
  /* ---- Scenario A: a turn that skips everything (must be BLOCKED) ---- */
  const a = sandbox('skipped');
  const startA = run(a, 'session-start.js');
  PASS('A: session-start emits the reminder', /discipline-gate-reminder/.test(startA.stdout),
    'reminder=' + /discipline-gate-reminder/.test(startA.stdout) + ' exit=' + startA.status);
  const ga = gate(a);
  PASS('A: gate blocks the incomplete turn (exit 2)', ga.code === 2, 'exit=' + ga.code);
  PASS('A: I1 issue-ledger invariant fires', /FAIL\s+I1/.test(ga.out),
    (ga.out.match(/FAIL\s+I1[^\n]*/) || ['not found'])[0]);
  PASS('A: I2 PDCA invariant fires', /FAIL\s+I2/.test(ga.out),
    (ga.out.match(/FAIL\s+I2[^\n]*/) || ['not found'])[0]);
  PASS('A: I3 template invariant fires', /FAIL\s+I3/.test(ga.out),
    (ga.out.match(/FAIL\s+I3[^\n]*/) || ['not found'])[0]);
  PASS('A: stderr tells the AI how to fix it', /node scripts\/issue\.js list/.test(ga.out),
    'fix hint present=' + /node scripts\/issue\.js list/.test(ga.out));
  PASS('A: I4/I5 recomputed from dependency data, no cycle', /PASS\s+I4/.test(ga.out) && /PASS\s+I5/.test(ga.out),
    'I4/I5 are independent of the missing steps');

  /* ---- Scenario B: the same turn done right (must PASS) ---- */
  const b = sandbox('compliant');
  run(b, 'session-start.js');
  const iss = run(b, 'issue.js', ['no-new', '--reason', 'selftest: no new issues']);
  PASS('B: issue ledger touched via CLI', iss.status === 0 && /PASS/.test(iss.stdout),
    (iss.stdout || '').trim().split('\n')[0]);
  const sc = run(b, 'scaffold.js');
  PASS('B: templates instantiated', sc.status === 0 && /docs\/PLAN\.md/.test(sc.stdout),
    (sc.stdout || '').trim().split('\n').slice(-1)[0]);
  /* Negative control: scaffold leaves an UNFILLED plan (placeholder tokens).
     I3 must fire with placeholders named - not pass on the marker alone. */
  const gu = gate(b);
  PASS('B: unfilled scaffold blocked by I3 (placeholder control)',
    gu.code === 2 && /FAIL\s+I3/.test(gu.out) && /placeholders=[1-9]/.test(gu.out),
    (gu.out.match(/FAIL\s+I3[^\n]*/) || ['not found'])[0]);
  PASS('B: I3 fix hint names the fill step',
    /replace every placeholder/.test(gu.out),
    'fix hint present=' + /replace every placeholder/.test(gu.out));
  /* What a compliant turn does next: fill the plan in the same turn. */
  fs.writeFileSync(path.join(b, 'docs/PLAN.md'), COMPLIANT_PLAN);
  PASS('B: compliant plan has zero angle-bracket tokens',
    (COMPLIANT_PLAN.match(/</g) || []).length === 0 &&
    /ai-project-ops\.plan\/1\.0/.test(COMPLIANT_PLAN),
    'lt_count=' + (COMPLIANT_PLAN.match(/</g) || []).length +
    ' marker=' + /ai-project-ops\.plan\/1\.0/.test(COMPLIANT_PLAN));
  const log = path.join(b, 'docs/TASK-LOG.md');
  fs.appendFileSync(log, '\n### 2026-11-08 selftest entry (tier S, by: main session)\n' +
    '- C Check: PASS 30/30 exit_code=0 sha256 MATCH\n' +
    '- A Act: PASS\n');
  const gb = gate(b);
  PASS('B: gate passes the compliant turn (exit 0)', gb.code === 0, 'exit=' + gb.code);
  PASS('B: no hard invariant FAILs', gb.report &&
    gb.report.hard.every(x => x.status !== 'FAIL'),
    gb.report ? gb.report.hard.map(x => x.id + '=' + x.status).join(' ') : 'no report');
  PASS('B: I9 is UNCERTAIN when PRD artifacts are absent (three-state)',
    gb.report && gb.report.hard.some(x => x.id === 'I9' && x.status === 'UNCERTAIN'),
    'I9=' + (gb.report ? (gb.report.hard.find(x => x.id === 'I9') || {}).status : 'missing'));
  PASS('B: I10 is UNCERTAIN when benchmark artifacts are absent (three-state)',
    gb.report && gb.report.hard.some(x => x.id === 'I10' && x.status === 'UNCERTAIN'),
    'I10=' + (gb.report ? (gb.report.hard.find(x => x.id === 'I10') || {}).status : 'missing'));
  PASS('B: structure report written by the gate itself',
    fs.existsSync(path.join(b, 'docs/evidence/structure-gate.json')),
    'structure-gate.json exists');
  PASS('DRYRUN fails open', (() => {
    const d = sandbox('dryrun');
    run(d, 'session-start.js');
    const r = spawnSync(process.execPath, [path.join(d, 'scripts', 'discipline-gate.js')],
      { env: { ...process.env, AIOPS_ROOT: d, DISCIPLINE_GATE_DRYRUN: '1' }, encoding: 'utf8' });
    return r.status === 0 && /DRYRUN/.test(r.stdout || '');
  })(), 'dryrun exit=0 with DRYRUN line');

  console.log('\nDISCIPLINE SELFTEST: ' + (total - failures) + '/' + total + ' passed' +
    (failures ? '  RESULT: FAIL' : '  RESULT: PASS'));
} finally {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* best effort */ }
}
process.exit(failures ? 1 : 0);
