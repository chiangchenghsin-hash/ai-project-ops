#!/usr/bin/env node
/**
 * BACKGROUND: The human reported that the AI "refuses to update the issue
 * ledger every time". Prose instructions inside SKILL.md were never executed
 * because nothing injected them at session start. This UserPromptSubmit hook
 * writes a pre-session snapshot and emits a short reminder into context, so the
 * ledger and the mandatory closing actions are visible BEFORE any work starts.
 * CONDITIONS: Node >= 18. Root = AIOPS_ROOT or parent of scripts/. Reads stdin
 * JSON but does not depend on it (hooks may pass an empty stream). Output is
 * kept under 120 tokens by design. Never blocks: always exits 0, even on error.
 * AIOPS_SESSION overrides the session id. Writes docs/evidence/session.json.
 * VERSION: 1.0.0 - initial start-of-turn injection (C5 discipline layer).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.AIOPS_ROOT || path.resolve(__dirname, '..');
const EVID = path.join(ROOT, 'docs/evidence');
const SESSION = process.env.AIOPS_SESSION ||
  ('s-' + new Date().toISOString().slice(0, 10) + '-' + crypto.randomBytes(3).toString('hex'));

function count(pattern, file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return 0;
  return (fs.readFileSync(p, 'utf8').match(pattern) || []).length;
}
function openIssues() {
  const p = path.join(EVID, 'issues.json');
  if (!fs.existsSync(p)) return -1;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')).issues.filter(i => i.status !== 'done').length;
  } catch (_) { return -1; }
}

try {
  fs.mkdirSync(EVID, { recursive: true });
  const snap = {
    schema: 'ai-project-ops.session-snapshot/1.0',
    session_id: SESSION,
    started_at: new Date().toISOString(),
    pdca_entries: count(/^### /gm, 'docs/TASK-LOG.md'),
    pdca_bytes: fs.existsSync(path.join(ROOT, 'docs/TASK-LOG.md'))
      ? fs.statSync(path.join(ROOT, 'docs/TASK-LOG.md')).size : 0,
    open_issues: openIssues(),
    templates_present: ['docs/TASK-LOG.md', 'docs/PLAN.md'].filter(f =>
      fs.existsSync(path.join(ROOT, f))),
  };
  fs.writeFileSync(path.join(EVID, 'session.json'), JSON.stringify(snap, null, 2) + '\n');
  const n = snap.open_issues < 0 ? 'UNKNOWN' : String(snap.open_issues);
  process.stdout.write(
    '<discipline-gate-reminder>\n' +
    'OPEN ISSUES: ' + n + '. Before ending this turn you MUST:\n' +
    '1. Run `node scripts/issue.js list`; then add/update an issue, or run `no-new --reason ...`.\n' +
    '2. Append ONE PDCA entry to docs/TASK-LOG.md with pasted Check evidence.\n' +
    '3. Ensure docs/PLAN.md exists (run `node scripts/scaffold.js` if absent).\n' +
    'The Stop hook runs discipline-gate.js. Missing steps BLOCK the turn.\n' +
    '</discipline-gate-reminder>\n');
} catch (e) {
  process.stderr.write('session-start degraded: ' + e.message + '\n');
}
process.exit(0);
