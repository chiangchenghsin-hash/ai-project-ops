---
doc_id: EFFECTIVENESS-REPORT-TEMPLATE
version: 2.0
release: C2
status: BLANK SKELETON / DESIGN_ONLY_NOT_EXECUTED
owner: P4
freeze_id: ai-project-ops/C2/effectiveness-freeze/2026-11-05-P4-v2-001
cjk_policy: zero CJK characters in this file
---

# Effectiveness Report (SKELETON - fill in a future NEW-freeze-id round)

This is a blank, copy-ready skeleton. It contains NO measured data and NO
verdict. Every `<FILL: ...>` marker is a placeholder to be replaced by a future
execution round; that round MUST use a NEW freeze id (see Section 9 of the
experiment design). Fill-in values must be pasted real output, never estimates.
Do not fill this skeleton inside the current freeze id.

Freeze id of the design this report belongs to:
`<FILL: design freeze_id>` = `ai-project-ops/C2/effectiveness-freeze/2026-11-05-P4-v2-001`.
Execution freeze id (must differ): `<FILL: NEW execution freeze_id>`.
Execution date: `<FILL: YYYY-MM-DD>`. Operator: `<FILL: name>`.

Status of THIS document: DESIGN_ONLY_NOT_EXECUTED. No A/B run has occurred.

---

## 1. Raw-data tables

Record one row per paired card (8 pairs, 2 per cell). Unblind only AFTER all
scoring is frozen. Admissible evidence types are T1 / T2 / T3 only (see
design Section 4); a row whose only evidence is T4 prose resolves to FAIL (E01).

| pair_id | cell_id | blind_label | type | evidence | control_outcome | treatment_outcome | paired_difference (T-C) | admissible_type | evidence_ref |
|---|---|---|---|---|---|---|---|---|---|
| P01 | C1 | `<FILL>` | specification | required | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL T1/T2/T3>` | `<FILL>` |
| P02 | C1 | `<FILL>` | specification | required | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL T1/T2/T3>` | `<FILL>` |
| P03 | C2 | `<FILL>` | specification | not_required | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL T1/T2/T3>` | `<FILL>` |
| P04 | C2 | `<FILL>` | specification | not_required | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL T1/T2/T3>` | `<FILL>` |
| P05 | C3 | `<FILL>` | execution | required | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL T1/T2/T3>` | `<FILL>` |
| P06 | C3 | `<FILL>` | execution | required | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL T1/T2/T3>` | `<FILL>` |
| P07 | C4 | `<FILL>` | execution | not_required | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL T1/T2/T3>` | `<FILL>` |
| P08 | C4 | `<FILL>` | execution | not_required | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL T1/T2/T3>` | `<FILL>` |

Raw evidence attachments (pasted command output, hashes, screenshots):
`<FILL: list of evidence file paths and pasted lines>`.

Primary exact test:
- permutation_n = 256 (2^8). p_min = 0.00390625. alpha = 0.05 (frozen).
- observed statistic: `<FILL: sum of positive paired differences>`.
- exact p (corrected): `<FILL: exact p over 256 assignments>`.
- `p <= 0.05`? `<FILL: yes/no>`.
- theta (null) = 0; seed = 20261105.

## 2. 2x2 cells

All four cells must be present with n=2. C4 (execution x not_required) is the
cell missing in the pre-C2 v1 design; it must be populated here.

| Cell | type | evidence | n pairs | mean paired diff | discrimination stat | per-cell p | failure_cell? |
|---|---|---|---|---|---|---|---|
| C1 | specification | required | 2 | `<FILL>` | `<FILL>` | `<FILL>` | no |
| C2 | specification | not_required | 2 | `<FILL>` | `<FILL>` | `<FILL>` | YES |
| C3 | execution | required | 2 | `<FILL>` | `<FILL>` | `<FILL>` | no |
| C4 | execution | not_required | 2 | `<FILL>` | `<FILL>` | `<FILL>` | YES |

Cell-completeness gate: `<FILL: python assert 4 cells and n=2 each -> PASS>`.

## 3. Three-cell verdict

Apply precedence veto > UNCERTAIN > FAIL > PASS (design Section 6).

| Rule rank | Check | Fired? | Note |
|---|---|---|---|
| 1 veto (E07/E08) | frozen hashes match, blind keys sealed | `<FILL yes/no>` | `<FILL>` |
| 2 UNCERTAIN | evidence incomplete OR gain with corrected p > 0.05 OR failure cell no discrimination (E10/E12/E02) | `<FILL yes/no>` | `<FILL>` |
| 3 FAIL | a performed check negative / Check evidence absent (E01...) | `<FILL yes/no>` | `<FILL>` |
| 4 PASS | A/B present, corrected p <= 0.05, 4 cells n=2, 4 layers green, no veto | `<FILL yes/no>` | `<FILL>` |

FINAL THREE-CELL VERDICT: `<FILL: PASS | FAIL | UNCERTAIN>`.
If rank 1 fired: write `FAIL (round VOID)` and record a NEW freeze id.
A gain with corrected p > 0.05 MUST be UNCERTAIN, never PASS.
Pasted evidence supporting the verdict: `<FILL: command output lines>`.

