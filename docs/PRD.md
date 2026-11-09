# PRD - AI Project Ops Command Panel (English GitHub release, v1.4.0 baseline)

## 1. Purpose and problem

This package ships the operating discipline for an AI-led engineering project:
a single PDCA ledger, subagent briefs, token metering, and a human-AI command
panel. The panel must be a working web page backed by a SQLite single source of
truth, not prose.

A human reported a concrete defect on the Milestone gantt page: it renders a
flat list of work units with no main line, no sub-lines and no relationships.
The plan, in other words, has no milestone structure. This PRD fixes the input
contract behind that page. It defines six milestones (M1..M6) on one dependency
main line, groups work units into per-milestone sub-lines, and declares explicit
FS/SS/FF/SF dependency edges. The panel reads
assets/linked-gantt-board/data/milestone-plan.json and draws milestone lanes
beside the existing t1..t15 demo tasks. Work units here use W-prefixed ids so
they never collide with the 15 demo tasks.

## 2. Tech Stack

- Runtime: Node 22.5 or newer; node:sqlite (DatabaseSync) is built in. No npm
  dependencies anywhere in the package.
- Panel UI: vanilla TypeScript in assets/linked-gantt-board/src, compiled by
  tsc (tsconfig.json) to classic scripts in dist. No bundler, no modules.
- Service: assets/linked-gantt-board/server.js and db.js over SQLite.
- Gate drivers: Node stdlib scripts in scripts/ (verify.js, discipline-gate.js,
  selftest-discipline.js, prd-to-action.js) plus three Python helpers
  (validate_skill.py, package.py, localize_check.py).
- No network access, no package manager, no installs at run time.

## 3. Constraints

- English-only, ASCII package: zero CJK characters in every shipped file.
- SQLite is the single source of truth; JSON handoff files are inputs, the DB
  is authoritative. No runtime state (data/panel.db*, panel.pid) is committed.
- Port 4174 is the default; PANEL_PORT and CDP_PORT (9224) are env-overridable.
- The UI is replaceable; the data contract (status columns, task_deps, rounds,
  issues, milestone-plan.json) is not.
- Acceptance is pasted command output. A clean sentence is not evidence.

## 4. Baseline (measured at v1.4.0)

- 15 demo work units (t1..t12 plus p1..p3 placeholder bars).
- 4 status columns (stored in the SQLite columns table, not hardcoded).
- 5 issues (ISS-1..ISS-5) in demo-seed.json.
- 6 rounds (R1..R6) in rounds.json.
- 71 selftest assertions in assets/linked-gantt-board/selftest.js.
- 118 zip entries at v1.4.0 from python scripts/package.py.

## 5. Data contract

- docs/PRD.md - this document, the source of truth for the plan.
- docs/evidence/milestones.json - machine-readable mirror: 6 milestones, the
  main line, sub-lines and dependency edges.
- assets/linked-gantt-board/data/milestone-plan.json - the file the panel
  reads (schema ai-project-ops.milestone-plan/1.0): charter, 6 milestones, at
  least 14 W-prefixed work units, at least 10 acyclic relations, main_line and
  sub_lines.
- scripts/prd-to-action.js - the adversarial gate described in section 7.

## 6. Milestones

The dependency chain M1 to M6 is the MAIN LINE. Each milestone carries the
eight fields from the installed prd-to-action skill's .memory/project.md
template. Completion lines are falsifiable: each names files, counts or a
concrete command with an exit code.

### M1: Ingest and plan bootstrap
- Depends on: none
- Type: design
- Has external deps: no
- Files: docs/PRD.md, templates/PRD.template.md, docs/PLAN.md
- Completion: docs/PRD.md has 6 milestone blocks with all seven fields; docs/evidence/milestones.json parses under ai-project-ops.milestones/1.0 with 6 entries; node scripts/scaffold.js emits the ai-project-ops.plan/1.0 marker into docs/PLAN.md; gate A reports zero banned phrases in the PRD.
- Verify: node scripts/scaffold.js
- Status: done

