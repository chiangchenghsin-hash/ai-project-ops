namespace CP {
  let layer: HTMLElement;
  let sheet: HTMLElement;
  let toastEl: HTMLElement;
  let toastTimer = 0;
  let newColColor = PALETTE[2];
  let modalOpen = false;
  let editingId: string | null = null;

  function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error('missing ' + id);
    return el as T;
  }

  export function toast(text: string): void {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  export function paintSelection(scroll: boolean): void {
    const id = store.selected;
    document.querySelectorAll<HTMLElement>('[data-task-id]').forEach((el) => {
      el.classList.toggle('is-selected', !!id && el.dataset.taskId === id);
    });
    if (scroll && id) {
      const bar = document.querySelector(`.gbar[data-task-id="${id}"]`);
      if (bar) bar.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const card = document.querySelector(`.kb-card[data-task-id="${id}"]`);
      if (card) card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function closeModal(): void { layer.classList.add('hidden'); modalOpen = false; editingId = null; }
  function openModal(html: string): void {
    sheet.innerHTML = html; layer.classList.remove('hidden'); modalOpen = true;
  }
  function swatches(active: string, colId?: string): string {
    return PALETTE.map((c) => `<button type="button" class="swatch${c === active ? ' active' : ''}"
      style="background:${c}" data-color="${c}"${colId ? ` data-col="${colId}"` : ''}></button>`).join('');
  }

  export function openColumnManager(): void {
    const s = store.state;
    if (!s) return;
    const rows = s.columns.map((c, i) => `<div class="col-row">
      <div class="col-line1"><span class="cdot" style="background:${c.color}"></span>
        <input class="cname" data-col-name="${c.id}" value="${esc(c.label)}" maxlength="20">
        <button type="button" class="mini" data-move="${c.id}" data-dir="-1"${i === 0 ? ' disabled' : ''}>&lt;</button>
        <button type="button" class="mini" data-move="${c.id}" data-dir="1"${i === s.columns.length - 1 ? ' disabled' : ''}>&gt;</button>
        <button type="button" class="mini danger" data-delcol="${c.id}"${s.columns.length <= 1 ? ' disabled' : ''}>x</button>
      </div><div class="swatches">${swatches(c.color, c.id)}</div></div>`).join('');
    openModal(`<h3>Status column settings</h3><p class="modal-sub">Statuses live in SQLite, not hardcoded in the UI. Deleting a column moves its tasks into the first column.</p>
      ${rows}<div class="col-add"><input id="newColName" maxlength="20" placeholder="New status name">
      <div class="swatches" id="newSw">${swatches(newColColor)}</div>
      <button type="button" class="btn btn-primary" data-action="add-col">Add</button></div>
      <div class="modal-actions"><button type="button" class="btn btn-primary" data-action="close">Done</button></div>`);
  }

  export function openTaskModal(id?: string): void {
    const s = store.state;
    if (!s) return;
    const t = id ? s.tasks.filter((x) => x.id === id)[0] : undefined;
    editingId = t ? t.id : null;
    const opt = (v: string, cur: string) => `<option value="${v}"${v === cur ? ' selected' : ''}>${ownerLabel(v)}</option>`;
    const statusOpts = s.columns.map((c) => `<option value="${c.id}"${t && t.status === c.id ? ' selected' : ''}>${esc(c.label)}</option>`).join('');
    /* R22: parent choice. The task itself and everything below it are
       excluded - either choice would close a loop in the tree. */
    const parentOpts = ['<option value="">(none - root)</option>'].concat(s.tasks
      .filter((x) => !(t && (x.id === t.id || hasAncestor(s.tasks, x.id, t.id))))
      .map((x) => `<option value="${x.id}"${t && t.parent_id === x.id ? ' selected' : ''}>${esc(x.title)} (${x.id})</option>`)).join('');
    const now = fmt(new Date());
    openModal(`<h3>${t ? 'Edit work unit' : 'New work unit'}</h3>
      <p class="modal-sub">Times snap to the hour; the cost label always precedes the name.</p>
      <form id="taskForm"><div class="form-grid">
        <div class="field wide"><label>Task</label><input id="fTitle" required maxlength="60" value="${t ? esc(t.title) : ''}"></div>
        <div class="field"><label>Owner</label><input id="fOwner" value="${t ? esc(t.owner) : 'Unassigned'}"></div>
        <div class="field"><label>Owner type</label><select id="fOwnerType">${Object.keys(OWNER_TYPES).map((k) => opt(k, t ? t.owner_type : 'main')).join('')}</select></div>
        <div class="field"><label>Role</label><input id="fRole" value="${t ? esc(t.role) : ''}"></div>
        <div class="field"><label>Status column</label><select id="fStatus">${statusOpts}</select></div>
        <div class="field"><label>Part of (parent)</label><select id="fParent">${parentOpts}</select></div>
        <div class="field wide"><label>Handoff note</label><input id="fHandoff" value="${t ? esc(t.handoff) : ''}"></div>
        <div class="field"><label>Start (hour)</label><input id="fStart" type="datetime-local" value="${t ? t.start : now}"></div>
        <div class="field"><label>End (hour)</label><input id="fEnd" type="datetime-local" value="${t ? t.end : addHours(now, 12)}"></div>
        <div class="field"><label>billed (M tokens)</label><input id="fBilled" type="number" step="0.1" value="${t ? t.billed / 1e6 : 0}"></div>
        <div class="field"><label>cost ($)</label><input id="fCost" type="number" step="0.01" value="${t ? t.cost : 0}"></div>
        <div class="field"><label>token tier</label><select id="fTier">${['S', 'M', 'L', 'XL'].map((x) => `<option${t && t.tier === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label>Placeholder (non-commitment)</label><select id="fPlaceholder"><option value="0"${!t || !t.placeholder ? ' selected' : ''}>No</option><option value="1"${t && t.placeholder ? ' selected' : ''}>Yes</option></select></div>
      </div><div class="modal-actions">
        ${t ? '<button type="button" class="btn btn-danger" data-action="delete-task">Delete</button>' : ''}
        <button type="button" class="btn" data-action="close">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button></div></form>`);
  }

  export function openCharterModal(): void {
    const s = store.state;
    if (!s) return;
    const m = s.meta || {};
    const val = (k: string): string => esc(String(m[k] || ''));
    openModal(`<h3>Project charter</h3>
      <p class="modal-sub">First-principles framing shown on every view. It lives in SQLite, so every fork states its own. The Evaluation field states the method, never a live score.</p>
      <form id="charterForm"><div class="form-grid">
        <div class="field wide"><label>Purpose - why this project exists</label>
          <textarea id="cPurpose" rows="3" placeholder="Not set.">${val('project_purpose')}</textarea></div>
        <div class="field wide"><label>Technical resources - what it runs on</label>
          <textarea id="cResources" rows="3" placeholder="Not set.">${val('project_resources')}</textarea></div>
        <div class="field wide"><label>Evaluation - how it is judged, by PDCA iteration</label>
          <textarea id="cEval" rows="3" placeholder="Not set.">${val('project_evaluation')}</textarea></div>
      </div><div class="modal-actions">
        <button type="button" class="btn" data-action="close">Cancel</button>
        <button type="submit" class="btn btn-primary">Save charter</button></div></form>`);
  }

  /** First-principles charter: three labelled fields, explicit when unset. */
  function patchCharter(): void {
    const s = store.state;
    if (!s) return;
    const m = s.meta || {};
    const put = (id: string, key: string): void => {
      const el = byId(id);
      const text = String(m[key] || '').trim();
      el.textContent = text || 'Not set.';
      el.classList.toggle('unset', !text);
    };
    put('charterPurpose', 'project_purpose');
    put('charterResources', 'project_resources');
    put('charterEval', 'project_evaluation');
    const side = byId('sidePurpose');
    const p = String(m.project_purpose || '').trim();
    side.textContent = p || 'Purpose not set.';
    side.classList.toggle('unset', !p);
  }

  /** Sidebar work-division roster plus a measured spend glance. No live counts
   *  on any label; the figures below are measured, not tallied by the UI. */
  function patchSidebar(): void {
    const s = store.state;
    if (!s) return;
    byId('sideCost').textContent = `$${Number(s.totals.cost).toFixed(2)}`;
    byId('sideTokens').textContent = `${(s.totals.billed / 1e6).toFixed(1)}M billed`;
    const byType: Record<string, { cost: number; owners: string[] }> = {};
    s.tasks.forEach((t) => {
      const k = t.owner_type || 'main';
      if (!byType[k]) byType[k] = { cost: 0, owners: [] };
      byType[k].cost += Number(t.cost) || 0;
      const name = (t.owner || '').trim();
      if (name && byType[k].owners.indexOf(name) < 0) byType[k].owners.push(name);
    });
    const rows = Object.keys(OWNER_TYPES).map((k) => {
      const g = byType[k] || { cost: 0, owners: [] };
      const names = g.owners.length ? esc(g.owners.join(', ')) : 'none';
      return `<li class="roster-row" data-type="${k}">
        <span class="roster-dot"></span>
        <span class="roster-name">${ownerLabel(k)}</span>
        <span class="roster-cost">$${g.cost.toFixed(2)}</span>
        <span class="roster-owners">${names}</span></li>`;
    }).join('');
    byId('ownerRoster').innerHTML = rows;
  }

  function onModalClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    const a = t.dataset.action;
    if (a === 'close') { closeModal(); return; }
    if (a === 'delete-task' && editingId) {
      void store.commit('DELETE', `/api/tasks/${encodeURIComponent(editingId)}`, undefined, 'Work unit deleted');
      closeModal(); return;
    }
    if (a === 'add-col') {
      const input = document.getElementById('newColName') as HTMLInputElement | null;
      const label = input ? input.value.trim() : '';
      if (!label) { toast('Name the new status first'); if (input) input.focus(); return; }
      void store.commit('POST', '/api/columns', { label, color: newColColor }, `Status column "${label}" added`).then(openColumnManager);
      return;
    }
    const sw = t.closest('.swatch') as HTMLElement | null;
    if (sw) {
      const color = sw.dataset.color || PALETTE[0];
      if (sw.dataset.col) {
        void store.commit('PUT', `/api/columns/${encodeURIComponent(sw.dataset.col)}`, { color }, 'Status color updated').then(openColumnManager);
      } else {
        newColColor = color;
        const box = document.getElementById('newSw');
        if (box) box.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', (x as HTMLElement).dataset.color === color));
      }
      return;
    }
    const mv = t.closest('[data-move]') as HTMLElement | null;
    if (mv && mv.dataset.move) {
      void store.commit('POST', `/api/columns/${encodeURIComponent(mv.dataset.move)}/move`, { dir: Number(mv.dataset.dir) }, 'Status order updated').then(openColumnManager);
      return;
    }
    const del = t.closest('[data-delcol]') as HTMLElement | null;
    if (del && del.dataset.delcol) {
      void store.commit('DELETE', `/api/columns/${encodeURIComponent(del.dataset.delcol)}`, undefined, 'Status column deleted').then(openColumnManager);
    }
  }

  function onModalChange(e: Event): void {
    const t = e.target as HTMLElement;
    if (t.dataset.colName) {
      void store.commit('PUT', `/api/columns/${encodeURIComponent(t.dataset.colName)}`,
        { label: (t as HTMLInputElement).value.trim() || 'Untitled' }, 'Status name updated');
    }
  }

  function onSubmit(e: SubmitEvent): void {
    const formId = (e.target as HTMLElement).id;
    if (formId === 'charterForm') {
      e.preventDefault();
      const v = (id: string) => (document.getElementById(id) as HTMLTextAreaElement).value;
      void store.commit('PUT', '/api/meta', {
        project_purpose: v('cPurpose').trim(),
        project_resources: v('cResources').trim(),
        project_evaluation: v('cEval').trim(),
      }, 'Project charter saved').then(() => closeModal());
      return;
    }
    if (formId !== 'taskForm') return;
    e.preventDefault();
    const v = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value;
    const patch = {
      title: v('fTitle').trim(), owner: v('fOwner'), owner_type: v('fOwnerType'),
      role: v('fRole'), handoff: v('fHandoff'), status: v('fStatus'),
      start: v('fStart'), end: v('fEnd'),
      billed: Number(v('fBilled')) * 1e6, cost: Number(v('fCost')),
      tier: v('fTier'), placeholder: Number(v('fPlaceholder')),
      parent_id: v('fParent'),
    };
    if (!patch.title) return;
    void store.commit(editingId ? 'PUT' : 'POST',
      editingId ? `/api/tasks/${encodeURIComponent(editingId)}` : '/api/tasks', patch,
      editingId ? 'Work unit updated' : 'Work unit created');
    closeModal();
  }

  function initNav(): void {
    byId('nav').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button[data-view]') as HTMLElement | null;
      if (!b) return;
      byId('nav').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('.view').forEach((v) => {
        (v as HTMLElement).classList.toggle('active', v.id === 'view-' + b.dataset.view);
      });
      /* Setting scrollLeft on a hidden view does nothing; reposition to NOW after switching to plan. */
      if (b.dataset.view === 'plan') {
        window.requestAnimationFrame(() => CP.scrollGanttToNow());
      }
    });
  }

  function initFilters(): void {
    byId<HTMLInputElement>('globalSearch').addEventListener('input', (e) => {
      store.query = (e.target as HTMLInputElement).value; store.emit();
    });
    byId<HTMLSelectElement>('ownerFilter').addEventListener('change', (e) => {
      store.ownerFilter = (e.target as HTMLSelectElement).value; store.emit();
    });
    byId('btnAddTask').addEventListener('click', () => openTaskModal());
    byId('btnColumns').addEventListener('click', () => openColumnManager());
    byId('btnRefresh').addEventListener('click', () => { void store.load().then(() => toast('Reloaded from SQLite')); });

    /* R20: freeze the plan window as the baseline, and dim the non-critical. */
    byId('btnBaseline').addEventListener('click', () => {
      void store.call('POST', '/api/baseline', {})
        .then((r) => store.load().then(() => toast(`Baseline frozen (${(r as { snapshotted?: number }).snapshotted ?? 0} units)`)))
        .catch((e) => toast('Baseline failed: ' + String(e)));
    });
    byId('btnCritical').addEventListener('click', (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      const on = !b.classList.contains('active');
      b.classList.toggle('active', on);
      setCriticalView(on);
    });
  }

  function initSidebar(): void {
    byId('btnCharterEdit').addEventListener('click', () => openCharterModal());
    byId('btnCollapse').addEventListener('click', () => {
      const on = document.body.classList.toggle('side-collapsed');
      byId('btnCollapse').setAttribute('aria-expanded', on ? 'false' : 'true');
    });
  }

  function initDivider(): void {
    const div = byId('divider');
    const plan = byId('view-plan-split');
    let y0 = 0; let h0 = 0; let active = false;
    div.addEventListener('pointerdown', (e) => {
      active = true; y0 = e.clientY;
      h0 = (document.getElementById('ganttPanel') as HTMLElement).getBoundingClientRect().height;
      div.setPointerCapture(e.pointerId);
      document.body.classList.add('is-dragging'); e.preventDefault();
    });
    div.addEventListener('pointermove', (e) => {
      if (!active) return;
      const h = Math.max(180, Math.min(plan.clientHeight - 220, h0 + e.clientY - y0));
      plan.style.setProperty('--gantt-h', `${h}px`);
    });
    const end = (): void => { active = false; document.body.classList.remove('is-dragging'); };
    div.addEventListener('pointerup', end);
    div.addEventListener('pointercancel', end);
  }

  function initKeys(): void {
    document.addEventListener('keydown', (e) => {
      const typing = (e.target as HTMLElement).matches('input, textarea, select');
      if (e.key === 'Escape') { if (modalOpen) closeModal(); else CP.select(null, false); }
      if (typing || modalOpen) return;
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && store.selected) {
        const t = taskById(store.selected);
        if (!t) return;
        e.preventDefault();
        const h = e.key === 'ArrowLeft' ? -1 : 1;
        const start = addHours(t.start, h); const end = addHours(t.end, h);
        store.optimistic((s) => { const x = s.tasks.filter((z) => z.id === t.id)[0]; if (x) { x.start = start; x.end = end; } });
        void store.commit('PUT', `/api/tasks/${encodeURIComponent(t.id)}`, { start, end }, `Time moved ${h} hour(s)`);
      }
    });
  }

  async function init(): Promise<void> {
    layer = byId('modalLayer'); sheet = byId('modalSheet'); toastEl = byId('toast');
    initGantt(); initBoard(); initDesk(); initLedger();
    store.subscribe(paintSelectionFalse);
    store.subscribe(patchCharter);
    store.subscribe(patchSidebar);
    initNav(); initFilters(); initSidebar(); initDivider(); initKeys();
    layer.addEventListener('click', (e) => { if (e.target === layer) closeModal(); });
    sheet.addEventListener('click', onModalClick);
    sheet.addEventListener('change', onModalChange);
    sheet.addEventListener('submit', onSubmit);
    await store.load();
  }

  function paintSelectionFalse(): void { paintSelection(false); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void init(); });
  else void init();
}
