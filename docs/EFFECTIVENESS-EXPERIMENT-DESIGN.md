---
doc_id: EFFECTIVENESS-EXPERIMENT-DESIGN
version: 2.0
release: C2
status: English v2 re-freeze / DESIGN_ONLY_NOT_EXECUTED
owner: P4
supersedes: pre-C2 Chinese v1 (VOID, archived outside the package)
freeze_id: ai-project-ops/C2/effectiveness-freeze/2026-11-05-P4-v2-001
cjk_policy: zero CJK characters in this file
---

# Effectiveness Experiment Design (English v2, C2 re-freeze)

This is the English v2 design of the no-skill A/B effectiveness experiment for
`ai-project-ops`. It replaces the pre-C2 Chinese v1, VOIDED by correction C2
(see `docs/TASK-LOG.md`). The v1 had blocking defects: PASS was mathematically
unreachable, the 2x2 grid was incomplete, the freeze file had no hash of itself,
self-check counts disagreed, the synthetic cases conflicted with the three-cell
decision rule, and the void/retest rules created a post-hoc tuning loophole.
Every defect is fixed here and mirrored in
`docs/evidence/effectiveness-freeze.json` and
`docs/evidence/freeze-manifest.json`.

Verdict vocabulary is the three-cell PDCA set PASS / FAIL / UNCERTAIN, defined
in `references/pdca-three-state.md`. Error codes E01-E12 are defined in
`references/error-codes.md` (owned by P1). The four evidence layers are in
`references/evidence-matrix.md`. Paths are written as inline code
(package-root-relative).

Status: DESIGN_ONLY_NOT_EXECUTED. No A/B run, no scoring and no verdict belong
to this round. Execution requires a future round with a NEW freeze id.

## 1. Frozen parameters

| Parameter | Frozen value | Meaning |
|---|---|---|
| schema | `ai-project-ops.effectiveness-freeze/2.0` | freeze-file schema id |
| freeze_id | `ai-project-ops/C2/effectiveness-freeze/2026-11-05-P4-v2-001` | identity of this round |
| status | `DESIGN_ONLY_NOT_EXECUTED` | no run has been executed |
| paired_cards | 8 | 8 independent randomization units (pairs) |
| permutation_n | 256 | 2^8 = 256 sign assignments |
| p_min | 0.00390625 | 1 / 256, the smallest attainable exact p |
| alpha | 0.05 | frozen significance threshold |
| theta | 0 | sharp null of no pair-level effect |
| seed | 20261105 | randomization seed for the exact test |
| n_per_cell | 2 | paired cards per 2x2 cell |
| bh_family_tests | 1 | ONE primary test (see Section 5) |

Power fix (v1 defect F4): with 4 paired cards the permutation set is 2^4 = 16,
so the minimum exact p is 1/16 = 0.0625 > alpha 0.05 and PASS was
mathematically unreachable. With 8 paired cards the set is 2^8 = 256 and
p_min = 1/256 = 0.00390625 <= 0.05, so PASS is reachable. Machine gate:

```
python -c "
assert 2**8==256
p_min=1.0/(2**8)
assert abs(p_min-0.00390625)<1e-12
assert p_min<=0.05
print('POWER_OK permutation_n=256 p_min=0.00390625 <= alpha=0.05')
"
```

alpha = 0.05 is frozen in the freeze file. It cannot be changed within this
freeze id; changing it voids the round (Section 10).

## 2. Complete 2x2 grid, n=2 per cell

Axes: `type` = {specification, execution}; `evidence` = {required,
not_required}. The v1 grid was missing the execution + not-required cell and
had n=1 per cell. The v2 grid has all FOUR cells, each with exactly 2 paired
cards (8 pairs total).

