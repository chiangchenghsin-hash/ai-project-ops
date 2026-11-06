namespace CP {
  let forceClipboardFail = false;
  export function setClipboardFail(v: boolean): void { forceClipboardFail = v; }

  function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error('missing ' + id);
    return el as T;
  }

  export async function copyText(text: string): Promise<string> {
    if (!forceClipboardFail && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        (window as unknown as Record<string, unknown>).__copyPath = 'navigator';
        return 'navigator';
      } catch (_e) { /* fall through */ }
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    (window as unknown as Record<string, unknown>).__copyPath = ok ? 'execCommand' : 'failed';
    return ok ? 'execCommand' : 'failed';
  }

  function noticeCreate(n: Notice): HTMLElement {
    void n;
    const el = document.createElement('div');
    el.className = 'notice';
    el.innerHTML = `<span class="notice-dot"></span><div><strong></strong><p></p></div><time></time>`;
    return el;
  }
  function noticeUpdate(el: HTMLElement, n: Notice): void {
    el.className = 'notice' + (n.level === 'warn' ? ' warn' : '') + (n.read ? ' read' : '');
    (el.querySelector('strong') as HTMLElement).textContent = n.title;
    (el.querySelector('p') as HTMLElement).textContent = n.body;
    (el.querySelector('time') as HTMLElement).textContent = n.ts;
  }

  function jobCreate(j: Job): HTMLElement {
    void j;
    const el = document.createElement('tr');
    el.innerHTML = `<td></td><td></td><td></td><td></td>`;
    return el;
  }
  function jobUpdate(el: HTMLElement, j: Job): void {
    const cells = el.querySelectorAll('td');
    cells[0].textContent = j.job_name;
    cells[1].textContent = j.last_run;
    cells[2].textContent = j.ok ? 'PASS' : 'FAIL';
    cells[2].className = j.ok ? 'ok' : 'bad';
    cells[3].textContent = j.summary;
  }

  function ackCreate(a: Ack): HTMLElement {
    void a;
    const el = document.createElement('li');
    el.className = 'ack-row';
    el.innerHTML = `<span class="ack-hash"></span><span class="ack-cmd"></span>
      <span class="ack-state"></span>
      <input class="ack-reason" type="text" placeholder="Reason (required to reject)">
      <button type="button" class="btn mini" data-ack="approve">Approve</button>
      <button type="button" class="btn mini danger" data-ack="reject">Reject</button>`;
    el.addEventListener('click', (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest('button[data-ack]') as HTMLElement | null;
      if (!b || !el.dataset.key) return;
      const id = el.dataset.key;
      if (b.dataset.ack === 'approve') {
        void store.commit('PUT', `/api/acks/${encodeURIComponent(id)}`, { action: 'approve' }, 'ACK approved');
      } else {
        const input = el.querySelector('.ack-reason') as HTMLInputElement;
        const reason = input.value.trim();
        if (!reason) { CP.toast('Reject requires a reason'); input.focus(); return; }
        void store.commit('PUT', `/api/acks/${encodeURIComponent(id)}`, { action: 'reject', reason }, 'ACK rejected');
      }
    });
    return el;
  }
  function ackUpdate(el: HTMLElement, a: Ack): void {
    el.dataset.key = a.id;
    (el.querySelector('.ack-hash') as HTMLElement).textContent = (a.snapshot_hash || '').slice(0, 10);
    (el.querySelector('.ack-cmd') as HTMLElement).textContent = (a.command || '(no command)').slice(0, 64);
    const st = el.querySelector('.ack-state') as HTMLElement;
    st.textContent = a.state;
    st.className = 'ack-state st-' + a.state;
    const closed = a.state !== 'ACK';
    (el.querySelector('[data-ack=approve]') as HTMLButtonElement).disabled = closed;
    (el.querySelector('[data-ack=reject]') as HTMLButtonElement).disabled = closed;
    if (a.state === 'REJECTED' && a.reject_reason) {
      (el.querySelector('.ack-reason') as HTMLInputElement).value = a.reject_reason;
    }
  }

  /** Compact, deterministic ASCII hash so an ACK row can reference the copied snapshot. */
  function hashText(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'h' + (h >>> 0).toString(16);
  }

  /** S2: copying a snapshot creates an ACK row (ACK state) in SQLite. */
  export async function createAckForSnapshot(text: string): Promise<void> {
    const hash = hashText(text);
    const command = (store.state && store.state.meta.next_command) || '';
    try {
      const created = await store.call('POST', '/api/acks', { snapshot_hash: hash, command }) as Ack;
      if (store.state) {
        store.state.acks = [created].concat(store.state.acks || []);
        store.emit();
      }
    } catch (e) {
      CP.toast('ACK create failed: ' + String(e));
    }
  }

  export function patchDesk(): void {
    const s = store.state;
    if (!s) return;
    const real = s.tasks.filter((t) => !t.placeholder);
    let span = 0;
    if (real.length) {
      const starts = real.map((t) => parse(t.start).getTime());
      const ends = real.map((t) => parse(t.end).getTime());
      span = (Math.max(...ends) - Math.min(...starts)) / 3600000;
    }
    byId('kpiSpan').textContent = `${span.toFixed(0)} h`;
    byId('kpiTokens').textContent = `${(s.totals.billed / 1e6).toFixed(1)}M`;
    byId('kpiCost').textContent = `$${Number(s.totals.cost).toFixed(2)}`;
    byId('kpiRounds').textContent = String(s.totals.n);
    byId('deskDataLine').textContent = `Work units ${s.tasks.length} | columns ${s.columns.length} | issues ${s.issues.length} | notices ${s.notifications.length}`;

    byId('demoBanner').classList.toggle('hidden', !(s.DEMO || s.demo));

    const cmd = byId<HTMLTextAreaElement>('nextCommand');
    if (document.activeElement !== cmd) cmd.value = s.meta.next_command || '';

    reconcile(byId('noticeList'), s.notifications, (n) => n.ts, noticeCreate, noticeUpdate);
    reconcile(byId('jobBody'), s.jobs, (j) => j.job_name, jobCreate, jobUpdate);
    reconcile(byId('ackList'), s.acks || [], (a) => a.id, ackCreate, ackUpdate);
  }

  async function snapshot(): Promise<string> {
    const r = await store.call('POST', '/api/snapshot') as { text: string };
    return r.text;
  }

  /**
   * One send action for every surface that carries a reply: build the command
   * snapshot, copy it, open the ACK row that references it. The Issue ledger
   * calls this so a human can send from where they typed instead of walking to
   * the Command desk tab.
   */
  export async function sendSnapshot(): Promise<{ text: string; path: string }> {
    const text = await snapshot();
    const path = await copyText(text);
    await createAckForSnapshot(text);
    return { text, path };
  }

  /** Build the snapshot without copying it, for a read-only preview. */
  export async function buildSnapshot(): Promise<string> {
    return snapshot();
  }

  export function initDesk(): void {
    const cmd = byId<HTMLTextAreaElement>('nextCommand');
    cmd.addEventListener('change', () => {
      void store.commit('PUT', '/api/command', { text: cmd.value }, 'Next command saved');
    });
    cmd.addEventListener('blur', () => {
      if (cmd.value !== (store.state && store.state.meta.next_command)) {
        void store.commit('PUT', '/api/command', { text: cmd.value }, 'Next command saved');
      }
    });
    byId('btnSend').addEventListener('click', async () => {
      const { text, path } = await sendSnapshot();
      byId('snapshotOut').textContent = text;
      CP.toast(path === 'failed' ? 'Snapshot generated, copy failed (copy manually)' : `Command snapshot copied (${path})`);
    });
    byId('btnGenerate').addEventListener('click', async () => {
      byId('snapshotOut').textContent = await snapshot();
      CP.toast('Snapshot generated, not copied');
    });
    store.subscribe(patchDesk);
    patchDesk();
  }
}
