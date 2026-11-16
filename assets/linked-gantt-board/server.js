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
 * TRUST BOUNDARY (loopback human-AI tool): the socket binds 127.0.0.1 only;
 * Host must be localhost:PORT or 127.0.0.1:PORT (DNS-rebinding guard);
 * mutations (PUT/POST/DELETE) allow only same-origin Origin or no Origin
 * (curl / Node fetch / battery api() send none) and refuse any other Origin
 * with 403 {error}; GET stays open on the loopback socket. Request bodies
 * cap at 1 MiB -> 413 {error} with stream abort (never buffer past the cap).
 * Responses carry X-Content-Type-Options: nosniff. CSP is DEFERRED as a named
 * follow-up (inline-handler audit risk in panel UI) - not set here.
 * VERSION: 2.5.0 - I-035 R35: GET /api/stats serves store.stats - the pure
 * ops-stats derivation (approval pass / human wait / completion / member
 * load) with zero writes; additive route, no frozen contract changed.
 * 2.4.0 - I-038 R32: PUT /api/plan/structure now serves six kinds
 * through the same door (store.planStructureUpdate: move | apply-template |
 * create-milestone | create-work-unit | update-node | delete-node); the four
 * node CRUD kinds run store's plan-sync-class four-store atomic commit and
 * answer 400 with zero writes on any refusal. Additive - no route, contract
 * or frozen field changed. 2.3.0 - I-033: GET /api/tasks/:id/audit (store.taskAudit) returns
 * the desk events naming the task plus the TASK-LOG PDCA entry ids naming it;
 * additive, no frozen contract changed. 2.2.0 - I-031: PUT /api/plan/structure (store.planStructureUpdate:
 * move | apply-template, validated + atomic, 400 with zero writes on failure)
 * and GET/POST /api/templates (store.listTemplates / store.saveTemplate,
 * additive wbs_templates table). 2.1.0 - desk_events log + /api/events
 * (queryable history for the desk sheets)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./db');

const ROOT = __dirname;
const PORT = Number(process.env.PANEL_PORT || 4174);
const VERSION = require('./package.json').version; /* one panel version: package.json is the single source */
/* Trust boundary: max JSON request body. Over this -> 413, stream aborted. */
const MAX_BODY_BYTES = 1024 * 1024; /* 1 MiB */
const LOOPBACK_HOSTS = ['localhost:' + PORT, '127.0.0.1:' + PORT];
const SAME_ORIGIN = ['http://localhost:' + PORT, 'http://127.0.0.1:' + PORT];
/* I-019: the four desk sheets are the allowed desk_events units. */
const EVENT_UNITS = ['command', 'ack', 'signal', 'job'];
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}
function json(res, code, obj) { send(res, code, JSON.stringify(obj)); }

/* Host guard (all methods): only the panel's own loopback names. Blocks
   DNS-rebinding (Host: evil.example -> 127.0.0.1). */
function hostAllowed(req) {
  return LOOPBACK_HOSTS.indexOf(String(req.headers.host || '')) >= 0;
}

/* Exact Origin rule for mutations (PUT/POST/DELETE), evaluated before any
   body read:
     - no Origin header (Node fetch, curl, battery api() helper) -> allow;
     - Origin http://localhost:PORT or http://127.0.0.1:PORT -> allow
       (same-origin browser panel);
     - any other Origin (including "null") -> refuse 403 {error}.
   GET/HEAD are not Origin-gated; the loopback bind is their boundary. */
function mutationOriginAllowed(req) {
  const origin = req.headers.origin;
  if (origin === undefined) return true; /* non-browser client */
  return SAME_ORIGIN.indexOf(String(origin)) >= 0;
}

