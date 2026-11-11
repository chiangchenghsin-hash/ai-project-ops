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

  /** I-037: cross-surface hover. The kanban card and the hour-axis bar of one
   *  task light together - one dataset, one highlight, the same
   *  [data-task-id] selector paintSelection uses. `hoverId` survives the
   *  className rewrites in reconcile's update step, so a store emit while the
   *  pointer rests on a card keeps the paired bar lit (repaintLinkHover
   *  re-subscribes with the selection paint). */
  let hoverId: string | null = null;

  function linkHoverEls(id: string): NodeListOf<HTMLElement> {
    return document.querySelectorAll<HTMLElement>(`[data-task-id="${CSS.escape(id)}"]`);
  }

  function repaintLinkHover(): void {
    if (!hoverId) return;
    linkHoverEls(hoverId).forEach((el) => el.classList.add('is-link-hover'));
  }

  export function setLinkHover(id: string | null): void {
    const prev = hoverId;
    hoverId = id;
    if (prev && prev !== hoverId) {
      linkHoverEls(prev).forEach((el) => el.classList.remove('is-link-hover'));
    }
    if (hoverId) linkHoverEls(hoverId).forEach((el) => el.classList.add('is-link-hover'));
  }

  /** Document-level delegation: hovering (or dragging) a card highlights its
   *  bar and vice versa. mouseout only clears when the pointer really left
   *  the task node, so moving across a card's children never flickers. */
  function initLinkHover(): void {
    document.addEventListener('mouseover', (e) => {
      const t = e.target as HTMLElement | null;
      const node = t && typeof t.closest === 'function' ? t.closest('[data-task-id]') as HTMLElement | null : null;
      setLinkHover(node && node.dataset.taskId ? node.dataset.taskId : null);
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target as HTMLElement | null;
      const from = t && typeof t.closest === 'function' ? t.closest('[data-task-id]') as HTMLElement | null : null;
      if (!from) return;
      const to = e.relatedTarget as HTMLElement | null;
      if (to && typeof to.closest === 'function' && from.contains(to)) return;
      setLinkHover(null);
    });
    store.subscribe(repaintLinkHover);
  }

  function closeModal(): void { layer.classList.add('hidden'); modalOpen = false; editingId = null; }
  function openModal(html: string): void {
    sheet.innerHTML = html; layer.classList.remove('hidden'); modalOpen = true;
  }
  /** I-031: the goal tree opens the WBS template library through the same
   *  modal plumbing (Esc, backdrop click and data-action="close" included). */
  export function openPanelModal(html: string): void { openModal(html); }
  export function closePanelModal(): void { closeModal(); }
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
    const val = (k: string): string => esc(stripCJK(String(m[k] || '')));
    openModal(`<h3>Project charter</h3>
      <p class="modal-sub">First-principles framing shown on the Command desk. It lives in SQLite, so every fork states its own. The values originate from the ingested milestone plan. The Evaluation field states the method, never a live score.</p>
      <form id="charterForm"><div class="form-grid">
        <div class="field wide"><label>Purpose - why this project exists</label>
          <textarea id="cPurpose" rows="3" placeholder="Loaded from the milestone plan">${val('project_purpose')}</textarea></div>
        <div class="field wide"><label>Technical resources - what it runs on</label>
          <textarea id="cResources" rows="3" placeholder="Loaded from the milestone plan">${val('project_resources')}</textarea></div>
        <div class="field wide"><label>Evaluation - how it is judged, by PDCA iteration</label>
          <textarea id="cEval" rows="3" placeholder="Loaded from the milestone plan">${val('project_evaluation')}</textarea></div>
      </div><div class="modal-actions">
        <button type="button" class="btn" data-action="close">Cancel</button>
        <button type="submit" class="btn btn-primary">Save charter</button></div></form>`);
  }

  /** First-principles charter: three labelled fields plus the sidebar purpose.
   *  Every value arrives through /api/state (seeded from the plan file by the
   *  service); nothing is hardcoded here and text is kept CJK-free. */
  function patchCharter(): void {
    const s = store.state;
    if (!s) return;
    const m = s.meta || {};
    const put = (id: string, key: string): void => {
      byId(id).textContent = stripCJK(String(m[key] || '')).trim();
    };
    put('charterPurpose', 'project_purpose');
    put('charterResources', 'project_resources');
    put('charterEval', 'project_evaluation');
    byId('sidePurpose').textContent = stripCJK(String(m.project_purpose || '')).trim();
    byId('sideCharter').textContent = stripCJK(String(m.project_side_purpose || '')).trim();
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

  /** I-025: the First-principles block belongs to the Command desk alone.
   *  Every other view hides it; the charter modal stays reachable from the
   *  desk's Edit button while the block is on screen. */
  function syncCharterView(view: string): void {
    const charter = document.getElementById('charter');
    if (charter) charter.hidden = view !== 'desk';
  }

  function initNav(): void {
    const first = document.querySelector('#nav button.active') as HTMLElement | null;
    syncCharterView(first && first.dataset.view ? first.dataset.view : 'desk');
    byId('nav').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button[data-view]') as HTMLElement | null;
      if (!b) return;
      byId('nav').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('.view').forEach((v) => {
        (v as HTMLElement).classList.toggle('active', v.id === 'view-' + b.dataset.view);
      });
      syncCharterView(b.dataset.view || 'desk');
      /* Setting scrollLeft on a hidden view does nothing; reposition to NOW
         after switching to the Work board - the hour axis lives there now
         (R32 / I-037 moved it out of the Plan pagination). */
      if (b.dataset.view === 'board') {
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

  /** Persist a small chrome preference; storage may be blocked in private
   *  mode, in which case the UI still works for the current session. */
  function saveChrome(key: string, val: string): void {
    try { localStorage.setItem(key, val); } catch (_e) { /* storage blocked */ }
  }
  function loadChrome(key: string): string | null {
    try { return localStorage.getItem(key); } catch (_e) { return null; }
  }

  function initSidebar(): void {
    byId('btnCharterEdit').addEventListener('click', () => openCharterModal());

    /* I-022: the first-principles block is folded by default; one toggle. */
    const fold = byId('btnCharterFold');
    const charter = document.getElementById('charter');
    const syncCharter = (open: boolean): void => {
      if (!charter) return;
      charter.classList.toggle('collapsed', !open);
      fold.textContent = open ? 'Fold' : 'Unfold';
      saveChrome('cp.charter-open', open ? '1' : '0');
    };
    syncCharter(loadChrome('cp.charter-open') === '1');
    fold.addEventListener('click', () =>
      syncCharter(!charter || charter.classList.contains('collapsed')));

    /* I-022: the sidebar keeps its collapsed state across reloads. */
    const collapseBtn = byId('btnCollapse');
    const sideCollapsed = loadChrome('cp.side-collapsed') === '1';
    if (sideCollapsed) document.body.classList.add('side-collapsed');
    collapseBtn.setAttribute('aria-expanded', sideCollapsed ? 'false' : 'true');
    collapseBtn.addEventListener('click', () => {
      const on = document.body.classList.toggle('side-collapsed');
      collapseBtn.setAttribute('aria-expanded', on ? 'false' : 'true');
      saveChrome('cp.side-collapsed', on ? '1' : '0');
    });

    /* I-022: drag the right edge to resize. The width is a state value kept
       in --side-w; the stylesheet derives the flex-basis from it. */
    const grip = byId('sideResize');
    const root = document.documentElement;
    const savedW = loadChrome('cp.side-w');
    if (savedW) root.style.setProperty('--side-w', savedW);
    let x0 = 0; let w0 = 0; let active = false;
    grip.addEventListener('pointerdown', (e) => {
      active = true; x0 = e.clientX;
      w0 = byId('sidebar').getBoundingClientRect().width;
      try { grip.setPointerCapture(e.pointerId); } catch (_err) { /* synthetic pointer */ }
      document.body.classList.add('is-dragging'); e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!active) return;
      root.style.setProperty('--side-w', Math.max(180, Math.min(420, w0 + e.clientX - x0)) + 'px');
    });
    const gripEnd = (): void => {
      if (!active) return;
      active = false; document.body.classList.remove('is-dragging');
      const cur = root.style.getPropertyValue('--side-w');
      if (cur) saveChrome('cp.side-w', cur);
    };
    grip.addEventListener('pointerup', gripEnd);
    grip.addEventListener('pointercancel', gripEnd);
  }

  /** I-027: the plan page paginated between Milestone plan and Hour axis.
   *  R32 / I-037 moved the hour axis to the Work board, so the tab bar and
   *  cp.plan-tab are retired; the Plan page shows the goal tree full-page. */

  /** I-037: the Work board split. Kanban left, hour axis right, default
   *  40/60 with the axis keeping the larger share; one draggable separator
   *  whose width persists in cp.wb-split like every other chrome key. The
   *  clamp keeps the axis at least as wide as the kanban (25..50 percent
   *  left). Narrow viewports stack in the stylesheet and ignore --wb-left. */
  function initWorkBoard(): void {
    const page = document.getElementById('workBoard');
    const grip = document.getElementById('wbSplit');
    if (!page || !grip) return;
    const clamp = (pct: number): number => Math.max(25, Math.min(50, pct));
    const apply = (pct: number): void => {
      page.style.setProperty('--wb-left', clamp(pct) + '%');
    };
    const saved = Number(loadChrome('cp.wb-split'));
    let leftPct = Number.isFinite(saved) && saved ? saved : 40;
    apply(leftPct);
    let x0 = 0; let w0 = 0; let active = false;
    grip.addEventListener('pointerdown', (e) => {
      active = true; x0 = e.clientX;
      w0 = page.getBoundingClientRect().width;
      try { grip.setPointerCapture(e.pointerId); } catch (_err) { /* synthetic pointer */ }
      document.body.classList.add('is-dragging'); e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!active || w0 <= 0) return;
      const base = w0 * clamp(leftPct) / 100;
      leftPct = clamp(((base + (e.clientX - x0)) / w0) * 100);
      apply(leftPct);
    });
    const gripEnd = (): void => {
      if (!active) return;
      active = false; document.body.classList.remove('is-dragging');
      leftPct = clamp(Math.round(leftPct));
      apply(leftPct);
      saveChrome('cp.wb-split', String(leftPct));
    };
    grip.addEventListener('pointerup', gripEnd);
    grip.addEventListener('pointercancel', gripEnd);
  }

  /** I-023: the Settings page. Theme and glass take effect now; the port is
   *  read at server boot, so the page records the wish and prints the exact
   *  restart command instead of pretending to hot-swap. */
  function initSettings(): void {
    const applyTheme = (mode: string): void => {
      const root = document.documentElement;
      if (mode === 'auto') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', mode);
      saveChrome('cp.theme', mode);
      document.querySelectorAll('#setTheme [data-theme-val]').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-theme-val') === mode);
      });
    };
    applyTheme(loadChrome('cp.theme') || 'auto');
    byId('setTheme').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button[data-theme-val]') as HTMLElement | null;
      if (b && b.dataset.themeVal) applyTheme(b.dataset.themeVal);
    });

    const portIn = byId('setPort') as HTMLInputElement;
    const portNote = byId('setPortNote');
    fetch('/healthz').then((r) => r.json())
      .then((h: { port?: number }) => { if (h && h.port) portIn.value = String(h.port); })
      .catch(() => { /* healthz unreachable; keep the default */ });
    byId('setPortSave').addEventListener('click', () => {
      const n = Number(portIn.value);
      if (!Number.isInteger(n) || n < 1024 || n > 65535) {
        portNote.textContent = 'Port must be 1024..65535'; return;
      }
      portNote.textContent = 'Restart with PANEL_PORT=' + n + ' node server.js';
      saveChrome('cp.port-pref', String(n));
    });

    const glass = byId('setGlass') as HTMLInputElement;
    const glassOut = byId('setGlassOut');
    const setGlass = (v: number): void => {
      document.documentElement.style.setProperty('--glass-alpha', String(v / 100));
      glassOut.textContent = v + '%';
      saveChrome('cp.glass-alpha', String(v / 100));
    };
    const gv = loadChrome('cp.glass-alpha');
    setGlass(gv ? Math.round(Number(gv) * 100) : 80);
    glass.value = gv ? String(Math.round(Number(gv) * 100)) : '80';
    glass.addEventListener('input', () => setGlass(Number(glass.value)));

    /* I-033: the confidence gate. Persisted in cp.conf-threshold (default
       0.7); board.ts reads it on every card patch, so saving here re-paints
       the badges immediately. */
    const confIn = byId('setConfGate') as HTMLInputElement;
    const confNote = byId('setConfGateNote');
    const applyConf = (raw: string, persist: boolean): void => {
      const n = Number(raw);
      const ok = raw !== '' && Number.isFinite(n) && n >= 0 && n <= 1;
      if (persist && ok) saveChrome('cp.conf-threshold', String(n));
      confNote.textContent = ok
        ? `cards below ${n.toFixed(2)} show needs-ack`
        : 'enter a number from 0 to 1';
      patchBoard();
    };
    confIn.value = loadChrome('cp.conf-threshold') || '0.7';
    applyConf(confIn.value, false);
    confIn.addEventListener('change', () => applyConf(confIn.value, true));

    byId('setReset').addEventListener('click', () => {
      ['cp.side-w', 'cp.side-collapsed', 'cp.charter-open', 'cp.wb-split']
        .forEach((k) => { try { localStorage.removeItem(k); } catch (_e) { /* storage blocked */ } });
      CP.reload();
    });
  }

  /** Reload seam. window.location.* is non-writable (LegacyUnforgeable), so a
   *  test cannot stub it in place; tests replace CP.reload instead (R28
   *  re-check correction: the old window.location stub silently no-oped and
   *  the reset click really reloaded the page mid-suite). */
  export function reload(): void { window.location.reload(); }

  function initKeys(): void {
    document.addEventListener('keydown', (e) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && typeof el.matches === 'function' && el.matches('input, textarea, select');
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
    initGantt(); initBoard(); initDesk(); initLedger(); initMilestones();
    store.subscribe(paintSelectionFalse);
    store.subscribe(patchCharter);
    store.subscribe(patchSidebar);
    initNav(); initFilters(); initSidebar(); initWorkBoard(); initLinkHover(); initSettings(); initKeys();
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
