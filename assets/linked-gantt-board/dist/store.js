"use strict";
var CP;
(function (CP) {
    CP.store = {
        state: null,
        selected: null,
        ownerFilter: 'all',
        issueFilter: 'all',
        query: '',
        listeners: [],
        subscribe(fn) { this.listeners.push(fn); },
        emit() { this.listeners.forEach((f) => f()); },
        async load() {
            const r = await fetch('/api/state', { cache: 'no-store' });
            if (!r.ok)
                throw new Error('state HTTP ' + r.status);
            this.state = await r.json();
            this.emit();
        },
        async call(method, path, data) {
            const r = await fetch(path, {
                method,
                headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
                body: data === undefined ? undefined : JSON.stringify(data),
            });
            if (!r.ok)
                throw new Error(`${method} ${path} -> ${r.status}`);
            return r.json();
        },
        /** Optimistic UI: mutate local state, patch views, then PUT and reconcile with SQLite truth. */
        optimistic(mut) {
            if (!this.state)
                return;
            mut(this.state);
            this.emit();
        },
        async commit(method, path, data, label) {
            try {
                await this.call(method, path, data);
                await this.load();
                CP.toast(label);
            }
            catch (e) {
                await this.load();
                CP.toast('Write failed, rolled back: ' + String(e));
            }
        },
    };
    function taskById(id) {
        return CP.store.state ? CP.store.state.tasks.filter((t) => t.id === id)[0] : undefined;
    }
    CP.taskById = taskById;
    function columnById(id) {
        const s = CP.store.state;
        if (!s)
            return { id, label: '', color: '#8e8e93', sort: 0 };
        return s.columns.filter((c) => c.id === id)[0] || s.columns[0];
    }
    CP.columnById = columnById;
    /**
     * Minimal DOM reconciler: updates existing nodes in place, inserts/removes only
     * what changed. Satisfies "no full-page re-renders" without a framework.
     */
    function reconcile(parent, items, key, create, update) {
        const existing = new Map();
        Array.from(parent.children).forEach((el) => {
            const k = el.dataset.key;
            if (k)
                existing.set(k, el);
        });
        const seen = new Set();
        let prev = null;
        items.forEach((item) => {
            const k = key(item);
            seen.add(k);
            let el = existing.get(k);
            if (!el) {
                el = create(item);
                el.dataset.key = k;
            }
            update(el, item);
            const target = prev ? prev.nextSibling : parent.firstChild;
            if (el !== target)
                parent.insertBefore(el, target);
            prev = el;
        });
        existing.forEach((el, k) => { if (!seen.has(k))
            el.remove(); });
    }
    CP.reconcile = reconcile;
    function select(id, scroll) {
        CP.store.selected = id;
        CP.paintSelection(scroll);
    }
    CP.select = select;
    function visibleTasks() {
        const s = CP.store.state;
        if (!s)
            return [];
        const q = CP.store.query.trim().toLowerCase();
        return s.tasks.filter((t) => {
            if (CP.store.ownerFilter !== 'all' && t.owner_type !== CP.store.ownerFilter)
                return false;
            if (q && `${t.title} ${t.owner} ${t.role} ${t.handoff}`.toLowerCase().indexOf(q) < 0)
                return false;
            return true;
        });
    }
    CP.visibleTasks = visibleTasks;
})(CP || (CP = {}));
