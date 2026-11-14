"use strict";
var CP;
(function (CP) {
    let layer;
    let sheet;
    let toastEl;
    let toastTimer = 0;
    let newColColor = CP.PALETTE[2];
    let modalOpen = false;
    let editingId = null;
    function byId(id) {
        const el = document.getElementById(id);
        if (!el)
            throw new Error('missing ' + id);
        return el;
    }
    function toast(text) {
        toastEl.textContent = text;
        toastEl.classList.add('show');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
    }
    CP.toast = toast;
    function paintSelection(scroll) {
        const id = CP.store.selected;
        document.querySelectorAll('[data-task-id]').forEach((el) => {
            el.classList.toggle('is-selected', !!id && el.dataset.taskId === id);
        });
        if (scroll && id) {
            const bar = document.querySelector(`.gbar[data-task-id="${id}"]`);
            if (bar)
                bar.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            const card = document.querySelector(`.kb-card[data-task-id="${id}"]`);
            if (card)
                card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }
    CP.paintSelection = paintSelection;
    function closeModal() { layer.classList.add('hidden'); modalOpen = false; editingId = null; }
    function openModal(html) {
        sheet.innerHTML = html;
        layer.classList.remove('hidden');
        modalOpen = true;
    }
    /** I-031: the goal tree opens the WBS template library through the same
     *  modal plumbing (Esc, backdrop click and data-action="close" included). */
    function openPanelModal(html) { openModal(html); }
    CP.openPanelModal = openPanelModal;
    function closePanelModal() { closeModal(); }
    CP.closePanelModal = closePanelModal;
    function swatches(active, colId) {
        return CP.PALETTE.map((c) => `<button type="button" class="swatch${c === active ? ' active' : ''}"
      style="background:${c}" data-color="${c}"${colId ? ` data-col="${colId}"` : ''}></button>`).join('');
    }
    function openColumnManager() {
        const s = CP.store.state;
        if (!s)
            return;
        const rows = s.columns.map((c, i) => `<div class="col-row">
      <div class="col-line1"><span class="cdot" style="background:${c.color}"></span>
        <input class="cname" data-col-name="${c.id}" value="${CP.esc(c.label)}" maxlength="20">
        <button type="button" class="mini" data-move="${c.id}" data-dir="-1"${i === 0 ? ' disabled' : ''}>&lt;</button>
        <button type="button" class="mini" data-move="${c.id}" data-dir="1"${i === s.columns.length - 1 ? ' disabled' : ''}>&gt;</button>
        <button type="button" class="mini danger" data-delcol="${c.id}"${s.columns.length <= 1 ? ' disabled' : ''}>x</button>
      </div><div class="swatches">${swatches(c.color, c.id)}</div></div>`).join('');
        openModal(`<h3>Status column settings</h3><p class="modal-sub">Statuses live in SQLite, not hardcoded in the UI. Deleting a column moves its tasks into the first column.</p>
      ${rows}<div class="col-add"><input id="newColName" maxlength="20" placeholder="New status name">
      <div class="swatches" id="newSw">${swatches(newColColor)}</div>
      <button type="button" class="btn btn-primary" data-action="add-col">Add</button></div>
      <div class="modal-actions"><button type="button" class="btn btn-primary" data-action="close">Done</button></div>`);
    }
    CP.openColumnManager = openColumnManager;
    function openTaskModal(id) {
        const s = CP.store.state;
        if (!s)
            return;
        const t = id ? s.tasks.filter((x) => x.id === id)[0] : undefined;
        editingId = t ? t.id : null;
        const opt = (v, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${CP.ownerLabel(v)}</option>`;
        const statusOpts = s.columns.map((c) => `<option value="${c.id}"${t && t.status === c.id ? ' selected' : ''}>${CP.esc(c.label)}</option>`).join('');
        /* R22: parent choice. The task itself and everything below it are
           excluded - either choice would close a loop in the tree. */
        const parentOpts = ['<option value="">(none - root)</option>'].concat(s.tasks
            .filter((x) => !(t && (x.id === t.id || CP.hasAncestor(s.tasks, x.id, t.id))))
            .map((x) => `<option value="${x.id}"${t && t.parent_id === x.id ? ' selected' : ''}>${CP.esc(x.title)} (${x.id})</option>`)).join('');
        const now = CP.fmt(new Date());
        openModal(`<h3>${t ? 'Edit work unit' : 'New work unit'}</h3>
      <p class="modal-sub">Times snap to the hour; the cost label always precedes the name.</p>
      <form id="taskForm"><div class="form-grid">
        <div class="field wide"><label>Task</label><input id="fTitle" required maxlength="60" value="${t ? CP.esc(t.title) : ''}"></div>
        <div class="field"><label>Owner</label><input id="fOwner" value="${t ? CP.esc(t.owner) : 'Unassigned'}"></div>
        <div class="field"><label>Owner type</label><select id="fOwnerType">${Object.keys(CP.OWNER_TYPES).map((k) => opt(k, t ? t.owner_type : 'main')).join('')}</select></div>
        <div class="field"><label>Role</label><input id="fRole" value="${t ? CP.esc(t.role) : ''}"></div>
        <div class="field"><label>Status column</label><select id="fStatus">${statusOpts}</select></div>
        <div class="field"><label>Part of (parent)</label><select id="fParent">${parentOpts}</select></div>
        <div class="field wide"><label>Handoff note</label><input id="fHandoff" value="${t ? CP.esc(t.handoff) : ''}"></div>
        <div class="field"><label>Start (hour)</label><input id="fStart" type="datetime-local" value="${t ? t.start : now}"></div>
        <div class="field"><label>End (hour)</label><input id="fEnd" type="datetime-local" value="${t ? t.end : CP.addHours(now, 12)}"></div>
        <div class="field"><label>billed (M tokens)</label><input id="fBilled" type="number" step="0.1" value="${t ? t.billed / 1e6 : 0}"></div>
        <div class="field"><label>cost ($)</label><input id="fCost" type="number" step="0.01" value="${t ? t.cost : 0}"></div>
        <div class="field"><label>token tier</label><select id="fTier">${['S', 'M', 'L', 'XL'].map((x) => `<option${t && t.tier === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label>Placeholder (non-commitment)</label><select id="fPlaceholder"><option value="0"${!t || !t.placeholder ? ' selected' : ''}>No</option><option value="1"${t && t.placeholder ? ' selected' : ''}>Yes</option></select></div>
      </div><div class="modal-actions">
        ${t ? '<button type="button" class="btn btn-danger" data-action="delete-task">Delete</button>' : ''}
        <button type="button" class="btn" data-action="close">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button></div></form>`);
    }
    CP.openTaskModal = openTaskModal;
    function openCharterModal() {
        const s = CP.store.state;
        if (!s)
            return;
        const m = s.meta || {};
        const val = (k) => CP.esc(CP.stripCJK(String(m[k] || '')));
        openModal(`<h3>Project charter</h3>
      <p class="modal-sub">First-principles framing shown on the Command desk. It lives in SQLite, so every fork states its own. The values originate from the ingested milestone plan. The Evaluation field states the method, never a live score.</p>
      <form id="charterForm"><div class="form-grid">
        <div class="field wide"><label>Purpose - why this project exists</label>
          <textarea id="cPurpose" rows="3" placeholder="Loaded from the milestone plan">${val('project_purpose')}</textarea></div>
        <div class="field wide"><label>Technical resources - what it runs on</label>
          <textarea id="cResources" rows="3" placeholder="Loaded from the milestone plan">${val('project_resources')}</textarea></div>
        <div class="field wide"><label>Evaluation - how it is judged, by PDCA iteration</label>
          <textarea id="cEval" rows="3" placeholder="Loaded from the milestone plan">${val('project_evaluation')}</textarea></div>
      </div><div class="modal-actions">
        <button type="button" class="btn" data-action="close">Cancel</button>
        <button type="submit" class="btn btn-primary">Save charter</button></div></form>`);
    }
    CP.openCharterModal = openCharterModal;
    /** First-principles charter: three labelled fields plus the sidebar purpose.
     *  Every value arrives through /api/state (seeded from the plan file by the
     *  service); nothing is hardcoded here and text is kept CJK-free. */
    function patchCharter() {
        const s = CP.store.state;
        if (!s)
            return;
        const m = s.meta || {};
        const put = (id, key) => {
            byId(id).textContent = CP.stripCJK(String(m[key] || '')).trim();
        };
        put('charterPurpose', 'project_purpose');
        put('charterResources', 'project_resources');
        put('charterEval', 'project_evaluation');
        byId('sidePurpose').textContent = CP.stripCJK(String(m.project_purpose || '')).trim();
        byId('sideCharter').textContent = CP.stripCJK(String(m.project_side_purpose || '')).trim();
    }
    /** Sidebar work-division roster plus a measured spend glance. No live counts
     *  on any label; the figures below are measured, not tallied by the UI. */
    function patchSidebar() {
        const s = CP.store.state;
        if (!s)
            return;
        byId('sideCost').textContent = `$${Number(s.totals.cost).toFixed(2)}`;
        byId('sideTokens').textContent = `${(s.totals.billed / 1e6).toFixed(1)}M billed`;
        const byType = {};
        s.tasks.forEach((t) => {
            const k = t.owner_type || 'main';
            if (!byType[k])
                byType[k] = { cost: 0, owners: [] };
            byType[k].cost += Number(t.cost) || 0;
            const name = (t.owner || '').trim();
            if (name && byType[k].owners.indexOf(name) < 0)
                byType[k].owners.push(name);
        });
        const rows = Object.keys(CP.OWNER_TYPES).map((k) => {
            const g = byType[k] || { cost: 0, owners: [] };
            const names = g.owners.length ? CP.esc(g.owners.join(', ')) : 'none';
            return `<li class="roster-row" data-type="${k}">
        <span class="roster-dot"></span>
        <span class="roster-name">${CP.ownerLabel(k)}</span>
        <span class="roster-cost">$${g.cost.toFixed(2)}</span>
        <span class="roster-owners">${names}</span></li>`;
        }).join('');
        byId('ownerRoster').innerHTML = rows;
    }
    function onModalClick(e) {
        const t = e.target;
        const a = t.dataset.action;
        if (a === 'close') {
            closeModal();
            return;
        }
        if (a === 'delete-task' && editingId) {
            void CP.store.commit('DELETE', `/api/tasks/${encodeURIComponent(editingId)}`, undefined, 'Work unit deleted');
            closeModal();
            return;
        }
        if (a === 'add-col') {
            const input = document.getElementById('newColName');
            const label = input ? input.value.trim() : '';
            if (!label) {
                toast('Name the new status first');
                if (input)
                    input.focus();
                return;
            }
            void CP.store.commit('POST', '/api/columns', { label, color: newColColor }, `Status column "${label}" added`).then(openColumnManager);
            return;
        }
        const sw = t.closest('.swatch');
        if (sw) {
            const color = sw.dataset.color || CP.PALETTE[0];
            if (sw.dataset.col) {
                void CP.store.commit('PUT', `/api/columns/${encodeURIComponent(sw.dataset.col)}`, { color }, 'Status color updated').then(openColumnManager);
            }
            else {
                newColColor = color;
                const box = document.getElementById('newSw');
                if (box)
                    box.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x.dataset.color === color));
            }
            return;
        }
        const mv = t.closest('[data-move]');
        if (mv && mv.dataset.move) {
            void CP.store.commit('POST', `/api/columns/${encodeURIComponent(mv.dataset.move)}/move`, { dir: Number(mv.dataset.dir) }, 'Status order updated').then(openColumnManager);
            return;
        }
        const del = t.closest('[data-delcol]');
        if (del && del.dataset.delcol) {
            void CP.store.commit('DELETE', `/api/columns/${encodeURIComponent(del.dataset.delcol)}`, undefined, 'Status column deleted').then(openColumnManager);
        }
    }
    function onModalChange(e) {
        const t = e.target;
        if (t.dataset.colName) {
            void CP.store.commit('PUT', `/api/columns/${encodeURIComponent(t.dataset.colName)}`, { label: t.value.trim() || 'Untitled' }, 'Status name updated');
        }
    }
    function onSubmit(e) {
        const formId = e.target.id;
        if (formId === 'charterForm') {
            e.preventDefault();
            const v = (id) => document.getElementById(id).value;
            void CP.store.commit('PUT', '/api/meta', {
                project_purpose: v('cPurpose').trim(),
                project_resources: v('cResources').trim(),
                project_evaluation: v('cEval').trim(),
            }, 'Project charter saved').then(() => closeModal());
            return;
        }
        if (formId !== 'taskForm')
            return;
        e.preventDefault();
        const v = (id) => document.getElementById(id).value;
        const patch = {
            title: v('fTitle').trim(), owner: v('fOwner'), owner_type: v('fOwnerType'),
            role: v('fRole'), handoff: v('fHandoff'), status: v('fStatus'),
            start: v('fStart'), end: v('fEnd'),
            billed: Number(v('fBilled')) * 1e6, cost: Number(v('fCost')),
            tier: v('fTier'), placeholder: Number(v('fPlaceholder')),
            parent_id: v('fParent'),
        };
        if (!patch.title)
            return;
        void CP.store.commit(editingId ? 'PUT' : 'POST', editingId ? `/api/tasks/${encodeURIComponent(editingId)}` : '/api/tasks', patch, editingId ? 'Work unit updated' : 'Work unit created');
        closeModal();
    }
    /** I-025: the First-principles block belongs to the Command desk alone.
     *  Every other view hides it; the charter modal stays reachable from the
     *  desk's Edit button while the block is on screen. */
    function syncCharterView(view) {
        const charter = document.getElementById('charter');
        if (charter)
            charter.hidden = view !== 'desk';
    }
    function initNav() {
        const first = document.querySelector('#nav button.active');
        syncCharterView(first && first.dataset.view ? first.dataset.view : 'desk');
        byId('nav').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-view]');
            if (!b)
                return;
            byId('nav').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
            document.querySelectorAll('.view').forEach((v) => {
                v.classList.toggle('active', v.id === 'view-' + b.dataset.view);
            });
            syncCharterView(b.dataset.view || 'desk');
            /* I-035: entering the Meter re-derives the ops stats tiles (GET
               /api/stats is a pure read; two calls are identical by contract). */
            if (b.dataset.view === 'meter')
                void CP.patchStats();
            /* Setting scrollLeft on a hidden view does nothing; reposition to NOW
               after switching to the Work board - the hour axis lives there now
               (R32 / I-037 moved it out of the Plan pagination). */
            if (b.dataset.view === 'board') {
                window.requestAnimationFrame(() => CP.scrollGanttToNow());
            }
        });
    }
    function initFilters() {
        byId('globalSearch').addEventListener('input', (e) => {
            CP.store.query = e.target.value;
            CP.store.emit();
        });
        byId('ownerFilter').addEventListener('change', (e) => {
            CP.store.ownerFilter = e.target.value;
            CP.store.emit();
        });
        byId('btnAddTask').addEventListener('click', () => openTaskModal());
        byId('btnColumns').addEventListener('click', () => openColumnManager());
        byId('btnRefresh').addEventListener('click', () => { void CP.store.load().then(() => toast('Reloaded from SQLite')); });
        /* R20: freeze the plan window as the baseline, and dim the non-critical. */
        byId('btnBaseline').addEventListener('click', () => {
            void CP.store.call('POST', '/api/baseline', {})
                .then((r) => CP.store.load().then(() => toast(`Baseline frozen (${r.snapshotted ?? 0} units)`)))
                .catch((e) => toast('Baseline failed: ' + String(e)));
        });
        byId('btnCritical').addEventListener('click', (e) => {
            const b = e.currentTarget;
            const on = !b.classList.contains('active');
            b.classList.toggle('active', on);
            CP.setCriticalView(on);
        });
    }
    /** Persist a small chrome preference; storage may be blocked in private
     *  mode, in which case the UI still works for the current session. */
    function saveChrome(key, val) {
        try {
            localStorage.setItem(key, val);
        }
        catch (_e) { /* storage blocked */ }
    }
    function loadChrome(key) {
        try {
            return localStorage.getItem(key);
        }
        catch (_e) {
            return null;
        }
    }
    function initSidebar() {
        byId('btnCharterEdit').addEventListener('click', () => openCharterModal());
        /* I-022: the first-principles block is folded by default; one toggle. */
        const fold = byId('btnCharterFold');
        const charter = document.getElementById('charter');
        const syncCharter = (open) => {
            if (!charter)
                return;
            charter.classList.toggle('collapsed', !open);
            fold.textContent = open ? 'Fold' : 'Unfold';
            saveChrome('cp.charter-open', open ? '1' : '0');
        };
        syncCharter(loadChrome('cp.charter-open') === '1');
        fold.addEventListener('click', () => syncCharter(!charter || charter.classList.contains('collapsed')));
        /* I-022: the sidebar keeps its collapsed state across reloads. */
        const collapseBtn = byId('btnCollapse');
        const sideCollapsed = loadChrome('cp.side-collapsed') === '1';
        if (sideCollapsed)
            document.body.classList.add('side-collapsed');
        collapseBtn.setAttribute('aria-expanded', sideCollapsed ? 'false' : 'true');
        collapseBtn.addEventListener('click', () => {
            const on = document.body.classList.toggle('side-collapsed');
            collapseBtn.setAttribute('aria-expanded', on ? 'false' : 'true');
            saveChrome('cp.side-collapsed', on ? '1' : '0');
        });
        /* I-022: drag the right edge to resize. The width is a state value kept
           in --side-w; the stylesheet derives the flex-basis from it. */
        const grip = byId('sideResize');
        const root = document.documentElement;
        const savedW = loadChrome('cp.side-w');
        if (savedW)
            root.style.setProperty('--side-w', savedW);
        let x0 = 0;
        let w0 = 0;
        let active = false;
        grip.addEventListener('pointerdown', (e) => {
            active = true;
            x0 = e.clientX;
            w0 = byId('sidebar').getBoundingClientRect().width;
            try {
                grip.setPointerCapture(e.pointerId);
            }
            catch (_err) { /* synthetic pointer */ }
            document.body.classList.add('is-dragging');
            e.preventDefault();
        });
        grip.addEventListener('pointermove', (e) => {
            if (!active)
                return;
            root.style.setProperty('--side-w', Math.max(180, Math.min(420, w0 + e.clientX - x0)) + 'px');
        });
        const gripEnd = () => {
            if (!active)
                return;
            active = false;
            document.body.classList.remove('is-dragging');
            const cur = root.style.getPropertyValue('--side-w');
            if (cur)
                saveChrome('cp.side-w', cur);
        };
        grip.addEventListener('pointerup', gripEnd);
        grip.addEventListener('pointercancel', gripEnd);
    }
    /** I-027: the plan page paginated between Milestone plan and Hour axis.
     *  R32 / I-037 moved the hour axis to the Work board, so the tab bar and
     *  cp.plan-tab are retired; the Plan page shows the goal tree full-page. */
    /** R36 / I-039: the Work board is a two-tab view - [Work board] kanban and
     *  [Hour axis] flat work units - one dataset, one pinned tab bar styled as
     *  the Command desk sheet tablist. The active tab persists in cp.wb-tab
     *  (default board). The I-037 split and the I-037 hover cross-highlight
     *  retire; navigation is explicit (a card's `-> hour axis` control jumps to
     *  the bar, a bar click jumps back to the card). */
    function wbTab(tab) {
        const board = document.getElementById('wbBoardTab');
        const axis = document.getElementById('ganttPanel');
        const bar = document.getElementById('wbTabs');
        if (!board || !axis || !bar)
            return;
        const active = tab === 'axis' ? 'axis' : 'board';
        board.hidden = active !== 'board';
        axis.hidden = active !== 'axis';
        bar.querySelectorAll('[data-wb-tab]').forEach((b) => {
            const on = b.getAttribute('data-wb-tab') === active;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        saveChrome('cp.wb-tab', active);
        /* R36: the hour axis keeps its byte-identical auto-scroll to NOW - the
           scroll is a no-op while the pane is hidden, so re-apply on activation. */
        if (active === 'axis')
            CP.scrollGanttToNow();
    }
    function switchWbTab(tab) { wbTab(tab); }
    CP.switchWbTab = switchWbTab;
    function initWorkBoard() {
        const bar = document.getElementById('wbTabs');
        if (!bar)
            return;
        bar.addEventListener('click', (e) => {
            const b = e.target.closest('[data-wb-tab]');
            if (b)
                wbTab(b.getAttribute('data-wb-tab') || 'board');
        });
        wbTab(loadChrome('cp.wb-tab') || 'board');
    }
    /** I-023: the Settings page. Theme and glass take effect now; the port is
     *  read at server boot, so the page records the wish and prints the exact
     *  restart command instead of pretending to hot-swap. */
    function initSettings() {
        const applyTheme = (mode) => {
            const root = document.documentElement;
            if (mode === 'auto')
                root.removeAttribute('data-theme');
            else
                root.setAttribute('data-theme', mode);
            saveChrome('cp.theme', mode);
            document.querySelectorAll('#setTheme [data-theme-val]').forEach((b) => {
                b.classList.toggle('active', b.getAttribute('data-theme-val') === mode);
            });
        };
        applyTheme(loadChrome('cp.theme') || 'auto');
        byId('setTheme').addEventListener('click', (e) => {
            const b = e.target.closest('button[data-theme-val]');
            if (b && b.dataset.themeVal)
                applyTheme(b.dataset.themeVal);
        });
        const portIn = byId('setPort');
        const portNote = byId('setPortNote');
        fetch('/healthz').then((r) => r.json())
            .then((h) => { if (h && h.port)
            portIn.value = String(h.port); })
            .catch(() => { });
        byId('setPortSave').addEventListener('click', () => {
            const n = Number(portIn.value);
            if (!Number.isInteger(n) || n < 1024 || n > 65535) {
                portNote.textContent = 'Port must be 1024..65535';
                return;
            }
            portNote.textContent = 'Restart with PANEL_PORT=' + n + ' node server.js';
            saveChrome('cp.port-pref', String(n));
        });
        const glass = byId('setGlass');
        const glassOut = byId('setGlassOut');
        const setGlass = (v) => {
            document.documentElement.style.setProperty('--glass-alpha', String(v / 100));
            glassOut.textContent = v + '%';
            saveChrome('cp.glass-alpha', String(v / 100));
        };
        const gv = loadChrome('cp.glass-alpha');
        setGlass(gv ? Math.round(Number(gv) * 100) : 80);
        glass.value = gv ? String(Math.round(Number(gv) * 100)) : '80';
        glass.addEventListener('input', () => setGlass(Number(glass.value)));
        /* I-033: the confidence gate. Persisted in cp.conf-threshold (default
           0.7); board.ts reads it on every card patch, so saving here re-paints
           the badges immediately. */
        const confIn = byId('setConfGate');
        const confNote = byId('setConfGateNote');
        const applyConf = (raw, persist) => {
            const n = Number(raw);
            const ok = raw !== '' && Number.isFinite(n) && n >= 0 && n <= 1;
            if (persist && ok)
                saveChrome('cp.conf-threshold', String(n));
            confNote.textContent = ok
                ? `cards below ${n.toFixed(2)} show needs-ack`
                : 'enter a number from 0 to 1';
            CP.patchBoard();
        };
        confIn.value = loadChrome('cp.conf-threshold') || '0.7';
        applyConf(confIn.value, false);
        confIn.addEventListener('change', () => applyConf(confIn.value, true));
        byId('setReset').addEventListener('click', () => {
            ['cp.side-w', 'cp.side-collapsed', 'cp.charter-open']
                .forEach((k) => { try {
                localStorage.removeItem(k);
            }
            catch (_e) { /* storage blocked */ } });
            CP.reload();
        });
    }
    /** Reload seam. window.location.* is non-writable (LegacyUnforgeable), so a
     *  test cannot stub it in place; tests replace CP.reload instead (R28
     *  re-check correction: the old window.location stub silently no-oped and
     *  the reset click really reloaded the page mid-suite). */
    function reload() { window.location.reload(); }
    CP.reload = reload;
    function initKeys() {
        document.addEventListener('keydown', (e) => {
            const el = e.target;
            const typing = !!el && typeof el.matches === 'function' && el.matches('input, textarea, select');
            if (e.key === 'Escape') {
                if (modalOpen)
                    closeModal();
                else
                    CP.select(null, false);
            }
            if (typing || modalOpen)
                return;
            if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && CP.store.selected) {
                const t = CP.taskById(CP.store.selected);
                if (!t)
                    return;
                e.preventDefault();
                const h = e.key === 'ArrowLeft' ? -1 : 1;
                const start = CP.addHours(t.start, h);
                const end = CP.addHours(t.end, h);
                CP.store.optimistic((s) => { const x = s.tasks.filter((z) => z.id === t.id)[0]; if (x) {
                    x.start = start;
                    x.end = end;
                } });
                void CP.store.commit('PUT', `/api/tasks/${encodeURIComponent(t.id)}`, { start, end }, `Time moved ${h} hour(s)`);
            }
        });
    }
    async function init() {
        layer = byId('modalLayer');
        sheet = byId('modalSheet');
        toastEl = byId('toast');
        CP.initGantt();
        CP.initBoard();
        CP.initDesk();
        CP.initLedger();
        CP.initMilestones();
        CP.store.subscribe(paintSelectionFalse);
        CP.store.subscribe(patchCharter);
        CP.store.subscribe(patchSidebar);
        initNav();
        initFilters();
        initSidebar();
        initWorkBoard();
        initSettings();
        initKeys();
        layer.addEventListener('click', (e) => { if (e.target === layer)
            closeModal(); });
        sheet.addEventListener('click', onModalClick);
        sheet.addEventListener('change', onModalChange);
        sheet.addEventListener('submit', onSubmit);
        await CP.store.load();
    }
    function paintSelectionFalse() { paintSelection(false); }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => { void init(); });
    else
        void init();
})(CP || (CP = {}));
