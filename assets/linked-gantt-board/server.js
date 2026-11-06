/**
 * BACKGROUND: Serves the command panel and is the ONLY door to panel state. Jobs
 * write JSON handoff files; this service imports them into SQLite. The TypeScript
 * UI never reads raw files - every human edit lands through PUT endpoints. It
 * also exposes the S2 ACK command loop, S4 health/backup/restore endpoints and a
 * DEMO/degraded state contract for external verification drivers.
 * CONDITIONS: Node >= 22.5; PORT via PANEL_PORT (default 4174); ./data writable;
 * backups under ./data/backups/; POST /shutdown exits 0 after responding.
 * GET /healthz is unauthenticated liveness. Errors surface as HTTP 400 + {error}
 * so callers can see the error code. Exit 1 on unhandled request error.
 * VERSION: 2.0.0 - state/tasks/columns/issues/command/snapshot/import/shutdown
 * plus acks (POST/GET/PUT), /healthz, backup/restore.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./db');

const ROOT = __dirname;
const PORT = Number(process.env.PANEL_PORT || 4174);
const VERSION = '2.0.0';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(body);
}
function json(res, code, obj) { send(res, code, JSON.stringify(obj)); }
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    const method = req.method || 'GET';

    if (p === '/shutdown' && method === 'POST') {
      json(res, 200, { ok: true, stopping: true });
      setTimeout(() => { server.close(() => process.exit(0)); }, 60);
      return;
    }
    if (p === '/healthz' && method === 'GET') {
      return json(res, 200, Object.assign({
        ok: true, service: 'command-panel', version: VERSION, port: PORT,
        time: new Date().toISOString(),
      }, store.degradedInfo()));
    }
    if (p === '/api/state' && method === 'GET') return json(res, 200, store.state());
    if (p === '/api/snapshot' && method === 'POST') return json(res, 200, store.snapshot());

    /* S2 ACK command loop. */
    if (p === '/api/acks' && method === 'GET') return json(res, 200, store.listAcks());
    if (p === '/api/acks' && method === 'POST') return json(res, 200, store.createAck(await body(req)));
    if (p === '/api/backup' && method === 'POST') return json(res, 200, store.backup());
    if (p === '/api/restore' && method === 'POST') {
      const data = await body(req);
      return json(res, 200, store.restore(String(data.file || data.name || '')));
    }

    let m;
    if ((m = p.match(/^\/api\/acks\/(.+)$/)) && method === 'PUT') {
      return json(res, 200, store.updateAck(decodeURIComponent(m[1]), await body(req)));
    }
    if ((m = p.match(/^\/api\/tasks\/(.+)$/))) {
      const id = decodeURIComponent(m[1]);
      if (method === 'PUT') return json(res, 200, store.updateTask(id, await body(req)));
      if (method === 'DELETE') return json(res, 200, store.deleteTask(id));
    }
    if (p === '/api/tasks' && method === 'POST') return json(res, 200, store.createTask(await body(req)));

    if ((m = p.match(/^\/api\/columns\/(.+)\/move$/)) && method === 'POST') {
      const data = await body(req);
      return json(res, 200, store.moveColumn(decodeURIComponent(m[1]), Number(data.dir) || 0));
    }
    if ((m = p.match(/^\/api\/columns\/(.+)$/))) {
      const id = decodeURIComponent(m[1]);
      if (method === 'PUT') return json(res, 200, store.updateColumn(id, await body(req)));
      if (method === 'DELETE') return json(res, 200, store.deleteColumn(id));
    }
    if (p === '/api/columns' && method === 'POST') return json(res, 200, store.createColumn(await body(req)));

    if ((m = p.match(/^\/api\/issues\/(.+)$/)) && method === 'PUT') {
      return json(res, 200, store.updateIssue(decodeURIComponent(m[1]), await body(req)));
    }
    if (p === '/api/command' && method === 'PUT') return json(res, 200, store.setCommand((await body(req)).text));
    /* R20 task relationships. */
    if (p === '/api/task-deps' && method === 'GET') return json(res, 200, store.listTaskDeps());
    if (p === '/api/task-deps' && method === 'PUT') {
      const d = await body(req);
      return json(res, 200, store.setTaskDep(String(d.from || ''), String(d.to || ''), String(d.type || 'FS'), Number(d.lag || 0)));
    }
    if ((m = p.match(/^\/api\/task-deps\/(.+)\/(.+)$/))) {
      const from = decodeURIComponent(m[1]);
      const to = decodeURIComponent(m[2]);
      if (method === 'DELETE') return json(res, 200, store.deleteTaskDep(from, to));
    }
    if (p === '/api/baseline' && method === 'POST') return json(res, 200, store.snapshotBaseline());
    if (p === '/api/meta' && method === 'PUT') return json(res, 200, store.setCharter(await body(req)));
    if ((m = p.match(/^\/api\/import\/(.+)$/)) && method === 'POST') {
      return json(res, 200, store.importHandoff(decodeURIComponent(m[1])));
    }

    if (p.startsWith('/api/')) return json(res, 404, { error: 'unknown endpoint', path: p });

    /* Static: UI assets only. /data (handoff + SQLite) is never served. */
    let rel = p === '/' ? '/panel.html' : p;
    const file = path.resolve(ROOT, '.' + rel);
    if (!file.startsWith(ROOT + path.sep) || file.startsWith(path.join(ROOT, 'data'))) {
      return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    }
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, '404 Not Found', 'text/plain; charset=utf-8');
      send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
    });
  } catch (e) {
    json(res, 400, { error: String(e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(`command-panel ready: http://localhost:${PORT}/  (POST /shutdown to stop)`);
});