## 4. Discrimination report

For each cell, state whether control and treatment are discriminable. Failure
cells (C2, C4) are the discrimination anchors: a failure cell with effect = 0
or per-cell p >= 0.05 fires E10 and forces UNCERTAIN.

| Cell | effect (T-C) | per-cell p | discriminable? | E10 fired? |
|---|---|---|---|---|
| C1 | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL>` |
| C2 (failure) | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL>` |
| C3 | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL>` |
| C4 (failure) | `<FILL>` | `<FILL>` | `<FILL>` | `<FILL>` |

Overall discrimination conclusion: `<FILL>`.
Veto scan (E07 hash compare, E08 blind-key exposure): `<FILL: pasted result>`.

## 5. Leave-one-out stability (EXPLORATORY only)

Recompute the exact p-value 8 times, dropping one pair each time. These are
EXPLORATORY; they never change the confirmatory verdict and are NOT in the BH
family. The BH family contains exactly ONE primary test (over all 8 pairs).

| Dropped pair | remaining n | exact p | p <= 0.05? |
|---|---|---|---|
| P01 | 7 | `<FILL>` | `<FILL>` |
| P02 | 7 | `<FILL>` | `<FILL>` |
| P03 | 7 | `<FILL>` | `<FILL>` |
| P04 | 7 | `<FILL>` | `<FILL>` |
| P05 | 7 | `<FILL>` | `<FILL>` |
| P06 | 7 | `<FILL>` | `<FILL>` |
| P07 | 7 | `<FILL>` | `<FILL>` |
| P08 | 7 | `<FILL>` | `<FILL>` |

Stability note: `<FILL: how many of 8 LOO runs stay <= 0.05>`.
This section may NOT be used to promote an UNCERTAIN primary result to PASS.

## 6. Threat reconciliation V1-V9

Reconcile each threat defined in design Section 10. State the mitigation, the
observed residual, and whether it changed the verdict.

| ID | Threat | Mitigation | Observed residual | Verdict effect |
|---|---|---|---|---|
| V1 | Underpowered (p_min > alpha) | 8 pairs, 2^8=256, p_min=0.00390625 <= 0.05 | `<FILL>` | `<FILL>` |
| V2 | Missing 2x2 cell | 4 cells, n=2, C4 restored | `<FILL>` | `<FILL>` |
| V3 | Unblinding | neutral labels, sealed blind key, E08 veto | `<FILL>` | `<FILL>` |
| V4 | Post-hoc rule change / self-hash gap | manifest stores freeze SHA-256, new-freeze-id rule | `<FILL>` | `<FILL>` |
| V5 | Precedence ambiguity | veto > UNCERTAIN > FAIL > PASS | `<FILL>` | `<FILL>` |
| V6 | Inadmissible 4th evidence type | exactly 3 types (T1/T2/T3), E01 | `<FILL>` | `<FILL>` |
| V7 | Consumer-load unverified (Chrome) | E12 -> UNCERTAIN, listed as gap | `<FILL>` | `<FILL>` |
| V8 | Silent edit of frozen artifact | sha256 compare, E07 void | `<FILL>` | `<FILL>` |
| V9 | Multiplicity / p-hacking | ONE primary test (BH family=1), LOO/per-cell exploratory | `<FILL>` | `<FILL>` |

Unresolved / unverified items (honest list, e.g. Chrome E2E): `<FILL>`.

## 7. Exploratory vs confirmatory separation

CONFIRMATORY (the ONLY analysis that drives the three-cell verdict):
- the single primary exact randomization test over all 8 paired cards;
- alpha = 0.05, BH family = 1 test, BH over one test does NOT change the
  threshold;
- the precedence rule veto > UNCERTAIN > FAIL > PASS.

EXPLORATORY (reported, NEVER used for the verdict, NOT in the BH family):
- per-cell effects and per-cell p-values (Section 4);
- leave-one-out stability (Section 5);
- any subgroup, sensitivity or secondary estimand.

No exploratory result may upgrade an UNCERTAIN to PASS or downgrade a FAIL.
Any post-hoc change to the confirmatory rule VOIDS the round and requires a
NEW freeze id and NEW hashes (design Section 9).

## 8. Veto / void statement

If a veto (E07/E08) fired, record: `<FILL: veto code>`, three-cell label
`FAIL (round VOID)`, the voided freeze id, and the NEW freeze id for the
replacement round. A voided round is preserved as evidence, NOT scored, NOT
deleted, NOT edited, and is NOT silently re-run under the same freeze id.
Hash-compare evidence: `<FILL: sha256sum lines>`.

## 9. Sign-off

Verdict: `<FILL: PASS | FAIL | UNCERTAIN>`. Check evidence pasted: `<FILL yes/no>`.
Re-check (main session): `<FILL: command -> result -> PASS|FAIL>`.
DESIGN_ONLY_NOT_EXECUTED until all `<FILL: ...>` markers are replaced by real
output in a NEW-freeze-id round.
