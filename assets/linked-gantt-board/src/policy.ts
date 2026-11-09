namespace CP {
  /** One row of the B1 per-action approval matrix (matches SQLite columns). */
  export interface ApprovalRow {
    id: string; action: string; actor: string; gate: string;
    requires_reason: number; endpoint: string; enforced: number;
  }
  /** One row of the B6 owner-scope table (matches SQLite columns). */
  export interface OwnerScopeRow {
    owner_type: string; may_act_alone: string; needs_ack: string; never_automatic: string;
  }

  /* ---- Pure, directly assertable rules --------------------------------- *
   * These read only their arguments, so a verifier can call them straight
   * from the browser console (CP.rejectReasonError(...)) with no DOM or
   * network. They encode the same rules the service enforces in db.js.       */

  /** A matrix row is active only when its enforced flag is 1. */
  export function isEnforced(row: ApprovalRow): boolean {
    return Number(row.enforced) === 1;
  }
  /** Names of every enforced action, in input order. */
  export function enforcedActions(rows: ApprovalRow[]): string[] {
    return rows.filter(isEnforced).map((r) => r.action);
  }
  /** A row demands a written reason on rejection. */
  export function needsWrittenReason(row: ApprovalRow): boolean {
    return Number(row.requires_reason) === 1;
  }
  /** True when a decision closes an ACK as REJECTED. */
  export function isRejected(state: string): boolean {
    return String(state).trim().toUpperCase() === 'REJECTED';
  }
  /** Locked negative rule: REJECTED + empty/whitespace reason is an error.
   *  Returns the error text, or null when the decision is acceptable. */
  export function rejectReasonError(state: string, reason: string): string | null {
    if (!isRejected(state)) return null;
    if (!reason || !String(reason).trim()) return 'reject requires a written reason';
    return null;
  }

  /* ---- API fetch (browser) --------------------------------------------- */

  export async function fetchApprovals(): Promise<ApprovalRow[]> {
    const r = await fetch('/api/policy/approvals', { cache: 'no-store' });
    if (!r.ok) throw new Error('approvals HTTP ' + r.status);
    const rows: ApprovalRow[] = await r.json();
    return rows;
  }
  export async function fetchOwnerScope(): Promise<OwnerScopeRow[]> {
    const r = await fetch('/api/policy/owner-scope', { cache: 'no-store' });
    if (!r.ok) throw new Error('owner-scope HTTP ' + r.status);
    const rows: OwnerScopeRow[] = await r.json();
    return rows;
  }

  /* ---- DOM builders: document.createElement only, no innerHTML ---------- */

  function el(tag: string, cls?: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function cell(row: HTMLElement, text: string, tag: string = 'td'): void {
    row.appendChild(el(tag, '', text));
  }

  /** Compact approval-matrix table. Enforced rows are marked in a column and
   *  via a data attribute so a reader sees which gates the service checks. */
  export function buildApprovalTable(rows: ApprovalRow[]): HTMLElement {
    const table = el('table', 'grid-table policy-table');
    const thead = el('thead');
    const h = el('tr');
    ['Action', 'Actor', 'Gate', 'Reason', 'Endpoint', 'Enforced'].forEach((t) => cell(h, t, 'th'));
    thead.appendChild(h);
    table.appendChild(thead);
    const tbody = el('tbody');
    rows.forEach((r) => {
      const tr = el('tr', isEnforced(r) ? 'policy-enforced' : 'policy-advisory');
      tr.dataset.enforced = isEnforced(r) ? 'yes' : 'no';
      cell(tr, r.action);
      cell(tr, r.actor);
      cell(tr, r.gate);
      cell(tr, needsWrittenReason(r) ? 'required' : 'optional');
      cell(tr, r.endpoint);
      cell(tr, isEnforced(r) ? 'ENFORCED' : 'advisory');
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  /** Compact owner-scope table, one row per owner_type. */
  export function buildOwnerScopeTable(rows: OwnerScopeRow[]): HTMLElement {
    const table = el('table', 'grid-table policy-table');
    const thead = el('thead');
    const h = el('tr');
    ['Owner type', 'May act alone', 'Needs ACK', 'Never automatic'].forEach((t) => cell(h, t, 'th'));
    thead.appendChild(h);
    table.appendChild(thead);
    const tbody = el('tbody');
    rows.forEach((r) => {
      const tr = el('tr');
      tr.dataset.ownerType = r.owner_type;
      cell(tr, r.owner_type);
      cell(tr, r.may_act_alone);
      cell(tr, r.needs_ack);
      cell(tr, r.never_automatic);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  /** Mount both tables inside an existing view container. Idempotent: a second
   *  call replaces only the C9 wrapper, never any existing DOM id. */
  export async function mountPolicyTables(containerId: string): Promise<void> {
    const host = document.getElementById(containerId);
    if (!host) return;
    const approvals = await fetchApprovals();
    const scopes = await fetchOwnerScope();
    const old = host.querySelector('#c9PolicyTables');
    if (old) old.remove();
    const wrap = el('div', 'desk-grid');
    wrap.id = 'c9PolicyTables';

    const approvalCard = el('div', 'card');
    approvalCard.appendChild(el('h2', '', 'Approval matrix'));
    approvalCard.appendChild(el('p', 'hint', 'Per-action gates. ENFORCED rows are checked by the service; advisory rows are spec-only.'));
    approvalCard.appendChild(buildApprovalTable(approvals));
    wrap.appendChild(approvalCard);

    const scopeCard = el('div', 'card');
    scopeCard.appendChild(el('h2', '', 'Owner scope'));
    scopeCard.appendChild(el('p', 'hint', 'Scope inherited from owner_type: human | main | subagent | team.'));
    scopeCard.appendChild(buildOwnerScopeTable(scopes));
    wrap.appendChild(scopeCard);

    host.appendChild(wrap);
  }
}
