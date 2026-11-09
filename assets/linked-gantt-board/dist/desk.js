"use strict";
/*!
 * BACKGROUND: Command desk surface - the per-unit sheets (Command console /
 * Notifications / Command ACKs / Human decisions), the command snapshot loop,
 * ACK rows, and the per-sheet queryable History backed by GET /api/events.
 * CONDITIONS: classic scripts (namespace CP, no ESM); the active sheet lives in
 * localStorage('desk.sheet'); history rows read /api/events and never throw on
 * a 404/400 (they show "History unavailable."); sheet content keeps rendering
 * while hidden; the policy tables mount point (#view-desk) stays outside the
 * sheets so #c9PolicyTables is always visible; labels are English ASCII and
 * carry no dynamic counts.
 * VERSION: 2.0.0 - per-unit desk sheets + queryable history (I-019)
 */
var CP;
(function (CP) {
    let forceClipboardFail = false;
    function setClipboardFail(v) { forceClipboardFail = v; }
    CP.setClipboardFail = setClipboardFail;
    function byId(id) {
        const el = document.getElementById(id);
        if (!el)
            throw new Error('missing ' + id);
        return el;
    }
    async function copyText(text) {
        if (!forceClipboardFail && navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                window.__copyPath = 'navigator';
                return 'navigator';
            }
            catch (_e) { /* fall through */ }
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        window.__copyPath = ok ? 'execCommand' : 'failed';
        return ok ? 'execCommand' : 'failed';
    }
    CP.copyText = copyText;
    const SHEET_UNITS = {
        console: 'command', inbox: 'job', acks: 'ack', signals: 'signal',
    };
    /** localStorage key holding the active sheet name. */
    const SHEET_KEY = 'desk.sheet';
    function isSheetName(v) {
        return !!v && Object.prototype.hasOwnProperty.call(SHEET_UNITS, v);
    }
    function activeSheet() {
        const el = document.querySelector('#deskTabs .desk-tab.active');
        const n = el ? el.dataset.sheet : null;
        return isSheetName(n) ? n : 'console';
    }
    /** Activate one sheet (invalid names fall back to console), persist the
     *  choice, and refresh that sheet's history so it opens on fresh rows. */
    function setSheet(name) {
        const n = isSheetName(name) ? name : 'console';
        document.querySelectorAll('#view-desk .desk-sheet').forEach((s) => {
            s.classList.toggle('active', s.id === 'sheet-' + n);
        });
        document.querySelectorAll('#deskTabs .desk-tab').forEach((t) => {
            const on = t.dataset.sheet === n;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        try {
            localStorage.setItem(SHEET_KEY, n);
        }
        catch (_e) { /* storage blocked: in-memory only */ }
        void refreshHistory(SHEET_UNITS[n]);
    }
    function debounce(fn, ms) {
        let t = 0;
        return () => { window.clearTimeout(t); t = window.setTimeout(fn, ms); };
    }
    /** One history row: ts | kind | detail. Status rows carry a single message
     *  (never a count) for the empty and unavailable states. */
    function historyStatusRow(msg) {
        const tr = document.createElement('tr');
        tr.className = 'hist-row hist-status';
        const td = document.createElement('td');
        td.colSpan = 3;
        td.textContent = msg;
        tr.appendChild(td);
        return tr;
    }
    function historyRow(ev) {
        const tr = document.createElement('tr');
        tr.className = 'hist-row';
        const ts = document.createElement('td');
        ts.className = 'hist-ts';
        const time = document.createElement('time');
        time.textContent = ev.ts;
        ts.appendChild(time);
        const kind = document.createElement('td');
        const chip = document.createElement('span');
        chip.className = 'hist-kind';
        chip.textContent = ev.kind;
        kind.appendChild(chip);
        const detail = document.createElement('td');
        detail.className = 'hist-detail';
        detail.textContent = ev.detail;
        tr.appendChild(ts);
        tr.appendChild(kind);
        tr.appendChild(detail);
        return tr;
    }
    function renderHistory(body, rows) {
        body.textContent = '';
        if (rows === null) {
            body.appendChild(historyStatusRow('History unavailable.'));
            return;
        }
        if (!rows.length) {
            body.appendChild(historyStatusRow('No events yet.'));
            return;
        }
        rows.forEach((ev) => { body.appendChild(historyRow(ev)); });
    }
    /** Fetch one unit's history. Any failure (404/400/network) renders
     *  "History unavailable." instead of throwing. */
    async function refreshHistory(unit) {
        const body = document.getElementById('histBody-' + unit);
        if (!body)
            return;
        const filterEl = document.getElementById('histFilter-' + unit);
        const q = filterEl ? filterEl.value.trim() : '';
        const path = '/api/events?unit=' + unit + '&limit=100' + (q ? '&q=' + encodeURIComponent(q) : '');
        try {
            const r = await CP.store.call('GET', path);
            renderHistory(body, (r && r.events) || []);
        }
        catch (_e) {
            renderHistory(body, null);
        }
    }
    function noticeCreate(n) {
        void n;
        const el = document.createElement('div');
        el.className = 'notice';
        el.innerHTML = `<span class="notice-dot"></span><div><strong></strong><p></p></div><time></time>`;
        return el;
    }
    function noticeUpdate(el, n) {
        el.className = 'notice' + (n.level === 'warn' ? ' warn' : '') + (n.read ? ' read' : '');
        el.querySelector('strong').textContent = n.title;
        el.querySelector('p').textContent = n.body;
        el.querySelector('time').textContent = n.ts;
    }
    function jobCreate(j) {
        void j;
        const el = document.createElement('tr');
        el.innerHTML = `<td></td><td></td><td></td><td></td>`;
        return el;
    }
    function jobUpdate(el, j) {
        const cells = el.querySelectorAll('td');
        cells[0].textContent = j.job_name;
        cells[1].textContent = j.last_run;
        cells[2].textContent = j.ok ? 'PASS' : 'FAIL';
        cells[2].className = j.ok ? 'ok' : 'bad';
        cells[3].textContent = j.summary;
    }
    function ackCreate(a) {
        void a;
        const el = document.createElement('li');
        el.className = 'ack-row';
        el.innerHTML = `<span class="ack-hash"></span><span class="ack-cmd"></span>
      <span class="ack-state"></span>
      <input class="ack-reason" type="text" placeholder="Reason (required to reject)">
      <button type="button" class="btn mini" data-ack="approve">Approve</button>
      <button type="button" class="btn mini danger" data-ack="reject">Reject</button>
      <time class="ack-created"></time>`;
        el.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-ack]');
            if (!b || !el.dataset.key)
                return;
            const id = el.dataset.key;
            if (b.dataset.ack === 'approve') {
                void CP.store.commit('PUT', `/api/acks/${encodeURIComponent(id)}`, { action: 'approve' }, 'ACK approved');
            }
            else {
                const input = el.querySelector('.ack-reason');
                const reason = input.value.trim();
                if (!reason) {
                    CP.toast('Reject requires a reason');
                    input.focus();
                    return;
                }
                void CP.store.commit('PUT', `/api/acks/${encodeURIComponent(id)}`, { action: 'reject', reason }, 'ACK rejected');
            }
        });
        return el;
    }
    function ackUpdate(el, a) {
        el.dataset.key = a.id;
        el.querySelector('.ack-hash').textContent = (a.snapshot_hash || '').slice(0, 10);
        el.querySelector('.ack-cmd').textContent = (a.command || '(no command)').slice(0, 64);
        const st = el.querySelector('.ack-state');
        st.textContent = a.state;
        st.className = 'ack-state st-' + a.state;
        const closed = a.state !== 'ACK';
        el.querySelector('[data-ack=approve]').disabled = closed;
        el.querySelector('[data-ack=reject]').disabled = closed;
        if (a.state === 'REJECTED' && a.reject_reason) {
            el.querySelector('.ack-reason').value = a.reject_reason;
        }
        el.querySelector('.ack-created').textContent = a.created || '';
    }
    /** Compact, deterministic ASCII hash so an ACK row can reference the copied snapshot. */
    function hashText(s) {
        let h = 5381;
        for (let i = 0; i < s.length; i += 1)
            h = ((h << 5) + h + s.charCodeAt(i)) | 0;
        return 'h' + (h >>> 0).toString(16);
    }
    /** S2: copying a snapshot creates an ACK row (ACK state) in SQLite. */
    async function createAckForSnapshot(text) {
        const hash = hashText(text);
        const command = (CP.store.state && CP.store.state.meta.next_command) || '';
        try {
            const created = await CP.store.call('POST', '/api/acks', { snapshot_hash: hash, command });
            if (CP.store.state) {
                CP.store.state.acks = [created].concat(CP.store.state.acks || []);
                CP.store.emit();
            }
        }
        catch (e) {
            CP.toast('ACK create failed: ' + String(e));
        }
    }
    CP.createAckForSnapshot = createAckForSnapshot;
    function patchDesk() {
        const s = CP.store.state;
        if (!s)
            return;
        const real = s.tasks.filter((t) => !t.placeholder);
        let span = 0;
        if (real.length) {
            const starts = real.map((t) => CP.parse(t.start).getTime());
            const ends = real.map((t) => CP.parse(t.end).getTime());
            span = (Math.max(...ends) - Math.min(...starts)) / 3600000;
        }
        byId('kpiSpan').textContent = `${span.toFixed(0)} h`;
        byId('kpiTokens').textContent = `${(s.totals.billed / 1e6).toFixed(1)}M`;
        byId('kpiCost').textContent = `$${Number(s.totals.cost).toFixed(2)}`;
        byId('kpiRounds').textContent = String(s.totals.n);
        byId('deskDataLine').textContent = `Work units ${s.tasks.length} | columns ${s.columns.length} | issues ${s.issues.length} | notices ${s.notifications.length}`;
        byId('demoBanner').classList.toggle('hidden', !(s.DEMO || s.demo));
        const cmd = byId('nextCommand');
        if (document.activeElement !== cmd)
            cmd.value = s.meta.next_command || '';
        CP.reconcile(byId('noticeList'), s.notifications, (n) => n.ts, noticeCreate, noticeUpdate);
        CP.reconcile(byId('jobBody'), s.jobs, (j) => j.job_name, jobCreate, jobUpdate);
        CP.reconcile(byId('ackList'), s.acks || [], (a) => a.id, ackCreate, ackUpdate);
    }
    CP.patchDesk = patchDesk;
    async function snapshot() {
        const r = await CP.store.call('POST', '/api/snapshot');
        return r.text;
    }
    /**
     * One send action for every surface that carries a reply: build the command
     * snapshot, copy it, open the ACK row that references it. The Issue ledger
     * calls this so a human can send from where they typed instead of walking to
     * the Command desk tab.
     */
    async function sendSnapshot() {
        const text = await snapshot();
        const path = await copyText(text);
        await createAckForSnapshot(text);
        return { text, path };
    }
    CP.sendSnapshot = sendSnapshot;
    /** Build the snapshot without copying it, for a read-only preview. */
    async function buildSnapshot() {
        return snapshot();
    }
    CP.buildSnapshot = buildSnapshot;
    /** C9 B1/B6: mount the two policy reference tables into the existing desk
     *  view. The compiled dist/policy.js comes from the main session's tsc build;
     *  load it on demand so this works with or without a static script tag, and
     *  never throw if it is absent (the policy UI is additive). */
    function initPolicyTables() {
        const mount = () => {
            if (typeof CP.mountPolicyTables === 'function')
                void CP.mountPolicyTables('view-desk');
        };
        if (typeof CP.mountPolicyTables === 'function') {
            mount();
            return;
        }
        const script = document.createElement('script');
        script.src = './dist/policy.js';
        script.onload = mount;
        script.onerror = () => { };
        document.head.appendChild(script);
    }
    CP.initPolicyTables = initPolicyTables;
    function initDesk() {
        const cmd = byId('nextCommand');
        cmd.addEventListener('change', () => {
            void CP.store.commit('PUT', '/api/command', { text: cmd.value }, 'Next command saved');
        });
        cmd.addEventListener('blur', () => {
            if (cmd.value !== (CP.store.state && CP.store.state.meta.next_command)) {
                void CP.store.commit('PUT', '/api/command', { text: cmd.value }, 'Next command saved');
            }
        });
        byId('btnSend').addEventListener('click', async () => {
            const { text, path } = await sendSnapshot();
            byId('snapshotOut').textContent = text;
            CP.toast(path === 'failed' ? 'Snapshot generated, copy failed (copy manually)' : `Command snapshot copied (${path})`);
        });
        byId('btnGenerate').addEventListener('click', async () => {
            byId('snapshotOut').textContent = await snapshot();
            CP.toast('Snapshot generated, not copied');
        });
        /* I-019 sheets: tab clicks, per-sheet history controls, and a debounced
           refresh of the ACTIVE sheet's history on every store change so rows are
           fresh after actions. Content rendering (patchDesk / renderSignals) stays
           visibility-independent. */
        byId('deskTabs').addEventListener('click', (e) => {
            const b = e.target.closest('.desk-tab');
            if (b && b.dataset.sheet)
                setSheet(b.dataset.sheet);
        });
        Object.keys(SHEET_UNITS).forEach((name) => {
            const unit = SHEET_UNITS[name];
            const filter = document.getElementById('histFilter-' + unit);
            const refresh = document.getElementById('histRefresh-' + unit);
            if (filter)
                filter.addEventListener('input', debounce(() => { void refreshHistory(unit); }, 250));
            if (refresh)
                refresh.addEventListener('click', () => { void refreshHistory(unit); });
        });
        CP.store.subscribe(debounce(() => { void refreshHistory(SHEET_UNITS[activeSheet()]); }, 500));
        CP.store.subscribe(patchDesk);
        patchDesk();
        initPolicyTables();
        /* Restore the active sheet (default console; invalid values fall back). */
        let saved = 'console';
        try {
            saved = localStorage.getItem(SHEET_KEY) || 'console';
        }
        catch (_e) {
            saved = 'console';
        }
        setSheet(isSheetName(saved) ? saved : 'console');
    }
    CP.initDesk = initDesk;
})(CP || (CP = {}));