| Cell | type | evidence | n pairs | pair ids | Role |
|---|---|---|---|---|---|
| C1 | specification | required | 2 | P01, P02 | treatment expected to help |
| C2 | specification | not_required | 2 | P03, P04 | failure cell (negative control) |
| C3 | execution | required | 2 | P05, P06 | treatment expected to help |
| C4 | execution | not_required | 2 | P07, P08 | failure cell (negative control) - THE CELL MISSING IN v1 |

C4 (execution x evidence-not-required) is explicitly present now. Every cell
has exactly 2 paired cards; no cell is empty and no cell has n=1. Machine gate:

```
python -c "
import json
f=json.load(open('docs/evidence/effectiveness-freeze.json',encoding='utf-8'))
cells={c['id']:c for c in f['grid']['cells']}
assert len(cells)==4
for cid,c in cells.items():
    assert c['n_pairs']==2,(cid,c['n_pairs'])
    assert len(c['pair_ids'])==2
print('GRID_OK cells=4 n_per_cell=2 total_pairs=8')
"
```

Each paired card is a PAIR: one identical frozen prompt is given to a control
arm (no skill) and a treatment arm (skill). The 8 pairs are the 8 randomization
units; each yields one sign for the exact randomization test, hence 2^8 = 256
assignments. Blinding: cards carry neutral `blind_label` values only (no arm
identity in the card, filename or prompt). The control/treatment assignment is
sealed in a blind key held outside the package by the main session; a card that
reveals its arm fires E08 (veto). Full frozen prompts are in
`docs/evidence/effectiveness-freeze.json` under `cards`.

## 3. Estimands

Primary estimand: for each of the 8 paired cards, the difference
(treatment - control) in whether the produced Check section contains at least
one admissible evidence item (Section 6). The sharp null is theta = 0 (no
pair-level effect). The primary statistic is the exact randomization / sign
test over 2^8 = 256 assignments; the exact p is reported, not estimated.

Secondary estimands (EXPLORATORY, never used for the confirmatory verdict):
- per-cell mean paired difference (4 cells, n=2 each);
- per-cell discrimination, including the failure cells (Section 9);
- leave-one-out stability of the exact p-value (8 recomputations).

The three-cell verdict uses ONLY the primary test. Secondary estimands are
reported in the template's exploratory section and never change the verdict
(Section 8 of the report template).

## 4. The 3 admissible evidence types (fix: "four evidence types")

The v1 draft said "four evidence types"; the decision rule admits exactly 3.
The 4th (a prose claim with no artifact, e.g. "should work", or an author
assertion) is NOT admissible and fires E01. Frozen admissible types:

| ID | Type | Machine check |
|---|---|---|
| T1 | Pasted command output (real stdout / stderr / PASS lines) | fenced output lines present in Check |
| T2 | Machine counts / exit codes / hashes | `grep -c`, exit codes, `sha256sum` comparison |
| T3 | Screenshots / CDP traces | image or CDP trace referenced |

These 3 are the frozen `admissible_evidence_types` in the freeze file. A Check
section whose only evidence is a T4 prose claim resolves to FAIL (E01).

## 5. ONE primary test; Benjamini-Hochberg over a single test

The Benjamini-Hochberg (BH) family contains exactly ONE primary test: the exact
randomization test on the primary estimand. This is declared explicitly to
prevent a multiple-comparison / p-hacking path.

BH over a SINGLE primary test does NOT change the threshold. With m = 1 test
and rank i = 1, the BH critical value is (i/m) * alpha = (1/1) * 0.05 = 0.05.
Therefore the rejection threshold remains exactly alpha = 0.05; no adjustment
is applied to the primary test. All other analyses (per-cell, leave-one-out,
subgroups) are EXPLORATORY and are outside the BH family; they carry no
confirmatory verdict and cannot turn an UNCERTAIN into a PASS.

## 6. Decision rule with precedence

Precedence (highest first): **veto > UNCERTAIN > FAIL > PASS**. This matches
`references/pdca-three-state.md` and `references/evidence-matrix.md`. The first
rule that fires wins.

