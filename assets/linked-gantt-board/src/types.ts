namespace CP {
  export interface Column { id: string; label: string; color: string; sort: number; }
  export interface Task {
    id: string; title: string; owner: string; owner_type: string; role: string;
    handoff: string; status: string; start: string; end: string; progress: number;
    placeholder: number; tier: string; billed: number; cost: number; sort: number;
    /** Parent work unit, empty when this is a root. One level is enough to
     *  group a round's sub-tasks under the round bar. */
    parent_id: string;
    /** Frozen plan window, empty when no baseline has been taken. */
    baseline_start: string;
    baseline_end: string;
  }

  /** One precedence edge between two work units. `lag` is hours; a negative
   *  lag is a lead, so the successor may start before the predecessor ends. */
  export interface TaskDep { from: string; to: string; type: string; lag: number; }
  export interface Issue {
    id: string; source: string; title: string; detail: string; reply: string;
    enddate: string; urgent: number; status: string;
  }
  export interface Round {
    id: string; name: string; outcome: string; start: string; end: string;
    ongoing: number; req: number; in_t: number; out_t: number; cache_r: number;
    billed: number; fresh: number; cost: number;
  }
  export interface Job { job_name: string; last_run: string; ok: number; summary: string; }
  export interface Notice { ts: string; title: string; body: string; level: string; read: number; }
  export interface Ack {
    id: string; snapshot_hash: string; command: string; state: string;
    reject_reason: string;
    /** Row timestamps already carried by the API; optional so an older row
     *  without them still renders. `created` is shown on the ACK row. */
    created?: string; updated?: string;
  }
  /** One row of the I-019 desk_events history stream (GET /api/events). */
  export interface DeskEvent { id: string; ts: string; unit: string; kind: string; detail: string; }
  export interface Deps {
    entry?: string[]; nodes: { name: string; indeg: number; outdeg: number }[];
    edges: string[][];
  }
  export interface State {
    tasks: Task[]; columns: Column[]; rounds: Round[]; issues: Issue[];
    notifications: Notice[]; jobs: Job[]; acks: Ack[]; deps: Deps;
    /** R20: precedence edges between work units. Distinct from `deps`, which
     *  is the module graph. */
    task_deps: TaskDep[];
    meta: Record<string, string>;
    totals: { billed: number; fresh: number; cost: number; n: number };
    demo: boolean; DEMO: boolean; degraded: boolean; degraded_reason: string;
    /** Where the service keeps its data. Verifiers must use this, never a path
     *  they build from their own location. */
    data_dir: string;
    now: string;
  }

  export const HOUR_W = 8;
  export const LABEL_W = 252;
  export const ROW_H = 46;
  export const MIN_BAR_H = 12;
  export const AXIS_HOURS = 24 * 21;
  /** ASCII separator used in cost-first labels; safe to split on. */
  export const LABEL_SEP = ' | ';

  export const OWNER_TYPES: Record<string, string> = {
    human: 'Human member', main: 'AI main session', subagent: 'Subagent', team: 'Agent team',
  };
  export const PALETTE = ['#8e8e93', '#0071e3', '#34c759', '#ff9f0a', '#af52de', '#ff2d55', '#5856d6', '#00a6a6'];

  export function esc(s: string): string {
    return String(s).replace(/[&<>"']/g, (c) => {
      const m: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return m[c];
    });
  }
  /** This is an English release. Any CJK in PRD-derived text is removed before
   *  it reaches the DOM, so the rendered UI stays CJK-free regardless of what
   *  the ingest step wrote into the plan file. */
  export function stripCJK(s: string): string {
    return String(s).replace(/[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/g, '');
  }
  export function rgba(hex: string, a: number): string {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  /** cost-first: spend never hidden by truncation */
  export function costLabel(t: Task): string {
    return `${(t.billed / 1e6).toFixed(1)}M/$${Number(t.cost).toFixed(2)}${LABEL_SEP}${t.title}`;
  }
  /** Prefix-only cost label (spend before the name, name omitted). */
  export function costShort(t: Task): string { return costLabel(t).split(LABEL_SEP)[0]; }
  export function ownerLabel(k: string): string { return OWNER_TYPES[k] || k; }
}
