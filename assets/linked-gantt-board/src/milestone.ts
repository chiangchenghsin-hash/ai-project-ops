/*!
 * BACKGROUND: Renders the PRD milestone layer (invariant I9) into the plan
 * page: one main-line bar per milestone in depends_on order, its work units as
 * indented sub-line bars, explicit dependency relations and critical-path
 * emphasis. I-020 adds a goal layer above the gantt: goal rows with the
 * status / progress / cost / rounds / rework analysis columns, milestones and
 * work units indented beneath their goal; it renders only when /api/plan
 * carries a goals block and degrades to the plain gantt when it does not.
 * When data/milestone-plan.json is missing or invalid it renders an
 * explicit PRD-not-ingested state naming the fix command instead of whitespace.
 * The macOS 27 --glass-alpha slider no longer lives here: I-026 moved the
 * single glass control to the Settings page (app.ts initSettings).
 * CONDITIONS: classic scripts (namespace CP, no ESM); /api/plan is a read-only
 * endpoint served by server.js from db.plan(); all plan-derived text is
 * ASCII-normalised with CP.stripCJK before it reaches the DOM.
 * VERSION: 1.3.0 - I-031 goal-tree manual control: [+]/[-] fold toggles on G/M
 * rows (state in localStorage cp.tree-fold, rolled-up numbers stay on the
 * parent row), HTML5 drag-move of M rows under goals and W rows under
 * milestones through CP.planMove -> PUT /api/plan/structure, a [+ from template]
 * library modal (GET/POST /api/templates, apply through the same write path),
 * work-unit sibling order read from work_units[] (the array a move rewrites),
 * and the R30 layout fix: .ms-scroll no longer shrinks to zero under a tall
 * goal tree, so the gantt block keeps a real height and the whole layer is one
 * vertical scroll. 1.4.0 - I-034 SOP template pack: the library modal groups
 * a SOP category (steps preview, [use] apply control) over the WBS list, an M
 * row gains [save W chain as SOP], and W rows with the additive approval flag
 * render an APPROVAL badge inside the title cell. 1.2.0 - I-020 goal tree + analysis columns above the gantt;
 * I-030 signed lag and nature badges on relation rows.
 */
namespace CP {
  export interface PlanMilestone {
    id: string; name?: string; depends_on?: string | string[];
    start_offset_h?: number; end_offset_h?: number;
    status?: string; completion?: number | string; verify?: string; cost?: number;
    /** I-038: additive plan-only fields on the detail drawer. Owner is free
     *  text metadata; notes is the optional human annotation. Neither is
     *  gated, synced to the PRD, or shown as a tree column. */
    owner?: string; notes?: string;
  }
  export interface PlanWorkUnit {
    id: string; milestone_id?: string; title?: string; owner?: string; owner_type?: string;
    start_offset_h?: number; end_offset_h?: number; status?: string; progress?: number;
    tier?: string; billed?: number; cost?: number;
    /** I-038: optional plan-only annotation (the drawer's notes field). */
    notes?: string;
    /** I-034: additive plan-only approval flag on an SOP gate step (same
     *  additive rule as notes/owner). Absent/false = a normal row; true
     *  renders the APPROVAL badge and floors the card gate to needs-ack. */
    approval?: boolean;
  }
  export interface PlanRelation {
    from: string; to: string; type?: string; lag?: number;
    /** I-030: optional nature, frozen vocab mandatory|discretionary|external;
     *  '' (or absent) means unspecified and renders no badge. */
    nature?: string;
  }
  /** I-020: one goal groups its milestones; every milestone sits in exactly
   *  one goal (the server derives this, the panel only renders it). */
  export interface PlanGoal {
    id: string; title?: string; milestone_ids?: string[] | string;
    /** I-038: additive plan-only fields, same rule as the milestone ones. */
    owner?: string; notes?: string;
  }
  /** I-020: one analysis row per milestone id and per work-unit id. */
  export interface PlanNodeAnalysis {
    status?: string; progress?: number; cost?: number;
    rounds?: string[]; rework?: number;
  }
  export interface Plan {
    available?: boolean; state?: string; label?: string; detail?: string;
    message?: string; fix_command?: string; schema?: string;
    milestones?: PlanMilestone[]; work_units?: PlanWorkUnit[];
    relations?: PlanRelation[]; main_line?: string[]; sub_lines?: Record<string, string[]>;
    /** Absent on an old server: the goal layer then degrades to no tree. */
    goals?: PlanGoal[];
    analysis?: Record<string, PlanNodeAnalysis>;
  }

  const PX = 8;

  /** I-031: last plan handed to applyPlan - the drag/drop position maths and
   *  the template modal read sibling order from it, never from the DOM alone. */
  let lastPlan: Plan | null = null;
  /** Active row drag (HTML5 DnD); '' when no row drag is in flight. */
  let dragNodeId = '';
  let dragNodeKind = '';
  /** I-038: ms of the last row drag start/end; a click inside the 350ms tail
   *  belongs to the drag, not to the detail drawer. */
  let rowDragAt = 0;
  /** Currently open drawer node; null when the drawer is closed. */
  let drawerSel: { kind: string; id: string } | null = null;
  /** localStorage cp.tree-fold: JSON id -> bool map, true = folded (hidden). */
  const FOLD_KEY = 'cp.tree-fold';

