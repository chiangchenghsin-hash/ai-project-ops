# Discipline invariants (C5 machine-enforced layer)

## Why this file exists

A human using this skill reported, from real sessions:

> The AI refuses to update the issue ledger every time. Discipline is poor.
> Software engineering is barely used. It cannot even be bothered to use the
> project plan template. Task relationships are poor.

The diagnosis is precise and it corrects an earlier framing. The bottleneck is
not that the human cannot manage a project. The bottleneck is that **the AI
pays the management cost on paper and then skips it**. Ten disciplines in
`SKILL.md` were prose. Prose is optional at runtime. Three concrete wiring
gaps were found:

| Gap | Evidence before C5 |
|---|---|
| AI session -> issue ledger had no path | `db.js:452` exports `updateIssue`, but `server.js` has no `/api/issues` route and no agent-side CLI existed. The `issues` table was effectively read-only through `/api/state`. |
| Nothing injected discipline at session start | `scripts/` contained no `PreToolUse` / `Stop` / `UserPromptSubmit` hook and no machine-checkable invariant. |
| Templates were never in the bootstrap order | `SKILL.md` section 8 listed `references/*` but never `templates/*`. `templates/` had 3 files and no consumer. |

**Fix principle:** move discipline from *readable* to *unbypassable*. Do not
write another paragraph of rules. Add a start-of-turn injection, an agent-side
write path, and a Stop gate that blocks on missing steps.

## The ten invariants (I1-I10)

`scripts/discipline-gate.js` recomputes I1-I8. I4/I5 are computed from
`data/module-deps.json` by the gate itself, never from an AI-written claim.
I9 has its own command (`node scripts/prd-to-action.js`); its wiring status is
stated honestly below.

| id | invariant | machine check | state on miss |
|---|---|---|---|
| I1 | Issue ledger touched this session | `docs/evidence/issue-delta.json` has one event with the current `session_id`; `no-new --reason` counts as a deliberate decision | **FAIL / block** |
| I2 | One PDCA entry appended | `### ` entry count or byte length exceeds the start-of-turn snapshot | **FAIL / block** |
| I3 | Templates instantiated | `docs/TASK-LOG.md` and `docs/PLAN.md` exist, and PLAN carries the `ai-project-ops.plan/1.0` marker | **FAIL / block** |
| I4 | Structure gate default ON (section 7) | recomputed dependency graph has zero cycles; report written to `docs/evidence/structure-gate.json` | **FAIL / block** |
| I5 | Task relationships valid | zero dangling ids; orphan list computed and reported | **FAIL / block** |
| I6 | Check carries real evidence | new ledger tail contains `PASS|FAIL|UNCERTAIN|exit_code|MATCH|sha256|n/n` | **FAIL / block** |
| I7 | Package validator green | `docs/evidence/validation-report.json` failed = 0 | UNCERTAIN, non-blocking |
| I8 | Frozen artifacts intact | `effectiveness-freeze.json` SHA-256 equals the manifest value | UNCERTAIN, non-blocking; a real MISMATCH is an E07 veto elsewhere |
| I9 | PRD-to-action adversarial gate green | `node scripts/prd-to-action.js` exits 0: banned-vague-phrase check (no "works correctly / looks good / feels right / is done / user satisfied / PM signoff"), placeholder check (no unresolved `<...>` tokens or TODO/TBD markers), and acyclic-relations check on the main line / sub-lines / relations in `docs/PRD.md`, `docs/evidence/milestones.json` and `assets/linked-gantt-board/data/milestone-plan.json` | **FAIL / block** |
| I10 | Benchmark adoption chain is complete | `node scripts/benchmark-adoption.js` exits 0: six build-first landings, registry masters, four benchmark-derived templates, wired scaffold, honest NOT IMPLEMENTED labels | **FAIL / block** |

Precedence follows `references/pdca-three-state.md`: a hard FAIL blocks the
turn; UNCERTAIN is reported and never silently promoted to PASS. I1-I6, I9 and I10
are HARD; I7/I8 remain UNCERTAIN and never block.

## I9 wiring status (implemented by the main session)

I9 IS wired into `scripts/discipline-gate.js` in the same turn it was
documented. The Stop hook spawns `node scripts/prd-to-action.js`: exit 0 ->
PASS, any other exit -> hard FAIL (blocks the turn), absent PRD artifacts ->
UNCERTAIN (non-blocking three-state, never a false block). Real output:
`PASS I9 :: prd-to-action.js exit 0 (10/10 gates)`,
`DISCIPLINE GATE PASS (7 hard / 2 soft)`, `GATE_EXIT=0`.
`scripts/selftest-discipline.js` now reports 14/14 and includes a case proving
I9 is UNCERTAIN when the PRD artifacts are intentionally absent.

## Three-state behaviour and fail-open

- `exit 0` = pass or degraded. `exit 2` = hard invariant missing; Claude Code /
  WorkBuddy `Stop` hooks feed the stderr text back to the model and block the
  turn.
- `DISCIPLINE_GATE_DRYRUN=1` reports without blocking.
- `DISABLE_DISCIPLINE_GATE=1` disables the gate for one installation.
- Internal exceptions are **fail-open** (exit 0 + `GATE-DEGRADED`), matching
  the local CDP gate convention: a broken gate must never lock a human out.
- A missing `session.json` degrades to WARN, never a false block. This avoids
  punishing a turn that started before the hooks were installed.

## Negative control (discrimination is mandatory)

`scripts/selftest-discipline.js` builds two throwaway sandboxes:

1. **Skipped turn** — no issue update, no PDCA entry, no templates. Gate MUST
   return exit 2 with I1/I2/I3 failing and a concrete fix hint on stderr.
2. **Compliant turn** — same start, then `issue.js no-new`, `scaffold.js`, one
   PDCA entry with pasted evidence. Gate MUST return exit 0 with all six
   hook-wired hard invariants (I1-I6, I9 and I10) green where artifacts exist.
   Stop hook wires `scripts/prd-to-action.js` (see "I9 wiring status" above).

A gate that never fires is decoration. Run this after changing any invariant.

## Commands

```
node scripts/session-start.js              # UserPromptSubmit hook (exit 0 always)
node scripts/issue.js list                # read open questions
node scripts/issue.js add --id I-009 --title "..." --source human
node scripts/issue.js update --id I-009 --reply "..." --status done
node scripts/issue.js no-new --reason "..."   # deliberate "nothing to add"
node scripts/scaffold.js                  # idempotent template instantiation
node scripts/discipline-gate.js          # Stop hook (0 pass / 2 block), recomputes I1-I8
node scripts/prd-to-action.js            # I9: adversarial milestone gate (0 pass / 2 block)
node scripts/benchmark-adoption.js      # I10: R17 competitive research adoption (0 pass / 2 block)
node scripts/selftest-discipline.js      # negative + positive control (I1-I6)
```

## Installation

See `hooks/INSTALL.md`. **Write the fragment at PROJECT level, never into the
user-global settings.json** — a global Stop hook would fire on unrelated
projects.
