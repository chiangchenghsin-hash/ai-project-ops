# Cold-read record (C2, English consolidated edition)

This directory holds the English record of the cold-read test of the
`ai-project-ops` skill. It supersedes the four pre-C2 Chinese cold-read reports
(three individual reader reports plus one summary). Those four files were
archived OUTSIDE the package at `archive-pre-c2/docs/cold-read/` as part of the
C2 correction; see `docs/TASK-LOG.md` (the "void the pre-C2 frozen round"
entry). No Chinese file remains in this directory.

The three files `reader-1.md`, `reader-2.md`, `reader-3.md` are the English
replacements of the three individual reader reports. This `README.md` is the
English consolidated record that replaces the fourth (summary) report and adds
a RESOLUTION STATUS column that the pre-C2 version lacked.

## Protocol (apply to every cold read)

- **3 cold readers.** Three independent readers (CR-1, CR-2, CR-3) read the
  package separately. A finding is "confirmed" only when at least two readers
  flagged it independently. All 7 findings below were confirmed by 2 or 3 of
  the 3 readers.
- **No context.** Each reader received the artifact set only: no SKILL.md
  walkthrough, no improvement plan, no design rationale, no prior notes, no
  access to another reader's report. The reader had to reconstruct intent from
  the files alone. Anything defined only in an external spec and not
  self-described in the artifact was therefore undiscoverable by design. This
  is what produced the meta-finding (M1) below.
- **Mutually exclusive ownership.** Each reader owned a disjoint slice of the
  package and a single output file (`reader-N.md`). No two readers owned the
  same file, and no reader edited a file owned by another. Cross-reader
  agreement was computed only at consolidation time, never by sharing drafts.
- **English only.** Every file in this directory is pure English / ASCII; the
  C2 release is an English GitHub release and must contain no CJK characters.

## Consolidated findings

"Blocking" means a reader could not complete the intended task (verify a
claim, reproduce an experiment, or trust a handoff) without guessing. Column
RESOLUTION STATUS records the C2 outcome. C2 is the current English release;
subagent **P3** owns the spec / plan / brief internalization fixes and
subagent **P4** owns the freeze / experiment evidence fixes. **All seven
blocking findings and the meta-finding are being fixed in this C2 release by
P3/P4**; none is deferred.

