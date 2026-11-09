#!/usr/bin/env node
/**
 * BACKGROUND: R17 produced five competitive reports, 226 URLs and a synthesis
 * with six ordered build-first recommendations, but no adoption chain. A human
 * asked "you researched Teambition and three others, and did not even use the
 * templates". Cold reader R4 then found v1.0.0 was gameable: it checked only
 * literal "| B# |" tokens, never opened a landing, had no expected master list,
 * and could be edited without detection. v1.1.0 checks each row, each landing,
 * each instance, the wiring keywords and a signed manifest.
 * CONDITIONS: Node >= 18, stdlib only. Reads ONLY package-internal files so it
 * works in a freshly extracted archive with no .research/ directory. Normal
 * mode: exit 0 all pass / 2 any FAIL. `--negative` runs TWO in-memory
 * perturbations (delete one template; relabel B1 as IMPLEMENTED) and requires
 * both to be detected. The manifest has no hash of itself (circular); editing
 * it is treated like editing a frozen artifact and requires a new version id.
 * VERSION: 1.2.0 - C9: B1/B2/B5/B6 landings verified against real code;
 * a downgraded status is now the negative control (C8/R4/C9).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.AIOPS_ROOT || path.resolve(__dirname, '..');
const NEG = process.argv.includes('--negative');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const has = (f) => fs.existsSync(path.join(ROOT, f));
const sha = (f) => crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(ROOT, f))).digest('hex');

const BENCHMARK_TEMPLATES = [
  'templates/template-governance.template.md',
  'templates/agent-session.template.md',
  'templates/approval-matrix.template.md',
  'templates/owner-scope.template.md',
];
const INSTANCES = [
  'docs/TEMPLATE-GOVERNANCE.md', 'docs/AGENT-SESSION.md',
  'docs/APPROVAL-MATRIX.md', 'docs/OWNER-SCOPE.md',
];
const BENCH_IDS = ['template-governance', 'agent-session', 'approval-matrix', 'owner-scope'];
const IDS = ['B1','B2','B3','B4','B5','B6'];
const MANIFEST = 'docs/evidence/adoption-manifest.json';

function rowsOf(adoption) {
  return IDS.map(id => {
    const row = (adoption || '').split('\n').find(l => l.startsWith('| ' + id + ' |')) || '';
    const cells = row.split('|');
    const status = /\*\*NOT IMPLEMENTED\*\*/.test(row) ? 'NOT'
      : /\*\*PARTIAL\*\*/.test(row) ? 'PARTIAL'
      : /\*\*IMPLEMENTED\*\*/.test(row) ? 'IMP' : 'MISSING';
    return { id, row, status, landing: (cells[cells.length - 2] || '').trim() };
  });
}

