"use strict";
var CP;
(function (CP) {
    /**
     * R20: task relationship maths. Pure functions over plain values - no DOM,
     * no store - so the rules can be asserted directly instead of eyeballed on
     * a rendered line.
     */
    CP.DEP_TYPES = ['FS', 'SS', 'FF', 'SF'];
    function depTypeLabel(t) {
        switch (t) {
            case 'FS': return 'finish -> start';
            case 'SS': return 'start -> start';
            case 'FF': return 'finish -> finish';
            case 'SF': return 'start -> finish';
            default: return t;
        }
    }
    CP.depTypeLabel = depTypeLabel;
    /**
     * R22: parent/sub-task tree maths. Depth counts parent links to the root.
     * The walk carries a visited set so a corrupt loop in stored data cannot
     * hang the UI.
     */
    function taskDepth(tasks, id) {
        const byId = {};
        tasks.forEach((t) => { byId[t.id] = t; });
        let depth = 0;
        let cur = byId[id];
        const seen = {};
        while (cur && cur.parent_id && byId[cur.parent_id] && !seen[cur.parent_id]) {
            seen[cur.parent_id] = true;
            depth += 1;
            cur = byId[cur.parent_id];
        }
        return depth;
    }
    CP.taskDepth = taskDepth;
    /** True when `id` sits under `ancestorId` in the parent tree. */
    function hasAncestor(tasks, id, ancestorId) {
        const byId = {};
        tasks.forEach((t) => { byId[t.id] = t; });
        let cur = byId[id];
        const seen = {};
        while (cur && cur.parent_id && !seen[cur.parent_id]) {
            if (cur.parent_id === ancestorId)
                return true;
            seen[cur.parent_id] = true;
            cur = byId[cur.parent_id];
        }
        return false;
    }
    CP.hasAncestor = hasAncestor;
    /**
     * Is this edge violated by the two scheduled windows?
     *   FS: the successor may not start before the predecessor ends + lag.
     *   SS: the successor may not start before the predecessor starts + lag.
     *   FF: the successor may not end   before the predecessor ends + lag.
     *   SF: the successor may not end   before the predecessor starts + lag.
     * `lag` is in hours and may be negative - a negative lag is a lead, so the
     * successor is allowed to start before the predecessor finishes. Touching is
     * legal: a successor that starts exactly at the bound is back-to-back, not
     * late.
     */
    function depViolated(type, fromStart, fromEnd, toStart, toEnd, lag = 0) {
        const a0 = CP.parse(fromStart).getTime();
        const a1 = CP.parse(fromEnd).getTime();
        const b0 = CP.parse(toStart).getTime();
        const b1 = CP.parse(toEnd).getTime();
        const L = Math.round(Number(lag) || 0) * 3600000;
        if (!(a1 >= a0) || !(b1 >= b0))
            return true; // a broken window is always a violation
        switch (type) {
            case 'FS': return b0 < a1 + L;
            case 'SS': return b0 < a0 + L;
            case 'FF': return b1 < a1 + L;
            case 'SF': return b1 < a0 + L;
            default: return false;
        }
    }
    CP.depViolated = depViolated;
    /**
     * The lower bound this edge puts on the successor's start, expressed in the
     * same unit as the predecessor's window. Used by the forward pass.
     */
    function startLowerBound(type, fromStart, fromEnd, toDuration, lagMs) {
        switch (type) {
            case 'FS': return fromEnd + lagMs;
            case 'SS': return fromStart + lagMs;
            case 'FF': return fromEnd + lagMs - toDuration;
            case 'SF': return fromStart + lagMs - toDuration;
            default: return fromEnd + lagMs;
        }
    }
    /**
     * Critical set over the dependency graph.
     *
     * A forward pass gives every participant its earliest start from the
     * precedence bounds; a backward pass gives its latest start from the
     * project end. Total float is the difference. Zero float means the task has
     * no room to move without breaking the plan, which is what the panel needs
     * to know - not a textbook label but "this bar cannot slip".
     *
     * Durations come from the scheduled windows, so the result describes the
     * plan as it stands. Only tasks that take part in at least one edge are
     * considered: a disconnected task is never critical, because nothing
     * depends on it.
     */
    function criticalIds(tasks, deps) {
        const byId = {};
        tasks.forEach((t) => { if (!t.placeholder)
            byId[t.id] = t; });
        const succ = {};
        const pred = {};
        const touched = {};
        deps.forEach((d) => {
            if (!byId[d.from] || !byId[d.to])
                return;
            (succ[d.from] = succ[d.from] || []).push(d);
            (pred[d.to] = pred[d.to] || []).push(d);
            touched[d.from] = true;
            touched[d.to] = true;
        });
        const ids = Object.keys(touched).sort();
        if (!ids.length)
            return [];
        const dur = {};
        const at = {};
        ids.forEach((id) => {
            const t = byId[id];
            const s = CP.parse(t.start).getTime();
            const e = CP.parse(t.end).getTime();
            at[id] = s;
            dur[id] = Math.max(0, e - s);
        });
        /* Forward pass: earliest start. Roots begin at their own scheduled time,
           so the pass describes this plan rather than an idealised one. */
        const es = {};
        const order = topoOrder(ids, succ, pred);
        order.forEach((id) => {
            let best = at[id];
            (pred[id] || []).forEach((d) => {
                const lagMs = Math.round(Number(d.lag) || 0) * 3600000;
                const bound = startLowerBound(d.type, es[d.from], es[d.from] + dur[d.from], dur[id], lagMs);
                if (bound > best)
                    best = bound;
            });
            es[id] = best;
        });
        /* Project end is the latest earliest-finish among participants. */
        let projectEnd = 0;
        order.forEach((id) => { projectEnd = Math.max(projectEnd, es[id] + dur[id]); });
        /* Backward pass: latest start, then float. */
        const ls = {};
        for (let i = order.length - 1; i >= 0; i -= 1) {
            const id = order[i];
            let latest = projectEnd - dur[id];
            (succ[id] || []).forEach((d) => {
                const s = ls[d.to];
                const lagMs = Math.round(Number(d.lag) || 0) * 3600000;
                let bound;
                switch (d.type) {
                    case 'FS':
                        bound = s - dur[id] - lagMs;
                        break;
                    case 'SS':
                        bound = s - lagMs;
                        break;
                    case 'FF':
                        bound = s + dur[d.to] - dur[id] - lagMs;
                        break;
                    case 'SF':
                        bound = s + dur[d.to] - lagMs;
                        break;
                    default: bound = s - dur[id] - lagMs;
                }
                if (bound < latest)
                    latest = bound;
            });
            ls[id] = latest;
        }
        return ids.filter((id) => Math.abs(ls[id] - es[id]) < 1).sort();
    }
    CP.criticalIds = criticalIds;
    /**
     * The minimum shift that restores one edge, in milliseconds. Returns 0 when
     * the edge already holds. The successor keeps its duration - it slides, it
     * does not stretch.
     */
    function repairShift(type, lagMs, fromStart, fromEnd, toStart, toEnd) {
        switch (type) {
            case 'FS': return Math.max(0, (fromEnd + lagMs) - toStart);
            case 'SS': return Math.max(0, (fromStart + lagMs) - toStart);
            case 'FF': return Math.max(0, (fromEnd + lagMs) - toEnd);
            case 'SF': return Math.max(0, (fromStart + lagMs) - toEnd);
            default: return Math.max(0, (fromEnd + lagMs) - toStart);
        }
    }
    /**
     * Drag a bar and the plan it constrains follows.
     *
     * Returns every further move the cascade requires, in order, excluding the
     * task the operator dragged. Each successor slides by the least amount that
     * restores its own constraint, then the same is done to its successors. A
     * visited set makes the walk terminate even if the graph is not a DAG, and a
     * placeholder is never moved - a non-commitment bar cannot be dragged into
     * a promise.
     */
    function bumpCascade(tasks, deps, movedId, newStart, newEnd) {
        const byId = {};
        tasks.forEach((t) => { byId[t.id] = t; });
        const succ = {};
        deps.forEach((d) => {
            if (!byId[d.from] || !byId[d.to])
                return;
            (succ[d.from] = succ[d.from] || []).push(d);
        });
        const window = {};
        tasks.forEach((t) => {
            window[t.id] = [CP.parse(t.start).getTime(), CP.parse(t.end).getTime()];
        });
        if (!window[movedId])
            return [];
        window[movedId] = [CP.parse(newStart).getTime(), CP.parse(newEnd).getTime()];
        const out = [];
        const seen = {};
        seen[movedId] = true;
        const queue = [movedId];
        while (queue.length) {
            const cur = String(queue.shift());
            (succ[cur] || []).forEach((d) => {
                if (seen[d.to])
                    return;
                const target = byId[d.to];
                if (!target || target.placeholder)
                    return;
                const w = window[d.to];
                const lagMs = Math.round(Number(d.lag) || 0) * 3600000;
                const shift = repairShift(d.type, lagMs, window[cur][0], window[cur][1], w[0], w[1]);
                if (shift <= 0)
                    return;
                w[0] += shift;
                w[1] += shift;
                seen[d.to] = true;
                out.push({
                    id: d.to,
                    start: CP.fmt(new Date(w[0])),
                    end: CP.fmt(new Date(w[1])),
                });
                queue.push(d.to);
            });
        }
        return out;
    }
    CP.bumpCascade = bumpCascade;
    /** Kahn topo order; a cycle falls back to sorted order rather than looping. */
    function topoOrder(ids, succ, pred) {
        const indeg = {};
        ids.forEach((id) => { indeg[id] = (pred[id] || []).length; });
        const out = [];
        const queue = ids.filter((id) => indeg[id] === 0);
        const seen = {};
        while (queue.length) {
            const id = String(queue.shift());
            if (seen[id])
                continue;
            seen[id] = true;
            out.push(id);
            (succ[id] || []).forEach((d) => {
                indeg[d.to] -= 1;
                if (indeg[d.to] <= 0)
                    queue.push(d.to);
            });
        }
        ids.forEach((id) => { if (!seen[id])
            out.push(id); });
        return out;
    }
})(CP || (CP = {}));
