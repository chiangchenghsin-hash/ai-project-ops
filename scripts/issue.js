#!/usr/bin/env node
/**
 * BACKGROUND: Closes the broken link between an AI session and the issue ledger.
 * The panel's issues table was writable in the store layer but no API route and
 * no agent-side entry point existed, so an AI had no path to update open
 * questions. This CLI is that path. It works OFFLINE (no server, no Chrome),
 * writes a committable JSON ledger and records a per-session delta that the
 * Stop hook checks. It best-effort mirrors into SQLite only when the DB already
 * exists; it never creates a database as a side effect.
 * CONDITIONS: Node >= 18. Root = AIOPS_ROOT or the parent of scripts/.
 * Commands: list | add | update | close | no-new | regen-doc. Exit 0 on
 * success, 1 on bad input, 2 on ledger write failure. Every write appends to
 * docs/evidence/issue-delta.json. Never edits docs/TASK-LOG.md (main session
 * owns it). Set AIOPS_SESSION to override the session id.
 * VERSION: 1.2.0 - regen-doc: renders docs/DISCIPLINE-ISSUES.md from
 * docs/evidence/issues.json (counts and row table derived, deterministic).
 * 1.1.0 - I-028: the SQLite mirror upserts (INSERT missing rows,
 * refresh existing ones) through db.js upsertIssue, so every add/update/close
 * lands in panel.db instead of reporting "issue not found"; still only when
 * the DB file already exists (no implicit database create).
 * 1.0.1 - issue status vocabulary unified to open/done (close marks done).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.env.AIOPS_ROOT || path.resolve(__dirname, '..');
const LEDGER = path.join(ROOT, 'docs/evidence/issues.json');
const DELTA = path.join(ROOT, 'docs/evidence/issue-delta.json');
const DB = path.join(ROOT, 'assets/linked-gantt-board/data/panel.db');
const SESSION = process.env.AIOPS_SESSION ||
  (fs.existsSync(path.join(ROOT, 'docs/evidence/session.json'))
    ? JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/evidence/session.json'), 'utf8')).session_id
    : 'no-session');

function args() {
  const out = { _: [] };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].slice(2);
      const v = (a[i + 1] && !a[i + 1].startsWith('--')) ? a[++i] : true;
      out[k] = v;
    } else out._.push(a[i]);
  }
  return out;
}

function read() {
  if (!fs.existsSync(LEDGER)) return { schema: 'ai-project-ops.issue-ledger/1.0', issues: [] };
  return JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
}
function write(data) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(data, null, 2) + '\n');
}
function delta(action, id, note) {
  fs.mkdirSync(path.dirname(DELTA), { recursive: true });
  let d = { schema: 'ai-project-ops.issue-delta/1.0', events: [] };
  if (fs.existsSync(DELTA)) {
    try { d = JSON.parse(fs.readFileSync(DELTA, 'utf8')); } catch (_) { /* rebuild */ }
  }
  d.events.push({ ts: new Date().toISOString(), session_id: SESSION, action, id, note: note || '' });
  fs.writeFileSync(DELTA, JSON.stringify(d, null, 2) + '\n');
}
/* I-028a: the mirror upserts the FULL ledger row (not a field patch), so a
   brand-new id INSERTs into panel.db and an existing one refreshes in place.
   Still gated on the DB file existing - this CLI never creates a database. */
function mirrorSQLite(row) {
  if (!fs.existsSync(DB)) return 'skipped: no panel.db';
  try {
    const store = require(path.join(ROOT, 'assets/linked-gantt-board/db.js'));
    if (typeof store.upsertIssue === 'function') {
      store.upsertIssue(row);
      return 'mirrored to SQLite';
    }
    return 'skipped: no upsertIssue export';
  } catch (e) { return 'mirror failed: ' + e.message; }
}

function render(data) {
  const rows = data.issues.map(i =>
    `| ${i.id} | ${i.status} | ${i.title} | ${i.source} | ${i.reply || '-'} |`);
  return ['| id | status | title | source | reply |', '|---|---|---|---|---|'].concat(rows).join('\n');
}

function cell(v) {
  return String(v == null || v === '' ? '-' : v)
    .replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim() || '-';
}
function counts(data) {
  const open = data.issues.filter(i => i.status !== 'done').length;
  return { total: data.issues.length, done: data.issues.length - open, open };
}
/* Deterministic: no timestamps, ledger order preserved, every number derived
   from docs/evidence/issues.json. */
