/**
 * BACKGROUND: One launcher for the panel (start|stop|open). The UI can stop its
 * own server through POST /shutdown; this CLI uses the same endpoint for `stop`.
 * CONDITIONS: Node >= 22.5; PORT via PANEL_PORT (default 4174); writes
 * data/panel.pid for crash recovery; `open` uses the OS default browser on win32.
 * Exit codes: 0 ok, 1 bad args, 2 server unreachable / stop failed.
 * VERSION: 1.0.0 - start/stop/open over the /shutdown contract.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PANEL_PORT || 4174);
const URL = `http://localhost:${PORT}/`;
const PID_FILE = path.join(ROOT, 'data', 'panel.pid');
const cmd = (process.argv[2] || '').toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * True only when something is already listening AND it is this service.
 * Any 2xx on "/" is not proof: another application can hold the port, and
 * treating it as ours would silently skip startup and leave a wrong panel
 * running. /healthz carries the service identity for exactly this check.
 */
async function alive() {
  try {
    const r = await fetch(new URL('/healthz', URL), { signal: AbortSignal.timeout(800) });
    if (!r.ok) return false;
    const body = await r.json();
    return !!body && body.service === 'command-panel';
  } catch (_e) { return false; }
}

async function start() {
  if (await alive()) { console.log('already running: ' + URL); return 0; }
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT, detached: true, stdio: 'ignore',
    env: { ...process.env, PANEL_PORT: String(PORT) },
  });
  child.unref();
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(PID_FILE, String(child.pid));
  for (let i = 0; i < 40; i += 1) {
    if (await alive()) { console.log('started: ' + URL + ' (pid ' + child.pid + ')'); return 0; }
    await sleep(150);
  }
  console.error('server did not become ready'); return 2;
}

async function stop() {
  if (!await alive()) { console.log('not running'); return 0; }
  try {
    const r = await fetch(`http://localhost:${PORT}/shutdown`, { method: 'POST' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    console.log('stopped via /shutdown');
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    return 0;
  } catch (e) {
    console.error('stop failed: ' + e.message); return 2;
  }
}

function open() {
  const u = URL;
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', u], { detached: true, stdio: 'ignore' }).unref();
  else if (process.platform === 'darwin') spawn('open', [u], { detached: true, stdio: 'ignore' }).unref();
  else spawn('xdg-open', [u], { detached: true, stdio: 'ignore' }).unref();
  console.log('opening: ' + u); return 0;
}

(async () => {
  if (cmd === 'start') process.exit(await start());
  if (cmd === 'stop') process.exit(await stop());
  if (cmd === 'open') process.exit(open());
  console.error('usage: panel.bat start|stop|open');
  process.exit(1);
})();
