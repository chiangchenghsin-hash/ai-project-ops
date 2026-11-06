# Linked gantt / work-division board: reference implementation

**Status: starter kit, not a production panel.** `assets/linked-gantt-board/`
is a runnable TypeScript page + Node service that implements the *signature
interaction* of `references/panel.md` item 7 (one dataset, one linked drag) and the
day-one views of `SKILL.md` section 8. It does not implement the whole command
panel spec. Claiming section 4 is "done" because this page opens is a false PASS.

## Path convention (read this first)

Every path in this document is **package-root-relative**: it is resolved from
the skill root that contains `SKILL.md`. Examples: `assets/linked-gantt-board/`
is the implementation directory, `references/panel.md` is the spec, and
`docs/TASK-LOG.md` is the ledger. The pre-C2 edition of this file mixed three
bases (`../assets/...`, `assets/...`, and bare `references/...` / `TASK-LOG.md`);
that inconsistency is fixed here. No `../`-prefixed paths and no bare filenames
are used. The paths inside the fenced command block below are also
package-root-relative (`cd assets/linked-gantt-board`), so the block is run
from the skill root. One explicitly documented exception: the "Where" column
of the spec-to-implementation table uses short code identifiers resolved
relative to `assets/linked-gantt-board/` (e.g. `src/store.ts` means
`assets/linked-gantt-board/src/store.ts`). That is a single declared base, not
a mix; every navigable/path-bearing reference outside that column is
package-root-relative.

## Run and verify

```
cd assets/linked-gantt-board
node panel.js start                 # Windows: panel.bat start
node panel.js open                  # optional, opens default browser
node selftest.js                    # needs Chrome --headless=new --remote-debugging-port=9224
node panel.js stop                  # POST /shutdown
tsc -p tsconfig.json                # rebuild dist/ from src/
```

Runtime: Node >= 22.5 (`node:sqlite`, experimental), zero npm dependencies.
`assets/linked-gantt-board/data/*.json` are job->service handoff files;
`assets/linked-gantt-board/data/panel.db` is runtime state (never commit or
ship). The UI never reads raw files: `/data/` returns 403 and every read/write
goes through `/api/*`.

## Spec <-> implementation map (PRE-C2 baseline)

This table and the 19/19 evidence in the next section are the **PRE-C2
baseline**. They are kept verbatim in substance so the baseline stays auditable,
but they must not be read as the C2 acceptance claim. The C2 release ships
**>=30 verification cases** (see `references/evidence-matrix.md` and
`docs/evidence/evidence-layer-coverage.json` for the four-layer classification).

| Spec requirement | Where | Status (PRE-C2) |
|---|---|---|
| SQLite = single source of truth; jobs write JSON, service imports | `db.js`, `server.js`, `POST /api/import/*` | DONE |
| UI is TypeScript over service API only, never raw files | `src/store.ts`, `src/*.ts` | DONE |
| Human edits land through PUT endpoints | `PUT /api/tasks/:id`, `/api/columns/:id`, `/api/issues/:id`, `/api/command` | DONE |
| Gantt <-> board = ONE move on ONE dataset | `src/gantt.ts` + `src/board.ts` share `store.state.tasks` | DONE |
| Optimistic UI, snap to hour grid, PUT on drop, label+cost visible while dragging | `src/gantt.ts` (`onDown`/`onMove`/`onUp`), `.drag-tip` | DONE |
| Hour axis, 12h ticks `MM-DD HH:00`, midnight gridlines, NOW line | `src/gantt.ts`, `AXIS_HOURS`, `src/time.ts` | DONE |
| Min bar width ~12h + lane packing (no overlap) | `lanePlan()` in `src/gantt.ts` | DONE |
| Cost-first labels `103.7M/$2.24 - name` | `src/types.ts` `costLabel()` | DONE |
| Future items = ordered placeholder bars right of NOW, tier + non-commitment | seed `p1..p3` in `db.js`, `.gbar.placeholder` | DONE |
| Status columns are custom, stored in DB, add/rename/recolor/reorder/delete | `columns` table + `src/app.ts` column manager | DONE |
| Work-division cards: owner type / role / task / handoff; filter by owner type | `src/board.ts`, `#ownerFilter` | DONE |
| Command desk: KPI tiles, next command, snapshot button, notifications, job status | `src/desk.ts`, `db.js snapshot()` | DONE |
| Command snapshot with measured spend; clipboard + `execCommand` fallback, both tested | `src/desk.ts copyText()`, `selftest.js` | DONE |
| Issue ledger: reply / ENDDATE / urgent / status, overdue+48h+urgent+done highlights, survive reload | `src/ledger.ts`, `issues` table | DONE |
| Token metering: round ledger, tiers, caveats, numbers from imported meter data | `src/ledger.ts`, `rounds` table | DONE (demo handoff data, not a live meter probe) |
| Apple style, full light/dark via `prefers-color-scheme` | `styles.css` | DONE |
| Buttons/tabs carry NO dynamic counts | `panel.html` nav, `src/desk.ts` KPI tiles | DONE |
| One launcher with `/shutdown` | `panel.bat` / `panel.js start|stop|open`, `POST /shutdown` | DONE |
| Update views from data without full-page re-renders | `reconcile()` in `src/store.ts` | DONE (node identity preserved) |
| All text responses `; charset=utf-8` | `server.js` | DONE |
| Lean bundle, no heavyweight framework | vanilla TS compiled to classic scripts | DONE |
| Presence gate on scheduled jobs (section 5) | job status table shows `skipped: not present` only | NOT IMPLEMENTED (gap 1) |
| Measured on/off switches with meter probe (section 6) | none | NOT IMPLEMENTED (gap 2) |
| Module inventory + archive map views (spec items 5/6) | `module-notes.json` / `module-deps.json` imported but no UI | NOT IMPLEMENTED (gap 3) |
| Virtualized long tables | plain tables | NOT IMPLEMENTED (gap 4; fine for demo scale) |
| Archive in-app markdown reader | none | NOT IMPLEMENTED (sub-item of gap 3, the archive-map view) |
| ONE muted accent + grays only | status colors are data-driven (multi-hue) | INTENTIONAL DEVIATION - NOT A GAP (see "Remaining gaps" below) |

