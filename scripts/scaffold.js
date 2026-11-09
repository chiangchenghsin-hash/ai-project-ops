#!/usr/bin/env node
/**
 * BACKGROUND: C5 made template instantiation mandatory. C8 wires the R17
 * competitive finding that was never used: Monday's Managed templates
 * (master -> instance -> Publish) and Notion's "defaults affect future
 * instances only". A cold reader (R4) found v2.0.0 overstated three claims:
 * --status printed presence not version drift, --publish only checked a role,
 * and the four benchmark templates had no instances at all. v2.1.0 fixes all
 * three with real version comparison, a real version bump, and --all.
 * CONDITIONS: Node >= 18. Root = AIOPS_ROOT or parent of scripts/. Requires
 * templates/registry.json. Default instantiates docs/TASK-LOG.md and
 * docs/PLAN.md (plus --brief). `--all` instantiates EVERY registry master with
 * an instance path. `--publish <id>` requires publish_role=owner, bumps the
 * patch version in the registry and records the publish event in the lock.
 * `--status` reads the lock and reports IN-SYNC / DRIFT / NO-LOCK /
 * PRE-EXISTING per instance. Existing instance files are NEVER overwritten.
 * Exit 0 success / 1 bad input / 2 refused or write error.
 * VERSION: 2.1.0 - real drift, real publish bump, --all instantiation (C8/R4).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.env.AIOPS_ROOT || path.resolve(__dirname, '..');
const T = path.join(ROOT, 'templates');
const D = path.join(ROOT, 'docs');
const REG = path.join(T, 'registry.json');
const LOCK = path.join(ROOT, 'docs/evidence/template-lock.json');
const args = process.argv.slice(2);

function registry() {
  if (!fs.existsSync(REG)) { console.error('missing registry: templates/registry.json'); process.exit(1); }
  return JSON.parse(fs.readFileSync(REG, 'utf8'));
}
function readLock() {
  if (!fs.existsSync(LOCK)) return { schema: 'ai-project-ops.template-lock/1.0', instances: [], publishes: [] };
  try {
    const l = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
    l.instances = l.instances || []; l.publishes = l.publishes || [];
    return l;
  } catch (_) { return { schema: 'ai-project-ops.template-lock/1.0', instances: [], publishes: [] }; }
}
function writeLock(lock) {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
}
function bump(v) {
  const p = String(v).split('.').map(Number);
  if (p.length !== 3 || p.some(isNaN)) return v;
  p[2] += 1;
  return p.join('.');
}

try {
  const reg = registry();
  const byId = (id) => reg.masters.find(m => m.id === id);
  const lock = readLock();

  if (args.includes('--publish')) {
    const id = args[args.indexOf('--publish') + 1];
    const m = byId(id);
    if (!m) { console.error('unknown template id: ' + (id || '(none)')); process.exit(1); }
    if (m.publish_role !== 'owner') {
      console.error('PUBLISH REFUSED: ' + id + ' has publish_role=' + m.publish_role);
      process.exit(2);
    }
    const oldV = m.version;
    m.version = bump(oldV);
    fs.writeFileSync(REG, JSON.stringify(reg, null, 2) + '\n');
    lock.publishes.push({ id, from: oldV, to: m.version,
      published_at: new Date().toISOString(), master: m.master });
    writeLock(lock);
    console.log('PASS  published :: ' + id + ' v' + oldV + ' -> v' + m.version +
      ' (owner); existing instances NOT rewritten');
    process.exit(0);
  }

  if (args.includes('--status')) {
    console.log('PASS  registry loaded :: ' + reg.masters.length + ' masters');
    reg.masters.forEach(m => {
      if (!m.instance) return;
      const rec = lock.instances.find(x => x.instance === m.instance);
      const present = fs.existsSync(path.join(ROOT, m.instance));
      let state = 'NO-LOCK';
      if (rec && rec.pre_existing) state = 'PRE-EXISTING (version assumed, not proven)';
      else if (rec && rec.master_version === m.version) state = 'IN-SYNC';
      else if (rec) state = 'DRIFT lock=v' + rec.master_version + ' master=v' + m.version;
      console.log('STATE ' + m.id + ' master=v' + m.version +
        ' instance=' + (present ? 'present' : 'absent') + ' -> ' + state);
    });
    process.exit(0);
  }

  fs.mkdirSync(D, { recursive: true });
  const ALL = args.includes('--all');
  const jobs = ALL
    ? reg.masters.filter(m => m.instance)
    : [byId('task-log'), byId('plan')].filter(Boolean);
  if (args.includes('--brief') && !ALL) {
    const b = byId('subagent-brief');
    if (b) jobs.push(b);
  }
  let created = 0;
  for (const m of jobs) {
    const from = path.join(ROOT, m.master), to = path.join(ROOT, m.instance);
    if (!fs.existsSync(from)) { console.error('missing master: ' + m.master); process.exit(1); }
    if (fs.existsSync(to)) {
      console.log('PASS  scaffold present :: ' + m.instance + ' (not overwritten)');
      if (!lock.instances.some(x => x.instance === m.instance)) {
        lock.instances.push({ instance: m.instance, master: m.master,
          master_version: m.version, instantiated_at: null,
          pre_existing: true,
          note: 'Instance predates the registry; master version is assumed, not proven.' });
      }
      continue;
    }
    const body = fs.readFileSync(from, 'utf8')
      .replace('<YYYY-MM-DD HH:MM>', new Date().toISOString().slice(0, 16).replace('T', ' '));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, body);
    lock.instances.push({ instance: m.instance, master: m.master,
      master_version: m.version, instantiated_at: new Date().toISOString(),
      benchmark: m.benchmark });
    created++;
    console.log('PASS  scaffold created :: ' + m.instance + ' from ' + m.master +
      ' v' + m.version + ' (' + body.split('\n').length + ' lines)');
  }
  writeLock(lock);
  console.log('PASS  template lock written :: ' + lock.instances.length +
    ' instances, ' + created + ' newly created');
  process.exit(0);
} catch (e) {
  console.error('scaffold.js FAILED: ' + e.message);
  process.exit(2);
}
