"use strict";
var CP;
(function (CP) {
    let activeFilter = 'all';
    let query = '';
    /** I-028c: the ledger table the runtime owns. panel.html ships a static
     *  placeholder thead; this list rebuilds it (columns + drag grips) on init. */
    const ISSUE_COLS = [
        { id: 'id', label: 'ID' },
        { id: 'source', label: 'Source' },
        { id: 'title', label: 'Title / detail' },
        { id: 'evidence', label: 'Evidence' },
        { id: 'enddate', label: 'ENDDATE' },
        { id: 'urgent', label: 'Urgent' },
        { id: 'status', label: 'Status' },
    ];
    /** localStorage key -> JSON { colId: px } map of drag-resized widths. */
    const ISSUE_COLS_KEY = 'cp.issue-cols';
    const ISSUE_COL_MIN = 48;
    const ISSUE_COL_DEFAULTS = {
        id: 76, source: 150, title: 300, evidence: 170, enddate: 120, urgent: 70, status: 92,
    };
    function byId(id) {
        const el = document.getElementById(id);
        if (!el)
            throw new Error('missing ' + id);
        return el;
    }
    function issueVisible(i) {
        const q = query.trim().toLowerCase();
        if (q && `${i.id} ${i.source} ${i.title} ${i.detail}`.toLowerCase().indexOf(q) < 0)
            return false;
        const h = CP.hoursUntil(i.enddate);
        if (activeFilter === 'open')
            return i.status !== 'done';
        if (activeFilter === 'overdue')
            return i.status !== 'done' && h < 0;
        if (activeFilter === 'urgent')
            return !!i.urgent && i.status !== 'done';
        if (activeFilter === 'done')
            return i.status === 'done';
        return true;
    }
    /* ---- I-028c: runtime table head + drag-resizable columns --------------- */
    function loadIssueCols() {
        try {
            const raw = localStorage.getItem(ISSUE_COLS_KEY);
            const m = raw ? JSON.parse(raw) : {};
            return m && typeof m === 'object' ? m : {};
        }
        catch (_e) {
            return {};
        }
    }
    function saveIssueCols(widths) {
        try {
            localStorage.setItem(ISSUE_COLS_KEY, JSON.stringify(widths));
        }
        catch (_e) { /* private mode: widths apply for this session only */ }
    }
    /** Apply stored (or default) px widths to every header cell. */
    function applyIssueCols(table) {
        const widths = loadIssueCols();
        table.querySelectorAll('thead th[data-col]').forEach((th) => {
            const col = th.dataset.col || '';
            const w = Number(widths[col]);
            const px = Number.isFinite(w) && w >= ISSUE_COL_MIN
                ? Math.round(w)
                : (ISSUE_COL_DEFAULTS[col] || 120);
            th.style.width = px + 'px';
        });
    }
    /** Rebuild the whole thead (7 columns + resize grips) and fix the layout. */
    function rebuildIssueHead(table) {
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        ISSUE_COLS.forEach((c) => {
            const th = document.createElement('th');
            th.dataset.col = c.id;
            th.textContent = c.label;
            const grip = document.createElement('span');
            grip.className = 'icgrip';
            grip.title = 'Drag to resize';
            th.appendChild(grip);
            tr.appendChild(th);
        });
        thead.appendChild(tr);
        const old = table.querySelector('thead');
        if (old)
            table.replaceChild(thead, old);
        else
            table.insertBefore(thead, table.firstChild);
        /* Fixed layout makes the th px widths authoritative; auto layout would
           re-derive them from content and ignore the stored map. */
        table.style.tableLayout = 'fixed';
        applyIssueCols(table);
    }
    /** Grip drag: live width on the th, one localStorage write on mouseup. */
    function initIssueResize(table) {
        table.addEventListener('mousedown', (e) => {
            const grip = e.target.closest('.icgrip');
            if (!grip)
                return;
            const th = grip.parentElement;
            if (!th || !th.dataset.col)
                return;
            e.preventDefault();
            const colId = th.dataset.col;
            const startX = e.clientX;
            const startW = th.getBoundingClientRect().width;
            const widths = loadIssueCols();
            const onMove = (ev) => {
                const w = Math.max(ISSUE_COL_MIN, Math.round(startW + (ev.clientX - startX)));
                th.style.width = w + 'px';
                widths[colId] = w;
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                saveIssueCols(widths);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }
    /* ---- issue rows -------------------------------------------------------- */
    function issueCreate(i) {
        const tr = document.createElement('tr');
        tr.className = 'issue-row';
        tr.innerHTML = `<td class="iid"></td><td class="isrc"></td>
      <td class="ititle"><strong></strong><small></small><span class="badge-overdue">OVERDUE</span><span class="badge-soon">&lt;=48h</span></td>
      <td class="iev"><span class="iev-list"></span></td>
      <td><input class="iend" type="date"></td>
      <td class="center"><input class="iurgent" type="checkbox"></td>
      <td><select class="istatus"><option value="open">open</option><option value="done">done</option></select></td>
      <td class="iexpand" colspan="7">
        <div class="iexpand-strip">
          <textarea class="ireply" rows="1" placeholder="Reply..."></textarea>
          <div class="ireply-actions">
            <button type="button" class="btn mini send isend">Send</button>
            <span class="isaved"></span>
          </div>
        </div>
        <div class="iexpand-full" style="display:none">
          <div class="iexpand-detail"></div>
          <div class="iexpand-line"><span class="iexpand-label">Evidence:</span> <span class="iev-full"></span></div>
          <div class="iexpand-line"><span class="iexpand-label">Updated:</span> <span class="iupdated"></span></div>
          <div class="iexpand-edit">
            <textarea class="ireply" rows="2" placeholder="Reply..."></textarea>
            <div class="ireply-actions">
              <button type="button" class="btn mini send isend">Send</button>
              <span class="isaved"></span>
            </div>
          </div>
        </div>
      </td>`;
        const save = (patch) => {
            void CP.store.commit('PUT', `/api/issues/${encodeURIComponent(i.id)}`, patch, `${i.id} saved`);
        };
        tr.querySelectorAll('.ireply').forEach((reply) => {
            reply.addEventListener('change', () => save({ reply: reply.value }));
        });
        const end = tr.querySelector('.iend');
        const urgent = tr.querySelector('.iurgent');
        const status = tr.querySelector('.istatus');
        end.addEventListener('change', () => save({ enddate: end.value }));
        urgent.addEventListener('change', () => save({ urgent: urgent.checked ? 1 : 0 }));
        status.addEventListener('change', () => save({ status: status.value }));
        /* Send where you type: each Send persists the reply in its OWN block
           (collapsed strip or expanded editor), then runs the one send chain
           (snapshot -> clipboard -> ACK row) so nothing is lost if the copy fails. */
        tr.querySelectorAll('.isend').forEach((send) => {
            send.addEventListener('click', async () => {
                const box = send.closest('.iexpand-strip, .iexpand-edit');
                const ta = box ? box.querySelector('.ireply') : null;
                if (!ta)
                    return;
                send.disabled = true;
                try {
                    await CP.store.commit('PUT', `/api/issues/${encodeURIComponent(i.id)}`, { reply: ta.value }, `${i.id} reply saved`);
                    const { path } = await CP.sendSnapshot();
                    CP.toast(path === 'failed'
                        ? `${i.id} reply saved. Snapshot copy failed. Copy it from the Command desk.`
                        : `${i.id} reply saved. Command snapshot copied (${path}).`);
                }
                finally {
                    send.disabled = false;
                }
            });
        });
        return tr;
    }
    function issueUpdate(tr, i) {
        const ex = i;
        tr.dataset.key = i.id;
        const h = CP.hoursUntil(i.enddate);
        const overdue = i.status !== 'done' && h < 0;
        const soon = i.status !== 'done' && h >= 0 && h <= 48;
        /* className is reassigned every patch, so the open state rides along. */
        const open = tr.classList.contains('is-open');
        tr.className = 'issue-row' + (overdue ? ' overdue' : '') + (soon ? ' soon' : '')
            + (i.urgent ? ' urgent' : '') + (i.status === 'done' ? ' done' : '')
            + (open ? ' is-open' : '');
        tr.querySelector('.iid').textContent = i.id;
        tr.querySelector('.isrc').textContent = i.source;
        tr.querySelector('.ititle strong').textContent = i.title;
        tr.querySelector('.ititle small').textContent = i.detail;
        const ev = Array.isArray(ex.evidence) ? ex.evidence : [];
        tr.querySelector('.iev-list').textContent = ev.length ? ev.join(', ') : '-';
        tr.querySelector('.iev-full').textContent = ev.length ? ev.join(', ') : '(none)';
        tr.querySelector('.iexpand-detail').textContent = i.detail || '(no detail)';
        tr.querySelector('.iupdated').textContent = ex.updated || ex.opened || '-';
        tr.querySelectorAll('.ireply').forEach((reply) => {
            if (document.activeElement !== reply)
                reply.value = i.reply;
        });
        const end = tr.querySelector('.iend');
        const urgent = tr.querySelector('.iurgent');
        const status = tr.querySelector('.istatus');
        if (document.activeElement !== end)
            end.value = i.enddate;
        urgent.checked = !!i.urgent;
        status.value = i.status;
        /* Honest save state per editor block: say "not saved yet" only while that
           box holds text the store does not have. A blank label means nothing. */
        tr.querySelectorAll('.isaved').forEach((saved) => {
            const block = saved.parentElement && saved.parentElement.parentElement;
            const ta = block ? block.querySelector('.ireply') : null;
            const dirty = !!ta && ta.value !== i.reply;
            saved.textContent = dirty ? 'not saved yet' : (i.reply.trim() ? 'saved' : '');
            saved.className = 'isaved' + (dirty ? ' dirty' : '');
        });
    }
    function roundCreate(r) {
        void r;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td></td><td></td><td></td><td></td><td></td><td></td>`;
        return tr;
    }
    function roundUpdate(tr, r) {
        const c = tr.querySelectorAll('td');
        c[0].textContent = r.id;
        c[1].textContent = r.name;
        c[2].textContent = `${r.start} -> ${r.end}`;
        c[3].textContent = `${(r.billed / 1e6).toFixed(1)}M`;
        c[4].textContent = `${(r.fresh / 1e6).toFixed(1)}M`;
        c[5].textContent = `$${Number(r.cost).toFixed(2)}`;
        tr.className = r.outcome === 'FAIL' ? 'fail' : '';
    }
    function patchLedger() {
        const s = CP.store.state;
        if (!s)
            return;
        const rows = s.issues.filter(issueVisible);
        CP.reconcile(byId('issueBody'), rows, (i) => i.id, issueCreate, issueUpdate);
        byId('issueEmpty').classList.toggle('hidden', rows.length > 0);
        CP.reconcile(byId('roundBody'), s.rounds, (r) => r.id, roundCreate, roundUpdate);
        byId('roundTotal').textContent = `Total ${s.rounds.length} rounds | billed ${(s.totals.billed / 1e6).toFixed(1)}M | fresh ${(s.totals.fresh / 1e6).toFixed(1)}M | $${Number(s.totals.cost).toFixed(2)}`;
    }
    CP.patchLedger = patchLedger;
    function initLedger() {
        /* I-028c: own the rendered table - rebuild the thead, wire the resize
           grips and the click-to-expand rows (panel.html's static header is a
           placeholder this code replaces at runtime). */
        const table = document.querySelector('.issue-table');
        if (table) {
            rebuildIssueHead(table);
            initIssueResize(table);
            table.addEventListener('click', (e) => {
                const t = e.target;
                if (t.closest('input, select, textarea, button, .icgrip'))
                    return;
                const tr = t.closest('tr.issue-row');
                if (!tr)
                    return;
                const open = tr.classList.toggle('is-open');
                /* Inline flip keeps the expand/collapse working even before the
                   stylesheet block lands; CSS only styles the open state. */
                const full = tr.querySelector('.iexpand-full');
                const strip = tr.querySelector('.iexpand-strip');
                if (full)
                    full.style.display = open ? 'block' : 'none';
                if (strip)
                    strip.style.display = open ? 'none' : 'flex';
            });
        }
        byId('issueQuery').addEventListener('input', (e) => {
            query = e.target.value;
            patchLedger();
        });
        byId('issueChips').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-filter]');
            if (!b)
                return;
            activeFilter = b.dataset.filter || 'all';
            byId('issueChips').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
            patchLedger();
        });
        /* The ledger foot is the bulk send: it runs the same chain as the per-row
           Send, so a human never has to leave this tab to deliver a reply. */
        byId('btnLedgerSend').addEventListener('click', async () => {
            const btn = byId('btnLedgerSend');
            btn.disabled = true;
            try {
                const { text, path } = await CP.sendSnapshot();
                byId('ledgerSnapOut').textContent = text;
                CP.toast(path === 'failed'
                    ? 'Snapshot generated. Copy failed. Read it below and copy it manually.'
                    : `Command snapshot copied (${path}).`);
            }
            finally {
                btn.disabled = false;
            }
        });
        byId('btnLedgerGen').addEventListener('click', async () => {
            byId('ledgerSnapOut').textContent = await CP.buildSnapshot();
            CP.toast('Snapshot generated, not copied');
        });
        CP.store.subscribe(patchLedger);
        patchLedger();
    }
    CP.initLedger = initLedger;
})(CP || (CP = {}));