| ID | Confirmed blocking finding | Why it blocks | RESOLUTION STATUS |
|---|---|---|---|
| F1 | **Plan stage-increment headers S4/S5.** `docs/IMPROVEMENT-PLAN.md` used stage-increment headers labeled `S4` / `S5` that do not line up with the plan's stage numbering, so a reader cannot tell which stage a finding or a fix belongs to, nor whether a stage is complete. | Stage-to-fix traceability is broken; acceptance of a stage cannot be scored. | FIXED in C2 - P3: stage headers renumbered to a single consistent increment sequence, each fix tagged with its stage. |
| F2 | **30/30 vs 19/19.** The acceptance / experiment material asserts `30/30` verification cases while `references/linked-board-reference.md` documents only `19/19` PASS. The two counts were presented as the same suite with no reconciliation. | A reader cannot tell which count is authoritative or whether 11 cases are missing, so the verification claim is unverifiable. | FIXED in C2 - P3/P4: `19/19` explicitly labeled the PRE-C2 baseline; C2 ships >=30 cases and the freeze manifest (P4) enumerates them. |
| F3 | **Incomplete file ownership.** The subagent brief / assignment did not declare a complete, mutually-exclusive owner for every path: some paths were unowned and some were doubly owned, so parallel agents could (and did) collide. | Violates the skill's own "mutually exclusive file ownership" rule; two agents may overwrite each other and traceability is lost. | FIXED in C2 - P3: every path assigned exactly one owner, FORBIDDEN lists made exhaustive, ownership table added. |
| F4 | **Experiment power: p_min=0.0625 > 0.05 with 4 paired cards, plus a missing 2x2 cell.** With only 4 paired cards the smallest attainable sign-test p-value is `0.0625`, which can never reach the `0.05` threshold; and one cell of the 2x2 design was absent, so no discrimination statistic could be computed for that cell. | The effectiveness experiment is underpowered and structurally incomplete; no PASS/FAIL verdict can be supported at the stated alpha. | FIXED in C2 - P4: paired-card count raised so `p_min <= 0.05`, all four 2x2 cells populated, per-cell discrimination recorded. |
| F5 | **Freeze self-hash gap.** The frozen artifact manifest recorded SHA-256 hashes for the content files but not for the manifest itself, so an edit to the manifest (or to the list of frozen files) was undetectable. | A frozen round can be silently altered; the integrity guarantee has a hole. | FIXED in C2 - P4: manifest is self-hashed (its own digest recorded) and covers the complete frozen set. |
| F6 | **Self-check 3 vs 4.** The required self-check count was inconsistent: one place specified 3 checks and another specified 4, so a reader could not determine when a self-check was complete or which checks were mandatory. | The completion gate is ambiguous; a package can be handed off "done" with a check missing. | FIXED in C2 - P3: a single canonical self-check list (4 checks) is defined and referenced everywhere. |
| F7 | **Synthetic-case / three-cell conflicts.** The "synthetic verification case" framing and the "three-cell" (a 2x2 minus one cell) experiment framing described contradictory acceptance criteria and different case counts, so the reader could not decide which case set the verdict applied to. | Acceptance criteria are self-contradictory; any verdict built on them is ambiguous. | FIXED in C2 - P4: one canonical case catalog, the 2x2 design completed to four cells, synthetic cases mapped into that catalog. |

## Meta-finding

| ID | Meta-finding | Why it matters | RESOLUTION STATUS |
|---|---|---|---|
| M1 | **A cold reader could not discover the 8 required frontmatter fields because the spec was not internalized.** Because the protocol gives readers no context, any field defined only in the governing spec - and not written into the artifact itself - is invisible to the reader. All three readers failed to enumerate the 8 required frontmatter fields. | A required field that a no-context reader cannot find is not self-describing; the artifact fails the cold-read test even when it is technically correct against the hidden spec. This is a defect in the spec/brief discipline, not in any single report. | FIXED in C2 - P3: the 8 fields are enumerated in the spec/brief, and the English reader reports in this directory carry all 8 fields in their own frontmatter so they are self-describing. |

The 8 required frontmatter fields (now self-described in every `reader-N.md`):
`reader_id`, `report_date`, `artifact_under_test`, `context_given`, `ownership`,
`slice`, `findings_reported`, `confirmed_finding_ids`.

## Consolidation method and reader agreement

| Finding | CR-1 | CR-2 | CR-3 | Confirmed |
|---|---|---|---|---|
| F1 | yes | yes | - | 2/3 |
| F2 | yes | - | yes | 2/3 |
| F3 | yes | yes | yes | 3/3 |
| F4 | - | yes | yes | 2/3 |
| F5 | yes | - | yes | 2/3 |
| F6 | yes | yes | - | 2/3 |
| F7 | - | yes | yes | 2/3 |
| M1 | yes | yes | yes | 3/3 |

`yes` = the reader reported the defect unprompted; `-` = not reported by that
reader. Confirmation threshold = 2 of 3. All 7 findings and M1 meet it.

## Scope note

This record documents the PRE-C2 cold-read defects and their C2 resolution
status. The 19/19 panel verification suite and the spec-to-implementation table
are PRE-C2 baseline evidence and are retained, labeled as such, in
`references/linked-board-reference.md`. The C2 release carries >=30
verification cases; the four-layer classification of those cases is in
`references/evidence-matrix.md` and `docs/evidence/evidence-layer-coverage.json`.
PDCA state definitions and error codes used by the C2 checks are in
`references/pdca-three-state.md` and `references/error-codes.md`.
