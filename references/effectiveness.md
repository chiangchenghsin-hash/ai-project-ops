# Effectiveness evidence: C4 confirmatory round

## Verdict: UNCERTAIN

The question "does loading this skill produce verifiably better AI-led
engineering output than not loading it?" is **not answered**. The C4
confirmatory round ran to completion, but three independent rules resolve it to
UNCERTAIN. This is the honest result. It is not a FAIL of the execution and it
is not a PASS of the skill.

## What ran

- Freeze id: `ai-project-ops/C4/confirmatory-execution/2026-11-06-v1-001`.
- The C2 design freeze was **not edited**. A new freeze id and new hashes were
  used, as required by the C2 correction.
- 8 frozen paired cards, 2 per 2x2 cell. 16 independent subagent sessions:
  arm A (skill-loaded) and arm B (no-skill), one fresh session per pair and arm.
- Outputs written to 16 blind labels R01..R16 by a seeded shuffle. Two
  independent blind raters scored all 16 against a rubric locked before data.
- Main session unblinded, applied the conservative arbitration rule, and ran an
  exact sign-randomization test over 2^8 = 256 assignments.

## Result

| Item | Value |
|---|---|
| Rater 1 `verifiable=1` | 7 of 16 |
| Rater 2 `verifiable=1` | 9 of 16 |
| Disagreements | 2 (R01, R12) -> conservative AND |
| Paired differences (A - B) | `[0, 1, 0, 0, 1, 0, 0, 1]` |
| T_obs | 3 |
| Exact one-sided p | 0.125 |
| alpha (BH family = 1 test) | 0.05 |
| Leave-one-out p range | 0.125 .. 0.25 |
| Failure cells C2 / C4 | effect 0 / 1, per-cell p 1.0 / 0.5 -> E10 fired |
| Veto E07 / E08 | false / false |
| **Verdict** | **UNCERTAIN** |

Three separate reasons force UNCERTAIN:

1. Rater disagreement >= 2 means evidence is incomplete (arbitration rule 3).
2. `p = 0.125 > 0.05` means a gain with corrected p above alpha is UNCERTAIN,
   never PASS.
3. E10: neither failure cell discriminates.

The direction favours the skill arm (3 positive pairs, 0 negative), but a
direction is not a verdict.

## Structural finding (important)

With only 2 paired cards per cell, the minimum attainable per-cell exact p is
`1/2^2 = 0.25`, which is greater than alpha 0.05. The frozen failure-cell rule
therefore makes PASS **structurally unreachable at cell level**. This is a
defect of the C2 design, not of the execution. It was found after data and is
reported here. It must be fixed only under a **new freeze id (C5)**: use at
least 3 paired cards per cell. Do not reword the current round.

## Threat reconciliation (summary)

- **V1 drift (PARTIAL)**: an external commit on 2026-11-06 added
  `src/graph.ts` and grew the shipped selftest from 41 to 71 assertions between
  the C2 freeze and this round. Frozen artifacts were untouched (all four
  hashes MATCH), so the round is not void, but comparability with the C2
  release state is weakened.
- **V2**: arm A read the skill docs; arm B did not. That asymmetry is the
  treatment. Token counts are reported, not adjusted.
- **V3**: no unblinding markers, no protocol breach, `blind-map.json` was not
  read by either rater.
- **V4**: card P04 names the skill inside the frozen prompt itself. Both arms
  saw it. This is a pre-registered card defect and may depress the difference.
- **V5-V9**: multiplicity stayed at one primary test; no frozen artifact was
  edited after unblinding; timing stayed descriptive; synthetic self-check
  cases stayed separate from real data; both failure cells are reported.

Full table: `docs/evidence/confirmatory/report.json`.

## Reproduce

```
python docs/evidence/confirmatory/recompute.py
```

Expected output ends with `VERDICT UNCERTAIN` and
`RECOMPUTE_MATCH PASS`, exit code 0. Raw outputs, both score files, the blind
map, the rubric and `analysis.json` are all persisted under
`docs/evidence/confirmatory/`.

## Score impact (pre-locked, applied as written)

Before any output was scored, `freeze-exec.json` locked this rule: dimension 10
reaches 2.0 when the confirmatory round is executed, raw outputs and blind
scores are persisted, and the report is reproducible; **a FAIL or UNCERTAIN
verdict is honest evidence and still completes S5**. The rule is applied as
written, with no post-hoc change.

- Dimension 10: 1.5 -> **2.0**
- Total: 17.5 -> **18.0 / 20**

**Caveat — do not misread this.** 18.0/20 measures evidence availability and
release engineering. It does **not** mean the skill has been shown to improve
AI-led engineering. The substantive effect question remains UNCERTAIN. A
future C5 round with >= 3 pairs per cell is required to answer it.

## Corrections

None to this round. C2 (voided v1), C3 (response style), C4 (new execution
freeze) are recorded in `docs/TASK-LOG.md`.
