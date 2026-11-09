# Discipline deficit ledger (skill's own defects)

> Machine source: `docs/evidence/issues.json`. This human-readable snapshot is
> GENERATED from that file by the main session; edit issues with
> `node scripts/issue.js ...`, never by hand.
> This is a committable artifact ABOUT the skill itself, not the project's
> in-flight SQLite issue ledger (section 9 keeps those apart).

Source: two human reports from real usage (2026-11-08) plus defects found by the main session. 15 registered, 15 closed, 0 open.

| id | status | defect | reply / disposition |
|---|---|---|---|
| I-001 | closed | AI never updates the issue ledger at session end | C5: scripts/issue.js gives an offline agent-side write path; I1 Stop invariant blocks a skipped turn. |
| I-002 | closed | Disciplines are prose and can be skipped | C5: six invariants recomputed by scripts/discipline-gate.js; negative control 12/12. |
| I-003 | closed | No start/stop hook enforces closing actions | C5: session-start.js + discipline-gate.js + hooks/settings.fragment.json + merge-hooks.py. |
| I-004 | closed | Software engineering gates marked optional | C5: section 7 now default ON; gate recomputes DAG cycles and writes structure-gate.json. |
| I-005 | closed | Project plan template never used | C5: templates/PLAN.template.md added; scaffold.js is mandatory in section 8; I3 checks the marker. |
| I-006 | closed | Task relationships are weak | CORRECTED at C9 (C9-1 line fix): the arrow-line overlay was ALREADY built. gantt.ts:139-154 drawEdges() emits <path class=gdep marker-end=url(#arrowOk/arrowBad)> with blue/red semantics; :308 click-to-delete edge; :195-210 drag preview; graph.ts:210 bumpCascade. The C7 note claiming it was unbuilt was a stale judgement. Closed with code evidence, not rebuilt. |
| I-007 | closed | verify.js collides with a foreign service on port 4174 | Not a code defect. verify.js honours PANEL_PORT/CDP_PORT; re-ran on 4184/9234 -> 71/71 PASS exit 0. Foreign service untouched (4174 -> 200). Documented in the C5 PDCA Check. |
| I-008 | closed | Work-division kanban has no standalone page | G2 added #view-board with data-view=board; nav has 5 entries; 81/81 CDP assertions include view switching. Screenshot plan page no longer holds the kanban. |
| I-009 | closed | Milestone gantt has no main line, sub-lines or relations | G1 wrote docs/PRD.md + milestones.json + milestone-plan.json (6 milestones / 18 work units / 16 acyclic relations). G2 rendered MAIN LINE / SUB-LINES / RELATIONS / CRITICAL PATH. prd-to-action.js 10/10 PASS, --negative detects tampering. |
| I-010 | closed | Sidebar appears absent because charter fields are unset | Charter now seeded from the plan file through /api/state (effectiveMeta); screenshot shows real Purpose / Technical resources / Evaluation and a sidebar purpose line. No Not set placeholders. |
| I-011 | closed | Visual style is an older Apple look | macOS 27 Golden Gate readability-fixed Liquid Glass: glass layers, real 80% transparency slider persisting --glass-alpha, colored sidebar nav icons, tighter radii, dark body still rgb(28,28,30). Verified by CDP assertions. |
| I-012 | closed | PRD-to-action skill was never used | Installed prd-to-action harness read as a method; Phase 0 INGEST -> PRD.md, Milestone template -> milestone-plan.json, adversarial grep -> prd-to-action.js, wired as Stop-hook invariant I9. |
| I-013 | closed | Subagents leaked a personal path and documented I9 without wiring it | Two paths redacted to <USER_SKILLS>/; validator leaks=0 exit 0. I9 wired into discipline-gate.js and proven by 14/14 negative control. |
| I-014 | closed | R17 competitive research never reached templates or a gate | C8: docs/BENCHMARK-ADOPTION.md maps B1-B6 to code with file:line; 4 templates carry Benchmark headers; registry.json + scaffold v2 wire Monday master/instance/Publish; benchmark-adoption.js 8/8 PASS with --negative detection, wired as Stop-hook I10. |
| I-015 | closed | Cold reader R4 found six defects in the first adoption chain | All six independently confirmed and fixed: scaffold v2.1.0 (real drift/bump/--all), benchmark-adoption v1.1.0 (13/13 + dual negative + signed manifest), B5 downgraded, owner-scope status line. R4 report retained, not deleted. |
OPEN = 0.

## What this ledger proves

The complaint "you refuse to update the issue ledger" was itself entry I-001.
Registering it was the fix, not a description of the fix. C7 added I-008..I-012
from the second human report and I-013 from the main session's re-check; every
one carries a reply with pasted evidence, and only the main session closed
them. I-006 was CORRECTED at C9: the arrow-line overlay was ALREADY built
(`gantt.ts:139-154`, `:308`). All 15 registered issues are now closed,
OPEN = 0. A stale open item is itself a defect: re-check the code before
asserting "still open", and never report a partial fix as done.

## Rules

1. Session start: `node scripts/issue.js list`. Read it before planning.
2. Any new question, defect or scope change gets an `add` in the SAME turn.
3. Any answered question gets an `update` or `close` with a reason.
4. No new issue -> `no-new --reason`, still a ledger event.
5. I1 in the Stop hook blocks a turn that leaves the ledger untouched.
6. Only the main session closes an issue, after pasted verification evidence.