## Verification evidence (PRE-C2 baseline, 2026-11-05, real Chrome over CDP)

`node selftest.js` -> **19/19 PASS**, `0 JS exceptions / console errors`.
This is the PRE-C2 baseline suite; the C2 release carries >=30 cases. Key lines
(English translation of the original captured output):

```
PASS  SQLite handoff import: 15 units / 3 columns / 6 rounds / 5 issues / 5 jobs
PASS  UI does not read raw JSON: handoff directory 403 and no /data/ in resource list
PASS  hour axis: 42 12h ticks + midnight ticks + NOW line
PASS  cost-first label (cost before name) :: 103.7M/$2.24 - symbol-graph build and query
PASS  min bar width 12h and lane packing no overlap :: min=144 overlap=0
PASS  switch to plan page auto-scrolls to NOW, time bar in viewport :: scrollLeft=1434 visibleBars=12
PASS  status update is an incremental patch, not full-page re-render :: true
PASS  drag snaps to hour +3h (optimistic update) :: 2026-11-05T00:00 -> 2026-11-05T03:00
PASS  PUT persisted: SQLite holds the new time
PASS  board drag drives gantt bar status color with the same action :: {"status":"done","bg":"rgb(52, 199, 89)"}
PASS  custom status column written to SQLite and appears on board immediately :: {"n":4,"label":"Suspended"}
PASS  both clipboard paths usable (navigator + execCommand)
PASS  issue ledger reply written to SQLite via PUT
PASS  buttons/tabs have no dynamic counts, counts only in data views
PASS  prefers-color-scheme dark theme applied
PASS  time / status / status column / command / reply all survive reload
PASS  no runtime JS exceptions / console error :: 0
```

Seventeen key lines are pasted above; the full PRE-C2 suite had 19 cases.
Screenshots: `assets/linked-gantt-board/preview-plan.png`,
`assets/linked-gantt-board/preview-desk.png`,
`assets/linked-gantt-board/preview-dark.png`.

Gaps found and fixed during verification belong in the PDCA Check section
(honesty): cost label double-divided by 1e6; `.kb-list` missing `data-status`;
hidden-view `scrollLeft` reset to axis start; clipboard fallback needed a real
user gesture.

## Remaining gaps (PRE-C2 baseline)

The following is the authoritative gaps list and **matches
`references/panel.md`** (its "remaining gaps" clause) exactly. The
NOT IMPLEMENTED rows in the table above roll up into these four items.

1. Presence-gated scheduled jobs (spec section 5).
2. Measured on/off probes with a meter probe (spec section 6).
3. Module inventory and archive-map views (spec items 5/6), including the
   in-app markdown reader for the archive map.
4. Virtualized long tables.

**NOT A GAP:** the `ONE muted accent + grays only` -> status-colors
**INTENTIONAL DEVIATION** row in the table above. It is a deliberate design
decision, not a missing feature: status identity is functional, not decorative,
so the data-driven multi-hue status colors are kept while the rest of the
palette stays muted. Do not log it as a gap and do not count it against the
panel. This is the only table row that is neither DONE nor a gap.

## Adapting to a real project

1. Replace `assets/linked-gantt-board/data/rounds.json` with a read-only probe
   script over YOUR meter DB; introspect its schema first
   (`references/metering.md` is one example, not a standard).
2. Point the handoff JSON at real scheduled jobs and gate each with the
   3-signal presence check (`references/panel.md#presence-gate`); ship every
   token-spending job DISABLED and enable only after a measured probe.
3. Add module inventory / archive map only if they change a decision
   ("useful only").
4. Log the integration as one append-only PDCA entry (`docs/TASK-LOG.md`) with
   pasted verification output; rework = a NEW entry plus its own gantt bar.
5. Do not commit `assets/linked-gantt-board/data/panel.db`,
   `assets/linked-gantt-board/data/panel.pid`, browser profiles or screenshots
   of live data into the skill package.
