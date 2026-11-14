# Changelog

All notable changes to this skill package. Versions follow semver.

## Unreleased

## 1.10.0 - 2026-11-14 (SOP pack + ops stats + tabbed work board + A2UI Stage A)

Ships R35, R36 and AUI-01 Stage A: the SOP template pack on the milestone
library, deterministic ops-stats tiles on the Meter page, the two-tab Work
board with explicit cross-view jumps, and the A2UI v1.0 governance catalog
with its emitter/renderer and decision panel. SKILL.md version synced per
the R26-A rule. Stage B (governance cards wired into sheet-acks) follows.

- **R35 I-034 SOP template pack**: the I-031 template library gains a SOP
  category with exactly two seeded process templates - Code review (1 lint,
  2 test, 3 review APPROVAL, 4 merge) and Research (1 question, 2 gather,
  3 verify APPROVAL, 4 write-up). `[use]` on a milestone applies one work unit
  per step through the writeNodeStores four-store commit (status `pending`
  from the frozen vocab, FS links in order into `task_deps` with lag 0 /
  nature `mandatory`, prd-to-action 10/10 + plan-sync green asserted after
  every apply). APPROVAL steps carry the plan-only additive approval flag
  (mirrored into the additive `tasks.approval` column, R31 model/confidence
  pattern, so the Work board card can badge it); the plan row and the card
  show an APPROVAL badge and `gateFromScope` floors such a card to
  `needs-ack` (never `autonomous`, never `n/a`). `[save W chain as SOP]`
  saves an ordered W chain as a named SOP template and re-applies the same
  shape (round-trip). The six builtin WBS templates keep byte-identical
  list/apply behavior (additive store shape only). Selftest section 36;
  battery 226/226.
