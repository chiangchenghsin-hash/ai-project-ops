"use strict";
/*!
 * BACKGROUND: Renders the PRD milestone layer (invariant I9) into the plan
 * page: one main-line bar per milestone in depends_on order, its work units as
 * indented sub-line bars, explicit dependency relations and critical-path
 * emphasis. When data/milestone-plan.json is missing or invalid it renders an
 * explicit PRD-not-ingested state naming the fix command instead of whitespace.
 * Also owns the macOS 27 --glass-alpha transparency slider (localStorage).
 * CONDITIONS: classic scripts (namespace CP, no ESM); /api/plan is a read-only
 * endpoint served by server.js from db.plan(); all plan-derived text is
 * ASCII-normalised with CP.stripCJK before it reaches the DOM.
 * VERSION: 1.0.0 - two independent views, milestone layer, glass slider.
 */
var CP;
(function (CP) {
    const GLASS_KEY = 'cp.glass-alpha';
    const PX = 8;
    /** HTML-safe, CJK-free text for any plan-derived value. */
    function txt(v) {
        return CP.esc(CP.stripCJK(v === undefined || v === null ? '' : String(v)));
    }
    function num(v, d = 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : d;
    }
    /** depends_on may be a single id, an array, or a delimited string. */
    function depsOf(m) {
        const d = m.depends_on;
        if (!d)
            return [];
        if (Array.isArray(d))
            return d.map(String);
        return String(d).split(/[,;\s]+/).filter(Boolean);
    }
    /** Kahn topological order so the main line reads in depends_on order. */
    function topoMilestones(list) {
        const byId = {};
        const indeg = {};
        const succ = {};
        list.forEach((m) => {
            const id = String(m.id);
            byId[id] = m;
            indeg[id] = 0;
            succ[id] = [];
        });
        list.forEach((m) => {
            const id = String(m.id);
            depsOf(m).forEach((dep) => {
                if (byId[dep] && succ[dep]) {
                    succ[dep].push(id);
                    indeg[id] += 1;
                }
            });
        });
        const out = [];
        const seen = {};
        const queue = list.filter((m) => indeg[String(m.id)] === 0).map((m) => String(m.id));
        while (queue.length) {
            const id = String(queue.shift());
            if (seen[id])
                continue;
            seen[id] = true;
            out.push(id);
            (succ[id] || []).forEach((n) => { indeg[n] -= 1; if (indeg[n] <= 0)
                queue.push(n); });
        }
        list.forEach((m) => { const id = String(m.id); if (!seen[id]) {
            out.push(id);
            seen[id] = true;
        } });
        return out.map((id) => byId[id]).filter((m) => m !== undefined);
    }
    function renderEmpty(layer, plan) {
        const p = plan || {};
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
    function applyPlan(plan) {
        const layer = document.getElementById('milestoneLayer');
        if (!layer)
            return;
        if (!plan || plan.available !== true || !plan.milestones || !plan.milestones.length) {
            renderEmpty(layer, plan);
            return;
        }
        const milestones = topoMilestones(plan.milestones);
        const workUnits = plan.work_units || [];
        const relations = plan.relations || [];
        const mainLine = plan.main_line || [];
        const subLines = plan.sub_lines || {};
        const allH = [0];
        milestones.forEach((m) => { allH.push(num(m.start_offset_h), num(m.end_offset_h)); });
        workUnits.forEach((w) => { allH.push(num(w.start_offset_h), num(w.end_offset_h)); });
        const minH = Math.min(...allH);
        const maxH = Math.max(...allH);
        const span = Math.max(24, maxH - minH);
        const axisW = Math.ceil((span + 12) * PX);
        layer.style.setProperty('--ms-w', axisW + 'px');
        const xOf = (h) => Math.round((h - minH + 6) * PX);
        const wOf = (s, e) => Math.max(24, Math.round((e - s) * PX));
        const critical = {};
        mainLine.forEach((id) => { critical[String(id)] = true; });
        let ticks = '';
        for (let h = minH; h <= maxH + 12; h += 12) {
            ticks += `<span class="ms-tick" style="left:${xOf(h)}px">+${Math.round(h - minH)}h</span>`;
        }
        const wuById = {};
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
            let ids = Array.isArray(subLines[mid]) ? subLines[mid].slice() : [];
            if (!ids.length)
                ids = workUnits.filter((w) => String(w.milestone_id) === mid).map((w) => String(w.id));
            let subs = '';
            ids.forEach((wid) => {
                const w = wuById[wid] || { id: wid };
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
            rels += `<div class="ms-rel"><span class="ms-rel-from">${txt(r.from)}</span><span class="ms-rel-arrow">-&gt;</span><span class="ms-rel-to">${txt(r.to)}</span><span class="ms-rel-type">${txt(r.type || 'FS')}</span><span class="ms-rel-lag">${lag >= 0 ? '+' : ''}${lag}h</span></div>`;
        });
        const critNote = `<div class="ms-critical-note">Critical path: ${mainLine.map((id) => txt(id)).join(' -&gt; ') || '(none declared)'}</div>`;
        layer.innerHTML = `<div class="ms-legend">
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
    CP.applyPlan = applyPlan;
    /** Re-read the real plan through the service and re-render. */
    async function refreshPlan() {
        try {
            const r = await fetch('/api/plan', { cache: 'no-store' });
            applyPlan(await r.json());
        }
        catch (e) {
            const layer = document.getElementById('milestoneLayer');
            if (layer)
                renderEmpty(layer, {
                    available: false, state: 'PLAN_FETCH_FAILED', label: 'Milestone plan unavailable',
                    detail: String(e), fix_command: 'node scripts/prd-to-action.js', message: '',
                });
        }
    }
    CP.refreshPlan = refreshPlan;
    /** The signature macOS 27 control: one --glass-alpha value drives both
     *  themes, is persisted in localStorage, and survives a reload. */
    function setGlass(v) {
        const pct = Math.max(10, Math.min(100, Math.round(v)));
        const alpha = pct / 100;
        document.documentElement.style.setProperty('--glass-alpha', String(alpha));
        try {
            localStorage.setItem(GLASS_KEY, String(alpha));
        }
        catch (_e) { /* storage blocked */ }
        const out = document.getElementById('glassAlphaOut');
        if (out)
            out.textContent = pct + '%';
        const input = document.getElementById('glassAlpha');
        if (input)
            input.value = String(pct);
    }
    function initGlass() {
        const input = document.getElementById('glassAlpha');
        if (!input)
            return;
        let saved = null;
        try {
            saved = localStorage.getItem(GLASS_KEY);
        }
        catch (_e) { /* storage blocked */ }
        const start = saved !== null && Number.isFinite(Number(saved))
            ? Math.round(Number(saved) * 100) : Number(input.value);
        input.value = String(Math.max(10, Math.min(100, start || 80)));
        setGlass(Number(input.value));
        input.addEventListener('input', () => setGlass(Number(input.value)));
    }
    function initMilestones() {
        initGlass();
        void refreshPlan();
    }
    CP.initMilestones = initMilestones;
})(CP || (CP = {}));
