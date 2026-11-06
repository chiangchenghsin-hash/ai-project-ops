/**
 * BACKGROUND: One-command end-to-end gate for the shipped reference panel.
 * Replaces a manual multi-terminal dance (start server, start Chrome with CDP,
 * run selftest, stop everything) with a single reproducible driver that always
 * tears its processes down. It is the execution/consumer-load layer that turns
 * "the page opens" into pasted PASS lines from a real headless Chrome.
 * CONDITIONS: Run from anywhere (root derived from this file). Node >= 22.5
 * (server.js uses node:sqlite; selftest.js uses global fetch + WebSocket),
 * Python is not required. A Chrome/Chromium binary is required; override with
 * CHROME_PATH or CHROME_BIN. Ports default to 4174 (PANEL_PORT) and 9224
 * (CDP_PORT) and both read from the environment, so a run can sit beside a
 * live panel instead of colliding with it. The server is started directly (not
 * via panel.js) with PANEL_PORT; Chrome is launched with --headless=new
 * --remote-debugging-port=CDP_PORT --no-proxy-server pointing at the panel URL.
 * Demo SQLite runtime state (data/panel.db*) created
 * by a run is removed afterwards; files that pre-existed are never touched.
 * Exit codes: 0 = every step passed, non-zero = first failing step's code
 * (missing binary / health timeout / CDP timeout / selftest non-zero all
 * propagate). No npm dependencies, standard library only.
 * VERSION: 1.2.0 - 1.1.0 initial E2E driver (C2); 1.2.0 GitHub publication.
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BOARD = path.join(ROOT, 'assets', 'linked-gantt-board');
const SERVER = path.join(BOARD, 'server.js');
const SELFTEST = path.join(BOARD, 'selftest.js');
const PORT = Number(process.env.PANEL_PORT || 4174);
const CDP_PORT = Number(process.env.CDP_PORT || 9224);
const BASE = 'http://127.0.0.1:' + PORT;
const CDP = 'http://127.0.0.1:' + CDP_PORT;

let server = null;
let chrome = null;
let chromeProfile = null;
let stepCode = 0;
const preexistingState = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(...a) { console.log('[verify]', ...a); }
function fail(msg, code) {
  console.error('[verify] ERROR:', msg);
  if (!stepCode) stepCode = code || 1;
}

function httpGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    let done = false;
    const req = http.get(url, (res) => {
      res.resume();
      done = true;
      resolve(res.statusCode);
    });
    req.on('error', (e) => { if (!done) { done = true; reject(e); } });
    req.setTimeout(timeoutMs || 1500, () => {
      req.destroy();
      if (!done) { done = true; reject(new Error('timeout')); }
    });
  });
}

function httpPost(url) {
  return new Promise((resolve) => {
    const req = http.request(url, { method: 'POST' }, (res) => {
      res.resume();
      resolve(res.statusCode || 0);
    });
    req.on('error', () => resolve(0));
    req.setTimeout(2000, () => { req.destroy(); resolve(0); });
    req.end();
  });
}

async function waitFor(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = await httpGet(url, 1200);
      if (status === 200) return;
    } catch (_e) { /* endpoint not up yet */ }
    await sleep(200);
  }
  throw new Error(label + ' did not become ready at ' + url);
}

function findChrome() {
  const env = process.env.CHROME_PATH || process.env.CHROME_BIN;
  if (env) return env;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (_e) { /* ignore */ }
  }
  return process.platform === 'win32' ? 'chrome.exe' : 'google-chrome';
}

function runtimeStatePaths() {
  const d = path.join(BOARD, 'data');
  const out = ['panel.db', 'panel.db-shm', 'panel.db-wal', 'panel.pid']
    .map((n) => path.join(d, n));
  const backups = path.join(d, 'backups');
  if (fs.existsSync(backups)) {
    for (const n of fs.readdirSync(backups)) {
      if (n.endsWith('.db')) out.push(path.join(backups, n));
    }
  }
  return out;
}

