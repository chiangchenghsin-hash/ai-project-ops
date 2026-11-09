namespace CP {
  /**
   * R20: task relationship maths. Pure functions over plain values - no DOM,
   * no store - so the rules can be asserted directly instead of eyeballed on
   * a rendered line.
   */

  /** The four classical precedence types. */
  export type DepType = 'FS' | 'SS' | 'FF' | 'SF';

  export const DEP_TYPES: DepType[] = ['FS', 'SS', 'FF', 'SF'];

  /**
   * C9 / B5: one canonical order shared by the kanban board and the gantt's
   * flat work-unit list. Pure - it never mutates the input and touches no DOM
   * or store. Sorting by (status, sort, id) gives a stable, total order, so
   * the list surface and the board surface always agree on where a unit sits.
   */
  export function sharedOrder(tasks: Task[]): Task[] {
    return tasks.slice().sort((a, b) => {
      if (a.status !== b.status) return a.status < b.status ? -1 : 1;
      if (a.sort !== b.sort) return a.sort - b.sort;
      if (a.id === b.id) return 0;
      return a.id < b.id ? -1 : 1;
    });
  }

  export function depTypeLabel(t: string): string {
    switch (t) {
      case 'FS': return 'finish -> start';
      case 'SS': return 'start -> start';
      case 'FF': return 'finish -> finish';
      case 'SF': return 'start -> finish';
      default: return t;
    }
  }

  /**
   * R22: parent/sub-task tree maths. Depth counts parent links to the root.
   * The walk carries a visited set so a corrupt loop in stored data cannot
   * hang the UI.
   */
  export function taskDepth(tasks: Task[], id: string): number {
    const byId: Record<string, Task> = {};
    tasks.forEach((t) => { byId[t.id] = t; });
    let depth = 0;
    let cur = byId[id];
    const seen: Record<string, boolean> = {};
    while (cur && cur.parent_id && byId[cur.parent_id] && !seen[cur.parent_id]) {
      seen[cur.parent_id] = true;
      depth += 1;
      cur = byId[cur.parent_id];
    }
    return depth;
  }

  /** True when `id` sits under `ancestorId` in the parent tree. */
  export function hasAncestor(tasks: Task[], id: string, ancestorId: string): boolean {
    const byId: Record<string, Task> = {};
    tasks.forEach((t) => { byId[t.id] = t; });
    let cur = byId[id];
    const seen: Record<string, boolean> = {};
    while (cur && cur.parent_id && !seen[cur.parent_id]) {
      if (cur.parent_id === ancestorId) return true;
      seen[cur.parent_id] = true;
      cur = byId[cur.parent_id];
    }
    return false;
  }

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
  export function depViolated(type: string, fromStart: string, fromEnd: string, toStart: string, toEnd: string, lag: number = 0): boolean {
    const a0 = parse(fromStart).getTime();
    const a1 = parse(fromEnd).getTime();
    const b0 = parse(toStart).getTime();
    const b1 = parse(toEnd).getTime();
    const L = Math.round(Number(lag) || 0) * 3600000;
    if (!(a1 >= a0) || !(b1 >= b0)) return true; // a broken window is always a violation
    switch (type) {
      case 'FS': return b0 < a1 + L;
      case 'SS': return b0 < a0 + L;
      case 'FF': return b1 < a1 + L;
      case 'SF': return b1 < a0 + L;
      default: return false;
    }
  }

  export interface DepRow { from: string; to: string; type: string; lag?: number; }

  /**
   * The lower bound this edge puts on the successor's start, expressed in the
   * same unit as the predecessor's window. Used by the forward pass.
   */
  function startLowerBound(type: string, fromStart: number, fromEnd: number, toDuration: number, lagMs: number): number {
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
  export function criticalIds(tasks: Task[], deps: DepRow[]): string[] {
    const byId: Record<string, Task> = {};
    tasks.forEach((t) => { if (!t.placeholder) byId[t.id] = t; });

    const succ: Record<string, DepRow[]> = {};
    const pred: Record<string, DepRow[]> = {};
    const touched: Record<string, boolean> = {};
    deps.forEach((d) => {
      if (!byId[d.from] || !byId[d.to]) return;
      (succ[d.from] = succ[d.from] || []).push(d);
      (pred[d.to] = pred[d.to] || []).push(d);
      touched[d.from] = true;
      touched[d.to] = true;
    });

    const ids = Object.keys(touched).sort();
    if (!ids.length) return [];

    const dur: Record<string, number> = {};
    const at: Record<string, number> = {};
    ids.forEach((id) => {
      const t = byId[id];
      const s = parse(t.start).getTime();
      const e = parse(t.end).getTime();
      at[id] = s;
      dur[id] = Math.max(0, e - s);
    });

    /* Forward pass: earliest start. Roots begin at their own scheduled time,
       so the pass describes this plan rather than an idealised one. */
    const es: Record<string, number> = {};
    const order = topoOrder(ids, succ, pred);
    order.forEach((id) => {
      let best = at[id];
      (pred[id] || []).forEach((d) => {
        const lagMs = Math.round(Number(d.lag) || 0) * 3600000;
        const bound = startLowerBound(d.type, es[d.from], es[d.from] + dur[d.from], dur[id], lagMs);
        if (bound > best) best = bound;
      });
      es[id] = best;
    });

    /* Project end is the latest earliest-finish among participants. */
    let projectEnd = 0;
    order.forEach((id) => { projectEnd = Math.max(projectEnd, es[id] + dur[id]); });

    /* Backward pass: latest start, then float. */
    const ls: Record<string, number> = {};
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const id = order[i];
      let latest = projectEnd - dur[id];
      (succ[id] || []).forEach((d) => {
        const s = ls[d.to];
        const lagMs = Math.round(Number(d.lag) || 0) * 3600000;
        let bound: number;
        switch (d.type) {
          case 'FS': bound = s - dur[id] - lagMs; break;
          case 'SS': bound = s - lagMs; break;
          case 'FF': bound = s + dur[d.to] - dur[id] - lagMs; break;
          case 'SF': bound = s + dur[d.to] - lagMs; break;
          default: bound = s - dur[id] - lagMs;
        }
        if (bound < latest) latest = bound;
      });
      ls[id] = latest;
    }

    return ids.filter((id) => Math.abs(ls[id] - es[id]) < 1).sort();
  }

  export interface Move { id: string; start: string; end: string; }

  /**
   * The minimum shift that restores one edge, in milliseconds. Returns 0 when
   * the edge already holds. The successor keeps its duration - it slides, it
   * does not stretch.
   */
  function repairShift(type: string, lagMs: number, fromStart: number, fromEnd: number, toStart: number, toEnd: number): number {
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
  export function bumpCascade(tasks: Task[], deps: DepRow[], movedId: string, newStart: string, newEnd: string): Move[] {
    const byId: Record<string, Task> = {};
    tasks.forEach((t) => { byId[t.id] = t; });
    const succ: Record<string, DepRow[]> = {};
    deps.forEach((d) => {
      if (!byId[d.from] || !byId[d.to]) return;
      (succ[d.from] = succ[d.from] || []).push(d);
    });

    const window: Record<string, [number, number]> = {};
    tasks.forEach((t) => {
      window[t.id] = [parse(t.start).getTime(), parse(t.end).getTime()];
    });
    if (!window[movedId]) return [];
    window[movedId] = [parse(newStart).getTime(), parse(newEnd).getTime()];

    const out: Move[] = [];
    const seen: Record<string, boolean> = {};
    seen[movedId] = true;
    const queue: string[] = [movedId];

    while (queue.length) {
      const cur = String(queue.shift());
      (succ[cur] || []).forEach((d) => {
        if (seen[d.to]) return;
        const target = byId[d.to];
        if (!target || target.placeholder) return;
        const w = window[d.to];
        const lagMs = Math.round(Number(d.lag) || 0) * 3600000;
        const shift = repairShift(d.type, lagMs, window[cur][0], window[cur][1], w[0], w[1]);
        if (shift <= 0) return;
        w[0] += shift;
        w[1] += shift;
        seen[d.to] = true;
        out.push({
          id: d.to,
          start: fmt(new Date(w[0])),
          end: fmt(new Date(w[1])),
        });
        queue.push(d.to);
      });
    }
    return out;
  }

  /** Kahn topo order; a cycle falls back to sorted order rather than looping. */
  function topoOrder(ids: string[], succ: Record<string, DepRow[]>, pred: Record<string, DepRow[]>): string[] {
    const indeg: Record<string, number> = {};
    ids.forEach((id) => { indeg[id] = (pred[id] || []).length; });
    const out: string[] = [];
    const queue = ids.filter((id) => indeg[id] === 0);
    const seen: Record<string, boolean> = {};
    while (queue.length) {
      const id = String(queue.shift());
      if (seen[id]) continue;
      seen[id] = true;
      out.push(id);
      (succ[id] || []).forEach((d) => {
        indeg[d.to] -= 1;
        if (indeg[d.to] <= 0) queue.push(d.to);
      });
    }
    ids.forEach((id) => { if (!seen[id]) out.push(id); });
    return out;
  }
}
