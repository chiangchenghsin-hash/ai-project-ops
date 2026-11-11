#!/usr/bin/env node
/**
 * BACKGROUND: Deterministic, adversarial gate for the PRD-to-action method as
 * applied to this command-panel package. It replaces the manual "read the PRD
 * and trust it" step with machine checks that try to BREAK the plan artifacts:
 * docs/PRD.md, docs/evidence/milestones.json and
 * assets/linked-gantt-board/data/milestone-plan.json. This is the Verification
 * Gate plus the adversarial falsifiability grep of the installed prd-to-action
 * skill, expressed as one reproducible Node script. Header contract
 * (BACKGROUND / CONDITIONS / VERSION) per SKILL.md section 10.
 * CONDITIONS: Node >= 18, standard library only (fs, path, os). No network,
 * no npm deps, no SQLite, no Chrome, no package manager. Root is derived from
 * __dirname, so it runs from any cwd. Normal mode: exit 0 when every gate
 * passes, exit 2 on any FAIL. Negative mode (--negative): writes a temp copy
 * of the PRD (under os.tmpdir()) with one banned phrase injected, asserts gate
 * A detects it (the gate would exit 2) and that no other gate fires; the
 * original docs/PRD.md is never touched and the temp file is removed. This
 * mode exits 2 BY DESIGN when discrimination is proven (2 is the expected
 * DETECT signal per the brief), or 1 if discrimination cannot be proven.
 * Every check prints "PASS  <label> :: <evidence>" or "FAIL  ...".
 * Summary line: "PRD-TO-ACTION GATE: n/n passed".
 * VERSION: 1.1.0 - gate C milestone counts derive from the three stores
 * (same length, same id sets - no hardcoded 6); gate X requires an explicit
 * sub_lines entry per milestone, keeps >=2 work units for every milestone
 * that owns units, and checks that goals cover every milestone exactly once.
 * 1.0.1 - gate X also asserts three-store milestone status equality
 * (PRD Status field vs milestones.json vs milestone-plan.json, divergent
 * values named in the FAIL evidence). 1.0.0 - initial gates L1-L3 (loads),
 * A banned vague phrases,
 * B template placeholders, C milestone fields, D real verify commands,
 * E topological main line + acyclic relations + no dangling ids,
 * F non-placeholder charter, X cross-file consistency, plus --negative.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const P_PRD = path.join(ROOT, 'docs', 'PRD.md');
const P_MS = path.join(ROOT, 'docs', 'evidence', 'milestones.json');
const P_PLAN = path.join(ROOT, 'assets', 'linked-gantt-board', 'data', 'milestone-plan.json');

const BANNED = [
  'works correctly', 'looks good', 'feels right', 'is done',
  'user satisfied', 'PM signoff', 'code review approve', 'demo works'
];
const GO = '\u00AB';
const GC = '\u00BB';
const RUNNERS = ['node', 'python', 'python3'];
const REL_TYPES = ['FS', 'SS', 'FF', 'SF'];
const STATUSES = ['pending', 'in_progress', 'done', 'skipped'];
const OWNER_TYPES = ['human', 'main', 'subagent', 'team'];
const TIERS = ['S', 'M', 'L', 'XL'];
const MS_FIELDS = ['Depends on', 'Type', 'Has external deps', 'Files', 'Completion', 'Verify', 'Status'];

function collectStrings(v, out) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collectStrings(x, out));
  return out;
}

function bannedHits(text) {
  const low = text.toLowerCase();
  const hits = [];
  for (const p of BANNED) {
    let i = low.indexOf(p), n = 0;
    while (i !== -1) { n += 1; i = low.indexOf(p, i + p.length); }
    if (n) hits.push(p + ' x' + n);
  }
  return hits;
}

function placeholderMarkers(text) {
  const f = [];
  if (text.indexOf(GO) !== -1) f.push('guillemet-open');
  if (text.indexOf(GC) !== -1) f.push('guillemet-close');
  if (/<</.test(text)) f.push('<<');
  if (/>>/.test(text)) f.push('>>');
  if (/\{\{/.test(text)) f.push('{{');
  if (/\}\}/.test(text)) f.push('}}');
  if (/<<[^>]*>>/.test(text)) f.push('<<TOKEN>>');
  if (/\u00AB[^\u00BB]*\u00BB/.test(text)) f.push('guillemet-token');
  return f;
}

function parsePrdMilestones(text) {
  const blocks = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^###\s+(M\d+):/);
    if (h) { cur = { id: h[1], fields: {} }; blocks.push(cur); continue; }
    if (/^##\s/.test(line)) { cur = null; continue; }
    if (cur) {
      const f = line.match(/^-\s*(Depends on|Type|Has external deps|Files|Completion|Verify|Status):\s*(.*)$/);
      if (f) cur.fields[f[1]] = f[2].trim();
    }
  }
  return blocks;
}

function prdVerifyLines(text) {
  const out = [];
  const re = /^- Verify:\s*(.+)$/gm;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1].replace(/`/g, '').trim());
  return out;
}

function verifyProblems(cmd) {
  const problems = [];
  const parts = cmd.trim().replace(/`/g, '').split(/\s+/).filter(Boolean);
  if (!parts.length) return ['empty command'];
  if (RUNNERS.indexOf(parts[0]) === -1) problems.push('unknown runner: ' + parts[0]);
  const paths = parts.filter((t) => /\.(js|py|json|md)$/.test(t) && t.indexOf('/') !== -1);
  let realScript = false;
  for (const t of paths) {
    if (fs.existsSync(path.resolve(ROOT, t))) realScript = true;
    else problems.push('missing script: ' + t);
  }
  const inline = parts.some((t) => t === '-e' || t === '-p' || t === '-c' || t === '-m' || t === '--check');
  if (!realScript && !inline) problems.push('no real script and no inline command');
  return problems;
}

function milestoneIds(milestones) { return milestones.map((m) => m.id); }

function mainLineOk(milestones, mainLine) {
  const problems = [];
  const ids = milestoneIds(milestones);
  if (!Array.isArray(mainLine)) return ['main_line is not an array'];
  if (mainLine.length !== ids.length) problems.push('main_line length ' + mainLine.length + ' != ' + ids.length);
  const seen = new Set();
  for (const id of mainLine) {
    if (ids.indexOf(id) === -1) problems.push('unknown id in main_line: ' + id);
    if (seen.has(id)) problems.push('duplicate id in main_line: ' + id);
    seen.add(id);
  }
  for (const id of ids) if (!seen.has(id)) problems.push('missing id in main_line: ' + id);
  const depOf = {};
  milestones.forEach((m) => { depOf[m.id] = m.depends_on || []; });
  const position = {};
  mainLine.forEach((id, i) => { position[id] = i; });
  for (const m of milestones) {
    for (const d of depOf[m.id]) {
      if (position[d] === undefined || position[d] >= position[m.id]) {
        problems.push('dep ' + d + ' not before ' + m.id);
      }
    }
  }
  return problems;
}

function relationsOk(relations, wIds) {
  const problems = [];
  const wset = new Set(wIds);
  if (!Array.isArray(relations)) return ['relations is not an array'];
  for (const r of relations) {
    if (!wset.has(r.from)) problems.push('dangling from: ' + r.from);
    if (!wset.has(r.to)) problems.push('dangling to: ' + r.to);
    if (REL_TYPES.indexOf(r.type) === -1) problems.push('bad type: ' + r.type);
  }
  const indeg = {}; const adj = {};
  wIds.forEach((id) => { indeg[id] = 0; adj[id] = []; });
  for (const r of relations) {
    if (wset.has(r.from) && wset.has(r.to)) { adj[r.from].push(r.to); indeg[r.to] += 1; }
  }
  const q = wIds.filter((id) => indeg[id] === 0);
  let seen = 0;
  while (q.length) {
    const n = q.shift(); seen += 1;
    for (const t of adj[n]) { indeg[t] -= 1; if (indeg[t] === 0) q.push(t); }
  }
  if (seen !== wIds.length) problems.push('cycle detected (' + (wIds.length - seen) + ' nodes unprocessed)');
  return problems;
}

function runChecks(prdText, msText, planText) {
  const checks = [];
  const add = (id, label, ok, evidence) => checks.push({ id, label, ok: !!ok, evidence: String(evidence) });

  let ms = null, plan = null, msErr = null, planErr = null;
  try { ms = JSON.parse(msText); } catch (e) { msErr = e.message; }
  try { plan = JSON.parse(planText); } catch (e) { planErr = e.message; }

  add('L1', 'load: docs/PRD.md', prdText && prdText.length > 0,
      prdText ? (Buffer.byteLength(prdText, 'utf8') + ' bytes, ' + prdText.split(/\r?\n/).length + ' lines') : 'empty');
  add('L2', 'load: docs/evidence/milestones.json', !!ms,
      ms ? ('schema=' + ms.schema + ', milestones=' + (ms.milestones || []).length) : ('parse error: ' + msErr));
  add('L3', 'load: milestone-plan.json', !!plan,
      plan ? ('schema=' + plan.schema + ', milestones=' + (plan.milestones || []).length + ', work_units=' + (plan.work_units || []).length) : ('parse error: ' + planErr));

  const ready = !!(ms && plan);
  const corpus = prdText + '\n' + collectStrings(ms || {}, []).join('\n') + '\n' + collectStrings(plan || {}, []).join('\n');

  /* A - adversarial falsifiability grep: banned vague phrases MUST be absent (grep exit 1). */
  const bh = bannedHits(corpus);
  add('A', 'A: banned vague phrases absent (adversarial grep, MUST be absent)',
      ready && bh.length === 0,
      ready ? (bh.length ? ('FOUND: ' + bh.join(', ')) : ('0 matches of ' + BANNED.length + ' banned phrases across PRD + 2 JSON files')) : 'prerequisite parse failed');

  /* B - template-variable grep, with a detector control so the check is not vacuous. */
  const control = placeholderMarkers('<<VAR>> ' + GO + 'VAR' + GC);
  const pm = placeholderMarkers(corpus);
  add('B', 'B: template-variable placeholders absent',
      ready && control.length > 0 && pm.length === 0,
      ready ? ('detector control caught [' + control.join(',') + ']; plan corpus markers = ' + pm.length + (pm.length ? ' [' + pm.join(',') + ']' : '')) : 'prerequisite parse failed');

  /* C - every milestone has depends_on / completion / verify / status (+ PRD 7 fields). */
  let cOk = false, cEv = 'prerequisite parse failed';
  if (ready) {
    const msMs = ms.milestones || [], planMs = plan.milestones || [];
    const prdBlocks = parsePrdMilestones(prdText);
    const p = [];
    /* Count check DERIVES from the three stores: same length, same id sets,
       duplicate ids rejected. No hardcoded milestone count anywhere. */
    const idsOf = (list) => list.map((m) => m.id);
    const idSet = (list) => Array.from(new Set(idsOf(list))).sort().join(',');
    if (msMs.length !== planMs.length || planMs.length !== prdBlocks.length) {
      p.push('milestone count mismatch: ms=' + msMs.length + ' plan=' + planMs.length +
        ' prd=' + prdBlocks.length);
    }
    if (idSet(msMs) !== idSet(planMs)) {
      p.push('id set mismatch ms vs plan: [' + idSet(msMs) + '] != [' + idSet(planMs) + ']');
    }
    if (idSet(planMs) !== idSet(prdBlocks)) {
      p.push('id set mismatch plan vs prd: [' + idSet(planMs) + '] != [' + idSet(prdBlocks) + ']');
    }
    [['ms', idsOf(msMs)], ['plan', idsOf(planMs)], ['prd', idsOf(prdBlocks)]].forEach((s) => {
      if (new Set(s[1]).size !== s[1].length) p.push(s[0] + ' duplicate milestone id');
    });
    for (const m of msMs) {
      if (!Array.isArray(m.depends_on)) p.push(m.id + ':depends_on');
      if (!m.completion) p.push(m.id + ':completion');
      if (!m.verify) p.push(m.id + ':verify');
      if (STATUSES.indexOf(m.status) === -1) p.push(m.id + ':status');
    }
    for (const m of planMs) {
      if (!Array.isArray(m.depends_on)) p.push(m.id + ':depends_on');
      if (!m.completion) p.push(m.id + ':completion');
      if (!m.verify) p.push(m.id + ':verify');
      if (STATUSES.indexOf(m.status) === -1) p.push(m.id + ':status');
    }
    for (const b of prdBlocks) for (const f of MS_FIELDS) if (!b.fields[f]) p.push(b.id + ':' + f);
    cOk = p.length === 0;
    cEv = cOk ? (prdBlocks.length + ' PRD blocks + ' + msMs.length + ' + ' + planMs.length +
      ' JSON milestones carry depends_on/completion/verify/status (7 PRD fields); count and id sets agree across the three stores (derived, not hardcoded)') : p.join(', ');
  }
  add('C', 'C: every milestone has depends_on/completion/verify/status', cOk, cEv);

  /* D - every Verify command resolves to a real script / real command in the package. */
  let dOk = false, dEv = 'prerequisite parse failed';
  if (ready) {
    const cmds = [];
    (ms.milestones || []).forEach((m) => { if (m.verify) cmds.push(m.verify); });
    (plan.milestones || []).forEach((m) => { if (m.verify) cmds.push(m.verify); });
    prdVerifyLines(prdText).forEach((c) => cmds.push(c));
    const p = [];
    cmds.forEach((c) => verifyProblems(c).forEach((x) => p.push(c + ' -> ' + x)));
    dOk = cmds.length > 0 && p.length === 0;
    dEv = dOk ? (cmds.length + ' Verify commands resolve to real scripts present in the package') : p.join(' | ');
  }
  add('D', 'D: verify commands reference real scripts', dOk, dEv);

  /* E - main_line is a valid topological order; relations are acyclic, no dangling ids. */
  let eOk = false, eEv = 'prerequisite parse failed';
  if (ready) {
    const p = [];
    const planW = (plan.work_units || []).map((w) => w.id);
    const msW = [];
    Object.values(ms.sub_lines || {}).forEach((arr) => arr.forEach((id) => msW.push(id)));
    mainLineOk(ms.milestones || [], ms.main_line).forEach((x) => p.push('ms: ' + x));
    mainLineOk(plan.milestones || [], plan.main_line).forEach((x) => p.push('plan: ' + x));
    relationsOk(ms.relations || [], msW).forEach((x) => p.push('ms: ' + x));
    relationsOk(plan.relations || [], planW).forEach((x) => p.push('plan: ' + x));
    eOk = p.length === 0;
    eEv = eOk ? ('both main_lines are valid topological orders; ' + (plan.relations || []).length + ' + ' + (ms.relations || []).length + ' relations acyclic, no dangling ids') : p.join(' | ');
  }
  add('E', 'E: main_line topological + relations acyclic + no dangling ids', eOk, eEv);

  /* F - charter fields are real, specific, non-placeholder; evaluation = PDCA, no live score. */
  let fOk = false, fEv = 'prerequisite parse failed';
  if (ready) {
    const c = plan.charter || {};
    const keys = ['purpose', 'technical_resources', 'evaluation', 'side_purpose'];
    const p = [];
    for (const k of keys) {
      const v = c[k];
      if (typeof v !== 'string' || v.trim().length < 8) p.push(k + ': missing/short');
      else if (/^not set$/i.test(v.trim()) || /^demo charter$/i.test(v.trim())) p.push(k + ': placeholder text');
      else if (placeholderMarkers(v).length) p.push(k + ': placeholder marker');
      else if (bannedHits(v).length) p.push(k + ': banned phrase');
    }
    if (typeof c.evaluation === 'string') {
      if (c.evaluation.indexOf('PDCA') === -1) p.push('evaluation: no PDCA');
      if (c.evaluation.indexOf('docs/TASK-LOG.md') === -1) p.push('evaluation: no docs/TASK-LOG.md');
      if (/\d/.test(c.evaluation)) p.push('evaluation: numeric live score');
    } else p.push('evaluation: missing');
    if (typeof c.side_purpose === 'string' && c.side_purpose.length > 120) p.push('side_purpose: too long for sidebar');
    fOk = p.length === 0;
    fEv = fOk ? ('4 charter fields real; evaluation names PDCA + docs/TASK-LOG.md, no numeric score') : p.join(' | ');
  }
  add('F', 'F: charter fields non-placeholder', fOk, fEv);

  /* X - cross-file consistency and work-unit structure (>=14 units, >=2 per milestone, >=10 edges)
     plus three-store milestone status equality (PRD Status vs milestones.json vs milestone-plan.json). */
  let xOk = false, xEv = 'prerequisite parse failed';
  if (ready) {
    const p = [];
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (!eq(ms.main_line, plan.main_line)) p.push('main_line mismatch');
    if (!eq(ms.sub_lines, plan.sub_lines)) p.push('sub_lines mismatch');
    if (!eq(ms.relations, plan.relations)) p.push('relations mismatch');
    const wu = plan.work_units || [];
    if (wu.length < 14) p.push('work_units < 14');
    const mIds = (plan.milestones || []).map((m) => m.id);
    const wIds = wu.map((w) => w.id);
    const wset = new Set(wIds);
    if (wset.size !== wIds.length) p.push('duplicate work unit id');
    for (const w of wu) {
      if (mIds.indexOf(w.milestone_id) === -1) p.push(w.id + ': bad milestone_id');
      if (OWNER_TYPES.indexOf(w.owner_type) === -1) p.push(w.id + ': bad owner_type');
      if (STATUSES.indexOf(w.status) === -1) p.push(w.id + ': bad status');
      if (TIERS.indexOf(w.tier) === -1) p.push(w.id + ': bad tier');
      if (!(typeof w.progress === 'number' && w.progress >= 0 && w.progress <= 100)) p.push(w.id + ': progress');
      if (!(typeof w.start_offset_h === 'number' && typeof w.end_offset_h === 'number' && w.start_offset_h < w.end_offset_h)) p.push(w.id + ': offsets');
      if (!(typeof w.billed === 'number' && typeof w.cost === 'number')) p.push(w.id + ': billed/cost');
    }
    for (const m of (plan.milestones || [])) if (!(m.start_offset_h < m.end_offset_h)) p.push(m.id + ': offsets');
    const sub = plan.sub_lines || {};
    const wOf = {};
    wu.forEach((w) => { wOf[w.id] = w; });
    for (const k of mIds) {
      /* Every milestone needs an explicit sub_lines entry; it may be empty
         only when the milestone owns no work units (M7 in I-020). */
      if (!Object.prototype.hasOwnProperty.call(sub, k)) p.push(k + ': no sub_lines entry');
      const arr = sub[k] || [];
      const owned = wu.filter((w) => w.milestone_id === k);
      if (arr.length < 2 && owned.length > 0) p.push(k + ': <2 work units');
      for (const id of arr) {
        if (!wset.has(id)) p.push(k + ': dangling sub_line id ' + id);
        else if (wOf[id].milestone_id !== k) {
          p.push(id + ': in sub_lines of ' + k + ' but milestone_id=' + wOf[id].milestone_id);
        }
      }
      for (const w of owned) if (arr.indexOf(w.id) === -1) {
        p.push(w.id + ': milestone_id ' + k + ' not listed in its sub_line');
      }
    }
    const union = new Set();
    Object.values(sub).forEach((arr) => arr.forEach((id) => union.add(id)));
    if (union.size !== wIds.length) p.push('sub_lines do not cover all work units');
    if ((plan.relations || []).length < 10) p.push('relations < 10');
    /* Goals: when the plan carries a goals layer, every milestone must sit in
       exactly one goal (I-020 acceptance: goal rows group the tree). */
    if (Array.isArray(plan.goals)) {
      const covered = new Set();
      for (const g of plan.goals) {
        const gid = g && g.id ? String(g.id) : '(goal without id)';
        if (!g || !g.id || !g.title || !Array.isArray(g.milestone_ids) || !g.milestone_ids.length) {
          p.push('goal shape: ' + gid + ' needs id, title and a non-empty milestone_ids');
          continue;
        }
        for (const mid of g.milestone_ids) {
          if (mIds.indexOf(mid) === -1) p.push(gid + ': unknown milestone ' + mid);
          if (covered.has(mid)) p.push(mid + ': covered by more than one goal');
          covered.add(mid);
        }
      }
      for (const id of mIds) if (!covered.has(id)) p.push(id + ': no goal');
    }
    const prdStatus = {};
    parsePrdMilestones(prdText).forEach((b) => { prdStatus[b.id] = b.fields.Status; });
    const msStatus = {};
    (ms.milestones || []).forEach((m) => { msStatus[m.id] = m.status; });
    for (const m of (plan.milestones || [])) {
      const pv = prdStatus[m.id] === undefined ? 'MISSING' : prdStatus[m.id];
      const mv = msStatus[m.id] === undefined ? 'MISSING' : msStatus[m.id];
      const sv = m.status === undefined ? 'MISSING' : m.status;
      if (pv !== sv || mv !== sv) {
        p.push(m.id + ': status divergent prd=' + pv + ' ms=' + mv + ' plan=' + sv);
      }
    }
    xOk = p.length === 0;
    xEv = xOk ? (wu.length + ' work units, >=2 for every milestone that owns units, ' +
      (plan.relations || []).length + ' relations; main_line/sub_lines/relations consistent across both files; ' +
      (Array.isArray(plan.goals) ? plan.goals.length + ' goals cover ' + mIds.length + ' milestones exactly once; ' : '') +
      (plan.milestones || []).length + ' milestone statuses equal across prd/ms/plan') : p.join(' | ');
  }
  add('X', 'X: cross-file consistency + work-unit structure', xOk, xEv);

  return checks;
}

