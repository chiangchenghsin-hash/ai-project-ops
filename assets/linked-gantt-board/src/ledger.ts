namespace CP {
  let activeFilter = 'all';
  let query = '';

  function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error('missing ' + id);
    return el as T;
  }

  function issueVisible(i: Issue): boolean {
    const q = query.trim().toLowerCase();
    if (q && `${i.id} ${i.source} ${i.title} ${i.detail}`.toLowerCase().indexOf(q) < 0) return false;
    const h = hoursUntil(i.enddate);
    if (activeFilter === 'open') return i.status !== 'done';
    if (activeFilter === 'overdue') return i.status !== 'done' && h < 0;
    if (activeFilter === 'urgent') return !!i.urgent && i.status !== 'done';
    if (activeFilter === 'done') return i.status === 'done';
    return true;
  }

  function issueCreate(i: Issue): HTMLElement {
    void i;
    const tr = document.createElement('tr');
    tr.className = 'issue-row';
    tr.innerHTML = `<td class="iid"></td><td class="isrc"></td>
      <td class="ititle"><strong></strong><small></small><span class="badge-overdue">OVERDUE</span><span class="badge-soon">&lt;=48h</span></td>
      <td class="icell-reply"><textarea class="ireply" rows="2" placeholder="Reply..."></textarea>
        <div class="ireply-actions">
          <button type="button" class="btn mini send isend">Send</button>
          <span class="isaved"></span>
        </div></td>
      <td><input class="iend" type="date"></td>
      <td class="center"><input class="iurgent" type="checkbox"></td>
      <td><select class="istatus"><option value="open">open</option><option value="done">done</option></select></td>`;
    const reply = tr.querySelector('.ireply') as HTMLTextAreaElement;
    const end = tr.querySelector('.iend') as HTMLInputElement;
    const urgent = tr.querySelector('.iurgent') as HTMLInputElement;
    const status = tr.querySelector('.istatus') as HTMLSelectElement;
    const send = tr.querySelector('.isend') as HTMLButtonElement;
    const save = (patch: Partial<Issue>): void => {
      void store.commit('PUT', `/api/issues/${encodeURIComponent(i.id)}`, patch, `${i.id} saved`);
    };
    reply.addEventListener('change', () => save({ reply: reply.value }));
    end.addEventListener('change', () => save({ enddate: end.value }));
    urgent.addEventListener('change', () => save({ urgent: urgent.checked ? 1 : 0 }));
    status.addEventListener('change', () => save({ status: status.value }));
    /* Send where you type: persist the reply first, then run the one send chain
       (snapshot -> clipboard -> ACK row) so nothing is lost if the copy fails. */
    send.addEventListener('click', async () => {
      send.disabled = true;
      try {
        await store.commit('PUT', `/api/issues/${encodeURIComponent(i.id)}`, { reply: reply.value }, `${i.id} reply saved`);
        const { path } = await sendSnapshot();
        CP.toast(path === 'failed'
          ? `${i.id} reply saved. Snapshot copy failed. Copy it from the Command desk.`
          : `${i.id} reply saved. Command snapshot copied (${path}).`);
      } finally {
        send.disabled = false;
      }
    });
    return tr;
  }

  function issueUpdate(tr: HTMLElement, i: Issue): void {
    tr.dataset.key = i.id;
    const h = hoursUntil(i.enddate);
    const overdue = i.status !== 'done' && h < 0;
    const soon = i.status !== 'done' && h >= 0 && h <= 48;
    tr.className = 'issue-row' + (overdue ? ' overdue' : '') + (soon ? ' soon' : '')
      + (i.urgent ? ' urgent' : '') + (i.status === 'done' ? ' done' : '');
    (tr.querySelector('.iid') as HTMLElement).textContent = i.id;
    (tr.querySelector('.isrc') as HTMLElement).textContent = i.source;
    (tr.querySelector('.ititle strong') as HTMLElement).textContent = i.title;
    (tr.querySelector('.ititle small') as HTMLElement).textContent = i.detail;
    const reply = tr.querySelector('.ireply') as HTMLTextAreaElement;
    const end = tr.querySelector('.iend') as HTMLInputElement;
    const urgent = tr.querySelector('.iurgent') as HTMLInputElement;
    const status = tr.querySelector('.istatus') as HTMLSelectElement;
    if (document.activeElement !== reply) reply.value = i.reply;
    if (document.activeElement !== end) end.value = i.enddate;
    urgent.checked = !!i.urgent;
    status.value = i.status;
    /* Honest save state: say "not saved yet" only while the box holds text the
       store does not have. A blank label means nothing to save. */
    const saved = tr.querySelector('.isaved') as HTMLElement | null;
    if (saved) {
      const dirty = reply.value !== i.reply;
      saved.textContent = dirty ? 'not saved yet' : (i.reply.trim() ? 'saved' : '');
      saved.className = 'isaved' + (dirty ? ' dirty' : '');
    }
  }

  function roundCreate(r: Round): HTMLElement {
    void r;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td></td><td></td><td></td><td></td><td></td><td></td>`;
    return tr;
  }
  function roundUpdate(tr: HTMLElement, r: Round): void {
    const c = tr.querySelectorAll('td');
    c[0].textContent = r.id;
    c[1].textContent = r.name;
    c[2].textContent = `${r.start} -> ${r.end}`;
    c[3].textContent = `${(r.billed / 1e6).toFixed(1)}M`;
    c[4].textContent = `${(r.fresh / 1e6).toFixed(1)}M`;
    c[5].textContent = `$${Number(r.cost).toFixed(2)}`;
    tr.className = r.outcome === 'FAIL' ? 'fail' : '';
  }

  export function patchLedger(): void {
    const s = store.state;
    if (!s) return;
    const rows = s.issues.filter(issueVisible);
    reconcile(byId('issueBody'), rows, (i) => i.id, issueCreate, issueUpdate);
    byId('issueEmpty').classList.toggle('hidden', rows.length > 0);
    reconcile(byId('roundBody'), s.rounds, (r) => r.id, roundCreate, roundUpdate);
    byId('roundTotal').textContent = `Total ${s.rounds.length} rounds | billed ${(s.totals.billed / 1e6).toFixed(1)}M | fresh ${(s.totals.fresh / 1e6).toFixed(1)}M | $${Number(s.totals.cost).toFixed(2)}`;
  }

  export function initLedger(): void {
    byId<HTMLInputElement>('issueQuery').addEventListener('input', (e) => {
      query = (e.target as HTMLInputElement).value; patchLedger();
    });
    byId('issueChips').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button[data-filter]') as HTMLElement | null;
      if (!b) return;
      activeFilter = b.dataset.filter || 'all';
      byId('issueChips').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      patchLedger();
    });
    /* The ledger foot is the bulk send: it runs the same chain as the per-row
       Send, so a human never has to leave this tab to deliver a reply. */
    byId('btnLedgerSend').addEventListener('click', async () => {
      const btn = byId<HTMLButtonElement>('btnLedgerSend');
      btn.disabled = true;
      try {
        const { text, path } = await sendSnapshot();
        byId('ledgerSnapOut').textContent = text;
        CP.toast(path === 'failed'
          ? 'Snapshot generated. Copy failed. Read it below and copy it manually.'
          : `Command snapshot copied (${path}).`);
      } finally {
        btn.disabled = false;
      }
    });
    byId('btnLedgerGen').addEventListener('click', async () => {
      byId('ledgerSnapOut').textContent = await buildSnapshot();
      CP.toast('Snapshot generated, not copied');
    });
    store.subscribe(patchLedger);
    patchLedger();
  }
}