### M2: Milestone plan data contract and structure graph
- Depends on: M1
- Type: code
- Has external deps: no
- Files: assets/linked-gantt-board/data/milestone-plan.json, assets/linked-gantt-board/data/module-deps.json
- Completion: milestone-plan.json parses under ai-project-ops.milestone-plan/1.0 with 6 milestones, 18 work units and 16 acyclic relations; node scripts/discipline-gate.js exits 0 with I4 zero cycles and I5 zero dangling ids in docs/evidence/structure-gate.json.
- Verify: node scripts/discipline-gate.js
- Status: done

### M3: Issue ledger and Stop gate (TodoWrite state machine)
- Depends on: M2
- Type: code
- Has external deps: no
- Files: scripts/issue.js, scripts/session-start.js, docs/evidence/issue-delta.json, docs/TASK-LOG.md
- Completion: scripts/issue.js supports list, add, update, close and no-new; scripts/session-start.js emits the discipline-gate reminder; node scripts/selftest-discipline.js prints 12/12 passed with the skipped turn blocked at exit 2 and the compliant turn at exit 0.
- Verify: node scripts/selftest-discipline.js
- Status: done

### M4: Command panel build (linked gantt and relationship layer)
- Depends on: M3
- Type: code
- Has external deps: yes (headless Chrome over CDP; node:sqlite)
- Files: assets/linked-gantt-board/src/gantt.ts, assets/linked-gantt-board/src/app.ts, assets/linked-gantt-board/dist/gantt.js, assets/linked-gantt-board/panel.html
- Completion: dist/gantt.js and dist/app.js exist and panel.html loads them as classic scripts; milestone-plan.json main_line, sub_lines and relations render as milestone lanes and FS/SS/FF/SF edges; node scripts/verify.js exits 0 with selftest.js printing PASS lines from a real headless Chrome over CDP.
- Verify: node scripts/verify.js
- Status: done

### M5: PRD-to-action adversarial gate
- Depends on: M4
- Type: code
- Has external deps: no
- Files: scripts/prd-to-action.js, references/prd-to-action.md
- Completion: scripts/prd-to-action.js prints one PASS line per gate and the PRD-TO-ACTION GATE: n/n passed summary; normal mode exits 0 at n/n; --negative mode injects a banned phrase into a temp PRD copy and the gate detects it with exit 2; references/prd-to-action.md carries the phase-to-package mapping table.
- Verify: node scripts/prd-to-action.js
- Status: done

### M6: English-only release packaging and validation
- Depends on: M5
- Type: code
- Has external deps: no
- Files: scripts/package.py, scripts/validate_skill.py, scripts/localize_check.py, docs/handoffs/G1.md
- Completion: python scripts/validate_skill.py reports failed = 0; python scripts/package.py --out ai-project-ops.zip builds a zip whose entry count matches the packaged file set of the same run and a checksum outside the archive; a CJK scan over the owned files prints 0; docs/handoffs/G1.md has the four required sections and stays under 40 lines.
- Verify: python scripts/validate_skill.py
- Status: done

## 7. Verification gates

After every milestone the deterministic gates run. scripts/prd-to-action.js is
the PRD gate: it rejects the eight vague acceptance phrases from the skill's
quality-gate checklist, rejects unresolved template-variable markers, requires
the seven milestone fields, resolves every Verify command to a real script in
this package, proves the main line is a valid topological order and the
relations are acyclic with no dangling ids, and checks the charter fields. Its
--negative mode proves the banned-phrase gate has discrimination. scripts/
verify.js is the end-to-end Chrome/CDP gate. scripts/selftest-discipline.js is
the I1/I2 Stop-gate control that prints 12/12.

## 8. Non-goals

- No live score or numeric rating in the charter evaluation; PDCA iteration in
  docs/TASK-LOG.md is the evaluation method.
- No replacement of the 15 demo tasks: the W work units are plan structure that
  G2 renders as milestone lanes alongside them.
- No vendored copy of the installed prd-to-action skill; its method is read,
  not copied into this package.