function report(checks) {
  let passed = 0;
  for (const c of checks) {
    console.log((c.ok ? 'PASS  ' : 'FAIL  ') + c.label + ' :: ' + c.evidence);
    if (c.ok) passed += 1;
  }
  console.log('PRD-TO-ACTION GATE: ' + passed + '/' + checks.length + ' passed');
  return { passed, total: checks.length, exitCode: passed === checks.length ? 0 : 2 };
}

function readText(p) { return fs.readFileSync(p, 'utf8'); }

function loadInputs() {
  return { prd: readText(P_PRD), ms: readText(P_MS), plan: readText(P_PLAN) };
}

function main() {
  let inputs;
  try { inputs = loadInputs(); }
  catch (e) {
    console.log('FAIL  load: inputs :: ' + e.message);
    console.log('PRD-TO-ACTION GATE: 0/1 passed');
    process.exit(2);
    return;
  }
  const r = report(runChecks(inputs.prd, inputs.ms, inputs.plan));
  process.exit(r.exitCode);
}

function negative() {
  let inputs;
  try { inputs = loadInputs(); }
  catch (e) {
    console.log('NEGATIVE CONTROL: FAIL :: cannot load inputs: ' + e.message);
    process.exit(1);
    return;
  }
  const INJECT = 'works correctly';
  const tmp = path.join(os.tmpdir(), 'prd-to-action-negative-' + process.pid + '.md');
  const out = [];
  let proven = false;
  try {
    const injection = '\n## Negative-control injection\n\nThe gantt ' + INJECT + ' after this line.\n';
    fs.writeFileSync(tmp, inputs.prd + injection, 'utf8');
    const tampered = readText(tmp);

    const cleanChecks = runChecks(inputs.prd, inputs.ms, inputs.plan);
    const cleanPassed = cleanChecks.filter((c) => c.ok).length;
    const cleanExit = cleanPassed === cleanChecks.length ? 0 : 2;

    const tamperedChecks = runChecks(tampered, inputs.ms, inputs.plan);
    const A = tamperedChecks.find((c) => c.id === 'A');
    const othersFailed = tamperedChecks.filter((c) => c.id !== 'A' && !c.ok).map((c) => c.id);
    const tamperedPassed = tamperedChecks.filter((c) => c.ok).length;
    const tamperedExit = tamperedPassed === tamperedChecks.length ? 0 : 2;

    const originalUntouched = readText(P_PRD) === inputs.prd;
    const injectedCount = tampered.toLowerCase().split(INJECT).length - 1;
    const detected = !!(A && !A.ok && A.evidence.indexOf(INJECT) !== -1);

    out.push('PRD-TO-ACTION NEGATIVE CONTROL (discrimination test)');
    out.push((tmp && injectedCount >= 1 ? 'PASS  ' : 'FAIL  ') + 'negative: temp PRD copy built :: ' + tmp + ' (injected "' + INJECT + '" ' + injectedCount + 'x)');
    out.push((originalUntouched ? 'PASS  ' : 'FAIL  ') + 'negative: original docs/PRD.md untouched :: ' + originalUntouched);
    out.push((cleanExit === 0 ? 'PASS  ' : 'FAIL  ') + 'negative: clean PRD gate exit :: ' + cleanExit + ' (' + cleanPassed + '/' + cleanChecks.length + ' passed)');
    out.push((tamperedExit === 2 ? 'PASS  ' : 'FAIL  ') + 'negative: tampered PRD gate exit :: ' + tamperedExit + ' (' + tamperedPassed + '/' + tamperedChecks.length + ' passed)');
    out.push((detected ? 'PASS  ' : 'FAIL  ') + 'negative: gate A detects the injected phrase :: ' + (A ? A.evidence : 'missing'));
    out.push((othersFailed.length === 0 ? 'PASS  ' : 'FAIL  ') + 'negative: no other gate fired (discrimination) :: other failures=[' + othersFailed.join(',') + ']');

    proven = detected && cleanExit === 0 && tamperedExit === 2 && originalUntouched && injectedCount >= 1 && othersFailed.length === 0;
    out.push(proven
      ? 'NEGATIVE CONTROL: PASS :: gate DETECTED "' + INJECT + '" and would exit 2; discrimination proven'
      : 'NEGATIVE CONTROL: FAIL :: gate did not discriminate as expected');
    if (proven) out.push('(this mode exits 2 by design: 2 is the expected DETECT signal, not a failure)');
  } catch (e) {
    out.push('NEGATIVE CONTROL: FAIL :: ' + e.message);
    proven = false;
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) { /* best effort */ }
  }
  for (const l of out) console.log(l);
  process.exit(proven ? 2 : 1);
}

if (process.argv.indexOf('--negative') !== -1) negative();
else main();