  function readFoldMap(): Record<string, boolean> {
    try {
      const raw = localStorage.getItem(FOLD_KEY);
      if (!raw) return {};
      const v = JSON.parse(raw);
      return v && typeof v === 'object' ? (v as Record<string, boolean>) : {};
    } catch (_e) { return {}; }
  }
  function writeFoldMap(map: Record<string, boolean>): void {
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(map)); } catch (_e) { /* storage blocked */ }
  }
  function isFolded(id: string): boolean { return readFoldMap()[id] === true; }

  /** W sibling order the renderer follows: work_units[] array order first
   *  (the array planStructureUpdate rewrites on a move), sub_lines membership
   *  as the fallback for ids the work_units list does not carry. */
  function wuIdsFor(workUnits: PlanWorkUnit[], subLines: Record<string, string[]>,
                    mid: string): string[] {
    const out: string[] = [];
    const seen: Record<string, boolean> = {};
    workUnits.forEach((w) => {
      if (String(w.milestone_id) === mid) {
        const id = String(w.id);
        if (!seen[id]) { out.push(id); seen[id] = true; }
      }
    });
    const sub = Array.isArray(subLines[mid]) ? subLines[mid] : [];
    sub.forEach((raw) => {
      const id = String(raw);
      if (!seen[id]) { out.push(id); seen[id] = true; }
    });
    return out;
  }

  /** HTML-safe, CJK-free text for any plan-derived value. */
  function txt(v: unknown): string {
    return esc(stripCJK(v === undefined || v === null ? '' : String(v)));
  }
  function num(v: unknown, d: number = 0): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  /** depends_on may be a single id, an array, or a delimited string. */
  function depsOf(m: PlanMilestone): string[] {
    const d = m.depends_on;
    if (!d) return [];
    if (Array.isArray(d)) return d.map(String);
    return String(d).split(/[,;\s]+/).filter(Boolean);
  }

  /** Kahn topological order so the main line reads in depends_on order. */
  function topoMilestones(list: PlanMilestone[]): PlanMilestone[] {
    const byId: Record<string, PlanMilestone> = {};
    const indeg: Record<string, number> = {};
    const succ: Record<string, string[]> = {};
    list.forEach((m) => {
      const id = String(m.id);
      byId[id] = m; indeg[id] = 0; succ[id] = [];
    });
    list.forEach((m) => {
      const id = String(m.id);
      depsOf(m).forEach((dep) => {
        if (byId[dep] && succ[dep]) { succ[dep].push(id); indeg[id] += 1; }
      });
    });
    const out: string[] = [];
    const seen: Record<string, boolean> = {};
    const queue = list.filter((m) => indeg[String(m.id)] === 0).map((m) => String(m.id));
    while (queue.length) {
      const id = String(queue.shift());
      if (seen[id]) continue;
      seen[id] = true;
      out.push(id);
      (succ[id] || []).forEach((n) => { indeg[n] -= 1; if (indeg[n] <= 0) queue.push(n); });
    }
    list.forEach((m) => { const id = String(m.id); if (!seen[id]) { out.push(id); seen[id] = true; } });
    return out.map((id) => byId[id]).filter((m): m is PlanMilestone => m !== undefined);
  }

  /** $0 / $0.6k / $2.1k, exactly the cost shapes in the signed I-020 mockup.
   *  Plan costs are k-denominated (the server sums work-unit cost fields). */
  function fmtCost(v: unknown): string {
    const n = num(v);
    if (!n) return '$0';
    return '$' + (Math.round(n * 10) / 10) + 'k';
  }

  /** "R24 R26" or "none": deduped, sorted, ASCII-only round ids. */
  function fmtRounds(list: unknown): string {
    const set: Record<string, true> = {};
    if (Array.isArray(list)) {
      list.forEach((r) => {
        const s = stripCJK(String(r === undefined || r === null ? '' : r)).trim();
        if (s) set[s] = true;
      });
    }
    const out = Object.keys(set).sort();
    return out.length ? out.join(' ') : 'none';
  }

  /** One status vocabulary so the goal rollup can compare child rows. */
  function normStatus(v: unknown): string {
    const s = stripCJK(String(v === undefined || v === null ? '' : v)).trim().toLowerCase();
    if (s === 'done' || s === 'complete' || s === 'completed') return 'done';
    if (s === 'in_progress' || s === 'in-progress' || s === 'active' || s === 'doing') return 'in_progress';
    return 'todo';
  }

  /** milestone_ids may be an array or a delimited string (same rule as deps). */
  function goalMids(g: PlanGoal): string[] {
    const d = g.milestone_ids;
    if (!d) return [];
    if (Array.isArray(d)) return d.map(String);
    return String(d).split(/[,;\s]+/).filter(Boolean);
  }

  /** I-020 goal tree + analysis columns, rendered as selectable plain text
   *  above the gantt. Returns '' when the server is an older one without a
   *  goals block, so the view degrades to exactly today's render. */
  function goalTreeHtml(plan: Plan, milestones: PlanMilestone[], workUnits: PlanWorkUnit[],
                        subLines: Record<string, string[]>): string {
    const goals = plan.goals || [];
    if (!goals.length) return '';
    const ana: Record<string, PlanNodeAnalysis> = plan.analysis || {};
    const msById: Record<string, PlanMilestone> = {};
    milestones.forEach((m) => { msById[String(m.id)] = m; });
    const wuById: Record<string, PlanWorkUnit> = {};
    workUnits.forEach((w) => { wuById[String(w.id)] = w; });

    const wuIdsOf = (mid: string): string[] => wuIdsFor(workUnits, subLines, mid);
    const msStats = (mid: string): { st: string; prog: number; cost: number; rounds: unknown; rework: number } => {
      const m = msById[mid];
      const a = ana[mid] || {};
      const prog = a.progress !== undefined ? num(a.progress) : num(m && m.completion);
      return {
        st: a.status || (m && m.status) || (prog >= 100 ? 'done' : 'todo'),
        prog, cost: num(a.cost, num(m && m.cost)), rounds: a.rounds, rework: num(a.rework),
      };
    };
    const wuStats = (wid: string): { st: string; prog: number; cost: number; rounds: unknown; rework: number } => {
      const w = wuById[wid];
      const a = ana[wid] || {};
      const prog = a.progress !== undefined ? num(a.progress) : num(w && w.progress);
      return {
        st: a.status || (w && w.status) || (prog >= 100 ? 'done' : 'todo'),
        prog, cost: num(a.cost, num(w && w.cost)), rounds: a.rounds, rework: num(a.rework),
      };
    };
    const row = (kind: string, id: string, title: string, st: string, prog: number,
                 cost: number, rounds: unknown, rework: number, depth: number,
                 approval = false): string => {
      const badge = st ? '[' + txt(st) + ']' : '';
      /* I-034: APPROVAL badge rides inside the title cell so no column shifts
         for the rows that do not carry it. */
      const appr = approval ? '<span class="ms-approval">APPROVAL</span>' : '';
      /* I-031: G/M rows carry a [+]/[-] fold toggle and a [+ from template]
         button; W rows are leaves (spacer only) and are never foldable. */
      const foldable = kind === 'goal' || kind === 'ms';
      const foldState = foldable && isFolded(id);
      const foldHtml = foldable
        ? `<span class="ms-a-fold" data-fold="${txt(id)}" role="button" tabindex="0"`
          + ` aria-expanded="${foldState ? 'false' : 'true'}"`
          + ` title="Show or hide children">${foldState ? '[+]' : '[-]'}</span>`
        : `<span class="ms-a-fold" aria-hidden="true"></span>`;
      const tplHtml = foldable
        ? `<span class="ms-a-tpl"><button type="button" class="ms-tpl-btn"`
          + ` data-tpl="${txt(id)}">[+ from template]</button></span>`
        : `<span class="ms-a-tpl" aria-hidden="true"></span>`;
      /* I-038 add-child: G rows gain [+ new milestone], M rows gain
         [+ new work unit]; W rows keep the spacer (leaves create nothing). */
      const addHtml = kind === 'goal' || kind === 'ms'
        ? `<span class="ms-a-add"><button type="button" class="ms-add-btn"`
          + ` data-add="${kind === 'goal' ? 'ms' : 'wu'}"`
          + ` title="${kind === 'goal' ? 'Add a milestone under this goal' : 'Add a work unit under this milestone'}"`
          + ` aria-label="${kind === 'goal' ? 'New milestone' : 'New work unit'}">[+]</button></span>`
        : `<span class="ms-a-add" aria-hidden="true"></span>`;
      /* I-031: M and W rows drag; goal rows are roots and stay put. */
      const draggable = (kind === 'ms' || kind === 'wu') ? ' draggable="true"' : '';
      return `<div class="ms-goal-row ms-a-${kind}" data-kind="${kind}" data-node="${txt(id)}" style="--depth:${depth}"${draggable}>${foldHtml}
        <span class="ms-a-id">${txt(id)}</span><span class="ms-a-title">${txt(title)}${appr}</span>
        <span class="ms-a-status">${badge}</span><span class="ms-a-progress">${Math.round(prog)}%</span>
        <span class="ms-a-cost">${fmtCost(cost)}</span>
        <span class="ms-a-rounds">rounds: ${fmtRounds(rounds)}</span>
        <span class="ms-a-rework">rework: ${num(rework)}</span>${tplHtml}${addHtml}</div>`;
    };

    let body = '';
    goals.forEach((g) => {
      const gid = String(g.id);
      const mids = goalMids(g);
      const sts = mids.map((mid) => normStatus(msStats(mid).st));
      const gSt = !sts.length ? 'todo'
        : sts.every((s) => s === 'done') ? 'done'
        : sts.every((s) => s === 'todo') ? 'todo' : 'in_progress';
      const gProg = mids.length ? mids.reduce((s, mid) => s + msStats(mid).prog, 0) / mids.length : 0;
      const gCost = mids.reduce((s, mid) => s + msStats(mid).cost, 0);
      /* rounds/rework: union and sum over the whole subtree, because a ledger
       * entry may name a work unit without naming its milestone. */
      const gRounds: string[] = [];
      let gRework = 0;
      mids.forEach((mid) => {
        const ids = [mid].concat(wuIdsOf(mid));
        ids.forEach((id) => {
          const a = ana[id] || {};
          if (Array.isArray(a.rounds)) a.rounds.forEach((x) => gRounds.push(x));
          gRework += num(a.rework);
        });
      });
      body += `<div class="ms-goal-group" data-goal="${txt(gid)}">`;
      body += row('goal', gid, g.title || gid, gSt, gProg, gCost, gRounds, gRework, 0);
      /* I-031: fold state applies at render so a reload restores the folds. */
      body += `<div class="ms-goal-children${isFolded(gid) ? ' is-folded' : ''}">`;
      mids.forEach((mid) => {
        const ms = msStats(mid);
        body += row('ms', mid, (msById[mid] && msById[mid].name) || mid,
          ms.st, ms.prog, ms.cost, ms.rounds, ms.rework, 1);
        body += `<div class="ms-goal-sub${isFolded(mid) ? ' is-folded' : ''}">`;
        wuIdsOf(mid).forEach((wid) => {
          const ws = wuStats(wid);
          const w = wuById[wid];
          body += row('wu', wid, (w && w.title) || wid,
            ws.st, ws.prog, ws.cost, ws.rounds, ws.rework, 2,
            !!(w && w.approval));
        });
        body += '</div>';
      });
      body += '</div></div>';
    });

    return `<div class="ms-goal-tree" id="msGoalTree">
      <div class="ms-goal-row ms-a-head" data-kind="head">
        <span class="ms-a-fold" aria-hidden="true"></span>
        <span class="ms-a-id">PLAN</span><span class="ms-a-title">goal tree</span>
        <span class="ms-a-status">status</span><span class="ms-a-progress">progress</span>
        <span class="ms-a-cost">cost</span><span class="ms-a-rounds">rounds</span>
        <span class="ms-a-rework">rework</span>
        <span class="ms-a-tpl" aria-hidden="true"></span>
        <span class="ms-a-add" aria-hidden="true"></span>
      </div>${body}</div>`;
  }

  function renderEmpty(layer: HTMLElement, plan: Plan | null): void {
    const p = plan || ({} as Plan);
    const label = txt(p.label || 'PRD not ingested');
    const detail = txt(p.detail || 'The milestone plan has no main line, sub-lines or relations.');
    const fix = txt(p.fix_command || 'node scripts/prd-to-action.js');
    const message = txt(p.message || '');
    layer.innerHTML = `<div class="ms-empty">
      <div class="ms-empty-title">${label}</div>
      <p class="ms-empty-detail">${detail}</p>
      <div class="ms-empty-fix">Fix command: <code>${fix}</code></div>
      ${message ? `<p class="ms-empty-hint">${message}</p>` : ''}
      <p class="ms-empty-hint">This writes data/milestone-plan.json; refresh the page after it exists.</p>
    </div>`;
  }

  /** Render one plan object. Exposed so a verifier can exercise the layer with
   *  a deterministic fixture even while the real PRD ingest is still pending. */
  export function applyPlan(plan: Plan): void {
    lastPlan = plan || null;
    const layer = document.getElementById('milestoneLayer');
    if (!layer) return;
    if (!plan || plan.available !== true || !plan.milestones || !plan.milestones.length) {
      renderEmpty(layer, plan);
      return;
    }

    const milestones = topoMilestones(plan.milestones);
    const workUnits = plan.work_units || [];
    const relations = plan.relations || [];
    const mainLine = plan.main_line || [];
    const subLines = plan.sub_lines || {};

    const allH: number[] = [0];
    milestones.forEach((m) => { allH.push(num(m.start_offset_h), num(m.end_offset_h)); });
    workUnits.forEach((w) => { allH.push(num(w.start_offset_h), num(w.end_offset_h)); });
    const minH = Math.min(...allH);
    const maxH = Math.max(...allH);
    const span = Math.max(24, maxH - minH);
    const axisW = Math.ceil((span + 12) * PX);
    layer.style.setProperty('--ms-w', axisW + 'px');

    const xOf = (h: number): number => Math.round((h - minH + 6) * PX);
    const wOf = (s: number, e: number): number => Math.max(24, Math.round((e - s) * PX));

    const critical: Record<string, boolean> = {};
    mainLine.forEach((id) => { critical[String(id)] = true; });

    let ticks = '';
    for (let h = minH; h <= maxH + 12; h += 12) {
      ticks += `<span class="ms-tick" style="left:${xOf(h)}px">+${Math.round(h - minH)}h</span>`;
    }

    const wuById: Record<string, PlanWorkUnit> = {};
    workUnits.forEach((w) => { wuById[String(w.id)] = w; });

    let groups = '';
    milestones.forEach((m) => {
      const mid = String(m.id);
      const crit = critical[mid] ? ' ms-critical' : '';
      const s = num(m.start_offset_h);
      const e = num(m.end_offset_h, s + 12);
      const depBadges = depsOf(m).map((d) => `<span class="ms-dep">after ${txt(d)}</span>`).join('');
      const mainBar = `<div class="ms-main${crit}" style="left:${xOf(s)}px;width:${wOf(s, e)}px"><span class="ms-bar-label">${txt(mid)} ${txt(m.name || mid)} [${txt(m.status || '')} ${num(m.completion)}%]</span></div>`;
      const head = `<div class="ms-row ms-main-row">
        <div class="ms-label ms-main-label"><span class="ms-id">${txt(mid)}</span><span class="ms-name">${txt(m.name || mid)}</span>${depBadges}
          <span class="ms-meta">${txt(m.status || '')} | completion ${num(m.completion)}% | verify ${txt(m.verify || '')}</span></div>
        <div class="ms-track">${mainBar}</div>
      </div>`;

      let ids: string[] = wuIdsFor(workUnits, subLines, mid);
      let subs = '';
      ids.forEach((wid) => {
        const w = wuById[wid] || ({ id: wid } as PlanWorkUnit);
        const ws = num(w.start_offset_h, s);
        const we = num(w.end_offset_h, ws + 8);
        const subBar = `<div class="ms-sub" style="left:${xOf(ws)}px;width:${wOf(ws, we)}px"><span class="ms-bar-label">${txt(wid)}</span></div>`;
        subs += `<div class="ms-row ms-sub-row" data-wu="${txt(wid)}">
          <div class="ms-label ms-sub-label"><span class="ms-id">${txt(wid)}</span>${txt(w.title || wid)} - ${txt(w.owner || '')} | ${num(w.progress)}%</div>
          <div class="ms-track">${subBar}</div>
        </div>`;
      });
      groups += `<div class="ms-group" data-ms="${txt(mid)}">${head}<div class="ms-subrows">${subs}</div></div>`;
    });

    let rels = '<div class="ms-rel-title">Dependency relations (explicit edges)</div>';
    relations.forEach((r) => {
      const lag = num(r.lag);
      /* I-030: signed lag as locked by the R29 acceptance - "FS-2d" for -2,
         "FS+3d" for +3; a zero lag renders no token at all. A negative lag is
         a lead, so the sign is carried through verbatim. */
      const lagHtml = lag !== 0
        ? `<span class="ms-rel-lag">${lag > 0 ? '+' : ''}${lag}d</span>` : '';
      /* I-030: optional nature badge; absent or '' stays unspecified. */
      const natureRaw = String(r.nature === undefined || r.nature === null ? '' : r.nature).trim();
      const natureHtml = natureRaw ? `<span class="ms-rel-nature">${txt(natureRaw)}</span>` : '';
      rels += `<div class="ms-rel"><span class="ms-rel-from">${txt(r.from)}</span><span class="ms-rel-arrow">-&gt;</span><span class="ms-rel-to">${txt(r.to)}</span><span class="ms-rel-type">${txt(r.type || 'FS')}</span>${lagHtml}${natureHtml}</div>`;
    });

    const critNote = `<div class="ms-critical-note">Critical path: ${mainLine.map((id) => txt(id)).join(' -&gt; ') || '(none declared)'}</div>`;

    /* I-020: goal layer on top, gantt below; '' on an old server. */
    const goalTree = goalTreeHtml(plan, milestones, workUnits, subLines);

    layer.innerHTML = `${goalTree}<div class="ms-legend">
      <span class="ms-legend-item ms-legend-main">MAIN LINE</span>
      <span class="ms-legend-item ms-legend-sub">SUB-LINES</span>
      <span class="ms-legend-item ms-legend-rel">RELATIONS</span>
      <span class="ms-legend-item ms-legend-crit">CRITICAL PATH</span>
      <span class="ms-legend-state" id="msState">${txt(plan.state || 'READY')} | ${milestones.length} main | ${workUnits.length} sub | ${relations.length} rel</span>
    </div>
    <div class="ms-axis"><div class="ms-corner">Milestone | main line + sub-lines + relations</div>
      <div class="ms-ticks">${ticks}</div></div>
    <div class="ms-scroll"><div class="ms-layer-inner">
      <div class="ms-rows">${groups}</div>
      <div class="ms-relations">${rels}</div>
      ${critNote}
    </div></div>`;
  }

  /** Re-read the real plan through the service and re-render. */
  export async function refreshPlan(): Promise<void> {
    try {
      const r = await fetch('/api/plan', { cache: 'no-store' });
      applyPlan(await r.json() as Plan);
    } catch (e) {
      const layer = document.getElementById('milestoneLayer');
      if (layer) renderEmpty(layer, {
        available: false, state: 'PLAN_FETCH_FAILED', label: 'Milestone plan unavailable',
        detail: String(e), fix_command: 'node scripts/prd-to-action.js', message: '',
      });
    }
  }

  /* ---- I-031 goal-tree manual control: fold, drag-move, template library -- */

  function rowElOf(id: string): HTMLElement | null {
    const rows = document.querySelectorAll<HTMLElement>('.ms-goal-row');
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].dataset.node === id) return rows[i];
    }
    return null;
  }

  /** The box a fold toggle hides: a goal's children column, a milestone's
   *  work-unit sub box (the element right after the row). W rows are leaves. */
  function childrenBoxOf(row: HTMLElement): Element | null {
    const kind = row.dataset.kind || '';
    if (kind === 'goal') {
      const group = row.parentElement;
      return group ? group.querySelector(':scope > .ms-goal-children') : null;
    }
    if (kind === 'ms') return row.nextElementSibling;
    return null;
  }

  function applyFoldDom(id: string, folded: boolean): void {
    const row = rowElOf(id);
    if (!row) return;
    const box = childrenBoxOf(row);
    if (box) box.classList.toggle('is-folded', folded);
    const btn = row.querySelector('[data-fold]') as HTMLElement | null;
    if (btn) {
      btn.textContent = folded ? '[+]' : '[-]';
      btn.setAttribute('aria-expanded', folded ? 'false' : 'true');
    }
  }

  function onTreeClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;
    const foldEl = target.closest('[data-fold]') as HTMLElement | null;
    if (foldEl) {
      e.preventDefault();
      const id = foldEl.dataset.fold || '';
      if (!id) return;
      /* I-031 line 1: per-node fold state in localStorage cp.tree-fold. */
      const map = readFoldMap();
      map[id] = map[id] !== true;
      writeFoldMap(map);
      applyFoldDom(id, map[id] === true);
      return;
    }
    const tplEl = target.closest('[data-tpl]') as HTMLElement | null;
    if (tplEl) {
      e.preventDefault();
      const nodeId = tplEl.dataset.tpl || '';
      const tplRow = tplEl.closest('.ms-goal-row') as HTMLElement | null;
      const tplKind = tplRow && tplRow.dataset.kind === 'ms' ? 'ms' : 'goal';
      if (nodeId) void openTemplateLibrary(nodeId, tplKind);
      return;
    }
    const addEl = target.closest('[data-add]') as HTMLElement | null;
    if (addEl) {
      e.preventDefault();
      const addRow = addEl.closest('.ms-goal-row') as HTMLElement | null;
      const parentId = addRow ? addRow.dataset.node || '' : '';
      if (parentId) {
        void planNodeCreate(addEl.dataset.add === 'wu' ? 'create-work-unit' : 'create-milestone',
          parentId);
      }
      return;
    }
    /* I-038: clicking anywhere else on a G/M/W row opens the detail drawer.
       The fold toggle and [+ from template] returned above; the head row has
       no data-node; a tail-of-drag click is ignored (rowDragAt). */
    const row = target.closest('.ms-goal-row') as HTMLElement | null;
    if (row && row.dataset.node && row.dataset.kind && row.dataset.kind !== 'head') {
      if (Date.now() - rowDragAt < 350) return;
      e.preventDefault();
      openNodeDrawer(row.dataset.kind, row.dataset.node);
    }
  }

  function isValidDrop(dragKind: string, dragId: string,
                       targetKind: string, targetId: string): boolean {
    if (!dragId || !targetId || dragId === targetId) return false;
    if (dragKind === 'ms') return targetKind === 'goal' || targetKind === 'ms';
    if (dragKind === 'wu') return targetKind === 'ms' || targetKind === 'wu';
    return false;
  }

  function setDropHighlight(on: boolean): void {
    document.querySelectorAll<HTMLElement>('.ms-goal-row').forEach((row) => {
      const ok = on && isValidDrop(dragNodeKind, dragNodeId,
        row.dataset.kind || '', row.dataset.node || '');
      row.classList.toggle('is-drop-ok', ok);
    });
  }

  function onTreeDragStart(e: DragEvent): void {
    const target = e.target as HTMLElement | null;
    const row = target && typeof target.closest === 'function'
      ? target.closest('.ms-goal-row') as HTMLElement | null : null;
    if (!row) return;
    const kind = row.dataset.kind || '';
    if (kind !== 'ms' && kind !== 'wu') return;
    const id = row.dataset.node || '';
    if (!id) return;
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
    }
    dragNodeId = id;
    dragNodeKind = kind;
    /* I-038: a click that trails a row drag is the drag tail, never a
       drawer-open intent ("not a drag" in the R32 lock). */
    rowDragAt = Date.now();
    setDropHighlight(true);
  }

  function onTreeDragOver(e: DragEvent): void {
    if (!dragNodeId) return;
    const target = e.target as HTMLElement | null;
    const row = target && typeof target.closest === 'function'
      ? target.closest('.ms-goal-row') as HTMLElement | null : null;
    if (!row) return;
    /* Invalid targets never preventDefault, so the browser refuses the drop
       there: zero writes without even reaching the server. */
    if (!isValidDrop(dragNodeKind, dragNodeId, row.dataset.kind || '', row.dataset.node || '')) {
      return;
    }
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }

  function onTreeDragEnd(): void {
    dragNodeId = '';
    dragNodeKind = '';
    rowDragAt = Date.now();
    setDropHighlight(false);
  }

  /** Server semantics: the dragged row leaves its old list first, so a drop
   *  before a later sibling in the same list shifts the insertion index by
   *  one. `to` is the target position in the ORIGINAL list (len = append). */
  function insertIndexOf(list: string[], to: number, dragId: string): number {
    const from = list.indexOf(dragId);
    let idx = to;
    if (from >= 0 && from < to) idx -= 1;
    return Math.max(0, idx);
  }

  function dropPositionOf(targetRow: HTMLElement): { parent: string; index: number } | null {
    const plan = lastPlan;
    if (!plan) return null;
    const tKind = targetRow.dataset.kind || '';
    const tId = targetRow.dataset.node || '';
    if (!isValidDrop(dragNodeKind, dragNodeId, tKind, tId)) return null;
    const goals = plan.goals || [];
    const midsOfGoal = (gid: string): string[] => {
      const g = goals.filter((x) => String(x.id) === gid)[0];
      return g && Array.isArray(g.milestone_ids) ? g.milestone_ids.map(String) : [];
    };
    const goalOfMs = (mid: string): string => {
      const g = goals.filter((x) => midsOfGoal(String(x.id)).indexOf(mid) >= 0)[0];
      return g ? String(g.id) : '';
    };
    const seqOfM = (mid: string): string[] =>
      wuIdsFor(plan.work_units || [], plan.sub_lines || {}, mid);
    if (tKind === 'goal') {
      const list = midsOfGoal(tId);
      return { parent: tId, index: insertIndexOf(list, list.length, dragNodeId) };
    }
    if (tKind === 'ms' && dragNodeKind === 'ms') {
      const gid = goalOfMs(tId);
      if (!gid) return null;
      const list = midsOfGoal(gid);
      const to = list.indexOf(tId);
      if (to < 0) return null;
      return { parent: gid, index: insertIndexOf(list, to, dragNodeId) };
    }
    if (tKind === 'ms' && dragNodeKind === 'wu') {
      const list = seqOfM(tId);
      return { parent: tId, index: insertIndexOf(list, list.length, dragNodeId) };
    }
    if (tKind === 'wu' && dragNodeKind === 'wu') {
      const w = (plan.work_units || []).filter((x) => String(x.id) === tId)[0];
      const parentM = w ? String(w.milestone_id || '') : '';
      if (!parentM) return null;
      const list = seqOfM(parentM);
      const to = list.indexOf(tId);
      if (to < 0) return null;
      return { parent: parentM, index: insertIndexOf(list, to, dragNodeId) };
    }
    return null;
  }

  function onTreeDrop(e: DragEvent): void {
    if (!dragNodeId) return;
    const target = e.target as HTMLElement | null;
    const row = target && typeof target.closest === 'function'
      ? target.closest('.ms-goal-row') as HTMLElement | null : null;
    const dragId = dragNodeId;
    const pos = row ? dropPositionOf(row) : null;
    e.preventDefault();
    dragNodeId = '';
    dragNodeKind = '';
    setDropHighlight(false);
    if (!pos) return;
    void planMove(dragId, pos.parent, pos.index);
  }

  /** Drop path (and test seam): PUT /api/plan/structure {kind:'move'} then
   *  re-read the plan. Rejections surface as a toast and return false. */
  export async function planMove(id: string, newParent: string, index: number): Promise<boolean> {
    try {
      const r = await fetch('/api/plan/structure', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'move', id, new_parent: newParent, index }),
      });
      if (!r.ok) {
        let msg = 'HTTP ' + r.status;
        try {
          const err = await r.json() as { error?: string };
          if (err && err.error) msg = String(err.error);
        } catch (_e) { /* non-JSON body */ }
        toast('Move rejected: ' + msg);
        return false;
      }
      await refreshPlan();
      toast('Moved ' + id);
      return true;
    } catch (e) {
      toast('Move failed: ' + String(e));
      return false;
    }
  }

  /** Apply a stored WBS template under a G/M row through the same validated
   *  structure-write path (fresh ids, todo / 0 placeholders). */
  export async function applyTemplateAt(target: string, templateId: string): Promise<boolean> {
    try {
      const r = await fetch('/api/plan/structure', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'apply-template', target, template_id: templateId }),
      });
      if (!r.ok) {
        let msg = 'HTTP ' + r.status;
        try {
          const err = await r.json() as { error?: string };
          if (err && err.error) msg = String(err.error);
        } catch (_e) { /* non-JSON body */ }
        toast('Template rejected: ' + msg);
        return false;
      }
      await refreshPlan();
      toast('Template applied under ' + target);
      return true;
    } catch (e) {
      toast('Template apply failed: ' + String(e));
      return false;
    }
  }

  interface TemplateRow {
    id: string; name: string; provenance: string; kind: string; created: string;
    n_milestones: number; n_work_units: number;
    /** I-034: present on SOP rows only - the ordered chain preview. */
    steps?: { title: string; approval: boolean }[];
  }

  /** [+ from template] modal: apply any library entry at this row ([use]),
   *  or save the subtree / W chain as a named template (POST /api/templates).
   *  I-034: the library carries a SOP category (the two seeded process
   *  templates + any saved chain) with a steps preview, and an M row gains
   *  the [save W chain as SOP] control for the round-trip save. */
  async function openTemplateLibrary(nodeId: string, nodeKind: string): Promise<void> {
    try {
      const r = await fetch('/api/templates', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json() as { templates?: TemplateRow[] };
      const list = Array.isArray(data.templates) ? data.templates : [];
      const isMs = nodeKind === 'ms';
      const item = (t: TemplateRow): string => {
        const steps = Array.isArray(t.steps) ? t.steps : [];
        const stepLine = steps.length
          ? `<span class="tpl-steps">${esc(steps.map((s, i) => (i + 1) + ' ' + s.title + (s.approval ? ' (APPROVAL)' : '')).join(' -> '))}</span>`
          : '';
        const kindTag = t.kind === 'sop' ? '<span class="tpl-kind tpl-kind-sop">SOP</span>'
          : '<span class="tpl-kind">WBS</span>';
        return `<div class="tpl-item${t.kind === 'sop' ? ' tpl-item-sop' : ''}">
          <div class="tpl-meta">
            <strong class="tpl-name">${esc(stripCJK(t.name))}</strong>${kindTag}
            <span class="tpl-prov">${esc(stripCJK(t.provenance))}</span>
            <span class="tpl-counts">${num(t.n_milestones)} milestones / ${num(t.n_work_units)} work units</span>
            ${stepLine}
          </div>
          <button type="button" class="btn mini" data-tpl-apply="${esc(t.id)}" data-tpl-target="${esc(nodeId)}">[use]</button>
        </div>`;
      };
      const sops = list.filter((t) => t.kind === 'sop');
      const wbs = list.filter((t) => t.kind !== 'sop');
      const sections = (sops.length ? `<h4 class="tpl-cat">SOP</h4><div class="tpl-list">${sops.map(item).join('')}</div>` : '')
        + (wbs.length ? `<h4 class="tpl-cat">WBS</h4><div class="tpl-list">${wbs.map(item).join('')}</div>` : '');
      openPanelModal(`<h3>Template library</h3>
        <p class="modal-sub">[use] applies an entry under ${esc(nodeId)}. WBS instances get todo / 0 placeholders; SOP chains land as pending work units with FS links (lag 0, mandatory) and an APPROVAL gate step.</p>
        ${sections || '<p class="modal-sub">No templates yet.</p>'}
        <div class="tpl-save-row">
          <input id="tplSaveName" maxlength="60" placeholder="New template name" autocomplete="off">
          <button type="button" class="btn btn-primary" data-tpl-save="${esc(nodeId)}" data-tpl-kind="${esc(nodeKind)}">Save subtree as template</button>
          ${isMs ? `<button type="button" class="btn" data-tpl-save-sop="${esc(nodeId)}">[save W chain as SOP]</button>` : ''}
        </div>
        <div class="modal-actions"><button type="button" class="btn" data-action="close">Close</button></div>`);
    } catch (e) {
      toast('Template library unavailable: ' + String(e));
    }
  }

  async function onTemplateModalClick(e: MouseEvent): Promise<void> {
    const target = e.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;
    /* I-038: the confirm dialog's cascade button (Cancel uses the shared
       data-action="close" path in app.ts and writes nothing). */
    const delBtn = target.closest('#ndDoDelete') as HTMLElement | null;
    if (delBtn) {
      await planNodeDeleteConfirmed();
      return;
    }
    const applyBtn = target.closest('[data-tpl-apply]') as HTMLElement | null;
    if (applyBtn) {
      const tid = applyBtn.dataset.tplApply || '';
      const tgt = applyBtn.dataset.tplTarget || '';
      if (!tid || !tgt) return;
      const ok = await applyTemplateAt(tgt, tid);
      if (ok) closePanelModal();
      return;
    }
    /* I-034: [save W chain as SOP] - same door, as_sop marks the chain save. */
    const sopBtn = target.closest('[data-tpl-save-sop]') as HTMLElement | null;
    const saveBtn = sopBtn ? null : target.closest('[data-tpl-save]') as HTMLElement | null;
    if (sopBtn || saveBtn) {
      const src = sopBtn ? (sopBtn.dataset.tplSaveSop || '') : (saveBtn!.dataset.tplSave || '');
      const kind = saveBtn ? (saveBtn.dataset.tplKind || '') : 'ms';
      const input = document.getElementById('tplSaveName') as HTMLInputElement | null;
      const name = input ? input.value.trim() : '';
      if (!name) {
        toast('Name the template first');
        if (input) input.focus();
        return;
      }
      try {
        const payload: Record<string, unknown> = { name, source_node: src };
        if (sopBtn) payload.as_sop = true;
        const r = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          let msg = 'HTTP ' + r.status;
          try {
            const err = await r.json() as { error?: string };
            if (err && err.error) msg = String(err.error);
          } catch (_e) { /* non-JSON body */ }
          toast('Save failed: ' + msg);
          return;
        }
        toast(sopBtn ? 'SOP chain saved: ' + name : 'Template saved: ' + name);
        await openTemplateLibrary(src, kind || 'ms');
      } catch (err) {
        toast('Save failed: ' + String(err));
      }
    }
  }

  /* ---- I-038: node detail drawer (read side; save/delete ride the same
   *  plan-structure door in the CRUD wiring) ----------------------------
   *  Clicking a G/M/W row (not the fold toggle, not [+ from template], not a
   *  drag) opens a right-side drawer with the locked field set: name, status,
   *  owner, cost, progress, start/end, the additive plan-only notes field, a
   *  relations summary (upstream/downstream with type + signed lag + nature)
   *  and the audit links (GET /api/tasks/:id/audit: desk events + TASK-LOG
   *  PDCA entry ids for any row kind). Values derived as a rollup (goal and
   *  milestone status/cost/progress, goal time span) render read-only with a
   *  hint, so the drawer can never disagree with the tree columns. */
  const ND_STATUS = ['pending', 'in_progress', 'done', 'skipped'];

  function ndField(label: string, inner: string, hint?: string): string {
    return `<div class="nd-field"><label>${txt(label)}</label>${inner}`
      + (hint ? `<span class="nd-hint">${txt(hint)}</span>` : '') + `</div>`;
  }

  function ndInput(id: string, value: string, ro: boolean, attrs?: string): string {
    return `<input class="nd-input" id="${id}" value="${txt(value)}"`
      + (ro ? ' readonly' : '') + (attrs ? ' ' + attrs : '') + '>';
  }

  function ndStatusSelect(cur: string): string {
    const list = ND_STATUS.indexOf(cur) >= 0 ? ND_STATUS : [cur].concat(ND_STATUS);
    const opts = list.map((s) =>
      `<option value="${txt(s)}"${s === cur ? ' selected' : ''}>${txt(s)}</option>`).join('');
    return `<select class="nd-input" id="ndStatus">${opts}</select>`;
  }

  function ndNotesArea(v: string): string {
    return `<textarea class="nd-input" id="ndNotes" maxlength="500"`
      + ` placeholder="optional plan-only notes">${txt(v)}</textarea>`;
  }

  /** Goal rollup for the drawer: derived status / progress / cost and the
   *  member-milestone time span - the same analysis rows the tree renders,
   *  so goal fields are read-only here by construction. */
  function goalDrawerStats(plan: Plan, g: PlanGoal):
    { st: string; prog: number; cost: number; sH: number; eH: number } {
    const ana = plan.analysis || {};
    const msById: Record<string, PlanMilestone> = {};
    (plan.milestones || []).forEach((m) => { msById[String(m.id)] = m; });
    const mids = goalMids(g);
    const sts: string[] = [];
    let progSum = 0;
    let cost = 0;
    let sH = Number.POSITIVE_INFINITY;
    let eH = Number.NEGATIVE_INFINITY;
    mids.forEach((mid) => {
      const a = ana[mid] || {};
      const m = msById[mid];
      const p = a.progress !== undefined ? num(a.progress) : num(m && m.completion);
      sts.push(String(a.status || (m && m.status) || (p >= 100 ? 'done' : 'todo')));
      progSum += p;
      cost += num(a.cost, num(m && m.cost));
      if (m) {
        sH = Math.min(sH, num(m.start_offset_h));
        eH = Math.max(eH, num(m.end_offset_h));
      }
    });
    const st = !sts.length ? 'todo'
      : sts.every((s) => normStatus(s) === 'done') ? 'done'
      : sts.every((s) => normStatus(s) === 'todo') ? 'todo' : 'in_progress';
    return {
      st, prog: mids.length ? progSum / mids.length : 0, cost,
      sH: Number.isFinite(sH) ? sH : 0, eH: Number.isFinite(eH) ? eH : 0,
    };
  }

  /** Milestone rollup for the drawer: analysis row when present (status,
   *  members-mean progress, member-cost sum), else the status ladder. */
  function msDrawerStats(plan: Plan, m: PlanMilestone): { st: string; prog: number; cost: number } {
    const a = (plan.analysis || {})[String(m.id)] || {};
    const prog = a.progress !== undefined ? num(a.progress) : num(m.completion);
    return {
      st: String(a.status || m.status || (prog >= 100 ? 'done' : 'todo')),
      prog, cost: num(a.cost, num(m.cost)),
    };
  }

  /** FS+2d / SS / FS-2d + optional nature, one pill string (I-029 shape). */
  function ndRelLabel(other: string, type: string, lag: number, nature?: string): string {
    const lg = Math.round(Number(lag) || 0);
    const base = lg ? `${type}${lg > 0 ? '+' : ''}${lg}d` : String(type || 'FS');
    return `${other} ${base}${nature ? ' ' + nature : ''}`;
  }

  interface NdRelations { up: string[]; down: string[]; kids: string[]; }

  /** Upstream / downstream summary + the direct child rows. Work-unit rows
   *  use plan.relations (type + signed lag + nature); milestone rows use the
   *  depends_on graph; goals carry members only (no typed edges exist). */
  function drawerRelations(kind: string, id: string, plan: Plan): NdRelations {
    const rels = plan.relations || [];
    const kids: string[] = [];
    if (kind === 'wu') {
      const up = rels.filter((r) => String(r.to) === id)
        .map((r) => ndRelLabel(String(r.from), String(r.type || 'FS'), num(r.lag), r.nature));
      const down = rels.filter((r) => String(r.from) === id)
        .map((r) => ndRelLabel(String(r.to), String(r.type || 'FS'), num(r.lag), r.nature));
      return { up, down, kids };
    }
    if (kind === 'ms') {
      const m = (plan.milestones || []).filter((x) => String(x.id) === id)[0];
      const up = m ? depsOf(m).map((d) => `${d} (milestone)`) : [];
      const down = (plan.milestones || [])
        .filter((x) => depsOf(x).indexOf(id) >= 0)
        .map((x) => `${String(x.id)} (milestone)`);
      const sub = plan.sub_lines || {};
      (Array.isArray(sub[id]) ? sub[id] : []).forEach((w) => { kids.push(String(w)); });
      return { up, down, kids };
    }
    const g = (plan.goals || []).filter((x) => String(x.id) === id)[0];
    if (g) goalMids(g).forEach((mid) => { kids.push(mid); });
    return { up: [], down: [], kids };
  }

  /** Audit trail inside the drawer. Same endpoint as the card chip: desk
   *  events naming the id + TASK-LOG PDCA entry ids naming it, for any row
   *  kind. Rendering is createElement + textContent only - event detail is
   *  data, never markup. */
  async function ndFillAudit(id: string): Promise<void> {
    const box = document.getElementById('ndAudit');
    if (!box) return;
    box.textContent = 'Loading audit trail...';
    try {
      const r = await fetch('/api/tasks/' + encodeURIComponent(id) + '/audit', { cache: 'no-store' });
      if (!r.ok) throw new Error('audit HTTP ' + r.status);
      const data = await r.json() as { events?: DeskEvent[]; pdca?: string[] };
      if (!drawerSel || drawerSel.id !== id) return;
      const evs = Array.isArray(data.events) ? data.events : [];
      const pdca = Array.isArray(data.pdca) ? data.pdca : [];
      box.textContent = '';
      const head = document.createElement('div');
      head.className = 'nd-audit-head';
      head.textContent = 'Audit trail: ' + id;
      box.appendChild(head);
      const section = (label: string, items: string[]): void => {
        const sec = document.createElement('div');
        sec.className = 'nd-audit-sec';
        sec.textContent = label + ' (' + items.length + ')';
        box.appendChild(sec);
        if (!items.length) {
          const none = document.createElement('div');
          none.className = 'nd-audit-none';
          none.textContent = 'none';
          box.appendChild(none);
          return;
        }
        items.forEach((text) => {
          const li = document.createElement('div');
          li.className = 'nd-audit-item';
          li.textContent = text;
          box.appendChild(li);
        });
      };
      section('desk events', evs.map((ev) => `${ev.ts} ${ev.kind}: ${ev.detail}`));
      section('PDCA entries', pdca);
    } catch (e) {
      if (drawerSel && drawerSel.id === id) box.textContent = 'Audit unavailable: ' + String(e);
    }
  }

  /** Close the drawer (X, Cancel, Escape). Pure UI - closes never write. */
  export function closeNodeDrawer(): void {
    const panel = document.getElementById('nodeDrawer');
    if (panel) panel.classList.add('hidden');
    drawerSel = null;
  }

  /** The node the drawer currently shows; null when closed (test seam). */
  export function openNode(): { kind: string; id: string } | null { return drawerSel; }

  /** Open (or re-point) the detail drawer for one G/M/W row. */
  export function openNodeDrawer(kind: string, id: string): void {
    const panel = document.getElementById('nodeDrawer');
    const body = document.getElementById('ndBody');
    const kindEl = document.getElementById('ndKind');
    const plan = lastPlan;
    if (!panel || !body || !kindEl || !plan) return;
    const g = kind === 'goal'
      ? (plan.goals || []).filter((x) => String(x.id) === id)[0] : undefined;
    const m = kind === 'ms'
      ? (plan.milestones || []).filter((x) => String(x.id) === id)[0] : undefined;
    const w = kind === 'wu'
      ? (plan.work_units || []).filter((x) => String(x.id) === id)[0] : undefined;
    if (!g && !m && !w) return;
    drawerSel = { kind, id };
    kindEl.textContent = id;

    const rel = drawerRelations(kind, id, plan);
    const relGroup = (label: string, items: string[]): string => {
      const pills = items.length
        ? items.map((t) => `<span class="nd-rel">${txt(t)}</span>`).join('')
        : '<span class="nd-none">none</span>';
      return `<div class="nd-group"><div class="nd-group-label">${txt(label)}</div>${pills}</div>`;
    };
    const kidsLabel = kind === 'goal' ? 'members' : 'children';
    const kidsLine = rel.kids.length
      ? `<div class="nd-group"><div class="nd-group-label">${kidsLabel}</div>`
      + `<span class="nd-kids">${txt(rel.kids.join(', '))}</span></div>`
      : '';

    let fields = '';
    if (kind === 'goal' && g) {
      const gs = goalDrawerStats(plan, g);
      fields = ndField('Name', ndInput('ndName', g.title || g.id, false))
        + `<div class="nd-row">`
        + ndField('Status', ndInput('ndStatus', gs.st, true), 'derived rollup')
        + ndField('Owner', ndInput('ndOwner', g.owner || '', false))
        + `</div><div class="nd-row">`
        + ndField('cost', ndInput('ndCost', fmtCost(gs.cost), true), 'sum of member milestones')
        + ndField('progress', ndInput('ndProgress', Math.round(gs.prog) + '%', true), 'mean of member milestones')
        + `</div><div class="nd-row">`
        + ndField('start (h)', ndInput('ndStart', String(gs.sH), true), 'derived span of members')
        + ndField('end (h)', ndInput('ndEnd', String(gs.eH), true))
        + `</div>`
        + ndField('Notes', ndNotesArea(g.notes || ''));
    } else if (kind === 'ms' && m) {
      const ms = msDrawerStats(plan, m);
      fields = ndField('Name', ndInput('ndName', m.name || m.id, false))
        + `<div class="nd-row">`
        + ndField('Status', ndStatusSelect(ms.st))
        + ndField('Owner', ndInput('ndOwner', m.owner || '', false))
        + `</div><div class="nd-row">`
        + ndField('cost', ndInput('ndCost', fmtCost(ms.cost), true), 'sum of work units (rollup)')
        + ndField('progress', ndInput('ndProgress', Math.round(ms.prog) + '%', true), 'derived from work units')
        + `</div><div class="nd-row">`
        + ndField('start (h)', ndInput('ndStart', String(num(m.start_offset_h)), false, 'type="number" step="1"'))
        + ndField('end (h)', ndInput('ndEnd', String(num(m.end_offset_h)), false, 'type="number" step="1"'))
        + `</div>`
        + ndField('Notes', ndNotesArea(m.notes || ''));
    } else if (kind === 'wu' && w) {
      fields = ndField('Name', ndInput('ndName', w.title || w.id, false))
        + `<div class="nd-row">`
        + ndField('Status', ndStatusSelect(String(w.status || 'pending')))
        + ndField('Owner', ndInput('ndOwner', w.owner || '', false))
        + `</div><div class="nd-row">`
        + ndField('cost', ndInput('ndCost', String(num(w.cost)), false, 'type="number" step="0.01" min="0"'))
        + ndField('progress', ndInput('ndProgress', String(num(w.progress)), false, 'type="number" step="1" min="0" max="100"'))
        + `</div><div class="nd-row">`
        + ndField('start (h)', ndInput('ndStart', String(num(w.start_offset_h)), false, 'type="number" step="1"'))
        + ndField('end (h)', ndInput('ndEnd', String(num(w.end_offset_h)), false, 'type="number" step="1"'))
        + `</div>`
        + ndField('Notes', ndNotesArea(w.notes || ''));
    }

    body.innerHTML = `${fields}
      <div class="nd-section"><div class="nd-sec-title">Relations</div>
        ${relGroup('upstream', rel.up)}${relGroup('downstream', rel.down)}${kidsLine}
      </div>
      <div class="nd-section"><div class="nd-sec-title">Audit</div>
        <div id="ndAudit"></div>
      </div>
      <div class="nd-actions">
        <button type="button" class="btn btn-primary" id="ndSave">Save</button>
        <button type="button" class="btn btn-danger" id="ndDelete">Delete</button>
        <button type="button" class="btn" id="ndCancel">Close</button>
      </div>
      <span class="nd-hint">Click a row to switch nodes; Close never writes.</span>`;
    panel.classList.remove('hidden');
    void ndFillAudit(id);
  }

  /* ---- I-038 write seams: create / save / delete through the plan-sync-
   *  class door (PUT /api/plan/structure). Every seam re-reads the plan on
   *  success and toasts the server's refusal on failure; the server has
   *  already written zero bytes when it refuses. ------------------------ */

  /** One structure PUT; surfaces the server error text for the toast. */
  async function structurePut(body: Record<string, unknown>):
    Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; error: string }> {
    try {
      const r = await fetch('/api/plan/structure', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data: Record<string, unknown> | null = null;
      try { data = await r.json() as Record<string, unknown>; } catch (_e) { data = null; }
      if (!r.ok) {
        const msg = data && data.error ? String(data.error) : 'HTTP ' + r.status;
        return { ok: false, status: r.status, data, error: msg };
      }
      return { ok: true, status: r.status, data, error: '' };
    } catch (e) {
      return { ok: false, status: 0, data: null, error: String(e) };
    }
  }

  /** Add-child seam (also what the [+]-buttons call): a fresh milestone
   *  under a G row or fresh work unit(s) under an M row. The server ships
   *  the pair PRD gate X needs on an empty milestone and says so. */
  export async function planNodeCreate(kind: 'create-milestone' | 'create-work-unit',
    parent: string): Promise<boolean> {
    const res = await structurePut({ kind, parent });
    if (!res.ok) { toast('Create refused: ' + res.error); return false; }
    await refreshPlan();
    const d = res.data || {};
    if (kind === 'create-milestone') {
      toast('Milestone ' + String(d.id || '') + ' added under ' + parent);
    } else {
      const ids = Array.isArray(d.added_work_units) ? d.added_work_units.map(String) : [];
      toast('Work unit ' + ids.join(' + ') + ' added under ' + parent
        + (d.pair ? ' (pair: gate X needs 0 or 2+)' : ''));
    }
    return true;
  }

  /** Save seam: the drawer's editable fields -> one four-store commit
   *  (goal = name/owner/notes; milestone adds status + hour offsets; work
   *  unit adds cost + progress, whose task row rides the same commit). */
  export async function planNodeSave(): Promise<boolean> {
    if (!drawerSel) return false;
    const { kind, id } = drawerSel;
    const v = (nid: string): string => {
      const el = document.getElementById(nid) as
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      return el ? el.value : '';
    };
    const nameVal = v('ndName').trim();
    if (!nameVal) { toast('Name must not be empty'); return false; }
    const patch: Record<string, unknown> = {};
    patch[kind === 'ms' ? 'name' : 'title'] = nameVal;
    patch.owner = v('ndOwner');
    patch.notes = v('ndNotes');
    if (kind !== 'goal') {
      patch.status = v('ndStatus');
      patch.start_offset_h = Number(v('ndStart'));
      patch.end_offset_h = Number(v('ndEnd'));
    }
    if (kind === 'wu') {
      patch.cost = Number(v('ndCost'));
      patch.progress = Number(v('ndProgress'));
      /* plan-sync rule: status done forces progress 100 on the way out, so
         the drawer never hands the server a pair it must refuse. */
      if (patch.status === 'done') patch.progress = 100;
    }
    const res = await structurePut({ kind: 'update-node', id, patch });
    if (!res.ok) { toast('Save refused: ' + res.error); return false; }
    closeNodeDrawer();
    await refreshPlan();
    if (kind === 'wu') { try { await store.load(); } catch (_e) { /* task row moved with us */ } }
    toast('Saved ' + id);
    return true;
  }

  /** Dependents for the confirm dialog: relations touching the node (for a
   *  G/M row: its subtree) plus the direct child rows the cascade removes. */
  function nodeDependents(kind: string, id: string, plan: Plan): { rels: string[]; kids: string[] } {
    const rels: string[] = [];
    const kids: string[] = [];
    if (kind === 'wu') {
      (plan.relations || []).forEach((r) => {
        if (String(r.from) === id || String(r.to) === id) {
          rels.push(`${r.from} -> ${r.to} (${r.type || 'FS'})`);
        }
      });
      return { rels, kids };
    }
    const memberW = new Set<string>();
    const sub = plan.sub_lines || {};
    if (kind === 'ms') {
      (Array.isArray(sub[id]) ? sub[id] : []).forEach((w) => {
        kids.push(String(w));
        memberW.add(String(w));
      });
    } else {
      const g = (plan.goals || []).filter((x) => String(x.id) === id)[0];
      if (g) {
        goalMids(g).forEach((mid) => {
          kids.push(mid);
          (Array.isArray(sub[mid]) ? sub[mid] : []).forEach((w) => memberW.add(String(w)));
        });
      }
    }
    (plan.relations || []).forEach((r) => {
      if (memberW.has(String(r.from)) || memberW.has(String(r.to))) {
        rels.push(`${r.from} -> ${r.to} (${r.type || 'FS'})`);
      }
    });
    return { rels, kids };
  }

  /** Delete button: the confirm dialog LISTING the dependents. Cancel is a
   *  plain modal close - zero writes; only "Delete and cascade" calls the op. */
  export function planNodeDeleteConfirm(): void {
    if (!drawerSel) return;
    const { kind, id } = drawerSel;
    const plan = lastPlan;
    const dep = plan ? nodeDependents(kind, id, plan) : { rels: [], kids: [] };
    const lines = [
      dep.rels.length
        ? `${dep.rels.length} relation(s): ${txt(dep.rels.join(', '))}`
        : 'no relations touch this node',
      dep.kids.length
        ? `${dep.kids.length} child row(s): ${txt(dep.kids.join(', '))}`
        : 'no child rows',
      kind === 'goal'
        ? 'Confirm cascades every listed member milestone and its work units across all stores.'
        : kind === 'ms'
          ? 'Confirm cascades its work units, their relation edges and this milestone\'s PRD block across all stores.'
          : "Confirm cascades this work unit's relation edges and task row across all stores.",
      'Cancel writes nothing.',
    ];
    openPanelModal(`<h3>Delete ${txt(id)}?</h3>
      <p class="modal-sub">Cascades the confirmed edges and children through milestone-plan.json, docs/evidence/milestones.json, the PRD Status registry and the SQLite task rows in one commit.</p>
      <div class="nd-kids">${lines.map((l) => `<div>${l}</div>`).join('')}</div>
      <div class="modal-actions">
        <button type="button" class="btn" data-action="close">Cancel</button>
        <button type="button" class="btn btn-danger" id="ndDoDelete">Delete and cascade</button>
      </div>`);
  }

  /** The confirmed delete: one cascade commit; success closes the drawer and
   *  re-reads every store, refusal surfaces the server's reason (no writes). */
  export async function planNodeDeleteConfirmed(): Promise<boolean> {
    if (!drawerSel) return false;
    const { id } = drawerSel;
    const res = await structurePut({ kind: 'delete-node', id });
    closePanelModal();
    if (!res.ok) { toast('Delete refused: ' + res.error); return false; }
    const cascaded = res.data && Array.isArray(res.data.removed_work_units)
      ? res.data.removed_work_units.length : 0;
    closeNodeDrawer();
    await refreshPlan();
    try { await store.load(); } catch (_e) { /* task rows moved with us */ }
    toast('Deleted ' + id + (cascaded ? ' + ' + cascaded + ' work unit(s)' : ''));
    return true;
  }

  let treeControlsBound = false;
  function bindTreeControls(): void {
    if (treeControlsBound) return;
    treeControlsBound = true;
    const layerEl = document.getElementById('milestoneLayer');
    if (layerEl) {
      layerEl.addEventListener('click', onTreeClick);
      layerEl.addEventListener('dragstart', onTreeDragStart);
      layerEl.addEventListener('dragover', onTreeDragOver);
      layerEl.addEventListener('drop', onTreeDrop);
      layerEl.addEventListener('dragend', onTreeDragEnd);
    }
    const sheetEl = document.getElementById('modalSheet');
    if (sheetEl) {
      sheetEl.addEventListener('click', (e) => { void onTemplateModalClick(e); });
    }
    /* I-038: drawer chrome - the X and the Close button; Escape closes the
       drawer alongside app.ts's own Escape handling (modal first). */
    const ndCloseBtn = document.getElementById('ndClose');
    if (ndCloseBtn) ndCloseBtn.addEventListener('click', closeNodeDrawer);
    const ndBodyEl = document.getElementById('ndBody');
    if (ndBodyEl) ndBodyEl.addEventListener('click', (e) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      if (t.closest('#ndCancel')) { closeNodeDrawer(); return; }
      if (t.closest('#ndSave')) { void planNodeSave(); return; }
      if (t.closest('#ndDelete')) planNodeDeleteConfirm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeNodeDrawer();
    });
  }

  export function initMilestones(): void {
    bindTreeControls();
    void refreshPlan();
  }
}