- **R35 I-035 ops stats**: `GET /api/stats` derives deterministically from
  existing rows only (zero writes, zero new stores, no timestamps - two
  calls return byte-identical JSON): approval pass <- `acks` decided-ask
  pass rate (n = state IN ('IN_PROGRESS','DONE'), m = state <> 'ACK'; the
  signed mockup's pass-rate semantics), human wait <- `acks` decided
  mean(updated-created) hours, completion <- `tasks` done/all, member load
  <- `tasks` open grouped by owner desc (per-metric table + filter named in
  the db.js source comment).
  Four tiles render on the Meter page above the token meter; an empty
  source shows `n/a`, never 0% (proven through the `patchStats` override
  seam). Selftest section 37; battery 234/234.

- **AUI-01 Stage A A2UI governance catalog**: multi-agent governance decision
  cards adopt the A2UI v1.0 contract. New `catalogs/agent-governance/v1/
  catalog.json` (AskCard / ReviewCard / DecisionRecord + agentOnly
  `recordDecision` / rendererOnly `formatAskAge`; basic-catalog atoms for
  everything else) with the stdlib gate `scripts/validate_a2ui_catalog.py`.
  New `src/a2ui.ts` (namespace CP.A2UI): v1.0 wire emitter
  (createSurface/updateComponents/updateDataModel) plus an injectable-doc
  renderer where `updateDataModel` refreshes bound text without structural
  re-render and decision clicks emit agent-side events only - the ledger
  write stays on the agentOnly contract. `a2ui-demo.html` (wire log +
  measured ask-to-ACK) and `a2ui-selftest.js` 12/12. Add-only round: no
  pending-release file touched; panel wiring is Stage B after 1.10.0.
  CJK 0; dist diff adds only `dist/a2ui.js`.

- **R36 Work board tabbed presentation (I-039)**: the Work board becomes a
  two-tab view - `[Work board]` kanban and `[Hour axis]` flat work units -
  styled as the Command desk sheet tablist, active tab persisted in
  `cp.wb-tab`. Cross-view navigation replaces the hover cross-highlight: a
  card's `-> hour axis` control switches to tab 2 and flashes the bar; a bar
  click without drag switches back and flashes the card; a moved bar drag
  swallows its trailing click. The 40/60 split (#wbSplit, `cp.wb-split`,
  stacked fallback) and `.is-link-hover` retire with their drag-hook wiring.
  Selftest retargeted to tab semantics (measurements per ACTIVE tab) plus a
  drag-suppression probe and R36 pinned-literal checks. Battery 236/236.
- **AUI-01 decision panel**: `a2ui-decisions.html` renders the open decision
  queue as governance AskCards (approve/reject/defer) with a copyable
  receipt - the standing surface for multi-item human decisions.

## 1.9.0 - 2026-11-11 (acceptance rounds + work board)

Ships R27-R32: live-review UI chrome, the I-020 goal tree with analysis
columns, the R29 acceptance batch, tree manual control with the WBS template
library, hour-axis humanization with card AI fields, and the merged Work board
with tree CRUD. SKILL.md version synced per the R26-A rule.

- **R27 UI chrome** (I-022/I-023/I-024): charter block folded by default,
  sidebar drag-resizable and collapsible, Settings page (theme / port /
  language row / glass / layout reset), plan panel folds + split divider,
  13 hint blocks cut to one-liners. Battery 120/120.
- **R28 I-020 traceability view**: goal tree + analysis columns (status |
  progress | cost | rounds | rework) served from /api/plan goals+analysis;
  milestone M7 shipped todo -> done; fix round caught a derivation-rule drift
  and a latent window.location-stub defect (section 28 gate). Battery 126/126.
- **R29 I-025..I-030 acceptance batch**: First principles on Command desk
  only, glass slider moved to Settings, plan pagination with pinned tab bar,
  issue ledger with evidence + drag-resizable columns + working mirror upsert,
  kanban card dependency links, dependency model completion (lead = negative
  lag + nature vocab). Battery 148/148.
- **R30 I-031 tree manual control + template library**: G/M fold toggles with
  persistence, drag-move behind validated atomic three-store writes (gates
  green after every move kind), 6-template WBS library with save/apply, and
  the ms-scroll layout fix. Battery 167/167.
- **I-036 subagent dispatch discipline**: checkpoint rule in SKILL.md section
  2 and the brief template (interim report per scope item, ~20 min status
  pause, stop after two failed attempts); handbacks require pasted evidence.
- **R31 I-032/I-033**: hour-axis humanization (one purpose line, labelled NOW,
  tooltips with start-end/duration/cost/owner, past-hours shading, shared
  status palette) + card AI fields (model/instance/cost/confidence, owner-scope
  gate badges with below-threshold auto-escalation, per-card audit trail,
  red-line-1 scan gate). Battery 192/192.
- **R32 I-037/I-038**: Work board (kanban + hour axis on one page, 40/60
  persisted split, card<->bar cross-highlight) + tree CRUD (detail drawer,
  four-store atomic commits with per-class gate assertions, add-child with
  fresh ids, cascade delete behind a dependents confirm). Fix round caught a
  flex min-width:0 product bug that broke real-pointer drags. Battery 213/213.

## 1.8.1 - 2026-11-09 (graph design + skill map)

Docs-only round. No product code change.

- **R25 graph registry design**: `docs/GRAPH-DESIGN.md` (pre-registered, design
  only). One relation registry over the existing id spaces (M/W/I/entry/handoff),
  a mandatory `Graph: scope ...` machine line in future PDCA entries, and eight
  locked acceptance criteria for the future implementation round.
- **R26 skill map note**: `references/prd-to-action.md` records the wording-level
  hardening of the installed prd-to-action skill (activation precondition,
  Phase 3 evidence rule, quantified BREAK miss_rate gate). The skill file itself
  lives outside this package and is READ, not copied.
- **Unchanged**: 18.0/20, the C4 UNCERTAIN verdict, all frozen artifacts.

## 1.8.0 - 2026-11-09 (C10 link audit + C11 desk sheets + release audit)

Two rounds recorded in `docs/TASK-LOG.md` after the 1.7.0 packaging, plus the
release audit that ships them.

- **C10 link-audit remediation**: one issue status vocabulary (`open|done`)
  across CLI and panel; `scripts/plan-sync.js --check/--set` writes PDCA
  status back across the three stores (PRD Status line, milestones.json,
  milestone-plan.json) with zero-write reject paths; plan work units W1-W18
  materialize into SQLite under the same id (`--seed-tasks`) so done/todo
  travels by id; demo rows untouched.
- **C11 desk sheets with queryable history**: the Command desk 2x2 grid
  becomes four per-unit sheets (console / inbox / acks / signals) with
  localStorage restore; a `desk_events` stream behind GET/POST `/api/events`
  records command saves, ACK decisions, job imports and signal raise/clear
  transitions on stable keys. The CDP suite grows additively 89 -> 111.
- **Release audit (R24)**: 111/111 CDP, 15/15 discipline selftest, 14/14
  package validation, CJK_COUNT=0, four frozen hashes MATCH. Per-turn gate
  evidence, the machine-local `.workbuddy/` install state and the build zip
  are gitignored, matching the exclusion class of `scripts/package.py`.
- **Unchanged**: 18.0/20, the C4 UNCERTAIN verdict, the data contract
  (rounds / notifications / status / module-notes / module-deps) and the
  demo seed.

## 1.7.0 - 2026-11-08 (C9 remediation)

Pre-registered in `docs/REMEDIATION-PLAN-C9.md` (A1-A8, failure cells, file
ownership, non-goals) BEFORE work started. Two implementation subagents with
mutually exclusive ownership; the main session compiled, wrote the unified CDP
assertions, installed the hooks and owns the ledger.

- **F1 correction**: the recorded OPEN issue I-006 was STALE. Dependency arrow
  lines already existed (`gantt.ts:139-154` blue/red `gdep` paths with arrow
  markers, `:308` click-to-delete, `:195-210` drag preview, `graph.ts:210`
  bump cascade). Closed with code evidence, not rebuilt. B2 upgraded to
  IMPLEMENTED.
- **B1 implemented**: `approval_actions` SQLite table seeded from
  `data/approval-matrix.json` (7 rows), `GET /api/policy/approvals`, and a
  `PUT /api/acks/:id` rule that returns HTTP 400 for a REJECTED decision with
  a blank reason. Valid rejects persist `reject_reason` in SQLite.
- **B6 implemented**: `owner_scopes` SQLite table (4 owner types),
  `GET /api/policy/owner-scope`, `src/policy.ts` + desk-view tables.
- **B5 implemented**: `CP.sharedOrder`, `CP.Board` multi-select,
  `Alt+ArrowUp/Down` move-to-top/bottom persisting `sort` via PUT, one shared
  order for kanban and gantt (`data-order`).
- **F5 hooks installed**: project-level `.workbuddy/settings.json` now holds
  `UserPromptSubmit` and `Stop`; a second `--apply` added 0 duplicate entries.
  No user-global settings file was written.
- **Verification**: 81 -> 89 CDP assertions, `89/89 passed`, `RESULT: PASS
  (exit 0)`; 8 new cases cover the policy APIs, the 400 negative, persistence,
  shared order, multi-select and move-to-top. `benchmark-adoption.js` v1.2.0
  now expects real code landings (13/13), with a negative control that
  downgrades B1. `adoption-manifest.json` re-signed (v1.0.3). Two master
  templates bumped to v1.1.0 so `--status` honestly reports DRIFT against
  their v1.0.0 instances (Monday no-overwrite rule working).
**C9-1 correction after cold reader R5 (same release):** R5 judged the first
C9 draft "needs revision". D1 (issue snapshot still said I-006 was OPEN),
D3 (DRIFT needed an explanation), D5 (line-number drift) were fixed, and a
C9-1 correction was APPENDED to the pre-registered plan without editing
A1-A8. D2 was the important one: the A4 assertion had been weakened to ONE
selected card and never proved list/board order equality. It was STRENGTHENED
to two cards, per-task shared-order index equality on both views, and BOTH
cards persisting a new `sort`. The strengthened suite FAILED on its first run
(`selected=2 persisted=1`), exposing a real `board.ts` bug: new sort values
were based on the unselected subset, so a selected card could be assigned
exactly its old value. Fixed by using whole-column extremes and serialising
the PUTs (`commit()` reloads the whole state). Re-run: `89/89 passed` with
`persisted=2`. The R5 report is retained, not rewritten.

- **Unchanged**: 18.0/20, the C4 UNCERTAIN verdict, all four frozen hashes,
  the rubric, and the C9 plan document itself (pre-registered, not edited).

## 1.6.0 - 2026-11-08 (C8 - benchmark adoption)

The human pointed out that the R17 competitive research (Teambition, ONES,
PingCode, Feishu Project, Linear, Height, Notion, Monday, ClickUp, Asana,
Motion, Devin, Jules, Copilot) never reached `templates/`. Verified: the
synthesis had six ordered build-first items, four were in code, two were not,
and ZERO of the five templates came from a benchmark.

- **New**: `docs/BENCHMARK-ADOPTION.md` - six items reconciled against code with
  `file:line`; B1 and B6 labelled NOT IMPLEMENTED, not silently promoted.
- **New**: four benchmark-derived templates with `Benchmark:` provenance -
  template governance (Monday A1/A2/A3/A4), agent session (Linear A1/A2),
  approval matrix (Asana A3 + synthesis B1), owner scope (claim 4 + B6).
- **New**: `templates/registry.json` and `scripts/scaffold.js` v2.0.0 -
  master -> instance -> Publish, versioned masters, `template-lock.json`,
  role-checked `--publish`, drift `--status`, no-overwrite for existing
  instances (pre-existing instances registered with an honesty note).
- **New**: `scripts/benchmark-adoption.js` - 8/8 landings; `--negative` removes
  one template in memory and must be detected. Wired as Stop-hook invariant I10.
- **Changed**: SKILL.md v1.6.0 + section 14, description triggers, README
  contents, invariants I10, discipline negative control 15/15.
**C8 revision after cold reader R4 (same release):** R4 judged the first
adoption draft "needs revision" with six defects. All six were independently
confirmed. `scaffold.js` v2.1.0 now has REAL drift (`--status` reads the lock),
a REAL publish bump, and `--all` instantiation of the four benchmark masters;
B5 was downgraded PARTIAL -> NOT IMPLEMENTED; `benchmark-adoption.js` v1.1.0
adds per-row landing checks, fixed ids, instance checks, a signed manifest and
two negative controls (13/13). The R4 report is retained, not deleted.

- **Unchanged**: all C2/C4 frozen artifacts, 18.0/20, the UNCERTAIN
  effectiveness verdict, and the OPEN I-006 arrow-line follow-up. No rubric
  change, no C4 re-test. `.research/` reports remain excluded from the archive.

## 1.5.0 - 2026-11-08 (C7 plan backbone and visual correction)

Named correction **C7**, from a second human report: four UI/template
defects (no standalone Work-division kanban page; a Milestone gantt with no
main line / sub-lines / relations, i.e. a structurally empty plan; a sidebar
that appears absent because Purpose / Technical resources / Evaluation were
unset; an older Apple look instead of the latest macOS) and one engineering
request (the locally installed `prd-to-action` skill was not used).

- **New**: PRD-to-action integration (G1) — `docs/PRD.md`,
  `docs/evidence/milestones.json` and
  `assets/linked-gantt-board/data/milestone-plan.json` are the single source
  for milestone structure; `scripts/prd-to-action.js` is the adversarial
  milestone gate (invariant I9, HARD/blocking);
  `references/prd-to-action.md` maps the harness. SKILL.md gains section 13
  and six new trigger phrases.
- **New**: two standalone views (G2) — the Milestone gantt and the
  Work-division kanban split into separate pages; the sidebar/charter
  description is filled (Purpose / Technical resources / Evaluation).
- **New**: macOS 27 "Golden Gate" visual style (G2) — readability-fixed
  Liquid Glass, a transparency slider, and colored sidebar icons.
- **Changed**: SKILL.md version 1.5.0, description triggers; README contents
  table; `docs/DISCIPLINE-INVARIANTS.md` (I9 added, honest Stop-hook wiring
  status); `docs/DISCIPLINE-ISSUES.md` (I-008..I-012 registered OPEN,
  pending main-session verification, OPEN = 6); `templates/PLAN.template.md`
  (PRD-to-action backbone section).
- **Unchanged**: all frozen C2/C4 artifacts (four hashes MATCH) and the
  18.0/20 score. This release changes plan structure and presentation, not
  evidence availability; the UNCERTAIN effectiveness verdict stands. Only the
  main session closes the new issues, after pasted evidence.

## 1.4.0 - 2026-11-08 (C5 machine-enforced discipline)

From one human report in real usage: the AI never updates the issue ledger,
discipline is poor, software engineering is barely used, the plan template is
skipped, and task relationships are weak. Root cause: all eleven disciplines
were prose; `issues` was writable in the store layer but had no API route and
no agent-side path; `templates/` had no consumer; no hook existed.

- **New**: `scripts/session-start.js` (UserPromptSubmit) injects the open-issue
  count and the three closing actions, and snapshots the session.
- **New**: `scripts/issue.js` — offline agent-side issue ledger path
  (`list|add|update|close|no-new`), committable `docs/evidence/issues.json`,
  best-effort SQLite mirror. Six reported defects registered as I-001..I-006;
  five closed, I-006 left open as a partial fix.
- **New**: `scripts/discipline-gate.js` (Stop) recomputes eight invariants;
  I1-I6 missing -> exit 2 and a concrete fix hint. Fail-open on internal error,
  DRYRUN and DISABLE switches.
- **New**: `scripts/scaffold.js`, `templates/PLAN.template.md` — templates are
  now in the section 8 bootstrap order, checked by I3.
- **New**: `hooks/settings.fragment.json`, `hooks/INSTALL.md`,
  `scripts/merge-hooks.py` — project-level install, idempotent merge, dry-run
  default, global-target guard.
- **New**: `scripts/selftest-discipline.js` — 12/12 negative/positive control;
  `scripts/package.py` — reproducible release with exclusion rules and an
  outside checksum.
- **Changed**: SKILL.md version 1.4.0, section 7 now default ON, section 8
  mandates scaffolding, new section 12, description trigger phrases; README
  contents table.
- **Unchanged**: all C2/C4 frozen artifacts (four hashes MATCH), the 18.0/20
  score (this release changes enforcement, not evidence availability), and the
  UNCERTAIN effectiveness verdict. No rubric was edited after data.

## 1.3.0 - 2026-11-08 (C4 confirmatory round)

- **New freeze id** `ai-project-ops/C4/confirmatory-execution/2026-11-06-v1-001`.
  The C2 design freeze was NOT edited; all four frozen hashes still MATCH.
- **Executed** 8 frozen paired cards in 16 independent subagent sessions
  (A = skill-loaded, B = no-skill), 2 independent blind raters, seeded blind
  labels R01..R16, conservative arbitration, exact sign-randomization test
  over 2^8 = 256 assignments, leave-one-out stability, and a reproducible
  recomputation script.
- **Verdict UNCERTAIN**: 2 rater disagreements (R01, R12), exact one-sided
  p = 0.125 > alpha 0.05, and E10 failure cells C2/C4 with no discrimination.
  Direction favours the skill arm (3 positive pairs, 0 negative) but is not
  significant. No veto fired.
- **Structural finding**: with n=2 pairs per cell the minimum attainable
  per-cell p is 0.25 > 0.05, so PASS is unreachable at cell level in this
  frozen design. Fix only under a NEW C5 freeze id with >= 3 pairs per cell.
- Added `references/effectiveness.md` and the full evidence set under
  `docs/evidence/confirmatory/`. Pre-locked rule applied as written:
  dimension 10 -> 2.0, total -> **18.0/20**. This measures evidence
  availability, NOT demonstrated skill effectiveness; the effect question
  remains UNCERTAIN.

## 1.2.0 - 2026-11-06 (GitHub release)

- **Published to GitHub** as `chiangchenghsin-hash/ai-project-ops` on branch
  `main`. The archive now ships the complete package: 11 disciplines, the
  linked-gantt panel starter kit, the validation / E2E / localize scripts, the
  blank templates, and the C2/C3 evidence layer.
- **C3 response style**: added SKILL.md section 11 and
  `references/response-style-ste100.md`. Covers the softened 80% ASD-STE100
  style (short sentences / active voice / one word one meaning / numbered
  steps / no hedging / no synonym rotation), graded source provenance, the
  Chinese ~20-character local approximation, prompt templates, and the
  mandatory fact-retention gate. Frozen artifacts were not edited; the C2
  freeze remains valid.
- Added response-style trigger phrases to the SKILL.md description.

## 1.1.0 - 2026-11-05 (English GitHub release)

- **C2 verification-evidence layer**: three cold-read reports, four-layer
  evidence matrix, error codes E01-E12, PDCA three-state verdict
  (PASS / FAIL / UNCERTAIN) and the C2 acceptance classification added to the
  package.
- **English localization**: whole package converted to English-only text
  (zero CJK characters); `assets/linked-gantt-board/` localized to strict ASCII,
  compiled `dist/` regenerated.
- **S1-S4 panel increments**: linked gantt / work-division starter kit, ACK
  command loop, blocking-signal desk with "Needs human decision", health /
  backup / restore / degraded DEMO mode, and a >=30-case CDP selftest suite.
- **Cold-read fixes**: internalized the official spec into
  `references/packaging-spec.md` (8-field frontmatter table, `@references`
  conventions, zip rules, red lines, release checklist); unified metering
  column definitions between `SKILL.md` section 3 and `references/metering.md`;
  stated the starter-kit caveat plainly so shipping the page no longer reads as
  satisfying section 4; kept the "paste verification output" rule.
- **8-field frontmatter**: `SKILL.md` now carries `name`, `display_name`,
  `display_name_en`, `description`, `description_zh`, `description_en`,
  `version` (1.2.0) and `author`, plus `examples_zh` / `examples_en` (3 each),
  `allowed-tools` and `agent_created: true`. `description` gained a "Not for:"
  negative-trigger list and lost all unbounded-claim wording.
- **Validation scripts**: added `scripts/validate_skill.py` (14 deterministic
  offline checks, writes `docs/evidence/validation-report.json`, exit 0/1/2),
  `scripts/verify.js` (one-command server + headless Chrome + selftest E2E),
  `scripts/localize_check.py` (CJK counter). All carry the
  BACKGROUND / CONDITIONS / VERSION header.
- **New docs and templates**: `templates/` (TASK-LOG, PDCA entry, subagent
  brief), `docs/TRIGGER-REGRESSION.md` (20 positive / 10 negative phrases),
  `docs/RELEASE-CHECKLIST.md` (pre-publish gates + post-publish reminder),
  `docs/handoffs/P3.md`. README documents install paths for both Claude Code
  and WorkBuddy plus the verify/validate commands.

## 1.0.0 - pre-C2

Initial Chinese-language package: 10 disciplines, PDCA ledger, subagent briefs,
metering rules, command-panel spec, and a linked gantt / work-division board
starter kit. Superseded by the English 1.1.0 release.
