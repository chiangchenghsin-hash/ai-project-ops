# PRD-to-action: installed skill to this package (mapping)

## Method source (READ, not copied)

The method comes from the real installed skill on this machine:

    <USER_SKILLS>/prd-to-action/
      SKILL.md
      references/verification-patterns.md
      references/quality-gate-checklist.md
      references/prd-parsing-patterns.md
      references/session-recovery.md
      references/nx-sdd-example.md

That skill is READ as a method. No file from it is copied, vendored, installed
or committed into this package. This reference records how its phases map onto
the ai-project-ops command-panel package so a future session can re-apply the
method without re-reading prose. The package keeps its own English/ASCII files;
the skill stays where it is.

Version note (R26): the installed skill gained three wording-level controls
(activation precondition, Phase 3 evidence rule, quantified BREAK miss_rate
gate). The infrastructure half of that hardening lives in THIS package
(plan-sync, discipline-gate I9/I10, negative controls) and was not
back-flowed into the skill.

## Phase-to-package mapping table

| Installed skill phase / artifact | Skill source | This package | Enforced by |
|---|---|---|---|
| Phase 0 INGEST: find and read the PRD, measure the baseline, write .memory/project.md | SKILL.md Step 1 / Step 3 / Step 6 | docs/PRD.md (Tech Stack, Constraints, Baseline, six milestones) and docs/evidence/milestones.json (machine mirror) | gate loads L1-L3 and C |
| Milestone template: `### M{N}` plus Depends on / Type / Has external deps / Files / Completion (falsifiable) / Verify (real command) / Status | SKILL.md Step 6 | assets/linked-gantt-board/data/milestone-plan.json (milestones, work_units, relations, main_line, sub_lines) and templates/PRD.template.md | gates C, E, X |
| TodoWrite state machine: ROUTE, dependency check, status query, "skip"/"resume" | SKILL.md Phase 1 | scripts/issue.js ledger, scripts/session-start.js (UserPromptSubmit), scripts/discipline-gate.js (Stop hook, invariants I1 issue-ledger-touched and I2 one-PDCA-entry), scripts/selftest-discipline.js (12/12 control) | gate D resolves these as real Verify commands |
| Verification Gate: run after EVERY module (test, lint, typecheck, forbidden-pattern grep) | SKILL.md Phase 2 STEP 5, references/verification-patterns.md | scripts/verify.js (headless Chrome over CDP, end-to-end), scripts/prd-to-action.js (PRD gates), scripts/selftest-discipline.js (negative + positive control) | gates D, E, F, X and the pasted PASS lines |
| Adversarial falsifiability grep: the eight vague acceptance phrases MUST be absent (grep exit 1) | references/quality-gate-checklist.md | scripts/prd-to-action.js gate A, plus the --negative discrimination control | gate A |
| Template-variable grep: unresolved placeholder markers MUST be absent from plan artifacts | SKILL.md Step 5, references/quality-gate-checklist.md | scripts/prd-to-action.js gate B. templates/PRD.template.md is the ONLY file where placeholder tokens are allowed (ASCII double-angle form, this package's rendering of the skill's guillemet markers). docs/PRD.md and the two JSON plan artifacts must contain zero. | gate B |
| Negative control: a gate that never fires is decoration | references/quality-gate-checklist.md "Review Loop", scripts/selftest-discipline.js | scripts/prd-to-action.js --negative injects a banned phrase into a temp PRD copy and asserts gate A detects it (exit 2) | gate A proven |

## Why the mapping is not a copy

- The skill drives Claude Code tool calls (TodoWrite, Agent, Bash). This
  package drives deterministic Node scripts. The phases survive; the runtime
  changes.
- The skill writes .memory/project.md and CLAUDE.md into a project. This
  package writes docs/PRD.md, two JSON data files and one gate script, and
  keeps its own PDCA ledger in docs/TASK-LOG.md (owned by the main session).
- The skill's BREAK/TDD loop maps here onto scripts/verify.js and the
  selftest PASS lines, not onto a per-file RED/GREEN cycle.

## Re-run the gate (exact commands)

    node scripts/prd-to-action.js              # normal: exit 0 at 10/10, exit 2 on any FAIL
    node scripts/prd-to-action.js --negative   # discrimination control: exit 2 = detection works
    node --check scripts/prd-to-action.js      # syntax

Normal mode prints one `PASS  <label> :: <evidence>` line per check and the
summary `PRD-TO-ACTION GATE: n/n passed`. The --negative mode prints a
NEGATIVE CONTROL PASS line and exits 2 by design (2 is the expected DETECT
signal, not a failure). Both outputs are pasted as real evidence in
docs/handoffs/G1.md.
