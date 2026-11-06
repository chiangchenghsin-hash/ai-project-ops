---
reader_id: CR-1
report_date: 2026-11-05
artifact_under_test: ai-project-ops skill package (pre-C2 frozen set)
context_given: none (cold read; no spec walkthrough, no plan, no other reader draft)
ownership: docs/cold-read/reader-1.md (mutually exclusive; no shared output file)
slice: entry point SKILL.md / references/*.md, then full independent pass over the package
findings_reported: 6
confirmed_finding_ids: F1, F2, F3, F5, F6, M1
---

# Cold-read report CR-1

I received the artifact set with no context and was told to verify the claims
it makes about itself. Ownership note: I own only this file; I did not read or
edit any other reader's report before consolidation.

## Candidate defects found

- F1 (plan stage headers S4/S5). The improvement plan's stage-increment
  headers jump between `S4` and `S5` in a way that does not match the stage
  list. I could not map a fix to a stage, so I could not tell whether the
  stage was accepted.
- F2 (30/30 vs 19/19). The experiment/acceptance text claims 30/30 cases.
  The board reference document shows 19/19 PASS. Nothing reconciles the two
  numbers, so I could not tell how many verification cases actually exist.
- F3 (incomplete file ownership). The delegation brief does not give every
  path exactly one owner. Some paths have no owner and some appear twice.
  Two agents could write the same file without anyone noticing.
- F5 (freeze self-hash gap). The frozen hash list covers content files but
  not the manifest that lists them. Editing that list would not change any
  recorded digest, so "frozen" is not actually enforced.
- F6 (self-check 3 vs 4). One place requires 3 self-checks, another requires
  4. I could not decide which set of checks marks a package as done.
- M1 (undiscoverable frontmatter). I was asked to confirm the 8 required
  frontmatter fields. Nothing in the artifact set defines or lists them, so
  I could not enumerate a single one with confidence. With no context, the
  requirement was invisible.

## Notes

I flagged F4, F7 and the experiment's statistical power as "suspicious but
unconfirmed" because I could not reconstruct the 2x2 design from the files
alone; I left them out of my confirmed list. All 6 items above were reported
unprompted, before any consolidation discussion.
