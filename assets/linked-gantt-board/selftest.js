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
 * VERSION: 2.0.0 - English localization, env PANEL_PORT/CDP_PORT, >=30
 * assertions covering ACK flow / approve / done / reject-with-reason /
 * rejections.json / error-code visibility / blocking signals / DEMO flag /
 * /healthz / backup / restore / degraded declaration / three-state labels /
 * no-CJK-in-UI, plus all original cases.
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

  /* 2. Hour axis / cost-first / placeholders / lanes */
  await js(`document.querySelector('[data-view=plan]').click()`);
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
  PASS('Plan view auto-scrolls to NOW, time bars in viewport',
    axis.scrollLeft > 100 && axis.visibleBars > 0, `scrollLeft=${axis.scrollLeft} visibleBars=${axis.visibleBars}`);

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

  /* Restore honest DEMO placeholder text so the shipped screenshots never
     carry test strings. The text says what it is, so it invents no fact. */
  await api('PUT', '/api/meta', {
    project_purpose: 'Demo charter. Edit to state why your project exists.',
    project_resources: 'Demo charter. Edit to list what your project runs on.',
    project_evaluation: 'Demo charter. Edit to state how your project is judged, by PDCA iteration.',
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
  await js(`document.querySelector('[data-view="plan"]').click()`);
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
      return {
        x1: dr.left + dr.width / 2, y1: dr.top + dr.height / 2,
        x2: tr.left + (${JSON.stringify(toSide)} === 'left' ? 4 : tr.width - 4),
        y2: tr.top + tr.height / 2
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
    'stored=' + JSON.stringify(stored) + ' xy=' + JSON.stringify(linkResults.map((r) => r.geo && r.geo.x1 !== undefined ? [Math.round(r.geo.x1), Math.round(r.geo.y1), Math.round(r.geo.x2), Math.round(r.geo.y2)] : r.geo)) + ' mid=' + JSON.stringify(linkResults.map((r) => r.mid)));

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
    return { x, y, hitId: hit ? hit.taskId : ((under && under.className) || 'none') };
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
    + ' | deps=' + beforeBump.deps + ' | toast=' + String(afterBump.toast).slice(0, 40));

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

  /* Depth display: both surfaces show the hierarchy, not just a parent id. */
  await js(`CP.store.query = 'R22'; CP.store.emit();`);
  await js(`document.querySelector('[data-view="plan"]').click()`);
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

  /* 23. Screenshots + runtime error gate */
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

  PASS('No JS exceptions / console errors at runtime', errors.length === 0, errors.join(' | ') || '0 errors');
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
