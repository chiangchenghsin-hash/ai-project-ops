---
reader_id: CR-2
report_date: 2026-11-05
artifact_under_test: ai-project-ops skill package (pre-C2 frozen set)
context_given: none (cold read; no spec walkthrough, no plan, no other reader draft)
ownership: docs/cold-read/reader-2.md (mutually exclusive; no shared output file)
slice: entry point docs/IMPROVEMENT-PLAN.md / docs/EFFECTIVENESS-EXPERIMENT-DESIGN.md, then full independent pass over the package
findings_reported: 6
confirmed_finding_ids: F1, F3, F4, F6, F7, M1
---

# Cold-read report CR-2

I read the package with no context and no access to the other readers' notes.
I own only this file. My entry point was the plan and experiment documents;
after that I read the whole package in one independent pass.

## Candidate defects found

- F1 (plan stage headers S4/S5). The plan numbers its stages inconsistently:
  the increment headers `S4` / `S5` do not match the stage sequence, so the
  plan cannot be used as a traceability index.
- F3 (incomplete file ownership). The assignment does not assign exactly one
  owner to every path. Unowned and doubly-owned paths both appear.
- F4 (experiment power and missing cell). The experiment uses 4 paired cards.
  With 4 pairs the smallest possible two-sided sign-test p-value is 0.0625,
  which can never meet the stated 0.05 alpha. One cell of the 2x2 table is
  also missing, so discrimination for that cell cannot be computed at all.
- F6 (self-check 3 vs 4). The required self-check count is stated as both 3
  and 4 in different places. The completion gate is ambiguous.
- F7 (synthetic-case / three-cell conflicts). The "synthetic verification
  case" description and the "three-cell" (2x2 minus one) description give
  contradictory case sets and contradictory acceptance criteria. I could not
  tell which set a verdict applies to.
- M1 (undiscoverable frontmatter). The 8 required frontmatter fields are not
  listed anywhere in the artifacts. Given no context, I could not discover
  them; the requirement must be written into the artifact or the spec.

## Notes

I did not independently confirm F2 or F5; both looked plausible but I could
not reproduce the case-count reconciliation or the hash-coverage check from
the files alone. All 6 items above were reported unprompted.