| Rank | Label | Condition |
|---|---|---|
| 1 | FAIL + round VOID | Any veto fired: E07 (frozen artifact changed) or E08 (unblinding). A veto overrides ANY positive primary result (a 30/30 PASS does not survive it). |
| 2 | UNCERTAIN | Evidence incomplete / unverifiable: consumer unavailable (E12), meter schema mismatch (E02), a failure cell shows no discrimination (E10), underpowered, OR **a gain whose corrected p > 0.05**. A gain with corrected p > 0.05 is UNCERTAIN, NOT PASS. |
| 3 | FAIL | A performed check returned negative, or Check evidence is absent (E01, E03, E04, E05, E06, E09, E11). Evidence is complete, so UNCERTAIN does not apply. |
| 4 | PASS | All of: A/B comparison present, corrected exact p <= 0.05, all four 2x2 cells have n=2, all four evidence layers green, no veto, and real evidence pasted. PASS is the LAST rule, not the default. |

Explicit statement (v1 defect): a gain with corrected p > 0.05 is UNCERTAIN
(not PASS). Only rank 4 can yield PASS, and rank 4 requires an A/B comparison
AND a corrected p-value <= 0.05. This is why no self-check case may expect
PASS without both.

## 7. The canonical 4 self-check cases (defined everywhere)

Exactly 4 self-check cases exist, identically in this design, in
`docs/IMPROVEMENT-PLAN.md` (Section 11) and in
`docs/evidence/effectiveness-freeze.json` (`self_check.cases`). Each maps to an
explicit three-cell label. No case expects PASS without an A/B comparison and
a p-value; the v1 case 1 (PASS with no A/B and no p) and case 4 ("veto fires"
with no three-cell label) are fixed.

| ID | Expected label | A/B present | p-value | Scenario |
|---|---|---|---|---|
| SC1 | PASS | yes | 0.00390625 | Full valid round: 8 paired cards, A/B comparison, exact p <= 0.05, all 4 cells n=2, no veto, 4 layers green. |
| SC2 | FAIL | yes | 0.00390625 | A/B complete and significant, but a performed self-check returned a red FAIL line (E09), Check evidence present, no veto, evidence complete. |
| SC3 | UNCERTAIN | yes | 0.0625 | A/B shows a gain but corrected exact p = 0.0625 > 0.05; one failure cell shows no discrimination (E10). |
| SC4 | FAIL (round VOID) | yes | 0.00390625 | E07 SHA-256 mismatch or E08 unblinding detected while a 30/30 PASS primary exists; veto has top precedence. |

Machine gate: `len(self_check.cases) == 4` and each case has an
`expected_label` in {PASS, FAIL, UNCERTAIN} plus `ab_comparison` and
`p_value` fields.

## 8. Failure cells and veto

Failure cells are the 2x2 cells in which the no-skill control arm is
deliberately seeded with a known defect, so a measurable control-vs-treatment
difference is expected. They are DISCRIMINATION anchors, not FAIL verdicts.
A failure cell with effect = 0 or per-cell p >= 0.05 fires E10 and resolves
the round to UNCERTAIN (rank 2), never PASS. Frozen failure cells: C2 and C4
(the two evidence-not-required cells; C4 is the cell missing in v1). Each has
n=2 paired cards.

Veto conditions (defined in `references/error-codes.md`, owned by P1):
- E07 frozen artifact changed;
- E08 unblinding detected.

Veto effect: three-cell label FAIL, round VOID, precedence rank 1 (overrides
any positive primary result). Recovery is a NEW freeze id, never a same-id
re-run.

## 9. Closing the post-hoc loophole (v1 contradiction)

The v1 rules contradicted each other: "void and re-run on correction" vs
"FAIL must not be deleted / no retest". That created a legitimate post-hoc
tuning path: change a decision rule inside the freeze file, re-run, and
cherry-pick a better result. v2 closes it:

1. A CORRECTION (localization, a defect fix, a rule change, an added card, a
   changed alpha) VOIDS the current round.
