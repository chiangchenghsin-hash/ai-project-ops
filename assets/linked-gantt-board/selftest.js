/**
 * BACKGROUND: End-to-end gate for the command panel. Replaces manual clicking
 * with a real Chrome driven over CDP: verifies the SQLite/API data contract,
 * linked drag, hour snapping, cost-first labels, dark mode, clipboard fallback
 * and reload persistence, then captures screenshots as evidence. It also drives
 * the S2 ACK command loop, S4 health/backup/restore and the DEMO/degraded
 * declarations directly against the HTTP API so an external verify.js can use it.
 * CONDITIONS: server on PANEL_PORT (default 4174); Chrome --headless=new
 * --remote-debugging-port=CDP_PORT (default 9224) opened at the panel URL;
 * Node >= 22 (global WebSocket + fetch). Every assertion prints
 * "PASS  <english label> :: <evidence>"; a FAIL prints "FAIL" and the script
 * exits non-zero (1 failed assertion, 2 fatal harness error).
 * VERSION: 3.3.0 - R35 section 37 adds the I-035 ops stats gates
 * (/api/stats demo JSON paste, two-calls-identical zero-write proof,
 * per-metric table+filter source scan, empty-source n/a render through the
 * patchStats override seam, SQL cross-check, Meter tiles DOM above the token
 * meter with desc member-load bars).
 * 3.2.0 - R35 section 36 adds the I-034 SOP template pack gates
 * (library listing with the lock step names, [use] apply output line with
 * 4 units + 3 FS links lag 0 nature mandatory + pending, writeNodeStores
 * commit checks, save-chain round-trip, APPROVAL badges exactly on 3 review
 * / 3 verify, gateFromScope approval floor incl. a provisioned human fixture
 * card, goal refusal 400, six WBS templates unchanged, gates after every
 * apply, byte-identical finally restore with row-level DML only).
 * 3.1.0 - R31 section 32 adds the I-032 hour-axis humanization
 * gates (purpose header, NOW flag, tooltip, past-hours shade, shared status
 * palette) and the I-033 card AI-field gates (model/confidence/gate badge,
 * confidence threshold + Settings row, per-card audit popover, red-line-1
 * anthropomorphism scan); fixture task + desk events provisioned and
 * restored in finally. 3.0.0 - English localization, env PANEL_PORT/CDP_PORT, >=30
 * assertions covering ACK flow / approve / done / reject-with-reason /
 * rejections.json / error-code visibility / blocking signals / DEMO flag /
 * /healthz / backup / restore / degraded declaration / three-state labels /
 * no-CJK-in-UI, plus all original cases. G2 adds two-view switching, the
 * milestone main/sub/relation layer, critical path, plan charter, empty
 * state and the macOS 27 glass transparency control.
 */
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PANEL_PORT || 4174);
const CDP_PORT = Number(process.env.CDP_PORT || 9224);
const CDP = `http://127.0.0.1:${CDP_PORT}`;
const BASE = `http://localhost:${PORT}`;
const OUT = __dirname;
const REJECT_REASON = 'Contract scope not signed off by human';
const results = [];
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} :: ${detail === undefined ? '' : detail}`);
}
/** One verification assertion. Named PASS so a plain grep counts each case. */
function PASS(name, ok, evidence) { record(name, ok, evidence); }

let seq = 0;
const pending = new Map();
let ws;
/* R32 allowlist (intent: no UNEXPECTED console errors): section 35 drives the
   INTENTIONAL refusal paths (progress=100 outside done, the 1-unit delete
   floor) through the real /api/plan/structure door, so the browser logs the
   expected "Failed to load resource: 400" line for that exact URL. Only the
   pair (400 + /api/plan/structure) is exempt; every other error still counts
   against the section-35 delta and the final runtime gate. */
function expectedStructure400(e) {
  return e.indexOf('/api/plan/structure') >= 0 && e.indexOf('400') >= 0;
}
function unexpectedErrors() {
  return errors.filter((e) => !expectedStructure400(e));
}
function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function js(expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || ''));
  return r.result.value;
}
async function until(expression, pred, timeout = 5000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    last = await js(expression);
    if (pred(last)) return last;
    await sleep(120);
  }
  return last;
}
async function findTarget() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`${CDP}/json/list`)).json();
      const t = list.find((x) => x.type === 'page' && x.url.includes(`localhost:${PORT}`));
      if (t) return t;
    } catch (_e) { /* waiting */ }
    await sleep(250);
  }
  throw new Error('Chrome debug page not found on port ' + CDP_PORT);
}
async function ready() {
  for (let i = 0; i < 60; i += 1) {
    try { if (await js('typeof CP !== "undefined" && !!CP.store.state && document.querySelectorAll(".gbar").length > 0')) return; }
    catch (_e) { /* waiting */ }
    await sleep(200);
  }
  throw new Error('Panel did not initialize');
}

/**
 * R19 D4: the server owns its data directory; this script must not assume it
 * is ./data under its own file. The server reports the location on /api/state.
 * Fallback keeps the script running on a pre-fix tree so the assertion can go
 * red instead of crashing.
 */
let SERVER_DATA_DIR = '';
function dataDir() {
  return SERVER_DATA_DIR || path.join(OUT, 'data');
}

/** Node-side HTTP helper for the API-level assertions (no browser needed). */
async function api(method, p, data) {
  const r = await fetch(BASE + p, {
    method,
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let payload = null;
  try { payload = await r.json(); } catch (_e) { payload = null; }
  return { status: r.status, body: payload };
}

async function main() {
  const target = await findTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + m.params.exceptionDetails.text);
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console: ' + m.params.args.map((a) => a.value || a.description || '').join(' '));
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      /* The deliberate /data/ 403 probe is expected, not a runtime error. */
      if (!(m.params.entry.url || '').includes('/data/')) errors.push('log: ' + m.params.entry.text + (m.params.entry.url || ''));
    }
  };
  await cmd('Runtime.enable'); await cmd('Page.enable'); await cmd('Log.enable'); await cmd('Network.enable');
  await cmd('Browser.grantPermissions', { origin: BASE, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await cmd('Page.navigate', { url: BASE + '/' });
  await sleep(1100);
  await js('localStorage.clear()');
  await cmd('Page.reload', { ignoreCache: true });
  await sleep(900);
  await ready();

  /* 0. Identity: prove the browser is running THIS package, not another
     panel that happens to share the port. A fork of this starter kit also
     answers /healthz with service=command-panel, so compare the rendered
     title with the title declared in this package's own panel.html. */
  const htmlSrc = fs.readFileSync(path.join(OUT, 'panel.html'), 'utf8');
  const wantTitle = ((htmlSrc.match(/<title>([^<]*)<\/title>/) || [])[1] || '').trim();
  const gotTitle = (await js('document.title') || '').trim();
  if (!wantTitle || gotTitle !== wantTitle) {
    record('Page identity: the tab runs this package', false, 'want=' + JSON.stringify(wantTitle) + ' got=' + JSON.stringify(gotTitle));
    console.log('\nResult: 0/1 passed; refused to test a foreign page');
    ws.close();
    process.exit(1);
  }
  PASS('Page identity: the tab runs this package', true, gotTitle);

  /* 1. Data contract */
  const init = await js(`(async () => ({
    tasks: CP.store.state.tasks.length,
    columns: CP.store.state.columns.length,
    rounds: CP.store.state.rounds.length,
    issues: CP.store.state.issues.length,
    jobs: CP.store.state.jobs.length,
    billed: CP.store.state.totals.billed,
    resources: performance.getEntriesByType('resource').map(r=>r.name).filter(n=>n.includes('/data/')).length,
    handoff: (await fetch('/data/rounds.json')).status
  }))()`);
  PASS('SQLite handoff import: 15 units / 3 columns / 6 rounds / 5 issues / 5 jobs',
    init.tasks === 15 && init.columns === 3 && init.rounds === 6 && init.issues === 5 && init.jobs === 5, JSON.stringify(init));
  PASS('UI never reads raw JSON: /data/ returns 403 and no /data/ resources',
    init.handoff === 403 && init.resources === 0, `status=${init.handoff} resources=${init.resources}`);

  /* 2. Hour axis / cost-first / placeholders / lanes. R36 retarget: the hour
     axis sits under the [Hour axis] tab of the Work board, so the block
     activates that view AND that tab (measurements run against the ACTIVE
     tab); every assertion intent below is unchanged. */
  await js(`document.querySelector('[data-view=board]').click()`);
  await js(`CP.switchWbTab('axis')`);
  await sleep(180);
  const axis = await js(`(() => {
    const bars = Array.from(document.querySelectorAll('.gbar'));
    const lanes = Array.from(document.querySelectorAll('.gantt-lane-track'));
    let overlap = 0;
    lanes.forEach(l => {
      const b = Array.from(l.querySelectorAll('.gbar')).map(x=>({l:x.offsetLeft,r:x.offsetLeft+x.offsetWidth})).sort((a,b)=>a.l-b.l);
      for (let i=1;i<b.length;i++) if (b[i].l < b[i-1].r - 1) overlap++;
    });
    const t3 = document.querySelector('.gbar[data-task-id="t3"] .gbar-label').textContent;
    return {
      ticks: document.querySelectorAll('.gtick').length,
      tickSample: document.querySelector('.gtick span').textContent,
      midnight: document.querySelectorAll('.gtick.midnight').length,
      now: document.querySelectorAll('.now-line').length,
      minWidth: Math.min(...bars.map(b=>b.offsetWidth)),
      overlap, t3,
      placeholders: Array.from(document.querySelectorAll('.gbar.placeholder')).map(b=>({x:b.offsetLeft,t:b.textContent.trim()})),
      nowX: parseFloat(document.querySelector('.now-line').style.left),
      scrollLeft: document.getElementById('ganttScroll').scrollLeft,
      visibleBars: (() => {
        const sc = document.getElementById('ganttScroll').getBoundingClientRect();
        return bars.filter(b => { const r = b.getBoundingClientRect(); return r.right > sc.left + 252 && r.left < sc.right; }).length;
      })()
    };
  })()`);
  PASS('Hour axis: 42 12h ticks + midnight grid + NOW line',
    axis.ticks === 42 && axis.midnight > 0 && axis.now === 1 && /^\d{2}-\d{2} \d{2}:00$/.test(axis.tickSample),
    JSON.stringify({ ticks: axis.ticks, sample: axis.tickSample, midnight: axis.midnight }));
  PASS('cost-first label (spend before name)', axis.t3.startsWith('103.7M/$2.24'), axis.t3);
  PASS('Min bar width 12h and lane packing has no overlap', axis.minWidth >= 96 && axis.overlap === 0, `min=${axis.minWidth} overlap=${axis.overlap}`);
  PASS('Placeholder bars right of NOW labelled non-commitment',
    axis.placeholders.length === 3 && axis.placeholders.every((p) => p.t.includes('placeholder') && p.t.includes('non-commitment') && p.x + 252 > axis.nowX),
    JSON.stringify(axis.placeholders.map((p) => p.t)));
  PASS('Work board auto-scrolls to NOW, time bars in viewport (R32 retarget: axis moved from the Plan view)',
    axis.scrollLeft > 100 && axis.visibleBars > 0, `scrollLeft=${axis.scrollLeft} visibleBars=${axis.visibleBars}`);
  await js(`CP.switchWbTab('board')`);

  /* 3. Incremental update (DOM node identity preserved) */
  const incr = await js(`(() => {
    const before = document.querySelector('.gbar[data-task-id="t1"]');
    window.__ref = before;
    CP.store.emit();
    return document.querySelector('.gbar[data-task-id="t1"]') === window.__ref;
  })()`);
  PASS('State update is an incremental patch, not a full re-render', incr === true, String(incr));

  /* 4. Gantt drag: hour snapping + optimistic UI + PUT persistence */
  const before = await js(`CP.store.state.tasks.filter(t=>t.id==='t5')[0].start`);
  const drag = await js(`(() => {
    const bar = document.querySelector('.gbar[data-task-id="t5"]');
    const r = bar.getBoundingClientRect();
    const x = r.left + r.width/2, y = r.top + r.height/2;
    const ev = (type,cx) => new PointerEvent(type,{bubbles:true,cancelable:true,button:0,pointerId:1,clientX:cx,clientY:y});
    bar.dispatchEvent(ev('pointerdown',x));
    document.dispatchEvent(ev('pointermove',x+8*3));
    const optimistic = CP.store.state.tasks.filter(t=>t.id==='t5')[0].start;
    document.dispatchEvent(ev('pointerup',x+8*3));
    return {optimistic};
  })()`);
  const dbState = await until(`(async()=>{const r=await fetch('/api/state');const s=await r.json();return s.tasks.filter(t=>t.id==='t5')[0].start})()`,
    (v) => v !== before, 5000);
  PASS('Drag snaps to hour +3h (optimistic UI)', CPDiff(drag.optimistic, before) === 3, `${before} -> ${drag.optimistic}`);
  PASS('PUT persists new time to SQLite', CPDiff(dbState, before) === 3, `${before} -> ${dbState}`);

  /* 5. Kanban cross-column drag -> gantt bar color linkage (one data set) */
  await until(`!!document.querySelector('.kb-list[data-status="done"]')`, (v) => v === true, 3000);
  const linked = await js(`(async () => {
    const card = document.querySelector('.kb-card[data-task-id="t6"]');
    const list = document.querySelector('.kb-list[data-status="done"]');
    const dt = new DataTransfer(); const r = list.getBoundingClientRect();
    const go=(type,el,y)=>el.dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:dt,clientX:r.left+30,clientY:y}));
    go('dragstart',card,r.top+20); go('dragover',list,r.bottom-8); go('drop',list,r.bottom-8);
    document.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));
    await new Promise(r=>setTimeout(r,500));
    const bar = document.querySelector('.gbar[data-task-id="t6"]');
    const col = CP.columnById('done');
    return {status: CP.store.state.tasks.filter(t=>t.id==='t6')[0].status, bg: bar.style.background, col: col.color};
  })()`);
  PASS('Kanban drag drives gantt bar status color',
    linked.status === 'done' && linked.bg.replace(/\s/g, '') === 'rgb(52,199,89)', JSON.stringify(linked));

  /* 6. Custom status column (UI -> SQLite -> kanban column) */
  const custom = await js(`(async () => {
    CP.openColumnManager();
    document.getElementById('newColName').value='On Hold';
    document.querySelector('[data-action=add-col]').click();
    await new Promise(r=>setTimeout(r,600));
    const s = await (await fetch('/api/state')).json();
    const id = s.columns[3] ? s.columns[3].id : '';
    document.querySelector('[data-action=close]').click();
    return {n:s.columns.length, id, dom: document.querySelectorAll('.kb-col').length, label: s.columns[3] ? s.columns[3].label : ''};
  })()`);
  PASS('Custom status column written to SQLite and shown in kanban',
    custom.n === 4 && custom.dom === 4 && custom.label === 'On Hold', JSON.stringify(custom));

  /* 7. Command console: snapshot content + clipboard two paths */
  const clip = await js(`(async () => {
    document.querySelector('[data-view=desk]').click();
    const ta = document.getElementById('nextCommand');
    ta.value = 'Fix G1 layer-ban first, then rerun regression';
    ta.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,450));
    document.getElementById('btnGenerate').click();
    await new Promise(r=>setTimeout(r,350));
    const snap = document.getElementById('snapshotOut').textContent;
    CP.setClipboardFail(false);
    const p1 = await CP.copyText('navigator path');
    CP.setClipboardFail(true);
    return {snap, p1};
  })()`);
  /* The fallback must be verified under a real user gesture: click Send via CDP.
     R19 D5: scroll the button into view before taking its coordinates, and
     poll for the result instead of sleeping a fixed time. The send chain is
     async - snapshot POST, then clipboard - so a fixed wait races it and
     reports the previous value. */
  const btn = await js(`(() => {
    const el = document.getElementById('btnSend');
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return {x:r.left+r.width/2, y:r.top+r.height/2};
  })()`);
  await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.x, y: btn.y, button: 'left', clickCount: 1 });
  await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.x, y: btn.y, button: 'left', clickCount: 1 });
  await until(`window.__copyPath || ''`, (v) => v === 'execCommand' || v === 'failed', 6000);
  const p2 = await js(`window.__copyPath`);
  await js(`CP.setClipboardFail(false)`);
  clip.p2 = p2;
  PASS('Snapshot by service includes command / measured spend / latest round',
    clip.snap.includes('Fix G1') && clip.snap.includes('billed 221.1M') && clip.snap.includes('R6'),
    clip.snap.split('\n')[1] + ' | ' + clip.snap.split('\n')[5]);
  PASS('Clipboard both paths work (navigator + execCommand)',
    clip.p1 === 'navigator' && clip.p2 === 'execCommand', `${clip.p1} / ${clip.p2}`);

  /* 8. Issue ledger reply persisted to SQLite */
  const reply = await js(`(async () => {
    document.querySelector('[data-view=ledger]').click();
    const row = document.querySelector('.issue-row[data-key="ISS-2"]');
    const ta = row.querySelector('.ireply');
    ta.value = 'Review under billed scope';
    ta.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,500));
    const s = await (await fetch('/api/state')).json();
    return s.issues.filter(i=>i.id==='ISS-2')[0].reply;
  })()`);
  PASS('Issue ledger reply written to SQLite via PUT', reply === 'Review under billed scope', reply);

  /* 9. UI hygiene */
  const hygiene = await js(`({
    navDigits: Array.from(document.querySelectorAll('#nav button')).map(b=>b.textContent).join('').replace(/[^0-9]/g,'').length,
    kpi: document.getElementById('kpiTokens').textContent,
    ledgers: document.getElementById('issueBody').children.length
  })`);
  PASS('Buttons/labels carry no dynamic counts', hygiene.navDigits === 0 && hygiene.kpi.includes('M'), JSON.stringify(hygiene));

  /* 10. Light/dark theme */
  await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  const dark = await js(`({bg:getComputedStyle(document.body).backgroundColor, text:getComputedStyle(document.body).color})`);
  PASS('prefers-color-scheme dark theme applies',
    dark.bg === 'rgb(28, 28, 30)' && dark.text === 'rgb(245, 245, 247)', JSON.stringify(dark));
  await js(`document.querySelector('[data-view=plan]').click()`);
  await sleep(220);
  const darkShot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, 'preview-dark.png'), Buffer.from(darkShot.data, 'base64'));
  await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  /* 11. Reload persistence */
  await cmd('Page.reload', { ignoreCache: true });
  await sleep(900); await ready();
  const persisted = await js(`(() => {
    const s = CP.store.state;
    return {start:s.tasks.filter(t=>t.id==='t5')[0].start, status:s.tasks.filter(t=>t.id==='t6')[0].status,
      cols:s.columns.length, cmd:s.meta.next_command, reply:s.issues.filter(i=>i.id==='ISS-2')[0].reply};
  })()`);
  PASS('Reload persists time / status / columns / command / reply',
    CPDiff(persisted.start, before) === 3 && persisted.status === 'done' && persisted.cols === 4 && persisted.cmd.includes('G1') && persisted.reply.includes('billed'),
    JSON.stringify(persisted));

  /* 12. S4 health + state flags (Node-side HTTP, no browser dependency) */
  const health = await api('GET', '/healthz');
  PASS('GET /healthz reports ok + service identity',
    health.status === 200 && health.body && health.body.ok === true && health.body.service === 'command-panel',
    `status=${health.status} service=${health.body && health.body.service}`);

  const st = await api('GET', '/api/state');
  PASS('/api/state advertises the DEMO flag',
    st.status === 200 && st.body && (st.body.DEMO === true || st.body.demo === true),
    `DEMO=${st.body && st.body.DEMO} demo=${st.body && st.body.demo} degraded=${st.body && st.body.degraded}`);
  PASS('Three-state column labels: Pending / In Progress / Done',
    st.body && Array.isArray(st.body.columns) && st.body.columns.slice(0, 3).map((c) => c.label).join(',') === 'Pending,In Progress,Done',
    st.body ? st.body.columns.map((c) => c.label).join(' / ') : 'no state');
  PASS('State endpoint declares degraded=false when SQLite is healthy',
    st.body && st.body.degraded === false, `degraded=${st.body && st.body.degraded}`);

  /* 13. S2 ACK command loop (Node-side HTTP) */
  const a0 = await api('GET', '/api/acks');
  PASS('GET /api/acks returns an array',
    a0.status === 200 && Array.isArray(a0.body), `count=${Array.isArray(a0.body) ? a0.body.length : 'n/a'}`);

  const created = await api('POST', '/api/acks', { snapshot_hash: 'hTESTSNAP', command: 'Verify ACK flow' });
  const A1 = created.body || {};
  PASS('POST /api/acks creates ACK row in ACK state with hash + command',
    created.status === 200 && A1 && A1.state === 'ACK' && A1.snapshot_hash === 'hTESTSNAP' && A1.command === 'Verify ACK flow',
    `id=${A1 && A1.id} state=${A1 && A1.state}`);

  const ap = await api('PUT', '/api/acks/' + encodeURIComponent(A1.id), { action: 'approve' });
  PASS('Approve transitions ACK -> IN_PROGRESS',
    ap.status === 200 && ap.body && ap.body.state === 'IN_PROGRESS', `state=${ap.body && ap.body.state}`);

  const dn = await api('PUT', '/api/acks/' + encodeURIComponent(A1.id), { action: 'done' });
  PASS('Done transition closes the command loop (IN_PROGRESS -> DONE)',
    dn.status === 200 && dn.body && dn.body.state === 'DONE', `state=${dn.body && dn.body.state}`);

  const A2 = (await api('POST', '/api/acks', { snapshot_hash: 'hREJECT', command: 'Reject me' })).body || {};
  const rj = await api('PUT', '/api/acks/' + encodeURIComponent(A2.id), { action: 'reject', reason: REJECT_REASON });
  PASS('Reject-with-reason sets REJECTED + reject_reason',
    rj.status === 200 && rj.body && rj.body.state === 'REJECTED' && rj.body.reject_reason === REJECT_REASON,
    `state=${rj.body && rj.body.state} reason=${rj.body && rj.body.reject_reason}`);

  /* R19 D4: match THIS run's ack id, not the REJECT_REASON constant. The old
     predicate also matched four stale entries already in the file, so a write
     that silently failed would still have gone green. The path comes from the
     server, not from this script's own directory. */
  let rejArr = [];
  try {
    rejArr = JSON.parse(fs.readFileSync(path.join(dataDir(), 'rejections.json'), 'utf8'));
  } catch (_e) { rejArr = []; }
  const mine = Array.isArray(rejArr) ? rejArr.filter((x) => x.id === A2.id) : [];
  PASS('rejections.json records THIS run as a PDCA-style rejection entry',
    mine.length === 1 && mine[0].reason === REJECT_REASON && mine[0].pdca && mine[0].pdca.check === 'ACK.state=REJECTED',
    `ackId=${A2.id} matched=${mine.length} total=${rejArr.length}`);

  const A3 = (await api('POST', '/api/acks', { snapshot_hash: 'hNOREASON', command: 'No reason' })).body || {};
  const bad = await api('PUT', '/api/acks/' + encodeURIComponent(A3.id), { action: 'reject' });
  PASS('Reject without reason -> HTTP 400 with visible error code',
    bad.status === 400 && bad.body && /reason/i.test(String(bad.body.error || '')),
    `status=${bad.status} error=${bad.body && bad.body.error}`);

  const list = await api('GET', '/api/acks');
  const ids = Array.isArray(list.body) ? list.body.map((x) => x.id) : [];
  PASS('GET /api/acks lists the created ACK rows',
    ids.indexOf(A1.id) >= 0 && ids.indexOf(A2.id) >= 0 && ids.indexOf(A3.id) >= 0, `count=${ids.length}`);

  /* 14. S4 backup / restore (Node-side HTTP).
     R19 D4: take the artifact path from the response. Building it locally
     produced a false red when the server writes elsewhere, and a false green
     on the cleanup assertion below, because the local path never existed. */
  const bak = await api('POST', '/api/backup');
  const bakFile = bak.body && bak.body.file ? bak.body.file : '';
  const bakPath = (bak.body && bak.body.path) ? String(bak.body.path) : '';
  PASS('POST /api/backup writes a backup and reports where it is',
    bak.status === 200 && bak.body && bak.body.ok === true && bakFile && bakPath && fs.existsSync(bakPath) && bak.body.bytes > 0,
    `file=${bakFile} path=${bakPath} bytes=${bak.body && bak.body.bytes}`);

  const marker = (await api('POST', '/api/acks', { snapshot_hash: 'hMARKER', command: 'Marker' })).body || {};
  const rst = await api('POST', '/api/restore', { file: bakFile });
  const after = await api('GET', '/api/acks');
  const afterIds = Array.isArray(after.body) ? after.body.map((x) => x.id) : [];
  const a1After = Array.isArray(after.body) ? after.body.filter((x) => x.id === A1.id)[0] : null;
  PASS('POST /api/restore restores (marker removed, approved ACK kept DONE)',
    rst.status === 200 && rst.body && rst.body.ok === true && afterIds.indexOf(marker.id) < 0 && a1After && a1After.state === 'DONE',
    `restored=${rst.body && rst.body.restored} markerGone=${afterIds.indexOf(marker.id) < 0} a1=${a1After && a1After.state}`);
  if (bakPath && fs.existsSync(bakPath)) {
    try { fs.unlinkSync(bakPath); } catch (_e) { /* cleanup failure is reported below */ }
  }
  PASS('backup artifact removed after restore (runtime state never ships)',
    !!bakPath && !fs.existsSync(bakPath), `path=${bakPath}`);

  /* 15. S2 blocking signals + desk-view rendering (CDP) */
  await js(`CP.store.load().then(()=>true).catch(()=>false)`);
  const sig = await js(`(() => {
    const arr = (typeof CP.blockingSignals === 'function') ? CP.blockingSignals() : [];
    return {
      n: arr.length,
      stuck: arr.some(s=>s.kind==='stuck'),
      dependency: arr.some(s=>s.kind==='dependency'),
      urgent: arr.some(s=>s.kind==='urgent_overdue'),
      threshold: CP.STUCK_HOURS
    };
  })()`);
  PASS('Blocking signals: stuck>24h / dependency / urgent+overdue with N=24',
    sig.n > 0 && sig.stuck && sig.dependency && sig.urgent && sig.threshold === 24,
    `n=${sig.n} stuck=${sig.stuck} dep=${sig.dependency} urgent=${sig.urgent} N=${sig.threshold}`);

  const sigDom = await js(`(() => {
    const list = document.getElementById('signalList');
    const heads = Array.from(document.querySelectorAll('#view-desk h2')).map(h=>h.textContent);
    return { children: list ? list.children.length : 0, hasHeader: heads.some(t=>t.includes('Needs human decision')) };
  })()`);
  PASS('"Needs human decision" list rendered in desk view',
    sigDom.children > 0 && sigDom.hasHeader, `items=${sigDom.children} header=${sigDom.hasHeader}`);

  const banner = await js(`(() => { const b=document.getElementById('demoBanner'); return { visible: b && !b.classList.contains('hidden'), text: b ? b.textContent.slice(0,20) : '' }; })()`);
  PASS('DEMO banner visible in UI', banner.visible === true, `visible=${banner.visible} text=${banner.text}`);

  const ackDom = await js(`(() => {
    const list = document.getElementById('ackList');
    return {
      rows: list ? list.querySelectorAll('.ack-row').length : 0,
      approve: list ? list.querySelectorAll('[data-ack=approve]').length : 0,
      reject: list ? list.querySelectorAll('[data-ack=reject]').length : 0
    };
  })()`);
  PASS('ACK list rendered with Approve / Reject buttons',
    ackDom.rows > 0 && ackDom.approve > 0 && ackDom.reject > 0,
    `rows=${ackDom.rows} approve=${ackDom.approve} reject=${ackDom.reject}`);

  const cjk = await js(`(() => {
    const t = document.documentElement.textContent || '';
    for (let i=0;i<t.length;i++) { const c=t.charCodeAt(i);
      if ((c>=0x3400&&c<=0x9fff)||(c>=0xf900&&c<=0xfaff)||(c>=0x3000&&c<=0x303f)||(c>=0xff00&&c<=0xffef)) return true; }
    return false;
  })()`);
  PASS('No CJK characters in the rendered UI', cjk === false, `cjkFound=${cjk}`);

  /* 16. Static declarations (Node-side file scans) */
  const dbSrc = fs.readFileSync(path.join(OUT, 'db.js'), 'utf8');
  PASS('Degraded mode declared in db.js CONDITIONS header',
    /GRACEFUL DEGRADATION/i.test(dbSrc) && /READ-ONLY demo mode/i.test(dbSrc)
      && /state\.degraded\s*=\s*true/i.test(dbSrc) && /require\(['"]node:sqlite['"]\)/.test(dbSrc),
    `header=${/GRACEFUL DEGRADATION/i.test(dbSrc)} readonly=${/READ-ONLY demo mode/i.test(dbSrc)}`);

  const scripts = ['server.js', 'db.js', 'selftest.js', 'panel.js'];
  const hdr = scripts.every((f) => {
    const s = fs.readFileSync(path.join(OUT, f), 'utf8');
    return /BACKGROUND/.test(s) && /CONDITIONS/.test(s) && /VERSION/.test(s);
  });
  PASS('Script header contract (BACKGROUND/CONDITIONS/VERSION) on all .js scripts', hdr, scripts.join(', '));

  /* 17. R18 - send-where-you-type, first-principles charter, sidebar */
  await js(`document.querySelector('[data-view=ledger]').click()`);
  await sleep(220);

  const footBtn = await js(`(() => {
    const b = document.getElementById('btnLedgerSend');
    const g = document.getElementById('btnLedgerGen');
    const out = document.getElementById('ledgerSnapOut');
    return { send: b ? b.textContent.trim() : '', gen: g ? g.textContent.trim() : '', out: !!out };
  })()`);
  PASS('Issue ledger offers send and preview without leaving the tab',
    /Send replies/i.test(footBtn.send) && /snapshot/i.test(footBtn.gen) && footBtn.out,
    JSON.stringify(footBtn));

  /* The row control must be exercised under a real user gesture, because the
     clipboard fallback needs one. Click it through CDP, not through .click(). */
  const ackBefore = (await api('GET', '/api/acks')).body.length;
  const sendPos = await js(`(() => {
    const row = document.querySelector('.issue-row[data-key="ISS-3"]');
    if (!row) return null;
    const b = row.querySelector('.isend');
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  PASS('Every issue row exposes a Send control beside its reply cell', !!sendPos, JSON.stringify(sendPos));

  if (sendPos) {
    await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: sendPos.x, y: sendPos.y, button: 'left', clickCount: 1 });
    await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sendPos.x, y: sendPos.y, button: 'left', clickCount: 1 });
    /* Poll instead of sleeping a fixed time. The send chain is async
       (snapshot POST, then clipboard, then ACK POST) and a fixed wait races it. */
    await until(`window.__copyPath || ''`, (v) => v === 'execCommand' || v === 'failed', 6000);
    const sent = await js(`({
      copy: window.__copyPath || '',
      toast: document.getElementById('toast').textContent,
      acks: document.querySelectorAll('#ackList .ack-row').length
    })`);
    const ackAfter = (await api('GET', '/api/acks')).body.length;
    PASS('Row Send runs the whole chain: save reply, copy snapshot, open ACK',
      sent.copy !== '' && ackAfter === ackBefore + 1 && sent.acks > 0,
      `copyPath=${sent.copy} acks ${ackBefore} -> ${ackAfter} toast="${String(sent.toast).slice(0, 46)}"`);
  }

  /* First-principles charter: three labelled fields, values from SQLite meta. */
  const charterDom = await js(`(() => ({
    fields: ['charterPurpose', 'charterResources', 'charterEval'].map((id) => {
      const el = document.getElementById(id);
      return el ? el.textContent.trim().slice(0, 22) : '(missing)';
    }),
    edit: !!document.getElementById('btnCharterEdit'),
    side: document.getElementById('sidePurpose') ? document.getElementById('sidePurpose').textContent.trim().slice(0, 22) : '(missing)'
  }))()`);
  PASS('Charter states Purpose / Technical resources / Evaluation on screen',
    charterDom.fields.every((f) => f !== '(missing)') && charterDom.edit,
    JSON.stringify(charterDom.fields));

  const write = await api('PUT', '/api/meta', {
    project_purpose: 'TEST purpose line',
    project_resources: 'TEST resources line',
    project_evaluation: 'TEST evaluation by PDCA iteration',
  });
  await js(`CP.store.load()`);
  await sleep(500);
  const charterSet = await js(`({
    purpose: document.getElementById('charterPurpose').textContent.trim(),
    resources: document.getElementById('charterResources').textContent.trim(),
    evaluation: document.getElementById('charterEval').textContent.trim(),
    side: document.getElementById('sidePurpose').textContent.trim()
  })`);
  PASS('Charter values come from SQLite meta, not hardcoded HTML',
    write.status === 200 && charterSet.purpose === 'TEST purpose line'
      && charterSet.evaluation === 'TEST evaluation by PDCA iteration'
      && charterSet.side === 'TEST purpose line',
    JSON.stringify(charterSet));

  /* Clear the test strings. The service substitutes the effective charter
     (from the plan file, or an explicit PRD-not-ingested state) for empty
     values, so shipped screenshots never carry test placeholder text. */
  await api('PUT', '/api/meta', {
    project_purpose: '',
    project_resources: '',
    project_evaluation: '',
  });
  await js(`CP.store.load()`);
  await sleep(400);

  /* Sidebar: work-division roster, measured spend, and a collapse that keeps
     the nav labels in the DOM so the no-digit hygiene rule still holds. */
  const sidebar = await js(`(() => ({
    rows: document.querySelectorAll('#ownerRoster .roster-row').length,
    cost: document.getElementById('sideCost').textContent.trim(),
    tokens: document.getElementById('sideTokens').textContent.trim()
  }))()`);
  PASS('Sidebar carries the work-division roster and measured spend',
    sidebar.rows > 0 && /^\$/.test(sidebar.cost) && /billed/.test(sidebar.tokens),
    JSON.stringify(sidebar));

  const collapse = await js(`(() => {
    const btn = document.getElementById('btnCollapse');
    btn.click();
    const on = document.body.classList.contains('side-collapsed');
    const digits = Array.from(document.querySelectorAll('#nav button'))
      .map((b) => b.textContent).join('').replace(/[^0-9]/g, '').length;
    btn.click();
    return { on, digits, off: !document.body.classList.contains('side-collapsed') };
  })()`);
  PASS('Sidebar collapses and nav labels still carry no digits',
    collapse.on === true && collapse.digits === 0 && collapse.off === true,
    JSON.stringify(collapse));

  /* A filter that matches nothing must say so. A blank table is a bug. */
  const empty = await js(`(() => {
    const q = document.getElementById('issueQuery');
    q.value = 'zzz-no-such-issue-zzz';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    const box = document.getElementById('issueEmpty');
    const shown = !!box && !box.classList.contains('hidden');
    const rows = document.getElementById('issueBody').children.length;
    const text = box ? box.textContent.trim() : '';
    q.value = '';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    return { shown, rows, text: text.slice(0, 34) };
  })()`);
  PASS('Filter matching nothing shows an explicit empty state, not a blank table',
    empty.shown === true && empty.rows === 0 && empty.text.length > 0,
    JSON.stringify(empty));

  /* 18. R19 - defect regression guards. Each of these is expected to FAIL on
     the pre-fix tree and PASS after; the red is captured as evidence. */
  const stateNow = await js(`CP.store.state`);
  SERVER_DATA_DIR = (stateNow && stateNow.data_dir) ? String(stateNow.data_dir) : '';
  PASS('Service declares where its data lives (D4 precondition)',
    !!SERVER_DATA_DIR, 'data_dir=' + (SERVER_DATA_DIR || '(absent)'));

  /* D1: the field is labelled "billed (M tokens)", so it must be refilled in
     millions. It was refilled with raw tokens, and onSubmit multiplies by 1e6
     again - a save without an edit inflated spend a million-fold. */
  const billedModal = await js(`(() => {
    const s = CP.store.state;
    const t = s.tasks.filter((x) => !x.placeholder && x.billed > 0)[0];
    if (!t) return null;
    CP.openTaskModal(t.id);
    const f = document.getElementById('fBilled');
    return { id: t.id, stored: t.billed, field: Number(f && f.value) };
  })()`);
  PASS('Work-unit modal refills billed in the unit its label names (D1)',
    !!billedModal && Math.abs(billedModal.field - billedModal.stored / 1e6) < 0.05,
    JSON.stringify(billedModal));
  await js(`(() => { const b = document.querySelector('#modalSheet [data-action=close]'); if (b) b.click(); return true; })()`);

  /* D2 + D3 + D5: source-level guards. These read the shipped files so a
     regression cannot hide behind a green behavioural run. */
  const panelSrc = fs.readFileSync(path.join(OUT, 'panel.js'), 'utf8');
  const aliveSrc = panelSrc.slice(panelSrc.indexOf('async function alive'), panelSrc.indexOf('async function start'));
  PASS('launcher identifies its own service before reusing a port (D2)',
    aliveSrc.includes('/healthz') && aliveSrc.includes('command-panel'),
    'healthz=' + aliveSrc.includes('/healthz') + ' service=' + aliveSrc.includes('command-panel'));

  const entryPoints = ['server.js', 'panel.js', 'selftest.js'];
  const envReads = entryPoints.map((f) => {
    const s2 = fs.readFileSync(path.join(OUT, f), 'utf8');
    return f + '=' + (s2.includes('process.env.PANEL_PORT') ? 'env' : 'HARDCODED');
  });
  const verifySrc = fs.readFileSync(path.join(OUT, '..', '..', 'scripts', 'verify.js'), 'utf8');
  envReads.push('verify.js=' + (verifySrc.includes('process.env.PANEL_PORT') ? 'env' : 'HARDCODED'));
  PASS('every entry point takes the port from the environment (D3)',
    envReads.every((x) => x.endsWith('=env')), envReads.join(' '));

  const selfSrc = fs.readFileSync(path.join(OUT, 'selftest.js'), 'utf8');
  const clickZone = selfSrc.slice(selfSrc.indexOf("Input.dispatchMouseEvent"), selfSrc.indexOf("__copyPath"));
  const fixedWait = /await sleep\(\s*\d+\s*\)/.test(clickZone);
  PASS('the clipboard-fallback click path waits for the chain, not a clock (D5)',
    !fixedWait, 'fixedSleepBetweenClickAndRead=' + fixedWait);

  /* 19. R20 - task relationship layer. */
  const viol = await js(`(() => {
    const cases = [
      ['FS', '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 10:00', '2026-11-05 14:00', true],
      ['FS', '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 12:00', '2026-11-05 14:00', false],
      ['SS', '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 06:00', '2026-11-05 14:00', true],
      ['SS', '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 09:00', '2026-11-05 14:00', false],
      ['FF', '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 06:00', '2026-11-05 11:00', true],
      ['FF', '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 10:00', '2026-11-05 12:00', false],
      ['SF', '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 06:00', '2026-11-05 07:00', true],
      ['SF', '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 06:00', '2026-11-05 09:00', false]
    ];
    return cases.map((c) => {
      const got = CP.depViolated(c[0], c[1], c[2], c[3], c[4]);
      return { type: c[0], want: c[5], got, ok: got === c[5] };
    });
  })()`);
  PASS('Precedence violation rule holds for all four types in both states',
    viol.length === 8 && viol.every((v) => v.ok),
    JSON.stringify(viol.map((v) => v.type + ':' + v.got)));

  const cp = await js(`(() => {
    const T = (id, s, e) => ({ id, title: id, owner: '', owner_type: 'main', role: '', handoff: '',
      status: 'x', start: s, end: e, progress: 0, placeholder: 0, tier: 'S',
      billed: 0, cost: 0, sort: 0, parent_id: '', baseline_start: '', baseline_end: '' });
    const chain = [T('a','2026-11-05 00:00','2026-11-05 02:00'),
                   T('b','2026-11-05 02:00','2026-11-05 05:00'),
                   T('c','2026-11-05 05:00','2026-11-05 09:00')];
    const chainDeps = [{from:'a',to:'b',type:'FS'},{from:'b',to:'c',type:'FS'}];
    const dia = [T('a','2026-11-05 00:00','2026-11-05 01:00'),
                 T('b','2026-11-05 01:00','2026-11-05 04:00'),
                 T('c','2026-11-05 01:00','2026-11-05 06:00'),
                 T('d','2026-11-05 06:00','2026-11-05 08:00')];
    const diaDeps = [{from:'a',to:'b',type:'FS'},{from:'a',to:'c',type:'FS'},
                     {from:'b',to:'d',type:'FS'},{from:'c',to:'d',type:'FS'}];
    const loose = [T('a','2026-11-05 00:00','2026-11-05 02:00'),
                   T('b','2026-11-05 02:00','2026-11-05 03:00'),
                   T('z','2026-11-05 00:00','2026-11-05 20:00')];
    return {
      chain: CP.criticalIds(chain, chainDeps),
      diamond: CP.criticalIds(dia, diaDeps),
      disconnected: CP.criticalIds(loose, [{from:'a',to:'b',type:'FS'}]),
    };
  })()`);
  /* a->b is itself a tight chain with no slack, so both are critical; z takes
     part in no edge and must never appear in the critical set. */
  PASS('Critical set: chain is whole, long arm wins, a task with no edge never is',
    JSON.stringify(cp.chain) === '["a","b","c"]'
      && JSON.stringify(cp.diamond) === '["a","c","d"]'
      && JSON.stringify(cp.disconnected) === '["a","b"]'
      && cp.disconnected.indexOf('z') < 0,
    JSON.stringify(cp));

  /* The two robustness gaps in the new write path: an unknown parent and a
     cyclic edge must be refused, not stored. */
  const made = (await api('POST', '/api/tasks', { title: 'R20 probe' })).body || {};
  const badParent = await api('PUT', '/api/tasks/' + encodeURIComponent(made.id), { parent_id: 'no-such-task' });
  PASS('A parent that does not exist is refused, not stored (R20)',
    badParent.status >= 400 || (badParent.body && badParent.body.parent_id !== 'no-such-task'),
    'status=' + badParent.status + ' parent=' + (badParent.body && badParent.body.parent_id));

  const tA = (await api('POST', '/api/tasks', { title: 'R20 A' })).body || {};
  const tB = (await api('POST', '/api/tasks', { title: 'R20 B' })).body || {};
  await api('PUT', '/api/task-deps', { from: tA.id, to: tB.id, type: 'FS' });
  const cyclic = await api('PUT', '/api/task-deps', { from: tB.id, to: tA.id, type: 'FS' });
  const edgeCount = await api('GET', '/api/task-deps');
  const cycleStored = Array.isArray(edgeCount.body)
    && edgeCount.body.some((d) => d.from === tB.id && d.to === tA.id);
  PASS('A cyclic dependency is refused, not stored (R20)',
    cyclic.status >= 400 && !cycleStored, 'status=' + cyclic.status + ' stored=' + cycleStored);

  /* Baseline freeze + rendering. */
  const snap = await api('POST', '/api/baseline');
  await js(`CP.store.load()`);
  await sleep(400);
  const base = await js(`(() => {
    const s = CP.store.state;
    return {
      snapshotted: s.tasks.filter((t) => t.baseline_start && t.baseline_end).length,
      deps: (s.task_deps || []).length
    };
  })()`);
  PASS('Freeze baseline stores a plan window on every scheduled unit',
    snap.status === 200 && base.snapshotted > 0,
    'api=' + JSON.stringify(snap.body) + ' state=' + JSON.stringify(base));

  const drawn = await js(`(() => {
    const paths = document.querySelectorAll('#ganttEdges .gdep');
    const bad = document.querySelectorAll('#ganttEdges .gdep.violated');
    const ghosts = Array.from(document.querySelectorAll('.gbar-base'))
      .filter((g) => g.style.display !== 'none').length;
    return { edges: paths.length, violated: bad.length, ghosts };
  })()`);
  PASS('Gantt draws precedence edges and baseline ghosts',
    drawn.edges > 0 && drawn.ghosts > 0, JSON.stringify(drawn));

  /* Clean up the probe rows so the demo dataset is left as it was. */
  for (const id of [made.id, tA.id, tB.id]) {
    if (id) await api('DELETE', '/api/tasks/' + encodeURIComponent(id));
  }

  /* 21. R21 - lag, canvas link authoring, bump cascade. */
  const lag = await js(`(() => {
    const cases = [
      ['FS', 2,  '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 13:00', '2026-11-05 15:00', true],
      ['FS', 2,  '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 14:00', '2026-11-05 15:00', false],
      ['FS', -2, '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 11:00', '2026-11-05 15:00', false],
      ['SS', 3,  '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 10:00', '2026-11-05 15:00', true],
      ['SS', 3,  '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 11:00', '2026-11-05 15:00', false],
      ['FF', 1,  '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 09:00', '2026-11-05 12:30', true],
      ['FF', 1,  '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 09:00', '2026-11-05 13:00', false],
      ['SF', 2,  '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 09:00', '2026-11-05 09:30', true],
      ['SF', -3, '2026-11-05 08:00', '2026-11-05 12:00', '2026-11-05 09:00', '2026-11-05 04:00', true]
    ];
    return cases.map((c) => {
      const got = CP.depViolated(c[0], c[2], c[3], c[4], c[5], c[1]);
      return { type: c[0], lag: c[1], want: c[6], got, ok: got === c[6] };
    });
  })()`);
  PASS('Lag shifts the bound: positive lag tightens, negative lag is a lead',
    lag.length === 9 && lag.every((v) => v.ok),
    JSON.stringify(lag.map((v) => v.type + (v.lag > 0 ? '+' : '') + v.lag + ':' + v.got)));

  const bump = await js(`(() => {
    const T = (id, s, e) => ({ id, title: id, owner: '', owner_type: 'main', role: '', handoff: '',
      status: 'x', start: s, end: e, progress: 0, placeholder: 0, tier: 'S',
      billed: 0, cost: 0, sort: 0, parent_id: '', baseline_start: '', baseline_end: '' });
    const tasks = [T('a','2026-11-05 00:00','2026-11-05 04:00'),
                   T('b','2026-11-05 04:00','2026-11-05 08:00'),
                   T('c','2026-11-05 08:00','2026-11-05 12:00')];
    const deps = [{from:'a',to:'b',type:'FS',lag:0},{from:'b',to:'c',type:'FS',lag:0}];
    const moves = CP.bumpCascade(tasks, deps, 'a', '2026-11-05 10:00', '2026-11-05 14:00');
    return moves.map((m) => m.id + '@' + m.start);
  })()`);
  PASS('Drag repair slides each dependant by the least amount, in order',
    bump.length === 2 && bump[0].indexOf('b@') === 0 && bump[1].indexOf('c@') === 0,
    JSON.stringify(bump));

  /* Canvas authoring: the two ends decide the precedence type. No menu.
     Probe bars are placed near NOW so they sit inside the viewport the
     CDP pointer events act on. */
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  const at = (h) => {
    const d = new Date(Date.now() + h * 3600000);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':00';
  };
  const pairings = [['right', 'left', 'FS'], ['left', 'left', 'SS'], ['right', 'right', 'FF'], ['left', 'right', 'SF']];
  const probeIds = [];
  for (let i = 0; i < pairings.length; i += 1) {
    const off = i * 10;
    const p = (await api('POST', '/api/tasks', { title: 'R21 ' + pairings[i][2] + ' from', start: at(off + 1), end: at(off + 3) })).body || {};
    const q = (await api('POST', '/api/tasks', { title: 'R21 ' + pairings[i][2] + ' to', start: at(off + 5), end: at(off + 7) })).body || {};
    probeIds.push([p.id, q.id]);
  }
  await js(`CP.store.load()`);
  await sleep(500);
  /* R32 retarget (I-037): the canvas link authoring runs on the Work board,
     where the hour axis now lives; the gesture itself is unchanged.
     R36: gestures land on the [Hour axis] tab - measurements run against the
     ACTIVE tab. */
  await js(`document.querySelector('[data-view="board"]').click()`);
  await js(`CP.switchWbTab('axis')`);
  await sleep(500);
  /* Show only the probe rows so every bar sits inside the visible slice of
     the gantt, and the pointer coordinates cannot drift off the panel. */
  await js(`CP.store.query = 'R21 '; CP.store.emit();`);
  await sleep(400);
  await js(`(() => { const sc = document.getElementById('ganttScroll'); if (sc) { sc.scrollTop = 0; sc.scrollLeft = 0; } return true; })()`);
  await sleep(250);

  const linkResults = [];
  for (let i = 0; i < pairings.length; i += 1) {
    const [fromSide, toSide, wantType] = pairings[i];
    const [fromId, toId] = probeIds[i];
    const geo = await js(`(() => {
      const bars = {};
      document.querySelectorAll('.gbar').forEach((b) => { if (b.dataset.taskId) bars[b.dataset.taskId] = b; });
      const f = bars[${JSON.stringify(fromId)}];
      const t = bars[${JSON.stringify(toId)}];
      if (!f || !t) return { missing: true, bars: Object.keys(bars).length };
      /* Slide the gantt scroller until both bars sit inside its box. The bar's
         offsetTop is only its inset within its own track, so the shift is
         computed from measured rectangles, not from offsetTop. */
      const sc = document.getElementById('ganttScroll');
      if (sc) {
        for (let k = 0; k < 4; k += 1) {
          const sr = sc.getBoundingClientRect();
          const fr = f.getBoundingClientRect();
          const tr0 = t.getBoundingClientRect();
          const dy = Math.min(fr.top, tr0.top) - sr.top - 28;
          const dx = Math.min(fr.left, tr0.left) - sr.left - 260;
          if (Math.abs(dx) < 2 && Math.abs(dy) < 2) break;
          sc.scrollTop = Math.max(0, sc.scrollTop + dy);
          sc.scrollLeft = Math.max(0, sc.scrollLeft + dx);
        }
      }
      const dot = f.querySelector('.gbar-link.' + ${JSON.stringify(fromSide)});
      if (!dot) return { missing: 'dot' };
      const dr = dot.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      const x1 = dr.left + dr.width / 2;
      const y1 = dr.top + dr.height / 2;
      const x2 = tr.left + (${JSON.stringify(toSide)} === 'left' ? 4 : tr.width - 4);
      const y2 = tr.top + tr.height / 2;
      const under1 = document.elementFromPoint(x1, y1);
      const fr2 = f.getBoundingClientRect();
      const sr2 = sc ? sc.getBoundingClientRect() : null;
      return {
        x1, y1, x2, y2,
        active: (document.querySelector('.view.active') || {}).id || '',
        win: [window.innerWidth, window.innerHeight],
        sc: sr2 ? [Math.round(sr2.left), Math.round(sr2.top), Math.round(sr2.width), Math.round(sr2.height)] : null,
        sl: sc ? [Math.round(sc.scrollLeft), sc.scrollWidth, sc.clientWidth] : null,
        bar: [Math.round(fr2.left), Math.round(fr2.top), Math.round(fr2.width)],
        hit1: under1 ? String(under1.className || under1.tagName) : 'null'
      };
    })()`);
    await sleep(250);
    linkResults.push({ wantType, geo });
    if (!geo || geo.missing) continue;
    await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: geo.x1, y: geo.y1, button: 'left', clickCount: 1 });
    await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: (geo.x1 + geo.x2) / 2, y: (geo.y1 + geo.y2) / 2, button: 'left' });
    const mid = await js(`(() => {
      const p = document.getElementById('gdepPreview');
      const under = document.elementFromPoint(${geo.x2}, ${geo.y2});
      const bar = under && under.closest ? under.closest('.gbar') : null;
      return { preview: !!p, dropHits: bar ? (bar.dataset.taskId || '?') : ((under && under.className) || 'none') };
    })()`);
    await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: geo.x2, y: geo.y2, button: 'left', clickCount: 1 });
    await sleep(500);
    const toastText = await js(`(document.getElementById('toast') || {}).textContent || ''`);
    linkResults[linkResults.length - 1].toast = toastText;
    linkResults[linkResults.length - 1].mid = mid;
  }
  await js(`CP.store.load()`);
  await sleep(450);
  const stored = await js(`(() => {
    const out = [];
    (CP.store.state.task_deps || []).forEach((d) => {
      ${JSON.stringify(probeIds)}.forEach((pair) => {
        if (d.from === pair[0] && d.to === pair[1]) out.push(d.type);
      });
    });
    return out.sort();
  })()`);
  PASS('Dragging end-to-end authors the edge, and the two ends pick the type',
    JSON.stringify(stored) === '["FF","FS","SF","SS"]',
    'stored=' + JSON.stringify(stored) + ' xy=' + JSON.stringify(linkResults.map((r) => r.geo && r.geo.x1 !== undefined ? [Math.round(r.geo.x1), Math.round(r.geo.y1), Math.round(r.geo.x2), Math.round(r.geo.y2)] : r.geo)) + ' mid=' + JSON.stringify(linkResults.map((r) => r.mid))
      + ' diag=' + JSON.stringify(linkResults.map((r) => r.geo && r.geo.active !== undefined ? { a: r.geo.active, win: r.geo.win, sc: r.geo.sc, sl: r.geo.sl, bar: r.geo.bar, hit1: r.geo.hit1 } : r.geo)));

  /* Bump cascade on a real drag: the dependant must move and stay moved. */
  const bumpPair = probeIds[0];
  const beforeBump = await js(`(() => {
    const a = CP.store.state.tasks.filter((x) => x.id === ${JSON.stringify(bumpPair[0])})[0];
    const b = CP.store.state.tasks.filter((x) => x.id === ${JSON.stringify(bumpPair[1])})[0];
    return { from: a ? a.start : '', to: b ? b.start : '',
             deps: (CP.store.state.task_deps || []).map((d) => d.from + '>' + d.to).join(',') };
  })()`);
  const bumpGeo = await js(`(() => {
    const b = document.querySelector('.gbar[data-task-id=' + ${JSON.stringify(bumpPair[0])} + ']');
    if (!b) return { missing: true };
    const sc = document.getElementById('ganttScroll');
    if (sc) {
      for (let k = 0; k < 4; k += 1) {
        const sr = sc.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        const dy = br.top - sr.top - 60;
        const dx = br.left - sr.left - 260;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) break;
        sc.scrollTop = Math.max(0, sc.scrollTop + dy);
        sc.scrollLeft = Math.max(0, sc.scrollLeft + dx);
      }
    }
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const under = document.elementFromPoint(x, y);
    const hit = under && under.closest ? (under.closest('.gbar') || {}).dataset : null;
    const sr2 = sc ? sc.getBoundingClientRect() : null;
    return { x, y, hitId: hit ? hit.taskId : ((under && under.className) || 'none'),
      active: (document.querySelector('.view.active') || {}).id || '',
      win: [window.innerWidth, window.innerHeight],
      sc: sr2 ? [Math.round(sr2.left), Math.round(sr2.top), Math.round(sr2.width), Math.round(sr2.height)] : null,
      sl: sc ? [Math.round(sc.scrollLeft), sc.scrollWidth, sc.clientWidth] : null,
      bar: [Math.round(r.left), Math.round(r.top), Math.round(r.width)] };
  })()`);
  await sleep(250);
  if (bumpGeo && !bumpGeo.missing) {
    await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: bumpGeo.x, y: bumpGeo.y, button: 'left', clickCount: 1 });
    await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bumpGeo.x + 400, y: bumpGeo.y, button: 'left' });
    await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bumpGeo.x + 620, y: bumpGeo.y, button: 'left' });
    await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bumpGeo.x + 620, y: bumpGeo.y, button: 'left', clickCount: 1 });
    await sleep(800);
  }
  await js(`CP.store.load()`);
  await sleep(450);
  const afterBump = await js(`(() => {
    const a = CP.store.state.tasks.filter((x) => x.id === ${JSON.stringify(bumpPair[0])})[0];
    const b = CP.store.state.tasks.filter((x) => x.id === ${JSON.stringify(bumpPair[1])})[0];
    return { from: a ? a.start : '', to: b ? b.start : '',
             toast: (document.getElementById('toast') || {}).textContent || '' };
  })()`);
  PASS('Dragging a bar slides its dependant along, and the move is persisted',
    !!bumpGeo && afterBump.to !== '' && afterBump.to !== beforeBump.to,
    'from ' + beforeBump.from + ' -> ' + afterBump.from + ' | to ' + beforeBump.to + ' -> ' + afterBump.to
    + ' | deps=' + beforeBump.deps + ' | toast=' + String(afterBump.toast).slice(0, 40)
    + ' | diag=' + JSON.stringify(bumpGeo));

  /* Clean up the probe rows and their edges. */
  for (const pair of probeIds) {
    for (const id of pair) {
      if (id) await api('DELETE', '/api/tasks/' + encodeURIComponent(id));
    }
  }

  /* 22. R22 - parent/sub-task tree: pure depth maths, cycle guard, parent
     authoring from the panel, and depth display on both surfaces. */
  const tree = await js(`(() => {
    if (typeof CP.taskDepth !== 'function' || typeof CP.hasAncestor !== 'function') return { missing: true };
    const T = (id, parent) => ({ id, title: id, owner: '', owner_type: 'main', role: '', handoff: '',
      status: 'x', start: '2026-11-05 00:00', end: '2026-11-05 04:00', progress: 0, placeholder: 0, tier: 'S',
      billed: 0, cost: 0, sort: 0, parent_id: parent, baseline_start: '', baseline_end: '' });
    const tasks = [T('a', ''), T('b', 'a'), T('c', 'b')];
    return {
      d0: CP.taskDepth(tasks, 'a'), d1: CP.taskDepth(tasks, 'b'), d2: CP.taskDepth(tasks, 'c'),
      ca: CP.hasAncestor(tasks, 'c', 'a'), ac: CP.hasAncestor(tasks, 'a', 'c'),
      self: CP.hasAncestor(tasks, 'a', 'a')
    };
  })()`);
  PASS('Parent maths is pure and testable: depth and ancestor lookup (R22)',
    !tree.missing && tree.d0 === 0 && tree.d1 === 1 && tree.d2 === 2 && tree.ca === true && tree.ac === false && tree.self === false,
    tree.missing ? 'CP.taskDepth / CP.hasAncestor not exported' : JSON.stringify(tree));

  const pP = (await api('POST', '/api/tasks', { title: 'R22 parent', start: at(1), end: at(3) })).body || {};
  const pC = (await api('POST', '/api/tasks', { title: 'R22 child', start: at(2), end: at(4) })).body || {};
  const pG = (await api('POST', '/api/tasks', { title: 'R22 grandchild', start: at(3), end: at(5) })).body || {};
  await api('PUT', '/api/tasks/' + encodeURIComponent(pC.id), { parent_id: pP.id });
  await api('PUT', '/api/tasks/' + encodeURIComponent(pG.id), { parent_id: pC.id });
  /* Both loop shapes: make the root a child of its grandchild, and make the
     middle node a child of its own child. Neither may be stored. */
  const cyc1 = await api('PUT', '/api/tasks/' + encodeURIComponent(pP.id), { parent_id: pG.id });
  const cyc2 = await api('PUT', '/api/tasks/' + encodeURIComponent(pC.id), { parent_id: pG.id });
  const stTree = await api('GET', '/api/state');
  const gotP = (stTree.body.tasks.filter((x) => x.id === pP.id)[0] || {});
  const gotC = (stTree.body.tasks.filter((x) => x.id === pC.id)[0] || {});
  PASS('A parent cycle is refused, not stored (R22)',
    cyc1.status === 400 && cyc2.status === 400 && gotP.parent_id === '' && gotC.parent_id === pP.id,
    'cycle1=' + cyc1.status + ' cycle2=' + cyc2.status + ' stored parent=' + JSON.stringify([gotP.parent_id, gotC.parent_id]));

  const bogus = await api('POST', '/api/tasks', { title: 'R22 bogus', parent_id: 't_missing_parent' });
  PASS('A new task cannot point at a parent that does not exist (R22)',
    bogus.status === 400,
    'status=' + bogus.status + ' body=' + JSON.stringify(bogus.body));
  if (bogus.status === 200 && bogus.body && bogus.body.id) await api('DELETE', '/api/tasks/' + encodeURIComponent(bogus.body.id));

  /* Authoring from the panel: the edit form must offer a parent choice and
     the choice must reach SQLite. Before the patch the field is absent. */
  await api('PUT', '/api/tasks/' + encodeURIComponent(pG.id), { parent_id: '' });
  await js(`CP.store.load()`);
  await sleep(350);
  await js(`CP.openTaskModal(${JSON.stringify(pG.id)})`);
  await sleep(250);
  const modal = await js(`(() => {
    const sel = document.getElementById('fParent');
    if (!sel) return { missing: true };
    const opts = Array.from(sel.options).map((o) => o.value);
    return { opts: opts.length, hasChild: opts.indexOf(${JSON.stringify(pC.id)}) >= 0,
             hasSelf: opts.indexOf(${JSON.stringify(pG.id)}) >= 0 };
  })()`);
  const setr = await js(`(() => {
    const sel = document.getElementById('fParent');
    if (!sel) return { missing: true };
    sel.value = ${JSON.stringify(pC.id)};
    const form = document.getElementById('taskForm');
    if (!form) return { missing: 'form' };
    if (form.requestSubmit) form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    return { set: sel.value };
  })()`);
  await js(`CP.store.load()`);
  await sleep(400);
  const afterSet = await js(`(() => {
    const t = CP.store.state.tasks.filter((x) => x.id === ${JSON.stringify(pG.id)})[0];
    return t ? t.parent_id : 'gone';
  })()`);
  PASS('The panel can assign a parent - the tree is authorable, not API-only (R22)',
    !modal.missing && modal.hasChild && !modal.hasSelf && setr.set === pC.id && afterSet === pC.id,
    'modal=' + JSON.stringify(modal) + ' set=' + JSON.stringify(setr) + ' stored=' + afterSet);

  /* Depth display: both surfaces show the hierarchy, not just a parent id.
     R32 retarget (I-037): card and bar now share the Work board page, so
     one view activation measures both (the depth assertions are unchanged). */
  await js(`CP.store.query = 'R22'; CP.store.emit();`);
  await js(`document.querySelector('[data-view="board"]').click()`);
  await sleep(450);
  const depthUi = await js(`(() => {
    const q = (id) => document.querySelector('.kb-card[data-task-id=' + JSON.stringify(id) + ']');
    const cardR = q(${JSON.stringify(pP.id)});
    const cardC = q(${JSON.stringify(pC.id)});
    const cardG = q(${JSON.stringify(pG.id)});
    const bar = document.querySelector('.gbar[data-task-id=${JSON.stringify(pG.id)}]');
    const label = bar ? bar.querySelector('.gbar-label') : null;
    const ml = (el) => (el ? (parseFloat(getComputedStyle(el).marginLeft) || 0) : -1);
    return {
      dR: cardR ? (cardR.dataset.depth || '') : 'missing',
      dC: cardC ? (cardC.dataset.depth || '') : 'missing',
      dG: cardG ? (cardG.dataset.depth || '') : 'missing',
      mlR: ml(cardR), mlC: ml(cardC), mlG: ml(cardG),
      barDepth: bar ? (bar.style.getPropertyValue('--depth') || '') : 'missing',
      labelPad: label ? (parseFloat(getComputedStyle(label).paddingLeft) || 0) : -1
    };
  })()`);
  PASS('Parent and child are indented by depth on both surfaces (R22)',
    depthUi.dR === '0' && depthUi.dC === '1' && depthUi.dG === '2'
    && depthUi.mlR === 0 && depthUi.mlC > depthUi.mlR && depthUi.mlG > depthUi.mlC
    && depthUi.barDepth === '2' && depthUi.labelPad >= 18,
    JSON.stringify(depthUi));

  /* Clean up the R22 probes. */
  for (const id of [pG.id, pC.id, pP.id]) {
    if (id) await api('DELETE', '/api/tasks/' + encodeURIComponent(id));
  }

  /* 23. G2 - two independent views, the PRD milestone layer, plan charter
     and the macOS 27 glass control. A deterministic fixture exercises the
     render path even while G1's real PRD ingest may still be pending; the
     real /api/plan empty state is asserted separately. */
  const FIX = {
    available: true, state: 'READY', label: 'Milestone plan ready', detail: '',
    fix_command: 'node scripts/prd-to-action.js', message: '', schema: 'ai-project-ops.plan/1.0',
    charter: { purpose: 'Fixture purpose', technical_resources: 'Fixture resources',
      evaluation: 'Fixture evaluation', side_purpose: 'Fixture side purpose' },
    milestones: [
      { id: 'M1', name: 'Ingest', depends_on: [], start_offset_h: 0, end_offset_h: 12, status: 'done', completion: 100, verify: 'node scripts/prd-to-action.js' },
      { id: 'M2', name: 'Scaffold', depends_on: 'M1', start_offset_h: 12, end_offset_h: 30, status: 'in_progress', completion: 40, verify: 'node -c server.js' },
      { id: 'M3', name: 'Render', depends_on: 'M1', start_offset_h: 12, end_offset_h: 26, status: 'pending', completion: 0, verify: 'node -c app.js' },
      { id: 'M4', name: 'Verify', depends_on: 'M2', start_offset_h: 30, end_offset_h: 42, status: 'pending', completion: 0, verify: 'node scripts/verify.js' },
      { id: 'M5', name: 'Ship', depends_on: 'M3', start_offset_h: 26, end_offset_h: 38, status: 'pending', completion: 0, verify: 'git status' },
      { id: 'M6', name: 'Close', depends_on: 'M4', start_offset_h: 42, end_offset_h: 54, status: 'pending', completion: 0, verify: 'echo done' },
    ],
    work_units: [
      { id: 'W1', milestone_id: 'M1', title: 'Read PRD', owner: 'main', start_offset_h: 0, end_offset_h: 6, progress: 100 },
      { id: 'W2', milestone_id: 'M1', title: 'Write plan', owner: 'human', start_offset_h: 6, end_offset_h: 12, progress: 100 },
      { id: 'W3', milestone_id: 'M2', title: 'Scaffold UI', owner: 'subagent', start_offset_h: 12, end_offset_h: 24, progress: 40 },
      { id: 'W4', milestone_id: 'M3', title: 'Render layer', owner: 'team', start_offset_h: 12, end_offset_h: 26, progress: 0 },
      { id: 'W5', milestone_id: 'M4', title: 'Run verify', owner: 'main', start_offset_h: 30, end_offset_h: 42, progress: 0 },
    ],
    relations: [
      { from: 'M1', to: 'M2', type: 'FS', lag: 0 },
      { from: 'M1', to: 'M3', type: 'FS', lag: 0 },
      { from: 'M2', to: 'M4', type: 'FS', lag: 2 },
      { from: 'M3', to: 'M5', type: 'SS', lag: 0 },
      { from: 'M4', to: 'M6', type: 'FS', lag: 0 },
    ],
    main_line: ['M1', 'M2', 'M4', 'M6'],
    sub_lines: { M1: ['W1', 'W2'], M2: ['W3'], M3: ['W4'], M4: ['W5'] },
  };
  const EMPTY_FIX = {
    available: false, state: 'PRD_NOT_INGESTED', label: 'PRD not ingested',
    detail: 'The milestone plan has no main line, sub-lines or relations because data/milestone-plan.json is missing.',
    fix_command: 'node scripts/prd-to-action.js',
    message: 'PRD not ingested - run: node scripts/prd-to-action.js',
    charter: null, milestones: [], work_units: [], relations: [], main_line: [], sub_lines: {},
  };

  const twoViews = await js(`(() => ({
    plan: !!document.getElementById('view-plan'),
    board: !!document.getElementById('view-board'),
    boardOwnPage: !!document.getElementById('view-board') && document.getElementById('view-board').querySelector('#boardColumns') !== null,
    addCol: !!document.getElementById('btnAddColumn'),
    gantt: !!document.getElementById('ganttScroll'),
    navBoard: !!document.querySelector('#nav [data-view="board"]')
  }))()`);
  PASS('Two independent views exist: plan gantt and board kanban on its own page',
    twoViews.plan && twoViews.board && twoViews.boardOwnPage && twoViews.addCol && twoViews.gantt && twoViews.navBoard,
    JSON.stringify(twoViews));

  const switched = await js(`(() => {
    document.querySelector('#nav [data-view="board"]').click();
    const boardOn = document.getElementById('view-board').classList.contains('active') && !document.getElementById('view-plan').classList.contains('active');
    document.querySelector('#nav [data-view="plan"]').click();
    const planOn = document.getElementById('view-plan').classList.contains('active') && !document.getElementById('view-board').classList.contains('active');
    return { boardOn, planOn };
  })()`);
  PASS('Nav switches between the plan and board views', switched.boardOn && switched.planOn,
    JSON.stringify(switched));

  const mainBars = await js(`(() => {
    CP.applyPlan(${JSON.stringify(FIX)});
    const groups = Array.from(document.querySelectorAll('.ms-group')).map(g => g.dataset.ms);
    return {
      bars: document.querySelectorAll('.ms-main').length,
      groups: groups,
      first: groups[0],
      m2AfterM1: groups.indexOf('M2') > groups.indexOf('M1'),
      m4AfterM2: groups.indexOf('M4') > groups.indexOf('M2')
    };
  })()`);
  PASS('Milestone main-line bars render in depends_on order',
    mainBars.bars === FIX.milestones.length && mainBars.first === 'M1'
      && mainBars.m2AfterM1 && mainBars.m4AfterM2,
    JSON.stringify(mainBars));

  const subBars = await js(`(() => ({
    bars: document.querySelectorAll('.ms-sub').length,
    indent: getComputedStyle(document.querySelector('.ms-sub-label')).paddingLeft,
    underGroup: !!document.querySelector('.ms-group[data-ms="M1"] .ms-sub-row')
  }))()`);
  PASS('Milestone sub-line bars render indented under their milestone',
    subBars.bars === FIX.work_units.length && subBars.underGroup && parseFloat(subBars.indent) > 0,
    JSON.stringify(subBars));

  const relRows = await js(`(() => {
    const rows = Array.from(document.querySelectorAll('.ms-rel')).map(r => r.textContent.trim());
    return { rows: rows, hasArrow: rows.some(t => t.indexOf('->') >= 0), hasFS: rows.some(t => t.indexOf('FS') >= 0) };
  })()`);
  PASS('Dependency relations render as connector rows with arrows',
    relRows.rows.length === FIX.relations.length && relRows.hasArrow && relRows.hasFS,
    JSON.stringify(relRows));

  const critPath = await js(`(() => ({
    bars: document.querySelectorAll('.ms-main.ms-critical').length,
    note: (document.querySelector('.ms-critical-note') || {}).textContent || ''
  }))()`);
  PASS('Critical path is emphasised on the main line',
    critPath.bars === FIX.main_line.length && critPath.note.indexOf('M1') >= 0,
    JSON.stringify(critPath));

  const charter = await js(`(() => ({
    p: document.getElementById('charterPurpose').textContent.trim(),
    r: document.getElementById('charterResources').textContent.trim(),
    e: document.getElementById('charterEval').textContent.trim(),
    side: document.getElementById('sidePurpose').textContent.trim(),
    sideCharter: document.getElementById('sideCharter').textContent.trim()
  }))()`);
  const charterOk = ['p', 'r', 'e', 'side'].every((k) => charter[k].length > 0
    && !/Not set/i.test(charter[k]) && !/Demo charter/i.test(charter[k])) && charter.sideCharter.length > 0;
  PASS('Charter is populated from the plan service (no Not set / Demo charter)',
    charterOk, JSON.stringify(charter));

  const glass = await js(`(() => {
    /* I-026 recorded correction: the global #glassAlpha control is gone;
       the Settings page Glass row (#setGlass) is the single control. */
    const el = document.getElementById('setGlass');
    const root = document.documentElement;
    const before = getComputedStyle(root).getPropertyValue('--glass-alpha').trim();
    const alphaOf = (s) => {
      const i = s.indexOf('('), j = s.lastIndexOf(')');
      if (i < 0 || j < 0) return -1;
      const parts = s.slice(i + 1, j).split(',');
      return parts.length === 4 ? parseFloat(parts[3]) : 1;
    };
    const cardBefore = getComputedStyle(document.querySelector('.card')).backgroundColor;
    el.value = '30';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const after = getComputedStyle(root).getPropertyValue('--glass-alpha').trim();
    const saved = localStorage.getItem('cp.glass-alpha');
    const cardAfter = getComputedStyle(document.querySelector('.card')).backgroundColor;
    el.value = '80'; el.dispatchEvent(new Event('input', { bubbles: true }));
    return { before: before, after: after, saved: saved,
      alphaBefore: alphaOf(cardBefore), alphaAfter: alphaOf(cardAfter) };
  })()`);
  PASS('Transparency slider changes --glass-alpha, glass surfaces and localStorage',
    parseFloat(glass.after) === 0.3 && glass.saved === '0.3'
      && glass.alphaAfter === 0.3 && glass.alphaBefore > glass.alphaAfter,
    JSON.stringify(glass));

  const emptyState = await js(`(() => {
    CP.applyPlan(${JSON.stringify(EMPTY_FIX)});
    const box = document.querySelector('.ms-empty');
    const text = box ? box.textContent.trim() : '';
    return { shown: !!box, text: text, bars: document.querySelectorAll('.ms-main').length,
      hasFix: text.indexOf('node scripts/prd-to-action.js') >= 0,
      hasLabel: text.toLowerCase().indexOf('prd not ingested') >= 0 };
  })()`);
  PASS('Empty state names the fix command when the PRD plan is absent',
    emptyState.shown && emptyState.bars === 0 && emptyState.hasFix && emptyState.hasLabel,
    JSON.stringify(emptyState));

  const planApi = await api('GET', '/api/plan');
  PASS('GET /api/plan exposes the plan or an explicit PRD-not-ingested state',
    planApi.status === 200 && planApi.body && typeof planApi.body.available === 'boolean'
      && typeof planApi.body.fix_command === 'string'
      && planApi.body.fix_command.indexOf('prd-to-action') >= 0,
    'status=' + planApi.status + ' state=' + (planApi.body && planApi.body.state)
      + ' available=' + (planApi.body && planApi.body.available));

  /* Restore the real plan state (empty state when G1 has not ingested yet). */
  await js(`(async () => { await CP.refreshPlan(); return true; })()`);

  /* 24. Screenshots + runtime error gate */
  /* The capture must show the operator's board, not the test filter left in
     the search box by an earlier section. */
  await js(`CP.store.query = ''; const gs = document.getElementById('globalSearch'); if (gs) gs.value = ''; CP.store.emit();`);
  await sleep(350);
  const shown = await js(`document.querySelectorAll('.gbar').length`);
  PASS('Shipped screenshots capture the unfiltered board (R22)',
    shown > 0, 'gbar rows at capture: ' + shown);
  await js(`document.querySelector('[data-view=desk]').click(); CP.select(null,false);`);
  const deskShot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, 'preview-desk.png'), Buffer.from(deskShot.data, 'base64'));
  await js(`document.querySelector('[data-view=plan]').click();`);
  await sleep(220);
  const planShot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, 'preview-plan.png'), Buffer.from(planShot.data, 'base64'));
  await js(`document.querySelector('[data-view=ledger]').click();`);
  await sleep(220);
  const ledgerShot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, 'preview-ledger.png'), Buffer.from(ledgerShot.data, 'base64'));

  /* C9: benchmark items B1 / B5 / B6 become real, verified end-to-end. */
  const appr = await api('GET', '/api/policy/approvals');
  const apprRows = Array.isArray(appr.body) ? appr.body : [];
  PASS('C9 B1: per-action approval matrix persisted in SQLite (>=6 rows)',
    appr.status === 200 && apprRows.length >= 6 &&
    apprRows.every(r => r.action && r.actor && r.gate && r.endpoint),
    `rows=${apprRows.length} enforced=${apprRows.filter(r => r.enforced).length}`);

  const scope = await api('GET', '/api/policy/owner-scope');
  const scopeRows = Array.isArray(scope.body) ? scope.body : [];
  PASS('C9 B6: owner scope readable at runtime for 4 owner types',
    scope.status === 200 && scopeRows.length === 4 &&
    ['human', 'main', 'subagent', 'team'].every(t => scopeRows.some(r => r.owner_type === t)) &&
    scopeRows.every(r => r.needs_ack && r.never_automatic),
    scopeRows.map(r => r.owner_type).join(','));

  const C9ACK = (await api('POST', '/api/acks', { snapshot_hash: 'hC9', command: 'C9 state-path reject' })).body || {};
  const c9bad = await api('PUT', '/api/acks/' + encodeURIComponent(C9ACK.id), { state: 'REJECTED', reason: '   ' });
  PASS('C9 B1: state-path REJECTED with blank reason -> HTTP 400',
    c9bad.status === 400 && c9bad.body && /reason/i.test(JSON.stringify(c9bad.body)),
    `status=${c9bad.status} body=${JSON.stringify(c9bad.body)}`);
  const c9ok = await api('PUT', '/api/acks/' + encodeURIComponent(C9ACK.id), { state: 'REJECTED', reason: 'C9 written reason' });
  const c9reload = await api('GET', '/api/acks');
  const c9row = Array.isArray(c9reload.body) ? c9reload.body.find(x => x.id === C9ACK.id) : null;
  PASS('C9 B1: valid reject persists reject_reason in SQLite',
    c9ok.status === 200 && c9row && c9row.state === 'REJECTED' && c9row.reject_reason === 'C9 written reason',
    `state=${c9row && c9row.state} reason=${c9row && c9row.reject_reason}`);

  const policyUI = await js(`(() => ({
    mount: typeof CP.mountPolicyTables,
    tables: document.querySelectorAll('#view-desk table').length,
    text: (document.getElementById('view-desk') || {}).innerText || ''
  }))()`);
  PASS('C9 B1/B6: policy tables mounted into the desk view',
    policyUI.mount === 'function' && /Approval matrix/i.test(policyUI.text) && /Owner scope/i.test(policyUI.text),
    `mount=${policyUI.mount} tables=${policyUI.tables}`);

  const shared = await js(`(() => {
    const s = CP.store.state;
    const out = CP.sharedOrder(s.tasks.slice());
    const idx = {}; out.forEach((t, i) => { idx[t.id] = i; });
    const board = Array.from(document.querySelectorAll('#view-board .kb-card[data-order]'));
    const gantt = Array.from(document.querySelectorAll('.gbar[data-order]'));
    const boardOk = board.length > 0 &&
      board.every(c => String(idx[c.dataset.taskId]) === c.dataset.order);
    const ganttOk = gantt.length > 0 &&
      gantt.every(c => String(idx[c.dataset.taskId]) === c.dataset.order);
    const sorted = out.every((t, i, a) => i === 0 || a[i - 1].status <= t.status);
    return { n: out.length, sorted, board: board.length, gantt: gantt.length, boardOk, ganttOk };
  })()`);
  PASS('C9 B5: board and gantt carry the SAME shared-order index per task',
    shared.n > 0 && shared.sorted && shared.boardOk && shared.ganttOk,
    JSON.stringify(shared));

  const multi = await js(`(() => {
    CP.Board.clearMulti();
    const cards = Array.from(document.querySelectorAll('#view-board .kb-card')).slice(0, 2);
    cards.forEach(c => c.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })));
    const ids = CP.Board.selectedIds();
    return { ok: ids.length === 2, ids,
      painted: cards.every(c => c.classList.contains('is-multi-selected')) };
  })()`);
  PASS('C9 B5: Shift+Click multi-selects TWO cards and paints both',
    multi.ok && multi.painted, JSON.stringify(multi));

  const c9before = await js(`(() => CP.Board.selectedIds().map(id => {
    const t = CP.store.state.tasks.find(x => x.id === id);
    return { id: id, sort: t && t.sort };
  }))()`);
  await js(`CP.Board.moveSelected('top')`);
  await sleep(800);
  const c9state = await api('GET', '/api/state');
  const c9tasks = (c9state.body && c9state.body.tasks) || [];
  const c9changed = c9before.filter(b => {
    const a = c9tasks.find(x => x.id === b.id);
    return a && a.sort !== b.sort;
  }).length;
  PASS('C9 B5: move-to-top persists a new sort for BOTH selected cards',
    c9before.length === 2 && c9changed === 2,
    `selected=${c9before.length} persisted=${c9changed} ` +
    c9before.map(b => b.id + ':' + b.sort).join(' '));
  await js(`CP.Board.clearMulti()`);

  /* 25. Desk sheets + event history (I-019 P-TEST) */
  /* Incremental gate for the P-UI desk sheet stack and the P-SVC desk_events
     log: one-active-sheet tabbing, localStorage('desk.sheet') persistence
     (write side, reload restore, bogus fallback), the four per-unit History
     blocks, the GET/POST /api/events contract, the board.ts signal raise/clear
     differential (fire-and-forget POSTs, polled with a deadline), the ACK
     created timestamps and the History filter. The probe marker row and the
     probe task use unique per-run markers; the probe task is deleted again
     before this block ends. */
  const errBase = errors.length;
  const SHEET_UNIT = { console: 'command', inbox: 'job', acks: 'ack', signals: 'signal' };
  const HIST_UNITS = ['command', 'job', 'ack', 'signal'];
  await js(`document.querySelector('[data-view="desk"]').click()`);

  /* Tab bar: four sheets exist, exactly one is active, and the active tab
     names exactly that sheet. */
  const tabInfo = await js(`(() => {
    const tabs = Array.from(document.querySelectorAll('#deskTabs .desk-tab'));
    const sheets = Array.from(document.querySelectorAll('#view-desk .desk-sheet'));
    const tabEl = document.querySelector('#deskTabs .desk-tab.active');
    const sheetEl = document.querySelector('#view-desk .desk-sheet.active');
    return {
      tabs: tabs.map((t) => t.dataset.sheet || '').sort(),
      sheets: sheets.map((s) => s.id).sort(),
      activeTabs: tabs.filter((t) => t.classList.contains('active')).length,
      activeSheets: sheets.filter((s) => s.classList.contains('active')).length,
      pair: (tabEl ? tabEl.dataset.sheet : '') + '|' + (sheetEl ? sheetEl.id : ''),
    };
  })()`);
  PASS('Desk tab bar exposes four sheets: console / inbox / acks / signals',
    JSON.stringify(tabInfo.tabs) === JSON.stringify(['acks', 'console', 'inbox', 'signals'])
    && JSON.stringify(tabInfo.sheets) === JSON.stringify(['sheet-acks', 'sheet-console', 'sheet-inbox', 'sheet-signals']),
    'tabs=' + tabInfo.tabs.join(',') + ' sheets=' + tabInfo.sheets.join(','));
  PASS('Exactly one desk sheet is active and it matches the active tab',
    tabInfo.activeTabs === 1 && tabInfo.activeSheets === 1
    && tabInfo.pair.split('|')[1] === 'sheet-' + tabInfo.pair.split('|')[0],
    'pair=' + tabInfo.pair + ' activeTabs=' + tabInfo.activeTabs + ' activeSheets=' + tabInfo.activeSheets);

  /* Clicking each tab activates its sheet, deactivates the others and loads
     that sheet's History block (data rows or the explicit status row). */
  const clickLog = [];
  for (const sheetName of ['console', 'inbox', 'acks', 'signals']) {
    const unit = SHEET_UNIT[sheetName];
    await js(`document.querySelector('#deskTabs .desk-tab[data-sheet=${JSON.stringify(sheetName)}]').click()`);
    await until(`(() => {
      const s = document.querySelector('#view-desk .desk-sheet.active');
      const t = document.querySelector('#deskTabs .desk-tab.active');
      return (s ? s.id : '') + '|' + (t ? t.dataset.sheet : '')
        + '|' + document.querySelectorAll('#view-desk .desk-sheet.active').length
        + '|' + document.querySelectorAll('#deskTabs .desk-tab.active').length;
    })()`, (v) => v === 'sheet-' + sheetName + '|' + sheetName + '|1|1', 3000);
    await until(`document.querySelectorAll('#histBody-${unit} tr.hist-row').length`, (v) => Number(v) > 0, 5000);
    clickLog.push(sheetName + '->sheet-' + sheetName);
  }
  PASS('Clicking each desk tab activates its sheet and deactivates the others',
    clickLog.length === 4, clickLog.join(' '));

  /* Every History block settled above: rows carrying a kind chip, or exactly
     the one explicit status row when the unit has no events yet. */
  const histInfo = await js(`(() => {
    const out = {};
    ['command', 'job', 'ack', 'signal'].forEach((u) => {
      const rows = Array.from(document.querySelectorAll('#histBody-' + u + ' tr.hist-row'));
      out[u] = {
        rows: rows.length,
        data: rows.filter((r) => !r.classList.contains('hist-status') && !!r.querySelector('span.hist-kind')).length,
        status: rows.filter((r) => r.classList.contains('hist-status')).map((r) => r.textContent.trim()),
        unavailable: rows.some((r) => r.textContent.toLowerCase().indexOf('unavailable') >= 0),
      };
    });
    return out;
  })()`);
  PASS('Every per-unit History block renders event rows or an explicit status row',
    HIST_UNITS.every((u) => histInfo[u].rows > 0 && !histInfo[u].unavailable
      && (histInfo[u].data > 0 || (histInfo[u].status.length === 1 && histInfo[u].status[0] === 'No events yet.')))
    && histInfo.command.data >= 1 && histInfo.job.data >= 1 && histInfo.ack.data >= 1,
    JSON.stringify(histInfo));

  /* Persistence write side: the active sheet lands in localStorage. */
  await js(`document.querySelector('#deskTabs .desk-tab[data-sheet="acks"]').click()`);
  const sheetStored = await js(`localStorage.getItem('desk.sheet')`);
  PASS('Active desk sheet persists to localStorage(desk.sheet)', sheetStored === 'acks',
    'desk.sheet=' + sheetStored);

  /* Restore on load: a real reload reads the key back. */
  await js(`localStorage.setItem('desk.sheet', 'acks'); true`);
  await cmd('Page.reload', { ignoreCache: true });
  await sleep(900);
  await ready();
  const sheetRestored = await js(`(() => {
    const s = document.querySelector('#view-desk .desk-sheet.active');
    const t = document.querySelector('#deskTabs .desk-tab.active');
    return (s ? s.id : '') + '|' + (t ? t.dataset.sheet : '') + '|' + localStorage.getItem('desk.sheet');
  })()`);
  PASS('Reload restores the persisted desk sheet (desk.sheet=acks)',
    sheetRestored === 'sheet-acks|acks|acks', 'after reload: ' + sheetRestored);

  /* A bogus saved value must fall back to console, not break the desk. */
  await js(`localStorage.setItem('desk.sheet', 'bogus-sheet'); true`);
  await cmd('Page.reload', { ignoreCache: true });
  await sleep(900);
  await ready();
  const sheetFallback = await js(`(() => {
    const s = document.querySelector('#view-desk .desk-sheet.active');
    const t = document.querySelector('#deskTabs .desk-tab.active');
    return (s ? s.id : '') + '|' + (t ? t.dataset.sheet : '') + '|' + localStorage.getItem('desk.sheet');
  })()`);
  PASS('A bogus desk.sheet value falls back to the console sheet on load',
    sheetFallback === 'sheet-console|console|console', 'after reload: ' + sheetFallback);

  /* GET /api/events contract. */
  const evCmd = await api('GET', '/api/events?unit=command');
  const cmdRows = (evCmd.body && evCmd.body.events) || [];
  PASS('GET /api/events?unit=command returns 200 with an events array',
    evCmd.status === 200 && Array.isArray(evCmd.body && evCmd.body.events),
    'status=' + evCmd.status + ' events=' + cmdRows.length);

  const HISTMARK = 'histprobe alpha ' + Math.random().toString(36).slice(2, 8);
  const markRow = await api('POST', '/api/events', { unit: 'command', kind: 'probe', detail: HISTMARK });
  PASS('POST /api/events stores the history probe marker row (unit=command)',
    markRow.status === 200 && !!markRow.body && !!markRow.body.id
    && markRow.body.unit === 'command' && markRow.body.kind === 'probe' && markRow.body.detail === HISTMARK,
    'id=' + (markRow.body ? markRow.body.id : '') + ' ts=' + (markRow.body ? markRow.body.ts : ''));

  const qHit = await api('GET', '/api/events?unit=command&q=HISTPROBE');
  const qRows = (qHit.body && qHit.body.events) || [];
  PASS('GET /api/events q=HISTPROBE finds the marker case-insensitively',
    qHit.status === 200 && qRows.length >= 1
    && qRows.every((r) => String(r.detail).toLowerCase().indexOf('histprobe') >= 0)
    && qRows.some((r) => r.detail === HISTMARK),
    'rows=' + qRows.length + ' sample=' + (qRows[0] ? String(qRows[0].detail).slice(0, 40) : '(none)'));

  const badUnit = await api('GET', '/api/events?unit=bogus');
  PASS('GET /api/events rejects an unknown unit with HTTP 400 + error',
    badUnit.status === 400 && !!(badUnit.body && badUnit.body.error),
    'status=' + badUnit.status + ' error=' + (badUnit.body ? String(badUnit.body.error).slice(0, 50) : ''));

  const evClamp = await api('GET', '/api/events?unit=command&limit=0');
  const clampRows = (evClamp.body && evClamp.body.events) || [];
  PASS('GET /api/events clamps limit=0 up to one row (listEvents floor of 1)',
    evClamp.status === 200 && clampRows.length === 1,
    'rows=' + clampRows.length + ' of total=' + (cmdRows.length + 1) + ' (limit=0 clamped to 1)');

  /* POST /api/events contract. */
  const okEv = await api('POST', '/api/events', { unit: 'signal', kind: 'raise', detail: 'probe' });
  PASS('POST /api/events accepts a valid signal/raise row and echoes it back',
    okEv.status === 200 && !!okEv.body && !!okEv.body.id && !!okEv.body.ts
    && okEv.body.unit === 'signal' && okEv.body.kind === 'raise' && okEv.body.detail === 'probe',
    JSON.stringify(okEv.body).slice(0, 120));

  const badEvUnit = await api('POST', '/api/events', { unit: 'nope', kind: 'x', detail: 'y' });
  PASS('POST /api/events rejects an unknown unit with HTTP 400 + error',
    badEvUnit.status === 400 && !!(badEvUnit.body && badEvUnit.body.error),
    'status=' + badEvUnit.status + ' error=' + (badEvUnit.body ? String(badEvUnit.body.error).slice(0, 50) : ''));

  const emptyKind = await api('POST', '/api/events', { unit: 'signal', kind: '', detail: 'y' });
  PASS('POST /api/events rejects an empty kind with HTTP 400 + error',
    emptyKind.status === 400 && !!(emptyKind.body && emptyKind.body.error),
    'status=' + emptyKind.status + ' error=' + (emptyKind.body ? String(emptyKind.body.error).slice(0, 50) : ''));

  const emptyDetail = await api('POST', '/api/events', { unit: 'signal', kind: 'raise', detail: '' });
  PASS('POST /api/events rejects an empty detail with HTTP 400 + error',
    emptyDetail.status === 400 && !!(emptyDetail.body && emptyDetail.body.error),
    'status=' + emptyDetail.status + ' error=' + (emptyDetail.body ? String(emptyDetail.body.error).slice(0, 50) : ''));

  /* ACK rows carry their created timestamp in time.ack-created. */
  const ackTs = await js(`(() => Array.from(document.querySelectorAll('#ackList .ack-row')).map((r) => {
    const t = r.querySelector('time.ack-created');
    return { has: !!t, text: t ? t.textContent.trim() : '' };
  }))()`);
  const ackStamp = /^\d{4}-\d{2}-\d{2}T\d{2}:00$/;
  PASS('ACK rows carry time.ack-created with the row timestamp',
    ackTs.length > 0 && ackTs.every((a) => a.has)
    && ackTs.every((a) => !a.text || ackStamp.test(a.text))
    && ackTs.some((a) => ackStamp.test(a.text)),
    'rows=' + ackTs.length + ' timestamps=' + ackTs.map((a) => a.text).join(','));

  /* Signal differential logging (board.ts): seed the session baseline first
     (the first render after a reload seeds silently), then raise and clear one
     stuck >24h probe task. The POSTs are fire-and-forget, so poll the log. */
  await js(`CP.store.load().then(() => true).catch(() => false)`);
  const probeRes = await api('POST', '/api/tasks', {
    title: 'P-TEST signal probe', status: 'pending', owner: 'subagent-test', owner_type: 'subagent',
    role: 'Probe', handoff: 'histprobe signal differential',
    start: at(-30).replace(' ', 'T'), end: at(-28).replace(' ', 'T'),
  });
  const probeId = (probeRes.body && probeRes.body.id) || '';
  await js(`CP.store.load().then(() => true).catch(() => false)`);
  let raiseEv = null;
  for (let i = 0; i < 60 && !raiseEv; i += 1) {
    const ev = await api('GET', '/api/events?unit=signal');
    const rows = (ev.body && ev.body.events) || [];
    raiseEv = rows.filter((r) => r.kind === 'raise' && probeId && String(r.detail).indexOf(probeId) >= 0)[0] || null;
    if (!raiseEv) await sleep(150);
  }
  PASS('A stuck >24h probe task posts a signal/raise event naming the task id',
    !!probeId && !!raiseEv,
    raiseEv ? 'id=' + raiseEv.id + ' detail=' + String(raiseEv.detail).slice(0, 70) : 'no raise for ' + probeId);

  if (probeId) await api('DELETE', '/api/tasks/' + encodeURIComponent(probeId));
  await js(`CP.store.load().then(() => true).catch(() => false)`);
  let clearEv = null;
  for (let i = 0; i < 60 && !clearEv; i += 1) {
    const ev = await api('GET', '/api/events?unit=signal');
    const rows = (ev.body && ev.body.events) || [];
    clearEv = rows.filter((r) => r.kind === 'clear' && probeId && String(r.detail).indexOf(probeId) >= 0)[0] || null;
    if (!clearEv) await sleep(150);
  }
  PASS('Deleting the probe task posts a signal/clear event naming the task id',
    !!probeId && !!clearEv,
    clearEv ? 'id=' + clearEv.id + ' detail=' + String(clearEv.detail).slice(0, 70) : 'no clear for ' + probeId);
  if (probeId) await api('DELETE', '/api/tasks/' + encodeURIComponent(probeId));

  /* History filter: typing a marker narrows the command history to the probe
     row; a marker that matches nothing shows the explicit empty status row. */
  await sleep(600);
  await js(`(() => {
    const q = document.getElementById('histFilter-command');
    q.value = ${JSON.stringify(HISTMARK)};
    q.dispatchEvent(new Event('input', { bubbles: true }));
    return q.value;
  })()`);
  await until(`(() => {
    const rows = Array.from(document.querySelectorAll('#histBody-command tr.hist-row'))
      .filter((r) => !r.classList.contains('hist-status'));
    return rows.length === 1 && rows[0].textContent.toLowerCase().indexOf('histprobe') >= 0
      ? 'match' : String(rows.length);
  })()`, (v) => v === 'match', 5000);
  const fRows = await js(`(() => Array.from(document.querySelectorAll('#histBody-command tr.hist-row')).map((r) => ({
    status: r.classList.contains('hist-status'), kind: !!r.querySelector('span.hist-kind'),
    text: r.textContent.trim().slice(0, 70),
  })))()`);
  PASS('History filter input narrows #histBody-command to the probe marker row',
    fRows.length === 1 && !fRows[0].status && fRows[0].kind && /histprobe/i.test(fRows[0].text),
    JSON.stringify(fRows).slice(0, 150));

  await js(`(() => {
    const q = document.getElementById('histFilter-command');
    q.value = 'zzz-no-such-event-zzz';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  const emptyMsg = await until(`(() => {
    const rows = Array.from(document.querySelectorAll('#histBody-command tr.hist-row'));
    return rows.length === 1 && rows[0].classList.contains('hist-status')
      ? rows[0].textContent.trim() : '';
  })()`, (v) => v === 'No events yet.', 5000);
  PASS('A history filter matching nothing shows the explicit empty status row',
    emptyMsg === 'No events yet.', 'status row=' + emptyMsg);

  /* Tidy: clear the filters, leave the console sheet active, and prove this
     block added no console noise of its own. */
  await js(`(() => {
    ['command', 'job', 'ack', 'signal'].forEach((u) => {
      const f = document.getElementById('histFilter-' + u);
      if (f) f.value = '';
    });
    document.querySelector('#deskTabs .desk-tab[data-sheet="console"]').click();
    return true;
  })()`);
  await sleep(400);
  PASS('The desk sheet and history probes added no JS exceptions or console errors',
    errors.length === errBase, 'errors before=' + errBase + ' after=' + errors.length);

  /* 26. UI chrome (I-022 / I-023 / I-027): charter fold, sidebar drag width,
     the R32-retargeted I-027 assertions (the pagination tabs moved to the
     Work board split with the hour axis), settings page. Synthetic
     PointerEvents are dispatched on the grips themselves, so no real mouse
     is needed. */
  const chFold0 = await js(`(() => {
    const c = document.getElementById('charter');
    const b = document.getElementById('btnCharterFold');
    return { collapsed: c.classList.contains('collapsed'), label: b.textContent.trim() };
  })()`);
  PASS('First-principles block starts folded, out of the picture',
    chFold0.collapsed === true && chFold0.label === 'Unfold', JSON.stringify(chFold0));

  await js(`document.getElementById('btnCharterFold').click()`);
  const chFold1 = await js(`({
    open: !document.getElementById('charter').classList.contains('collapsed'),
    stored: localStorage.getItem('cp.charter-open')
  })`);
  PASS('Charter toggle opens the block and persists the state',
    chFold1.open === true && chFold1.stored === '1', JSON.stringify(chFold1));
  await js(`document.getElementById('btnCharterFold').click()`);

  const sideDrag = await js(`(() => {
    const g = document.getElementById('sideResize');
    const ev = (t, x) => g.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: x, clientY: 300, bubbles: true }));
    ev('pointerdown', 300); ev('pointermove', 380); ev('pointerup', 380);
    return {
      w: document.documentElement.style.getPropertyValue('--side-w'),
      stored: localStorage.getItem('cp.side-w')
    };
  })()`);
  await sleep(320); /* the sidebar width eases over .22s before it settles */
  sideDrag.width = await js(`document.getElementById('sidebar').getBoundingClientRect().width`);
  PASS('Sidebar drag-resize sets --side-w and persists it',
    !!sideDrag.w && sideDrag.stored === sideDrag.w && sideDrag.width > 300, JSON.stringify(sideDrag));

  await cmd('Page.reload', { ignoreCache: true });
  await sleep(900);
  await ready();
  const sideBack = await js(`({
    w: document.documentElement.style.getPropertyValue('--side-w'),
    width: document.getElementById('sidebar').getBoundingClientRect().width
  })`);
  PASS('Sidebar width survives a reload',
    sideBack.w === sideDrag.w && sideBack.width > 300, JSON.stringify(sideBack));

  /* I-027 -> R32 -> R36 recorded corrections: the pinned two-tab pagination
     assertions are re-targeted once more - the Work board split retires and
     the board becomes a two-tab view ([Work board] / [Hour axis]) like the
     desk sheet tablist. Assertion intents stay identical: exactly one content
     configuration per view, the layout choice persisting in a cp.* chrome key
     (cp.wb-tab), no divider/fold chrome, and the goal tree living in the
     Plan view under a header that stays put while the layer scrolls. */
  await js(`document.querySelector('[data-view="plan"]').click()`);
  await sleep(150);
  const planTab0 = await js(`(() => {
    const bar = document.getElementById('planTabs');
    const ms = document.getElementById('milestonePanel');
    const gt = document.getElementById('ganttPanel');
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
    return {
      noBar: !bar,
      msVis: vis(ms),
      msInPlan: !!(ms && ms.closest('#view-plan')),
      gtInPlan: !!(gt && gt.closest('#view-plan')),
      gtInBoard: !!(gt && gt.closest('#view-board')),
      divider: !!document.getElementById('divider'),
      foldPlan: !!document.getElementById('btnFoldPlan'),
      foldGantt: !!document.getElementById('btnFoldGantt')
    };
  })()`);
  PASS('Plan page is one full-pane milestone layer (tab bar retired by R32); divider and Fold buttons still gone (I-027)',
    planTab0.noBar && planTab0.msVis && planTab0.msInPlan
      && !planTab0.gtInPlan && planTab0.gtInBoard
      && !planTab0.divider && !planTab0.foldPlan && !planTab0.foldGantt,
    JSON.stringify(planTab0));

  const planTab1 = await js(`(() => {
    document.querySelector('[data-view="board"]').click();
    CP.switchWbTab('board');
    const page = document.getElementById('workBoard');
    const kb = document.getElementById('wbBoardTab');
    const ax = document.getElementById('ganttPanel');
    const bar = document.getElementById('wbTabs');
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
    if (!page || !kb || !ax || !bar) return { ok: false, reason: 'missing board chrome' };
    const labels = Array.from(bar.querySelectorAll('[data-wb-tab]')).map((b) => b.textContent.trim());
    const total = Math.round(page.getBoundingClientRect().width);
    const before = { kbVis: vis(kb), axVis: vis(ax), kbW: Math.round(kb.getBoundingClientRect().width) };
    bar.querySelector('[data-wb-tab="axis"]').click();
    const afterAxis = {
      kbVis: vis(kb), axVis: vis(ax),
      axW: Math.round(ax.getBoundingClientRect().width),
      stored: localStorage.getItem('cp.wb-tab'),
      selAxis: bar.querySelector('[data-wb-tab="axis"]').getAttribute('aria-selected'),
      selBoard: bar.querySelector('[data-wb-tab="board"]').getAttribute('aria-selected')
    };
    bar.querySelector('[data-wb-tab="board"]').click();
    return {
      ok: true, labels, total, before, afterAxis,
      storedBack: localStorage.getItem('cp.wb-tab')
    };
  })()`);
  PASS('Work board is a two-tab view ([Work board] / [Hour axis]); one full-width pane per tab; cp.wb-tab persists (R36 retarget of the I-027->I-037 split assertions)',
    planTab1.ok && planTab1.labels.join('|') === '[Work board]|[Hour axis]'
      && planTab1.before.kbVis && !planTab1.before.axVis
      && planTab1.before.kbW >= planTab1.total * 0.9
      && !planTab1.afterAxis.kbVis && planTab1.afterAxis.axVis
      && planTab1.afterAxis.axW >= planTab1.total * 0.9
      && planTab1.afterAxis.stored === 'axis'
      && planTab1.afterAxis.selAxis === 'true' && planTab1.afterAxis.selBoard === 'false'
      && planTab1.storedBack === 'board',
    JSON.stringify(planTab1));

  const planGoalMini = (() => {
    /* Tall enough that the Milestone plan pane really scrolls, so the pinned
       tab bar is proven against actual content movement. */
    const miniMs = [];
    for (let i = 0; i < 30; i += 1) {
      miniMs.push({ id: 'PM' + i, name: 'Holder ' + i, depends_on: i ? ['PM' + (i - 1)] : [],
        start_offset_h: i * 4, end_offset_h: i * 4 + 4, status: 'todo', completion: 0, verify: 'ok' });
    }
    return {
      available: true, state: 'READY', label: 'Milestone plan ready', detail: '',
      fix_command: 'node scripts/prd-to-action.js', message: '', schema: 'ai-project-ops.plan/1.0',
      goals: [{ id: 'PG1', title: 'Pinned tab holder', milestone_ids: miniMs.map((m) => m.id) }],
      milestones: miniMs, work_units: [], relations: [], main_line: ['PM0'], sub_lines: {},
      analysis: {}
    };
  })();
  const planTab2 = await js(`(() => {
    document.querySelector('[data-view="plan"]').click();
    CP.applyPlan(${JSON.stringify(planGoalMini)});
    const layer = document.getElementById('milestoneLayer');
    const head = document.querySelector('#milestonePanel .panel-head');
    const top0 = head ? head.getBoundingClientRect().top : -1000;
    if (layer) layer.scrollTop = 140;
    const top1 = head ? head.getBoundingClientRect().top : -1000;
    const tree = document.getElementById('msGoalTree');
    const ms = document.getElementById('milestonePanel');
    const gt = document.getElementById('ganttPanel');
    return {
      scrolled: layer ? layer.scrollTop : -1,
      pinDrift: Math.abs(top1 - top0),
      hasTree: !!tree,
      inMs: !!tree && !!ms && ms.contains(tree),
      inPlan: !!(tree && tree.closest('#view-plan')),
      inGt: !!tree && !!gt && gt.contains(tree),
      msShown: !!ms && getComputedStyle(ms).display !== 'none',
      gtInBoard: !!(gt && gt.closest('#view-board')),
      headTop: top1
    };
  })()`);
  PASS('Pane header stays pinned while the Plan view scrolls; goal tree lives full-page in that view (I-027 retarget -> R32)',
    planTab2.pinDrift <= 1 && planTab2.scrolled > 0 && planTab2.hasTree
      && planTab2.inMs && planTab2.inPlan && !planTab2.inGt
      && planTab2.msShown && planTab2.gtInBoard && planTab2.headTop >= 0,
    JSON.stringify(planTab2));
  await js(`(async () => { await CP.refreshPlan(); return true; })()`);

  await js(`document.querySelector('#nav button[data-view=settings]').click()`);
  await sleep(150);
  const setDom = await js(`(() => {
    const rows = Array.from(document.querySelectorAll('#view-settings .set-label')).map((r) => r.textContent.trim());
    document.querySelector('#setTheme [data-theme-val=dark]').click();
    return {
      active: document.getElementById('view-settings').classList.contains('active'),
      rows: rows.join('|'),
      theme: document.documentElement.getAttribute('data-theme'),
      port: document.getElementById('setPort').value
    };
  })()`);
  PASS('Settings page opens with theme, port and language rows; theme applies',
    setDom.active === true && setDom.rows.indexOf('Color scheme') >= 0 && setDom.rows.indexOf('Port') >= 0
      && setDom.rows.indexOf('Language') >= 0 && setDom.theme === 'dark' && setDom.port !== '',
    JSON.stringify(setDom));

  const glassState = await js(`(() => {
    const g = document.getElementById('setGlass');
    g.value = '55';
    g.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      alpha: document.documentElement.style.getPropertyValue('--glass-alpha'),
      out: document.getElementById('setGlassOut').textContent.trim(),
      stored: localStorage.getItem('cp.glass-alpha')
    };
  })()`);
  PASS('Settings glass slider drives --glass-alpha and persists',
    glassState.alpha === '0.55' && glassState.out === '55%' && glassState.stored === '0.55', JSON.stringify(glassState));

  const resetState = await js(`(() => {
    document.querySelector('#setTheme [data-theme-val=auto]').click();
    const realReload = CP.reload;
    CP.reload = () => {}; /* stub the seam: window.location.* is non-writable */
    localStorage.setItem('cp.side-w', '300px');
    document.getElementById('setReset').click();
    CP.reload = realReload;
    const left = ['cp.side-w', 'cp.side-collapsed', 'cp.charter-open', 'cp.fold-plan', 'cp.fold-gantt']
      .filter((k) => localStorage.getItem(k) !== null);
    return left;
  })()`);
  PASS('Settings reset clears saved chrome preferences', Array.isArray(resetState) && resetState.length === 0, 'left=' + JSON.stringify(resetState));

  /* 27. I-020 traceability view: goal tree + analysis columns above the
     milestone gantt. Additive section - no earlier assertion is edited. The
     fixture goes through CP.applyPlan exactly like the section 23 plan
     fixtures; one live assertion reads the real /api/plan; one fixture
     without goals/analysis proves the old-server degrade path. */
  const err27 = errors.length;
  await js(`document.querySelector('#nav [data-view=plan]').click()`);

  const GOAL_FIX = {
    available: true, state: 'READY', label: 'Milestone plan ready', detail: '',
    fix_command: 'node scripts/prd-to-action.js', message: '', schema: 'ai-project-ops.plan/1.0',
    goals: [
      { id: 'G1', title: 'Release 1.8.x with discipline gates', milestone_ids: ['M6', 'M7'] },
      { id: 'G2', title: 'Goal-anchored WBS visualization', milestone_ids: ['M8'] },
    ],
    analysis: {
      M6: { status: 'done', progress: 100, cost: 2.1, rounds: ['R24', 'R26'], rework: 0 },
      M7: { status: 'done', progress: 100, cost: 0.6, rounds: ['R24'], rework: 0 },
      M8: { status: 'todo', progress: 0, cost: 0, rounds: [], rework: 0 },
      W14: { status: 'done', progress: 100, cost: 2.1, rounds: ['R24'], rework: 0 },
      W15: { status: 'done', progress: 100, cost: 0.6, rounds: ['R24'], rework: 0 },
      W16: { status: 'todo', progress: 0, cost: 0, rounds: ['R99'], rework: 1 },
    },
    milestones: [
      { id: 'M6', name: 'Release gates', depends_on: [], start_offset_h: 0, end_offset_h: 12, status: 'done', completion: 100, verify: 'ok' },
      { id: 'M7', name: 'Discipline', depends_on: 'M6', start_offset_h: 12, end_offset_h: 24, status: 'done', completion: 100, verify: 'ok' },
      { id: 'M8', name: 'WBS view', depends_on: 'M6', start_offset_h: 12, end_offset_h: 30, status: 'todo', completion: 0, verify: 'ok' },
    ],
    work_units: [
      { id: 'W14', milestone_id: 'M6', title: 'Gate wiring', owner: 'main', start_offset_h: 0, end_offset_h: 8, progress: 100, cost: 2.1 },
      { id: 'W15', milestone_id: 'M7', title: 'Ledger parse', owner: 'main', start_offset_h: 12, end_offset_h: 24, progress: 100, cost: 0.6 },
      { id: 'W16', milestone_id: 'M8', title: 'Tree render', owner: 'subagent', start_offset_h: 12, end_offset_h: 30, progress: 0, cost: 0 },
    ],
    relations: [], main_line: ['M6', 'M8'],
    sub_lines: { M6: ['W14'], M7: ['W15'], M8: ['W16'] },
  };

  const goalRows = await js(`(() => {
    CP.applyPlan(${JSON.stringify(GOAL_FIX)});
    const tree = document.getElementById('msGoalTree');
    const text = tree ? tree.textContent : '';
    const g1 = document.querySelector('.ms-goal-group[data-goal=G1] .ms-a-goal');
    const g2 = document.querySelector('.ms-goal-group[data-goal=G2] .ms-a-goal');
    const ms = document.querySelector('.ms-goal-row[data-kind=ms][data-node=M6]');
    return {
      hasTree: !!tree,
      goalCount: document.querySelectorAll('.ms-goal-row[data-kind=goal]').length,
      cols: ['status', 'progress', 'cost', 'rounds', 'rework'].every((w) => text.indexOf(w) >= 0),
      g1: g1 ? g1.textContent.replace(/\\s+/g, ' ').trim() : '',
      g2: g2 ? g2.textContent.replace(/\\s+/g, ' ').trim() : '',
      msDepth: ms ? ms.style.getPropertyValue('--depth') : ''
    };
  })()`);
  PASS('Goal rows render above the gantt with the five analysis columns (I-020)',
    goalRows.hasTree && goalRows.goalCount >= 2 && goalRows.cols
      && goalRows.g1.indexOf('[done]') >= 0 && goalRows.g1.indexOf('100%') >= 0
      && goalRows.g1.indexOf('$2.7k') >= 0 && goalRows.g1.indexOf('rounds: R24 R26') >= 0
      && goalRows.g1.indexOf('rework: 0') >= 0
      && goalRows.g2.indexOf('[todo]') >= 0 && goalRows.g2.indexOf('$0') >= 0
      && goalRows.g2.indexOf('rounds: R99') >= 0 && goalRows.g2.indexOf('rework: 1') >= 0
      && goalRows.msDepth === '1',
    JSON.stringify(goalRows));

  const wuRow = await js(`(() => {
    const el = document.querySelector('.ms-goal-row[data-kind=wu][data-node=W14]');
    return { text: el ? el.textContent.replace(/\\s+/g, ' ').trim() : '', has: !!el };
  })()`);
  PASS('Work-unit row shows its rounds list from the analysis block (I-020)',
    wuRow.has && wuRow.text.indexOf('[done]') >= 0 && wuRow.text.indexOf('rounds: R24') >= 0
      && wuRow.text.indexOf('rework: 0') >= 0,
    wuRow.text);

  const live27 = await js(`(async () => {
    const r = await fetch('/api/plan', { cache: 'no-store' });
    let p = null;
    try { p = await r.json(); } catch (e) { p = null; }
    p = p || {};
    CP.applyPlan(p);
    const tree = document.getElementById('msGoalTree');
    const firstWu = document.querySelector('.ms-goal-row[data-kind=wu]');
    return {
      status: r.status, available: p.available === true,
      goals: Array.isArray(p.goals) ? p.goals.length : 0,
      anaKeys: p.analysis ? Object.keys(p.analysis).length : 0,
      hasTree: !!tree,
      goalRows: document.querySelectorAll('.ms-goal-row[data-kind=goal]').length,
      groups: document.querySelectorAll('.ms-group').length,
      wuText: firstWu ? firstWu.textContent.replace(/\\s+/g, ' ').trim() : ''
    };
  })()`);
  PASS('Live /api/plan renders the goal tree when goals exist and keeps the gantt',
    live27.status === 200 && (live27.goals > 0) === live27.hasTree
      && live27.goalRows === live27.goals
      && (live27.available ? live27.groups > 0 : live27.groups === 0)
      && (live27.anaKeys > 0 ? live27.wuText.indexOf('rounds:') >= 0 : true),
    JSON.stringify(live27));

  const degrade27 = await js(`(() => {
    CP.applyPlan(${JSON.stringify(FIX)});
    return {
      tree: !!document.getElementById('msGoalTree'),
      groups: document.querySelectorAll('.ms-group').length,
      bars: document.querySelectorAll('.ms-main').length
    };
  })()`);
  PASS('Fixture without goals/analysis degrades to today\'s gantt render',
    !degrade27.tree && degrade27.groups === FIX.milestones.length
      && degrade27.bars === FIX.milestones.length,
    JSON.stringify(degrade27));

  await js(`(async () => { await CP.refreshPlan(); return true; })()`);
  PASS('Section 27 added no JS exceptions or console errors',
    errors.length === err27, 'errors before=' + err27 + ' after=' + errors.length);

  /* 28. R28 correction guard: test stubs must use CP seams. window.location.*
     is non-writable (LegacyUnforgeable), so a stub assignment silently no-ops
     and the test really navigates mid-suite. Lesson as a gate (I-021). */
  const r28Src = fs.readFileSync(path.join(OUT, 'selftest.js'), 'utf8');
  const r28LocWrites = r28Src.match(/window\.location\.[A-Za-z]+\s*=(?!=)/g) || [];
  PASS('No window.location monkey-patches in selftest; stubs go through CP seams',
    r28LocWrites.length === 0, 'found=' + JSON.stringify(r28LocWrites));

  /* 29. R29 / P-A (I-025, I-026, I-030): additive gate for this package.
     Charter only on the Command desk, glass only in Settings, signed lag and
     nature on plan relation rows, and the nature selector riding the canvas
     link-authoring write path. */
  const err29 = errors.length;

  /* I-025: the First-principles block renders on the desk and on no other
     view; the Edit button still opens the charter modal from the desk. */
  const i025View = await js(`(() => {
    const shown = () => {
      const c = document.getElementById('charter');
      return !!c && c.hidden === false && getComputedStyle(c).display !== 'none';
    };
    const out = { desk: null, others: {}, edit: null, fold: null };
    document.querySelector('#nav [data-view="desk"]').click();
    out.desk = shown();
    ['plan', 'board', 'ledger', 'meter', 'settings'].forEach((v) => {
      document.querySelector('#nav [data-view="' + v + '"]').click();
      out.others[v] = shown();
    });
    document.querySelector('#nav [data-view="desk"]').click();
    out.backToDesk = shown();
    out.edit = !!document.getElementById('btnCharterEdit');
    out.fold = !!document.getElementById('btnCharterFold');
    return out;
  })()`);
  PASS('Charter block renders only on the Command desk view (I-025)',
    i025View.desk === true && i025View.backToDesk === true
      && i025View.edit === true && i025View.fold === true
      && ['plan', 'board', 'ledger', 'meter', 'settings'].every((v) => i025View.others[v] === false),
    JSON.stringify(i025View));

  const i025Modal = await js(`(() => {
    document.querySelector('#nav [data-view="desk"]').click();
    document.getElementById('btnCharterEdit').click();
    const open = !document.getElementById('modalLayer').classList.contains('hidden');
    const form = !!document.getElementById('charterForm');
    const closeBtn = document.querySelector('#modalSheet [data-action="close"]');
    if (closeBtn) closeBtn.click();
    const closed = document.getElementById('modalLayer').classList.contains('hidden');
    return { open, form, closed };
  })()`);
  PASS('Charter modal stays reachable from the Command desk Edit button (I-025)',
    i025Modal.open === true && i025Modal.form === true && i025Modal.closed === true,
    JSON.stringify(i025Modal));

  /* I-026: no glass control in the shared chrome; the Settings Glass row is
     the single --glass-alpha control left in the page. */
  const i026Glass = await js(`(() => ({
    globalAlpha: !!document.getElementById('glassAlpha'),
    globalOut: !!document.getElementById('glassAlphaOut'),
    glassControl: !!document.querySelector('.glass-control'),
    topbarRange: !!document.querySelector('.topbar input[type=range]'),
    settingsGlass: !!document.getElementById('setGlass'),
    settingsRows: Array.from(document.querySelectorAll('#view-settings .set-label'))
      .map((r) => r.textContent.trim())
  }))()`);
  PASS('Glass control exists only as the Settings row; global slider removed (I-026)',
    !i026Glass.globalAlpha && !i026Glass.globalOut && !i026Glass.glassControl
      && !i026Glass.topbarRange && i026Glass.settingsGlass
      && i026Glass.settingsRows.indexOf('Glass') >= 0,
    JSON.stringify(i026Glass));

  /* I-030: a negative lag is a lead, and the cascade math keeps its sign. */
  const i030Lead = await js(`(() => {
    const T = (id, s, e) => ({ id, title: id, owner: '', owner_type: 'main', role: '', handoff: '',
      status: 'x', start: s, end: e, progress: 0, placeholder: 0, tier: 'S',
      billed: 0, cost: 0, sort: 0, parent_id: '', baseline_start: '', baseline_end: '' });
    /* FS lag -2: the successor may start up to 2h before the predecessor
       ends. Sitting exactly on that lead bound is legal - no bump. */
    const tasks = [T('L1', '2026-11-05 00:00', '2026-11-05 04:00'),
                   T('L2', '2026-11-05 02:00', '2026-11-05 06:00')];
    const deps = [{ from: 'L1', to: 'L2', type: 'FS', lag: -2 }];
    const hold = CP.bumpCascade(tasks, deps, 'L1', '2026-11-05 00:00', '2026-11-05 04:00');
    const moved = CP.bumpCascade(tasks, deps, 'L1', '2026-11-05 02:00', '2026-11-05 06:00');
    return { hold: hold.length, moved: moved.map((m) => m.id + '@' + m.start) };
  })()`);
  PASS('Negative lag (lead) flows through the bump cascade with its sign (I-030)',
    i030Lead.hold === 0 && i030Lead.moved.length === 1 && i030Lead.moved[0].indexOf('L2@') === 0,
    JSON.stringify(i030Lead));

  /* I-030 render: signed lag tokens and the nature badge on relation rows. */
  const i030RelFix = {
    available: true, state: 'READY', label: 'Milestone plan ready', detail: '',
    fix_command: 'node scripts/prd-to-action.js', message: '', schema: 'ai-project-ops.plan/1.0',
    milestones: [
      { id: 'NR1', name: 'Lead source', depends_on: [], start_offset_h: 0, end_offset_h: 12, status: 'done', completion: 100, verify: 'ok' },
      { id: 'NR2', name: 'Lead sink', depends_on: 'NR1', start_offset_h: 10, end_offset_h: 24, status: 'todo', completion: 0, verify: 'ok' },
      { id: 'NR3', name: 'Lagged sink', depends_on: 'NR1', start_offset_h: 12, end_offset_h: 26, status: 'todo', completion: 0, verify: 'ok' }
    ],
    work_units: [],
    relations: [
      { from: 'NR1', to: 'NR2', type: 'FS', lag: -2, nature: 'mandatory' },
      { from: 'NR1', to: 'NR3', type: 'FS', lag: 3, nature: 'external' },
      { from: 'NR2', to: 'NR3', type: 'SS', lag: 0, nature: '' }
    ],
    main_line: ['NR1', 'NR2'], sub_lines: {}
  };
  const i030RelRows = await js(`(() => {
    CP.applyPlan(${JSON.stringify(i030RelFix)});
    return Array.from(document.querySelectorAll('.ms-rel')).map((r) => {
      const lagEl = r.querySelector('.ms-rel-lag');
      const natEl = r.querySelector('.ms-rel-nature');
      return {
        text: r.textContent.replace(/\\s+/g, ' ').trim(),
        lag: lagEl ? lagEl.textContent : '',
        nature: natEl ? natEl.textContent : ''
      };
    });
  })()`);
  PASS('Relation rows render signed lag and the nature badge; zero lag is silent (I-030)',
    i030RelRows.length === 3
      && i030RelRows[0].lag === '-2d' && i030RelRows[0].text.indexOf('FS-2d') >= 0
      && i030RelRows[0].nature === 'mandatory'
      && i030RelRows[1].lag === '+3d' && i030RelRows[1].text.indexOf('FS+3d') >= 0
      && i030RelRows[1].nature === 'external'
      && i030RelRows[2].lag === '' && i030RelRows[2].nature === '',
    JSON.stringify(i030RelRows));
  await js(`(async () => { await CP.refreshPlan(); return true; })()`);

  /* I-030 authoring: the nature selector carries the frozen vocabulary, and
     the canvas link write path puts the picked value on the PUT body. */
  const i030Sel = await js(`(() => {
    const s = document.getElementById('gdepNature');
    return {
      present: !!s,
      options: s ? Array.from(s.options).map((o) => o.value + ':' + o.textContent.trim()) : [],
      value: s ? s.value : null,
      helper: typeof CP.linkNature === 'function' ? CP.linkNature() : '(missing)'
    };
  })()`);
  PASS('Link authoring exposes the frozen nature vocabulary selector (I-030)',
    i030Sel.present === true && i030Sel.value === '' && i030Sel.helper === ''
      && JSON.stringify(i030Sel.options) === JSON.stringify(
        ['', 'mandatory', 'discretionary', 'external'].map((v) => v + ':' + (v || 'unspecified'))),
    JSON.stringify(i030Sel));

  /* One real canvas drag: the drop must PUT nature through the dep write
     path. The fetch spy only observes; the app code is untouched. */
  const natFrom = (await api('POST', '/api/tasks', { title: 'NAT lead from', start: at(1), end: at(3) })).body || {};
  const natTo = (await api('POST', '/api/tasks', { title: 'NAT lead to', start: at(5), end: at(7) })).body || {};
  await js(`CP.store.load()`);
  await sleep(450);
  /* R32 retarget (I-037): the canvas lives on the Work board now; the
     nature write path assertion below is untouched. R36: the [Hour axis]
     tab is activated first (measurements run against the ACTIVE tab). */
  await js(`document.querySelector('[data-view="board"]').click()`);
  await js(`CP.switchWbTab('axis')`);
  await sleep(300);
  await js(`CP.store.query = 'NAT '; CP.store.emit();`);
  await sleep(400);
  await js(`(() => { const sc = document.getElementById('ganttScroll'); if (sc) { sc.scrollTop = 0; sc.scrollLeft = 0; } return true; })()`);
  await sleep(250);
  const natSetup = await js(`(() => {
    const sel = document.getElementById('gdepNature');
    if (sel) sel.value = 'mandatory';
    window.__natBodies = [];
    if (!window.__natSpyOn) {
      window.__natSpyOn = true;
      const real = window.fetch.bind(window);
      window.__natRealFetch = real;
      window.fetch = function (input, init) {
        try {
          const url = typeof input === 'string' ? input : ((input && input.url) || '');
          const method = (init && init.method) || (input && input.method) || 'GET';
          if (url.indexOf('/api/task-deps') >= 0 && method === 'PUT' && init && init.body) {
            window.__natBodies.push(String(init.body));
          }
        } catch (_e) { /* never break the app */ }
        return real(input, init);
      };
    }
    return { nature: sel ? sel.value : '(missing)', spying: !!window.__natSpyOn };
  })()`);
  const natGeo = await js(`(() => {
    const bars = {};
    document.querySelectorAll('.gbar').forEach((b) => { if (b.dataset.taskId) bars[b.dataset.taskId] = b; });
    const f = bars[${JSON.stringify(natFrom.id)}];
    const t = bars[${JSON.stringify(natTo.id)}];
    if (!f || !t) return { missing: true, bars: Object.keys(bars).length };
    const sc = document.getElementById('ganttScroll');
    if (sc) {
      for (let k = 0; k < 4; k += 1) {
        const sr = sc.getBoundingClientRect();
        const fr = f.getBoundingClientRect();
        const tr0 = t.getBoundingClientRect();
        const dy = Math.min(fr.top, tr0.top) - sr.top - 28;
        const dx = Math.min(fr.left, tr0.left) - sr.left - 260;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) break;
        sc.scrollTop = Math.max(0, sc.scrollTop + dy);
        sc.scrollLeft = Math.max(0, sc.scrollLeft + dx);
      }
    }
    const dot = f.querySelector('.gbar-link.right');
    if (!dot) return { missing: 'dot' };
    const dr = dot.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    const x1 = dr.left + dr.width / 2;
    const y1 = dr.top + dr.height / 2;
    const x2 = tr.left + 4;
    const y2 = tr.top + tr.height / 2;
    const under1 = document.elementFromPoint(x1, y1);
    const fr2 = f.getBoundingClientRect();
    const sr2 = sc ? sc.getBoundingClientRect() : null;
    return {
      x1, y1, x2, y2,
      active: (document.querySelector('.view.active') || {}).id || '',
      win: [window.innerWidth, window.innerHeight],
      sc: sr2 ? [Math.round(sr2.left), Math.round(sr2.top), Math.round(sr2.width), Math.round(sr2.height)] : null,
      sl: sc ? [Math.round(sc.scrollLeft), sc.scrollWidth, sc.clientWidth] : null,
      bar: [Math.round(fr2.left), Math.round(fr2.top), Math.round(fr2.width)],
      hit1: under1 ? String(under1.className || under1.tagName) : 'null'
    };
  })()`);
  await sleep(250);
  if (natGeo && !natGeo.missing && natGeo.x1 !== undefined) {
    await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x: natGeo.x1, y: natGeo.y1, button: 'left', clickCount: 1 });
    await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: (natGeo.x1 + natGeo.x2) / 2, y: (natGeo.y1 + natGeo.y2) / 2, button: 'left' });
    await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x: natGeo.x2, y: natGeo.y2, button: 'left', clickCount: 1 });
    await sleep(600);
  }
  await js(`CP.store.load()`);
  await sleep(450);
  const natBodies = await js(`(() => (window.__natBodies || []).map((b) => {
    try { return JSON.parse(b); } catch (e) { return { raw: String(b).slice(0, 80) }; }
  }))()`);
  PASS('Canvas link authoring PUTs the picked nature through the dep write path (I-030)',
    natSetup.nature === 'mandatory'
      && !!natGeo && !natGeo.missing
      && Array.isArray(natBodies)
      && natBodies.some((b) => b.from === natFrom.id && b.to === natTo.id
        && b.type === 'FS' && b.nature === 'mandatory'),
    'setup=' + JSON.stringify(natSetup) + ' geo=' + JSON.stringify(natGeo)
      + ' bodies=' + JSON.stringify(natBodies));

  /* Clean up the I-030 probes and leave the page as the suite found it. */
  for (const natId of [natFrom.id, natTo.id]) {
    if (natId) await api('DELETE', '/api/tasks/' + encodeURIComponent(natId));
  }
  await js(`(() => {
    if (window.__natRealFetch) { window.fetch = window.__natRealFetch; window.__natSpyOn = false; }
    const sel = document.getElementById('gdepNature');
    if (sel) sel.value = '';
    CP.store.query = ''; CP.store.emit();
    return true;
  })()`);
  await js(`(async () => { await CP.refreshPlan(); return true; })()`);

  PASS('Section 29 added no JS exceptions or console errors',
    errors.length === err29, 'errors before=' + err29 + ' after=' + errors.length);

  /* 30. R29 / P-B (I-028, I-029, I-030): additive gate for this package.
     Issue mirror upsert through the real CLI (node-side child process, like the
     HTTP blocks in 12-14) + evidence derivation + ledger column-width
     persistence + kanban card link toggle/navigation + task-dep nature
     validation (DOM checks like section 23). The temp ledger writes are
     restored in finally, so a mid-block failure cannot leave I-901-TEST or
     I-028 mutations in docs/evidence or panel.db. */
  const err30 = errors.length;
  const pbTmpId = 'I-9' + String(Date.now()).slice(-5) + '-TEST';
  const { execFileSync: pbExec } = require('child_process');
  const pbRepo = path.join(OUT, '..', '..');
  const pbIssueJs = path.join(pbRepo, 'scripts', 'issue.js');
  const pbLedgerFile = path.join(pbRepo, 'docs', 'evidence', 'issues.json');
  const pbDeltaFile = path.join(pbRepo, 'docs', 'evidence', 'issue-delta.json');
  const pbLedgerBak = fs.existsSync(pbLedgerFile) ? fs.readFileSync(pbLedgerFile, 'utf8') : null;
  const pbDeltaBak = fs.existsSync(pbDeltaFile) ? fs.readFileSync(pbDeltaFile, 'utf8') : null;
  const pbRun = (argv) => {
    try {
      return pbExec(process.execPath, [pbIssueJs].concat(argv),
        { encoding: 'utf8', env: Object.assign({}, process.env, { AIOPS_SESSION: 'selftest' }) });
    } catch (e) { return 'ERR ' + String((e && e.stdout) || '') + String((e && e.message) || ''); }
  };
  const pbStateOf = async (id) => {
    const r = await api('GET', '/api/state');
    return ((r.body && r.body.issues) || []).filter((x) => x.id === id)[0] || null;
  };
  /* Battery env carries demo rows only; seed the plan W tasks + task_deps this
     block needs (integration fix; verify.js wipes panel.db* at run start/end). */
  try {
    pbExec(process.execPath, [path.join(pbRepo, 'scripts', 'plan-sync.js'), '--seed-tasks'],
      { encoding: 'utf8', cwd: pbRepo });
  } catch (_e) { /* seed failure surfaces in the assertions below */ }
  try {
    const pbAddOut = pbRun(['add', '--id', pbTmpId, '--title', 'Selftest mirror probe',
      '--detail', 'temp row proving mirror upsert', '--source', 'selftest']);
    PASS('issue.js add INSERTs a new panel row (upsert, no "issue not found")',
      pbAddOut.indexOf('PASS  issue added :: ' + pbTmpId + ' | mirrored to SQLite') >= 0
        && pbAddOut.indexOf('mirror failed') < 0,
      pbAddOut.trim().split('\n').slice(-1)[0] || String(pbAddOut).slice(0, 140));
    const pbAdded = await pbStateOf(pbTmpId);
    PASS('Mirrored row carries status/opened/evidence fields on /api/state',
      !!pbAdded && pbAdded.status === 'open' && !!pbAdded.opened
        && Array.isArray(pbAdded.evidence) && pbAdded.evidence.length === 0,
      JSON.stringify(pbAdded && { status: pbAdded.status, opened: !!pbAdded.opened, evidence: pbAdded.evidence }));

    const pbUpdOut = pbRun(['update', '--id', 'I-028', '--reply', 'selftest evidence probe']);
    PASS('issue.js update INSERTs an existing ledger row the panel never had',
      /PASS\s+issue update :: I-028 \| mirrored to SQLite/.test(pbUpdOut)
        && pbUpdOut.indexOf('mirror failed') < 0,
      pbUpdOut.trim().split('\n').slice(-1)[0] || String(pbUpdOut).slice(0, 140));
    const pbI028 = await pbStateOf('I-028');
    PASS('Evidence derives TASK-LOG entry ids naming the issue (I-028 -> R29)',
      !!pbI028 && Array.isArray(pbI028.evidence) && pbI028.evidence.indexOf('R29') >= 0,
      JSON.stringify(pbI028 && pbI028.evidence));

    pbRun(['close', '--id', pbTmpId, '--reply', 'mirrored reply']);
    const pbClosed = await pbStateOf(pbTmpId);
    PASS('CLI close lands status/reply/updated on the mirrored panel row',
      !!pbClosed && pbClosed.status === 'done' && pbClosed.reply === 'mirrored reply'
        && !!pbClosed.updated,
      JSON.stringify(pbClosed && { status: pbClosed.status, reply: pbClosed.reply, updated: !!pbClosed.updated }));
  } finally {
    try {
      const pbSql = require('node:sqlite');
      const pbConn = new pbSql.DatabaseSync(path.join(dataDir(), 'panel.db'));
      pbConn.prepare('DELETE FROM issues WHERE id=?').run(pbTmpId);
      pbConn.prepare('DELETE FROM issues WHERE id=?').run('I-028');
      pbConn.close();
    } catch (_e) { /* restore still runs */ }
    if (pbLedgerBak !== null) fs.writeFileSync(pbLedgerFile, pbLedgerBak);
    if (pbDeltaBak !== null) fs.writeFileSync(pbDeltaFile, pbDeltaBak);
  }
  const pbRes = await api('GET', '/api/state');
  const pbLedgerNow = fs.existsSync(pbLedgerFile) ? fs.readFileSync(pbLedgerFile, 'utf8') : '';
  const pbLeftList = pbRun(['list']);
  PASS('No I-901 residue: panel rows, issues.json and issue.js list all clean',
    ((pbRes.body && pbRes.body.issues) || []).length === 5
      && !((pbRes.body && pbRes.body.issues) || []).some((x) => x.id === pbTmpId)
      && !((pbRes.body && pbRes.body.issues) || []).some((x) => x.id === 'I-028')
      && (pbLedgerBak === null || pbLedgerNow === pbLedgerBak)
      && pbLeftList.indexOf(pbTmpId) < 0,
    'issues=' + ((pbRes.body && pbRes.body.issues) || []).length
      + ' ledgerRestored=' + (pbLedgerNow === pbLedgerBak)
      + ' OPEN=' + (pbLeftList.match(/OPEN=\d+/) || [''])[0]);

  /* Ledger column widths: real grip drag -> cp.issue-cols, then a real reload. */
  await js(`document.querySelector('[data-view="ledger"]').click()`);
  await sleep(350);
  const pbColDrag = await js(`(() => {
    const th = document.querySelector('.issue-table th[data-col="title"]');
    const grip = th && th.querySelector('.icgrip');
    if (!th || !grip) return { ok: false, reason: 'missing th/grip' };
    const before = Math.round(th.getBoundingClientRect().width);
    const g = grip.getBoundingClientRect();
    const sx = g.left + Math.max(3, g.width / 2), sy = g.top + Math.max(3, g.height / 2);
    grip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: sx, clientY: sy, button: 0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: sx + 48, clientY: sy }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: sx + 48, clientY: sy }));
    const stored = JSON.parse(localStorage.getItem('cp.issue-cols') || '{}');
    return { ok: true, before, after: Math.round(th.getBoundingClientRect().width),
      style: th.style.width, stored: stored.title };
  })()`);
  PASS('Ledger header grip drag resizes the column and writes cp.issue-cols',
    pbColDrag.ok && typeof pbColDrag.stored === 'number' && pbColDrag.stored >= 48
      && /px$/.test(pbColDrag.style || '')
      && Math.abs(pbColDrag.after - pbColDrag.before) >= 20,
    JSON.stringify(pbColDrag));

  await cmd('Page.reload', { ignoreCache: true });
  await sleep(900); await ready();
  await js(`document.querySelector('[data-view="ledger"]').click()`);
  await sleep(350);
  const pbColKeep = await js(`(() => {
    const th = document.querySelector('.issue-table th[data-col="title"]');
    const stored = JSON.parse(localStorage.getItem('cp.issue-cols') || '{}');
    return { style: th ? th.style.width : '', w: th ? Math.round(th.getBoundingClientRect().width) : -1,
      stored: stored.title };
  })()`);
  PASS('Column width persists across reload (cp.issue-cols reapplied to the th)',
    typeof pbColKeep.stored === 'number' && pbColKeep.stored >= 48
      && pbColKeep.style === pbColKeep.stored + 'px' && pbColKeep.w >= 40,
    JSON.stringify(pbColKeep));

  /* Kanban card links: toggle, signed lag + nature badge, navigation flash. */
  await js(`document.querySelector('[data-view="board"]').click()`);
  await sleep(400);
  const pbEdgePut = await api('PUT', '/api/task-deps',
    { from: 'W4', to: 'W6', type: 'SS', lag: -2, nature: 'mandatory' });
  await js(`CP.store.load()`);
  await sleep(450);
  const pbLinkUi = await js(`(() => {
    const card = document.querySelector('.kb-card[data-task-id="W6"]');
    if (!card) return { ok: false, reason: 'no W6 card' };
    const row = card.querySelector('.kb-dep-row');
    const toggle = card.querySelector('.kb-dep-toggle');
    if (!row || !toggle) return { ok: false, reason: 'missing row/toggle' };
    const wasOn = row.classList.contains('is-on');
    toggle.click();
    const links = Array.from(row.querySelectorAll('.kb-dep-link')).map((b) => b.textContent.trim());
    const nature = row.querySelector('.kb-dep-nature');
    const stored = JSON.parse(localStorage.getItem('cp.card-deps') || '{}');
    return { ok: true, wasOn, on: row.classList.contains('is-on'), links,
      nature: nature ? nature.textContent : '', storedW6: stored.W6,
      pressed: toggle.getAttribute('aria-pressed') };
  })()`);
  PASS('Card dep toggle reveals depends-on/depended-by links with signed lag + nature badge',
    pbEdgePut.status === 200 && pbLinkUi.ok && pbLinkUi.wasOn === false && pbLinkUi.on === true
      && pbLinkUi.pressed === 'true' && pbLinkUi.storedW6 === true
      && pbLinkUi.links.some((t) => /^W3 FS\b/.test(t))
      && pbLinkUi.links.some((t) => t.indexOf('W4 SS-2d') >= 0)
      && pbLinkUi.links.some((t) => t.indexOf('W8 SS') >= 0)
      && pbLinkUi.nature === 'mandatory',
    JSON.stringify(pbLinkUi));

  const pbLinkNav = await js(`(() => {
    const card = document.querySelector('.kb-card[data-task-id="W6"]');
    const link = card && Array.from(card.querySelectorAll('.kb-dep-link'))
      .filter((b) => (b.dataset.target || '') === 'W3')[0];
    if (!link) return { ok: false, reason: 'no W3 link' };
    link.click();
    const target = document.querySelector('.kb-card[data-task-id="W3"]');
    return { ok: true, flashed: !!(target && target.classList.contains('kb-flash')) };
  })()`);
  PASS('Clicking a dep link scrolls to and flashes the linked card',
    pbLinkNav.ok && pbLinkNav.flashed, JSON.stringify(pbLinkNav));

  const pbLinkOff = await js(`(() => {
    const card = document.querySelector('.kb-card[data-task-id="W6"]');
    const toggle = card && card.querySelector('.kb-dep-toggle');
    if (!toggle) return { ok: false };
    toggle.click();
    const row = card.querySelector('.kb-dep-row');
    return { ok: true, on: row.classList.contains('is-on'),
      stored: JSON.parse(localStorage.getItem('cp.card-deps') || '{}').W6 };
  })()`);
  PASS('Toggling the card links off hides the row and persists false',
    pbLinkOff.ok && pbLinkOff.on === false && pbLinkOff.stored === false, JSON.stringify(pbLinkOff));

  /* I-030 db half: nature vocab over the HTTP write/read path. */
  const pbNatBad = await api('PUT', '/api/task-deps',
    { from: 'W4', to: 'W6', type: 'FS', lag: 0, nature: 'required' });
  const pbNatOk = await api('PUT', '/api/task-deps',
    { from: 'W4', to: 'W6', type: 'SS', lag: -2, nature: 'mandatory' });
  const pbDeps30 = await api('GET', '/api/task-deps');
  const pbNatRow = ((pbDeps30.body) || []).filter((d) => d.from === 'W4' && d.to === 'W6')[0];
  const pbNatEmpty = await api('PUT', '/api/task-deps',
    { from: 'W4', to: 'W6', type: 'FS', lag: 0, nature: '' });
  const pbDeps30b = await api('GET', '/api/task-deps');
  const pbNatRow2 = ((pbDeps30b.body) || []).filter((d) => d.from === 'W4' && d.to === 'W6')[0];
  await api('DELETE', '/api/task-deps/' + encodeURIComponent('W4') + '/' + encodeURIComponent('W6'));
  PASS('task-dep nature: bad vocab -> 400, mandatory and "" accepted and returned',
    pbNatBad.status === 400 && /nature/i.test(String(pbNatBad.body && pbNatBad.body.error))
      && pbNatOk.status === 200 && !!pbNatRow && pbNatRow.nature === 'mandatory' && pbNatRow.lag === -2
      && pbNatEmpty.status === 200 && !!pbNatRow2 && pbNatRow2.nature === '',
    JSON.stringify({ bad: pbNatBad.status, err: pbNatBad.body && pbNatBad.body.error,
      nature: pbNatRow && pbNatRow.nature, lag: pbNatRow && pbNatRow.lag,
      empty: pbNatRow2 && pbNatRow2.nature }));

  await js(`localStorage.removeItem('cp.card-deps'); localStorage.removeItem('cp.issue-cols');
    CP.store.load(); true`);
  await sleep(300);

  PASS('Section 30 added no JS exceptions or console errors',
    errors.length === err30, 'errors before=' + err30 + ' after=' + errors.length);

  /* 31. R30 / I-031 - goal tree manual control: [+]/[-] fold, drag-move write
     path, WBS template library, plus the R30 layout fix (the gantt block must
     keep a real height under a fully expanded goal tree - a DOM-count check
     cannot see that class of bug, so this block measures layout). Additive
     section. Structure writes hit PUT /api/plan/structure on the battery's own
     server, so data/milestone-plan.json AND docs/evidence/milestones.json (the
     gate-X-pinned sub_lines a cross-parent move re-syncs) are backed up before
     the first probe and both restored in finally (section 30 pattern); saved
     template rows (wbs_templates id LIKE 'tpl-%') are deleted in finally;
     cp.tree-fold is removed in finally; the plan gates re-run after the
     restore so the battery and the main session inherit pristine stores. */
  const i31Err = errors.length;
  const i31PlanFile = path.join(dataDir(), 'milestone-plan.json');
  const i31PlanBak = fs.readFileSync(i31PlanFile, 'utf8');
  const i31MsFile = path.join(pbRepo, 'docs', 'evidence', 'milestones.json');
  const i31MsBak = fs.readFileSync(i31MsFile, 'utf8');
  const i31Run = (argv) => {
    try {
      return { code: 0, out: pbExec(process.execPath, argv, { cwd: pbRepo, encoding: 'utf8' }) };
    } catch (e) {
      return { code: e && typeof e.status === 'number' ? e.status : -1,
        out: String((e && e.stdout) || '') + String((e && e.stderr) || '') };
    }
  };
  const i31Seed = () => {
    try {
      pbExec(process.execPath, [path.join(pbRepo, 'scripts', 'plan-sync.js'), '--seed-tasks'],
        { cwd: pbRepo, encoding: 'utf8' });
    } catch (_e) { /* a seed failure surfaces as a gate FAIL line below */ }
  };

  try {
    /* Re-activate the plan view; section 30 left the board on screen. */
    await js(`document.querySelector('#nav [data-view="plan"]').click()`);
    await sleep(250);
    /* Fully expanded tree first: clear fold state, re-read the real plan. */
    await js(`(() => { localStorage.removeItem('cp.tree-fold'); return true; })()`);
    await js(`(async () => { await CP.refreshPlan(); return true; })()`);
    await sleep(300);
    /* R32 retarget (I-037): the tab bar is gone - the Plan view IS the tree,
       which the click above re-activated before measuring layout. */
    await sleep(250);

    /* Layout gate (live-review defect): with the tree fully expanded the
       gantt block must keep height > 0 and be reachable by scrolling the
       layer - one vertical scroll over [goal tree, legend, axis, gantt]. */
    const i31Layout = await js(`(() => {
      const lay = document.getElementById('milestoneLayer');
      const tree = document.getElementById('msGoalTree');
      const sc = document.querySelector('.ms-scroll');
      const out = {
        treeH: tree ? Math.round(tree.getBoundingClientRect().height) : -1,
        scrollH: sc ? sc.offsetHeight : -1,
        groups: document.querySelectorAll('.ms-group').length,
        folded: document.querySelectorAll('.ms-goal-children.is-folded, .ms-goal-sub.is-folded').length,
        layerScrollable: lay ? lay.scrollHeight > lay.clientHeight + 40 : false
      };
      if (lay) lay.scrollTop = lay.scrollHeight;
      const r = sc ? sc.getBoundingClientRect() : null;
      const lr = lay ? lay.getBoundingClientRect() : null;
      out.reachable = !!(r && lr && r.height > 0 && r.top < lr.bottom && r.bottom > lr.top + 10);
      if (lay) lay.scrollTop = 0;
      return out;
    })()`);
    PASS('Gantt block keeps a real height and is reachable by scrolling with the goal tree fully expanded (R30 layout fix)',
      i31Layout.treeH > 200 && i31Layout.scrollH > 0 && i31Layout.folded === 0
        && i31Layout.groups >= 7 && i31Layout.layerScrollable && i31Layout.reachable,
      JSON.stringify(i31Layout));

    /* Fold controls on a deterministic fixture (own precondition, not the
       live plan's state). */
    const i31Fix = {
      available: true, state: 'READY', label: 'Milestone plan ready', detail: '',
      fix_command: 'node scripts/prd-to-action.js', message: '', schema: 'ai-project-ops.plan/1.0',
      goals: [
        { id: 'G1', title: 'Fixture goal one', milestone_ids: ['M1', 'M2'] },
        { id: 'G2', title: 'Fixture goal two', milestone_ids: ['M3'] },
      ],
      milestones: [
        { id: 'M1', name: 'Fixture alpha', depends_on: [], start_offset_h: 0, end_offset_h: 12, status: 'done', completion: 100, cost: 2, verify: 'node scripts/prd-to-action.js' },
        { id: 'M2', name: 'Fixture beta', depends_on: ['M1'], start_offset_h: 12, end_offset_h: 24, status: 'in_progress', completion: 50, cost: 1, verify: 'node scripts/prd-to-action.js' },
        { id: 'M3', name: 'Fixture gamma', depends_on: ['M1'], start_offset_h: 12, end_offset_h: 30, status: 'todo', completion: 0, cost: 0, verify: 'node scripts/prd-to-action.js' },
      ],
      work_units: [
        { id: 'W1', milestone_id: 'M1', title: 'Fixture task one', owner: 'main', owner_type: 'main', start_offset_h: 0, end_offset_h: 6, status: 'done', progress: 100, cost: 1.2, billed: 0, tier: 'S' },
        { id: 'W2', milestone_id: 'M1', title: 'Fixture task two', owner: 'main', owner_type: 'main', start_offset_h: 6, end_offset_h: 12, status: 'done', progress: 100, cost: 0.8, billed: 0, tier: 'S' },
        { id: 'W3', milestone_id: 'M2', title: 'Fixture task three', owner: 'main', owner_type: 'main', start_offset_h: 12, end_offset_h: 24, status: 'in_progress', progress: 50, cost: 0.5, billed: 0, tier: 'S' },
        { id: 'W4', milestone_id: 'M3', title: 'Fixture task four', owner: 'main', owner_type: 'main', start_offset_h: 12, end_offset_h: 30, status: 'todo', progress: 0, cost: 0, billed: 0, tier: 'S' },
      ],
      relations: [], main_line: ['M1', 'M2', 'M3'],
      sub_lines: { M1: ['W1', 'W2'], M2: ['W3'], M3: ['W4'] },
    };
    await js(`CP.applyPlan(${JSON.stringify(i31Fix)})`);

    const i31FoldCtl = await js(`(() => {
      const g = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G1"] [data-fold]');
      const m = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M1"] [data-fold]');
      const w = document.querySelector('.ms-goal-row[data-kind=wu][data-node="W1"] [data-fold]');
      const head = document.querySelector('.ms-a-head .ms-a-fold');
      const tplG = document.querySelector('.ms-goal-row[data-node="G1"] .ms-tpl-btn');
      const tplW = document.querySelector('.ms-goal-row[data-kind=wu] .ms-tpl-btn');
      const mRow = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M1"]');
      const wRow = document.querySelector('.ms-goal-row[data-kind=wu][data-node="W1"]');
      const gRow = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G1"]');
      return {
        g: g ? g.textContent : '', m: m ? m.textContent : '', wHas: !!w,
        headHas: !!head, tplText: tplG ? tplG.textContent : '', wTpl: !!tplW,
        draggable: { m: !!mRow && mRow.draggable, w: !!wRow && wRow.draggable, g: !!gRow && gRow.draggable }
      };
    })()`);
    PASS('G/M rows carry [-] fold toggles and [+ from template]; W rows are leaves; only M/W rows drag',
      i31FoldCtl.g === '[-]' && i31FoldCtl.m === '[-]' && !i31FoldCtl.wHas && i31FoldCtl.headHas
        && i31FoldCtl.tplText === '[+ from template]' && !i31FoldCtl.wTpl
        && i31FoldCtl.draggable.m && i31FoldCtl.draggable.w && !i31FoldCtl.draggable.g,
      JSON.stringify(i31FoldCtl));

    const i31FoldG = await js(`(() => {
      const btn = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G1"] [data-fold]');
      if (!btn) return { ok: false };
      btn.click();
      const box = document.querySelector('.ms-goal-group[data-goal="G1"] > .ms-goal-children');
      const row = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G1"]');
      const sub = document.querySelector('.ms-goal-row[data-kind=wu][data-node="W1"]');
      const stored = JSON.parse(localStorage.getItem('cp.tree-fold') || '{}');
      return {
        ok: true,
        folded: !!box && box.classList.contains('is-folded'),
        display: box ? getComputedStyle(box).display : '',
        btn: btn.textContent,
        expanded: btn.getAttribute('aria-expanded'),
        rollup: row ? row.textContent.replace(/\\s+/g, ' ').trim() : '',
        wuHidden: !!sub && sub.offsetParent === null,
        stored
      };
    })()`);
    PASS('Collapsing a goal hides its children but keeps the rolled-up numbers on the parent row; state persists in cp.tree-fold',
      i31FoldG.ok && i31FoldG.folded && i31FoldG.display === 'none' && i31FoldG.btn === '[+]'
        && i31FoldG.expanded === 'false' && i31FoldG.rollup.indexOf('75%') >= 0
        && i31FoldG.rollup.indexOf('$3k') >= 0 && i31FoldG.wuHidden
        && i31FoldG.stored.G1 === true,
      JSON.stringify({ folded: i31FoldG.folded, btn: i31FoldG.btn, rollup: i31FoldG.rollup, stored: i31FoldG.stored }));

    const i31FoldM = await js(`(() => {
      const gBtn = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G1"] [data-fold]');
      if (gBtn) gBtn.click();
      const mBtn = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M1"] [data-fold]');
      if (!mBtn) return { ok: false };
      mBtn.click();
      const mRow = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M1"]');
      const sub = mRow ? mRow.nextElementSibling : null;
      const wu = document.querySelector('.ms-goal-row[data-kind=wu][data-node="W1"]');
      const stored = JSON.parse(localStorage.getItem('cp.tree-fold') || '{}');
      return {
        ok: true,
        subFolded: !!sub && sub.classList.contains('is-folded'),
        subDisplay: sub ? getComputedStyle(sub).display : '',
        wuGone: !!wu && wu.offsetParent === null,
        mVisible: !!mRow && mRow.offsetParent !== null,
        mText: mRow ? mRow.textContent.replace(/\\s+/g, ' ').trim() : '',
        stored, gOpen: stored.G1 === false
      };
    })()`);
    PASS('Collapsing a milestone hides only its work units; the parent row stays visible with its rollup; both ids stay in the map',
      i31FoldM.ok && i31FoldM.subFolded && i31FoldM.subDisplay === 'none' && i31FoldM.wuGone
        && i31FoldM.mVisible && i31FoldM.mText.indexOf('100%') >= 0
        && i31FoldM.stored.M1 === true && i31FoldM.gOpen,
      JSON.stringify({ sub: i31FoldM.subFolded, text: i31FoldM.mText, stored: i31FoldM.stored }));

    await cmd('Page.reload', { ignoreCache: true });
    await sleep(900);
    await ready();
    /* R29 lesson (a): re-activate the plan view after a reload BEFORE
       measuring anything. R32 retarget (I-037): no ms tab any more - the
       Plan view itself is the full-page tree. */
    await js(`document.querySelector('#nav [data-view="plan"]').click()`);
    await sleep(200);
    await js(`CP.applyPlan(${JSON.stringify(i31Fix)})`);
    const i31FoldKeep = await js(`(() => {
      const gBox = document.querySelector('.ms-goal-group[data-goal="G1"] > .ms-goal-children');
      const mRow = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M1"]');
      const mSub = mRow ? mRow.nextElementSibling : null;
      const gBtn = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G1"] [data-fold]');
      const mBtn = mRow ? mRow.querySelector('[data-fold]') : null;
      return {
        gFolded: !!gBox && gBox.classList.contains('is-folded'),
        mFolded: !!mSub && mSub.classList.contains('is-folded'),
        gBtn: gBtn ? gBtn.textContent : '', mBtn: mBtn ? mBtn.textContent : '',
        stored: JSON.parse(localStorage.getItem('cp.tree-fold') || '{}')
      };
    })()`);
    PASS('Fold state survives a reload and is re-applied on render (cp.tree-fold id -> bool map)',
      i31FoldKeep.gFolded === false && i31FoldKeep.mFolded && i31FoldKeep.gBtn === '[-]'
        && i31FoldKeep.mBtn === '[+]' && i31FoldKeep.stored.G1 === false
        && i31FoldKeep.stored.M1 === true,
      JSON.stringify(i31FoldKeep));

    await js(`(() => {
      const gBtn = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G1"] [data-fold]');
      if (gBtn) gBtn.click();
      const mBtn = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M1"] [data-fold]');
      if (mBtn) mBtn.click();
      return true;
    })()`);

    /* Drag highlighting through the real handlers (synthetic DragEvent with a
       constructed DataTransfer - no window.location stubbing, R28 rule). */
    const i31DragHi = await js(`(() => {
      const m2 = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M2"]');
      if (!m2) return { ok: false };
      const dt = new DataTransfer();
      m2.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      const hi = Array.from(document.querySelectorAll('.ms-goal-row.is-drop-ok'))
        .map((r) => (r.dataset.kind || '') + ':' + (r.dataset.node || ''));
      const gRow = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G1"]');
      const wRow = document.querySelector('.ms-goal-row[data-kind=wu][data-node="W1"]');
      const gAccepts = !!gRow && !gRow.dispatchEvent(new DragEvent('dragover',
        { bubbles: true, cancelable: true, dataTransfer: dt }));
      const wAccepts = !!wRow && !wRow.dispatchEvent(new DragEvent('dragover',
        { bubbles: true, cancelable: true, dataTransfer: dt }));
      m2.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
      return {
        ok: true, hi, gAccepts, wAccepts, dtText: dt.types.indexOf('text/plain') >= 0,
        after: document.querySelectorAll('.ms-goal-row.is-drop-ok').length
      };
    })()`);
    PASS('Dragstart highlights only valid drop targets (goals + other milestones for an M drag); W rows refuse the drop',
      i31DragHi.ok && i31DragHi.hi.length === 4 && i31DragHi.hi.every((t) => t.indexOf('wu:') !== 0)
        && i31DragHi.gAccepts && !i31DragHi.wAccepts && i31DragHi.after === 0 && i31DragHi.dtText,
      JSON.stringify(i31DragHi));

    /* Invalid structure ops: 400 + zero writes (file stays byte-identical). */
    const i31Inv = [];
    const i31InvBodies = [
      { kind: 'move', id: 'W3', new_parent: 'G1', index: 0 },
      { kind: 'move', id: 'M1', new_parent: 'M3', index: 0 },
      { kind: 'move', id: 'NOPE', new_parent: 'G1', index: 0 },
      { kind: 'move', id: 'M7', new_parent: 'G1', index: 0 },
      { kind: 'move', id: 'W3', new_parent: 'M1', index: 99 },
      { kind: 'nonsense', id: 'M1', new_parent: 'G1', index: 0 },
    ];
    for (const i31Body of i31InvBodies) {
      const i31Res = await api('PUT', '/api/plan/structure', i31Body);
      i31Inv.push({
        op: i31Body.kind + ':' + i31Body.id + '->' + i31Body.new_parent + '@' + i31Body.index,
        status: i31Res.status,
        unchanged: fs.readFileSync(i31PlanFile, 'utf8') === i31PlanBak
          && fs.readFileSync(i31MsFile, 'utf8') === i31MsBak,
        err: !!(i31Res.body && i31Res.body.error),
      });
    }
    PASS('Invalid structure ops answer 400 with zero writes (type rules, unknown ids, emptying a goal, bad index, unknown op)',
      i31Inv.length === 6 && i31Inv.every((x) => x.status === 400 && x.unchanged && x.err),
      JSON.stringify(i31Inv));

    /* A real successful M move through the client seam (the path a drop
       takes): M6 from G1 to the end of G2. */
    const i31MoveM = await js(`(async () => {
      const ok = await CP.planMove('M6', 'G2', 1);
      const g1 = document.querySelector('.ms-goal-group[data-goal="G1"]');
      const g2 = document.querySelector('.ms-goal-group[data-goal="G2"]');
      return {
        ok,
        g1HasM6: !!(g1 && g1.querySelector('.ms-goal-row[data-node="M6"]')),
        g2Order: g2 ? Array.from(g2.querySelectorAll('.ms-goal-row[data-kind=ms]')).map((r) => r.dataset.node) : [],
        tree: !!document.getElementById('msGoalTree')
      };
    })()`);
    const i31MoveFile = JSON.parse(fs.readFileSync(i31PlanFile, 'utf8'));
    PASS('M move persists through PUT /api/plan/structure: file and DOM agree, ids unchanged',
      i31MoveM.ok && i31MoveM.tree && !i31MoveM.g1HasM6
        && JSON.stringify(i31MoveFile.goals[0].milestone_ids) === JSON.stringify(['M1', 'M2', 'M3', 'M4', 'M5'])
        && JSON.stringify(i31MoveFile.goals[1].milestone_ids) === JSON.stringify(['M7', 'M6'])
        && JSON.stringify(i31MoveM.g2Order) === JSON.stringify(['M7', 'M6']),
      JSON.stringify({ ok: i31MoveM.ok, g1: i31MoveFile.goals[0].milestone_ids, g2: i31MoveM.g2Order }));

    /* R30 line 2: gates green AFTER a successful move. */
    i31Seed();
    const i31GateA = i31Run([path.join(pbRepo, 'scripts', 'prd-to-action.js')]);
    const i31GateB = i31Run([path.join(pbRepo, 'scripts', 'plan-sync.js'), '--check']);
    const i31GateALine = (i31GateA.out.split('\n').filter((l) => l.indexOf('PRD-TO-ACTION GATE') >= 0)[0] || '').trim();
    const i31GateBLine = (i31GateB.out.split('\n').filter((l) => l.indexOf('PLAN-SYNC CHECK') >= 0)[0] || '').trim();
    PASS('After a successful move prd-to-action 10/10 and plan-sync --check stay green (R30 line 2)',
      i31GateA.code === 0 && i31GateALine === 'PRD-TO-ACTION GATE: 10/10 passed'
        && i31GateB.code === 0 && /^PLAN-SYNC CHECK: \d+\/\d+ passed$/.test(i31GateBLine),
      i31GateALine + ' (exit ' + i31GateA.code + ') | ' + i31GateBLine + ' (exit ' + i31GateB.code + ')');

    /* W move: cross-parent, sub_lines + milestone_id stay consistent. */
    const i31MoveW = await js(`(async () => {
      const ok = await CP.planMove('W3', 'M2', 3);
      const row = document.querySelector('.ms-goal-row[data-kind=wu][data-node="W3"]');
      const sub = row ? row.closest('.ms-goal-sub') : null;
      const msRow = sub ? sub.previousElementSibling : null;
      return { ok, has: !!row, under: msRow ? msRow.dataset.node : '' };
    })()`);
    const i31WFile = JSON.parse(fs.readFileSync(i31PlanFile, 'utf8'));
    const i31WSub1 = i31WFile.sub_lines.M1 || [];
    const i31WSub2 = i31WFile.sub_lines.M2 || [];
    const i31WObj = i31WFile.work_units.filter((w) => w.id === 'W3')[0];
    const i31MIds = i31WFile.milestones.map((m) => String(m.id));
    const i31WIds = i31WFile.work_units.map((w) => String(w.id));
    const i31MStable = i31MIds.length === 7
      && ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'].every((id) => i31MIds.indexOf(id) >= 0);
    const i31WStable = i31WIds.length === 18
      && Array.from({ length: 18 }, (_v, i) => 'W' + (i + 1)).every((id) => i31WIds.indexOf(id) >= 0);
    PASS('W move relocates W3 under M2: sub_lines membership and milestone_id stay consistent, existing ids never change',
      i31MoveW.ok && i31MoveW.has && i31MoveW.under === 'M2'
        && i31WSub1.indexOf('W3') < 0 && i31WSub2.join(',') === 'W4,W5,W6,W3'
        && !!i31WObj && i31WObj.milestone_id === 'M2' && i31MStable && i31WStable,
      JSON.stringify({ dom: i31MoveW, sub1: i31WSub1, sub2: i31WSub2,
        w3: i31WObj ? { m: i31WObj.milestone_id, s: i31WObj.status, p: i31WObj.progress } : null }));

    /* R30 line 2 (resolution): a W cross-parent move re-syncs the gate-X-
       pinned docs/evidence/milestones.json sub_lines through the same write,
       so BOTH gates stay green for every accepted move kind. */
    i31Seed();
    const i31GateE = i31Run([path.join(pbRepo, 'scripts', 'prd-to-action.js')]);
    const i31GateF = i31Run([path.join(pbRepo, 'scripts', 'plan-sync.js'), '--check']);
    const i31GateELine = (i31GateE.out.split('\n').filter((l) => l.indexOf('PRD-TO-ACTION GATE') >= 0)[0] || '').trim();
    const i31GateFLine = (i31GateF.out.split('\n').filter((l) => l.indexOf('PLAN-SYNC CHECK') >= 0)[0] || '').trim();
    const i31MsNow = JSON.parse(fs.readFileSync(i31MsFile, 'utf8'));
    PASS('W cross-parent move keeps prd-to-action 10/10 and plan-sync green (evidence sub_lines re-synced)',
      i31GateE.code === 0 && i31GateELine === 'PRD-TO-ACTION GATE: 10/10 passed'
        && i31GateF.code === 0 && /^PLAN-SYNC CHECK: \d+\/\d+ passed$/.test(i31GateFLine)
        && (i31MsNow.sub_lines.M2 || []).join(',') === 'W4,W5,W6,W3'
        && (i31MsNow.sub_lines.M1 || []).indexOf('W3') < 0,
      i31GateELine + ' (exit ' + i31GateE.code + ') | ' + i31GateFLine + ' (exit ' + i31GateF.code
        + ') | ms.sub_lines.M2=' + JSON.stringify(i31MsNow.sub_lines.M2));

    /* Template library: built-ins + subtree save + invalid saves. */
    const i31Prov = 'inspired by Teambition public template categories; content authored fresh';
    const i31Tpl1 = await api('GET', '/api/templates');
    const i31TplList1 = (i31Tpl1.body && i31Tpl1.body.templates) || [];
    const i31Built1 = i31TplList1.filter((t) => t.kind === 'builtin');
    const i31Save = await api('POST', '/api/templates', { name: 'I31 probe subtree', source_node: 'M1' });
    const i31Tpl2 = await api('GET', '/api/templates');
    const i31TplList2 = (i31Tpl2.body && i31Tpl2.body.templates) || [];
    const i31Saved = i31TplList2.filter((t) => t.id === (i31Save.body && i31Save.body.id));
    const i31SaveBad = await api('POST', '/api/templates', { name: '', source_node: 'M1' });
    const i31SaveBad2 = await api('POST', '/api/templates', { name: 'x', source_node: 'G999' });
    PASS('GET /api/templates lists 4-6 built-ins with the exact provenance line; POST saves the M1 subtree; bad saves are 400',
      i31Tpl1.status === 200 && i31Built1.length >= 4 && i31Built1.length <= 6
        && i31Built1.every((t) => t.provenance === i31Prov)
        && i31Built1.some((t) => t.name === 'Product launch')
        && i31Built1.some((t) => t.name === 'Software release')
        && i31Save.status === 200 && /^tpl-/.test(String(i31Save.body && i31Save.body.id))
        && i31Saved.length === 1 && i31Saved[0].provenance === 'saved from plan subtree M1'
        && i31Saved[0].n_work_units === 2
        && i31SaveBad.status === 400 && i31SaveBad2.status === 400,
      JSON.stringify({ builtins: i31Built1.map((t) => t.name), save: i31Save.status,
        n: i31Saved[0] && i31Saved[0].n_work_units, bad: [i31SaveBad.status, i31SaveBad2.status] }));

    /* Template modal UI: open from a G row, save through the form, apply a
       built-in through the modal button (the human path). */
    await js(`(() => {
      const btn = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G1"] .ms-tpl-btn');
      if (btn) btn.click();
      return true;
    })()`);
    await sleep(500);
    const i31Modal = await js(`(() => {
      const layer = document.getElementById('modalLayer');
      const sheet = document.getElementById('modalSheet');
      const text = sheet ? sheet.textContent : '';
      return {
        open: !!layer && !layer.classList.contains('hidden'),
        hasLaunch: text.indexOf('Product launch') >= 0,
        hasProv: text.indexOf('inspired by Teambition public template categories; content authored fresh') >= 0,
        applyBtns: sheet ? sheet.querySelectorAll('[data-tpl-apply]').length : 0,
        saveBtn: !!(sheet && sheet.querySelector('[data-tpl-save]')),
        input: !!(sheet && sheet.querySelector('#tplSaveName'))
      };
    })()`);
    PASS('[+ from template] opens the library modal with built-ins, the provenance line, Apply and Save controls',
      i31Modal.open && i31Modal.hasLaunch && i31Modal.hasProv && i31Modal.applyBtns >= 4
        && i31Modal.saveBtn && i31Modal.input,
      JSON.stringify(i31Modal));

    await js(`(() => {
      const input = document.getElementById('tplSaveName');
      if (input) input.value = 'I31 UI subtree';
      const btn = document.querySelector('#modalSheet [data-tpl-save]');
      if (btn) btn.click();
      return true;
    })()`);
    await sleep(500);
    const i31UiSave = await api('GET', '/api/templates');
    const i31UiSaved = ((i31UiSave.body && i31UiSave.body.templates) || [])
      .filter((t) => t.name === 'I31 UI subtree');

    await js(`(() => {
      const btn = document.querySelector('#modalSheet [data-tpl-apply="builtin-launch"]');
      if (btn) btn.click();
      return true;
    })()`);
    await sleep(700);
    const i31UiApply = await js(`(() => {
      const layer = document.getElementById('modalLayer');
      const m8 = document.querySelector('.ms-goal-row[data-node="M8"]');
      const g1 = document.querySelector('.ms-goal-group[data-goal="G1"]');
      return {
        closed: !!layer && layer.classList.contains('hidden'),
        m8: !!m8,
        inG1: !!(g1 && g1.querySelector('.ms-goal-row[data-node="M8"]')),
        w19: !!document.querySelector('.ms-goal-row[data-node="W19"]'),
        m8Text: m8 ? m8.textContent.replace(/\\s+/g, ' ').trim() : ''
      };
    })()`);
    PASS('Modal save records the UI subtree; modal Apply instantiates M8/W19 under G1 with todo / 0 placeholders',
      i31UiSaved.length === 1 && i31UiApply.closed && i31UiApply.m8 && i31UiApply.inG1
        && i31UiApply.w19 && i31UiApply.m8Text.indexOf('[todo]') >= 0
        && i31UiApply.m8Text.indexOf('$0') >= 0,
      JSON.stringify({ saved: i31UiSaved.length, apply: i31UiApply }));

    /* Two more applies prove the id series continues and never collides. */
    const i31TplSavedId = i31Save.body && i31Save.body.id;
    const i31Apply2 = await api('PUT', '/api/plan/structure',
      { kind: 'apply-template', target: 'G2', template_id: 'builtin-campaign' });
    const i31Apply3 = await api('PUT', '/api/plan/structure',
      { kind: 'apply-template', target: 'M7', template_id: i31TplSavedId });
    const i31FinalPlan = JSON.parse(fs.readFileSync(i31PlanFile, 'utf8'));
    const i31NewM = i31FinalPlan.milestones.filter((m) => {
      const n = Number(String(m.id).slice(1));
      return /^M\d+$/.test(String(m.id)) && n >= 8 && n <= 13;
    });
    const i31NewW = i31FinalPlan.work_units.filter((w) => {
      const n = Number(String(w.id).slice(1));
      return /^W\d+$/.test(String(w.id)) && n >= 19;
    });
    const i31AllIds = i31FinalPlan.milestones.map((m) => String(m.id))
      .concat(i31FinalPlan.work_units.map((w) => String(w.id)));
    PASS('Further applies continue the series (M11+, W25+) with no id collisions; every new node is todo / 0',
      i31Apply2.status === 200 && i31Apply3.status === 200
        && JSON.stringify(i31Apply2.body && i31Apply2.body.added_milestones) === JSON.stringify(['M11', 'M12', 'M13'])
        && (i31Apply3.body && i31Apply3.body.added_work_units || []).length === 2
        && i31NewM.length === 6 && i31NewW.length === 14
        && new Set(i31AllIds).size === i31AllIds.length
        && i31NewM.every((m) => m.status === 'todo')
        && i31NewW.every((w) => w.status === 'todo' && w.cost === 0 && w.progress === 0)
        && i31FinalPlan.main_line.length === 13
        && Array.isArray(i31FinalPlan.sub_lines.M8) && Array.isArray(i31FinalPlan.sub_lines.M13),
      JSON.stringify({ m: i31NewM.map((x) => x.id), w: i31NewW.length,
        a2: i31Apply2.status, a3: i31Apply3.status }));

    /* Invalid applies: 400 with zero writes. */
    const i31ApplyBadFile = fs.readFileSync(i31PlanFile, 'utf8');
    const i31ApplyBad = await api('PUT', '/api/plan/structure',
      { kind: 'apply-template', target: 'G1', template_id: 'builtin-missing' });
    const i31ApplyBad2 = await api('PUT', '/api/plan/structure',
      { kind: 'apply-template', target: 'ZZ9', template_id: 'builtin-launch' });
    PASS('Unknown template and unknown apply target answer 400 with zero writes',
      i31ApplyBad.status === 400 && i31ApplyBad2.status === 400
        && fs.readFileSync(i31PlanFile, 'utf8') === i31ApplyBadFile,
      JSON.stringify({ missing: i31ApplyBad.status, target: i31ApplyBad2.status }));
  } finally {
    fs.writeFileSync(i31PlanFile, i31PlanBak);
    fs.writeFileSync(i31MsFile, i31MsBak);
    try {
      const i31Sql = require('node:sqlite');
      const i31Conn = new i31Sql.DatabaseSync(path.join(dataDir(), 'panel.db'));
      i31Conn.prepare("DELETE FROM wbs_templates WHERE id LIKE 'tpl-%'").run();
      i31Conn.close();
    } catch (_e) { /* restore still runs */ }
    try {
      await js(`(() => {
        localStorage.removeItem('cp.tree-fold');
        const layer = document.getElementById('modalLayer');
        if (layer && !layer.classList.contains('hidden')) {
          const close = document.querySelector('#modalSheet [data-action="close"]');
          if (close) close.click();
        }
        return true;
      })()`);
    } catch (_e) { /* page may be mid-navigation */ }
  }

  const i31PlanNow = fs.readFileSync(i31PlanFile, 'utf8');
  const i31MsAfter = fs.readFileSync(i31MsFile, 'utf8');
  PASS('milestone-plan.json and docs/evidence/milestones.json restored byte-identical (finally block)',
    i31PlanNow === i31PlanBak && i31MsAfter === i31MsBak,
    'plan identical=' + (i31PlanNow === i31PlanBak) + ' (' + i31PlanNow.length + ' bytes)'
      + ' evidence identical=' + (i31MsAfter === i31MsBak) + ' (' + i31MsAfter.length + ' bytes)');

  await js(`(async () => { await CP.refreshPlan(); return true; })()`);
  i31Seed();
  const i31GateC = i31Run([path.join(pbRepo, 'scripts', 'prd-to-action.js')]);
  const i31GateD = i31Run([path.join(pbRepo, 'scripts', 'plan-sync.js'), '--check']);
  const i31GateCLine = (i31GateC.out.split('\n').filter((l) => l.indexOf('PRD-TO-ACTION GATE') >= 0)[0] || '').trim();
  const i31GateDLine = (i31GateD.out.split('\n').filter((l) => l.indexOf('PLAN-SYNC CHECK') >= 0)[0] || '').trim();
  PASS('Gates green on the restored plan: prd-to-action 10/10 and plan-sync --check exit 0',
    i31GateC.code === 0 && i31GateCLine === 'PRD-TO-ACTION GATE: 10/10 passed'
      && i31GateD.code === 0 && /^PLAN-SYNC CHECK: \d+\/\d+ passed$/.test(i31GateDLine),
    i31GateCLine + ' (exit ' + i31GateC.code + ') | ' + i31GateDLine + ' (exit ' + i31GateD.code + ')');

  PASS('Section 31 added no JS exceptions or console errors',
    errors.length === i31Err, 'errors before=' + i31Err + ' after=' + errors.length);

  /* 32. R31 / I-032 + I-033: additive gate for this package. Hour-axis
     humanization (one-line purpose header, labelled NOW flag on the axis,
     hover tooltip with start/end/duration/cost/owner, past-hours shade,
     status palette shared with the kanban) + card AI dimension fields
     (model/instance, cost, confidence dash, owner-scope gate badge), the
     Settings confidence gate (cp.conf-threshold), the per-card audit
     popover (GET /api/tasks/:id/audit) and the red-line-1 scan. Lessons
     obeyed: the block provisions its own task + desk-event rows with a
     server-random id (evidence derivation reads the ledger, so the id must
     be random), re-activates views after Page.reload before measuring,
     restores every mutation in finally and proves the demo old fields
     byte-identical, and layout checks measure heights/visibility - never
     DOM counts. */
  const r32Err = errors.length;
  const r32State0 = (await api('GET', '/api/state')).body;
  const r32PickOld = (t) => (t ? JSON.stringify([
    t.id, t.title, t.owner, t.owner_type, t.role, t.handoff, t.status, t.start, t.end,
    t.progress, t.placeholder, t.tier, t.billed, t.cost, t.sort, t.parent_id,
    t.baseline_start, t.baseline_end,
  ]) : '');
  const r32Old = {};
  ['t1', 't3', 't5'].forEach((id) => {
    r32Old[id] = r32PickOld(((r32State0 && r32State0.tasks) || []).filter((t) => t.id === id)[0]);
  });

  /* --- I-032: purpose header, NOW flag, past shade, tooltip, palette.
     R32 retarget (I-037): the hour axis panel moved to the Work board; every
     I-032 measurement below stays byte-identical. R36: the [Hour axis] tab
     is activated first (measurements run against the ACTIVE tab). --- */
  await js(`document.querySelector('[data-view="board"]').click()`);
  await js(`CP.switchWbTab('axis')`);
  await sleep(300);
  const r32Head = await js(`(() => {
    const hint = document.querySelector('#ganttPanel .panel-head .hint');
    const corner = document.querySelector('.gantt-corner');
    const flag = document.querySelector('.gnow-flag');
    const nowLine = document.querySelector('.now-line');
    const shade = document.querySelector('.past-shade');
    const body = document.getElementById('ganttBody');
    const bar = document.querySelector('.gbar[data-task-id="t3"]');
    return {
      hint: hint ? hint.textContent.trim() : '',
      corner: corner ? corner.textContent.trim() : '',
      flag: flag ? flag.textContent.trim() : '',
      flagLeft: flag ? flag.offsetLeft : -1,
      nowLeft: nowLine ? parseFloat(nowLine.style.left) : -1,
      nowCount: document.querySelectorAll('.now-line').length,
      shadeW: shade ? shade.offsetWidth : -1,
      shadeH: shade ? shade.offsetHeight : -1,
      shadePE: shade ? getComputedStyle(shade).pointerEvents : '',
      bodyH: body ? body.offsetHeight : 0,
      title: bar ? bar.title : '',
      cursor: bar ? getComputedStyle(bar).cursor : ''
    };
  })()`);
  PASS('I-032: one-line purpose header on the Hour axis panel (old hint prose gone)',
    r32Head.hint === 'drag bars to reschedule (hour-snapped) - cost first'
      && r32Head.hint.indexOf('12h ticks') < 0,
    JSON.stringify(r32Head.hint));
  PASS('I-032: labelled NOW flag rides the axis beside the pinned corner name',
    r32Head.corner === 'Work units | hour axis (day/night)'
      && r32Head.flag === 'NOW' && r32Head.nowCount === 1
      && r32Head.flagLeft >= 0
      && Math.abs(r32Head.flagLeft + 252 - r32Head.nowLeft) < 12,
    JSON.stringify({ corner: r32Head.corner, flag: r32Head.flag,
      flagLeft: r32Head.flagLeft, nowLeft: r32Head.nowLeft }));
  PASS('I-032: past hours shaded under the lanes, pointer-transparent, full body height',
    r32Head.shadeW > 0 && r32Head.shadeH > 0 && r32Head.bodyH > 0
      && r32Head.shadeH >= r32Head.bodyH - 2 && r32Head.shadePE === 'none',
    JSON.stringify({ w: r32Head.shadeW, h: r32Head.shadeH,
      body: r32Head.bodyH, pe: r32Head.shadePE }));
  PASS('I-032: bar tooltip carries cost, start->end hours, duration and owner; grab cursor',
    r32Head.title.indexOf('103.7M/$2.24') >= 0 && r32Head.title.indexOf('->') >= 0
      && / \| \d+(\.\d+)?h \| /.test(r32Head.title)
      && r32Head.title.indexOf('AI main session') >= 0
      && r32Head.cursor === 'grab',
    r32Head.title + ' | cursor=' + r32Head.cursor);
  const r32Pal = await js(`(() => {
    const bar = document.querySelector('.gbar[data-task-id="t3"]');
    const col = CP.columnById('in_progress');
    const h = col.color.replace('#', '');
    const n = parseInt(h, 16);
    const want = 'rgb(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ')';
    return { bg: bar ? bar.style.background : '', want, col: col.color };
  })()`);
  PASS('I-032: bar status color equals the kanban column color (one dataset, one palette)',
    r32Pal.bg.replace(/\s/g, '') === r32Pal.want.replace(/\s/g, ''),
    JSON.stringify(r32Pal));
  const r32Css = fs.readFileSync(path.join(OUT, 'styles.css'), 'utf8');
  PASS('I-032: hover lift + grab/grabbing cursors live in the stylesheet',
    /\.gbar:hover\s*\{[^}]*translateY\(-1px\)/.test(r32Css)
      && /\.gbar\s*\{[^}]*cursor:\s*grab/.test(r32Css)
      && /\.gbar\.is-dragging\s*\{[^}]*cursor:\s*grabbing/.test(r32Css),
    'lift=' + /\.gbar:hover\s*\{[^}]*translateY\(-1px\)/.test(r32Css)
      + ' grab=' + /\.gbar\s*\{[^}]*cursor:\s*grab/.test(r32Css)
      + ' grabbing=' + /\.gbar\.is-dragging\s*\{[^}]*cursor:\s*grabbing/.test(r32Css));

  /* Pinned literals (R31 lock) + red line 1 as a gate. The detector is
     proven on a synthetic sample so a broken regex cannot pass green. */
  const r32PanelSrc = fs.readFileSync(path.join(OUT, 'panel.html'), 'utf8');
  const r32TypesSrc = fs.readFileSync(path.join(OUT, 'src', 'types.ts'), 'utf8');
  const r32BoardSrc = fs.readFileSync(path.join(OUT, 'src', 'board.ts'), 'utf8');
  const r32DistBoard = fs.readFileSync(path.join(OUT, 'dist', 'board.js'), 'utf8');
  PASS('Pinned literals survive byte-identical (DEMO banner, Needs human decision, cost-first line)',
    r32PanelSrc.indexOf('DEMO build: seeded sample data only. SQLite state is disposable; do not enter real project data.') >= 0
      && r32PanelSrc.indexOf('Needs human decision') >= 0
      && r32TypesSrc.indexOf('cost-first: spend never hidden by truncation') >= 0
      && r32Head.corner === 'Work units | hour axis (day/night)',
    'panel/types/corner hits verified');
  const r32Banned = ['teammate', 'colleague', 'buddy', 'coworker', 'co-worker', 'workmate', 'friend', 'pal'];
  const r32BanRe = new RegExp('\\b(' + r32Banned.join('|') + ')\\b', 'i');
  const r32SrcHit = (r32BoardSrc.match(r32BanRe) || [''])[0];
  const r32DistHit = (r32DistBoard.match(r32BanRe) || [''])[0];
  const r32Control = r32BanRe.test('a teammate and a colleague') && r32BanRe.test('my buddy');
  PASS('Red line 1: no anthropomorphic labels in card markup (src + dist scan, detector proven)',
    r32SrcHit === '' && r32DistHit === '' && r32Control === true,
    'src=' + JSON.stringify(r32SrcHit) + ' dist=' + JSON.stringify(r32DistHit)
      + ' control=' + r32Control);

  /* --- I-033: Settings confidence gate row --- */
  await js(`document.querySelector('[data-view="settings"]').click()`);
  await sleep(250);
  const r32Set = await js(`(() => {
    const rows = Array.from(document.querySelectorAll('.set-row'));
    const row = rows.filter((r) => {
      const l = r.querySelector('.set-label');
      return l && l.textContent.trim() === 'Confidence gate';
    })[0];
    const inp = document.getElementById('setConfGate');
    const note = document.getElementById('setConfGateNote');
    return { hasRow: !!row, type: inp ? inp.type : '', min: inp ? inp.min : '',
      max: inp ? inp.max : '', step: inp ? inp.step : '',
      value: inp ? inp.value : '', note: note ? note.textContent.trim() : '' };
  })()`);
  PASS('I-033: Settings has the Confidence gate row (0..1, step 0.05, default 0.7)',
    r32Set.hasRow && r32Set.type === 'number' && r32Set.min === '0' && r32Set.max === '1'
      && r32Set.step === '0.05' && r32Set.value === '0.7',
    JSON.stringify(r32Set));

  /* --- I-033: the four fields on every card + gate derivation --- */
  await js(`document.querySelector('[data-view="board"]').click()`);
  await sleep(300);
  await js(`(() => {
    const s = document.getElementById('globalSearch');
    if (s && s.value) { s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); }
    const o = document.getElementById('ownerFilter');
    if (o && o.value !== 'all') { o.value = 'all'; o.dispatchEvent(new Event('change', { bubbles: true })); }
    return true;
  })()`);
  await sleep(250);
  const r32Cards = await js(`(() => Array.from(document.querySelectorAll('.kb-card')).map((c) => {
    const m = c.querySelector('.kb-model');
    const f = c.querySelector('.kb-conf');
    const g = c.querySelector('.kb-gate');
    const cost = c.querySelector('.kb-cost');
    return { id: c.dataset.taskId,
      modelText: m ? m.textContent : '', confText: f ? f.textContent : '',
      gate: g ? g.dataset.gate : '', cost: cost ? cost.textContent : '',
      audit: !!c.querySelector('.kb-audit') };
  }))()`);
  const r32GateOk = (g) => g === 'autonomous' || g === 'needs-ack' || g === 'never-auto';
  PASS('I-033: every card shows model/instance, cost, confidence and a gate badge',
    r32Cards.length > 0 && r32Cards.every((c) =>
      c.modelText.indexOf('model:') === 0 && c.confText.indexOf('conf:') === 0
        && r32GateOk(c.gate) && c.cost.length > 0 && c.audit),
    'n=' + r32Cards.length + ' sample=' + JSON.stringify(r32Cards[0]));
  const r32Gate = await js(`(() => {
    const pure = {
      human: CP.gateFromScope({ owner_type: 'human', may_act_alone: 'all human decisions', needs_ack: 'n/a', never_automatic: 'n/a' }, null, 0.7),
      main: CP.gateFromScope({ owner_type: 'main', may_act_alone: 'plan', needs_ack: 'change', never_automatic: 'approve' }, null, 0.7),
      subagent: CP.gateFromScope({ owner_type: 'subagent', may_act_alone: 'files', needs_ack: 'verdict', never_automatic: 'log' }, null, 0.7),
      team: CP.gateFromScope({ owner_type: 'team', may_act_alone: 'disjoint', needs_ack: 'cross', never_automatic: 'merge' }, null, 0.7)
    };
    const esc = CP.gateFromScope({ owner_type: 'human', may_act_alone: 'all', needs_ack: 'n/a', never_automatic: 'n/a' }, 0.4, 0.7);
    const noEsc = CP.gateFromScope({ owner_type: 'human', may_act_alone: 'all', needs_ack: 'n/a', never_automatic: 'n/a' }, 0.9, 0.7);
    const neverStays = CP.gateFromScope({ owner_type: 'main', may_act_alone: 'p', needs_ack: 'c', never_automatic: 'a' }, 0.1, 0.7);
    const dom = Array.from(document.querySelectorAll('.kb-card')).map((c) => {
      const t = (CP.store.state.tasks.filter((x) => x.id === c.dataset.taskId)[0]) || {};
      const g = c.querySelector('.kb-gate');
      const conf = (t.confidence === undefined || t.confidence === null) ? null : Number(t.confidence);
      return { id: t.id, ot: t.owner_type, gate: g ? g.dataset.gate : '',
        want: CP.gateBadge(t.owner_type, conf),
        demo: ['t1', 't2', 't7', 't12'].indexOf(t.id) >= 0 };
    });
    const pick = (id) => CP.store.state.tasks.filter((t) => t.id === id)[0];
    const t1 = pick('t1'); const t3 = pick('t3'); const t5 = pick('t5');
    return { pure, esc, noEsc, neverStays, dom, thr: CP.confThreshold(),
      mig: { t1: t1 && { model: t1.model, conf: t1.confidence, title: t1.title,
          owner: t1.owner, role: t1.role, cost: t1.cost },
        t3: t3 && { model: t3.model, conf: t3.confidence },
        t5: t5 && { model: t5.model, conf: t5.confidence } } };
  })()`);
  PASS('I-033: gate derivation pins human=autonomous, AI types=never-auto, low conf escalates',
    r32Gate.pure.human === 'autonomous' && r32Gate.pure.main === 'never-auto'
      && r32Gate.pure.subagent === 'never-auto' && r32Gate.pure.team === 'never-auto'
      && r32Gate.esc === 'needs-ack' && r32Gate.noEsc === 'autonomous'
      && r32Gate.neverStays === 'never-auto'
      && r32Gate.dom.length > 0 && r32Gate.dom.every((d) => d.gate === d.want && r32GateOk(d.gate))
      && r32Gate.dom.filter((d) => d.demo).every((d) => d.gate === 'autonomous')
      && r32Gate.thr === 0.7,
    JSON.stringify({ pure: r32Gate.pure, esc: r32Gate.esc, thr: r32Gate.thr,
      dom: r32Gate.dom.slice(0, 5) }));
  PASS('I-033: migration filled only the new columns; demo model/confidence pinned',
    !!r32Gate.mig.t1 && r32Gate.mig.t1.model === 'human' && r32Gate.mig.t1.conf === 0.95
      && r32Gate.mig.t1.title === 'Kickoff & goal breakdown' && r32Gate.mig.t1.owner === 'Lin Che'
      && r32Gate.mig.t1.role === 'Project lead' && r32Gate.mig.t1.cost === 0.31
      && !!r32Gate.mig.t3 && r32Gate.mig.t3.model === 'claude' && r32Gate.mig.t3.conf === 0.9
      && !!r32Gate.mig.t5 && r32Gate.mig.t5.model === 'claude' && r32Gate.mig.t5.conf === 0.8,
    JSON.stringify(r32Gate.mig));

  /* --- I-033: provision one random-id task + one desk event; both restored in finally --- */
  let r32Id = '';
  let r32EvId = '';
  try {
    const r32Created = await api('POST', '/api/tasks', {
      title: 'R31 audit probe', owner: 'R31 probe', owner_type: 'human',
      role: 'probe', handoff: 'selftest fixture', cost: 0, billed: 0,
    });
    r32Id = (r32Created.body && r32Created.body.id) || '';
    PASS('I-033: fixture task provisioned with a server-random id (confidence/model unset)',
      r32Created.status === 200 && /^t_[a-z0-9]+$/.test(r32Id)
        && !!r32Created.body && r32Created.body.confidence === null
        && r32Created.body.model === '',
      JSON.stringify({ status: r32Created.status, id: r32Id,
        conf: r32Created.body && r32Created.body.confidence,
        model: r32Created.body && r32Created.body.model }));

    const r32Ev = await api('POST', '/api/events', {
      unit: 'command', kind: 'probe',
      detail: 'R31 audit probe trail for ' + r32Id,
    });
    r32EvId = (r32Ev.body && r32Ev.body.id) || '';
    PASS('I-033: desk event provisioned naming the fixture id',
      r32Ev.status === 200 && !!r32EvId,
      JSON.stringify({ status: r32Ev.status, id: r32EvId }));

    const r32Aud = await api('GET', '/api/tasks/' + encodeURIComponent(r32Id) + '/audit');
    PASS('I-033: GET /api/tasks/:id/audit returns the event and a PDCA id array',
      r32Aud.status === 200 && Array.isArray(r32Aud.body && r32Aud.body.events)
        && r32Aud.body.events.length === 1
        && r32Aud.body.events[0].detail.indexOf(r32Id) >= 0
        && Array.isArray(r32Aud.body && r32Aud.body.pdca)
        && r32Aud.body.pdca.length === 0,
      JSON.stringify({ status: r32Aud.status,
        events: r32Aud.body && r32Aud.body.events && r32Aud.body.events.length,
        pdca: r32Aud.body && r32Aud.body.pdca }));

    await js(`CP.store.load()`);
    await sleep(300);
    const r32FixCard = await js(`(() => {
      const c = document.querySelector('.kb-card[data-task-id=${JSON.stringify(r32Id)}]');
      if (!c) return null;
      const m = c.querySelector('.kb-model');
      const f = c.querySelector('.kb-conf');
      const g = c.querySelector('.kb-gate');
      return { model: m ? m.textContent : '', conf: f ? f.textContent : '',
        confData: f ? f.dataset.conf : null, gate: g ? g.dataset.gate : '',
        cost: !!c.querySelector('.kb-cost'), audit: !!c.querySelector('.kb-audit') };
    })()`);
    PASS('I-033: unset confidence renders a dash; human fixture card starts autonomous',
      !!r32FixCard && r32FixCard.conf === 'conf: -' && r32FixCard.confData === ''
        && r32FixCard.model === 'model: n/a' && r32FixCard.gate === 'autonomous'
        && r32FixCard.cost && r32FixCard.audit,
      JSON.stringify(r32FixCard));

    const r32PutConf = await api('PUT', '/api/tasks/' + encodeURIComponent(r32Id), { confidence: 0.4 });
    await js(`CP.store.load()`);
    await sleep(250);
    const r32Low = await js(`(() => {
      const c = document.querySelector('.kb-card[data-task-id=${JSON.stringify(r32Id)}]');
      const f = c && c.querySelector('.kb-conf');
      const g = c && c.querySelector('.kb-gate');
      return { conf: f ? f.textContent : '', gate: g ? g.dataset.gate : '' };
    })()`);
    PASS('I-033: confidence 0.40 below the 0.7 gate auto-escalates the card to needs-ack',
      r32PutConf.status === 200 && r32Low.conf === 'conf: 0.40' && r32Low.gate === 'needs-ack',
      JSON.stringify({ put: r32PutConf.status, conf: r32Low.conf, gate: r32Low.gate }));

    const r32ThrUp = await js(`(() => {
      localStorage.setItem('cp.conf-threshold', '0.3');
      CP.patchBoard();
      const c = document.querySelector('.kb-card[data-task-id=${JSON.stringify(r32Id)}]');
      const g = c && c.querySelector('.kb-gate');
      return { thr: CP.confThreshold(), gate: g ? g.dataset.gate : '' };
    })()`);
    PASS('I-033: threshold 0.3 lifts the escalation (0.4 >= 0.3 -> autonomous again)',
      r32ThrUp.thr === 0.3 && r32ThrUp.gate === 'autonomous', JSON.stringify(r32ThrUp));

    const r32BadConf = await api('PUT', '/api/tasks/' + encodeURIComponent(r32Id), { confidence: 1.5 });
    PASS('I-033: confidence outside 0..1 answers 400 and writes nothing',
      r32BadConf.status === 400 && /confidence/i.test(JSON.stringify(r32BadConf.body || {})),
      JSON.stringify(r32BadConf));

    /* The Settings row drives the same key; 0.96 escalates the demo t1 card
       (0.95) too, proving the threshold is live and not fixture-only. */
    await js(`document.querySelector('[data-view="settings"]').click()`);
    await sleep(250);
    const r32SetChange = await js(`(() => {
      const i = document.getElementById('setConfGate');
      i.value = '0.96';
      i.dispatchEvent(new Event('change', { bubbles: true }));
      return { stored: localStorage.getItem('cp.conf-threshold'),
        note: (document.getElementById('setConfGateNote') || {}).textContent || '' };
    })()`);
    await js(`document.querySelector('[data-view="board"]').click()`);
    await sleep(300);
    const r32EscDemo = await js(`(() => {
      const t1 = document.querySelector('.kb-card[data-task-id="t1"]');
      const g1 = t1 && t1.querySelector('.kb-gate');
      const fx = document.querySelector('.kb-card[data-task-id=${JSON.stringify(r32Id)}]');
      const gf = fx && fx.querySelector('.kb-gate');
      return { t1: g1 ? g1.dataset.gate : '', fixture: gf ? gf.dataset.gate : '',
        thr: CP.confThreshold() };
    })()`);
    PASS('I-033: Settings change persists cp.conf-threshold and escalates demo t1 (0.95 < 0.96)',
      r32SetChange.stored === '0.96' && r32SetChange.note.indexOf('0.96') >= 0
        && r32EscDemo.thr === 0.96 && r32EscDemo.t1 === 'needs-ack'
        && r32EscDemo.fixture === 'needs-ack',
      JSON.stringify({ set: r32SetChange, esc: r32EscDemo }));

    /* Real reload; re-activate the board view before measuring (R29 lesson). */
    await cmd('Page.reload', { ignoreCache: true });
    await sleep(950);
    await ready();
    await js(`document.querySelector('[data-view="board"]').click()`);
    await sleep(350);
    const r32Reload = await js(`(() => {
      const t1 = document.querySelector('.kb-card[data-task-id="t1"]');
      const g = t1 && t1.querySelector('.kb-gate');
      const i = document.getElementById('setConfGate');
      return { thr: CP.confThreshold(), stored: localStorage.getItem('cp.conf-threshold'),
        t1: g ? g.dataset.gate : '', input: i ? i.value : '' };
    })()`);
    PASS('I-033: confidence gate survives a reload; board view re-activated before measuring',
      r32Reload.thr === 0.96 && r32Reload.stored === '0.96'
        && r32Reload.t1 === 'needs-ack' && r32Reload.input === '0.96',
      JSON.stringify(r32Reload));

    /* Audit popover on the fixture card, after the reload. */
    const r32PopOpen = await js(`(() => {
      const c = document.querySelector('.kb-card[data-task-id=${JSON.stringify(r32Id)}]');
      if (!c) return null;
      c.scrollIntoView({ block: 'center' });
      const b = c.querySelector('.kb-audit');
      if (!b) return null;
      b.click();
      return true;
    })()`);
    await sleep(700);
    const r32Pop = await js(`(() => {
      const c = document.querySelector('.kb-card[data-task-id=${JSON.stringify(r32Id)}]');
      const p = c && c.querySelector('.kb-audit-pop');
      const b = c && c.querySelector('.kb-audit');
      return { open: !!p && p.hidden === false,
        display: p ? getComputedStyle(p).display : 'none',
        text: p ? p.textContent : '',
        expanded: b ? b.getAttribute('aria-expanded') : '' };
    })()`);
    PASS('I-033: audit chip opens the trail popover (event row + PDCA section visible)',
      r32PopOpen === true && !!r32Pop && r32Pop.open && r32Pop.display !== 'none'
        && r32Pop.text.indexOf('Audit trail: ' + r32Id) >= 0
        && r32Pop.text.indexOf('desk events (1)') >= 0
        && r32Pop.text.indexOf('R31 audit probe trail') >= 0
        && r32Pop.text.indexOf('PDCA entries (0)') >= 0
        && r32Pop.expanded === 'true',
      JSON.stringify({ open: r32Pop && r32Pop.open, display: r32Pop && r32Pop.display,
        expanded: r32Pop && r32Pop.expanded,
        head: r32Pop ? r32Pop.text.slice(0, 140) : '' }));

    await js(`(() => {
      const c = document.querySelector('.kb-card[data-task-id=${JSON.stringify(r32Id)}]');
      const b = c && c.querySelector('.kb-audit');
      if (b) b.click();
      return true;
    })()`);
    const r32PopClosed = await js(`(() => {
      const c = document.querySelector('.kb-card[data-task-id=${JSON.stringify(r32Id)}]');
      const p = c && c.querySelector('.kb-audit-pop');
      return p ? p.hidden : null;
    })()`);
    PASS('I-033: second audit click collapses the popover',
      r32PopClosed === true, String(r32PopClosed));
  } finally {
    /* Restore every mutation: fixture task, its desk events, and the
       confidence-threshold chrome key. Nothing else is touched. */
    if (r32Id) {
      try { await api('DELETE', '/api/tasks/' + encodeURIComponent(r32Id)); }
      catch (_e) { /* restore still runs */ }
    }
    try {
      const r32Sql = require('node:sqlite');
      const r32Conn = new r32Sql.DatabaseSync(path.join(dataDir(), 'panel.db'));
      if (r32EvId) r32Conn.prepare('DELETE FROM desk_events WHERE id=?').run(r32EvId);
      if (r32Id) r32Conn.prepare('DELETE FROM desk_events WHERE detail LIKE ?').run('%' + r32Id + '%');
      r32Conn.close();
    } catch (_e) { /* restore still runs */ }
    try {
      await js(`(() => {
        localStorage.removeItem('cp.conf-threshold');
        const i = document.getElementById('setConfGate');
        if (i) i.value = '0.7';
        const n = document.getElementById('setConfGateNote');
        if (n) n.textContent = 'cards below this confidence show needs-ack';
        CP.patchBoard();
        return true;
      })()`);
    } catch (_e) { /* page may be mid-navigation */ }
  }

  /* Post-restore proof: no fixture residue, demo old fields byte-identical
     to the snapshot taken at the top of this section, threshold back home. */
  const r32After = await api('GET', '/api/state');
  const r32AudAfter = r32Id
    ? await api('GET', '/api/tasks/' + encodeURIComponent(r32Id) + '/audit')
    : { status: 0, body: null };
  const r32OldSame = ['t1', 't3', 't5'].every((id) => {
    const t = ((r32After.body && r32After.body.tasks) || []).filter((x) => x.id === id)[0];
    return r32PickOld(t) === r32Old[id];
  });
  const r32Chrome = await js(`(() => ({ thr: localStorage.getItem('cp.conf-threshold'),
    thrNow: CP.confThreshold(),
    input: (document.getElementById('setConfGate') || {}).value || '',
    t1: (() => { const c = document.querySelector('.kb-card[data-task-id="t1"]');
      const g = c && c.querySelector('.kb-gate'); return g ? g.dataset.gate : ''; })() }))()`);
  PASS('Section 32 restored: fixture + events gone, demo old fields byte-identical, threshold home',
    !((r32After.body && r32After.body.tasks) || []).some((t) => t.id === r32Id)
      && (!r32Id || (r32AudAfter.body && Array.isArray(r32AudAfter.body.events)
        && r32AudAfter.body.events.length === 0))
      && r32OldSame
      && r32Chrome.thr === null && r32Chrome.thrNow === 0.7
      && r32Chrome.input === '0.7' && r32Chrome.t1 === 'autonomous',
    JSON.stringify({ oldSame: r32OldSame, chrome: r32Chrome,
      audEvents: r32AudAfter.body && r32AudAfter.body.events && r32AudAfter.body.events.length }));

  PASS('Section 32 added no JS exceptions or console errors',
    errors.length === r32Err, 'errors before=' + r32Err + ' after=' + errors.length);

  /* 33. R36 / I-039 - the Work board two-tab view: [Work board] kanban and
     [Hour axis] flat work units over one dataset, explicit cross-view
     navigation (card `-> hour axis` -> bar flash; bar click -> card flash),
     narrow viewports keep the same tab structure. Additive section
     (assertions 33+). Lessons obeyed: re-activate the board view AND the
     right tab after any Page.reload before measuring, layout checks measure
     heights and visibility (never DOM counts), unique r33* locals, and
     cp.wb-tab is removed in finally so the battery and the next run start
     pristine. Retargeted with the R32 split: the hover cross-highlight
     assertions become the jump tests below; the stacked-fallback assertion
     becomes the narrow-viewport tab-structure test. */
  const r33Err = errors.length;
  try {
    await js(`document.querySelector('[data-view="board"]').click()`);
    await js(`CP.switchWbTab('board')`);
    await sleep(300);
    const r33Merge = await js(`(() => {
      const page = document.getElementById('workBoard');
      const kb = document.getElementById('wbBoardTab');
      const ax = document.getElementById('ganttPanel');
      const sc = document.getElementById('ganttScroll');
      const bar = document.getElementById('wbTabs');
      const board = document.getElementById('view-board');
      const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
      const r = (el) => el ? el.getBoundingClientRect() : null;
      const pr = r(page); const kr = r(kb);
      const axisOn = (() => {
        bar.querySelector('[data-wb-tab="axis"]').click();
        const out = { axVis: vis(ax), kbVis: vis(kb), axH: ax ? Math.round(ax.getBoundingClientRect().height) : -1 };
        bar.querySelector('[data-wb-tab="board"]').click();
        return out;
      })();
      return {
        onBoard: !!(board && board.classList.contains('active')),
        kbVis: vis(kb), axHidden: !vis(ax),
        tablist: !!bar && bar.getAttribute('role') === 'tablist',
        bothInBoard: !!(kb && kb.closest('#view-board')) && !!(ax && ax.closest('#view-board')),
        ganttNotInPlan: !!(sc && sc.closest('#view-plan') === null && sc.closest('#view-board')),
        kbH: kr ? Math.round(kr.height) : -1,
        pageH: pr ? Math.round(pr.height) : -1,
        kbFull: pr && kr ? kr.width >= pr.width * 0.9 : false,
        axisOn
      };
    })()`);
    PASS('R36: Work board is a two-tab view - kanban pane and hour axis live on it (real heights per ACTIVE tab, gantt not in the Plan view)',
      r33Merge.onBoard && r33Merge.kbVis && r33Merge.axHidden && r33Merge.tablist
        && r33Merge.bothInBoard && r33Merge.ganttNotInPlan
        && r33Merge.kbH > 100 && r33Merge.pageH > 150 && r33Merge.kbFull
        && r33Merge.axisOn.axVis && !r33Merge.axisOn.kbVis && r33Merge.axisOn.axH > 100,
      JSON.stringify(r33Merge));

    /* R36 jump tests (replace the R32 hover cross-highlight assertions):
       a card's `-> hour axis` control switches to tab 2 and flashes the bar;
       a bar click (no drag) switches back to tab 1 and flashes the card;
       selection still lights both surfaces over one dataset. */
    const r33Jump = await js(`(() => {
      const card = document.querySelector('.kb-card[data-task-id="t3"]');
      const btn = card ? card.querySelector('.kb-jump-axis') : null;
      const bar = document.querySelector('.gbar[data-task-id="t3"]');
      if (!card || !btn || !bar) return { ok: false, reason: 'missing t3 card/jump/bar' };
      const label = btn.textContent.trim();
      btn.click();
      const onAxis = getComputedStyle(document.getElementById('ganttPanel')).display !== 'none';
      const barFlashed = bar.classList.contains('kb-flash');
      bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const onBoard = getComputedStyle(document.getElementById('wbBoardTab')).display !== 'none';
      const cardFlashed = card.classList.contains('kb-flash');
      CP.select('t3', false);
      const selCard = card.classList.contains('is-selected');
      const selBar = bar.classList.contains('is-selected');
      CP.select(null, false);
      return { ok: true, label, onAxis, barFlashed, onBoard, cardFlashed, selCard, selBar };
    })()`);
    PASS('R36: -> hour axis jumps to the bar and flashes it; a bar click jumps back and flashes the card; selection lights both surfaces',
      r33Jump.ok && r33Jump.label === '-> hour axis'
        && r33Jump.onAxis && r33Jump.barFlashed
        && r33Jump.onBoard && r33Jump.cardFlashed
        && r33Jump.selCard && r33Jump.selBar,
      JSON.stringify(r33Jump));

    /* R36: a moved bar drag swallows its trailing click (no navigation).
       The probe drags a dep-free leaf row and restores it immediately
       (row-level restore only); no other row is touched. */
    const r33BarDrag = await js(`(() => {
      CP.switchWbTab('axis');
      const sc = document.getElementById('ganttScroll');
      const deps = (CP.store.state && CP.store.state.task_deps) || [];
      const leaf = (CP.store.state.tasks || []).find((t) => !deps.some((d) => d.from === t.id));
      const bar = leaf ? document.querySelector('.gbar[data-task-id="' + CSS.escape(leaf.id) + '"]') : null;
      if (!sc || !bar) return { ok: false, reason: 'no leaf bar' };
      /* capture immutable originals BEFORE dispatch - the optimistic update
         mutates the store row in place. */
      window.__leaf = { id: leaf.id, start: String(leaf.start), end: String(leaf.end) };
      const r = bar.getBoundingClientRect();
      const x0 = r.left + Math.min(20, r.width / 2), y = r.top + r.height / 2;
      /* down lands on the bar; move/up go to document like a real pointer
         (the lanes may repaint mid-gesture and detach the old bar node). */
      bar.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, clientX: x0, clientY: y, bubbles: true }));
      document.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, clientX: x0 + 260, clientY: y, bubbles: true }));
      document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, clientX: x0 + 260, clientY: y, bubbles: true }));
      return { ok: true, id: leaf.id };
    })()`);
    await sleep(350);
    const r33Swallow = await js(`(() => {
      const leaf = window.__leaf;
      const cur = CP.store.state.tasks.filter((t) => t.id === leaf.id)[0];
      const moved = !!cur && (cur.start !== leaf.start || cur.end !== leaf.end);
      const bar = document.querySelector('.gbar[data-task-id="' + CSS.escape(leaf.id) + '"]');
      bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const axisStill = getComputedStyle(document.getElementById('ganttPanel')).display !== 'none';
      CP.store.commit('PUT', '/api/tasks/' + encodeURIComponent(leaf.id),
        { start: leaf.start, end: leaf.end }, 'Row restored after the drag-suppression probe');
      return { axisStill, moved };
    })()`);
    await sleep(300);
    PASS('R36: a moved bar drag swallows its trailing click (no navigation) and the row is restored (one dataset, one move)',
      r33BarDrag.ok && r33Swallow.moved && r33Swallow.axisStill,
      JSON.stringify({ drag: r33BarDrag, after: r33Swallow }));

    /* Card drag lifecycle keeps its live-layout invariants (dragstart ghost,
       dragend cleanup) - no drop runs here, so no task row is mutated. The
       hover cross-highlight assertions retire with the R32 feature; the
       retired class must not appear anywhere. */
    const r33DragStart = await js(`(() => {
      CP.switchWbTab('board');
      const card = document.querySelector('.kb-card[data-task-id="t6"]');
      const bar = document.querySelector('.gbar[data-task-id="t6"]');
      if (!card || !bar) return { ok: false, reason: 'missing t6 card/bar' };
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      return { ok: true, ghostScheduled: true };
    })()`);
    await sleep(40);
    const r33DragEnd = await js(`(() => {
      const card = document.querySelector('.kb-card[data-task-id="t6"]');
      const bar = document.querySelector('.gbar[data-task-id="t6"]');
      if (!card || !bar) return { ok: false };
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }));
      CP.patchBoard();
      const cr = card.getBoundingClientRect();
      CP.switchWbTab('axis');
      const br = bar.getBoundingClientRect();
      CP.switchWbTab('board');
      return { ok: true,
        ghostGone: !card.classList.contains('is-ghost'),
        noHoverClass: !document.querySelector('.is-link-hover'),
        cardBox: cr.width > 0 && cr.height > 0,
        barBox: br.width > 0 && br.height > 0 };
    })()`);
    PASS('R36: card drag lifecycle keeps live-layout invariants (ghost cleared, card and bar keep real boxes, hover class retired)',
      r33DragStart.ok && r33DragEnd.ok && r33DragEnd.ghostGone
        && r33DragEnd.noHoverClass && r33DragEnd.cardBox && r33DragEnd.barBox,
      JSON.stringify({ start: r33DragStart, end: r33DragEnd }));

    /* Narrow viewport: the two-tab structure is unchanged (the stacked split
       fallback retires with the split) - tab bar stays pinned, the active
       pane keeps a real height, and no split handle exists at any width. */
    await cmd('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(350);
    const r33Narrow = await js(`(() => {
      const page = document.getElementById('workBoard');
      const kb = document.getElementById('wbBoardTab');
      const bar = document.getElementById('wbTabs');
      const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
      const kr = kb ? kb.getBoundingClientRect() : null;
      return {
        noSplit: !document.getElementById('wbSplit'),
        tabsPinned: !!bar && vis(bar) && !!kr && bar.getBoundingClientRect().bottom <= kr.top + 4,
        kbVis: vis(kb),
        kbH: kr ? Math.round(kr.height) : -1
      };
    })()`);
    await cmd('Emulation.clearDeviceMetricsOverride');
    await sleep(350);
    PASS('R36: narrow viewport keeps the same tab structure (no split handle, tab bar pinned, active pane keeps its height)',
      r33Narrow.noSplit && r33Narrow.tabsPinned && r33Narrow.kbVis && r33Narrow.kbH > 50,
      JSON.stringify(r33Narrow));

    /* Reload persistence: cp.wb-tab comes back; the board view is
       re-activated after the reload BEFORE any measurement (R29 lesson). */
    await js(`localStorage.setItem('cp.wb-tab', 'axis'); true`);
    await cmd('Page.reload', { ignoreCache: true });
    await sleep(950);
    await ready();
    await js(`document.querySelector('[data-view="board"]').click()`);
    await sleep(320);
    const r33Keep = await js(`(() => {
      const ax = document.getElementById('ganttPanel');
      const kb = document.getElementById('wbBoardTab');
      const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
      return {
        stored: localStorage.getItem('cp.wb-tab'),
        axVis: vis(ax), kbHidden: !vis(kb),
        axH: ax ? Math.round(ax.getBoundingClientRect().height) : -1
      };
    })()`);
    PASS('R36: the active tab survives a reload (cp.wb-tab re-applied, board view re-activated before measuring)',
      r33Keep.stored === 'axis' && r33Keep.axVis && r33Keep.kbHidden && r33Keep.axH > 50,
      JSON.stringify(r33Keep));

    /* R36 pinned literals (C13 audit): the added UI strings stay
       byte-identical and the removed split chrome is gone from the sources. */
    const r36Panel = fs.readFileSync(path.join(OUT, 'panel.html'), 'utf8');
    const r36BoardSrc = fs.readFileSync(path.join(OUT, 'src', 'board.ts'), 'utf8');
    const r36AppSrc = fs.readFileSync(path.join(OUT, 'src', 'app.ts'), 'utf8');
    PASS('R36 pinned literals: tab labels and the -> hour axis control byte-identical; split chrome retired from the sources',
      r36Panel.indexOf('[Work board]') >= 0 && r36Panel.indexOf('[Hour axis]') >= 0
        && r36BoardSrc.indexOf('-> hour axis') >= 0
        && r36Panel.indexOf('wbSplit') < 0 && r36AppSrc.indexOf('cp.wb-split') < 0
        && r36AppSrc.indexOf('is-link-hover') < 0,
      'panel/board/app literals verified');
  } finally {
    try {
      await js(`(() => {
        localStorage.removeItem('cp.wb-tab');
        CP.switchWbTab('board');
        return true;
      })()`);
    } catch (_e) { /* page may be mid-navigation */ }
  }

  PASS('Section 33 added no JS exceptions or console errors',
    errors.length === r33Err, 'errors before=' + r33Err + ' after=' + errors.length);

  /* 34. R32 / I-038 - detail drawer read side: a G/M/W row click opens it
     with the locked field set, relations carry type + signed lag (+ nature
     on a provisioned plan relation), the audit sections load from
     GET /api/tasks/:id/audit, and the additive notes field is on screen.
     Additive section. The nature pill needs plan.relations to carry one, so
     the block PROVISIONS it by direct file write under a byte snapshot and
     restores the exact bytes in finally - the drawer itself never writes
     (proved by the byte-identical close-out). */
  const r34Err = errors.length;
  const r34PlanFile = path.join(dataDir(), 'milestone-plan.json');
  const r34MsFile = path.join(pbRepo, 'docs', 'evidence', 'milestones.json');
  const r34PrdFile = path.join(pbRepo, 'docs', 'PRD.md');
  const r34PlanBak = fs.readFileSync(r34PlanFile, 'utf8');
  const r34MsBak = fs.readFileSync(r34MsFile, 'utf8');
  const r34PrdBak = fs.readFileSync(r34PrdFile, 'utf8');
  try {
    await js(`document.querySelector('#nav [data-view="plan"]').click()`);
    await sleep(250);
    await js(`(async () => { await CP.refreshPlan(); return true; })()`);
    await sleep(350);

    /* Provision: give the W6 -> W8 plan relation a nature so the pill can be
       asserted; the bytes go back to the snapshot in finally. */
    const r34Prov = JSON.parse(fs.readFileSync(r34PlanFile, 'utf8'));
    const r34Edge = (r34Prov.relations || []).filter((r) => r.from === 'W6' && r.to === 'W8')[0];
    if (r34Edge) { r34Edge.nature = 'mandatory'; fs.writeFileSync(r34PlanFile, JSON.stringify(r34Prov, null, 2) + '\n'); }
    await js(`(async () => { await CP.refreshPlan(); return true; })()`);
    await sleep(300);

    const r34M = await js(`(() => {
      const row = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M1"]');
      if (!row) return { ok: false, reason: 'no M1 row' };
      row.click();
      const panel = document.getElementById('nodeDrawer');
      const v = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
      const ro = (id) => { const el = document.getElementById(id); return el ? !!el.readOnly : null; };
      const sel = CP.openNode ? CP.openNode() : null;
      const notes = document.getElementById('ndNotes');
      return {
        ok: true,
        open: !!panel && getComputedStyle(panel).display !== 'none',
        sel: sel ? sel.kind + ':' + sel.id : '',
        kind: (document.getElementById('ndKind') || {}).textContent || '',
        name: v('ndName'), status: v('ndStatus'), owner: v('ndOwner'),
        start: v('ndStart'), end: v('ndEnd'),
        costRO: ro('ndCost'), progRO: ro('ndProgress'), statusRO: ro('ndStatus'),
        notes: notes ? { present: true, value: notes.value, max: notes.maxLength } : { present: false },
        hasSave: !!document.getElementById('ndSave'),
        hasDelete: !!document.getElementById('ndDelete'),
        rel: (document.querySelector('#ndBody .nd-section') || {}).textContent || '',
        m2Down: (document.querySelector('#ndBody .nd-section') || {}).textContent.indexOf('M2 (milestone)') >= 0
      };
    })()`);
    PASS('I-038: clicking a milestone row opens the right-side drawer with the locked field set + notes',
      r34M.ok && r34M.open && r34M.sel === 'ms:M1' && r34M.kind === 'M1'
        && r34M.name && r34M.status === 'done' && r34M.owner !== null
        && r34M.start === '-96' && r34M.end === '-72'
        && r34M.costRO === true && r34M.progRO === true && r34M.statusRO === false
        && r34M.notes.present && r34M.notes.max === 500
        && r34M.hasSave && r34M.hasDelete && r34M.rel.indexOf('upstream') >= 0
        && r34M.m2Down,
      JSON.stringify(r34M));

    const r34W = await js(`(() => {
      const row = document.querySelector('.ms-goal-row[data-kind=wu][data-node="W8"]');
      if (!row) return { ok: false, reason: 'no W8 row' };
      row.click();
      const v = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
      const ro = (id) => { const el = document.getElementById(id); return el ? !!el.readOnly : null; };
      const pills = Array.from(document.querySelectorAll('#ndBody .nd-rel')).map((p) => p.textContent.trim());
      const sel = CP.openNode ? CP.openNode() : null;
      const groups = Array.from(document.querySelectorAll('#ndGroup, .nd-group-label')).map((g) => g.textContent.trim());
      const sections = Array.from(document.querySelectorAll('#ndBody .nd-group')).map((g) => g.textContent.trim());
      return {
        ok: true, sel: sel ? sel.kind + ':' + sel.id : '',
        name: v('ndName'), status: v('ndStatus'), owner: v('ndOwner'),
        cost: v('ndCost'), progress: v('ndProgress'),
        costRO: ro('ndCost'), progRO: ro('ndProgress'), statusRO: ro('ndStatus'),
        pills,
        /* R8 recorded retarget: the pill text is built inside a js() template
           literal, where a regex \+ would cook down to a bare + (quantifier)
           and never match the literal plus sign - indexOf keeps the assertion
           intent (downstream pill shows type + signed lag) byte-for-byte. */
        hasUpW6: pills.some((t) => t.indexOf('W6 SS') === 0
          && (t === 'W6 SS' || t === 'W6 SS mandatory')),
        hasDownW11: pills.some((t) => t.indexOf('W11 SS+2d') === 0),
        hasNature: pills.some((t) => t.indexOf('mandatory') >= 0),
        groups: sections.join(' | ')
      };
    })()`);
    await sleep(700);
    const r34Audit = await js(`(() => {
      const b = document.getElementById('ndAudit');
      return b ? b.textContent : '';
    })()`);
    PASS('I-038: work-unit drawer carries editable fields + upstream/downstream pills (type, signed lag, nature) and the audit trail loads',
      r34W.ok && r34W.sel === 'wu:W8' && r34W.name && r34W.status === 'done'
        && r34W.costRO === false && r34W.progRO === false && r34W.statusRO === false
        && r34W.owner !== null && r34W.cost !== null && r34W.progress !== null
        && r34W.hasUpW6 && r34W.hasDownW11 && r34W.hasNature
        && r34Audit.indexOf('Audit trail: W8') >= 0
        && r34Audit.indexOf('desk events') >= 0
        && r34Audit.indexOf('PDCA entries') >= 0
        && r34Audit.indexOf('Loading audit') < 0,
      JSON.stringify({ w: r34W, auditHead: r34Audit.slice(0, 160) }));

    /* Goal drawer: derived rollup fields read-only + the member list; the
       fold toggle must not open the drawer (it returns before the row
       branch); Close hides it. */
    const r34G = await js(`(() => {
      const gRow = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G1"]');
      if (!gRow) return { ok: false, reason: 'no G1 row' };
      gRow.click();
      const ro = (id) => { const el = document.getElementById(id); return el ? !!el.readOnly : null; };
      const v = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
      const sel1 = CP.openNode ? CP.openNode() : null;
      const members = (document.querySelector('#ndBody .nd-kids') || {}).textContent || '';
      document.getElementById('ndClose').click();
      const closed = !CP.openNode()
        && document.getElementById('nodeDrawer').classList.contains('hidden');
      const fold = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M1"] [data-fold]');
      const foldBefore = fold ? fold.textContent : '';
      if (fold) fold.click();
      const stillClosed = document.getElementById('nodeDrawer').classList.contains('hidden')
        && !CP.openNode();
      if (fold) fold.click();
      return {
        ok: true, sel: sel1 ? sel1.kind + ':' + sel1.id : '',
        statusRO: ro('ndStatus'), costRO: ro('ndCost'), progRO: ro('ndProgress'),
        status: v('ndStatus'), members,
        membersOk: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'].every((m) => members.indexOf(m) >= 0),
        closed, stillClosed, foldBefore,
        foldRestored: fold ? fold.textContent === foldBefore : false
      };
    })()`);
    PASS('I-038: goal drawer shows the derived rollup read-only + members; fold toggle never opens it; Close hides it',
      r34G.ok && r34G.sel === 'goal:G1' && r34G.statusRO === true
        && r34G.costRO === true && r34G.progRO === true && r34G.status === 'done'
        && r34G.membersOk && r34G.closed && r34G.stillClosed
        && r34G.foldBefore === '[-]' && r34G.foldRestored,
      JSON.stringify(r34G));

    await js(`(() => { try { localStorage.removeItem('cp.tree-fold'); } catch (e) {} return true; })()`);
  } finally {
    fs.writeFileSync(r34PlanFile, r34PlanBak);
    fs.writeFileSync(r34MsFile, r34MsBak);
    fs.writeFileSync(r34PrdFile, r34PrdBak);
    try {
      await js(`(() => {
        CP.closeNodeDrawer();
        return true;
      })()`);
    } catch (_e) { /* page may be mid-navigation */ }
  }

  const r34PlanNow = fs.readFileSync(r34PlanFile, 'utf8');
  const r34MsNow = fs.readFileSync(r34MsFile, 'utf8');
  const r34PrdNow = fs.readFileSync(r34PrdFile, 'utf8');
  PASS('I-038: opening, switching and closing the drawer writes nothing (plan / evidence / PRD bytes identical)',
    r34PlanNow === r34PlanBak && r34MsNow === r34MsBak && r34PrdNow === r34PrdBak,
    'plan=' + (r34PlanNow === r34PlanBak) + ' evidence=' + (r34MsNow === r34MsBak)
      + ' prd=' + (r34PrdNow === r34PrdBak));

  await js(`(async () => { await CP.refreshPlan(); return true; })()`);
  await sleep(250);
  PASS('Section 34 added no JS exceptions or console errors',
    errors.length === r34Err, 'errors before=' + r34Err + ' after=' + errors.length);

  /* 35. R32 / I-038 - tree CRUD through the plan-sync-class four-store
     commit (milestone-plan.json + docs/evidence/milestones.json + the PRD
     Status registry + the SQLite task rows, one commit with rollback).
     Additive section. Every operation class - create, update, delete -
     ends with BOTH gates re-run and asserted green (prd-to-action 10/10 +
     plan-sync --check), the lock's per-class assertion; the delete confirm
     dialog is driven end to end on the human path, and Cancel is proved
     with byte-identical stores. Lessons obeyed: plan/evidence/PRD byte
     snapshots restored in finally, SQLite mutations restored with ROW-LEVEL
     DML only (never a file copy of panel.db or its wal/shm), views
     re-activated after anything that could re-render, the relation the
     dialog lists is test-provisioned into the plan files under the same
     byte snapshot, and the drawer/modal are closed in finally. Gate runs
     require db.js inside plan-sync, which logs job/import events at boot -
     section 31 established that class of run as suite-neutral (no
     assertion counts desk_events), so they are left alone here too. */
  const r35Err = errors.length;
  const r35PlanFile = path.join(dataDir(), 'milestone-plan.json');
  const r35MsFile = path.join(pbRepo, 'docs', 'evidence', 'milestones.json');
  const r35PrdFile = path.join(pbRepo, 'docs', 'PRD.md');
  const r35PlanBak = fs.readFileSync(r35PlanFile, 'utf8');
  const r35MsBak = fs.readFileSync(r35MsFile, 'utf8');
  const r35PrdBak = fs.readFileSync(r35PrdFile, 'utf8');
  const r35Read = () => ({
    plan: JSON.parse(fs.readFileSync(r35PlanFile, 'utf8')),
    ms: JSON.parse(fs.readFileSync(r35MsFile, 'utf8')),
    prd: fs.readFileSync(r35PrdFile, 'utf8'),
  });
  /* Node-side file poll: the browser write path is async (fetch -> commit ->
     refreshPlan), so the assertions wait for the STORE, not a clock alone. */
  const r35Poll = async (pred) => {
    for (let i = 0; i < 40; i += 1) {
      try { if (pred(r35Read())) return true; } catch (_e) { /* mid-write */ }
      await sleep(150);
    }
    return false;
  };
  const r35Gate = () => {
    i31Seed();
    const a = i31Run([path.join(pbRepo, 'scripts', 'prd-to-action.js')]);
    const b = i31Run([path.join(pbRepo, 'scripts', 'plan-sync.js'), '--check']);
    const al = (a.out.split('\n').filter((l) => l.indexOf('PRD-TO-ACTION GATE') >= 0)[0] || '').trim();
    const bl = (b.out.split('\n').filter((l) => l.indexOf('PLAN-SYNC CHECK') >= 0)[0] || '').trim();
    return {
      ok: a.code === 0 && al === 'PRD-TO-ACTION GATE: 10/10 passed'
        && b.code === 0 && /^PLAN-SYNC CHECK: \d+\/\d+ passed$/.test(bl),
      al: al + ' (exit ' + a.code + ')',
      bl: bl + ' (exit ' + b.code + ')',
    };
  };
  const r35PrdBlock = (prd, id) => {
    const at0 = prd.indexOf('### ' + id + ':');
    if (at0 < 0) return '';
    let end = prd.indexOf('### M', at0 + 5);
    if (end < 0) end = prd.indexOf('\n## ', at0);
    if (end < 0) end = prd.length;
    return prd.slice(at0, end);
  };
  let r35Conn = null;
  try {
    r35Conn = new (require('node:sqlite').DatabaseSync)(path.join(dataDir(), 'panel.db'));
    /* Re-activate the plan view, clear folds, re-read the real plan (R29
       lesson) so the fresh M8 row is on screen before the clicks. */
    await js(`document.querySelector('#nav [data-view="plan"]').click()`);
    await sleep(250);
    await js(`(() => { try { localStorage.removeItem('cp.tree-fold'); } catch (e) {} return true; })()`);
    await js(`(async () => { await CP.refreshPlan(); return true; })()`);
    await sleep(400);

    const r35Btns = await js(`(() => {
      const g = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G2"] [data-add="ms"]');
      const m = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M7"] [data-add="wu"]');
      const w = document.querySelector('.ms-goal-row[data-kind=wu] [data-add]');
      return { g: !!g, m: !!m, w: !!w,
        gt: g ? g.textContent.trim() : '', mt: m ? m.textContent.trim() : '' };
    })()`);
    PASS('I-038: G rows carry [+ new milestone] and M rows carry [+ new work unit]; W rows carry none',
      r35Btns.g && r35Btns.m && !r35Btns.w && r35Btns.gt === '[+]' && r35Btns.mt === '[+]',
      JSON.stringify(r35Btns));

    /* ---- CREATE class (human path: the G2 [+] button) ---- */
    await js(`(() => {
      const b = document.querySelector('.ms-goal-row[data-kind=goal][data-node="G2"] [data-add="ms"]');
      if (b) b.click();
      return true;
    })()`);
    const r35C1 = await r35Poll((s) => s.plan.milestones.some((m) => String(m.id) === 'M8'));
    const r35S1 = r35Read();
    const r35Blk1 = r35PrdBlock(r35S1.prd, 'M8');
    const r35GateC1 = r35Gate();
    PASS('CREATE class: G2 [+] lands M8 across plan + evidence + PRD block in one commit; both gates green after the class',
      r35C1 && Array.isArray(r35S1.plan.sub_lines.M8)
        && r35S1.plan.main_line[r35S1.plan.main_line.length - 1] === 'M8'
        && (r35S1.plan.goals || []).some((g) => Array.isArray(g.milestone_ids)
          && g.milestone_ids.map(String).indexOf('M8') >= 0)
        && r35S1.plan.milestones.some((m) => m.id === 'M8' && m.status === 'pending')
        && r35S1.ms.milestones.some((m) => m.id === 'M8' && m.status === 'pending')
        && r35Blk1.indexOf('### M8:') === 0
        && ['- Status: pending', 'Depends on:', 'Type:', 'Has external deps:',
          'Files:', 'Completion:', 'Verify:'].every((f) => r35Blk1.indexOf(f) >= 0)
        && r35GateC1.ok,
      'created=' + r35C1 + ' blockLines=' + r35Blk1.split('\n').length
        + ' | ' + r35GateC1.al + ' | ' + r35GateC1.bl);

    /* ---- CREATE class, part 2: [+] on the empty M8 ships the gate-X pair ---- */
    await until(`!!document.querySelector('.ms-goal-row[data-kind=ms][data-node="M8"] [data-add="wu"]')`,
      (v) => v === true, 4000);
    await js(`(() => {
      const b = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M8"] [data-add="wu"]');
      if (b) b.click();
      return true;
    })()`);
    const r35C2 = await r35Poll((s) => s.plan.work_units.some((w) => w.id === 'W19')
      && s.plan.work_units.some((w) => w.id === 'W20'));
    let r35Rows = [];
    try {
      r35Rows = r35Conn.prepare(
        "SELECT id, status, progress FROM tasks WHERE id IN ('W19','W20') ORDER BY id")
        .all().map((r) => ({ id: String(r.id), status: String(r.status), progress: Number(r.progress) }));
    } catch (e) {
      r35Rows = [{ id: 'ERR', status: String(e), progress: -1 }];
    }
    const r35GateC2 = r35Gate();
    PASS('CREATE class: M8 [+] ships the gate-X pair W19+W20 (pending / 0 placeholders), task rows land, both gates green',
      r35C2 && r35Rows.length === 2
        && r35Rows.every((r) => r.status === 'pending' && r.progress === 0)
        && r35GateC2.ok,
      JSON.stringify(r35Rows) + ' | ' + r35GateC2.al + ' | ' + r35GateC2.bl);

    /* ---- UPDATE class (human path: the drawer's Save) ---- */
    await js(`(() => {
      const row = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M8"]');
      if (!row) return false;
      row.click();
      const st = document.getElementById('ndStatus');
      if (st) st.value = 'in_progress';
      const owner = document.getElementById('ndOwner');
      if (owner) owner.value = 'main';
      const notes = document.getElementById('ndNotes');
      if (notes) notes.value = 'R32 update probe';
      const save = document.getElementById('ndSave');
      if (save) save.click();
      return true;
    })()`);
    const r35U1 = await r35Poll((s) => {
      const m = s.plan.milestones.filter((x) => x.id === 'M8')[0];
      return !!m && m.status === 'in_progress' && m.notes === 'R32 update probe';
    });
    const r35S2 = r35Read();
    const r35Blk2 = r35PrdBlock(r35S2.prd, 'M8');
    const r35M8Ev = r35S2.ms.milestones.filter((m) => m.id === 'M8')[0];
    await js(`(() => {
      const row = document.querySelector('.ms-goal-row[data-kind=wu][data-node="W19"]');
      if (!row) return false;
      row.click();
      const st = document.getElementById('ndStatus');
      if (st) st.value = 'in_progress';
      const prog = document.getElementById('ndProgress');
      if (prog) prog.value = '40';
      const notes = document.getElementById('ndNotes');
      if (notes) notes.value = 'R32 unit probe';
      const save = document.getElementById('ndSave');
      if (save) save.click();
      return true;
    })()`);
    const r35U2 = await r35Poll((s) => {
      const w = s.plan.work_units.filter((x) => x.id === 'W19')[0];
      return !!w && w.status === 'in_progress' && Number(w.progress) === 40
        && w.notes === 'R32 unit probe';
    });
    let r35W19 = null;
    try { r35W19 = r35Conn.prepare("SELECT status, progress FROM tasks WHERE id='W19'").get(); }
    catch (_e) { r35W19 = null; }
    const r35PreBad = fs.readFileSync(r35PlanFile, 'utf8');
    const r35UBad = await api('PUT', '/api/plan/structure',
      { kind: 'update-node', id: 'W19', patch: { progress: 100 } });
    const r35PostBad = fs.readFileSync(r35PlanFile, 'utf8');
    const r35GateU = r35Gate();
    PASS('UPDATE class: Save moves M8 status to PRD+evidence+plan and W19 to plan+task row; progress=100 refused 400 zero-write; both gates green',
      r35U1 && r35U2
        && !!r35M8Ev && r35M8Ev.status === 'in_progress'
        && r35Blk2.indexOf('- Status: in_progress') >= 0
        && !!r35W19 && String(r35W19.status) === 'in_progress' && Number(r35W19.progress) === 40
        && r35UBad.status === 400 && /progress/i.test(JSON.stringify(r35UBad.body || {}))
        && r35PostBad === r35PreBad
        && r35GateU.ok,
      JSON.stringify({ w19: r35W19 ? { status: r35W19.status, progress: r35W19.progress } : null,
        bad: r35UBad.status })
        + ' | ' + r35GateU.al + ' | ' + r35GateU.bl);

    /* Test provisioning: a plan-level W19 -> W20 relation so the confirm
       dialog has a real edge to list and the cascade a real edge to remove.
       Written into BOTH stores (gate X pins them equal) under the block-start
       byte snapshot; the finally block restores the exact original bytes, so
       the relation never exists at rest. */
    const r35ProvPlan = JSON.parse(fs.readFileSync(r35PlanFile, 'utf8'));
    (Array.isArray(r35ProvPlan.relations) ? r35ProvPlan.relations : (r35ProvPlan.relations = []))
      .push({ from: 'W19', to: 'W20', type: 'FS', lag: 0 });
    fs.writeFileSync(r35PlanFile, JSON.stringify(r35ProvPlan, null, 2) + '\n');
    const r35ProvMs = JSON.parse(fs.readFileSync(r35MsFile, 'utf8'));
    (Array.isArray(r35ProvMs.relations) ? r35ProvMs.relations : (r35ProvMs.relations = []))
      .push({ from: 'W19', to: 'W20', type: 'FS', lag: 0 });
    fs.writeFileSync(r35MsFile, JSON.stringify(r35ProvMs, null, 2) + '\n');
    const r35EdgePut = await api('PUT', '/api/task-deps', { from: 'W19', to: 'W20', type: 'FS', lag: 0 });
    await js(`(async () => { await CP.refreshPlan(); return true; })()`);
    await sleep(350);

    /* ---- DELETE: the confirm dialog lists dependents; Cancel = zero writes ---- */
    const r35PreD = fs.readFileSync(r35PlanFile, 'utf8');
    const r35PreDMs = fs.readFileSync(r35MsFile, 'utf8');
    const r35PreDPrd = fs.readFileSync(r35PrdFile, 'utf8');
    const r35Dlg1 = await js(`(() => {
      const row = document.querySelector('.ms-goal-row[data-kind=wu][data-node="W19"]');
      if (!row) return { ok: false, reason: 'no W19 row' };
      row.click();
      const del = document.getElementById('ndDelete');
      if (!del) return { ok: false, reason: 'no delete button' };
      del.click();
      const layer = document.getElementById('modalLayer');
      const sheet = document.getElementById('modalSheet');
      const text = sheet ? sheet.textContent : '';
      const open = !!layer && !layer.classList.contains('hidden');
      const cancel = sheet ? sheet.querySelector('[data-action="close"]') : null;
      if (cancel) cancel.click();
      const closed = !!layer && layer.classList.contains('hidden');
      return { ok: true, open, closed,
        rel: text.indexOf('1 relation(s)') >= 0 && text.indexOf('W19 -> W20 (FS)') >= 0,
        childLine: text.indexOf('no child rows') >= 0,
        cancelLine: text.indexOf('Cancel writes nothing') >= 0,
        drawerStill: !!CP.openNode() };
    })()`);
    const r35PostCancelP = fs.readFileSync(r35PlanFile, 'utf8');
    const r35PostCancelM = fs.readFileSync(r35MsFile, 'utf8');
    const r35PostCancelPrd = fs.readFileSync(r35PrdFile, 'utf8');
    PASS('DELETE dialog lists the dependents (1 relation + child-row line + Cancel note); Cancel writes nothing (bytes identical)',
      r35Dlg1.ok && r35Dlg1.open && r35Dlg1.closed && r35Dlg1.rel
        && r35Dlg1.childLine && r35Dlg1.cancelLine && r35Dlg1.drawerStill
        && r35PostCancelP === r35PreD && r35PostCancelM === r35PreDMs
        && r35PostCancelPrd === r35PreDPrd,
      JSON.stringify(r35Dlg1));

    /* Confirming on W19 would orphan M8 at exactly 1 unit - PRD gate X
       floor: the server refuses with 400 and zero writes; the toast carries
       the reason and the drawer stays open on the refused node. */
    const r35Dlg2 = await js(`(async () => {
      const del = document.getElementById('ndDelete');
      if (del) del.click();
      const sheet = document.getElementById('modalSheet');
      const go = sheet ? sheet.querySelector('#ndDoDelete') : null;
      if (go) go.click();
      await new Promise((r) => setTimeout(r, 900));
      return { toast: (document.getElementById('toast') || {}).textContent || '',
        drawer: !!CP.openNode(),
        modalClosed: document.getElementById('modalLayer').classList.contains('hidden') };
    })()`);
    const r35PostD0P = fs.readFileSync(r35PlanFile, 'utf8');
    const r35PostD0M = fs.readFileSync(r35MsFile, 'utf8');
    PASS('DELETE refuses to orphan M8 at 1 work unit (PRD gate X floor): refusal toast, drawer stays open, zero writes',
      /would keep 1 work unit/.test(r35Dlg2.toast) && r35Dlg2.drawer && r35Dlg2.modalClosed
        && r35PostD0P === r35PreD && r35PostD0M === r35PreDMs
        && fs.readFileSync(r35PrdFile, 'utf8') === r35PreDPrd,
      JSON.stringify(r35Dlg2));

    /* Confirm on M8: the dialog lists both lines (relation + child rows),
       the cascade button runs the four-store delete, and the gates go green
       again - the DELETE class assertion. */
    const r35Dlg3 = await js(`(() => {
      const row = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M8"]');
      if (!row) return { ok: false, reason: 'no M8 row' };
      row.click();
      const del = document.getElementById('ndDelete');
      if (!del) return { ok: false, reason: 'no delete button' };
      del.click();
      const sheet = document.getElementById('modalSheet');
      const text = sheet ? sheet.textContent : '';
      const go = sheet ? sheet.querySelector('#ndDoDelete') : null;
      if (go) go.click();
      return { ok: true,
        kids: text.indexOf('2 child row(s)') >= 0 && text.indexOf('W19, W20') >= 0,
        rel: text.indexOf('1 relation(s)') >= 0 && text.indexOf('W19 -> W20 (FS)') >= 0 };
    })()`);
    const r35D1 = await r35Poll((s) => !s.plan.milestones.some((m) => m.id === 'M8')
      && !s.plan.work_units.some((w) => w.id === 'W19')
      && !s.plan.work_units.some((w) => w.id === 'W20'));
    const r35S3 = r35Read();
    let r35RowsGone = false;
    let r35EdgeGone = false;
    try {
      r35RowsGone = r35Conn.prepare("SELECT COUNT(*) AS n FROM tasks WHERE id IN ('W19','W20')").get().n === 0;
      r35EdgeGone = r35Conn.prepare(
        "SELECT COUNT(*) AS n FROM task_deps WHERE (from_id='W19' AND to_id='W20') OR (from_id='W20' AND to_id='W19')")
        .get().n === 0;
    } catch (_e) { /* surfaced as false below */ }
    const r35GateD = r35Gate();
    PASS('DELETE class (confirm): cascade removes M8 + W19/W20 + the relation + PRD block + evidence membership + task rows together; both gates green after the class',
      r35Dlg3.ok && r35Dlg3.kids && r35Dlg3.rel && r35D1
        && r35PrdBlock(r35S3.prd, 'M8') === ''
        && !r35S3.ms.milestones.some((m) => m.id === 'M8')
        && (r35S3.plan.relations || []).length === 16
        && !r35S3.plan.goals.some((g) => Array.isArray(g.milestone_ids)
          && g.milestone_ids.map(String).indexOf('M8') >= 0)
        && r35RowsGone && r35EdgeGone && r35GateD.ok,
      JSON.stringify({ dialog: r35Dlg3, rowsGone: r35RowsGone, edgeGone: r35EdgeGone,
        relations: (r35S3.plan.relations || []).length })
        + ' | ' + r35GateD.al + ' | ' + r35GateD.bl);
  } finally {
    fs.writeFileSync(r35PlanFile, r35PlanBak);
    fs.writeFileSync(r35MsFile, r35MsBak);
    fs.writeFileSync(r35PrdFile, r35PrdBak);
    if (r35Conn) {
      try {
        /* Row-level DML only - the panel.db trio is never file-copied. */
        r35Conn.prepare("DELETE FROM tasks WHERE id IN ('W19','W20')").run();
        r35Conn.prepare(
          "DELETE FROM task_deps WHERE from_id IN ('W19','W20') OR to_id IN ('W19','W20')").run();
      } catch (_e) { /* restore still runs */ }
      try { r35Conn.close(); } catch (_e) { /* already closed */ }
      r35Conn = null;
    }
    try {
      await js(`(() => {
        CP.closeNodeDrawer();
        const layer = document.getElementById('modalLayer');
        if (layer && !layer.classList.contains('hidden')) {
          const close = document.querySelector('#modalSheet [data-action="close"]');
          if (close) close.click();
        }
        try { localStorage.removeItem('cp.tree-fold'); } catch (e) { /* storage blocked */ }
        return true;
      })()`);
    } catch (_e) { /* page may be mid-navigation */ }
  }

  const r35PlanAfter = fs.readFileSync(r35PlanFile, 'utf8');
  const r35MsAfter = fs.readFileSync(r35MsFile, 'utf8');
  const r35PrdAfter = fs.readFileSync(r35PrdFile, 'utf8');
  PASS('Section 35 restored: plan / evidence / PRD bytes identical (finally block, row-level DML for SQLite)',
    r35PlanAfter === r35PlanBak && r35MsAfter === r35MsBak && r35PrdAfter === r35PrdBak,
    'plan=' + (r35PlanAfter === r35PlanBak) + ' evidence=' + (r35MsAfter === r35MsBak)
      + ' prd=' + (r35PrdAfter === r35PrdBak));

  await js(`(async () => { await CP.refreshPlan(); return true; })()`);
  await sleep(250);
  const r35EndGate = r35Gate();
  PASS('Gates green on the restored stores after section 35: prd-to-action 10/10 + plan-sync --check',
    r35EndGate.ok, r35EndGate.al + ' | ' + r35EndGate.bl);

  PASS('Section 35 added no JS exceptions or console errors (expected structure-400 refusals allowlisted)',
    unexpectedErrors().length === r35Err,
    'unexpected=' + unexpectedErrors().length + ' (raw=' + errors.length + ', before=' + r35Err
      + ', allowlisted=' + (errors.length - unexpectedErrors().length) + ')');

  /* 36. R35 / I-034 - SOP template pack: the library gains a SOP category
     with exactly two seeded templates (Code review / Research, lock step
     names + approval flags), [use] on a milestone applies one work unit per
     step through the writeNodeStores four-store commit (status 'pending',
     FS links in order into task_deps with lag 0 / nature mandatory, approval
     flag plan-only additive + mirrored to tasks.approval), APPROVAL badges
     render on the plan row and the Work board card with the gateFromScope
     approval floor, [save W chain as SOP] round-trips, and the six builtin
     WBS templates keep byte-identical list/apply behavior. Additive section.
     Discipline: plan/evidence/PRD bytes snapshotted and restored in finally;
     SQLite mutations restored with ROW-LEVEL DML only (created task ids,
     their task_deps edges, the section's template rows, the fixture task -
     never a file copy of panel.db or its wal/shm); no seed-tasks inside the
     section (INSERT OR REPLACE would reset the approval/nature columns the
     section proves); views re-activated after anything that could re-render;
     the refusal400 is Node-side (api()) so it adds no console noise. */
  const i36Err = unexpectedErrors().length;
  const i36PlanFile = path.join(dataDir(), 'milestone-plan.json');
  const i36MsFile = path.join(pbRepo, 'docs', 'evidence', 'milestones.json');
  const i36PrdFile = path.join(pbRepo, 'docs', 'PRD.md');
  const i36PlanBak = fs.readFileSync(i36PlanFile, 'utf8');
  const i36MsBak = fs.readFileSync(i36MsFile, 'utf8');
  const i36PrdBak = fs.readFileSync(i36PrdFile, 'utf8');
  /* Gates WITHOUT seed-tasks: seed-tasks INSERT OR REPLACEs task/task_deps
     rows and would zero the approval flag and the mandatory nature this
     section proves. The base plan's W rows already carry task rows from the
     earlier sections' seeds; each SOP apply writes its own rows atomically. */
  const i36Gate = () => {
    const a = i31Run([path.join(pbRepo, 'scripts', 'prd-to-action.js')]);
    const b = i31Run([path.join(pbRepo, 'scripts', 'plan-sync.js'), '--check']);
    const al = (a.out.split('\n').filter((l) => l.indexOf('PRD-TO-ACTION GATE') >= 0)[0] || '').trim();
    const bl = (b.out.split('\n').filter((l) => l.indexOf('PLAN-SYNC CHECK') >= 0)[0] || '').trim();
    return {
      ok: a.code === 0 && al === 'PRD-TO-ACTION GATE: 10/10 passed'
        && b.code === 0 && /^PLAN-SYNC CHECK: \d+\/\d+ passed$/.test(bl),
      al: al + ' (exit ' + a.code + ')',
      bl: bl + ' (exit ' + b.code + ')',
    };
  };
  const i36Read = () => JSON.parse(fs.readFileSync(i36PlanFile, 'utf8'));
  const i36Created = [];
  const i36TplIds = [];
  let i36Conn = null;
  let i36Fixture = '';
  const i36GateLog = [];
  const i36Apply = async (target, templateId) => {
    const res = await api('PUT', '/api/plan/structure',
      { kind: 'apply-template', target, template_id: templateId });
    if (res.status === 200 && res.body) {
      (res.body.added_work_units || []).forEach((id) => i36Created.push(String(id)));
    }
    const g = i36Gate();
    i36GateLog.push(g);
    return res;
  };

  try {
    /* Re-activate the plan view and clear folds before any DOM measure
       (R29 lesson); section 35 left the plan on screen with folds cleared. */
    await js(`document.querySelector('#nav [data-view="plan"]').click()`);
    await sleep(250);
    await js(`(() => { try { localStorage.removeItem('cp.tree-fold'); } catch (e) {} return true; })()`);
    await js(`(async () => { await CP.refreshPlan(); return true; })()`);
    await sleep(350);

    /* ---- Library listing: six WBS built-ins byte-identical + two SOPs ---- */
    const i36Tpl = await api('GET', '/api/templates');
    const i36List = (i36Tpl.body && i36Tpl.body.templates) || [];
    const i36Built = i36List.filter((t) => t.kind === 'builtin');
    const i36Sops = i36List.filter((t) => t.kind === 'sop');
    const i36Prov = 'inspired by Teambition public template categories; content authored fresh';
    const i36Code = i36Sops.filter((t) => t.id === 'sop-code-review')[0];
    const i36Res = i36Sops.filter((t) => t.id === 'sop-research')[0];
    const i36StepSig = (t) => (t && Array.isArray(t.steps)
      ? t.steps.map((s) => s.title + (s.approval ? '!' : '')).join(',') : '');
    PASS('Section 36: library lists the six WBS built-ins unchanged (exact provenance) and exactly two SOP templates with the lock step names + approval flags',
      i36Tpl.status === 200 && i36Built.length === 6
        && i36Built.every((t) => t.provenance === i36Prov)
        && i36Sops.length === 2 && !!i36Code && !!i36Res
        && i36StepSig(i36Code) === 'lint,test,review!,merge'
        && i36StepSig(i36Res) === 'question,gather,verify!,write-up'
        && i36Sops.every((t) => t.n_work_units === 4 && t.n_milestones === 0),
      JSON.stringify({ builtins: i36Built.map((t) => t.name), sops: i36Sops.map((t) => t.id),
        code: i36StepSig(i36Code), research: i36StepSig(i36Res) }));

    /* ---- Modal UI at M7: SOP category, [use], steps preview, save-chain ---- */
    await js(`(() => {
      const btn = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M7"] .ms-tpl-btn');
      if (btn) btn.click();
      return !!btn;
    })()`);
    await sleep(500);
    const i36Modal = await js(`(() => {
      const layer = document.getElementById('modalLayer');
      const sheet = document.getElementById('modalSheet');
      const text = sheet ? sheet.textContent : '';
      const sops = sheet ? sheet.querySelectorAll('.tpl-item-sop').length : 0;
      const kinds = sheet ? sheet.querySelectorAll('.tpl-kind-sop').length : 0;
      const useBtns = sheet ? Array.from(sheet.querySelectorAll('[data-tpl-apply]'))
        .filter((b) => b.textContent.trim() === '[use]').length : 0;
      const saveSop = sheet ? sheet.querySelector('[data-tpl-save-sop]') : null;
      const close = sheet ? sheet.querySelector('[data-action="close"]') : null;
      const opened = !!layer && !layer.classList.contains('hidden');
      if (close) close.click();
      return {
        opened, sops, kinds, useBtns,
        preview: text.indexOf('1 lint -> 2 test -> 3 review (APPROVAL) -> 4 merge') >= 0,
        saveSop: !!saveSop, saveSopLabel: saveSop ? saveSop.textContent.trim() : '',
        closed: !!layer && layer.classList.contains('hidden'),
      };
    })()`);
    PASS('Section 36: the M-row library modal carries the SOP category ([use] buttons, steps preview, [save W chain as SOP] control) and closes cleanly',
      i36Modal.opened && i36Modal.closed && i36Modal.sops === 2 && i36Modal.kinds === 2
        && i36Modal.useBtns === 8 && i36Modal.preview
        && i36Modal.saveSop && i36Modal.saveSopLabel === '[save W chain as SOP]',
      JSON.stringify(i36Modal));

    /* ---- A1: API [use] apply at M7 - THE apply output line ---- */
    const i36A1 = await i36Apply('M7', 'sop-code-review');
    PASS('Section 36: apply output line - 4 units created + 3 FS links (lag 0, nature mandatory) + status pending',
      i36A1.status === 200 && Array.isArray(i36A1.body && i36A1.body.added_work_units)
        && i36A1.body.added_work_units.length === 4
        && Array.isArray(i36A1.body.added_deps) && i36A1.body.added_deps.length === 3
        && i36A1.body.added_deps.every((d) => d.type === 'FS' && Number(d.lag) === 0
          && d.nature === 'mandatory')
        && i36A1.body.status === 'pending'
        && JSON.stringify(i36A1.body.approval_steps) === JSON.stringify(['review']),
      JSON.stringify(i36A1.body));

    const i36Plan1 = i36Read();
    const i36W1 = i36Plan1.work_units.filter((w) => i36Created.indexOf(String(w.id)) >= 0);
    i36Conn = new (require('node:sqlite').DatabaseSync)(path.join(dataDir(), 'panel.db'));
    const i36TaskRows = i36Created.map((id) => {
      const r = i36Conn.prepare('SELECT id, status, approval FROM tasks WHERE id=?').get(id);
      return r ? { id: r.id, s: r.status, a: Number(r.approval) } : null;
    }).filter(Boolean);
    const i36DepRows = i36Conn.prepare(
      'SELECT from_id, to_id, type, lag, nature FROM task_deps WHERE from_id IN ('
      + i36Created.map(() => '?').join(',') + ')').all(...i36Created);
    PASS('Section 36: SOP apply lands pending plan units + task rows + FS task_deps in one commit; approval flag only on the review step; gates green after the apply',
      i36W1.length === 4 && i36W1.every((w) => w.status === 'pending' && w.milestone_id === 'M7')
        && i36W1.filter((w) => w.approval === true).length === 1
        && i36W1.filter((w) => w.approval === true)[0].title === 'review'
        && i36TaskRows.length === 4 && i36TaskRows.every((r) => r.s === 'pending')
        && i36TaskRows.filter((r) => Number(r.a) === 1).length === 1
        && i36DepRows.length === 3
        && i36DepRows.every((d) => d.type === 'FS' && Number(d.lag) === 0 && d.nature === 'mandatory')
        && i36GateLog[0] && i36GateLog[0].ok,
      JSON.stringify({ units: i36W1.map((w) => w.id + ':' + w.title + ':' + w.status
        + (w.approval ? ':APPROVAL' : '')), tasks: i36TaskRows, deps: i36DepRows.length })
        + ' | ' + (i36GateLog[0] ? i36GateLog[0].al + ' | ' + i36GateLog[0].bl : 'no gate'));

    /* ---- Round-trip: [save W chain as SOP] then re-apply the same shape ---- */
    const i36Save = await api('POST', '/api/templates',
      { name: 'I36 RT chain', source_node: 'M7', as_sop: true });
    if (i36Save.status === 200 && i36Save.body && i36Save.body.id) {
      i36TplIds.push(String(i36Save.body.id));
    }
    const i36A2 = i36Save.status === 200
      ? await i36Apply('M7', i36Save.body.id) : { status: 0, body: null };
    const i36Plan2 = i36Read();
    const i36RtUnits = i36Plan2.work_units.filter(
      (w) => i36A2.body && (i36A2.body.added_work_units || []).indexOf(String(w.id)) >= 0);
    PASS('Section 36: save W chain as SOP + re-apply round-trip - same 4-step shape, approval still on step 3, 3 FS links, pending; gates green',
      i36Save.status === 200 && i36Save.body && i36Save.body.kind === 'sop'
        && i36Save.body.n_work_units === 4
        && i36A2.status === 200 && (i36A2.body.added_work_units || []).length === 4
        && (i36A2.body.added_deps || []).length === 3
        && JSON.stringify(i36A2.body.approval_steps) === JSON.stringify(['review'])
        && i36RtUnits.length === 4
        && JSON.stringify(i36RtUnits.map((w) => w.title)) ===
          JSON.stringify(['lint', 'test', 'review', 'merge'])
        && i36RtUnits.filter((w) => w.approval === true).length === 1
        && i36RtUnits.filter((w) => w.approval === true)[0].title === 'review'
        && i36GateLog[1] && i36GateLog[1].ok,
      JSON.stringify({ save: { kind: i36Save.body && i36Save.body.kind,
        n: i36Save.body && i36Save.body.n_work_units, id: i36Save.body && i36Save.body.id },
        apply: i36A2.body && i36A2.body.added_work_units,
        titles: i36RtUnits.map((w) => w.title) })
        + ' | ' + (i36GateLog[1] ? i36GateLog[1].al + ' | ' + i36GateLog[1].bl : 'no gate'));

    /* ---- A3: human path - modal [use] on the Research SOP ---- */
    await js(`(() => {
      const btn = document.querySelector('.ms-goal-row[data-kind=ms][data-node="M7"] .ms-tpl-btn');
      if (btn) btn.click();
      return !!btn;
    })()`);
    await sleep(500);
    await js(`(() => {
      const btn = document.querySelector('#modalSheet [data-tpl-apply="sop-research"]');
      if (btn) btn.click();
      return !!btn;
    })()`);
    await sleep(1100);
    const i36AfterModal = i36Read();
    /* The modal apply went through the browser path (not i36Apply), so its
       task/dep rows are collected from the plan delta: M7 research units not
       already tracked, then one gate run for this apply like every other. */
    i36AfterModal.work_units.forEach((w) => {
      if (String(w.milestone_id) === 'M7'
        && ['question', 'gather', 'verify', 'write-up'].indexOf(String(w.title)) >= 0
        && i36Created.indexOf(String(w.id)) < 0) {
        i36Created.push(String(w.id));
      }
    });
    const i36ResearchAll = i36AfterModal.work_units.filter(
      (w) => String(w.milestone_id) === 'M7'
        && ['question', 'gather', 'verify', 'write-up'].indexOf(String(w.title)) >= 0);
    i36GateLog.push(i36Gate());
    const i36A3 = await i36Apply('M7', 'sop-code-review');
    const i36A4 = await i36Apply('M7', 'sop-research');
    const i36A5 = await i36Apply('M7', 'sop-research');

    const i36GatesAllOk = i36GateLog.length === 6 && i36GateLog.every((g) => g.ok);
    PASS('Section 36: gates green after EVERY SOP apply (A1, round-trip, modal [use], three API applies - 6/6: prd-to-action 10/10 + plan-sync --check each time)',
      i36GatesAllOk && i36A3.status === 200 && i36A4.status === 200 && i36A5.status === 200
        && i36ResearchAll.length === 4,
      i36GateLog.map((g, i) => 'apply' + (i + 1) + ': ' + g.al + ' | ' + g.bl).join(' ;; ')
        + ' | modalResearchUnits=' + i36ResearchAll.length
        + ' | a3=' + i36A3.status + ' a4=' + i36A4.status + ' a5=' + i36A5.status);

    /* ---- APPROVAL badges: exactly the flagged steps (3 review / 3 verify) ---- */
    await js(`(async () => { await CP.refreshPlan(); return true; })()`);
    await sleep(350);
    const i36PlanBadges = await js(`(() => {
      const rows = Array.from(document.querySelectorAll('.ms-goal-row[data-kind=wu]'));
      const badged = rows.filter((r) => r.querySelector('.ms-approval'));
      return {
        total: rows.length,
        badged: badged.length,
        titles: badged.map((r) => (r.querySelector('.ms-a-title') || {}).textContent || ''),
        review: badged.filter((r) => ((r.querySelector('.ms-a-title') || {}).textContent || '')
          .indexOf('review') >= 0).length,
        verify: badged.filter((r) => ((r.querySelector('.ms-a-title') || {}).textContent || '')
          .indexOf('verify') >= 0).length,
      };
    })()`);
    await js(`document.querySelector('#nav [data-view="board"]').click()`);
    await sleep(300);
    /* The SOP applies went through fetch (not store.commit), so the board's
       task list is stale until one explicit reload - reload BEFORE measuring
       the cards (R29 re-activate lesson, applied to state as well as views). */
    await js(`(async () => { await CP.store.load(); return true; })()`);
    await sleep(450);
    const i36Cards = await js(`(() => {
      const cards = Array.from(document.querySelectorAll('.kb-card'));
      const badged = cards.filter((c) => {
        const el = c.querySelector('.kb-approval');
        return el && !el.hidden;
      });
      return {
        badged: badged.length,
        gates: badged.map((c) => {
          const g = c.querySelector('.kb-gate');
          return g ? g.textContent : '';
        }),
        titles: badged.map((c) => {
          const t = c.querySelector('.kb-title');
          return t ? t.textContent : '';
        }),
      };
    })()`);
    PASS('Section 36: APPROVAL badge on exactly the flagged steps (3 review / 3 verify) on the plan rows and the Work board cards; no other row/card carries it',
      i36PlanBadges.badged === 6 && i36PlanBadges.review === 3 && i36PlanBadges.verify === 3
        && i36PlanBadges.titles.every((t) => t.indexOf('review') >= 0 || t.indexOf('verify') >= 0)
        && i36Cards.badged === 6
        && i36Cards.titles.every((t) => t.indexOf('review') >= 0 || t.indexOf('verify') >= 0),
      JSON.stringify({ plan: i36PlanBadges, cards: { badged: i36Cards.badged,
        titles: i36Cards.titles } }));

    /* ---- Gate floor: approval cards never answer autonomous / n/a ---- */
    const i36Floor = await js(`(() => ({
      humanApproval: CP.gateFromScope(
        { owner_type: 'human', may_act_alone: 'all', needs_ack: 'n/a', never_automatic: 'n/a' },
        null, 0.7, true),
      humanPlain: CP.gateFromScope(
        { owner_type: 'human', may_act_alone: 'all', needs_ack: 'n/a', never_automatic: 'n/a' },
        null, 0.7, false),
      mainApproval: CP.gateFromScope(
        { owner_type: 'main', may_act_alone: 'plan', needs_ack: 'change', never_automatic: 'approve' },
        null, 0.7, true)
    }))()`);
    let i36FixGate = { found: false };
    if (i36Conn) {
      i36Fixture = 'w36f' + Math.random().toString(36).slice(2, 8);
      i36Conn.prepare(`INSERT INTO tasks(id,title,owner,owner_type,role,handoff,status,start,end,
        progress,placeholder,tier,billed,cost,sort,parent_id,approval)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(i36Fixture, 'I36 approval fixture', 'Fixture Human', 'human', '', 'provisioned by section 36',
          'pending', '2026-11-12T09:00', '2026-11-12T10:00', 0, 0, 'S', 0, 0, 9999, '', 1);
      await js(`(async () => { await CP.store.load(); return true; })()`);
      await sleep(450);
      i36FixGate = await js(`(() => {
        const card = document.querySelector('.kb-card[data-task-id="${i36Fixture}"]');
        if (!card) return { found: false };
        const g = card.querySelector('.kb-gate');
        const a = card.querySelector('.kb-approval');
        return { found: true, gate: g ? g.textContent : '', approval: !!(a && !a.hidden) };
      })()`);
    }
    PASS('Section 36: gate-floor proof - an approval card never shows autonomous or n/a (direct derivation + the human fixture card floored to needs-ack; SOP cards answer never-auto/needs-ack)',
      i36Floor.humanApproval === 'needs-ack' && i36Floor.humanPlain === 'autonomous'
        && i36Floor.mainApproval === 'never-auto'
        && i36Cards.gates.length === 6
        && i36Cards.gates.every((g) => g !== 'autonomous' && g !== 'n/a')
        && i36FixGate.found && i36FixGate.gate === 'needs-ack' && i36FixGate.approval === true,
      JSON.stringify({ direct: i36Floor, sopCardGates: i36Cards.gates, fixture: i36FixGate }));

    /* ---- Refusal: SOP apply on a goal is 400 with zero writes ---- */
    const i36BeforeRefusal = fs.readFileSync(i36PlanFile, 'utf8');
    const i36Refusal = await api('PUT', '/api/plan/structure',
      { kind: 'apply-template', target: 'G1', template_id: 'sop-research' });
    PASS('Section 36: SOP apply on a goal refuses 400 with zero writes (the chain lands on one milestone)',
      i36Refusal.status === 400
        && fs.readFileSync(i36PlanFile, 'utf8') === i36BeforeRefusal
        && !!(i36Refusal.body && i36Refusal.body.error),
      JSON.stringify({ status: i36Refusal.status, error: i36Refusal.body && i36Refusal.body.error }));

    /* ---- The six WBS templates still list and apply unchanged ---- */
    const i36WbsApply = await api('PUT', '/api/plan/structure',
      { kind: 'apply-template', target: 'G2', template_id: 'builtin-launch' });
    const i36WbsPlan = i36Read();
    const i36WbsNewM = (i36WbsApply.body && i36WbsApply.body.added_milestones) || [];
    const i36WbsNewW = (i36WbsApply.body && i36WbsApply.body.added_work_units) || [];
    const i36WbsUnits = i36WbsPlan.work_units.filter((w) => i36WbsNewW.indexOf(String(w.id)) >= 0);
    const i36List2 = await api('GET', '/api/templates');
    const i36Built2 = ((i36List2.body && i36List2.body.templates) || []).filter((t) => t.kind === 'builtin');
    PASS('Section 36: the six WBS templates still list and apply unchanged (exact provenance; builtin apply -> fresh M ids + todo/0 placeholders on the plan-only path, no SOP mode/deps)',
      i36Built2.length === 6 && i36Built2.every((t) => t.provenance === i36Prov)
        && i36WbsApply.status === 200 && i36WbsNewM.length === 3
        && !(i36WbsApply.body && i36WbsApply.body.mode)
        && !(i36WbsApply.body && i36WbsApply.body.added_deps)
        && i36WbsNewW.length === 6
        && i36WbsUnits.length === 6
        && i36WbsUnits.every((w) => w.status === 'todo' && Number(w.cost) === 0
          && Number(w.progress) === 0 && !w.approval),
      JSON.stringify({ builtins: i36Built2.length, added_milestones: i36WbsNewM,
        added_work_units: i36WbsNewW.length,
        statuses: i36WbsUnits.map((w) => w.status) }));
  } finally {
    fs.writeFileSync(i36PlanFile, i36PlanBak);
    fs.writeFileSync(i36MsFile, i36MsBak);
    fs.writeFileSync(i36PrdFile, i36PrdBak);
    if (i36Conn) {
      try {
        /* Row-level DML only - the panel.db trio is never file-copied. */
        const uniq = Array.from(new Set(i36Created));
        uniq.forEach((id) => {
          i36Conn.prepare('DELETE FROM tasks WHERE id=?').run(id);
          i36Conn.prepare('DELETE FROM task_deps WHERE from_id=? OR to_id=?').run(id, id);
        });
        if (i36Fixture) i36Conn.prepare('DELETE FROM tasks WHERE id=?').run(i36Fixture);
        i36TplIds.forEach((id) => {
          i36Conn.prepare('DELETE FROM wbs_templates WHERE id=?').run(id);
        });
      } catch (_e) { /* restore still runs */ }
      try { i36Conn.close(); } catch (_e) { /* already closed */ }
      i36Conn = null;
    }
    try {
      await js(`(() => {
        const layer = document.getElementById('modalLayer');
        if (layer && !layer.classList.contains('hidden')) {
          const close = document.querySelector('#modalSheet [data-action="close"]');
          if (close) close.click();
        }
        document.querySelector('#nav [data-view="plan"]').click();
        return true;
      })()`);
    } catch (_e) { /* page may be mid-navigation */ }
  }

  const i36PlanAfter = fs.readFileSync(i36PlanFile, 'utf8');
  const i36MsAfter = fs.readFileSync(i36MsFile, 'utf8');
  const i36PrdAfter = fs.readFileSync(i36PrdFile, 'utf8');
  PASS('Section 36 restored: plan / evidence / PRD bytes identical (finally block, row-level DML for SQLite)',
    i36PlanAfter === i36PlanBak && i36MsAfter === i36MsBak && i36PrdAfter === i36PrdBak,
    'plan=' + (i36PlanAfter === i36PlanBak) + ' evidence=' + (i36MsAfter === i36MsBak)
      + ' prd=' + (i36PrdAfter === i36PrdBak));

  await js(`(async () => { await CP.refreshPlan(); return true; })()`);
  await sleep(250);
  const i36EndGate = i36Gate();
  PASS('Gates green on the restored stores after section 36: prd-to-action 10/10 + plan-sync --check',
    i36EndGate.ok, i36EndGate.al + ' | ' + i36EndGate.bl);

  PASS('Section 36 added no JS exceptions or console errors',
    unexpectedErrors().length === i36Err,
    'unexpected=' + unexpectedErrors().length + ' (raw=' + errors.length
      + ', unexpectedBefore=' + i36Err
      + ', allowlisted=' + (errors.length - unexpectedErrors().length) + ')');

  /* 37. R35 / I-035 - ops stats: GET /api/stats pure derivation + the four
     Meter tiles above the token meter. READ-ONLY section: no fixture rows
     (nothing to restore); the derivation's zero-write claim is proven by
     row counts snapped around the two GET calls. Per-metric table+filter
     markers are asserted in db.js source (the lock's code-comment line);
     the demo JSON is pasted; two calls must be byte-identical (no
     timestamps); the empty-source n/a-not-0% rule is driven through the
     patchStats override seam (R28 CP-seam rule - no fetch stub, no writes);
     tile numbers cross-check against direct SQL on the same rows; the Meter
     view is re-activated with the tiles reset first so the nav-triggered
     repaint is what is measured. */
  const i37Err = unexpectedErrors().length;
  let i37Conn = null;
  try {
    i37Conn = new (require('node:sqlite').DatabaseSync)(path.join(dataDir(), 'panel.db'));
    const i37Counts = () => ({
      tasks: i37Conn.prepare('SELECT COUNT(*) AS n FROM tasks').get().n,
      acks: i37Conn.prepare('SELECT COUNT(*) AS n FROM acks').get().n,
      actions: i37Conn.prepare('SELECT COUNT(*) AS n FROM approval_actions').get().n,
      events: i37Conn.prepare('SELECT COUNT(*) AS n FROM desk_events').get().n,
    });
    const i37Before = i37Counts();
    const s1 = await api('GET', '/api/stats');
    const s2 = await api('GET', '/api/stats');
    const i37After = i37Counts();
    const b1 = s1.body || {};

    PASS('Section 37: the /api/stats JSON for the demo rows (paste)',
      s1.status === 200 && !!b1.approval_pass && !!b1.human_wait
        && !!b1.completion && Array.isArray(b1.member_load)
        && typeof b1.approval_pass.n === 'number' && typeof b1.approval_pass.m === 'number'
        && typeof b1.completion.n === 'number' && typeof b1.completion.m === 'number'
        && typeof b1.human_wait.decided === 'number',
      JSON.stringify(b1));

    PASS('Section 37: two GET /api/stats calls return byte-identical JSON and the derivation writes nothing (row counts unchanged across both calls)',
      s1.status === 200 && s2.status === 200
        && JSON.stringify(s1.body) === JSON.stringify(s2.body)
        && JSON.stringify(i37Before) === JSON.stringify(i37After),
      'identical=' + (JSON.stringify(s1.body) === JSON.stringify(s2.body))
        + ' countsBefore=' + JSON.stringify(i37Before)
        + ' countsAfter=' + JSON.stringify(i37After));

    /* Per-metric table + filter lines live in db.js's I-035 comment block;
       the scan asserts each metric still names its exact table + filter. */
    const i37Src = fs.readFileSync(path.join(OUT, 'db.js'), 'utf8');
    const i37Markers = [
      "1. approval pass  - table acks, filter decided rows (state <> 'ACK')",
      "2. human wait     - table acks, filter state <> 'ACK'",
      "3. completion     - table tasks, filter status = 'done'",
      "4. member load    - table tasks, filter status <> 'done'",
    ];
    PASS('Section 37: every metric names its table + filter in the db.js source comment (approval pass / human wait / completion / member load)',
      i37Markers.every((m) => i37Src.indexOf(m) >= 0),
      i37Markers.map((m) => (i37Src.indexOf(m) >= 0 ? 'hit' : 'MISS') + ':' + m).join(' | '));

    /* Empty-source rule: null pct/mean renders n/a, never 0%. Driven
       through the patchStats override seam with a synthetic empty payload
       (no nav click yet - the meter activation below owns the real repaint,
       so no fetch can race this render); then the real payload's null rules
       are asserted too. */
    const i37Empty = {
      approval_pass: { n: 0, m: 0, pct: null },
      human_wait: { decided: 0, mean_hours: null },
      completion: { n: 0, m: 0, pct: null },
      member_load: [],
    };
    await js(`CP.patchStats(${JSON.stringify(i37Empty)})`);
    await sleep(150);
    const i37EmptyDom = await js(`(() => ({
      approval: (document.getElementById('statApproval') || {}).textContent,
      wait: (document.getElementById('statWait') || {}).textContent,
      completion: (document.getElementById('statCompletion') || {}).textContent,
      load: (document.getElementById('statLoad') || {}).textContent
    }))()`);
    const i37RuleOk = (b1.approval_pass.m === 0 ? b1.approval_pass.pct === null : typeof b1.approval_pass.pct === 'number')
      && (b1.completion.m === 0 ? b1.completion.pct === null : typeof b1.completion.pct === 'number')
      && (b1.human_wait.decided === 0 ? b1.human_wait.mean_hours === null : typeof b1.human_wait.mean_hours === 'number');
    PASS('Section 37: an empty source renders n/a, not 0% (override seam drives all four tiles to n/a; live payload keeps null on empty and a number on non-empty)',
      i37EmptyDom.approval === 'n/a' && i37EmptyDom.wait === 'n/a'
        && i37EmptyDom.completion === 'n/a' && i37EmptyDom.load.trim() === 'n/a'
        && i37RuleOk
        && String(i37EmptyDom.approval).indexOf('0%') < 0
        && String(i37EmptyDom.wait).indexOf('0') < 0
        && String(i37EmptyDom.completion).indexOf('0%') < 0,
      JSON.stringify({ emptyDom: i37EmptyDom,
        live: { approval: b1.approval_pass, wait: b1.human_wait, completion: b1.completion } }));

    /* Cross-check every tile number against direct SQL (same table + filter).
       Approval pass = pass rate over acks decided asks (R35 fix addendum:
       n = IN_PROGRESS/DONE, m = state <> 'ACK'). */
    const i37Exp = {
      ap: i37Conn.prepare(
        "SELECT COUNT(*) AS m, COALESCE(SUM(CASE WHEN state IN ('IN_PROGRESS','DONE')"
        + " THEN 1 ELSE 0 END), 0) AS n FROM acks WHERE state <> 'ACK'").get(),
      comp: i37Conn.prepare(
        "SELECT COUNT(*) AS m, COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) AS n"
        + ' FROM tasks').get(),
      decided: i37Conn.prepare(
        "SELECT COUNT(*) AS n FROM acks WHERE state <> 'ACK'").get().n,
      load: i37Conn.prepare(
        "SELECT owner, COUNT(*) AS open FROM tasks WHERE status <> 'done'"
        + ' GROUP BY owner ORDER BY open DESC, owner ASC').all(),
    };
    const i37Pct = (n, m) => (m > 0 ? Math.round((n * 1000) / m) / 10 : null);
    const i37ExpLoad = i37Exp.load.map((r) => ({ owner: String(r.owner || ''), open: Number(r.open) }));
    PASS('Section 37: tile numbers match direct SQL on the same rows (approval pass = passed/decided asks from acks, completion done/all, member load open-per-owner desc, human wait decided count)',
      b1.approval_pass.n === Number(i37Exp.ap.n) && b1.approval_pass.m === Number(i37Exp.ap.m)
        && b1.approval_pass.pct === i37Pct(Number(i37Exp.ap.n), Number(i37Exp.ap.m))
        && b1.completion.n === Number(i37Exp.comp.n) && b1.completion.m === Number(i37Exp.comp.m)
        && b1.completion.pct === i37Pct(Number(i37Exp.comp.n), Number(i37Exp.comp.m))
        && b1.human_wait.decided === Number(i37Exp.decided)
        && (Number(i37Exp.decided) === 0
          ? b1.human_wait.mean_hours === null
          : typeof b1.human_wait.mean_hours === 'number')
        && JSON.stringify(b1.member_load) === JSON.stringify(i37ExpLoad),
      JSON.stringify({ api: { approval_pass: b1.approval_pass, completion: b1.completion,
        human_wait: b1.human_wait, member_load: b1.member_load },
        sql: { ap: i37Exp.ap, comp: i37Exp.comp, decided: i37Exp.decided, load: i37ExpLoad } }));

    /* DOM: reset the tiles, then activate the Meter so the nav-triggered
       repaint (app.ts initNav -> CP.patchStats) is what gets measured. */
    await js(`(() => {
      document.getElementById('statApproval').textContent = '-';
      document.getElementById('statWait').textContent = '-';
      document.getElementById('statCompletion').textContent = '-';
      document.getElementById('statLoad').innerHTML = '<span class="stat-empty">n/a</span>';
      return true;
    })()`);
    await js(`document.querySelector('#nav [data-view="meter"]').click()`);
    let i37Waited = '';
    for (let i = 0; i < 40; i += 1) {
      i37Waited = await js(`(document.getElementById('statApproval') || {}).textContent || ''`);
      if (i37Waited && i37Waited !== '-') break;
      await sleep(150);
    }
    const i37Dom = await js(`(() => {
      const tiles = document.getElementById('statsTiles');
      const view = document.getElementById('view-meter');
      const token = tiles ? tiles.nextElementSibling : null;
      const load = document.getElementById('statLoad');
      const rows = load ? Array.from(load.querySelectorAll('.load-row')) : [];
      const txt = (id) => (document.getElementById(id) || {}).textContent || '';
      return {
        inMeter: !!(tiles && view && tiles.parentElement === view),
        aboveToken: !!(token && (token.textContent || '').indexOf('Token meter') >= 0),
        tileCount: tiles ? tiles.querySelectorAll('.stat-tile').length : 0,
        approval: txt('statApproval'),
        wait: txt('statWait'),
        completion: txt('statCompletion'),
        loadRows: rows.length,
        loadFirst: rows[0]
          ? ((rows[0].querySelector('.load-owner') || {}).textContent || '') + ':'
            + ((rows[0].querySelector('.load-n') || {}).textContent || '')
          : '',
        loadOrder: rows.map((r) => Number((r.querySelector('.load-n') || {}).textContent)),
      };
    })()`);
    const i37WaitText = b1.human_wait.mean_hours !== null && b1.human_wait.mean_hours !== undefined
      ? b1.human_wait.mean_hours + ' h' : 'n/a';
    const i37ApprovalText = b1.approval_pass.m > 0 && b1.approval_pass.pct !== null
      ? b1.approval_pass.n + '/' + b1.approval_pass.m + ' (' + b1.approval_pass.pct + '%)'
      : 'n/a';
    const i37CompletionText = b1.completion.m > 0 && b1.completion.pct !== null
      ? b1.completion.n + '/' + b1.completion.m + ' (' + b1.completion.pct + '%)'
      : 'n/a';
    const i37Desc = i37Dom.loadOrder.every((v, i, a) => i === 0 || a[i - 1] >= v);
    const i37First = b1.member_load.length
      ? b1.member_load[0].owner + ':' + b1.member_load[0].open : '';
    PASS('Section 37: Meter page shows the four tiles above the token meter (nav-triggered repaint); member-load bars descend by open count and match the payload',
      i37Dom.inMeter && i37Dom.aboveToken && i37Dom.tileCount === 4
        && i37Dom.approval === i37ApprovalText
        && i37Dom.wait === i37WaitText
        && i37Dom.completion === i37CompletionText
        && (b1.member_load.length === 0
          ? i37Dom.loadRows === 0
          : i37Dom.loadRows > 0 && i37Dom.loadRows <= 8 && i37Desc
            && i37Dom.loadFirst === i37First),
      JSON.stringify({ dom: i37Dom, want: { approval: i37ApprovalText, wait: i37WaitText,
        completion: i37CompletionText, first: i37First } }));

    /* Zero-write close-out: the same three counts, taken again after every
       stats read and both renders. */
    const i37Final = i37Counts();
    PASS('Section 37 left the source rows untouched (tasks / acks / approval_actions / desk_events counts unchanged across the whole section)',
      JSON.stringify(i37Final) === JSON.stringify(i37Before),
      'before=' + JSON.stringify(i37Before) + ' after=' + JSON.stringify(i37Final));
  } finally {
    if (i37Conn) {
      try { i37Conn.close(); } catch (_e) { /* already closed */ }
      i37Conn = null;
    }
    /* Re-paint with the REAL payload so the battery leaves live numbers on
       the tiles (the override seam left the synthetic empty state). */
    try { await js(`CP.patchStats()`); } catch (_e) { /* page may be mid-navigation */ }
  }

  PASS('Section 37 added no JS exceptions or console errors',
    unexpectedErrors().length === i37Err,
    'unexpected=' + unexpectedErrors().length + ' (raw=' + errors.length
      + ', unexpectedBefore=' + i37Err
      + ', allowlisted=' + (errors.length - unexpectedErrors().length) + ')');

  PASS('No JS exceptions / console errors at runtime (expected structure-400 refusals allowlisted)',
    unexpectedErrors().length === 0,
    unexpectedErrors().join(' | ') || ('0 unexpected; allowlisted expected 400s='
      + (errors.length - unexpectedErrors().length)));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nResult: ${results.length - failed}/${results.length} passed; screenshots preview-desk.png / preview-plan.png / preview-ledger.png / preview-dark.png`);
  ws.close();
  process.exit(failed ? 1 : 0);
}

function CPDiff(a, b) {
  const pa = new Date(String(a).replace('T', ' '));
  const pb = new Date(String(b).replace('T', ' '));
  return Math.round((pa - pb) / 3600000);
}

main().catch((e) => { console.error('Verification failed: ', e); process.exit(2); });
