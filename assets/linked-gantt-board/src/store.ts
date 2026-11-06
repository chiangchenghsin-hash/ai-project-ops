namespace CP {
  type Listener = () => void;

  export const store = {
    state: null as State | null,
    selected: null as string | null,
    ownerFilter: 'all',
    issueFilter: 'all',
    query: '',
    listeners: [] as Listener[],

    subscribe(fn: Listener): void { this.listeners.push(fn); },
    emit(): void { this.listeners.forEach((f) => f()); },

    async load(): Promise<void> {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (!r.ok) throw new Error('state HTTP ' + r.status);
      this.state = await r.json() as State;
      this.emit();
    },

    async call(method: string, path: string, data?: unknown): Promise<unknown> {
      const r = await fetch(path, {
        method,
        headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}`);
      return r.json();
    },

    /** Optimistic UI: mutate local state, patch views, then PUT and reconcile with SQLite truth. */
    optimistic(mut: (s: State) => void): void {
      if (!this.state) return;
      mut(this.state);
      this.emit();
    },

    async commit(method: string, path: string, data: unknown, label: string): Promise<void> {
      try {
        await this.call(method, path, data);
        await this.load();
        CP.toast(label);
      } catch (e) {
        await this.load();
        CP.toast('Write failed, rolled back: ' + String(e));
      }
    },
  };

  export function taskById(id: string): Task | undefined {
    return store.state ? store.state.tasks.filter((t) => t.id === id)[0] : undefined;
  }

  export function columnById(id: string): Column {
    const s = store.state;
    if (!s) return { id, label: '', color: '#8e8e93', sort: 0 };
    return s.columns.filter((c) => c.id === id)[0] || s.columns[0];
  }

  /**
   * Minimal DOM reconciler: updates existing nodes in place, inserts/removes only
   * what changed. Satisfies "no full-page re-renders" without a framework.
   */
  export function reconcile<T>(
    parent: HTMLElement,
    items: T[],
    key: (item: T) => string,
    create: (item: T) => HTMLElement,
    update: (el: HTMLElement, item: T) => void,
  ): void {
    const existing = new Map<string, HTMLElement>();
    Array.from(parent.children).forEach((el) => {
      const k = (el as HTMLElement).dataset.key;
      if (k) existing.set(k, el as HTMLElement);
    });
    const seen = new Set<string>();
    let prev: HTMLElement | null = null;
    items.forEach((item) => {
      const k = key(item);
      seen.add(k);
      let el = existing.get(k);
      if (!el) { el = create(item); el.dataset.key = k; }
      update(el, item);
      const target = prev ? prev.nextSibling : parent.firstChild;
      if (el !== target) parent.insertBefore(el, target);
      prev = el;
    });
    existing.forEach((el, k) => { if (!seen.has(k)) el.remove(); });
  }

  export function select(id: string | null, scroll: boolean): void {
    store.selected = id;
    CP.paintSelection(scroll);
  }

  export function visibleTasks(): Task[] {
    const s = store.state;
    if (!s) return [];
    const q = store.query.trim().toLowerCase();
    return s.tasks.filter((t) => {
      if (store.ownerFilter !== 'all' && t.owner_type !== store.ownerFilter) return false;
      if (q && `${t.title} ${t.owner} ${t.role} ${t.handoff}`.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
}
