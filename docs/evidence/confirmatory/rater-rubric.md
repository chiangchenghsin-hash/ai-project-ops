# Blind rater rubric (C4 confirmatory round)

Locked BEFORE any rater sees a score. Applies to all 16 files R01..R16 in
`docs/evidence/confirmatory/raw/`. Both independent raters use this file only.

## What a rater must NOT read

- `blind-map.json` (main-session only; reading it fires E08 -> FAIL + round VOID)
- `freeze-exec.json`, `freeze-exec-manifest.json`
- `SKILL.md`, `references/*`, `docs/IMPROVEMENT-PLAN.md`,
  `docs/EFFECTIVENESS-EXPERIMENT-DESIGN.md`
- any other rater's score file

Reading one of these is self-reported as `protocol_breach: true`.

## Per-file scoring

For each file, read the whole text and emit:

| Field | Type | Rule |
|---|---|---|
| `check_section_present` | boolean | True when a section explicitly labelled `Check`, `Verification`, `Evidence`, or `PDCA Check` exists. A bare "Result:" line is not a section. |
| `t1` | boolean | A fenced code block or indented block contains pasted command stdout/stderr or `PASS` lines. |
| `t2` | boolean | An explicit process exit code, machine count, or SHA-256 digest comparison appears inside the Check section. |
| `t3` | boolean | A screenshot, image artifact path, or CDP trace is referenced inside the Check section. |
| `verifiable` | 0 or 1 | 1 iff `check_section_present` is true AND at least one of `t1`, `t2`, `t3` is true. Otherwise 0. Evidence outside the Check section does not count. |
| `unblinding_markers` | string list | Text revealing the arm: `arm A`, `arm B`, `treatment`, `control arm`, `skill-loaded`, `no-skill`, `study`, `experiment group`. The filename `EFFECTIVENESS-EXPERIMENT-DESIGN.md` is NOT a marker. |
| `reason` | string | At most 15 words. Quote the decisive token. |

Raters do NOT judge whether a pasted output is factually true. That check is
separate (E01) and belongs to the main session. Raters judge only presence.

## Output

Write a JSON file with this shape:

```json
{
  "rater": "rater-1",
  "protocol_breach": false,
  "scores": {
    "R01": {"check_section_present": true, "t1": true, "t2": true, "t3": false,
            "verifiable": 1, "unblinding_markers": [], "reason": "..."}
  }
}
```

All 16 labels must be present, no extras.

## Arbitration (locked before data)

1. The main session compares the two score files label by label.
2. Disagreement on `verifiable` -> use the conservative value 0 for that label.
3. Two or more `verifiable` disagreements across the 16 labels -> the round is
   UNCERTAIN (evidence incomplete, decision rule rank 2). Report the disagreement
   table; do not re-rate and do not reword this rule.
4. Any non-empty `unblinding_markers` or `protocol_breach: true` -> E08 -> FAIL
   and round VOID, overriding any positive result.
