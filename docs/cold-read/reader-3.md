---
reader_id: CR-3
report_date: 2026-11-05
artifact_under_test: ai-project-ops skill package (pre-C2 frozen set)
context_given: none (cold read; no spec walkthrough, no plan, no other reader draft)
ownership: docs/cold-read/reader-3.md (mutually exclusive; no shared output file)
slice: entry point docs/TASK-LOG.md / references/subagent-brief.md / assets/linked-gantt-board/, then full independent pass over the package
findings_reported: 6
confirmed_finding_ids: F2, F3, F4, F5, F7, M1
---

# Cold-read report CR-3

I was given the artifact set only, with no context and no other reader's
report. I own only this file. I started from the ledger, the brief and the
shipped implementation, then read the whole package independently.

## Candidate defects found

- F2 (30/30 vs 19/19). The acceptance material claims 30/30 verification
  cases; the board reference shows 19/19 PASS with 17 pasted key lines. There
  is no mapping between the two, so the larger claim is unverifiable.
- F3 (incomplete file ownership). The brief does not declare complete,
  mutually-exclusive ownership. Some paths are unowned; some are claimed by
  more than one agent. This contradicts the brief's own rule.
- F4 (experiment power and missing cell). With 4 paired cards p_min is
  0.0625, above the 0.05 threshold, so the experiment cannot reach a PASS at
  the stated alpha. A 2x2 cell is missing, so no discrimination statistic
  exists for it.
- F5 (freeze self-hash gap). The freeze records digests for content files but
  not for its own manifest. A change to the manifest is undetectable, so the
  integrity claim has a hole.
- F7 (synthetic-case / three-cell conflicts). The synthetic case and the
  three-cell framing disagree on the case set and on what counts as acceptance.
  The contradictions are not resolved anywhere in the artifacts.
- M1 (undiscoverable frontmatter). I could not find the 8 required frontmatter
  fields. Without context there is no way to know what they are; a required
  field defined only in an unseen spec is not discoverable.

## Notes

I did not independently confirm F1 or F6; I saw inconsistent numbering but
could not reconstruct the canonical stage list or the canonical self-check
count from the artifacts alone. All 6 items above were reported unprompted.
