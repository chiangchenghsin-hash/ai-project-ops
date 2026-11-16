ai-project-ops.plan/1.0 — filled plan. Instantiated from templates/PLAN.template.md via `node scripts/scaffold.js`, then completed in-place in the same turn (placeholders replaced; HTML marker comment dropped so this file carries zero angle-bracket tokens).

# Project plan

## 1. Purpose and non-goals
- Purpose: Operate ai-project-ops as a machine-enforced AI-ops discipline package (Stop-gate invariants, PDCA ledger, linked gantt, PRD-to-action) and close the MAT-01 industrialization gaps through Phase 1 quick wins then Phase 2 CI / unit coverage / trust-boundary hardening.
- Explicit non-goals: No new product features beyond the locked gap board; no multi-tenant auth or cloud sync; no CJK in package files; no npm dependencies (stdlib + Python stdlib only); release re-cuts and git tags stay main-session owned; docs/TASK-LOG.md is append-only and not rewritten by subagent packages.

## 2. Acceptance criteria (locked before work)
| id | criterion | machine check | failure cell |
|---|---|---|---|
| A1 | Discipline selftest green at the single pinned count | `node scripts/selftest-discipline.js` prints `N/N passed  RESULT: PASS` and exits 0; every live count mention matches N | exit 1 or any `FAIL` line; prose still pins an older N |
| A2 | I3 fails on an unfilled plan (placeholder hole closed) | With placeholder tokens in docs/PLAN.md, `node scripts/discipline-gate.js` prints `FAIL  I3` with `placeholders=` greater than 0 and exits 2 | I3 PASS while PLAN still holds template tokens |
| A3 | Filled plan has real content, zero angle-bracket tokens | Count of less-than characters in docs/PLAN.md is 0 (command: grep -c with a single less-than pattern); Purpose / acceptance / task rows cite real verify commands and Phase 2 work | any template placeholder token remains |
| A4 | English-only package surface | `python scripts/localize_check.py` prints `CJK_COUNT=0` | CJK_COUNT greater than 0 |
| A5 | Package validator green | `python scripts/validate_skill.py` exits 0 with failed = 0 | failed greater than 0 or non-zero exit |
| A6 | Gate stays fail-open on internal errors | Internal exception path still prints `GATE-DEGRADED` and exits 0; hard FAIL still exits 2 with fix hint on stderr | crash without GATE-DEGRADED, or hard FAIL exiting 0 outside DRYRUN |

## 3. Work breakdown (linked, not flat)
| task id | owner | owner_type | depends_on | acceptance | evidence path |
|---|---|---|---|---|---|
| T1 | main session | main | -> | I3 gate rule lands; selftest proves unfilled plan blocked and compliant turn green at the new count; live count mentions re-pinned; localize CJK_COUNT=0 | docs/evidence/gate-report.json (I3 placeholders line) + pasted selftest count in the PDCA entry |
| T2 | main session | main | T1 | CI workflow runs selftest-discipline, localize_check, validate_skill, and node --check on every push; red on any failure | .github/workflows CI log linked from the PDCA Check section |
| T3 | subagent | subagent | T2 | Unit-test layer over pure modules (graphCheck, placeholder detector, issue ledger reducers) with a stated coverage floor; `node --test` or equivalent exits 0 | test run output pasted in the package handback |
| T4 | subagent | subagent | T2 | Trust-boundary hardening: panel binds 127.0.0.1, Origin/CSRF check, 1MB body cap, status/owner vocab validation; unified battery stays green | verify.js PASS lines + server.js binding/cap diff cited in the handback |

Rules:
- Every task names an owner and an acceptance criterion. No row with `-` in both.
- `depends_on` is mandatory. `->` means a declared root; roots must be justified (T1 is this package's conformance fix and blocks the Phase 2 gates that re-run it).
- Run `node scripts/discipline-gate.js` before claiming any task is done.

## 4. Structure gate (section 7, default ON)
- Symbol-level graph: assets/linked-gantt-board/data/module-deps.json
- Structural acceptance rules: zero directed cycles (I4); zero dangling dependency ids with orphan list reported (I5); discipline scripts stay stdlib-only (no npm).
- Rebuild at: every Phase 2 milestone landing (T2-T4) and any edit to module-deps.json; the gate recomputes the graph itself and writes docs/evidence/structure-gate.json.

## 5. PDCA and issue ledger
- Ledger: `docs/TASK-LOG.md` (main session owns the scoreboard).
- Issues: `node scripts/issue.js list` at session start; update or `no-new` before stop.
- Every Check section pastes real command output. "Should work" is FAIL (E01).
- Cadence the Stop gate enforces: one new `### ` entry or +80 bytes of ledger tail per turn (I2), with the escape hatches named in SKILL.md section 1.

## 6. Delegation
- 2+ packages in flight -> one self-contained brief per package, mutually
  exclusive file ownership, acceptance = pasted evidence, report length cap.
- A handback report is a claim, not proof. Re-run its key command.

## 7. PRD-to-action backbone (I9)

A plan without milestones, sub-lines and relations is an empty plan. Name all
three here and cite the gate output before any task is claimed done.

- Main line (ordered milestones): M1 - M2 - M3 - M4 - M5 - M6 - M7 (docs/evidence/milestones.json main_line; all seven status=done at last sync).
- Sub-lines (work units per milestone): M1: W1-W3; M2: W4-W6; M3: W7-W9; M4: W10-W12; M5: W13-W15; M6: W16-W18; M7: none (traceability view closed under M7 with zero new units).
- Relations (dependency edges): 16 acyclic FS/SS/FF/SF edges in assets/linked-gantt-board/data/milestone-plan.json relations (W1 to W3, W1 to W4, ... W15 to W18); discipline-gate I4/I5 recompute cycles=0 dangling=0.
- Single source: `docs/PRD.md`, `docs/evidence/milestones.json`,
  `assets/linked-gantt-board/data/milestone-plan.json`.
- Gate: run `node scripts/prd-to-action.js` and paste its exit-0 output here
  (last run: exit 0, 10/10 gates). Each Completion must be falsifiable; each
  Verify must be a concrete command. No vague phrases, no unresolved
  placeholders. A plan edit re-runs this gate (I9, HARD/blocking; see
  docs/DISCIPLINE-INVARIANTS.md).
