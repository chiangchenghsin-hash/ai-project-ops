#!/usr/bin/env node
/**
 * BACKGROUND: A-10 T4 trust-boundary CI evidence (docs/TASK-LOG.md 2026-11-17
 * A-10 LOCK). Boots assets/linked-gantt-board/server.js on probe port 4199 and
 * asserts the trust-boundary contract, then shuts down via POST /shutdown:
 *   a. GET /healthz -> 200 + X-Content-Type-Options: nosniff
 *   b. POST /api/snapshot with cross-origin Origin -> 403 (mutation refused)
 *   c. POST /api/snapshot with NO Origin -> 200 (non-browser clients allowed)
 *   d. POST /api/snapshot with same-origin Origin -> 200 (panel allowed)
 *   e. POST /api/tasks with >1MiB body -> 413 (body cap; no state written)
 * State hygiene (MATFIX-01 W3 lesson): the panel.db trio may be created by the
 * boot; this script deletes ONLY the runtime-state files it created itself and
 * never touches pre-existing ones. The probe is state-clean by construction
 * (snapshot route does not mutate). Exit 0 iff every assertion passes and the
 * server exits 0. CONDITIONS: node >= 22.5; stdlib only. VERSION: 1.0.0
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 4199;
const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'assets', 'linked-gantt-board', 'server.js');
const DATA = path.join(ROOT, 'assets', 'linked-gantt-board', 'data');
const TRIO = ['panel.db', 'panel.db-wal', 'panel.db-shm'].map(f => path.join(DATA, f));
const BASE = 'http://127.0.0.1:' + PORT;
const T = AbortSignal.timeout(8000);

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? 'PROBE PASS :: ' : 'PROBE FAIL :: ') + name + ' :: ' + detail);
}

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(BASE + '/healthz', { signal: T });
      if (r.ok) return true;
    } catch (_) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

async function main() {
  const preExisting = TRIO.map(f => fs.existsSync(f));
  const child = spawn(process.execPath, [SERVER], {
    env: Object.assign({}, process.env, { PANEL_PORT: String(PORT) }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', d => process.stdout.write('[server] ' + d));
  child.stderr.on('data', d => process.stderr.write('[server] ' + d));
  const exitCode = new Promise(r => child.on('exit', c => r(c)));

  try {
    const up = await waitReady();
    check('server up on ' + PORT, up, up ? 'healthz ok' : 'healthz never answered');
    if (!up) throw new Error('server did not become ready');

    // a. nosniff on a JSON response
    const h = await fetch(BASE + '/healthz', { signal: T });
    const nosniff = (h.headers.get('x-content-type-options') || '').toLowerCase() === 'nosniff';
    check('nosniff header', h.status === 200 && nosniff, 'status=' + h.status + ' xcto=' + h.headers.get('x-content-type-options'));

    // b. cross-origin mutation -> 403
    const b = await fetch(BASE + '/api/snapshot', {
      method: 'POST', signal: T,
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: '{}',
    });
    check('cross-origin mutation refused', b.status === 403, 'status=' + b.status);

    // c. no-Origin mutation -> 200 (non-browser client allowed)
    const c = await fetch(BASE + '/api/snapshot', {
      method: 'POST', signal: T,
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    check('no-Origin mutation allowed', c.status === 200, 'status=' + c.status);

    // d. same-origin mutation -> 200
    const d = await fetch(BASE + '/api/snapshot', {
      method: 'POST', signal: T,
      headers: { 'content-type': 'application/json', origin: BASE },
      body: '{}',
    });
    check('same-origin mutation allowed', d.status === 200, 'status=' + d.status);

    // e. oversize body -> 413 (body-reading route; rejected before any state write)
    const big = JSON.stringify({ title: 'x'.repeat(1200 * 1024) });
    const e = await fetch(BASE + '/api/tasks', {
      method: 'POST', signal: T,
      headers: { 'content-type': 'application/json' },
      body: big,
    });
    check('oversize body refused', e.status === 413, 'status=' + e.status);
  } finally {
    try {
      await fetch(BASE + '/shutdown', {
        method: 'POST', signal: T,
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
    } catch (_) { /* server may already be down */ }
    const code = await Promise.race([exitCode, new Promise(r => setTimeout(() => r('timeout'), 8000))]);
    check('clean shutdown', code === 0, 'exit=' + code);
    // state hygiene: remove only runtime files this probe created
    TRIO.forEach((f, i) => {
      if (!preExisting[i] && fs.existsSync(f)) {
        fs.rmSync(f, { force: true });
        console.log('PROBE CLEANUP :: removed probe-created ' + path.basename(f));
      }
    });
  }

  const failed = results.filter(r => !r.ok);
  console.log(failed.length
    ? 'TRUST PROBE: FAIL (' + failed.length + '/' + results.length + ' assertions failed)'
    : 'TRUST PROBE: PASS (' + results.length + '/' + results.length + ' assertions)');
  return failed.length ? 1 : 0;
}

main().then(code => process.exit(code)).catch(e => { console.error('trust-probe FAILED: ' + e.message); process.exit(1); });