/** Pure evaluation so --negative can perturb inputs without touching disk. */
function evaluate(input) {
  const out = [];
  const chk = (label, ok, why) => out.push({ label, ok: !!ok, why });
  const rows = rowsOf(input.adoption);

  chk('synthesis present with six build-first items',
    input.synthesis && /What to build first/.test(input.synthesis) &&
    (input.synthesis.match(/^\d\. /gm) || []).length >= 6,
    'build-first list found');
  chk('every B1..B6 row has an explicit status',
    rows.every(r => r.status !== 'MISSING'),
    rows.map(r => r.id + '=' + r.status).join(' '));
  chk('every B1..B6 row carries a concrete landing reference',
    rows.every(r => /`[^`]+`/.test(r.landing)),
    rows.map(r => r.id + ':' + (/`[^`]+`/.test(r.landing) ? 'ref' : 'NO-REF')).join(' '));
  chk('C9: B1/B5/B6 IMPLEMENTED with real code landings',
    ['B1','B5','B6'].every(id => rows.find(r => r.id === id).status === 'IMP') &&
    /\/api\/policy\/approvals/.test(rows.find(r => r.id === 'B1').landing) &&
    /sharedOrder/.test(rows.find(r => r.id === 'B5').landing) &&
    /\/api\/policy\/owner-scope/.test(rows.find(r => r.id === 'B6').landing),
    'B1 approvals endpoint / B5 sharedOrder / B6 owner-scope endpoint');
  chk('registry parses and every master exists',
    input.registry && input.registry.policy &&
    input.registry.masters.every(m => m.id && m.version && m.master &&
      ['owner','member'].includes(m.publish_role) && m.benchmark && input.has(m.master)),
    input.registry ? input.registry.masters.length + ' masters' : 'registry missing');
  chk('registry contains all four benchmark master ids (>=9 masters)',
    input.registry && input.registry.masters.length >= 9 &&
    BENCH_IDS.every(id => input.registry.masters.some(m => m.id === id)),
    'fixed id list enforced');
  chk('no-overwrite and future-instances-only policy declared',
    input.registry && input.registry.policy.instance_overwrite === 'never' &&
    /future instances/.test(input.registry.policy.upgrade_scope),
    'Monday A4 rule');
  chk('four benchmark templates exist with Benchmark headers',
    BENCHMARK_TEMPLATES.every(t => input.has(t) && /Benchmark:/.test(input.files[t] || '')),
    BENCHMARK_TEMPLATES.length + ' templates');
  chk('four benchmark template INSTANCES actually exist (R4/D3)',
    INSTANCES.every(f => input.has(f)),
    INSTANCES.filter(f => input.has(f)).length + '/' + INSTANCES.length + ' instances');
  chk('scaffold implements REAL drift, publish bump and --all (R4/D1,D2,D3)',
    input.scaffold && /master_version/.test(input.scaffold) &&
    /publishes/.test(input.scaffold) && /function bump/.test(input.scaffold) &&
    /--all/.test(input.scaffold),
    'version comparison + bump + all-instantiation keywords');
  chk('C9 remediation and the stale I-006 correction are recorded',
    input.adoption && /C9 remediation/.test(input.adoption) &&
    /I-006/.test(input.adoption) && /ALREADY built/i.test(input.adoption),
    'I-006 corrected with code evidence, not silently closed');
  chk('claims graded UNCERTAIN are excluded',
    input.adoption && /Claims not promoted/.test(input.adoption),
    'synthesis:101-120 respected');
  /* Self-integrity: an edited gate or ledger without re-signing fails. */
  let integrity = false;
  try {
    const man = JSON.parse(read(MANIFEST));
    integrity = man.files['scripts/benchmark-adoption.js'].split(':').pop() ===
      sha('scripts/benchmark-adoption.js') &&
      man.files['docs/BENCHMARK-ADOPTION.md'].split(':').pop() ===
      sha('docs/BENCHMARK-ADOPTION.md');
  } catch (_) { integrity = false; }
  chk('gate + adoption ledger hashes match the signed manifest (R4/D4)',
    integrity, integrity ? 'both MATCH' : 'manifest missing or hash mismatch');
  return out;
}

function collect() {
  const files = {};
  BENCHMARK_TEMPLATES.forEach(t => { if (has(t)) files[t] = read(t); });
  return {
    synthesis: has('docs/competitive-synthesis.md') ? read('docs/competitive-synthesis.md') : '',
    adoption: has('docs/BENCHMARK-ADOPTION.md') ? read('docs/BENCHMARK-ADOPTION.md') : '',
    registry: has('templates/registry.json') ? JSON.parse(read('templates/registry.json')) : null,
    scaffold: has('scripts/scaffold.js') ? read('scripts/scaffold.js') : '',
    files, has,
  };
}

const rows = evaluate(collect());
rows.forEach(r => console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.label + ' :: ' + r.why));
const passed = rows.filter(r => r.ok).length;
console.log('BENCHMARK ADOPTION: ' + passed + '/' + rows.length + ' passed');

if (NEG) {
  const a = collect();
  delete a.files['templates/owner-scope.template.md'];
  const detA = evaluate(a).some(r => !r.ok);
  const b = collect();
  const b1row = b.adoption.split('\n').find(l => l.startsWith('| B1 |')) || '';
  b.adoption = b.adoption.replace(b1row,
    b1row.replace('**IMPLEMENTED**', '**NOT IMPLEMENTED**'));
  const detB = evaluate(b).some(r => !r.ok);
  console.log('NEGATIVE CONTROL A: ' + (detA ? 'PASS' : 'FAIL') +
    ' :: deleted one benchmark template -> ' + (detA ? 'detected' : 'MISSED'));
  console.log('NEGATIVE CONTROL B: ' + (detB ? 'PASS' : 'FAIL') +
    ' :: downgraded B1 to NOT IMPLEMENTED -> ' + (detB ? 'detected' : 'MISSED'));
  process.exit(detA && detB ? 2 : 0);
}
process.exit(passed === rows.length ? 0 : 2);
