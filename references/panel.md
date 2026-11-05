# Command panel spec (dashboard / observatory)

The panel is the human's steering wheel and the AI's state feed. Data contract
first; the canonical stack is fixed: jobs write JSON files → a small service
imports them into **SQLite** (the single source of truth) → the panel is a
**TypeScript** UI reading only the service API (never raw files). Human edits
land in SQLite too (PUT endpoints), so every update — human or job — travels the
same path. UI is replaceable, the data contract is not.

Treat this file as a BUILD spec: the deliverable is a working page the human
opens daily — an AI that merely documents the panel has not delivered it.

## Views (top-nav, dashboard style)

1. **Command desk** — KPI tiles (span in hours, billed tokens, $, round count) +
   "next command" textarea + [Send update (copy snapshot)] + [Generate only] +
   notification inbox + scheduled-job status table + one-line collaboration rules.
2. **Milestone gantt** — hour axis (day-and-night work; never weeks). Bars: real
   work rounds with **cost-first labels** (`103.7M/$2.24 · <name>` so truncation
   never hides the spend); min bar width ≈ 12h with lane packing so bars never
   overlap; 12h tick labels `MM-DD HH:00`; midnight gridlines; a NOW line.
   Future items = ordered placeholder bars to the right of NOW, labeled
   "placeholder" with their token tier — non-commitment by construction.
3. **Issue ledger** — one row per open question: id / source / title(+detail) /
   reply textarea / ENDDATE date input / urgent checkbox / status select.
   Query bar (text filter) + chips (all / open / overdue / urgent / done).
   Highlights: overdue = red row + badge; due ≤48h = amber + badge;
   urgent = 3px red left edge; done = dimmed. Inputs persist and travel to the
   AI via the snapshot.
4. **Token metering** — round ledger table (id / name / window / billed / fresh /
   $ + totals) + estimation-tier table + the metering caveats.
5. **Module inventory** (for RE projects) — chips colored by disposition
   (bench/later/drop), search filter, click → detail card with "what / why"
   rationale + upstream/downstream neighbors + a "how to read the dependency
   graph" legend (layers, hubs, zero-indegree = plugin/reflection, ghosts).
6. **Archive map** — milestones → produced artifacts, with an in-app markdown
   reader (fetch + render; never rely on the browser's charset guessing).
7. **Work-division board** (project-management core) — one row per work unit:
   owner (human member / AI main session / subagent / agent team) / role / task /
   status / handoff note. Filter by owner type; see at a glance who owns what and
   where work is stuck. Keep only columns that steer a decision.

## Command snapshot (the reply channel)

Generated on demand and copied to clipboard:

```
[project snapshot YYYY-MM-DD HH:MM]
Next command: <human's textarea>
Todos 3/8 | overdue: ...      (per checkbox group, capped unchecked lists)
Issues open 12/21 · overdue 1 · urgent 2
Replies filled: ISS-1=first 30 chars ...
Total spend (measured): billed <N> tokens / $<x> (meter, read-only)
Latest round: <id> <name> [window]
```
(Numbers above are shape placeholders, not sample data.)

The human pastes it to Claude — that IS the direction channel.

## Data contracts (jobs → panel)

- `rounds.json`: `{rounds:[{id,name,outcome,start,end,ongoing,req,in,out,cacheR,billed,fresh,cost}], total, asof}`
- `notifications.json`: `[{ts,title,body,level,read}]` (newest first, cap 50)
- `status.json`: `{jobName:{last_run,ok,summary}}`
- `module-notes.json`: `{name:{domain,disp,what,why}}` (zero-omission over the
  full module corpus; assert set equality when generating)
- `module-deps.json`: `{entry:[], nodes:[{name,indeg,outdeg}], edges:[[a,b]]}`
Jobs write these; the service imports them into SQLite (`POST /api/import/*`)
so the panel stays a pure consumer. SQLite is the only store for panel state;
the JSON files are the job↔service handoff format, never a second store.

## Presence gate

Every scheduled job starts with a cheap check (any signal = present):

1. project session transcripts (`~/.claude/projects/<slug>/*.jsonl`) mtime < 6h, or
2. any git-tracked file mtime < 6h (direct IDE edits count), or
3. observatory ports accepting connections (panel in use).

Absent → record `skipped: not present` in status.json and exit 0 silently
(no notify, no spend). Window via env (e.g. `PRESENCE_HOURS`, your pick). Stateless and
self-healing — prefer this over enable/disable task toggling, which leaks state
after crashes.

## UI hygiene

- Buttons/tabs carry NO dynamic counts (they rot); counts render from data.
- All text responses serve `; charset=utf-8`; open docs in an in-app reader.
- Describe filenames meaningfully; keep the panel reachable via one launcher
  script (e.g. `panel.bat start|stop|open`) including a `/shutdown` endpoint so
  the UI can stop its own server gracefully.
- Clipboard copy always has a `execCommand` fallback and both paths are tested.
- The panel must never stutter: lean bundle (no heavyweight framework unless it
  earns its place), virtualize long tables, update views from data without
  full-page re-renders.
- **Useful only**: a view, column, or control ships only after it earns its place
  — if it never changes a decision, it does not ship. No speculative widgets.
