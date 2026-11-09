<!-- TEMPLATE - ai-project-ops PRD scaffold. NOT a plan. -->
# <<PROJECT_NAME>> - PRD (TEMPLATE)

> TEMPLATE. This is the ONLY file in the package where template-variable
> placeholders are allowed. Placeholders here use the ASCII double-angle form
> <<TOKEN>>, this package's ASCII rendering of the installed prd-to-action
> skill's guillemet-style variable markers (guillemets are non-ASCII, so the
> English/ASCII package does not ship them). Instantiate by copying this file
> to docs/PRD.md and replacing EVERY token in the same turn. docs/PRD.md,
> docs/evidence/milestones.json and the milestone-plan.json MUST contain zero
> placeholders; scripts/prd-to-action.js gate B enforces that. Completion
> fields must be falsifiable and must never use the eight vague acceptance
> phrases from the skill's quality-gate checklist.

## 1. Purpose and problem
<<PURPOSE_AND_PROBLEM>>

## 2. Tech Stack
- Language / runtime: <<LANGUAGE_RUNTIME>>
- Test: <<TEST_CMD>>
- Lint: <<LINT_CMD>>
- Type: <<TYPECHECK_CMD>>
- Security: <<SECURITY_CMD>>

## 3. Constraints
- <<CONSTRAINT_1>>
- <<CONSTRAINT_2>>
- <<CONSTRAINT_3>>

## 4. Baseline (measured <<MEASURED_DATE>>)
- demo work units: <<COUNT_WORK_UNITS>>
- status columns: <<COUNT_COLUMNS>>
- issues: <<COUNT_ISSUES>>
- rounds: <<COUNT_ROUNDS>>
- selftest assertions: <<COUNT_ASSERTIONS>>
- zip entries at <<VERSION>>: <<COUNT_ZIP_ENTRIES>>

## 5. Data contract
- <<DATA_CONTRACT_NOTE>>

## 6. Milestones

The dependency chain below is the MAIN LINE. Duplicate the block for each
milestone. Every Completion line must name files, counts or a real command
with an exit code; every Verify line must be a command that exists in the
package.

### <<M1>>: <<M1_NAME>>
- Depends on: none
- Type: code | manual | research | design
- Has external deps: yes | no
- Files: <<M1_FILES>>
- Completion: <<M1_FALSIFIABLE_COMPLETION>>
- Verify: <<M1_REAL_COMMAND>>
- Status: pending | in_progress | done | skipped

### <<M2>>: <<M2_NAME>>
- Depends on: <<M1>>
- Type: code | manual | research | design
- Has external deps: yes | no
- Files: <<M2_FILES>>
- Completion: <<M2_FALSIFIABLE_COMPLETION>>
- Verify: <<M2_REAL_COMMAND>>
- Status: pending | in_progress | done | skipped

### <<M3>>: <<M3_NAME>>
- Depends on: <<M2>>
- Type: code | manual | research | design
- Has external deps: yes | no
- Files: <<M3_FILES>>
- Completion: <<M3_FALSIFIABLE_COMPLETION>>
- Verify: <<M3_REAL_COMMAND>>
- Status: pending | in_progress | done | skipped

### <<M4>>: <<M4_NAME>>
- Depends on: <<M3>>
- Type: code | manual | research | design
- Has external deps: yes | no
- Files: <<M4_FILES>>
- Completion: <<M4_FALSIFIABLE_COMPLETION>>
- Verify: <<M4_REAL_COMMAND>>
- Status: pending | in_progress | done | skipped

### <<M5>>: <<M5_NAME>>
- Depends on: <<M4>>
- Type: code | manual | research | design
- Has external deps: yes | no
- Files: <<M5_FILES>>
- Completion: <<M5_FALSIFIABLE_COMPLETION>>
- Verify: <<M5_REAL_COMMAND>>
- Status: pending | in_progress | done | skipped

### <<M6>>: <<M6_NAME>>
- Depends on: <<M5>>
- Type: code | manual | research | design
- Has external deps: yes | no
- Files: <<M6_FILES>>
- Completion: <<M6_FALSIFIABLE_COMPLETION>>
- Verify: <<M6_REAL_COMMAND>>
- Status: pending | in_progress | done | skipped

## 7. Verification gates
<<VERIFICATION_GATE_NOTE>>

## 8. Non-goals
<<NON_GOALS>>
