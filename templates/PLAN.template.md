<!-- ai-project-ops.plan/1.0 — Plan template. Instantiate with `node scripts/scaffold.js`. NEVER hand-write a plan. -->
# Project plan

> This file is scaffolding, not a plan. Replace each placeholder in the SAME
> turn you create this file. Scaffold creates the shape; the AI fills it.

## 1. Purpose and non-goals
- Purpose: <one sentence>
- Explicit non-goals: <list; say why each is out of scope>

## 2. Acceptance criteria (locked before work)
| id | criterion | machine check | failure cell |
|---|---|---|---|
| A1 | <criterion> | <command that proves it> | <what a FAIL looks like> |

## 3. Work breakdown (linked, not flat)
| task id | owner | owner_type | depends_on | acceptance | evidence path |
|---|---|---|---|---|---|
| T1 | <name> | human / main / subagent / team | <ids or -> | <criterion> | <docs/evidence/...> |

Rules:
- Every task names an owner and an acceptance criterion. No row with `-` in both.
- `depends_on` is mandatory. `->` means a declared root; roots must be justified.
- Run `node scripts/discipline-gate.js` before claiming any task is done.

## 4. Structure gate (section 7, default ON)
- Symbol-level graph: <path>
- 2-3 structural acceptance rules: <layer bans / contract coverage / test wiring>
- Rebuild at: <milestone>

## 5. PDCA and issue ledger
- Ledger: `docs/TASK-LOG.md` (main session owns the scoreboard).
- Issues: `node scripts/issue.js list` at session start; update or `no-new` before stop.
- Every Check section pastes real command output. "Should work" is FAIL (E01).

## 6. Delegation
- 2+ packages in flight -> one self-contained brief per package, mutually
  exclusive file ownership, acceptance = pasted evidence, report length cap.
- A handback report is a claim, not proof. Re-run its key command.

## 7. PRD-to-action backbone (I9)

A plan without milestones, sub-lines and relations is an empty plan. Name all
three here and cite the gate output before any task is claimed done.

- Main line (ordered milestones): <M1 -> M2 -> ... from docs/PRD.md>
- Sub-lines (work units per milestone): <M1: ...; M2: ...>
- Relations (dependency edges): <M2 depends on M1; ...; must be acyclic>
- Single source: `docs/PRD.md`, `docs/evidence/milestones.json`,
  `assets/linked-gantt-board/data/milestone-plan.json`.
- Gate: run `node scripts/prd-to-action.js` and paste its exit-0 output here.
  Each Completion must be falsifiable; each Verify must be a concrete command.
  No vague phrases, no unresolved placeholders. A plan edit re-runs this gate
  (I9, HARD/blocking; see docs/DISCIPLINE-INVARIANTS.md).