function body(req) {
  return new Promise((resolve, reject) => {
    /* Fast path: declared length already over the cap - refuse, drain, never
       buffer. Streaming/chunked bodies are caught in the data handler. */
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_BODY_BYTES) {
      const err = new Error('request body exceeds 1MB limit');
      err.statusCode = 413;
      req.resume(); /* drain without accumulating */
      reject(err);
      return;
    }
    let s = '';
    let size = 0;
    let refused = false;
    req.on('data', (c) => {
      if (refused) return; /* already over the cap: stop accumulating */
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        /* Abort the stream once past the cap - do not buffer unbounded. */
        refused = true;
        s = '';
        const err = new Error('request body exceeds 1MB limit');
        err.statusCode = 413;
        reject(err);
        req.pause();
        setImmediate(() => { try { req.resume(); } catch (_e) { /* socket gone */ } });
        return;
      }
      s += c; /* bounded: only while size <= MAX_BODY_BYTES */
    });
    req.on('end', () => {
      if (refused) return;
      try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); }
    });
    req.on('error', (e) => { if (!refused) reject(e); });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    const method = req.method || 'GET';

    /* Trust boundary first: Host (all methods), then Origin on mutations. */
    if (!hostAllowed(req)) {
      return json(res, 403, { error: 'forbidden host' });
    }
    if (method === 'PUT' || method === 'POST' || method === 'DELETE') {
      if (!mutationOriginAllowed(req)) {
        return json(res, 403, { error: 'cross-origin mutation refused' });
      }
    }

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
    /* Read-only milestone plan (PRD ingestion, invariant I9). Never served as
       a raw /data/ file: the UI consumes this JSON contract only. */
    if (p === '/api/plan' && method === 'GET') return json(res, 200, store.plan());
    /* I-031: the one structure write path (move | apply-template). Validation
       failures throw inside store.* and surface as 400 with zero writes. */
    if (p === '/api/plan/structure' && method === 'PUT') {
      return json(res, 200, store.planStructureUpdate(await body(req)));
    }
    /* I-031: WBS template library (built-ins + saved subtrees). */
    if (p === '/api/templates' && method === 'GET') return json(res, 200, store.listTemplates());
    if (p === '/api/templates' && method === 'POST') return json(res, 200, store.saveTemplate(await body(req)));
    /* I-035: ops stats - pure derivation, zero writes (db.js stats()). */
    if (p === '/api/stats' && method === 'GET') return json(res, 200, store.stats());
    if (p === '/api/snapshot' && method === 'POST') return json(res, 200, store.snapshot());

    /* S2 ACK command loop. */
    if (p === '/api/acks' && method === 'GET') return json(res, 200, store.listAcks());
    if (p === '/api/acks' && method === 'POST') return json(res, 200, store.createAck(await body(req)));
    /* C9 B1/B6: read-only policy reference tables (seeded from ./data JSON). */
    if (p === '/api/policy/approvals' && method === 'GET') return json(res, 200, store.listApprovals());
    if (p === '/api/policy/owner-scope' && method === 'GET') return json(res, 200, store.listOwnerScopes());
    if (p === '/api/backup' && method === 'POST') return json(res, 200, store.backup());
    if (p === '/api/restore' && method === 'POST') {
      const data = await body(req);
      return json(res, 200, store.restore(String(data.file || data.name || '')));
    }

    let m;
    /* I-033: per-card audit trail. Registered before the generic task route
       so the trailing /audit segment is not mistaken for a task id. */
    if ((m = p.match(/^\/api\/tasks\/(.+)\/audit$/)) && method === 'GET') {
      return json(res, 200, store.taskAudit(decodeURIComponent(m[1])));
    }
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
    /* I-019: queryable desk event history for the four desk sheets. */
    if (p === '/api/events' && method === 'GET') {
      const unit = url.searchParams.get('unit');
      if (unit && EVENT_UNITS.indexOf(unit) < 0) {
        return json(res, 400, { error: 'unknown unit: ' + unit + ' (allowed: ' + EVENT_UNITS.join(', ') + ')' });
      }
      return json(res, 200, {
        events: store.listEvents({
          unit: unit || undefined,
          q: url.searchParams.get('q') || undefined,
          limit: url.searchParams.get('limit') || undefined,
        }),
      });
    }
    if (p === '/api/events' && method === 'POST') return json(res, 200, store.createEvent(await body(req)));
    /* R20 task relationships. */
    if (p === '/api/task-deps' && method === 'GET') return json(res, 200, store.listTaskDeps());
    if (p === '/api/task-deps' && method === 'PUT') {
      const d = await body(req);
      /* I-030: nature rides the same PUT; '' = unspecified, vocab validated in db.js. */
      return json(res, 200, store.setTaskDep(String(d.from || ''), String(d.to || ''),
        String(d.type || 'FS'), Number(d.lag || 0),
        d.nature === undefined || d.nature === null ? '' : String(d.nature)));
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
    /* New control statuses only: 413 = body over the 1 MiB cap. */
    if (e && e.statusCode === 413) {
      return json(res, 413, { error: String(e.message || 'request body exceeds 1MB limit') });
    }
    json(res, 400, { error: String(e.message || e) });
  }
});

/* Loopback only - never all interfaces. */
server.listen(PORT, '127.0.0.1', () => {
  console.log(`command-panel ready: http://localhost:${PORT}/  (POST /shutdown to stop)`);
});
