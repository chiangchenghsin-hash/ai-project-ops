# Discipline deficit ledger (skill's own defects)

> Machine source: `docs/evidence/issues.json`. This human-readable snapshot is
> GENERATED from that file by the main session; edit issues with
> `node scripts/issue.js ...`, never by hand.
> This is a committable artifact ABOUT the skill itself, not the project's
> in-flight SQLite issue ledger (section 9 keeps those apart).

Regenerate with `node scripts/issue.js regen-doc`.

Source: two human reports from real usage (2026-11-08) plus defects found by the main session. 39 registered, 38 done, 1 open.

| id | status | title | reply |
|---|---|---|---|
| I-001 | done | AI never updates the issue ledger at session end | C5: scripts/issue.js gives an offline agent-side write path; I1 Stop invariant blocks a skipped turn. |
| I-002 | done | Disciplines are prose and can be skipped | C5: six invariants recomputed by scripts/discipline-gate.js; negative control 12/12. |
| I-003 | done | No start/stop hook enforces closing actions | C5: session-start.js + discipline-gate.js + hooks/settings.fragment.json + merge-hooks.py. |
| I-004 | done | Software engineering gates marked optional | C5: section 7 now default ON; gate recomputes DAG cycles and writes structure-gate.json. |
| I-005 | done | Project plan template never used | C5: templates/PLAN.template.md added; scaffold.js is mandatory in section 8; I3 checks the marker. |
| I-006 | done | Task relationships are weak | CORRECTED at C9 (C9-1 line fix): the arrow-line overlay was ALREADY built. gantt.ts:139-154 drawEdges() emits <path class=gdep marker-end=url(#arrowOk/arrowBad)> with blue/red semantics; :308 click-to-delete edge; :195-210 drag preview; graph.ts:210 bumpCascade. The C7 note claiming it was unbuilt was a stale judgement. Closed with code evidence, not rebuilt. |
| I-007 | done | verify.js collides with a foreign service on port 4174 | Not a code defect. verify.js honours PANEL_PORT/CDP_PORT; re-ran on 4184/9234 -> 71/71 PASS exit 0. Foreign service untouched (4174 -> 200). Documented in the C5 PDCA Check. |
| I-008 | done | Work-division kanban has no standalone page | G2 added #view-board with data-view=board; nav has 5 entries; 81/81 CDP assertions include view switching. Screenshot plan page no longer holds the kanban. |
| I-009 | done | Milestone gantt has no main line, sub-lines or relations | G1 wrote docs/PRD.md + milestones.json + milestone-plan.json (6 milestones / 18 work units / 16 acyclic relations). G2 rendered MAIN LINE / SUB-LINES / RELATIONS / CRITICAL PATH. prd-to-action.js 10/10 PASS, --negative detects tampering. |
| I-010 | done | Sidebar appears absent because charter fields are unset | Charter now seeded from the plan file through /api/state (effectiveMeta); screenshot shows real Purpose / Technical resources / Evaluation and a sidebar purpose line. No Not set placeholders. |
| I-011 | done | Visual style is an older Apple look | macOS 27 Golden Gate readability-fixed Liquid Glass: glass layers, real 80% transparency slider persisting --glass-alpha, colored sidebar nav icons, tighter radii, dark body still rgb(28,28,30). Verified by CDP assertions. |
| I-012 | done | PRD-to-action skill was never used | Installed prd-to-action harness read as a method; Phase 0 INGEST -> PRD.md, Milestone template -> milestone-plan.json, adversarial grep -> prd-to-action.js, wired as Stop-hook invariant I9. |
| I-013 | done | Subagents leaked a personal path and documented I9 without wiring it | Two paths redacted to <USER_SKILLS>/; validator leaks=0 exit 0. I9 wired into discipline-gate.js and proven by 14/14 negative control. |
| I-014 | done | R17 competitive research never reached templates or a gate | C8: docs/BENCHMARK-ADOPTION.md maps B1-B6 to code with file:line; 4 templates carry Benchmark headers; registry.json + scaffold v2 wire Monday master/instance/Publish; benchmark-adoption.js 8/8 PASS with --negative detection, wired as Stop-hook I10. |
| I-015 | done | Cold reader R4 found six defects in the first adoption chain | All six independently confirmed and fixed: scaffold v2.1.0 (real drift/bump/--all), benchmark-adoption v1.1.0 (13/13 + dual negative + signed manifest), B5 downgraded, owner-scope status line. R4 report retained, not deleted. |
| I-016 | done | Issue status vocabulary fork: closed vs done | G2 FIXED: issue.js:85/:121 and session-start.js:33 now use 'done'; write-side validation restricts --status to open\|done (exit 1 otherwise); 15 legacy issues migrated closed->done via CLI (delta events appended); DISCIPLINE-INVARIANTS.md:93 example updated. Verified: issue.js list OPEN=3, selftest-discipline 15/15, negative control --status closed rejected without write. |
| I-017 | done | No status write-back chain after PDCA rounds | G1 FIXED: scripts/plan-sync.js --check (three-store status equality PRD/milestones.json/milestone-plan.json + work-unit status/progress coherence, 25/25) and --set (write-back from PDCA Act step, reject-path zero writes). prd-to-action.js gate X now asserts 3-store status equality (verified by divergence probe: ms-only flip -> 9/10 exit 2). Evidence-backed flips via --set: M4+M5+M6 done, W10-W18 done/progress=100. M6 completion criterion corrected (stale '118 entries' -> 'entry count matches the packaged file set of the same run') in all three stores, traced. Gates: plan-sync 25/25, prd-to-action 10/10, --negative exit 2 (A only), selftest-discipline 15/15, verify 89/89 (PANEL_PORT=4184), validate_skill failed=0. |
| I-018 | done | Two work-unit ID spaces: W1-W18 vs t1-t12 | G3 FIXED (ID unification, not mapping table): plan-sync.js --seed-tasks materializes plan W1-W18 as SQLite task rows preserving W ids (billed*1e6, role=milestone_id, sort=plan order) + 16 task_deps rows; demo t*/p* rows untouched. --check adds SQLite coherence per-W + relations line when panel.db exists (44/44), SKIP line when absent (transient state, never implicit create). --set propagates status+progress both ways by id. Teeth: W10 forced divergent -> FAIL plan=done task=pending exit 2, healed by --set W10:done. G3-1 edge fix: --set accepts ID:status:progress; leaving done demands explicit progress (progress=100 reserved for done), reject paths zero-writes (sha256 proven). Final: plan-sync 25/25 (+SKIP), prd-to-action 10/10, selftest-discipline 15/15, verify 89/89 (run last; cleans its own panel.db*). |
| I-019 | done | Desk 4-unit grid: split into per-unit sheets with queryable history | I-019 FIXED in 4 packages: P-SVC desk_events table + GET/POST /api/events + auto-log hooks (command/save\|generate, ack/send\|approved\|done\|rejected, job/import; hour-granularity ts + id DESC tiebreak). P-UI desk-grid 2x2 -> 4 sheet tabs (#deskTabs console/inbox/acks/signals, localStorage desk.sheet, restore+fallback), each sheet has History block (filter 250ms debounce + refresh + ts\|kind\|detail rows); ACK rows show created timestamp; signal raise/clear differential logger in board.ts (first loaded render seeds silently). P-TEST 22 new assertions (suite 89 -> 111/111, two consecutive green runs). P-FIX signal key drift defect found by P-TEST: hour-counter in detail fabricated clear+raise pairs on key drift; keys now stable (kind+entity id), payload text unchanged; behavioral probe confirmed 1 raise + 1 clear across hour-flip reloads. Final battery (main re-run): verify 111/111, prd-to-action 10/10, selftest-discipline 15/15. |
| I-020 | done | Goal-anchored WBS decomposition + iteration analysis + visualization | R28 FIXED: goal rows + milestone/work-unit tree + analysis columns (status \| progress \| cost \| rounds \| rework) render on the plan page from /api/plan goals+analysis; M7 Traceability view (I-020) shipped todo -> done across three stores. Battery 126/126, prd-to-action 10/10, plan-sync 26/26, CJK=0. |
| I-021 | open | User wants must enter the issue ledger; rounds close issues (issue/PR model) | - |
| I-022 | done | Charter block overlays every page; sidebar must be resizable and collapsible | - |
| I-023 | done | Settings page: port, language, color scheme and friends | Human ruling 2026-11-14: English-only. The zero-CJK shipped-files gate stands untouched; no Chinese UI dictionary will ship. Theme/port/glass/layout rows landed in R27 (battery 120/120); the language row stays locked at English, which now matches the ruling. Closed by this ruling; no code change required. |
| I-024 | done | Plan page: Milestone plan and Hour axis panels resizable and collapsible | - |
| I-025 | done | First principles block: Command desk only; remove from all other pages | R29 FIXED: charter block renders only on Command desk (syncCharterView + hidden attr); section-29 assertions green. Battery 148/148. |
| I-026 | done | Glass slider moves to the Settings page; not on every page | R29 FIXED: global glass control removed; Settings Glass row is the single persisted --glass-alpha control. Battery 148/148. |
| I-027 | done | Plan page pagination: Milestone plan / Hour axis tabs with pinned tab bar | R29 FIXED: plan view = sticky tabs (Milestone plan \| Hour axis), one pane at a time, goal tree in the Milestone plan tab; divider + Fold buttons removed. Battery 148/148. |
| I-028 | done | Issue ledger: judgeable content + evidence per row, drag-resizable columns | R29 FIXED: mirror upserts real rows into SQLite; ledger rows carry detail/evidence/reply/updated, expandable, column widths drag-persisted (cp.issue-cols). Battery 148/148. |
| I-029 | done | Kanban cards: optional upstream/downstream task links | R29 FIXED: per-card upstream/downstream links from task_deps, toggle persisted (cp.card-deps), click navigates with highlight flash, pills show signed lag + nature. Battery 148/148. |
| I-030 | done | Dependency model completion: lead (negative lag) + dependency nature | R29 FIXED: lead = negative lag rendered (FS-2d) with sign-aware cascade; task_deps.nature migration + frozen vocab validation + API passthrough + badges. Battery 148/148. |
| I-031 | done | Goal tree manual control: expand/collapse, drag-move, template library | R30 FIXED: G/M fold toggles with cp.tree-fold persistence, drag-move with validated atomic writes (three stores re-synced, gates green after every move kind incl. W cross-parent), 6-template WBS library with save/apply, and the ms-scroll layout fix (gantt reachable under an expanded tree). Battery 167/167. |
| I-032 | done | Hour axis page: make its purpose and affordances human-obvious | R31 FIXED: one purpose line + labelled NOW, tooltip (start-end/duration/cost/owner), grab/hover affordances, past-hours shading, shared status palette; flat arrangement kept. Battery 192/192. |
| I-033 | done | Work-item cards: AI dimension fields + red line 1 display rule + audit link | R31 FIXED: cards carry model/instance/cost/confidence + owner-scope gate badge with below-threshold auto-escalation (Settings adjustable), per-card audit trail (events + PDCA ids), red-line-1 display rule with scan gate. Battery 192/192. |
| I-034 | done | SOP template pack: code-review + research pipelines in the template library | - |
| I-035 | done | Ops stats: approval pass rate, human wait time, member load, completion rate | - |
| I-036 | done | Subagent dispatch discipline: checkpoints, silence pings, evidence gates | DISCIPLINE LANDED (R33): checkpoint rule in SKILL.md section 2 + brief template (per-item report, ~20 min pause, two-strike stop), handback requires pasted evidence, acceptance locked before dispatch, CHANGELOG kept current per round, same-turn issue-registration proof rule. Memory + skill package updated. |
| I-037 | done | Work board: kanban + hour axis on one linked page | R32 FIXED: Work board one page (kanban 40% + hour axis 60%, persisted split, stacked fallback), card<->bar cross-highlight, one-dataset drag, Plan full-page tree. Battery 213/213. |
| I-038 | done | Milestone plan: human CRUD + clickable task detail drawer | R32 FIXED: row-click detail drawer (fields + notes + relations + audit), CRUD via four-store atomic commits with per-class gate green, add-child with fresh ids, cascade delete behind dependents confirm, cancel zero-writes. Battery 213/213. |
| I-039 | done | Work board tabbed presentation (kanban / hour axis) instead of the side-by-side squeeze | Closed by the R36 round: two-tab Work board ([Work board] / [Hour axis], cp.wb-tab), explicit cross-view jumps, split + hover retired; battery 236/236 PASS exit 0; judged PASS in docs/TASK-LOG.md 2026-11-14. |
OPEN = 1.

## What this ledger proves

The complaint "you refuse to update the issue ledger" was itself entry I-001.
Registering it was the fix, not a description of the fix. C7 added I-008..I-012
from the second human report and I-013 from the main session's re-check; every
one carries a reply with pasted evidence, and only the main session closed
them. I-006 was CORRECTED at C9: the arrow-line overlay was ALREADY built
(`gantt.ts:139-154`, `:308`). Current state is always the count line above
(39 registered, 38 done, 1 open) - never a cached
sentence. A stale open item is itself a defect: re-check the code before
asserting "still open", and never report a partial fix as done.

## Rules

1. Session start: `node scripts/issue.js list`. Read it before planning.
2. Any new question, defect or scope change gets an `add` in the SAME turn.
3. Any answered question gets an `update` or `close` with a reason.
4. No new issue -> `no-new --reason`, still a ledger event.
5. I1 in the Stop hook blocks a turn that leaves the ledger untouched.
6. Only the main session closes an issue, after pasted verification evidence.
