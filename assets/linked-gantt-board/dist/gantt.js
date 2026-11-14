"use strict";
var CP;
(function (CP) {
    let scroll = null;
    let lanesEl = null;
    let axis = '';
    /** R20: when on, bars outside the critical set are dimmed. */
    let showCritical = false;
    let criticalSet = {};
    /** R21: a half-made link while the operator drags between two bars. */
    let link = null;
    /** Which precedence type the two ends imply. No menu, no guessing. */
    function linkType(fromSide, toSide) {
        if (fromSide === 'right' && toSide === 'left')
            return 'FS';
        if (fromSide === 'left' && toSide === 'left')
            return 'SS';
        if (fromSide === 'right' && toSide === 'right')
            return 'FF';
        return 'SF';
    }
    /** I-030: the nature the operator picked for the next canvas link. Frozen
     *  vocab: '' (unspecified) | mandatory | discretionary | external. The
     *  value travels through the existing dep write path as `nature`. */
    function linkNature() {
        const sel = document.getElementById('gdepNature');
        return sel ? sel.value : '';
    }
    CP.linkNature = linkNature;
    let drag = null;
    let tip = null;
    /** C9 / B5: shared-order rank per task id, rebuilt on every gantt patch. */
    let ganttOrderIndex = {};
    /** `ordered` is the flat work-unit list in CP.sharedOrder() order. The time
     *  sort is stable, so equal starts keep that shared (status, sort, id) order. */
    function lanePlan(ordered) {
        const sorted = ordered.slice().sort((a, b) => CP.parse(a.start).getTime() - CP.parse(b.start).getTime());
        const ends = [];
        return sorted.map((t) => {
            const startH = CP.diffHours(axis, t.start);
            const hours = Math.max(CP.diffHours(t.start, t.end), CP.MIN_BAR_H);
            let lane = ends.findIndex((e) => e <= startH);
            if (lane < 0) {
                lane = ends.length;
                ends.push(0);
            }
            ends[lane] = startH + hours;
            return { t, lane, startH, hours };
        });
    }
    function barCreate(a) {
        const el = document.createElement('div');
        el.className = 'gbar';
        el.innerHTML = `<span class="gbar-base"></span><span class="gbar-fill"></span><span class="gbar-label"></span>
      <span class="gbar-handle left" data-handle="left"></span><span class="gbar-handle right" data-handle="right"></span>
      <span class="gbar-link left" data-link="left"></span><span class="gbar-link right" data-link="right"></span>`;
        void a;
        return el;
    }
    function barUpdate(el, a) {
        const t = a.t;
        const col = CP.columnById(t.status);
        el.dataset.taskId = t.id;
        if (ganttOrderIndex[t.id] !== undefined)
            el.dataset.order = String(ganttOrderIndex[t.id]);
        el.className = 'gbar' + (t.placeholder ? ' placeholder' : '') + (CP.store.selected === t.id ? ' is-selected' : '')
            + (showCritical && !criticalSet[t.id] && !t.placeholder ? ' not-critical' : '');
        el.style.left = `${a.startH * CP.HOUR_W}px`;
        el.style.width = `${a.hours * CP.HOUR_W}px`;
        /* R22: indent the label by tree depth, same rule as the kanban card. */
        el.style.setProperty('--depth', String(CP.taskDepth(CP.store.state ? CP.store.state.tasks : [], t.id)));
        /* I-032: status color straight from the column palette the kanban uses
           (columnById) - one dataset, one palette, both surfaces agree. */
        el.style.background = t.placeholder ? 'transparent' : col.color;
        el.style.borderColor = CP.rgba(col.color, .8);
        el.querySelector('.gbar-fill').style.width = `${t.progress}%`;
        const label = el.querySelector('.gbar-label');
        label.textContent = t.placeholder
            ? `placeholder | ${t.tier} | non-commitment`
            : CP.costLabel(t);
        /* R20 baseline: a grey ghost at the frozen window, behind the real bar.
           A task with no baseline renders no ghost. */
        const ghost = el.querySelector('.gbar-base');
        if (!t.placeholder && t.baseline_start && t.baseline_end && t.baseline_start !== t.baseline_end) {
            const bStart = CP.diffHours(axis, t.baseline_start);
            const bHours = Math.max(CP.diffHours(t.baseline_start, t.baseline_end), CP.MIN_BAR_H);
            ghost.style.display = 'block';
            ghost.style.left = `${(bStart - a.startH) * CP.HOUR_W}px`;
            ghost.style.width = `${bHours * CP.HOUR_W}px`;
        }
        else {
            ghost.style.display = 'none';
        }
        /* I-032: cost-first label unchanged; the hover tooltip carries start
           hour -> end hour, duration, cost and owner (the four fields the
           human asked to see without opening the edit form). */
        const dur = Math.round(a.hours * 10) / 10;
        el.title = `${CP.costLabel(t)} | ${CP.tickLabel(t.start)} -> ${CP.tickLabel(t.end)} | ${dur}h | ${CP.ownerLabel(t.owner_type)}`
            + (t.parent_id ? ` | part of ${t.parent_id}` : '');
    }
    function laneCreate(l) {
        void l;
        const el = document.createElement('div');
        el.className = 'gantt-lane';
        el.innerHTML = `<div class="gantt-lane-label"></div><div class="gantt-lane-track"></div>`;
        return el;
    }
    function laneUpdate(el, l) {
        el.querySelector('.gantt-lane-label').textContent = `Lane ${l.i + 1}`;
        const track = el.querySelector('.gantt-lane-track');
        CP.reconcile(track, l.bars, (a) => a.t.id, barCreate, barUpdate);
    }
    function patchGantt() {
        if (!lanesEl || !CP.store.state)
            return;
        const s = CP.store.state;
        /* C9 / B5: the gantt's flat work-unit list uses the very same shared
           order as the kanban board, so both surfaces agree on every unit. */
        const flatWorkUnits = CP.sharedOrder(CP.visibleTasks());
        ganttOrderIndex = {};
        flatWorkUnits.forEach((t, i) => { ganttOrderIndex[t.id] = i; });
        const plan = lanePlan(flatWorkUnits);
        const count = Math.max(1, plan.reduce((m, a) => Math.max(m, a.lane + 1), 0));
        const lanes = Array.from({ length: count }, (_, i) => ({ i, bars: plan.filter((a) => a.lane === i) }));
        CP.reconcile(lanesEl, lanes, (l) => String(l.i), laneCreate, laneUpdate);
        /* R20: critical set + precedence edges. Both are derived from the same
           dataset the kanban uses - one dataset, two surfaces. */
        const crit = CP.criticalIds(s.tasks, s.task_deps || []);
        criticalSet = {};
        crit.forEach((id) => { criticalSet[id] = true; });
        drawEdges(plan, s.task_deps || []);
        const body = document.getElementById('ganttBody');
        if (body)
            body.style.height = `${count * CP.ROW_H}px`;
    }
    CP.patchGantt = patchGantt;
    /** Elbow path between two bars in lane-track coordinates. */
    function edgePath(x1, y1, x2, y2) {
        const out = x1 + 10;
        const inX = x2 - 10;
        if (inX >= out)
            return `M ${x1} ${y1} H ${out} V ${y2} H ${x2}`;
        const mid = (y1 + y2) / 2;
        return `M ${x1} ${y1} H ${out} V ${mid} H ${inX} V ${y2} H ${x2}`;
    }
    /**
     * Draw one path per precedence edge. RED when the edge is violated by the
     * current schedule, BLUE when it holds. The verdict comes from the pure
     * rule in graph.ts, never from the pixel geometry.
     */
    function drawEdges(plan, deps) {
        const svg = document.getElementById('ganttEdges');
        if (!svg)
            return;
        const byId = {};
        plan.forEach((a) => { byId[a.t.id] = a; });
        const parts = [];
        deps.forEach((d) => {
            const from = byId[d.from];
            const to = byId[d.to];
            if (!from || !to)
                return;
            const x1 = from.startH * CP.HOUR_W + from.hours * CP.HOUR_W;
            const y1 = from.lane * CP.ROW_H + CP.ROW_H / 2;
            const x2 = to.startH * CP.HOUR_W;
            const y2 = to.lane * CP.ROW_H + CP.ROW_H / 2;
            const bad = CP.depViolated(d.type, from.t.start, from.t.end, to.t.start, to.t.end, d.lag || 0);
            parts.push(`<path class="gdep${bad ? ' violated' : ''}" d="${edgePath(x1, y1, x2, y2)}" data-from="${d.from}" data-to="${d.to}" marker-end="url(#${bad ? 'arrowBad' : 'arrowOk'})"></path>`);
        });
        svg.innerHTML = `<defs>
        <marker id="arrowOk" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="#0071e3"></path></marker>
        <marker id="arrowBad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="#ff3b30"></path></marker>
      </defs>` + parts.join('');
        svg.setAttribute('width', String(CP.AXIS_HOURS * CP.HOUR_W));
        svg.setAttribute('height', String(Math.max(1, plan.reduce((m, a) => Math.max(m, a.lane + 1), 0)) * CP.ROW_H));
    }
    function setCriticalView(on) {
        showCritical = on;
        patchGantt();
    }
    CP.setCriticalView = setCriticalView;
    function onDown(e) {
        if (e.button !== 0 || !scroll)
            return;
        const target = e.target;
        const bar = target.closest('.gbar');
        if (!bar || !bar.dataset.taskId)
            return;
        const t = CP.taskById(bar.dataset.taskId);
        if (!t)
            return;
        e.preventDefault();
        /* R21: a drag that starts on a link dot authors an edge instead of
           moving the bar. The dot sits above the resize handle only at the very
           centre of that edge, so resizing stays reachable everywhere else. */
        const dot = target.closest('.gbar-link');
        if (dot && dot.dataset.link) {
            const r = document.getElementById('ganttEdges').getBoundingClientRect();
            link = { id: t.id, side: dot.dataset.link, x: e.clientX - r.left, y: e.clientY - r.top };
            document.body.classList.add('is-linking');
            return;
        }
        CP.store.selected = t.id;
        CP.paintSelection(false);
        const handle = target.closest('.gbar-handle');
        drag = {
            id: t.id,
            mode: handle ? (handle.dataset.handle === 'left' ? 'left' : 'right') : 'move',
            x0: e.clientX, start: t.start, end: t.end,
            newStart: t.start, newEnd: t.end, changed: false,
        };
        bar.classList.add('is-dragging');
        document.body.classList.add('is-dragging');
    }
    function onMove(e) {
        /* R21: preview the pending edge. */
        if (link) {
            const svg = document.getElementById('ganttEdges');
            if (svg) {
                const r = svg.getBoundingClientRect();
                const x = e.clientX - r.left;
                const y = e.clientY - r.top;
                const live = svg.querySelector('#gdepPreview');
                const d = edgePath(link.x, link.y, x, y);
                if (live)
                    live.setAttribute('d', d);
                else {
                    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    p.setAttribute('id', 'gdepPreview');
                    p.setAttribute('class', 'gdep preview');
                    p.setAttribute('d', d);
                    svg.appendChild(p);
                }
            }
            return;
        }
        if (!drag)
            return;
        const delta = Math.round((e.clientX - drag.x0) / CP.HOUR_W);
        if (delta === 0 && !drag.changed)
            return;
        let s = drag.start;
        let en = drag.end;
        if (drag.mode === 'move') {
            s = CP.addHours(drag.start, delta);
            en = CP.addHours(drag.end, delta);
        }
        else if (drag.mode === 'left') {
            s = CP.addHours(drag.start, delta);
            if (CP.parse(s).getTime() >= CP.parse(en).getTime())
                s = CP.addHours(en, -1);
        }
        else {
            en = CP.addHours(drag.end, delta);
            if (CP.parse(en).getTime() <= CP.parse(s).getTime())
                en = CP.addHours(s, 1);
        }
        drag.newStart = s;
        drag.newEnd = en;
        drag.changed = s !== drag.start || en !== drag.end;
        const t = CP.taskById(drag.id);
        if (!t)
            return;
        CP.store.optimistic((st) => {
            const x = st.tasks.filter((z) => z.id === drag.id)[0];
            if (x) {
                x.start = s;
                x.end = en;
            }
        });
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'drag-tip';
            document.body.appendChild(tip);
        }
        tip.textContent = `${CP.costLabel(t)} | ${CP.tickLabel(s)} -> ${CP.tickLabel(en)}`;
        tip.style.left = `${e.clientX + 14}px`;
        tip.style.top = `${e.clientY + 16}px`;
    }
    function onUp(e) {
        /* R21: finish a pending link. Dropping on empty space creates nothing. */
        if (link) {
            const from = link;
            link = null;
            document.body.classList.remove('is-linking');
            const svg = document.getElementById('ganttEdges');
            const live = svg ? svg.querySelector('#gdepPreview') : null;
            if (live)
                live.remove();
            const under = document.elementFromPoint(e.clientX, e.clientY);
            const bar = under ? under.closest('.gbar') : null;
            const toId = bar && bar.dataset.taskId ? bar.dataset.taskId : '';
            if (!toId || toId === from.id)
                return;
            const s = CP.store.state;
            const target = s ? s.tasks.filter((x) => x.id === toId)[0] : null;
            const side = bar ? (closestSide(bar, e.clientX) || 'left') : 'left';
            const type = linkType(from.side, side);
            /* I-030: nature rides along on the existing dep write path. */
            void CP.store.commit('PUT', '/api/task-deps', { from: from.id, to: toId, type, lag: 0, nature: linkNature() }, `Linked ${from.id} -> ${toId} (${type})`).catch((err) => CP.toast('Link refused: ' + String(err)));
            void target;
            return;
        }
        if (!drag)
            return;
        const d = drag;
        drag = null;
        document.body.classList.remove('is-dragging');
        document.querySelectorAll('.gbar.is-dragging').forEach((el) => el.classList.remove('is-dragging'));
        if (tip) {
            tip.remove();
            tip = null;
        }
        /* R36: a real bar drag must not also navigate - the trailing click is
           swallowed below so "bar click (no drag)" stays the only jump trigger. */
        if (!d.changed)
            return;
        suppressClick = true;
        /* R21: everything the dragged bar constrains follows it, by the least
           amount that restores each constraint, and the cascade is persisted. */
        const s = CP.store.state;
        const cascade = s ? CP.bumpCascade(s.tasks, s.task_deps || [], d.id, d.newStart, d.newEnd) : [];
        void CP.store.commit('PUT', `/api/tasks/${encodeURIComponent(d.id)}`, { start: d.newStart, end: d.newEnd }, cascade.length
            ? `Time saved + ${cascade.length} dependant(s) bumped`
            : `Time saved: ${CP.tickLabel(d.newStart)} -> ${CP.tickLabel(d.newEnd)}`);
        cascade.forEach((mv) => {
            void CP.store.commit('PUT', `/api/tasks/${encodeURIComponent(mv.id)}`, { start: mv.start, end: mv.end }, `Bumped ${mv.id} to keep its dependency`);
        });
    }
    /** Which end of the bar the pointer is nearer to, for link typing. */
    function closestSide(bar, clientX) {
        const r = bar.getBoundingClientRect();
        return clientX < r.left + r.width / 2 ? 'left' : 'right';
    }
    /** R36: set when a bar drag really moved - the trailing click is swallowed
     *  so it cannot trigger the cross-view navigation. */
    let suppressClick = false;
    function onClick(e) {
        /* R21: clicking a drawn edge removes it, after a confirm. */
        const path = e.target.closest('.gdep');
        if (path && path.dataset.from && path.dataset.to) {
            const label = `${path.dataset.from} -> ${path.dataset.to}`;
            if (window.confirm('Delete the dependency ' + label + '?')) {
                void CP.store.commit('DELETE', `/api/task-deps/${encodeURIComponent(path.dataset.from)}/${encodeURIComponent(path.dataset.to)}`, undefined, `Dependency removed: ${label}`);
            }
            return;
        }
        const bar = e.target.closest('.gbar');
        if (bar && bar.dataset.taskId) {
            if (suppressClick) {
                suppressClick = false;
                return;
            }
            /* R36: bar click (no drag) jumps back to the card - tab 1 + flash. */
            CP.select(bar.dataset.taskId, true);
            CP.switchWbTab('board');
            CP.gotoCard(bar.dataset.taskId);
        }
    }
    function initGantt() {
        scroll = document.getElementById('ganttScroll');
        if (!scroll)
            return;
        axis = CP.axisStart();
        const width = CP.AXIS_HOURS * CP.HOUR_W;
        const ticks = [];
        const lines = [];
        for (let i = 0; i < CP.AXIS_HOURS; i += 12) {
            const s = CP.addHours(axis, i);
            ticks.push(`<div class="gtick${CP.isMidnight(s) ? ' midnight' : ''}" style="width:${12 * CP.HOUR_W}px"><span>${CP.tickLabel(s)}</span></div>`);
            lines.push(`<div class="gline${CP.isMidnight(s) ? ' midnight' : ''}" style="left:${i * CP.HOUR_W}px"></div>`);
        }
        const nowX = CP.diffHours(axis, CP.fmt(new Date())) * CP.HOUR_W;
        /* I-032: past hours shaded subtly under the lanes; clamped to the axis
           so a clock outside the window cannot paint a negative/oversized box.
           pointer-events:none keeps drags and hovers on the bars above. */
        const pastW = Math.max(0, Math.min(nowX, width));
        scroll.innerHTML = `<div class="gantt-inner" style="width:${CP.LABEL_W + width}px">
      <div class="gantt-head">
        <div class="gantt-corner">Work units | hour axis (day/night)</div>
        <div class="gantt-ticks" style="width:${width}px">${ticks.join('')}
          <div class="gnow-flag" data-now-flag="1" style="left:${nowX}px">NOW</div></div>
      </div>
      <div class="gantt-body" id="ganttBody">
        <div class="past-shade" style="left:${CP.LABEL_W}px;width:${pastW}px"></div>
        <div class="gantt-grid" style="left:${CP.LABEL_W}px;width:${width}px">${lines.join('')}</div>
        <div class="now-line" style="left:${CP.LABEL_W + nowX}px"><span>NOW</span></div>
        <svg class="gantt-edges" id="ganttEdges" style="left:${CP.LABEL_W}px"></svg>
        <div class="gantt-lanes" id="ganttLanes"></div>
      </div>
    </div>`;
        lanesEl = document.getElementById('ganttLanes');
        scroll.addEventListener('pointerdown', onDown);
        scroll.addEventListener('click', onClick);
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
        document.addEventListener('keydown', (e) => {
            /* R21: Escape abandons a half-made link and leaves nothing behind. */
            if (e.key !== 'Escape' || !link)
                return;
            link = null;
            document.body.classList.remove('is-linking');
            const svg = document.getElementById('ganttEdges');
            const live = svg ? svg.querySelector('#gdepPreview') : null;
            if (live)
                live.remove();
        });
        CP.store.subscribe(patchGantt);
        patchGantt();
        scrollGanttToNow();
    }
    CP.initGantt = initGantt;
    function scrollGanttToNow() {
        if (!scroll)
            return;
        const idx = CP.diffHours(axis, CP.fmt(new Date()));
        scroll.scrollLeft = Math.max(0, idx * CP.HOUR_W - scroll.clientWidth * 0.45);
    }
    CP.scrollGanttToNow = scrollGanttToNow;
    function ganttAxis() { return axis; }
    CP.ganttAxis = ganttAxis;
})(CP || (CP = {}));
