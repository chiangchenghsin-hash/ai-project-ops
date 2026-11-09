"use strict";
/*!
 * BACKGROUND: Work-division kanban (drag, shared order, multi-select) and the
 * S2 blocking-signal computation surfaced on the Command desk. I-019 adds a
 * session-level signal diff logger so the Human decisions sheet's History
 * records raise / clear transitions through POST /api/events.
 * CONDITIONS: classic scripts (namespace CP, no ESM); signal history records
 * transitions observed while a session is open; signals are computed live from
 * tasks/issues/deps. Logging is fire-and-forget and must never break rendering.
 * Each signal carries a stable key (kind + entity id) that the transition
 * logger diffs on, so mutable detail text never drives raise/clear.
 * VERSION: 2.0.0 - per-unit desk sheets + queryable history (I-019);
 * 2.0.1 - stable signal keys (kind + entity id) so hour-counter drift cannot fabricate raise/clear pairs
 */
var CP;
(function (CP) {
    let root = null;
    let draggingId = null;
    let dropTarget = null;
    let line = null;
    let suppressClick = false;
    /** C9 / B5: the board's multi-selection set (separate from single select). */
    let multi = new Set();
    /** Shared-order rank per task id, rebuilt on every board patch. */
    let boardOrderIndex = {};
    /** S2 blocking signal: fixed stuck threshold N=24 hours (documented, not tunable). */
    CP.STUCK_HOURS = 24;
    /**
     * S2 BLOCKING SIGNALS (computed here in board.ts):
     *  - stuck > 24h            : unfinished non-placeholder work open longer than N=24h
     *  - dependency unfinished  : module with an unresolved upstream dependency (indeg > 0)
     *  - urgent + overdue       : open issue flagged urgent whose end date has passed
     * These are surfaced as a plain "Needs human decision" text list in the desk view,
     * with no decorative widgets (no charts, gauges or badges).
     */
    function blockingSignals() {
        const s = CP.store.state;
        if (!s)
            return [];
        const out = [];
        const now = new Date();
        s.tasks.filter((t) => t.status !== 'done' && !t.placeholder).forEach((t) => {
            const hrs = (now.getTime() - CP.parse(t.start).getTime()) / 3600000;
            if (hrs > CP.STUCK_HOURS) {
                out.push({ kind: 'stuck', key: `stuck:${t.id}`, label: 'Stuck > 24h', detail: `${t.id} ${t.title} (open ${hrs.toFixed(0)}h, threshold N=24)` });
            }
        });
        const deps = s.deps || { nodes: [], edges: [] };
        (deps.nodes || []).filter((n) => n.indeg > 0).forEach((n) => {
            out.push({ kind: 'dependency', key: `dependency:${n.name}`, label: 'Dependency unfinished', detail: `${n.name} has ${n.indeg} unresolved upstream dependency edge(s)` });
        });
        s.issues.filter((i) => i.status !== 'done' && i.urgent && CP.hoursUntil(i.enddate) < 0).forEach((i) => {
            out.push({ kind: 'urgent_overdue', key: `urgent_overdue:${i.id}`, label: 'Urgent + overdue', detail: `${i.id} ${i.title} (due ${i.enddate})` });
        });
        return out;
    }
    CP.blockingSignals = blockingSignals;
    /**
     * I-019 signal history: signal history records transitions observed while a
     * session is open; signals are computed live from tasks/issues/deps.
     * `lastSigKeys` holds the last observed key set for this session. The FIRST
     * render that sees loaded state seeds it silently (no POST), so a reload
     * never writes duplicate raise rows for signals that were already up. Later
     * renders diff the key sets: a key appearing posts kind 'raise', a key
     * vanishing posts kind 'clear', both fire-and-forget so rendering can never
     * break on a history write. Posts happen only when the key sets differ.
     * The diff identity is `s.key` (kind + entity id), never the display text,
     * so the drifting stuck-hour counter cannot fabricate raise/clear pairs;
     * the POSTed detail payload stays the human-readable label + ': ' + detail.
     */
    let lastSigKeys = null;
    /** Last observed label + ': ' + detail per key, so a clear row still carries
     *  the human-readable text (task id included) of the signal that went away. */
    let lastSigText = {};
    function logSignalTransitions(signals) {
        const keys = signals.map((s) => s.key);
        const text = {};
        signals.forEach((s) => { text[s.key] = s.label + ': ' + s.detail; });
        if (lastSigKeys === null) {
            lastSigKeys = keys;
            lastSigText = text;
            return;
        }
        const prev = new Set(lastSigKeys);
        const cur = new Set(keys);
        const raised = keys.filter((k) => !prev.has(k));
        const cleared = lastSigKeys.filter((k) => !cur.has(k));
        if (!raised.length && !cleared.length) {
            lastSigText = text;
            return;
        }
        raised.forEach((k) => {
            void CP.store.call('POST', '/api/events', { unit: 'signal', kind: 'raise', detail: text[k] })
                .catch(() => { });
        });
        cleared.forEach((k) => {
            void CP.store.call('POST', '/api/events', { unit: 'signal', kind: 'clear', detail: lastSigText[k] })
                .catch(() => { });
        });
        lastSigKeys = keys;
        lastSigText = text;
    }
    function renderSignals() {
        const list = document.getElementById('signalList');
        const signals = blockingSignals();
        /* Seed/diff only once state exists: the pre-load call computes an empty
           set that must not be mistaken for the session baseline. */
        if (CP.store.state)
            logSignalTransitions(signals);
        if (!list)
            return;
        list.textContent = '';
        if (!signals.length) {
            const li = document.createElement('li');
            li.className = 'signal-empty';
            li.textContent = 'No blocking signals.';
            list.appendChild(li);
            return;
        }
        signals.forEach((sig) => {
            const li = document.createElement('li');
            li.className = 'signal-item sig-' + sig.kind;
            const strong = document.createElement('strong');
            strong.textContent = sig.label + ': ';
            const span = document.createElement('span');
            span.textContent = sig.detail;
            li.appendChild(strong);
            li.appendChild(span);
            list.appendChild(li);
        });
    }
    CP.renderSignals = renderSignals;
    function cardCreate(t) {
        void t;
        const el = document.createElement('article');
        el.className = 'kb-card';
        el.setAttribute('draggable', 'true');
        el.innerHTML = `<div class="kb-card-top"><span class="kb-owner-chip"></span><span class="kb-parent"></span><span class="kb-owner"></span></div>
      <h4 class="kb-title"></h4><div class="kb-role"></div>
      <div class="kb-cost"></div><div class="kb-handoff"></div>
      <div class="kb-window"></div>`;
        return el;
    }
    function cardUpdate(el, t) {
        const col = CP.columnById(t.status);
        el.dataset.taskId = t.id;
        el.dataset.key = t.id;
        el.className = 'kb-card' + (CP.store.selected === t.id ? ' is-selected' : '')
            + (multi.has(t.id) ? ' is-multi-selected' : '')
            + (t.placeholder ? ' is-placeholder' : '');
        if (boardOrderIndex[t.id] !== undefined)
            el.dataset.order = String(boardOrderIndex[t.id]);
        el.style.borderLeftColor = col.color;
        const chip = el.querySelector('.kb-owner-chip');
        chip.textContent = CP.ownerLabel(t.owner_type);
        chip.style.color = col.color;
        chip.style.background = CP.rgba(col.color, .12);
        /* R20: show which work unit this one belongs to. Empty for a root. */
        const par = el.querySelector('.kb-parent');
        par.textContent = t.parent_id ? 'in ' + t.parent_id : '';
        par.style.display = t.parent_id ? '' : 'none';
        /* R22: the tree is visible as an indent. Depth lives in its own custom
           property so the stylesheet derives the indent from it. */
        const depth = CP.taskDepth(CP.store.state ? CP.store.state.tasks : [], t.id);
        el.dataset.depth = String(depth);
        el.style.setProperty('--depth', String(depth));
        el.querySelector('.kb-owner').textContent = t.owner;
        el.querySelector('.kb-title').textContent = t.title;
        el.querySelector('.kb-role').textContent = t.role;
        el.querySelector('.kb-cost').textContent = t.placeholder ? `placeholder | ${t.tier}` : CP.costShort(t);
        el.querySelector('.kb-handoff').textContent = t.handoff;
        el.querySelector('.kb-window').textContent = `${CP.tickLabel(t.start)} -> ${CP.tickLabel(t.end)}`;
    }
    function colCreate(c) {
        void c;
        const el = document.createElement('section');
        el.className = 'kb-col';
        el.innerHTML = `<div class="kb-col-head"><span class="kb-dot"></span><span class="kb-col-title"></span>
      <button type="button" class="kb-more" data-columns="1" title="Status column settings">...</button></div>
      <div class="kb-list"></div>`;
        return el;
    }
    function colUpdate(el, c) {
        el.dataset.status = c.id;
        el.querySelector('.kb-dot').style.background = c.color;
        el.querySelector('.kb-col-title').textContent = c.label;
        const list = el.querySelector('.kb-list');
        list.dataset.status = c.id;
        /* C9 / B5: the kanban renders in the shared order, not a private sort. */
        const tasks = CP.sharedOrder(CP.visibleTasks().filter((t) => t.status === c.id));
        CP.reconcile(list, tasks, (t) => t.id, cardCreate, cardUpdate);
    }
    function patchBoard() {
        if (!root || !CP.store.state)
            return;
        /* C9 / B5: recompute the shared-order rank so cards carry the same
           data-order as the gantt's flat work-unit list. */
        boardOrderIndex = {};
        CP.sharedOrder(CP.visibleTasks()).forEach((t, i) => { boardOrderIndex[t.id] = i; });
        CP.reconcile(root, CP.store.state.columns, (c) => c.id, colCreate, colUpdate);
    }
    CP.patchBoard = patchBoard;
    function cleanup() {
        if (line)
            line.remove();
        document.querySelectorAll('.kb-col.is-over').forEach((el) => el.classList.remove('is-over'));
        document.querySelectorAll('.kb-card.is-ghost').forEach((el) => el.classList.remove('is-ghost'));
        dropTarget = null;
        draggingId = null;
    }
    function onDragStart(e) {
        const card = e.target.closest('.kb-card');
        if (!card || !e.dataTransfer || !card.dataset.taskId)
            return;
        draggingId = card.dataset.taskId;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggingId);
        window.setTimeout(() => card.classList.add('is-ghost'), 0);
    }
    function onDragOver(e) {
        if (!draggingId || !root)
            return;
        const list = e.target.closest('.kb-list');
        if (!list)
            return;
        e.preventDefault();
        if (e.dataTransfer)
            e.dataTransfer.dropEffect = 'move';
        const cards = Array.from(list.querySelectorAll('.kb-card'))
            .filter((c) => c.dataset.taskId !== draggingId);
        let ref = null;
        let after = true;
        for (const c of cards) {
            const r = c.getBoundingClientRect();
            if (e.clientY < r.top + r.height / 2) {
                ref = c.dataset.taskId || null;
                after = false;
                break;
            }
            ref = c.dataset.taskId || null;
            after = true;
        }
        if (!line) {
            line = document.createElement('div');
            line.className = 'kb-drop-line';
        }
        const refEl = ref ? list.querySelector(`.kb-card[data-task-id="${ref}"]`) : null;
        if (refEl) {
            if (after)
                refEl.after(line);
            else
                list.insertBefore(line, refEl);
        }
        else
            list.appendChild(line);
        const col = list.closest('.kb-col');
        dropTarget = { status: list.dataset.status || (col && col.dataset.status) || CP.store.state.columns[0].id, ref, after };
        document.querySelectorAll('.kb-col.is-over').forEach((el) => el.classList.remove('is-over'));
        if (col)
            col.classList.add('is-over');
    }
    function onDrop(e) {
        if (!draggingId || !dropTarget)
            return;
        e.preventDefault();
        const id = draggingId;
        const info = dropTarget;
        const t = CP.taskById(id);
        suppressClick = true;
        window.setTimeout(() => { suppressClick = false; }, 180);
        cleanup();
        const ref = info.ref ? CP.taskById(info.ref) : undefined;
        let sort = 0;
        const same = CP.store.state.tasks.filter((x) => x.status === info.status && x.id !== id).sort((a, b) => a.sort - b.sort);
        if (ref)
            sort = ref.sort + (info.after ? .5 : -.5);
        else
            sort = same.length ? same[same.length - 1].sort + 1 : 0;
        const label = t ? `${t.title} -> ${CP.columnById(info.status).label}` : 'Status updated';
        CP.store.optimistic((st) => {
            const x = st.tasks.filter((z) => z.id === id)[0];
            if (x) {
                x.status = info.status;
                x.sort = sort;
            }
        });
        void CP.store.commit('PUT', `/api/tasks/${encodeURIComponent(id)}`, { status: info.status, sort }, label);
    }
    function onClick(e) {
        const target = e.target;
        if (target.closest('[data-columns]') || target.closest('#btnAddColumn')) {
            CP.openColumnManager();
            return;
        }
        const card = target.closest('.kb-card');
        if (!card || !card.dataset.taskId || suppressClick)
            return;
        const id = card.dataset.taskId;
        /* C9 / B5: a modified click toggles the card into the multi-selection
           instead of replacing the single selection. */
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (multi.has(id))
                multi.delete(id);
            else
                multi.add(id);
            paintMulti();
            return;
        }
        CP.select(id, true);
    }
    function onDblClick(e) {
        const card = e.target.closest('.kb-card');
        if (card && card.dataset.taskId)
            CP.openTaskModal(card.dataset.taskId);
    }
    /** Repaint the is-multi-selected class from the current selection set. */
    function paintMulti() {
        document.querySelectorAll('.kb-card').forEach((el) => {
            const on = !!el.dataset.taskId && multi.has(el.dataset.taskId);
            el.classList.toggle('is-multi-selected', on);
        });
    }
    function clearMultiSelection() {
        multi.clear();
        paintMulti();
    }
    /**
     * C9 / B5: move the selected cards to the top or bottom of their OWN column.
     * Selected cards are the multi-selection, or the single selection when the
     * set is empty. New sort values are chosen strictly beyond the current
     * column extremes, then persisted one PUT per task.
     */
    function moveSelectedCards(dir) {
        const s = CP.store.state;
        if (!s)
            return;
        const ids = multi.size ? Array.from(multi) : (CP.store.selected ? [CP.store.selected] : []);
        const chosen = [];
        ids.forEach((id) => { const t = CP.taskById(id); if (t)
            chosen.push(t); });
        if (!chosen.length)
            return;
        const groups = {};
        chosen.forEach((t) => { (groups[t.status] = groups[t.status] || []).push(t); });
        const updates = [];
        Object.keys(groups).forEach((status) => {
            const group = groups[status].slice().sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
            /* C9-1 fix (found by the strengthened A4 assertion): base the new sort
               on the WHOLE column's extremes, not on the unselected subset. Using
               the subset could assign a selected card exactly its old sort, so only
               1 of 2 selected cards appeared to move. Every selected card now gets
               a value strictly beyond the column extreme. */
            const colSorts = s.tasks.filter((t) => t.status === status).map((t) => t.sort);
            const lo = colSorts.length ? Math.min(...colSorts) : 0;
            const hi = colSorts.length ? Math.max(...colSorts) : 0;
            const n = group.length;
            if (dir === 'top') {
                group.forEach((t, i) => { updates.push({ id: t.id, sort: lo - (n - i) }); });
            }
            else {
                group.forEach((t, i) => { updates.push({ id: t.id, sort: hi + i + 1 }); });
            }
        });
        CP.store.optimistic((st) => {
            updates.forEach((u) => { const x = st.tasks.filter((z) => z.id === u.id)[0]; if (x)
                x.sort = u.sort; });
        });
        /* Serial commits: each store.commit() reloads the whole state, so firing
           them concurrently lets one reload overwrite another's optimistic value. */
        void (async () => {
            for (const u of updates) {
                await CP.store.commit('PUT', `/api/tasks/${encodeURIComponent(u.id)}`, { sort: u.sort }, `Moved ${u.id} to ${dir === 'top' ? 'top' : 'bottom'}`);
            }
        })();
    }
    /** Public, CDP-queryable handle for the board keyboard model. */
    CP.Board = {
        selectedIds() { return Array.from(multi); },
        moveSelected(dir) { moveSelectedCards(dir); },
        clearMulti() { clearMultiSelection(); },
    };
    /** C9 / B5: keyboard help line added with createElement, never in HTML. */
    function addBoardHelp() {
        const head = document.querySelector('#view-board .panel-head');
        if (!head || document.getElementById('boardKeyHelp'))
            return;
        const help = document.createElement('span');
        help.id = 'boardKeyHelp';
        help.className = 'kb-help';
        help.textContent = 'Shift / Ctrl / Cmd + Click: multi-select | Alt + Up / Down: move to top / bottom | Esc: clear';
        head.appendChild(help);
    }
    /** C9 / B5: the board owns its keyboard model. Alt+Up/Down never collides
     *  with the ArrowLeft/ArrowRight hour shift in app.ts. */
    function initBoardKeys() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                clearMultiSelection();
                return;
            }
            if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown'))
                return;
            const el = e.target;
            const typing = !!el && typeof el.matches === 'function' && el.matches('input, textarea, select');
            if (typing)
                return;
            const layer = document.getElementById('modalLayer');
            if (layer && !layer.classList.contains('hidden'))
                return;
            e.preventDefault();
            moveSelectedCards(e.key === 'ArrowUp' ? 'top' : 'bottom');
        });
    }
    function initBoard() {
        root = document.getElementById('boardColumns');
        if (!root)
            return;
        root.addEventListener('dragstart', onDragStart);
        root.addEventListener('dragover', onDragOver);
        root.addEventListener('drop', onDrop);
        root.addEventListener('dragend', cleanup);
        root.addEventListener('click', onClick);
        root.addEventListener('dblclick', onDblClick);
        addBoardHelp();
        initBoardKeys();
        CP.store.subscribe(patchBoard);
        CP.store.subscribe(renderSignals);
        patchBoard();
        renderSignals();
    }
    CP.initBoard = initBoard;
})(CP || (CP = {}));