2. The voided round is: preserved as evidence, NOT scored, NOT deleted, NOT
   edited. Its hashes are retained for audit (pre-C2 v1 hashes in
   `docs/TASK-LOG.md` and `docs/evidence/freeze-manifest.json`).
3. The voided round CANNOT be silently re-run under the same freeze id.
   Re-running the SAME freeze id after a correction is prohibited.
4. Any NEW round requires a NEW freeze id and NEW hashes for every frozen
   artifact. The new round starts from a clean slate.
5. Reconciliation of the two old rules: WITHIN one freeze id, a scored FAIL is
   a recorded result and "no retest / FAIL must not be deleted" applies - it
   cannot be erased by re-running. ACROSS freeze ids, a CORRECTION voids the
   whole round (unscored) and a new round begins with a new freeze id. There
   is NO path that changes a rule and re-runs under the same freeze. "Void and
   re-run" therefore always means "void this id, start a different id", never
   "edit this id and re-run it".

Self-hash closure (v1 defect F5): the decision rules live inside
`docs/evidence/effectiveness-freeze.json`, which stores NO hash of itself.
`docs/evidence/freeze-manifest.json` stores the SHA-256 of that freeze file,
so editing any decision rule (or the manifest's frozen list) changes a digest
that CAN be checked, firing E07. The freeze file stores the hashes of the two
v2 documents (`docs/IMPROVEMENT-PLAN.md` and
`docs/EFFECTIVENESS-EXPERIMENT-DESIGN.md`) but never its own.

## 10. Threats to validity V1-V9 (reconciled in the report template)

The report template `docs/effectiveness-report.template.md` reconciles each
threat. Definitions (frozen here):

| ID | Threat | Mitigation in v2 | Residual / verdict effect |
|---|---|---|---|
| V1 | Underpowered test (p_min > alpha) | 8 pairs, 2^8=256, p_min=0.00390625 <= 0.05 | none |
| V2 | Missing 2x2 cell / structural incompleteness | all 4 cells, n=2 each, C4 restored | none |
| V3 | Unblinding (arm identity exposed) | neutral blind labels, sealed blind key, E08 veto, VC22 | veto -> FAIL + VOID |
| V4 | Post-hoc rule change / freeze self-hash gap | manifest stores freeze SHA-256, new-freeze-id rule | veto -> FAIL + VOID |
| V5 | Precedence ambiguity (veto vs positive result) | veto > UNCERTAIN > FAIL > PASS | none |
| V6 | Inadmissible 4th evidence type | exactly 3 admissible types, E01, VC09 | FAIL (E01) |
| V7 | Consumer-load unverified (Chrome unavailable) | E12, listed as gap, not claimed PASS | UNCERTAIN |
| V8 | Silent edit of a frozen artifact | sha256 compare, E07 void, VC03 | veto -> FAIL + VOID |
| V9 | Multiplicity / p-hacking via multiple looks | ONE primary test (BH family=1), LOO and per-cell EXPLORATORY only | none confirmatory |

## 11. Verification commands (this round)

The following are the C2 verification commands; their real output is pasted in
`docs/handoffs/P4.md`. They are configuration-layer checks only (the A/B run
itself is NOT executed in this round).

```
sha256sum docs/IMPROVEMENT-PLAN.md docs/EFFECTIVENESS-EXPERIMENT-DESIGN.md docs/evidence/effectiveness-freeze.json
python <verify.py>   # loads both JSONs, asserts document hashes, freeze hash, 2^8=256, p_min<=alpha, 2 per cell, 4 self-check cases
python -c "<CJK scan over P4 owned files>"   # must print CJK_COUNT=0
```

## 12. Status and handoff

DESIGN_ONLY_NOT_EXECUTED. The experiment is fully specified and frozen by
hash, but no control/treatment cards have been run, no data collected and no
three-cell verdict produced. That gap is reported honestly in
`docs/handoffs/P4.md`. Any future execution must use a NEW freeze id.
