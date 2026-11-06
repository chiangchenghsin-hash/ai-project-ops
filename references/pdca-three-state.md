# PDCA three-state verdict: PASS / FAIL / UNCERTAIN (C2)

The PRE-C2 ledger used only PASS and FAIL. That collapsed two very different
situations into one: "we measured and it was bad" and "we could not measure at
all". C2 adds a third state, UNCERTAIN, so incomplete evidence is never
misreported as a negative result. Error codes E01-E12 (see
`references/error-codes.md`) resolve to these states; the four-layer matrix
(see `references/evidence-matrix.md`) says which layer a state came from.

## State definitions

| State | Definition | Required evidence |
|---|---|---|
| **PASS** | All stated acceptance criteria were met, the evidence is pasted, the relevant evidence layers are green, and NO veto condition is active. | Real command output lines / counts / screenshots in Check; all four layers satisfied for the claim; no E07/E08 veto. |
| **FAIL** | A criterion was missed, a performed check returned negative, the Check evidence is absent from the deliverable, or a later re-check contradicted the claim. Also the state when a veto fires on a frozen artifact (E07). | A negative result that WAS actually produced (or the explicit finding that required Check evidence is missing, E01). |
| **UNCERTAIN** | The artifact may be correct but the evidence is incomplete, unverifiable, underpowered, or the consumer could not load it - so it cannot be scored. | An explicit record of WHAT could not be verified and WHY (headless limit, underpowered experiment, missing 2x2 cell, unblinding). |

Key distinction: **UNCERTAIN is about evidence that could not be produced;
FAIL is about a result that was produced and was negative (or about required
evidence that is simply absent from the deliverable).** Running a check and
getting a red line is FAIL (E05, E06, E09). Not being able to run the check at
all is UNCERTAIN (E12). Having no Check section whatsoever is FAIL under the
skill's hard rule "no Check evidence = task not done" (E01) - that is a
completeness failure of the deliverable, not an environment limit.

## Precedence rules

Apply in this order; the first rule that fires wins.

1. **A veto wins over a positive primary result.** If any veto condition fired
   (E07 frozen artifact changed, E08 unblinding detected), the round is FAIL /
   VOID regardless of how strong the primary result is. A `30/30 PASS` does not
   survive an E07 hash mismatch. This is the highest-precedence rule.
2. **UNCERTAIN wins over FAIL when evidence is incomplete.** If a check could
   not be executed or the evidence is underpowered / unverifiable, record
   UNCERTAIN, not FAIL - you cannot call FAIL on something you did not measure.
   Applies to E02 (meter schema mismatch), E08 (unblinding), E10 (no
   discrimination in a failure cell) and E12 (Chrome unavailable / UI
   unverified). This is distinct from E01 (no Check evidence in the
   deliverable), which is still FAIL.
3. **FAIL for a produced negative result.** A performed check that returned
   negative, or a contradiction found on re-check, is FAIL (E03, E04, E05,
   E06, E09, E11).
4. **PASS only if everything above is clear.** PASS requires all criteria met,
   all four evidence layers green, pasted evidence, and no veto. It is the
   last rule, not the default.

### Worked examples

- `node selftest.js` -> 19/19 PASS, but one frozen file's SHA-256 differs:
  **E07 veto -> FAIL + round VOID**. The 19/19 is overridden (rule 1).
- The CDP suite never attached to Chrome, so no UI lines exist:
  **UNCERTAIN** (E12, rule 2), not FAIL. "The page opens" must not be claimed.
- 30/30 PASS on the primary metric, but a card label reveals the treatment
  arm: **E08 veto -> round VOID**, re-blind and re-run (rule 1).
- 4 paired cards give `p_min=0.0625 > 0.05`, so the experiment cannot reach
  the stated alpha: **UNCERTAIN** (E10, rule 2), not FAIL - the experiment is
  underpowered, not wrong.
- A Check section says `should work` with no output: **FAIL** (E01), because
  required evidence is absent from the deliverable itself.

## Voided round = a correction, not a scored entry

A **voided round** is triggered by E07 (frozen artifact changed), E08
(unblinding), or any silent edit of a frozen document. The PRE-C2 round was
voided for exactly this reason (English localization and the C2 fixes
necessarily modify both frozen documents; see the "void the pre-C2 frozen
round" entry in `docs/TASK-LOG.md`).

Rules for a voided round:

- It is **preserved as evidence, never edited and never deleted**. The old
  frozen SHA-256 values are retained for audit.
- It is **numbered as a CORRECTION**, and the correction states that the prior
  round is void BEFORE any new round starts.
- It carries **NO PASS / FAIL score** and does not change the scoreboard. A
  correction is not a scored task; scoring it would double-count a round that
  never produced a valid result.
- The new round starts from a clean slate and is **re-frozen with new hashes**
  by P4 (`docs/evidence/effectiveness-freeze.json`,
  `docs/evidence/freeze-manifest.json`).
- A voided round is not the same as UNCERTAIN: UNCERTAIN is a scored-but-
  unresolved state awaiting re-check, whereas a voided round is removed from
  scoring entirely as a correction.

## State by error code (quick reference)

- FAIL: E01, E03, E04, E05 (when a test ran), E06, E07 (plus VOID), E09, E11.
- UNCERTAIN: E02, E05 (when headless-only), E08 (plus VOID), E10, E12.
- VOID (correction, unscored): E07, E08.

Full trigger / detection / remediation for each code is in
`references/error-codes.md`.
