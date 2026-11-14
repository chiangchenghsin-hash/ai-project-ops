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
 * 2.1.0 - I-029: optional per-card upstream/downstream link row drawn from
 * task_deps (depends-on / depended-by), toggled per card (localStorage
 * cp.card-deps), click scrolls to + flashes the linked card; links carry
 * type + signed lag (FS+2d / SS-2d, lag only when non-zero) and the nature
 * badge when set (I-030).
 * 2.2.0 - I-033: every card carries the four AI dimension fields - model /
 * instance, cost (cost-first, unchanged), confidence (dash when unset) and a
 * gate badge derived from GET /api/policy/owner-scope for the card's owner
 * type (never_automatic > needs_ack > may_act_alone, 'n/a' inactive;
 * confidence below the Settings threshold cp.conf-threshold escalates the
 * badge to at least needs-ack) - plus a per-card "audit" chip that opens the
 * task's trail from GET /api/tasks/:id/audit. Red line 1 is a display rule
 * and a selftest gate: card markup carries model/instance/cost, never
 * persona wording.
 * 2.3.0 - I-034: gateFromScope/gateBadge take an optional approval floor - an
 * SOP gate-step card (additive tasks.approval=1) never answers 'autonomous'
 * or 'n/a'; those cards carry an APPROVAL chip next to the owner chip.
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
    /* ---- I-029: optional per-card dependency links (task_deps) ------------- */
    /** localStorage key -> JSON { task id: row visible } map. */
    const CARD_DEPS_KEY = 'cp.card-deps';
    let cardDepsOpen = {};
    function loadCardDeps() {
        try {
            const raw = localStorage.getItem(CARD_DEPS_KEY);
            const m = raw ? JSON.parse(raw) : {};
            return m && typeof m === 'object' ? m : {};
        }
        catch (_e) {
            return {};
        }
    }
    function saveCardDeps(map) {
        try {
            localStorage.setItem(CARD_DEPS_KEY, JSON.stringify(map));
        }
        catch (_e) { /* private mode: toggle applies for this session only */ }
    }
    /** FS+2d / SS-2d / FS: signed lag, shown only when non-zero (I-029/I-030). */
    function depLagLabel(d) {
        const lag = Math.round(Number(d.lag) || 0);
        const type = String(d.type || 'FS');
        if (!lag)
            return type;
        return type + (lag > 0 ? '+' : '') + lag + 'd';
    }
    /** One link pill: target id + type/signed lag + nature badge when set. */
    function depLinkHtml(d, target) {
        const nature = d.nature
            ? `<span class="kb-dep-nature">${CP.esc(d.nature)}</span>` : '';
        return `<button type="button" class="kb-dep-link" data-target="${CP.esc(target)}">` +
            `${CP.esc(target)} ${CP.esc(depLagLabel(d))}${nature}</button>`;
    }
    /** Upstream (depends-on) + downstream (depended-by) groups for one card. */
    function depRowHtml(t, deps) {
        const group = (label, links) => `<div class="kb-dep-label">${label}</div>` + (links || '<div class="kb-dep-none">none</div>');
        const up = deps.filter((d) => d.to === t.id).map((d) => depLinkHtml(d, d.from)).join('');
        const down = deps.filter((d) => d.from === t.id).map((d) => depLinkHtml(d, d.to)).join('');
        return group('depends-on', up) + group('depended-by', down);
    }
    /** Show/hide one card's link row; persists the per-card flag. */
    function toggleCardDeps(card) {
        const id = card.dataset.taskId;
        if (!id)
            return;
        cardDepsOpen[id] = !cardDepsOpen[id];
        saveCardDeps(cardDepsOpen);
        const on = cardDepsOpen[id];
        const toggle = card.querySelector('.kb-dep-toggle');
        if (toggle) {
            toggle.classList.toggle('is-on', on);
            toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
        const row = card.querySelector('.kb-dep-row');
        if (!row)
            return;
        row.classList.toggle('is-on', on);
        if (!on) {
            row.innerHTML = '';
            return;
        }
        const t = CP.taskById(id);
        const deps = ((CP.store.state && CP.store.state.task_deps) || []);
        row.innerHTML = t ? depRowHtml(t, deps) : '';
    }
    /** Scroll the linked card into view and flash it (it may sit in another
     *  column, so the lookup spans the whole board). Exported for the R36
     *  cross-view navigation: a bar click lands back on the card. */
    function gotoCard(taskId) {
        const el = document.querySelector('.kb-card[data-task-id="' + CSS.escape(taskId) + '"]');
        if (!el) {
            CP.toast('Card not on the board: ' + taskId);
            return;
        }
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        el.classList.remove('kb-flash');
        void el.offsetWidth;
        el.classList.add('kb-flash');
        window.setTimeout(() => el.classList.remove('kb-flash'), 1600);
    }
    CP.gotoCard = gotoCard;
    /** S2 blocking signal: fixed stuck threshold N=24 hours (documented, not tunable). */
    CP.STUCK_HOURS = 24;
    /* ---- I-033: card AI dimensions (model / confidence / gate / audit) ----- */
    /** localStorage key of the Settings "Confidence gate" threshold. */
    const CONF_THRESHOLD_KEY = 'cp.conf-threshold';
    const CONF_DEFAULT = 0.7;
    /** The Settings threshold: 0..1, default 0.7, persisted in localStorage.
     *  An invalid stored value falls back to the default, never to a hidden
     *  card. Pure enough for the selftest to drive through localStorage. */
    function confThreshold() {
        try {
            const raw = localStorage.getItem(CONF_THRESHOLD_KEY);
            if (raw === null || raw === '')
                return CONF_DEFAULT;
            const n = Number(raw);
            return Number.isFinite(n) && n >= 0 && n <= 1 ? n : CONF_DEFAULT;
        }
        catch (_e) {
            return CONF_DEFAULT;
        }
    }
    CP.confThreshold = confThreshold;
    /** Owner-scope rows from GET /api/policy/owner-scope (the same table the
     *  desk's Owner scope panel shows). Empty until the fetch lands; badges
     *  then answer the conservative default until patchBoard runs again. */
    let ownerScopeRows = [];
    function scopeRow(ownerType) {
        return ownerScopeRows.filter((r) => r.owner_type === ownerType)[0];
    }
    /** A scope column counts as active unless it is explicitly "n/a". */
    function scopeActive(s) {
        return !!s && s.trim().toLowerCase() !== 'n/a';
    }
    /**
     * I-033 gate derivation (pure; the selftest calls it directly). The most
     * restrictive ACTIVE column of the owner-scope row wins -
     * never_automatic -> never-auto > needs_ack -> needs-ack >
     * may_act_alone -> autonomous - matched to the card's owner type. Then a
     * confidence below `thr` escalates the badge to at least needs-ack: an
     * autonomous card becomes needs-ack; never-auto is already stricter and
     * stays. Rows not loaded (or unknown owner type) answer needs-ack.
     * I-034: `approval` (an SOP gate step) floors the result the same way -
     * an approval card never answers 'autonomous' or 'n/a'; never-auto stays
     * because it is already stricter than needs-ack.
     */
    function gateFromScope(row, confidence, thr, approval) {
        let base = 'needs-ack';
        if (row) {
            if (scopeActive(row.never_automatic))
                base = 'never-auto';
            else if (scopeActive(row.needs_ack))
                base = 'needs-ack';
            else if (scopeActive(row.may_act_alone))
                base = 'autonomous';
        }
        if (base === 'autonomous' && confidence !== null && Number.isFinite(confidence) && confidence < thr) {
            return 'needs-ack';
        }
        if (approval && base === 'autonomous')
            return 'needs-ack';
        return base;
    }
    CP.gateFromScope = gateFromScope;
    /** The card's badge: owner-scope row for the owner type + the live
     *  Settings threshold + the I-034 approval floor. */
    function gateBadge(ownerType, confidence, approval) {
        return gateFromScope(scopeRow(ownerType), confidence, confThreshold(), approval);
    }
    CP.gateBadge = gateBadge;
    /** Which card's audit popover is open (one at a time). */
    let auditOpenId = null;
    /**
     * Toggle one card's audit popover: GET /api/tasks/:id/audit carries the
     * desk events naming the task plus the TASK-LOG PDCA entry ids naming it.
     * Rendering is createElement + textContent only - event detail is data.
     */
    async function toggleAudit(card) {
        const id = card.dataset.taskId;
        if (!id)
            return;
        const pop = card.querySelector('.kb-audit-pop');
        const btn = card.querySelector('.kb-audit');
        if (!pop)
            return;
        const already = !pop.hidden && auditOpenId === id;
        document.querySelectorAll('.kb-audit-pop').forEach((p) => { p.hidden = true; });
        document.querySelectorAll('.kb-audit').forEach((b) => {
            b.setAttribute('aria-expanded', 'false');
            b.classList.remove('is-on');
        });
        if (already) {
            auditOpenId = null;
            return;
        }
        pop.hidden = false;
        if (btn) {
            btn.setAttribute('aria-expanded', 'true');
            btn.classList.add('is-on');
        }
        auditOpenId = id;
        pop.textContent = 'Loading audit trail...';
        try {
            const r = await fetch('/api/tasks/' + encodeURIComponent(id) + '/audit', { cache: 'no-store' });
            if (!r.ok)
                throw new Error('audit HTTP ' + r.status);
            const data = await r.json();
            const evs = Array.isArray(data.events) ? data.events : [];
            const pdca = Array.isArray(data.pdca) ? data.pdca : [];
            pop.textContent = '';
            const head = document.createElement('div');
            head.className = 'kb-audit-head';
            head.textContent = 'Audit trail: ' + id;
            pop.appendChild(head);
            const section = (label, items) => {
                const sec = document.createElement('div');
                sec.className = 'kb-audit-sec';
                sec.textContent = label + ' (' + items.length + ')';
                pop.appendChild(sec);
                if (!items.length) {
                    const none = document.createElement('div');
                    none.className = 'kb-audit-none';
                    none.textContent = 'none';
                    pop.appendChild(none);
                    return;
                }
                items.forEach((text) => {
                    const li = document.createElement('div');
                    li.className = 'kb-audit-item';
                    li.textContent = text;
                    pop.appendChild(li);
                });
            };
            section('desk events', evs.map((e) => `${e.ts} ${e.kind}: ${e.detail}`));
            section('PDCA entries', pdca);
        }
        catch (e) {
            pop.textContent = 'Audit unavailable: ' + String(e);
        }
    }
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
        el.innerHTML = `<div class="kb-card-top"><span class="kb-owner-chip"></span><span class="kb-parent"></span><span class="kb-owner"></span><span class="kb-approval" hidden>APPROVAL</span><button type="button" class="kb-dep-toggle" title="Show dependency links" aria-pressed="false">&#128279;</button></div>
      <h4 class="kb-title"></h4><div class="kb-role"></div>
      <div class="kb-cost"></div>
      <div class="kb-ai"><span class="kb-model" title="Model / instance of the executor"></span><span class="kb-conf" title="Confidence; - when unset"></span><span class="kb-gate" title="Gate from the owner-scope table for this owner type"></span><button type="button" class="kb-audit" title="Open this task's audit trail" aria-expanded="false">audit</button><button type="button" class="kb-jump-axis" title="Switch to the hour axis and flash this task's bar">-> hour axis</button></div>
      <div class="kb-handoff"></div>
      <div class="kb-window"></div>
      <div class="kb-dep-row"></div>
      <div class="kb-audit-pop" hidden></div>`;
        /* R36: the card's `-> hour axis` control - switch to tab 2 and flash the
           paired bar. The click stops here so the card click (audit popover,
           selection) is untouched. */
        el.querySelector('.kb-jump-axis').addEventListener('click', (ev) => {
            ev.stopPropagation();
            const id = el.dataset.taskId;
            if (!id)
                return;
            CP.switchWbTab('axis');
            const bar = document.querySelector('.gbar[data-task-id="' + CSS.escape(id) + '"]');
            if (!bar) {
                CP.toast('Bar not on the hour axis: ' + id);
                return;
            }
            bar.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            bar.classList.remove('kb-flash');
            void bar.offsetWidth;
            bar.classList.add('kb-flash');
            window.setTimeout(() => bar.classList.remove('kb-flash'), 1600);
        });
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
        /* I-034: APPROVAL badge on SOP gate-step cards (additive tasks.approval). */
        const appr = el.querySelector('.kb-approval');
        const isApproval = Number(t.approval || 0) === 1;
        appr.hidden = !isApproval;
        /* R22: the tree is visible as an indent. Depth lives in its own custom
           property so the stylesheet derives the indent from it. */
        const depth = CP.taskDepth(CP.store.state ? CP.store.state.tasks : [], t.id);
        el.dataset.depth = String(depth);
        el.style.setProperty('--depth', String(depth));
        el.querySelector('.kb-owner').textContent = t.owner;
        el.querySelector('.kb-title').textContent = t.title;
        el.querySelector('.kb-role').textContent = t.role;
        el.querySelector('.kb-cost').textContent = t.placeholder ? `placeholder | ${t.tier}` : CP.costShort(t);
        /* I-033: the four AI dimension fields. Red line 1 is a display rule -
           model/instance, cost and confidence are observable fields; persona
           wording never reaches a card (selftest section 32 scans for it). */
        const modelEl = el.querySelector('.kb-model');
        const modelVal = t.model || '';
        modelEl.textContent = 'model: ' + (modelVal || 'n/a');
        modelEl.dataset.model = modelVal;
        const confRaw = t.confidence;
        const confNum = confRaw === undefined || confRaw === null ? NaN : Number(confRaw);
        const confOk = Number.isFinite(confNum);
        const confEl = el.querySelector('.kb-conf');
        confEl.textContent = 'conf: ' + (confOk ? confNum.toFixed(2) : '-');
        confEl.dataset.conf = confOk ? String(confNum) : '';
        const gate = gateBadge(t.owner_type, confOk ? confNum : null, isApproval);
        const gateEl = el.querySelector('.kb-gate');
        gateEl.textContent = gate;
        gateEl.dataset.gate = gate;
        gateEl.className = 'kb-gate gate-' + gate;
        el.querySelector('.kb-handoff').textContent = t.handoff;
        el.querySelector('.kb-window').textContent = `${CP.tickLabel(t.start)} -> ${CP.tickLabel(t.end)}`;
        /* I-029: optional link row - closed cards render no link DOM at all. */
        const depRow = el.querySelector('.kb-dep-row');
        const depToggle = el.querySelector('.kb-dep-toggle');
        const depsOpen = !!cardDepsOpen[t.id];
        depRow.classList.toggle('is-on', depsOpen);
        depToggle.classList.toggle('is-on', depsOpen);
        depToggle.setAttribute('aria-pressed', depsOpen ? 'true' : 'false');
        depRow.innerHTML = depsOpen
            ? depRowHtml(t, ((CP.store.state && CP.store.state.task_deps) || []))
            : '';
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
        /* I-029: the per-card toggle and a link pill act alone - never select. */
        const depToggle = target.closest('.kb-dep-toggle');
        if (depToggle) {
            const tc = depToggle.closest('.kb-card');
            if (tc)
                toggleCardDeps(tc);
            return;
        }
        const depLink = target.closest('.kb-dep-link');
        if (depLink) {
            const dest = depLink.dataset.target;
            if (dest)
                gotoCard(dest);
            return;
        }
        /* I-033: the audit chip opens the trail in place - never selects. */
        const auditBtn = target.closest('.kb-audit');
        if (auditBtn) {
            const tc = auditBtn.closest('.kb-card');
            if (tc)
                void toggleAudit(tc);
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
        const target = e.target;
        /* I-029: double-clicking the toggle or a link is not a task edit.
           I-033: the audit chip is a disclosure, not an edit either. */
        if (target.closest('.kb-dep-toggle') || target.closest('.kb-dep-link') || target.closest('.kb-audit'))
            return;
        const card = target.closest('.kb-card');
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
        cardDepsOpen = loadCardDeps();
        /* I-033: gate badges read the same owner-scope table the desk shows.
           Fire-and-forget: a failed fetch leaves the conservative default. */
        void CP.fetchOwnerScope()
            .then((rows) => { ownerScopeRows = rows; patchBoard(); })
            .catch(() => { });
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