function runSelftest() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SELFTEST], {
      cwd: BOARD,
      env: { ...process.env, PANEL_PORT: String(PORT), CDP_PORT: String(CDP_PORT) },
      stdio: 'inherit',
    });
    child.on('error', (e) => { fail('selftest spawn error: ' + e.message, 2); resolve(2); });
    child.on('exit', (c) => resolve(c === null ? 1 : c));
  });
}

function killChrome() {
  if (!chrome || chrome.killed || chrome.exitCode !== null) return;
  const pid = chrome.pid;
  try { chrome.kill('SIGTERM'); } catch (_e) { /* already gone */ }
  if (process.platform === 'win32' && pid) {
    try { spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch (_e) { /* ignore */ }
  }
}

async function shutdownServer() {
  if (!server || server.exitCode !== null) return;
  await httpPost(BASE + '/shutdown');
  for (let i = 0; i < 30 && server.exitCode === null; i += 1) await sleep(100);
  if (server.exitCode === null) {
    try { server.kill('SIGTERM'); } catch (_e) { /* ignore */ }
    await sleep(300);
    if (server.exitCode === null) {
      try { server.kill('SIGKILL'); } catch (_e) { /* ignore */ }
    }
  }
}

async function cleanup() {
  try { await shutdownServer(); }
  catch (e) { fail('shutdown error: ' + e.message, 2); }
  killChrome();
  if (chromeProfile) {
    try { fs.rmSync(chromeProfile, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
  for (const p of runtimeStatePaths()) {
    if (!preexistingState.has(p) && fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
        log('removed runtime state ' + path.relative(ROOT, p));
      } catch (_e) { /* ignore */ }
    }
  }
}

async function main() {
  if (!fs.existsSync(SERVER)) throw new Error('missing ' + SERVER);
  if (!fs.existsSync(SELFTEST)) throw new Error('missing ' + SELFTEST);

  for (const p of runtimeStatePaths()) {
    if (fs.existsSync(p)) preexistingState.add(p);
  }
  if (preexistingState.size) log('note: pre-existing runtime state present; not modified');

  log('starting server.js with PANEL_PORT=' + PORT);
  server = spawn(process.execPath, [SERVER], {
    cwd: BOARD,
    env: { ...process.env, PANEL_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => process.stdout.write('[server] ' + d));
  server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  server.on('error', (e) => fail('server spawn error: ' + e.message, 2));

  await waitFor(BASE + '/healthz', 15000, 'GET /healthz');
  log('GET /healthz -> 200');

  chromeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'aiops-verify-chrome-'));
  const chromeBin = findChrome();
  const chromeArgs = [
    '--headless=new',
    '--remote-debugging-port=' + CDP_PORT,
    '--remote-allow-origins=*',
    '--no-proxy-server',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-dev-shm-usage',
    '--user-data-dir=' + chromeProfile,
    '--window-size=1440,900',
    'http://localhost:' + PORT + '/',
  ];
  log('launching Chrome: ' + chromeBin + ' -> http://localhost:' + PORT + '/');
  chrome = spawn(chromeBin, chromeArgs, { stdio: 'ignore' });
  chrome.on('error', (e) => fail('chrome spawn error: ' + e.message, 2));

  await waitFor(CDP + '/json/version', 20000, 'CDP /json/version');
  log('CDP endpoint -> 200 on port ' + CDP_PORT);

  log('running selftest.js');
  const code = await runSelftest();
  if (code !== 0) fail('selftest.js exited with code ' + code, code || 1);
  else log('selftest.js exited 0');
}

(async () => {
  try { await main(); }
  catch (e) { fail(e.message, 2); }
  finally { await cleanup(); }
  if (stepCode) {
    console.error('[verify] RESULT: FAIL (exit ' + stepCode + ')');
    process.exit(stepCode);
  }
  console.log('[verify] RESULT: PASS (exit 0)');
  process.exit(0);
})();
