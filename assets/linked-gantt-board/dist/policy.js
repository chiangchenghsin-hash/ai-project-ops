"use strict";
var CP;
(function (CP) {
    /* ---- Pure, directly assertable rules --------------------------------- *
     * These read only their arguments, so a verifier can call them straight
     * from the browser console (CP.rejectReasonError(...)) with no DOM or
     * network. They encode the same rules the service enforces in db.js.       */
    /** A matrix row is active only when its enforced flag is 1. */
    function isEnforced(row) {
        return Number(row.enforced) === 1;
    }
    CP.isEnforced = isEnforced;
    /** Names of every enforced action, in input order. */
    function enforcedActions(rows) {
        return rows.filter(isEnforced).map((r) => r.action);
    }
    CP.enforcedActions = enforcedActions;
    /** A row demands a written reason on rejection. */
    function needsWrittenReason(row) {
        return Number(row.requires_reason) === 1;
    }
    CP.needsWrittenReason = needsWrittenReason;
    /** True when a decision closes an ACK as REJECTED. */
    function isRejected(state) {
        return String(state).trim().toUpperCase() === 'REJECTED';
    }
    CP.isRejected = isRejected;
    /** Locked negative rule: REJECTED + empty/whitespace reason is an error.
     *  Returns the error text, or null when the decision is acceptable. */
    function rejectReasonError(state, reason) {
        if (!isRejected(state))
            return null;
        if (!reason || !String(reason).trim())
            return 'reject requires a written reason';
        return null;
    }
    CP.rejectReasonError = rejectReasonError;
    /* ---- API fetch (browser) --------------------------------------------- */
    async function fetchApprovals() {
        const r = await fetch('/api/policy/approvals', { cache: 'no-store' });
        if (!r.ok)
            throw new Error('approvals HTTP ' + r.status);
        const rows = await r.json();
        return rows;
    }
    CP.fetchApprovals = fetchApprovals;
    async function fetchOwnerScope() {
        const r = await fetch('/api/policy/owner-scope', { cache: 'no-store' });
        if (!r.ok)
            throw new Error('owner-scope HTTP ' + r.status);
        const rows = await r.json();
        return rows;
    }
    CP.fetchOwnerScope = fetchOwnerScope;
    /* ---- DOM builders: document.createElement only, no innerHTML ---------- */
    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls)
            node.className = cls;
        if (text !== undefined)
            node.textContent = text;
        return node;
    }
    function cell(row, text, tag = 'td') {
        row.appendChild(el(tag, '', text));
    }
    /** Compact approval-matrix table. Enforced rows are marked in a column and
     *  via a data attribute so a reader sees which gates the service checks. */
    function buildApprovalTable(rows) {
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
    CP.buildApprovalTable = buildApprovalTable;
    /** Compact owner-scope table, one row per owner_type. */
    function buildOwnerScopeTable(rows) {
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
    CP.buildOwnerScopeTable = buildOwnerScopeTable;
    /** Mount both tables inside an existing view container. Idempotent: a second
     *  call replaces only the C9 wrapper, never any existing DOM id. */
    async function mountPolicyTables(containerId) {
        const host = document.getElementById(containerId);
        if (!host)
            return;
        const approvals = await fetchApprovals();
        const scopes = await fetchOwnerScope();
        const old = host.querySelector('#c9PolicyTables');
        if (old)
            old.remove();
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
    CP.mountPolicyTables = mountPolicyTables;
})(CP || (CP = {}));
