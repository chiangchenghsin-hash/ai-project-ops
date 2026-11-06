"use strict";
var CP;
(function (CP) {
    let root = null;
    let draggingId = null;
    let dropTarget = null;
    let line = null;
    let suppressClick = false;
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
                out.push({ kind: 'stuck', label: 'Stuck > 24h', detail: `${t.id} ${t.title} (open ${hrs.toFixed(0)}h, threshold N=24)` });
            }
        });
        const deps = s.deps || { nodes: [], edges: [] };
        (deps.nodes || []).filter((n) => n.indeg > 0).forEach((n) => {
            out.push({ kind: 'dependency', label: 'Dependency unfinished', detail: `${n.name} has ${n.indeg} unresolved upstream dependency edge(s)` });
        });
        s.issues.filter((i) => i.status !== 'done' && i.urgent && CP.hoursUntil(i.enddate) < 0).forEach((i) => {
            out.push({ kind: 'urgent_overdue', label: 'Urgent + overdue', detail: `${i.id} ${i.title} (due ${i.enddate})` });
        });
        return out;
    }
    CP.blockingSignals = blockingSignals;
    function renderSignals() {
        const list = document.getElementById('signalList');
        if (!list)
            return;
        const signals = blockingSignals();
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
        el.className = 'kb-card' + (CP.store.selected === t.id ? ' is-selected' : '') + (t.placeholder ? ' is-placeholder' : '');
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
        const tasks = CP.visibleTasks().filter((t) => t.status === c.id).sort((a, b) => a.sort - b.sort);
        CP.reconcile(list, tasks, (t) => t.id, cardCreate, cardUpdate);
    }
    function patchBoard() {
        if (!root || !CP.store.state)
            return;
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
        if (card && card.dataset.taskId && !suppressClick)
            CP.select(card.dataset.taskId, true);
    }
    function onDblClick(e) {
        const card = e.target.closest('.kb-card');
        if (card && card.dataset.taskId)
            CP.openTaskModal(card.dataset.taskId);
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
        CP.store.subscribe(patchBoard);
        CP.store.subscribe(renderSignals);
        patchBoard();
        renderSignals();
    }
    CP.initBoard = initBoard;
})(CP || (CP = {}));