function renderDoc(data) {
  const c = counts(data);
  const rows = data.issues.map(i =>
    `| ${i.id} | ${cell(i.status)} | ${cell(i.title)} | ${cell(i.reply)} |`);
  const table = ['| id | status | title | reply |', '|---|---|---|---|'].concat(rows).join('\n');
  return `# Discipline deficit ledger (skill's own defects)

> Machine source: \`docs/evidence/issues.json\`. This human-readable snapshot is
> GENERATED from that file by the main session; edit issues with
> \`node scripts/issue.js ...\`, never by hand.
> This is a committable artifact ABOUT the skill itself, not the project's
> in-flight SQLite issue ledger (section 9 keeps those apart).

Regenerate with \`node scripts/issue.js regen-doc\`.

Source: two human reports from real usage (2026-11-08) plus defects found by the main session. ${c.total} registered, ${c.done} done, ${c.open} open.

${table}
OPEN = ${c.open}.

## What this ledger proves

The complaint "you refuse to update the issue ledger" was itself entry I-001.
Registering it was the fix, not a description of the fix. C7 added I-008..I-012
from the second human report and I-013 from the main session's re-check; every
one carries a reply with pasted evidence, and only the main session closed
them. I-006 was CORRECTED at C9: the arrow-line overlay was ALREADY built
(\`gantt.ts:139-154\`, \`:308\`). Current state is always the count line above
(${c.total} registered, ${c.done} done, ${c.open} open) - never a cached
sentence. A stale open item is itself a defect: re-check the code before
asserting "still open", and never report a partial fix as done.

## Rules

1. Session start: \`node scripts/issue.js list\`. Read it before planning.
2. Any new question, defect or scope change gets an \`add\` in the SAME turn.
3. Any answered question gets an \`update\` or \`close\` with a reason.
4. No new issue -> \`no-new --reason\`, still a ledger event.
5. I1 in the Stop hook blocks a turn that leaves the ledger untouched.
6. Only the main session closes an issue, after pasted verification evidence.
`;
}

function main() {
  const a = args();
  const cmd = a._[0];
  const data = read();

  if (cmd === 'list') {
    console.log(render(data));
    console.log('OPEN=' + data.issues.filter(i => i.status !== 'done').length);
    return 0;
  }
  if (cmd === 'regen-doc') {
    const doc = renderDoc(data);
    fs.writeFileSync(path.join(ROOT, 'docs/DISCIPLINE-ISSUES.md'), doc);
    const c = counts(data);
    console.log('PASS  regen-doc :: docs/DISCIPLINE-ISSUES.md | ' +
      c.total + ' registered, ' + c.done + ' done, ' + c.open + ' open');
    return 0;
  }
  if (cmd === 'no-new') {
    const reason = String(a.reason || '').trim();
    if (!reason) { console.error('no-new requires --reason'); return 1; }
    delta('no-new-issues', '-', reason);
    console.log('PASS  no-new-issues recorded :: ' + reason);
    return 0;
  }
  if (cmd === 'add') {
    if (!a.id || !a.title) { console.error('add requires --id and --title'); return 1; }
    if (data.issues.some(i => i.id === a.id)) { console.error('issue exists: ' + a.id); return 1; }
    data.issues.push({
      id: String(a.id), title: String(a.title), source: String(a.source || 'ai-session'),
      detail: String(a.detail || ''), reply: '', enddate: String(a.enddate || ''),
      urgent: a.urgent ? 1 : 0, status: 'open', opened: new Date().toISOString(),
    });
    write(data);
    delta('add', a.id, a.title);
    console.log('PASS  issue added :: ' + a.id + ' | ' + mirrorSQLite(data.issues[data.issues.length - 1]));
    return 0;
  }
  if (cmd === 'update' || cmd === 'close') {
    if (!a.id) { console.error(cmd + ' requires --id'); return 1; }
    const it = data.issues.find(i => i.id === String(a.id));
    if (!it) { console.error('issue not found: ' + a.id); return 1; }
    if (a.status !== undefined && a.status !== 'open' && a.status !== 'done') {
      console.error("invalid --status: " + a.status +
        " (allowed values: 'open', 'done'; the close command marks an issue done)");
      return 1;
    }
    if (a.reply !== undefined) it.reply = String(a.reply);
    if (a.status !== undefined) it.status = String(a.status);
    if (a.enddate !== undefined) it.enddate = String(a.enddate);
    if (a.urgent !== undefined) it.urgent = a.urgent && a.urgent !== '0' ? 1 : 0;
    if (cmd === 'close') it.status = 'done';
    it.updated = new Date().toISOString();
    write(data);
    delta(cmd, a.id, it.reply || it.status);
    console.log('PASS  issue ' + cmd + ' :: ' + a.id + ' | ' + mirrorSQLite(it));
    return 0;
  }
  console.error('usage: issue.js list|add|update|close|no-new|regen-doc [--id --title --source --detail --reply --status --urgent --enddate --reason]');
  return 1;
}
try { process.exit(main()); } catch (e) { console.error('issue.js FAILED: ' + e.message); process.exit(2); }
