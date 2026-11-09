# TASK-LOG (PDCA ledger)

> Discipline: every task — especially every subagent package — appends one PDCA
> entry on completion. **No Check evidence = task not done.** Check must paste
> real command output, counts, exit codes or screenshots; "should work" is not
> evidence. Entries are append-only. The main session owns this header line and
> the scoreboard; subagents deliver their PDCA line in their own handoff file,
> never into this ledger.
> Scoring: PASS +1 / FAIL -1. A scored entry is one whose Act carries a verdict;
> entries awaiting the main-session re-check are not counted yet.
> Re-check verdict format: `Re-check (main): <command> -> <result> — PASS|FAIL`.
> A gap found and fixed during verification belongs in Check; its lesson in Act.

## Scoreboard
PASS 17 / FAIL 1

---

### 2026-11-05 21:04 C2 — void the pre-C2 frozen round (by: main session)
- **P** Plan: package the skill as an English GitHub release and implement the
  improvement plan. Scope correction is mandatory first: English localization and
  the C2 fixes necessarily modify both frozen documents, which by design §8
  voids that round. Acceptance: old round preserved as evidence, not edited;
  correction numbered; no silent rewrite of frozen artifacts.
- **D** Do: copied the seven Chinese v1 documents verbatim to
  `archive-pre-c2/docs/` outside the package; removed `docs/` from the package;
  created empty `docs/{evidence,handoffs,cold-read}/` for the English v2.
- **C** Check: `find archive-pre-c2/docs -type f` -> 7 files (IMPROVEMENT-PLAN.md,
  EFFECTIVENESS-EXPERIMENT-DESIGN.md, cold-read/*.md x4,
  evidence/effectiveness-freeze.json). Old frozen SHA-256 retained for audit:
  `89b59fb993e62754427dc78c18200aa33a41fd13c3089d5ab3d480c23880abfc` (plan),
  `0246d26ba3c70b084b258b2c734329d0eb5d1feb89ebcea414d982207e4491bf` (design).
  `find <package>/docs -type f | wc -l` -> 0 (clean slate).
- **A** Act: **C2 correction recorded; v1 round VOID (not deleted, not edited).
  No score assigned** — this is a correction, not a scored task. English v2
  documents will be re-frozen with new hashes by package P4. Lessons carried
  forward: (1) a frozen artifact must never be silently edited; (2) a correction
  must state that the prior round is void before any new round starts.

---

### 2026-11-05 22:40 P1 - English cold-read record and audit references (by: subagent-p1)
- **P** Plan: replace the voided Chinese cold-read reports with English ones,
  rewrite `references/linked-board-reference.md`, add the four-layer evidence
  matrix, E01-E12 error codes and the three-state PDCA rules. Acceptance:
  English only, valid JSON, CJK=0, no forbidden file touched.
- **D** Do: 10 files written (`docs/cold-read/README.md` + 3 reader reports,
  `references/{linked-board-reference,evidence-matrix,error-codes,pdca-three-state}.md`,
  `docs/evidence/evidence-layer-coverage.json`, `docs/handoffs/P1.md`).
- **C** Check: subagent reported `CJK_COUNT = 0` over 10 owned files and
  `json.load OK; schema=ai-project-ops/evidence-layer-coverage/v1; layers=4;
  cases=24`. Main re-check: `python scripts/localize_check.py` ->
  `Text files scanned: 70 / CJK_COUNT=0 / EXIT_CODE=0`; all 37 markdown
  relative links resolve (`validate_skill.py` warning check: broken=0).
- **A** Act: **PASS**. Promotion: `references/evidence-matrix.md` and
  `references/error-codes.md` are now the canonical definitions reused by P4.
- `Re-check (main): python scripts/localize_check.py -> CJK_COUNT=0 — PASS`

---

### 2026-11-05 22:40 P2 - English panel, S2 command loop, S4 recovery, 41-case suite (by: subagent-p2)
- **P** Plan: localize every owned file to ASCII, add ACK/approve/reject,
  blocking signals with N=24h, DEMO isolation, `/healthz`, backup/restore and
  degraded mode; expand selftest from 19 to >=30 assertions.
- **D** Do: rewrote `panel.html`, `src/*.ts`, `db.js`, `selftest.js`,
  `data/*.json`; regenerated `dist/` with `tsc`; added `acks` table, routes,
  `rejections.json`, backup endpoints and env `PANEL_PORT`/`CDP_PORT`.
- **C** Check: subagent pasted `TSC_EXIT=0`, `NODE_CHECK_EXIT=0`, `CJK_COUNT=0`,
  `NONASCII_COUNT=0`, `grep -c PASS=44`, plus db.js/HTTP/degraded smoke lines.
  Main re-check: `node scripts/verify.js` -> `Result: 41/41 passed` and
  `[verify] RESULT: PASS (exit 0)`; `tsc -p tsconfig.json` -> `TSC_EXIT=0`;
  `preview-plan.png` visually confirmed English (DEMO banner, cost-first label).
- **A** Act: **PASS**. Gap found during main verification (belongs in Check,
  honesty): the backup/restore case left
  `data/backups/panel-1793889528249-2afm2.db`, so `validate_skill.py` returned
  exit 2. Fixed by adding cleanup + a 41st assertion in `selftest.js` and a
  defensive backup sweep in `scripts/verify.js`; lesson crystallized into
  `validate_skill.py`'s `runtime_state_files_absent` gate. Re-run: `VALIDATE_EXIT=0`.
- `Re-check (main): node scripts/verify.js -> 41/41 passed, exit 0 — PASS`

---

### 2026-11-05 22:40 P3 - English 1.1.0 release engineering (by: subagent-p3)
- **P** Plan: 8 required frontmatter fields, "Not for" negative triggers,
  internalized packaging spec, `scripts/validate_skill.py`, `scripts/verify.js`,
  `scripts/localize_check.py`, `templates/`, trigger regression, release
  checklist, CHANGELOG, unified metering columns, starter-kit caveat.
- **D** Do: 13 owned files plus generated `docs/evidence/validation-report.json`.
- **C** Check: first validator run exit 1 (inline-code example misread as link);
  fixed, final `validate_skill: 14/14 checks passed; exit_code=0`.
  Main re-check after all packages landed: `python scripts/validate_skill.py`
  -> `VALIDATE_EXIT=0` with `broken=0`, `cjk_count=0`, `leaks=0`;
  `python -m py_compile ...` -> 0; `node --check scripts/verify.js` -> 0.
- **A** Act: **PASS**. The official spec is now inside the package
  (`references/packaging-spec.md`), closing the cold-reader meta-finding M1.
- `Re-check (main): python scripts/validate_skill.py -> exit 0, 14/14 — PASS`

---

### 2026-11-05 22:40 P4 - English v2 plan, experiment design and C2 re-freeze (by: subagent-p4)
- **P** Plan: fix every C2 defect and re-freeze. Acceptance: PASS reachable,
  2x2 grid complete, freeze self-hash gap closed, 4 consistent self-check cases,
  three-cell labels, post-hoc loophole sealed, new hashes matching.
- **D** Do: 6 owned files; 8 paired cards (2 per cell), 2^8=256,
  `p_min=0.00390625`; manifest stores the freeze SHA-256.
- **C** Check: subagent pasted `ALL_PASS` (9 checks) and 3 sha256sum lines.
  Main re-check: `DOC docs/IMPROVEMENT-PLAN.md MATCH 6a443e3f440b`,
  `DOC docs/EFFECTIVENESS-EXPERIMENT-DESIGN.md MATCH 09798275ad1f`,
  `FREEZE_HASH MATCH 172858c1e12e`, `cards 8 perm 256 p_min 0.00390625
  alpha 0.05 reachable True`, `self_check count 4`, `CJK files: 0`.
- **A** Act: **PASS** for the design package. Honest boundary: status remains
  `DESIGN_ONLY_NOT_EXECUTED`; no A/B run and no three-cell verdict exist.
- `Re-check (main): sha256sum + json load -> 3 MATCH, p_min<=alpha — PASS`

---

### 2026-11-05 22:45 MAIN - integration, E2E, GitHub zip, final scoring (by: main session)
- **P** Plan: integrate the four packages, independently re-verify, produce an
  English GitHub-ready zip, and score against the frozen 10x2 rubric. Acceptance:
  one-command E2E all PASS, validator exit 0, zero CJK, zero runtime state in
  the zip, score computed without changing the rubric.
- **D** Do: ran `node scripts/verify.js`, `python scripts/validate_skill.py`,
  `python scripts/localize_check.py`, `tsc`, hash re-computation, screenshot
  inspection, and built `release/ai-project-ops-1.1.0.zip` (73 entries).
- **C** Check: `VERIFY_EXIT=0` with `Result: 41/41 passed`;
  `VALIDATE_EXIT=0` (14/14); `LOCALIZE_EXIT=0` (`CJK_COUNT=0`, 70 files);
  `TSC_EXIT=0`; 3 frozen hashes MATCH; release archive `73 entries`,
  checksum stored outside the package in
  `release/ai-project-ops-1.1.0.zip.sha256` (no self-referential hash),
  `git entries none`, `db entries none`, `cjk content files none`;
  `preview-plan.png` visually English. Score: 2+2+2+2+2+2+1+1+2+1.5 = **17.5/20**.
  Dimension 10 stays at 1.5 because the confirmatory no-skill experiment is
  still DESIGN_ONLY — selftest evidence is product verification, not a
  skill-vs-native comparison.
- **A** Act: **FAIL against the 18.0/20 goal.** Per section 0 this is recorded
  honestly: no retest, no rubric change, no hidden promotion of a design-only
  artifact. PASS for the integration itself is recorded as the 5th PASS above.
  Lesson: a pre-registered effect-estimation stage cannot be scored by
  implementation evidence; it needs its own frozen round with independent
  sessions. Next round must use a NEW freeze id and NEW hashes.

---

### 2026-11-06 08:45 C3 - controlled response style (by: main session)
- **P** Plan: add the softened 80% ASD-STE100 response style to the skill.
  Acceptance: source claims graded, no unverified number presented as fact,
  Chinese adaptation marked as a local approximation, fact-retention gate
  included, frozen artifacts untouched, English-only package preserved.
- **D** Do: verified the 2026-10-02 X-post claim with web search (four
  secondary sources agree on the date, the ASD-STE100 recommendation and the
  "80% of the way" softening; the primary X URL was not retrieved and view
  counts disagree). Added `references/response-style-ste100.md`, SKILL.md
  section 11 and description triggers, README contents row and CHANGELOG C3.
- **C** Check: `python scripts/validate_skill.py` -> exit 0, 14/14,
  broken=0, cjk_count=0, leaks=0; `python scripts/localize_check.py` ->
  CJK_COUNT=0; three frozen SHA-256 re-checked -> MATCH (plan 6a443e3f...,
  design 09798275a..., freeze 172858c1e...). No frozen document was edited.
  Fact-retention gate self-test in section 6 of the new reference: bad rewrite
  drops the DB condition, the negation and the range 1-3 -> FAIL; good rewrite
  keeps all three -> PASS.
- **A** Act: **PASS**. Promotion: section 11 now applies the style to command
  snapshots, PDCA Check lines, subagent briefs and issue replies, and forbids
  rewriting frozen artifacts (C2 lesson). Lesson: a style rule can improve
  readability without improving truth; the fact-set comparison gate must travel
  with the style rule, not sit in a separate note. Score stays 17.5/20: this
  change adds no rubric dimension and does not execute the confirmatory round.

---

### 2026-11-06 13:52 R17 — competitive benchmark + starter-kit defect round (IN FLIGHT; by: main session + 6 subagents)

> Written BEFORE the subagents return, so the acceptance criteria below are
> pre-registered and cannot be retrofitted. C and A state methods, not results.
> This entry carries no score until each front's Act carries a verdict.

- **P** Plan: two fronts, six subagents.

  **Front A — competitive benchmark (5 subagents).** Goal: hold a
  borrowable-then-surpass position on the human-directs / AI-executes axis.
  Binding constraint from the human, rendered from the original Chinese:
  "TeamBition research alone is not enough. Competitive research is
  alignment, not plagiarism. Look at more players. Borrow in order to
  surpass. Never copy. We must be stronger than they are and better suited
  for AI-human collaboration." Acceptance criteria (locked
  now):
  1. Each group returns sections in this order — Align (5-10 items) /
     Surpass (3-6 gaps) / Never-copy (3-5 anti-patterns). Wrong order or a
     missing section = FAIL.
  2. Every Align item carries a landing spot (a named file or concept in this
     repo) and an effort estimate. An item without a landing spot does not
     count toward criterion 1.
  3. Every non-obvious claim carries a source URL. Count them.
  4. Invention gate: a claim graded "primary / verified" that its cited source
     does not support = FAIL for that report.
  5. No-copy gate: each report names at least one thing we will NOT imitate
     plus the one-line principle we adopt instead. Absent = FAIL.
  6. A cross-competitor synthesis states at least three claims about where we
     win on AI-human collaboration. No synthesis = the round is not done.
  Non-goals: no feature-list dumping; no copied UI copy or visuals; no
  screenshots; no marketing prose.

  **Front B — starter-kit defect verification (2 subagents).** Goal: decide
  with file:line evidence which of five empirically reported defects exist in
  THIS upstream tree, and produce an apply-ready patch list. Source: a
  downstream fork (crisis-lab) proved five defects and fixed them fork-side;
  upstream is unfixed. The fork's paths sit on another machine and are not
  readable from here, so nothing may be copied from it. Acceptance criteria
  (locked now):
  1. Each of the five defects carries a verdict PRESENT / ABSENT / PARTIAL
     plus `file:line` plus quoted code. A verdict without a quote is not a
     verdict.
  2. Version-drift gate: the fork selftest has 19 cases, ours has 30+. Any
     conclusion reproduced from the pasted brief without local evidence = FAIL.
  3. The patch list is apply-ready: file + line + before + after + why. A
     patch whose target must be re-derived is incomplete.
  4. Consequence completeness: every patch lists its knock-ons (dist rebuild,
     docs, `scripts/verify.js`, validators). One missing knock-on makes the
     entry incomplete.
  5. Convention gate: every new comment is English and `CJK_COUNT=0` holds. A
     proposed Chinese comment = FAIL.
  6. Non-goal for this round: verification only. Applying the fixes is a
     separate entry with its own Check.
  Non-goals: no code edits by the verifying agents; no data-contract change;
  no new features; no npm dependency.

- **D** Do: two waves dispatched this session.
  Wave 1 — competitive research, one subagent per group: (1) Linear + Height;
  (2) Notion + Monday.com; (3) ClickUp + Asana + Motion; (4) Devin + Jules +
  GitHub Copilot coding agent; (5) the China market — Feishu Project (Meego) /
  ONES / PingCode plus a TeamBition gap-fill. Each writes a full report to
  `assets/linked-gantt-board/.research/<slug>.md` and returns a five-line
  TL;DR.
  Wave 2 — defect verification, read-only, report only: (6) defects 1-3;
  (7) defects 4-5 plus a repository-convention survey.
  D progress, logged as evidence arrives: subagent (6) returned at 13:5x with
  defects 1, 2 and 3 all PRESENT and an apply-ready patch list. Its key facts,
  pending my re-check: `src/app.ts:81` refills `t.billed` raw under an
  "M tokens" label while `onSubmit` multiplies by 1e6, so save-without-edit
  inflates 1,000,000x; `panel.js:20-22` `alive()` reads `GET /` and treats
  any 2xx as ours; `server.js:56-61` `/healthz` already returns
  `service: 'command-panel'`, so the identity fix needs no server change;
  the default port 4174 is written in five files / twelve lines, not three.
  Knock-on discovered: `.research/` holds Chinese reports inside the package
  tree, so `EXCLUDE_DIRS` in the validators and `.gitignore` must cover it.
  Return log, append-only: (6) 13:5x defects 1-3 all PRESENT;
  (4) 13:5x Devin / Jules / GitHub Copilot coding agent, full report at
  `.research/devin-jules-copilot.md`; (2) 14:0x Notion / Monday.com, full
  report at `.research/notion-monday.md`. Front A now has 2 of 5 reports in
  and Front B has 1 of 2. Sourcing caveat to test under C-A3 and C-A4: the
  Notion/Monday report states that Monday body text was fetched through the
  Zendesk API because the HTML is Cloudflare-blocked, so its Monday claims are
  second-hand relative to a normal page fetch and must be spot-checked harder.
  (3) 14:2x ClickUp / Asana / Motion, full report at
  `.research/clickup-asana-motion.md`. Front A now 3 of 5. Two claims from it
  are queued as mandatory C-A4 spot-check targets because they are specific
  and load-bearing: Asana's public documentation is reported to expose a
  bypass flag named `##TemporarilyAllowAiTeammateMultihomingWithoutApproval`
  that "currently completely bypasses approval"; and ClickUp's "seek human
  approval" is reported to be a prompt-level soft gate rather than a system
  gate. If either fails verification the report's grade drops.
  (1) 14:5x Linear / Height, full report at `.research/linear-height.md`. Front
  A now 4 of 5. Height is not a live benchmark but an autopsy sample: its own
  archived notice gives a final day of service of 2025-09-24, and its
  "autonomous" claims reduce on inspection to *suggests* / *for review*. That
  is a warning sample, not a model to copy. Linear ships an AgentSession state
  machine and a per-session cost explorer but deliberately does not put money
  on the issue card and has no write-approval gate.
  D-log accuracy correction, appended not rewritten: the dispatch list above
  was written from the plan, not the execution. Only four research subagents
  were actually launched - (1) Linear + Height, (2) Notion + Monday.com,
  (3) ClickUp + Asana + Motion, (4) Devin + Jules + GitHub Copilot coding
  agent. Group (5), the China market, was recorded as dispatched and never
  was. That is a D-log accuracy failure. Group (5) is launched at 14:5x and
  the round stays IN FLIGHT until its report lands. Front A stands at 4 of 5
  at this instant, not 5 of 5.
  (5) 15:4x China market - Feishu Project (Meego) / ONES / PingCode /
  Teambition, full report at `assets/linked-gantt-board/.research/china-market.md`.
  **Front A is now 5 of 5.** Access blockers stated by the agent and accepted:
  `robots.txt` blocks `project.feishu.cn` outside `/b/`, search engines returned
  nothing for several probes, and the Aliyun llms.txt carries no Teambition
  entry. It counted 32 sources, 26 graded primary. Its central finding matches
  the other four groups from the other side of the market: nobody puts token or
  dollar cost on a task card or gantt bar. The finest cost granularity in the
  whole set is Feishu's admin-level per-invocation AI points.

- **C** Check: methods pre-declared here, run per front on completion.
  Front A: (1) section order and item counts per report, countable from the
  file; (2) landing-spot coverage over every Align item; (3) source URL count
  per report; (4) spot-verify three claims graded "primary" against their
  cited URL; (5) grep each report for the no-copy principle line; (6) read
  the synthesis and score it only if its three claims are supported by the
  reports and are differentiating rather than generic.
  Front B: (1) I reopen three of the reported `file:line` refs and confirm
  the quoted code matches the tree; (2) I re-grep the port constant and the
  data-dir join and confirm the patch list has no gap; (3) after any edit I
  run `python scripts/validate_skill.py` and require 14/14 with
  `CJK_COUNT=0`; (4) after applying, `tsc -p tsconfig.json` exits 0 and
  `dist/` matches a clean rebuild.
  Evidence rule: no pasted command output in Check means the entry is not done.
  Gap found and fixed during this verification, recorded per the ledger rule:
  the first draft of this entry carried Chinese text and broke the package CJK
  gate it had just declared. Measured before the fix:
  `python scripts/localize_check.py` -> `Text files scanned: 84 /
  CJK_COUNT=58`, file `docs/TASK-LOG.md`, `LOCALIZE_EXIT=1`;
  `python scripts/validate_skill.py` -> `13/14 checks passed; exit_code=1`,
  `[FAIL] no_cjk_in_packaged_text_files: cjk_count=58 in docs/TASK-LOG.md=58`.
  Two knock-ons also landed and were verified: `.research/` now sits in
  `EXCLUDE_DIRS` of both `scripts/validate_skill.py` and
  `scripts/localize_check.py`, and in `.gitignore`, so the Chinese competitive
  reports are not package content. Proof that the exclusion works:
  `.research/devin-jules-copilot.md` (22050 bytes) is on disk and the scan
  still reported 84 files with all 58 CJK hits attributed to
  `docs/TASK-LOG.md`, i.e. the research file was not scanned.
  After the fix, measured again:
  `python scripts/localize_check.py` -> `Text files scanned: 84 /
  CJK_COUNT=0`, `LOCALIZE_EXIT=0`;
  `python scripts/validate_skill.py` -> `14/14 checks passed; exit_code=0`.
  Intermediate run caught two leftover Chinese tokens (10 CJK) before the
  clean pass, so the gate was exercised three times, not asserted once.
  Fact-retention gate, section 11, applied to the English rendering of the
  human's constraint. Four sets extracted from the source and from the
  rewrite: numbers - source none, rewrite none, MATCH; dates - source none,
  rewrite none, MATCH; negations - source has 3 (not enough, not plagiarism,
  never copy), rewrite has 3 (not enough, not plagiarism, never copy), MATCH
  after the first draft dropped "not enough" and was corrected; conditions -
  source none explicit, rewrite none, MATCH. Comparison accepted only after
  the sets matched.

  FRONT A CHECK - mechanical counts produced by
  `.research/check-front-a.py` (deterministic; a model re-reading five reports
  and reporting numbers is not evidence). Pasted output:
  ```
  file | align | surpass | never | landing | effort | principle | urls | order
  .research/clickup-asana-motion.md | 10 | 6 | 5 | 10 | 10 | 9 | 41 | OK
  .research/devin-jules-copilot.md | 10 | 6 | 5 | 10 | 10 | 6 | 47 | OK
  .research/linear-height.md | 10 | 6 | 4 | 11 | 13 | 5 | 35 | OK
  .research/notion-monday.md | 10 | 6 | 5 | 10 | 10 | 6 | 35 | OK
  assets/linked-gantt-board/.research/china-market.md | 10 | 6 | 5 | 11 | 11 | 6 | 68 | OK

  TOTALS align=50 surpass=30 never-copy=24 urls=226
  REPORTS=5
  FRONT_A_MECHANICAL=PASS
  ```
  Against the locked criteria: (1) section order Align / Surpass / Never-copy
  holds in all five, and every count is inside its band - OK on every row;
  (2) landing-spot coverage is complete, landing >= align on all five;
  (3) 226 source URLs across five reports, 35 to 68 each; (5) every
  Never-copy item carries a principle line, principle >= never on all five.
  Two parsing gaps were found and fixed in the check itself, recorded here per
  the ledger rule: `### A1.` was counted as a section boundary, which truncated
  every span at the first item; and nested `1)` / `1. **bold**` sub-lists
  inside item bodies were counted as items. Both were corrected before the run
  above, and the corrected numbers are the ones pasted.
  (4) Spot-verification of the two claims I pre-registered as mandatory:
  **UNCERTAIN, both.** The cited help centres are JavaScript shells. A direct
  fetch of `help.asana.com/s/article/ai-teammates` returned 743831 bytes of
  Salesforce stub with zero occurrences of `TemporarilyAllow` or `approval`;
  a headless render of the same page returned `TEXT_BYTES=0`. An exact-token
  web search for `TemporarilyAllowAiTeammateMultihomingWithoutApproval`
  returned no results, and a search for ClickUp's quoted sentence
  `check with a person before taking action` returned no results. So neither
  claim can be confirmed and neither is refuted. Per the pre-registered rule
  ("if either fails verification the report's grade drops") the ClickUp /
  Asana / Motion report is downgraded on those two points and they are
  excluded from the synthesis. The report had already graded the ClickUp point
  itself as "not found in configuration documentation, needs live
  confirmation", which is consistent with what I found.
  (6) Synthesis: written to `docs/competitive-synthesis.md`, carrying four
  cross-report claims, each stated by at least two independent groups and
  contradicted by none: cost on the artifact rather than behind an admin wall;
  content adjudication with a mandatory written reject reason; parallel AI
  agents on one timeline with blocking signals; AI as a named owner with a
  declared scope. Four recurring Never-copy patterns are consolidated there,
  and six build items are ordered by value per unit of work.
- **A** Act: **Front A - PASS.** Criteria 1, 2, 3, 5 and 6 met with pasted
  evidence. Criterion 4 (invention gate) is where the gate bit: two claims
  could not be reproduced and were dropped rather than carried, which is the
  gate working as designed rather than a failure of the front. Promoted:
  `docs/competitive-synthesis.md` is now the canonical cross-competitor
  conclusion, and its six build items are the borrow list. Lesson for future
  briefs: a report that grades a claim "primary" must also record **how** the
  text was retrieved. Two of five reports read JS-only help centres, and when
  I came to re-check, a plain fetch could not see the body at all. Retrieval
  method is part of the evidence, not a footnote.
  **Front B: verification is in (defects 1-5 all PRESENT with file:line), but
  its Check is not run yet.** Per the non-goal the patch list is applied as its
  own entry with its own Check. Round verdict therefore remains pending.
  Lesson from the gap above, recorded now:
  the actor who writes a gate is the actor most likely to trip it. A
  declaration in a ledger is not compliance; run the gate on the ledger
  itself before trusting the declaration. Planned dispositions: Front A PASS
  promotes the synthesis into `docs/` and turns each borrowed principle into a
  named landing task; Front A FAIL names the lesson in the next brief.
  Front B PASS applies the patch list as its own entry with its own Check and
  leaves `docs/evidence/confirmatory/raw/R15.md` untouched as a historical
  record; Front B FAIL names the lesson. No round verdict is recorded here.

  **Close-out (2026-11-06, main session):** Front B's Check is **superseded
  by R19**. R19 applied exactly those five defect patches as its own entry
  with its own captured red and its own Check (PASS), which fulfils the
  disposition above; re-running a separate Front B Check would re-verify what
  R19 already proved. Front B's verification evidence (defects 1-5 PRESENT
  with file:line) stands unchanged. One open question is also settled here:
  `docs/evidence/confirmatory/raw/R16.md` keeps its absolute path
  byte-identical — a raw confirmatory record is evidence and is not edited
  after the run, the path is a project path with no user name in it, and the
  `no_absolute_personal_paths_or_credentials` gate reports leaks=0. Round
  verdict: **R17 closed** — Front A PASS (scored), Front B superseded by R19.

---

### 2026-11-06 14:5x R18 - panel UX round: send-where-you-type, sidebar, visual quality (IN FLIGHT; by: main session)

> Written BEFORE the code changes, so the acceptance criteria below cannot be
> retrofitted. C and A state methods, not results. No score until Act carries
> a verdict.

- **P** Plan: the human opened the shipped reference panel and rejected it on
  three counts, rendered from the original Chinese: "A sidebar is necessary.
  Also the example should look better - look at what others have made. I reply
  but there is nowhere to send it. What you made is no good." Root-cause check
  before any code was touched: `panel.html:58` puts `btnSend` on the Command
  desk tab only, and `src/ledger.ts:39` saves the reply on `change` with no
  send control at all. The send chain itself already exists and is reusable -
  `POST /api/snapshot`, `CP.copyText()`, `CP.createAckForSnapshot()`
  (`src/desk.ts:163-169`). The defect is that the Issue ledger never calls it.
  Acceptance criteria (locked now):
  1. Send-where-you-type: every issue row that carries a reply exposes a send
     action beside the reply cell. One click persists the reply, builds the
     command snapshot, copies it, and opens the ACK row. A human on the Issue
     ledger never changes tab to send. A control that only saves is FAIL.
  2. Sidebar: one persistent left sidebar serves all four views and carries
     navigation, the work-division owner roster, and a measured spend glance.
     It collapses. Any nav label or button carrying a digit or a live count =
     FAIL.
  3. Visual quality in both themes: sticky table headers, row hover plus
     focus-visible rings, tabular numerals on IDs / dates / money, a non-blank
     empty state, and one consistent spacing scale. Evidence is one screenshot
     per theme.
  4. Compatibility: every DOM id and selector asserted by `selftest.js` is
     preserved. A renamed id is FAIL.
  5. Theme tokens: dark `body` background stays `rgb(28, 28, 30)` and text
     `rgb(245, 245, 247)` exactly.
  6. Data contract unchanged: no handoff filename or field name changes,
     `data/*.json` untouched, no npm dependency added.
  7. Enabling sub-item: `scripts/verify.js` honours `PANEL_PORT` / `CDP_PORT`
     the way the other three entry points already do
     (`server.js:20`, `panel.js:14`, `selftest.js:22`), so verification can run
     beside a live panel instead of colliding with it. Defaults stay 4174 and
     9224.
  Non-goals: no new backend endpoint beyond what send already needs; no gantt
  maths change; no dependency-line feature (logged as follow-up, not built
  here); no commit unless the human asks.

  **Scope added by the human at 15:0x, after the criteria above were locked and
  while the work was in progress.** The human's words, rendered from the
  Chinese: "The web page should carry a clear first-principles marking of the
  project's purpose, its technical resources, and its evaluation." This is a
  new requirement, not a restatement of the three above, so it is appended
  here rather than folded into them. Acceptance criterion (locked now):
  8. First-principles charter: the page states three clearly labelled fields -
     Purpose, Technical resources, Evaluation - on every view, not on one tab.
     The values come from SQLite `meta` so each fork sets its own; an unset
     field shows an explicit "Not set" state rather than a blank or invented
     text. The Evaluation field states the method, never a live score, because
     a typed score rots. A hardcoded charter string in the HTML is FAIL.
     This criterion amends the non-goal above: one additive endpoint
     (`PUT /api/meta`) is now permitted for the charter and nothing else. The
     data contract is still untouched - no handoff filename or field name
     changes, and `data/*.json` still not written.
     Human clarification at 15:0x, recorded before any charter code was
     written: the Evaluation field is itself PDCA-iterative. Evaluation is not
     a one-shot score. Each round states its acceptance criteria first, checks
     with pasted evidence, and is scored PASS or FAIL, then the next round
     starts. So the Evaluation text must name PDCA iteration as the method,
     and must point at where the scores live instead of holding a score.

- **D** Do: done by the main session, no subagent. Under
  `assets/linked-gantt-board/`: `panel.html` (sidebar rail, first-principles
  charter strip, ledger send bar, ledger empty state), `src/desk.ts` (exports
  `sendSnapshot` / `buildSnapshot` so the Command desk and the Issue ledger run
  one send chain), `src/ledger.ts` (per-row Send control with a save-state
  label, ledger foot send and preview, empty-state toggle), `src/app.ts`
  (charter render and edit modal, sidebar roster and spend, rail collapse),
  `styles.css` (appended R18 block: rail, charter, send, sticky table heads,
  row hover, tabular numerals), `db.js` (`setCharter`, whitelisted to three
  charter keys so the door cannot touch command or handoff state),
  `server.js` (`PUT /api/meta`), `selftest.js` (eight new assertions, 41 -> 49),
  `dist/*` rebuilt with `tsc`. Enabling sub-item: `scripts/verify.js` now reads
  `PANEL_PORT` / `CDP_PORT` from the environment like the other three entry
  points already did, so a run can sit beside a live panel; defaults stay 4174
  and 9224. Design target came from the Linear / Height report that returned
  mid-round (`.research/linear-height.md`); its Board keyboard model and
  Timeline dependency lines are logged as follow-up, not built here. R17 Front B
  also returned mid-round and is logged against R17; its patch list is not
  applied here.
- **C** Check: methods pre-declared here. (1) paste the output of a headless
  click on a row send button, showing the copy path and the ACK row it created;
  (2) paste a grep proving no digit in any `#nav` label, plus the collapse
  test; (3) paste both theme screenshots and the theme-token assertion line;
  (4) paste the `node scripts/verify.js` PASS count on a free port; (5) paste
  `python scripts/validate_skill.py` and `python scripts/localize_check.py`
  output; (6) paste a `git diff --stat` proving `data/*.json` and the
  `package.json` dependency block are untouched. Evidence rule: no pasted
  command output in Check means the entry is not done.
  Evidence (main session, run after the code landed):
  C1 send-where-you-type, headless CDP click on a row Send control:
  `PASS  Every issue row exposes a Send control beside its reply cell ::
  {"x":854.3671875,"y":497.3125}` and
  `PASS  Row Send runs the whole chain: save reply, copy snapshot, open ACK ::
  copyPath=navigator acks 4 -> 5 toast="ISS-3 reply saved. Command snapshot
  copied (na"`.
  C2 sidebar:
  `PASS  Sidebar carries the work-division roster and measured spend ::
  {"rows":4,"cost":"$4.71","tokens":"221.1M billed"}` and
  `PASS  Sidebar collapses and nav labels still carry no digits ::
  {"on":true,"digits":0,"off":true}`.
  C3 visual quality in both themes:
  `PASS  prefers-color-scheme dark theme applies :: {"bg":"rgb(28, 28, 30)",
  "text":"rgb(245, 245, 247)"}` and
  `PASS  Filter matching nothing shows an explicit empty state, not a blank
  table :: {"shown":true,"rows":0,"text":"No issues match this filter."}`.
  Screenshots written by that run: preview-desk.png 146733 B,
  preview-plan.png 161814 B, preview-ledger.png 138498 B,
  preview-dark.png 146696 B.
  C4 compatibility and the whole suite: `Result: 49/49 passed` and
  `[verify] RESULT: PASS (exit 0)`. The 41 pre-existing assertions still pass
  unchanged, so no asserted id or selector moved.
  C5 package gates: `python scripts/localize_check.py` ->
  `Text files scanned: 84 / CJK_COUNT=0`, `LOCALIZE_EXIT=0`;
  `python scripts/validate_skill.py` -> `14/14 checks passed; exit_code=0`.
  C6 data contract: `git diff --stat -- assets/linked-gantt-board/data
  assets/linked-gantt-board/package.json` -> empty output. No handoff file,
  no field name and no dependency block changed.
  C7 charter, criterion 8:
  `PASS  Charter states Purpose / Technical resources / Evaluation on screen ::
  ["Not set.","Not set.","Not set."]` and
  `PASS  Charter values come from SQLite meta, not hardcoded HTML ::
  {"purpose":"TEST purpose line","resources":"TEST resources line",
  "evaluation":"TEST evaluation by PDCA iteration","side":"TEST purpose line"}`.
  The unset state renders the explicit string `Not set.`, never a blank.
  Three gaps were found and fixed during verification, recorded here per the
  ledger rule:
  (a) The row Send control inherited `.mini { width:26px; height:26px }` from
  the icon-button rule, so its label rendered as `Sen`. No assertion caught
  this. Reading the screenshot did. Fixed by resetting width and height on
  `.btn.send`.
  (b) Test strings leaked into the shipped preview screenshots, because the
  charter write test ran before the captures. Fixed by restoring labelled DEMO
  placeholder text after the assertion.
  (c) My new row-Send assertion first waited a fixed 800 ms. The send chain is
  async - snapshot POST, then clipboard, then ACK POST - so a fixed wait races
  it. Fixed by polling `window.__copyPath` with the existing `until()` helper.
- **A** Act: **PASS** for R18. All eight acceptance criteria met with pasted
  evidence. Promotion: the send chain is now one exported function shared by
  both surfaces, so a future surface inherits send instead of re-inventing it;
  the charter reads from SQLite `meta`, so a fork states its own first
  principles without touching code. Lessons: (1) a styling rule on one
  component leaks onto another through a shared class name and no assertion
  notices - the screenshot is part of the check, not decoration; (2) a fixed
  sleep inside an async test is a race dressed up as a wait; (3) a test that
  writes state must restore it before anything captures evidence. Score: the
  scoreboard moves +1. R18 improves the reference panel and does not execute
  the confirmatory A/B round, so dimension 10 is untouched and the 17.5/20
  figure stands. Follow-up recorded, not built: the Board keyboard model and
  Timeline dependency lines from the Linear report, and the two R17 Front B
  defects whose patch list is to be applied as its own entry with its own
  Check.
  `Re-check (main): PANEL_PORT=4184 node scripts/verify.js -> 49/49 passed, exit 0 — PASS`

---

### 2026-11-06 16:5x R19 - starter-kit defect fixes, five of them, each with a would-have-failed assertion (IN FLIGHT; by: main session)

> Written before any code change, so the criteria cannot be retrofitted.
> C and A state methods, not results. No score until Act carries a verdict.

- **P** Plan: R17 Front B verified five defects as PRESENT with file:line
  evidence and deliberately left them unfixed - its non-goal said
  "verification only; applying the fixes is a separate entry with its own
  Check". This is that entry. The human chose this work first over the
  task-relationship feature. Acceptance criteria (locked now):
  1. Every defect carries an apply-ready patch: file + line + before + after +
     why. A patch whose target must be re-derived is incomplete.
  2. Every fixed defect carries at least one assertion that **fails on the
     pre-fix tree and passes after**. The assertions are written first and run
     against the unfixed code so the red is captured as evidence; only then is
     the fix applied. A fix with no captured red is not verified.
  3. The five defects and their scope:
     (D1) billed unit mismatch in the work-unit modal - the field is labelled
     "billed (M tokens)" but is refilled with raw tokens, so a save without an
     edit multiplies spend by 1,000,000x;
     (D2) `alive()` in panel.js treats any 2xx on `/` as proof this service is
     already running;
     (D3) panel port configuration sprawl - one entry point still hardcodes the
     port where the other three read `PANEL_PORT`;
     (D4) selftest filesystem assertions read a different tree from the server
     when the two are not co-located, producing both false reds and false
     greens, plus a stale-data false green in the rejections assertion;
     (D5) the selftest click path relies on a fixed sleep while the send chain
     is asynchronous.
  4. D5 must NOT touch the toast. The "toast eats the click" theory is
     refuted: `.toast` carries `pointer-events: none`, so it cannot intercept
     a hit test. D5 must also NOT convert the CDP click into a DOM click - the
     clipboard fallback needs a real user gesture to be meaningfully tested.
  5. Gates after the patches: `tsc -p tsconfig.json` exits 0 and `dist/`
     byte-matches a clean rebuild; `node scripts/verify.js` all PASS on a free
     port with an assertion count no lower than the 49 it has now;
     `python scripts/validate_skill.py` 14/14; `CJK_COUNT=0`.
  6. Data contract unchanged: no handoff filename or field name change,
     `data/*.json` untouched, no npm dependency added.
  7. Frozen artifacts untouched: `docs/IMPROVEMENT-PLAN.md`,
     `docs/EFFECTIVENESS-EXPERIMENT-DESIGN.md`,
     `docs/evidence/effectiveness-freeze.json`,
     `docs/evidence/confirmatory/raw/R15.md`.
  Non-goals: no task-relationship feature - the human scoped that as the
  following round and it is deliberately out of scope here; no new endpoint
  except where D4 requires it; no commit unless the human asks.

- **D** Do: to be appended as the work lands.
- **C** Check: methods pre-declared here. (1) paste the five before/after
  patch rows; (2) paste the captured red for each new assertion, run against
  the pre-fix tree, then the green after; (3) paste the `node scripts/verify.js`
  result line and the assertion count; (4) paste
  `python scripts/validate_skill.py` and `python scripts/localize_check.py`
  output; (5) paste `git diff --stat` for `data/` and `package.json` showing
  they are untouched; (6) paste `git diff --stat` for the frozen files showing
  they are untouched. Evidence rule: no pasted command output in Check means
  the entry is not done.
  Evidence (main session; assertions were written first and run against the
  unfixed tree, so the red below is measured, not asserted):

  The five patches:
  ```
  D1 assets/linked-gantt-board/src/app.ts:81
     before: value="${t ? t.billed : 0}"
     after:  value="${t ? t.billed / 1e6 : 0}"
     why:    the field is labelled "billed (M tokens)" and onSubmit multiplies
             by 1e6, so refilling raw tokens made a save-without-edit inflate
             spend 1,000,000x.

  D2 assets/linked-gantt-board/panel.js:20
     before: const r = await fetch(URL, { signal: AbortSignal.timeout(800) }); return r.ok;
     after:  fetch(new URL('/healthz', URL)) and require body.service === 'command-panel'
     why:    any 2xx on "/" is not proof this service holds the port; another
             app can, and we would silently skip startup. server.js already
             returns the identity on /healthz, so no server change was needed.

  D3 scripts/verify.js:33
     before: const PORT = 4174;
     after:  const PORT = Number(process.env.PANEL_PORT || 4174);
     why:    the other three entry points read the environment; this one
             hardcoded the port and could not run beside a live panel.
     note:   this patch landed during R18 as its enabling sub-item, not here.

  D4 assets/linked-gantt-board/db.js (state + backup) and selftest.js
     before: state() returned no data_dir; backup() returned dir:'data/backups';
             selftest built paths from its own __dirname and matched rejections
             by the REJECT_REASON constant.
     after:  state() returns data_dir; backup() returns path + data_dir;
             selftest takes the paths from the API and matches THIS run's ack id.
     why:    a verifier that builds the path from its own location reads the
             wrong tree when the two are not co-located - false red on backup
             existence, false green on cleanup. The constant predicate also
             matched stale entries already in the file.

  D5 assets/linked-gantt-board/selftest.js (CDP click path)
     before: await sleep(500); then read window.__copyPath
     after:  scrollIntoView the button, take the rect, then poll __copyPath
             with the existing until() helper
     why:    the send chain is async (snapshot POST, then clipboard); a fixed
             wait races it and reports the previous value. The toast was NOT
             touched - the "toast eats the click" theory is refuted, since
             .toast carries pointer-events: none - and the click stayed a CDP
             click because the clipboard fallback needs a real user gesture.
  ```

  Captured red, run against the unfixed tree:
  ```
  FAIL  POST /api/backup writes a backup and reports where it is :: file=panel-...-1rec3.db path= bytes=69632
  FAIL  backup artifact removed after restore (runtime state never ships) :: path=
  FAIL  Service declares where its data lives (D4 precondition) :: data_dir=(absent)
  FAIL  Work-unit modal refills billed in the unit its label names (D1) :: {"id":"t1","stored":12400000,"field":12400000}
  FAIL  launcher identifies its own service before reusing a port (D2) :: healthz=false service=false
  FAIL  the clipboard-fallback click path waits for the chain, not a clock (D5) :: fixedSleepBetweenClickAndRead=true
  Result: 48/54 passed
  ```
  The D1 red states the defect in one line: the label says M tokens and the
  field held 12400000.

  Captured green after the patches:
  ```
  PASS  rejections.json records THIS run as a PDCA-style rejection entry :: ackId=ack_mw4ro6ab_33ekl matched=1 total=13
  PASS  Service declares where its data lives (D4 precondition) :: data_dir=F:\Papaer\ai-project-ops\assets\linked-gantt-board\data
  PASS  Work-unit modal refills billed in the unit its label names (D1) :: {"id":"t1","stored":12400000,"field":12.4}
  PASS  launcher identifies its own service before reusing a port (D2) :: healthz=true service=true
  PASS  every entry point takes the port from the environment (D3) :: server.js=env panel.js=env selftest.js=env verify.js=env
  PASS  the clipboard-fallback click path waits for the chain, not a clock (D5) :: fixedSleepBetweenClickAndRead=false
  Result: 54/54 passed
  ```
  The suite grew from 49 to 54 assertions and none of the previous 49 broke.

  Remaining gates:
  `python scripts/localize_check.py` -> `Text files scanned: 85 / CJK_COUNT=0`;
  `python scripts/validate_skill.py` -> `14/14 checks passed; exit_code=0`;
  `git diff --stat -- assets/linked-gantt-board/data
  assets/linked-gantt-board/package.json` -> empty (data contract and the
  zero-dependency block untouched);
  `git diff --stat -- docs/IMPROVEMENT-PLAN.md
  docs/EFFECTIVENESS-EXPERIMENT-DESIGN.md
  docs/evidence/effectiveness-freeze.json` -> empty (frozen artifacts
  untouched);
  `git diff --stat -- docs/evidence/confirmatory/raw/R15.md` -> empty (the
  historical run record untouched);
  clean-rebuild check: `dist` hashed before and after `rm -rf dist && tsc` ->
  `033b9d1cfd2f145d` both times, `DIST_MATCHES_CLEAN_REBUILD=YES`.

  Two honest deviations from criterion 2, stated rather than hidden:
  (a) **D3 carries no captured red**, because its fix landed in R18 as that
  round's enabling sub-item. What is asserted here is a regression guard
  (`every entry point takes the port from the environment`), which was already
  green. The red for D3 therefore does not exist and is not claimed.
  (b) **D4's stale-green is latent and was not turned red.** The old constant
  predicate is demonstrably wrong - the green run reports `matched=1 total=13`,
  so twelve pre-existing entries would satisfy it - but a normal run cannot
  make the old assertion fail, because the write does succeed. The red that
  was captured for D4 is the tree-coupling half (`data_dir` absent, backup
  `path` empty), which is the half that produces wrong results in practice.
- **A** Act: **PASS** for R19. Five defects fixed; four carry a measured red
  plus a measured green, one (D3) carries a regression guard because its fix
  landed in the previous round. Assertion count rose 49 -> 54 with no
  regression. Promotion: the pattern "write the assertion first, capture the
  red, then patch" is now the way a defect is closed in this repo - it is what
  turned "save-without-edit inflates a million-fold" from a claim into one
  line of output. Lessons: (1) a path a verifier builds itself is a bug
  waiting for the two processes to separate - ask the owner where the data
  is; (2) a predicate that matches a constant is not a test of the current
  run, and the fix is to match the id this run created; (3) a fixed sleep in
  front of an async chain is a race that only looks like a wait; (4) a
  refuted theory must not be patched - the toast was left alone because the
  evidence said it could not intercept a hit test.
  Score: scoreboard moves +1. The task-relationship layer the human asked for
  (parent/child tree, dependency lines, baseline compare, critical path) is
  the next round and was deliberately not started here.
  `Re-check (main): PANEL_PORT=4184 node scripts/verify.js -> 54/54 passed, exit 0 — PASS`

---

### 2026-11-06 17:2x R20 - task relationship layer: parent/child, dependency edges, baseline, critical path (IN FLIGHT; by: main session)

> Written before any code change. C and A state methods, not results.

- **P** Plan: the human asked whether task-to-task relationships and a
  parent/sub-task split exist in the template. They do not - `templates/` has
  zero mentions and `Task` has no `parent_id` and no edge field. The only
  graph in the package is `module-deps`, which links modules, not tasks. The
  human then chose the full scope: parent/child tree, dependency links,
  baseline compare, critical path. These are the top three borrow items from
  the competitive synthesis (Linear / PingCode / ONES dependency lines,
  baseline snapshot vs actual, critical path). Acceptance criteria (locked
  now):
  1. Data model, additive only: `parent_id` on tasks; a `task_deps` relation
     with `from_id`, `to_id` and `type` in {FS, SS, FF, SF}; `baseline_start`
     and `baseline_end` on tasks. No existing field renamed, no handoff
     filename or field name touched, `data/*.json` untouched, zero npm deps.
  2. Violation rule is code, not a look. For type FS a successor starting
     before the predecessor ends is violated; SS requires the successor to
     start no earlier than the predecessor starts; FF requires the successor
     to end no earlier than the predecessor ends; SF requires the successor to
     end no earlier than the predecessor starts. An edge renders RED when
     violated and BLUE when not. The rule must be one pure function, and it
     must be asserted with cases for all four types in both states.
  3. Baseline: one action stores `baseline_start` / `baseline_end` for every
     task that has a window; the gantt renders a grey ghost bar per task that
     holds a baseline, behind the real bar; a task without a baseline renders
     no ghost. The snapshot is idempotent and overwrites.
  4. Critical path: computed over the dependency graph with a forward and a
     backward pass on active, non-placeholder tasks; zero total float marks
     the critical set. The computation must be a pure function with its own
     assertions (a linear chain, a diamond with one long path, and a task with
     slack). A toggle dims non-critical bars. Disconnected tasks are not
     critical.
  5. Parent/child: a task may name a parent; the board card shows it; the
     gantt groups children under their parent's lane. The linked-drag
     signature interaction must not break - one dataset, both surfaces.
  6. Regression: `node scripts/verify.js` all PASS with an assertion count at
     or above 54, and every pre-existing assertion still passing (hour axis,
     cost-first label, NOW line, linked drag, ACK loop, reload persistence).
  7. Same discipline as R19: assertions for the new behaviour are written
     first and their red captured where a red is meaningful. Where a red is
     not achievable it is stated, not invented.
  8. Gates: `tsc -p tsconfig.json` exit 0 and `dist/` matches a clean rebuild;
     `python scripts/validate_skill.py` 14/14; `CJK_COUNT=0`.
  Non-goals: drag-to-link edge creation (edges come from the API for now),
  lag offsets, bump-chains on drag, undo, and any change to the ACK gate or
  the cost-first label. Those are named follow-ups.

- **D** Do: to be appended as the work lands.
- **C** Check: methods pre-declared here. (1) paste the pure-function
  assertion output for the violation rule covering all four types in both
  states; (2) paste the critical-path assertion output for the three shapes;
  (3) paste the captured red for the new assertions, then the green;
  (4) paste `node scripts/verify.js` result and the assertion count;
  (5) paste `python scripts/validate_skill.py` and
  `python scripts/localize_check.py` output; (6) paste `git diff --stat` for
  `data/` and `package.json` showing they are untouched; (7) paste the
  clean-rebuild hash comparison. Evidence rule: no pasted output in Check
  means the entry is not done.
  Evidence (main session):
  (1) Violation rule, all four types in both states, asserted through the pure
  function rather than eyeballed on a line:
  ```
  PASS  Precedence violation rule holds for all four types in both states :: ["FS:true","FS:false","SS:true","SS:false","FF:true","FF:false","SF:true","SF:false"]
  ```
  Eight cases: each type violated and each type satisfied, with touching
  treated as legal (a successor starting exactly when the predecessor ends is
  back-to-back, not late).

  (2) Critical path, three shapes:
  ```
  PASS  Critical set: chain is whole, long arm wins, a task with no edge never is ::
        {"chain":["a","b","c"],"diamond":["a","c","d"],"disconnected":["a","b"]}
  ```
  The linear chain is whole; in the diamond the long arm wins and the short
  arm carries float; a task with no edge is excluded. One honest correction
  made to the assertion itself, recorded here per the ledger rule: the first
  draft expected `["a"]` for the third shape. That was wrong - `a -> b` is
  itself a tight chain with no slack, so both are critical and the point of
  the case is that the unlinked task `z` never appears. The code was right
  and the expectation was not. The assertion now states both facts.

  (3) Captured red. First run failed fatally, which is itself the evidence
  that the layer was not wired:
  ```
  Verification failed:  Error: Uncaught TypeError: CP.criticalIds is not a function
      at patchGantt (dist/gantt.js:88:25)
  ```
  `dist/graph.js` was built but never added to the script list in
  `panel.html`. Fixed, then the assertions ran and produced three reds:
  ```
  FAIL  Critical set: ... :: {"chain":["a","b","c"],"diamond":["a","c","d"],"disconnected":["a","b"]}
  FAIL  A parent that does not exist is refused, not stored (R20) :: status=200 parent=no-such-task
  FAIL  A cyclic dependency is refused, not stored (R20) :: status=200 stored=true
  Result: 57/60 passed
  ```
  The last two were genuine gaps in the write path I had just written: an
  unknown parent was stored, and an edge closing a cycle was stored.

  Green after the fixes:
  ```
  PASS  A parent that does not exist is refused, not stored (R20) :: status=400 parent=undefined
  PASS  A cyclic dependency is refused, not stored (R20) :: status=400 stored=false
  PASS  Freeze baseline stores a plan window on every scheduled unit :: api={"ok":true,"snapshotted":15}
  PASS  Gantt draws precedence edges and baseline ghosts :: {"edges":1,"violated":1,"ghosts":15}
  Result: 60/60 passed
  ```
  54 -> 60 assertions, and every pre-existing assertion still passes: hour
  axis, cost-first label, NOW line, linked drag, ACK loop, reload
  persistence, the R18 sidebar/charter/send work and all five R19 defect
  guards.

  Remaining gates:
  `python scripts/localize_check.py` -> `Text files scanned: 87 / CJK_COUNT=0`;
  `python scripts/validate_skill.py` -> `14/14 checks passed; exit_code=0`;
  `git diff --stat -- assets/linked-gantt-board/data
  assets/linked-gantt-board/package.json` -> empty;
  clean rebuild: `dist` hashed before and after `rm -rf dist && tsc` ->
  `3481902c92b645e1` both times, MATCH.

  Three boundaries stated rather than hidden:
  (a) The two pure functions (`depViolated`, `criticalIds`) were implemented
  before their assertions were written, so their specific red is not
  captured. What is captured is the red of the layer as a whole - it did not
  load at all until `graph.js` was wired - plus the two real gaps the
  assertions found in the write path.
  (b) The DEMO dataset carries no relationships. `data/demo-seed.json` is a
  protected file and was not edited, so the rendering is proven by an edge
  the test creates and then deletes, not by demo content.
  (c) Authoring edges has no panel UI yet. That was a locked non-goal for
  this round: edges come from `PUT /api/task-deps` for now.
- **A** Act: **PASS** for R20. The relationship layer now exists end to end:
  `parent_id` for the tree, `task_deps` with the four precedence types, a
  frozen baseline window, and a critical set computed by a forward and a
  backward pass. The violation rule is a pure function asserted across all
  eight cases, so a red or a blue on the chart is a rule, not an impression.
  Lessons: (1) a new module that is not in the script list fails loudly at
  first render - wiring is part of the deliverable, not a detail; (2) write
  the assertions against the code you just wrote too, not only against the
  feature you planned - two of the three reds were defects in my own new
  write path; (3) an expectation in a test can be the wrong thing, and the
  correct move is to say so in the ledger rather than quietly change it.
  Score: scoreboard moves +1. Named follow-ups: drag-to-link edge authoring,
  lag offsets, bump-chains on drag, and seeding the demo with a relationship
  once the demo data is open for change.
  `Re-check (main): PANEL_PORT=4184 node scripts/verify.js -> 60/60 passed, exit 0 — PASS`

---

### 2026-11-06 18:0x R21 - authoring on the canvas: drag-to-link, bump cascade, lag (IN FLIGHT; by: main session)

> Written before any code change. C and A state methods, not results.

- **P** Plan: R20 built the relationship layer but left authoring to the API,
  which the human correctly called out as unusable from the panel. The human
  set the order: drag-to-link first, then bump-chains on drag, then lag.
  Acceptance criteria (locked now):
  1. Drag-to-link. Hovering a bar reveals a link dot at each end. Dragging
     from a dot to another bar creates exactly one edge. The precedence type
     is derived from which two ends met, with no menu: right -> left is FS,
     left -> left is SS, right -> right is FF, left -> right is SF. Escape
     cancels a half-made link. A drag that ends on empty space creates
     nothing and leaves no trace. Clicking a dependency path asks for
     confirmation and deletes that edge. The link dot must not swallow the
     existing resize handles, which stay live at the same edge.
  2. Bump cascade. Dragging a bar that would break a successor constraint
     moves that successor by the minimum amount that restores the constraint,
     recursively. The cascade must terminate on a cycle-safe visited set, must
     never move a placeholder bar, and must be persisted - not only drawn.
  3. Lag. `task_deps.lag` is an integer hour offset that may be negative
     (a lead). It participates in both the violation rule and the
     critical-path bound: for FS the successor may not start before the
     predecessor's end plus the lag. The pure-function assertions extend to
     positive lag and negative lag.
  4. The pure functions stay pure and are asserted for four types now crossed
     with lag.
  5. Regression: every one of the 60 existing assertions still passes, and
     the count is at or above 63.
  6. Gates: `tsc -p tsconfig.json` exit 0 and `dist/` matches a clean rebuild;
     `python scripts/validate_skill.py` 14/14; `CJK_COUNT=0`.
  Non-goals: undo, multi-select drag, auto-layout of a dragged subgraph, and
  any change to the ACK gate or the cost-first label.

- **D** Do: to be appended as the work lands.
- **C** Check: methods pre-declared here. (1) paste the pure-function
  assertion output for the four types crossed with positive and negative lag;
  (2) paste a headless drag that creates an edge from each of the four end
  pairings, with the resulting type in the store; (3) paste a headless drag
  that forces a violation and show the successor moved and the change was
  persisted; (4) paste the edge-deletion result; (5) paste
  `node scripts/verify.js` with the assertion count; (6) paste the validator
  and localize output; (7) paste the clean-rebuild hash comparison. Evidence
  rule: no pasted output in Check means the entry is not done.
  Evidence (main session):
  (1) Lag, nine cases crossing the four types with a positive and a negative
  offset:
  ```
  PASS  Lag shifts the bound: positive lag tightens, negative lag is a lead ::
        ["FS+2:true","FS+2:false","FS-2:false","SS+3:true","SS+3:false","FF+1:true","FF+1:false","SF+2:true","SF-3:true"]
  ```
  One correction to my own case, recorded per the ledger rule: the first
  draft asked for `SF+2` to be violated with a successor ending 11:00 against
  a bound of 10:00. That successor is not late, so the code was right and the
  expectation was wrong. The case now ends 09:30 and genuinely violates.

  (2) The cascade as a pure function:
  ```
  PASS  Drag repair slides each dependant by the least amount, in order ::
        ["b@2026-11-05T14:00","c@2026-11-05T18:00"]
  ```

  (3) Canvas authoring - a real pointer drag per pairing, no menu:
  ```
  PASS  Dragging end-to-end authors the edge, and the two ends pick the type ::
        stored=["FF","FS","SF","SS"]
        mid=[{"preview":true,"dropHits":"t_w2553aw"},{"preview":true,"dropHits":"t_4v92rxg"},
              {"preview":true,"dropHits":"t_gntq3e9"},{"preview":true,"dropHits":"t_zn3zpaz"}]
  ```
  right->left gave FS, left->left SS, right->right FF, left->right SF.

  (4) The cascade on a real drag, and it is persisted:
  ```
  PASS  Dragging a bar slides its dependant along, and the move is persisted ::
        from 2026-11-06 19:00 -> 2026-11-10T01:00 | to 2026-11-06 23:00 -> 2026-11-10T03:00
        | toast=Bumped t_g71371c to keep its dependency
  ```

  (5) `Result: 64/64 passed` - the suite grew 60 -> 64 and every earlier
  assertion still passes, including all five R19 defect guards and the R20
  relationship checks.
  (6) `python scripts/localize_check.py` -> `87 files / CJK_COUNT=0`;
  `python scripts/validate_skill.py` -> `14/14, exit_code=0`.
  (7) `git diff --stat -- assets/linked-gantt-board/data
  assets/linked-gantt-board/package.json` -> empty; clean rebuild ->
  `d0f54928d97ff631` both times, MATCH.

  What went wrong along the way, kept because it is the lesson: the canvas
  test failed four times and every failure was in the test's geometry, not in
  the product. `scrollIntoView` moved the outer page and invalidated the
  coordinates just measured; `offsetTop` on a bar is its inset inside its own
  track, not its lane position, so the scroll arithmetic was nonsense; and the
  probe bars sat at x ~ 2800, far outside a 1440px viewport, so the pointer
  events landed on nothing. The turning point was printing the measured
  coordinates and the element under the cursor instead of guessing. Also worth
  keeping: `store.commit` swallows errors and only toasts, so a failing write
  is silent unless the toast is read.
- **A** Act: **PASS** for R21. The panel can now author relationships from the
  canvas: drag between two ends and the precedence type follows from which
  ends met; drag a bar and its dependants follow; lag is part of both the
  verdict and the critical path. Lessons: (1) when a UI test fails repeatedly,
  print the geometry - coordinates and the element under the cursor - before
  touching product code; (2) `offsetTop` is measured against the nearest
  positioned ancestor and is rarely the number you want; (3) a helper that
  swallows errors and reports through a toast is invisible to a test unless
  the test reads the toast; (4) an assertion can be the wrong thing and the
  honest move is to say so. Score: scoreboard moves +1. Named follow-ups:
  undo, multi-select drag, auto-layout, and seeding the demo with a
  relationship once the demo data is open for change.
  `Re-check (main): PANEL_PORT=4184 node scripts/verify.js -> 64/64 passed, exit 0 — PASS`

---

## R22 — Parent/sub-task tree: authoring, cycle guard, depth display

- **P** Plan: The human signed off four relationship scopes; R20/R21 delivered
  dependency links, baseline and critical path. The fourth scope, the
  parent/sub-task tree, was only half done: `parent_id` existed in the data
  model but there was no way to assign a parent from the panel (the same
  API-only defect the human rejected for edges), no guard against a parent
  cycle, no parent-exists check on create, and no depth display on any
  surface. Acceptance criteria, locked before the red run: (1) depth and
  ancestor lookup exist as pure functions, asserted on a 3-node chain;
  (2) both cycle shapes — root under its own grandchild, middle node under
  its own child — are refused 400 and nothing is stored; (3) POST with an
  unknown parent_id is refused 400; (4) the edit form offers a parent choice,
  excludes the task itself and its descendants, and the choice reaches
  SQLite; (5) both surfaces indent by depth (card margin and gantt label
  padding driven by one `--depth` custom property); (6) the shipped
  screenshots capture the unfiltered board, not the test filter. Non-goals:
  cost rollup from children to parent; seeding the demo data with a
  relationship (the demo JSON files are frozen).
- **D** Do: Assertions written first in selftest.js (section 22) and run red
  against the pre-fix tree. Patch: `graph.ts` gains `taskDepth` /
  `hasAncestor` (parent-chain walks with a visited set, so a corrupt loop
  cannot hang the UI); `db.js` gains `parentReaches`, an updateTask cycle
  guard, and createTask parent-exists validation; `app.ts` adds the
  "Part of (parent)" select (self and descendants excluded by
  `hasAncestor`) and sends `parent_id` on submit; `board.ts` and `gantt.ts`
  publish `--depth`; `styles.css` derives both indents from it. Harness
  hardening: a page-identity guard compares `document.title` with this
  package's own `panel.html` and refuses to run any assertion on a foreign
  page. Files: src/graph.ts, src/app.ts, src/board.ts, src/gantt.ts,
  db.js, styles.css, selftest.js.
- **C** Check: red run on the pre-fix tree (`PANEL_PORT=4184 node selftest.js`):

  ```
  FAIL  Parent maths is pure and testable: depth and ancestor lookup (R22) :: CP.taskDepth / CP.hasAncestor not exported
  FAIL  A parent cycle is refused, not stored (R22) :: cycle1=200 cycle2=200 stored parent=["t_87xy4op","t_87xy4op"]
  FAIL  A new task cannot point at a parent that does not exist (R22) :: status=200 body={"id":"t_03nfxwx",...,"parent_id":"t_missing_parent",...}
  FAIL  The panel can assign a parent - the tree is authorable, not API-only (R22) :: modal={"missing":true} set={"missing":true} stored=
  FAIL  Parent and child are indented by depth on both surfaces (R22) :: {"dR":"","dC":"","dG":"","mlR":0,"mlC":0,"mlG":0,"barDepth":"","labelPad":10}
  ```

  The cycle line is the finding: the pre-fix store accepted a grandchild as
  parent of its own root and stored the loop. (That run also showed 3 further
  FAILs in count assertions; those were probe rows left by an earlier crashed
  run, i.e. test residue, not product — expectations were not changed, the
  runtime DB was reset instead.) Green run after the patch:

  ```
  PASS  Parent maths is pure and testable: depth and ancestor lookup (R22) :: {"d0":0,"d1":1,"d2":2,"ca":true,"ac":false,"self":false}
  PASS  A parent cycle is refused, not stored (R22) :: cycle1=400 cycle2=400 stored parent=["","t_nkrw06r"]
  PASS  A new task cannot point at a parent that does not exist (R22) :: status=400 body={"error":"parent not found: t_missing_parent"}
  PASS  The panel can assign a parent - the tree is authorable, not API-only (R22) :: modal={"opts":18,"hasChild":true,"hasSelf":false} set={"set":"t_jf6ed40"} stored=t_jf6ed40
  PASS  Parent and child are indented by depth on both surfaces (R22) :: {"dR":"0","dC":"1","dG":"2","mlR":0,"mlC":14,"mlG":28,"barDepth":"2","labelPad":28}
  PASS  Shipped screenshots capture the unfiltered board (R22) :: gbar rows at capture: 18
  Result: 71/71 passed; screenshots preview-desk.png / preview-plan.png / preview-ledger.png / preview-dark.png
  ```

  Gates: `CJK_COUNT=0` (87 text files); `validate_skill: 14/14 checks
  passed; exit_code=0` (after clearing runtime panel.db); clean-rebuild hash
  `3f5e0603826b79e6` twice; `git diff --stat` over data/ + package.json empty.
- **A** Act: **PASS** for R22. The tree is authorable from the panel, shown
  on both surfaces, and cannot be corrupted through the API. Two lessons.
  (1) The first red run tested a foreign app: another project (Lean4M) had
  taken port 4174 and serves a forked panel whose /healthz also says
  `service=command-panel`, so the suite ran most of its assertions against
  the wrong UI before crashing. Port identity is not app identity — the suite
  now compares `document.title` with this package's own panel.html and
  refuses to continue on mismatch. (2) A crashed run leaves probe rows in the
  shared DB and the next run's count assertions go red on that residue; reset
  runtime state (panel.db) before recording a verdict and never bend
  expectations to fit residue. Score: +1. Named follow-ups still open: cost
  rollup from children to parent, undo, multi-select drag, auto-layout,
  seeding one demo relationship once the demo JSON is open for change.
  `Re-check (main): PANEL_PORT=4184 node selftest.js -> 71/71 passed — PASS`

---

## R23 — release push audit: staged-set gate, remote history check, commands

- **P** Plan: the batch (panel R18-R22, docs, scripts, templates, references)
  goes to GitHub `chiangchenghsin-hash/ai-project-ops` via terminal git. The
  human executes; this entry audits the content and issues the commands.
  Acceptance criteria, locked before the audit: (1) `.gitignore` covers
  `data/panel.db*`, `panel.pid`, `data/backups/`, `data/rejections.json` and
  ships in the batch; (2) the staged set contains zero runtime-state files;
  (3) `data/*.json` demo handoffs and the four frozen docs
  (IMPROVEMENT-PLAN.md, EFFECTIVENESS-EXPERIMENT-DESIGN.md,
  effectiveness-report.template.md, evidence/effectiveness-freeze.json) have
  no edits mixed into the batch; (4) the four preview PNGs ride along in the
  staged set (git carries binaries; only the GitHub MCP could not); (5) the
  push commands match the real remote state — history relatedness checked
  before recommending a plain push vs a force push. Non-goal: executing the
  push (the human runs it) and re-verifying R16 (settled in the R17
  close-out: raw record stays byte-identical).
- **D** Do: read-only inspection of `.gitignore`, `git status --porcelain`,
  `git remote -v`, `git branch -a`; GitHub API reads of the remote branch and
  commit list; ledger close-outs (R17 superseded-by-R19, R16 path decision).
  No file outside docs/TASK-LOG.md was changed by this entry.
- **C** Check:

  ```
  $ git status --porcelain
   M README.md
   M SKILL.md
   M references/metering.md
   M references/panel.md
  ?? .gitignore
  ?? CHANGELOG.md
  ?? assets/
  ?? docs/
  ?? references/error-codes.md
  ?? references/evidence-matrix.md
  ?? references/linked-board-reference.md
  ?? references/packaging-spec.md
  ?? references/pdca-three-state.md
  ?? references/response-style-ste100.md
  ?? scripts/
  ?? templates/

  $ git remote -v          -> empty (no origin wired yet)
  $ git branch -a          -> * master
  $ ls assets/linked-gantt-board/*.png
  preview-dark.png  preview-desk.png  preview-ledger.png  preview-plan.png
  ```

  `.gitignore` (on disk, governs staging even while untracked) lists
  `assets/linked-gantt-board/data/panel.db{,-shm,-wal}`, `data/panel.pid`,
  `data/backups/`, `data/rejections.json`. Remote state via API: branch `main`
  only, tip `d070454` ("chore: remove base64 probe artifact"), and local
  `dd4fbd9` returns `422 No commit found` on that repo — the remote history
  is MCP-authored and **not related** to the local history, so a plain
  `git push` will be rejected and a force push (or an unrelated-histories
  merge) is required. Demo JSON and frozen docs: not edited this session; the
  session's writes were selftest.js, src/*.ts, db.js, styles.css, this
  ledger, and runtime/gate artifacts only.
- **A** Act: **PASS** for the audit: all five criteria verified, and the
  push commands were issued to the human with the force-push branch of the
  decision made explicit (remote main is a stale MCP-upload subset; local is
  the source of truth). One operational warning recorded for the re-check:
  a stale `GH_TOKEN` environment variable overrides `gh auth login` and
  reproduces the earlier 401, so the token must be removed from the
  environment before authenticating. Score: +1.
  `Re-check (main): git push -u --force origin master:main -> 1c355e4 forced onto origin/main (86 files, 4 PNGs included; remote tip and preview-dark.png verified via API) — PASS`

---

### 2026-11-08 09:50 C4 - new execution freeze (by: main session)
- **P** Plan: run the confirmatory no-skill round under a NEW freeze id.
  Acceptance: design freeze untouched, pre-registered before any data,
  dimension-10 scoring rule locked before scoring, blind map seeded, hashes
  anchored outside the freeze file.
- **D** Do: created `docs/evidence/confirmatory/freeze-exec.json`,
  `freeze-exec-manifest.json`, `blind-map.json` (16 labels, seed 20261105),
  and `rater-rubric.md`. No frozen C2 artifact was edited.
- **C** Check: 4 frozen SHA-256 re-checked -> all MATCH before execution:
  `design freeze MATCH True`, `exec freeze MATCH True`,
  `DOC docs/IMPROVEMENT-PLAN.md MATCH`,
  `DOC docs/EFFECTIVENESS-EXPERIMENT-DESIGN.md MATCH`.
- **A** Act: **C4 correction recorded; not scored** (a correction is not a
  scored task). Lesson carried forward: an execution round needs its own id;
  reusing a design freeze would let "design done" be mistaken for "data seen".

---

### 2026-11-08 10:45 C4 - confirmatory A/B execution and verdict (by: main session, 16 subagent sessions + 2 blind raters)
- **P** Plan: 8 frozen paired cards, 16 independent sessions, 2 blind raters,
  conservative arbitration, exact randomization test over 256 assignments,
  three-cell verdict. Acceptance = raw outputs and scores persisted,
  recomputation script exit 0, verdict applied from the frozen rules.
- **D** Do: 16 raw outputs R01..R16; 2 blind score files; main-session
  unblinding, `analysis.json`, `recompute.py`, `report.json`,
  `round-status.json`, `references/effectiveness.md`. E08 pre-check found the
  token `experiment` only inside the frozen filename
  `EFFECTIVENESS-EXPERIMENT-DESIGN.md`; not a marker.
- **C** Check: `python docs/evidence/confirmatory/recompute.py` ->
  `PASS  rater disagreement count = 2 (R01,R12)`,
  `PASS  paired differences = [0, 1, 0, 0, 1, 0, 0, 1]`,
  `PASS  T_obs = 3 over 2^8 = 256 assignments`,
  `PASS  exact one-sided p = 0.125000 ; alpha = 0.05`,
  `PASS  failure cells E10 = C2,C4`,
  `PASS  leave-one-out p range = 0.125000 .. 0.250000`,
  `VERDICT UNCERTAIN`, `RECOMPUTE_MATCH PASS`, `RECOMPUTE_EXIT=0`.
  `node scripts/verify.js` -> `Result: 71/71 passed`, `RESULT: PASS (exit 0)`.
  V1 drift recorded honestly: external commit `1c355e4` (2026-11-06) added
  `src/graph.ts` and grew the shipped selftest from 41 to 71 assertions
  between the C2 freeze and this round; frozen artifacts were untouched, so
  the round is not void, but comparability with the C2 release state is weaker.
- **A** Act: **UNCERTAIN — not scored** (per header rule, only PASS/FAIL
  verdicts enter the scoreboard). Three independent reasons: 2 rater
  disagreements, p = 0.125 > 0.05, E10 failure cells. No veto fired. The
  pre-locked dimension-10 rule is applied as written: 1.5 -> 2.0, total
  **18.0/20**. This score measures evidence availability, NOT demonstrated
  skill effectiveness; the effect question remains UNCERTAIN. Structural gap
  found during analysis (belongs in Check): with n=2 per cell the minimum
  per-cell p is 0.25 > 0.05, so PASS is unreachable at cell level. Fix only
  under a NEW C5 freeze id with >= 3 pairs per cell. No retest, no rubric
  change, no post-hoc rewording.

---


---

### 2026-11-08 C5 machine-enforced discipline (tier M, by: main session)

- **P** Plan: one human report from real usage — "the AI never updates the
  issue ledger, discipline is poor, software engineering is barely used, the
  plan template is skipped, task relationships are weak". Root cause found by
  inspection: `db.js:452` exports `updateIssue` but `server.js` has no
  `/api/issues` route and no agent-side CLI; `scripts/` had zero hooks and zero
  invariants; `SKILL.md` section 8 never listed `templates/`; section 7 said
  "(optional)". Acceptance (locked before the fix): (1) an offline agent-side
  issue path exists and all six reported defects are registered with replies;
  (2) a Stop gate blocks a skipped turn with exit 2 and passes a compliant turn
  with exit 0, proven by a negative control; (3) templates are instantiated by
  a command, not handwritten; (4) section 7 defaults ON and the gate recomputes
  the dependency DAG; (5) no frozen artifact is edited, no rubric changes, the
  score stays 18.0/20. Non-goals: no edit to user-global settings.json, no UI
  dependency lines (I-006 stays OPEN), no C4 re-test, no new subagent package.
- **D** Do: main session only, no subagent — this round's defect was precisely
  "delegated work never gets verified", so delegating again would reproduce it.
  New: `scripts/issue.js`, `session-start.js`, `discipline-gate.js`,
  `scaffold.js`, `selftest-discipline.js`, `merge-hooks.py`, `package.py`;
  `templates/PLAN.template.md`; `hooks/settings.fragment.json`, `hooks/INSTALL.md`;
  `docs/DISCIPLINE-INVARIANTS.md`, `docs/DISCIPLINE-ISSUES.md`;
  `docs/evidence/issues.json`. Changed: `SKILL.md` (v1.4.0, section 7 default
  ON, section 8 scaffold mandate, new section 12, description triggers),
  `README.md`, `CHANGELOG.md`. Six issues I-001..I-006 registered via the new
  CLI; five closed, I-006 left open with a PARTIAL reply. No product code under
  `assets/` was touched.
- **C** Check: real command output, pasted.
  - `node scripts/selftest-discipline.js` -> `DISCIPLINE SELFTEST: 12/12 passed  RESULT: PASS`,
    `SELFTEST_EXIT=0`; skipped turn -> `exit=2`, `FAIL I1/I2/I3`, fix hint present;
    compliant turn -> `exit=0`, `I1=PASS I2=PASS I3=PASS I4=PASS I5=PASS I6=PASS`.
  - `python scripts/validate_skill.py` -> `VALIDATE_EXIT=0`,
    `38 links / 53 md files; broken=0`, `cjk_count=0`, `leaks=0`;
    `validation_scripts_have_headers=ok`.
  - `python scripts/localize_check.py` -> `Text files scanned: 117`,
    `CJK_COUNT=0`, `LOCALIZE_EXIT=0`.
  - `python -m py_compile scripts/merge-hooks.py scripts/package.py ...` -> `PYCOMPILE_EXIT=0`;
    `node --check` on five new scripts -> `NODE_CHECK_EXIT=0`.
  - `python scripts/merge-hooks.py --target <GLOBAL_SETTINGS>` ->
    `FAIL global target blocked`, `GLOBAL_GUARD_EXIT=2` (expected: the guard works).
  - `node scripts/verify.js` on the default port -> `RESULT: FAIL (exit 1)`,
    `EADDRINUSE :::4174`, and `FAIL Page identity ... got="G9N9N ... Command Desk"`.
    This is an ENVIRONMENT conflict, not a regression: another project owns 4174
    and the selftest's first-line guard correctly refused to test a foreign page.
    The foreign service was NOT touched (`4174 still serving: 200`).
  - `PANEL_PORT=4184 CDP_PORT=9234 node scripts/verify.js` ->
    `Result: 71/71 passed`, `RESULT: PASS (exit 0)`,
    `0 JS exceptions / console errors`.
  - `python docs/evidence/confirmatory/recompute.py` -> `VERDICT UNCERTAIN`,
    `RECOMPUTE_MATCH PASS`, `RECOMPUTE_EXIT=0`; four frozen hashes all `True`.
- **A** Act: PASS. Lesson carried into later briefs: prose discipline is
  optional at runtime; a management-cost skill only works when the cost is
  enforced by a start injection, a write path and a blocking Stop gate. A gate
  needs a negative control, or it is decoration. The first E2E FAIL is retained
  above rather than hidden: it proves the foreign-page guard has discrimination.
  The 18.0/20 score and the UNCERTAIN effectiveness verdict are unchanged —
  this round improves enforcement, not evidence of skill effectiveness.

Re-check (main): `node scripts/discipline-gate.js` -> I1..I6 PASS, I7 GREEN, I8 freeze hash=MATCH, `DISCIPLINE GATE PASS (6 hard / 2 soft)`, `GATE_EXIT=0` — PASS. Scoreboard PASS 13 / FAIL 1. The 18.0/20 rubric score is NOT changed by this release: enforcement is not effectiveness evidence.

---

### 2026-11-08 C6 correction - PII redaction in C5 Check evidence (by: main session)

- **P** Plan: `validate_skill.py` reported
  `no_absolute_personal_paths_or_credentials: leaks=1: docs/TASK-LOG.md: path '<USER_HOME>'`,
  exit 1 (warning). Cause: the C5 Check pasted the literal user-global
  settings path as evidence that the merge guard blocks it. Ironic and real:
  proving "do not write a global path" wrote one into the release artifact.
- **D** Do: replaced that ONE path token with `<GLOBAL_SETTINGS>` in the C5
  Check. Nothing else in the entry changed: the command, the verdict, the exit
  code 2 and all numbers are untouched. A No `.workbuddy` absolute path was ever
  written. This edit is a SECURITY REDACTION, not an absorption of rework;
  append-only remains in force for verdicts and evidence.
- **C** Check: `python scripts/validate_skill.py` -> `VALIDATE_EXIT=0`,
  `leaks=0`, `broken=0`, `cjk_count=0`; `node scripts/discipline-gate.js` ->
  `I7 :: validation-report.json status=GREEN`, `DISCIPLINE GATE PASS`,
  `GATE_EXIT=0`. Both outputs are pasted in the re-check line below.
- **A** Act: PASS. Lesson: a validator that scans the whole package must also
  scan pasted evidence, and pasted evidence must be redacted before it is
  pasted. The gate's I7 correctly reported UNCERTAIN rather than silently
  promoting a red validator to PASS — that three-state behaviour is now
  confirmed on real data, not just in the design.

Re-check (main, C6): `VALIDATE_EXIT=0`, `leaks=0`, `I7 :: validation-report.json status=GREEN`, `DISCIPLINE GATE PASS (6 hard / 2 soft)`, `GATE_EXIT=0` — PASS.

C6 addendum: the first redaction attempt re-quoted the sensitive token and used four CJK characters inside the correction text; the validator caught both. A local pre-flight scan now runs before any gate is invoked. Two detections, one root cause: pasted evidence must be sanitised BEFORE it is pasted.

---

### 2026-11-08 C7 - PRD-to-action backbone, standalone views, macOS 27 Golden Gate (tier L, by: main session + G1/G2/G3)

- **P** Plan: second human report from real usage — (1) Work-division kanban
  needs its own page; (2) the Milestone gantt's "Work units | hour axis" are
  empty in the sense that NO main line, sub-lines or relationships were
  planned; (3) the sidebar looks absent, "maybe the description is missing";
  (4) use the LATEST Apple OS style; (5) "PRD-to-action — use this SKILL" for
  software engineering. Acceptance locked before work: two standalone views,
  milestone MAIN LINE / SUB-LINES / RELATIONS rendered from a real PRD,
  charter fields filled from data (not hardcoded), a real transparency slider,
  colored sidebar nav icons, an adversarial PRD gate wired into the Stop hook,
  all prior CDP assertions preserved. Non-goals: no rubric change, no C4
  re-test, no edit to the user-global settings, no arrow-line overlay (I-006
  stays OPEN).
- **D** Do: three mutually exclusive subagent packages, main session owns the
  ledger. G1 (PRD backbone): `docs/PRD.md`, `docs/evidence/milestones.json`,
  `assets/linked-gantt-board/data/milestone-plan.json`,
  `scripts/prd-to-action.js`, `references/prd-to-action.md`,
  `templates/PRD.template.md`. G2 (UI): `panel.html`, `styles.css`,
  `src/milestone.ts`, `src/app.ts`, `src/types.ts`, `db.js`, `server.js`,
  `selftest.js`, rebuilt `dist/`. G3 (docs): `SKILL.md` v1.5.0 + section 13,
  README, CHANGELOG, PLAN template, invariants, issue snapshot. Main session
  independently re-verified everything, then CLOSED the two gaps the packages
  left: redacted 2 personal paths and WIRED I9 into `discipline-gate.js`
  (G3 had documented I9 as HARD without wiring it — exactly the
  "spec says it, model does not" defect this project exists to fix).
- **C** Check: real output, pasted.
  - `node scripts/prd-to-action.js` -> `PRD-TO-ACTION GATE: 10/10 passed`,
    `PRD_GATE_EXIT=0`; `--negative` -> `NEGATIVE CONTROL: PASS`,
    `PRD_NEG_EXIT=2` (injected "works correctly" detected; discrimination).
  - `tsc -p tsconfig.json` -> `TSC_EXIT=0`; `grep -nE '^(import|export) ' dist/*.js`
    -> `OK: no ESM`.
  - `PANEL_PORT=4184 CDP_PORT=9234 node scripts/verify.js` ->
    `Result: 81/81 passed`, `RESULT: PASS (exit 0)` (10 new assertions, existing
    ones intact). Port 4174 (a different human-owned project) was never touched.
  - `node scripts/selftest-discipline.js` -> `14/14 passed  RESULT: PASS`.
  - `node scripts/discipline-gate.js` -> `PASS I9 :: prd-to-action.js exit 0
    (10/10 gates)`, `DISCIPLINE GATE PASS (7 hard / 2 soft)`, `GATE_EXIT=0`.
  - `python scripts/validate_skill.py` -> `VALIDATE_EXIT=0`,
    `38 links / 60 md files; broken=0`, `cjk_count=0`, `leaks=0`.
  - `python scripts/localize_check.py` -> `Text files scanned: 131`,
    `CJK_COUNT=0`.
  - Screenshot re-check (main session, not a handoff claim): plan page now
    shows M1 main-line bar, W1/W2 sub-line bars, MAIN LINE / SUB-LINES /
    RELATIONS / CRITICAL PATH labels; kanban is GONE from that page; sidebar
    and charter carry real prose; a "Glass ... 80%" transparency slider and
    colored nav dots are visible.
  - C4 frozen artifacts: four SHA-256 MATCH, `VERDICT UNCERTAIN`,
    `RECOMPUTE_MATCH PASS` (re-run below).
- **A** Act: PASS. Lessons: (1) a plan with bars but no milestone hierarchy is
  structurally empty — PRD-to-action's `M{N}/Depends on/Completion/Verify`
  template is the missing backbone, and its adversarial grep is a real gate,
  not decoration; (2) a subagent that documents an invariant as HARD without
  wiring it reproduces the original defect, so the main session must re-check
  claim vs code; (3) subagents paste personal paths unless explicitly told to
  redact BEFORE pasting. Scoreboard PASS 14 / FAIL 1. **18.0/20 and the C4
  UNCERTAIN verdict are unchanged**: this release fixes UI structure and
  engineering method, not evidence of skill effectiveness. I-006 remains OPEN.

---

### 2026-11-08 C7 re-check - the Stop hook blocks the main session (tier S, by: main session)

- **P** Plan: close the C7 turn by running the mandatory loop: session-start ->
  issue event -> PDCA entry with pasted evidence -> Stop gate. Acceptance: gate
  exit 0; no rubric change; no silent promotion of a FAIL.
- **D** Do: ran `node scripts/session-start.js` (injected `OPEN ISSUES: 1`),
  then `node scripts/issue.js update --id I-006 ...` (kept OPEN), then ran all
  gates BEFORE appending this entry. The gate blocked as designed.
- **C** Check: real output.
  - `node scripts/discipline-gate.js` FIRST RUN -> `FAIL I2 :: PDCA entries
    now=17, snapshot=17`, `FAIL I6 :: evidence tokens in tail=true, grew=false`,
    `[DISCIPLINE GATE] BLOCKED. 2 invariant(s) missing`, `GATE_EXIT=2`.
    This is a TRUE POSITIVE, not a bug: the main session skipped its own PDCA
    entry. No rule was weakened and no snapshot was edited.
  - `node scripts/prd-to-action.js` -> `PRD-TO-ACTION GATE: 10/10 passed`,
    `PRD_EXIT=0`; `python scripts/validate_skill.py` -> `VALIDATE_EXIT=0`,
    `leaks=0`, `cjk_count=0`; `python scripts/localize_check.py` ->
    `131 files / CJK_COUNT=0`; `node scripts/selftest-discipline.js` ->
    `14/14 passed  RESULT: PASS`.
  - `python scripts/package.py` -> `129 entries, 1021002 bytes`, `PACKAGE PASS`.
  - This entry is the fix for I2/I6; the re-run of the gate is recorded in the
    Re-check line below.
- **A** Act: PASS after the missing step was performed. Lesson: the hook is
  symmetric — it blocks subagents AND the main session. A turn is not done
  until the ledger says it is done. Score stays PASS 14 / FAIL 1; 18.0/20 and
  the C4 UNCERTAIN verdict are unchanged.

Re-check (main, C7): `node scripts/discipline-gate.js` after this entry -> I2 PASS, I6 PASS, I9 PASS, `DISCIPLINE GATE PASS (7 hard / 2 soft)`, `GATE_EXIT=0` — PASS. The earlier exit 2 is retained above as evidence that the hook has discrimination against the main session too.

---

### 2026-11-08 C8 - competitive research becomes an adoption chain (tier L, by: main session + cold reader R4)

- **P** Plan: the human said the R17 research (Teambition and three others)
  never reached the templates. Root-cause check before coding: five reports
  and `docs/competitive-synthesis.md` exist (226 URLs, 50 ALIGN / 30 SURPASS /
  24 NEVER-COPY, six "What to build first" items), R18 recorded the Linear /
  Height design target, but `templates/` held 5 self-invented files and ZERO
  benchmark-derived ones. Acceptance (locked): a B1..B6 landing map with
  `file:line`, templates carrying benchmark provenance, an executable master
  -> instance -> Publish registry, and a gate that FAILS if a landing
  disappears. Non-goals: no rubric change, no C4 re-test, no new competitor
  report, no edit to the global settings.
- **D** Do: main session did the implementation in one context; ONE cold reader
  (R4, no history, mutually exclusive read set) was used only for independent
  verification. Reason: the defect under repair is "research handed off and
  then lost", so delegating the landing work again would reproduce it. New:
  `docs/BENCHMARK-ADOPTION.md`, four templates with `Benchmark:` headers,
  `templates/registry.json`, `scripts/benchmark-adoption.js`,
  `docs/evidence/adoption-manifest.json`; revised `scripts/scaffold.js` to
  v2.1.0, `SKILL.md` v1.6.0 + section 14, README, CHANGELOG, invariants I10,
  the issue ledger (I-014, I-015). `node scripts/scaffold.js --all` created
  the four missing template INSTANCES plus a brief.
- **C** Check: real output, pasted.
  - `node scripts/benchmark-adoption.js` -> `13/13 passed`, `ADOPT_EXIT=0`.
    `--negative` -> `NEGATIVE CONTROL A: PASS`, `NEGATIVE CONTROL B: PASS`,
    `NEG_EXIT=2` (both perturbations detected).
  - `node scripts/discipline-gate.js` -> `PASS I10`,
    `DISCIPLINE GATE PASS (8 hard / 2 soft)`, `GATE_EXIT=0`;
    `node scripts/selftest-discipline.js` -> `15/15 passed  RESULT: PASS`.
  - `python scripts/validate_skill.py` -> `VALIDATE_EXIT=0`,
    `broken=0`, `leaks=0`, `cjk_count=0`;
    `python scripts/localize_check.py` -> `146 files / CJK_COUNT=0`.
  - `PANEL_PORT=4184 CDP_PORT=9234 node scripts/verify.js` ->
    `Result: 81/81 passed`, `RESULT: PASS (exit 0)` (assets unchanged, re-run
    anyway). `node scripts/prd-to-action.js` -> `10/10 passed`.
  - Throwaway sandbox: `AIOPS_ROOT=<tmp> node scripts/scaffold.js --publish plan`
    -> `PASS published :: plan v1.0.0 -> v1.0.1`, sandbox registry version
    `1.0.1`; the REAL registry stayed `1.0.0`.
  - `node scripts/scaffold.js --all` -> `5 newly created`, `8 instances`;
    `--status` -> `IN-SYNC` for the new instances and
    `PRE-EXISTING (version assumed, not proven)` for the old ones.
  - Four C2/C4 frozen hashes: all MATCH, `VERDICT UNCERTAIN`,
    `RECOMPUTE_MATCH PASS`.
  - **Cold reader R4** (`docs/cold-read/R4-benchmark-adoption.md`, 30 lines,
    verdict "needs revision", six defects D1-D6). The main session re-opened
    `app.ts:305-318`, `gantt.ts:347-355`, `scaffold.js` and the instance
    directory and CONFIRMED all six. Report retained, not deleted.
  - Three defects were found BY THE GATES DURING THIS TURN and fixed, not
    hidden: (1) the B5 landing cell contained a literal `|` from a grep
    pattern, which split the markdown row, so the per-row landing check
    reported `B5:NO-REF` and I10 returned exit 2; (2) negative control B
    inserted a new column instead of flipping B1's status, so it reported
    `MISSED` — the test was wrong, and was rewritten to a real status flip;
    (3) every edit to the gate or the ledger required re-signing
    `adoption-manifest.json` (three versions: 1.0.0 -> 1.0.1 -> 1.0.2),
    which is the self-integrity check working as designed.
- **A** Act: PASS. Lessons: (1) research without a landing row and a gate is
  wasted work, and a human will notice; (2) a cold reader that only reads the
  artifacts finds overclaimed "wired" features that the author cannot see —
  fix them with code, never with wording; (3) B5 was downgraded PARTIAL ->
  NOT IMPLEMENTED after the code showed only Escape and 1-hour arrow shifts;
  (4) a signed gate must be re-signed when edited, or it fails its own check.
  Scoreboard PASS 15 / FAIL 1. **18.0/20 and the C4 UNCERTAIN verdict are
  unchanged**: this release fixes research adoption, not evidence of skill
  effectiveness. I-006 (dependency arrow lines) remains OPEN; B1, B5, B6
  remain NOT IMPLEMENTED by design.

---

### 2026-11-08 C9 - pre-registered remediation (tier L, by: main session + C9-P1/P2 + cold reader R5)

- **P** Plan: `docs/REMEDIATION-PLAN-C9.md` was written and locked BEFORE work
  (A1-A8, failure cells, mutually exclusive file ownership, non-goals).
  Findings from a read-only re-check: F1 I-006 was a STALE open item (arrow
  lines already in `gantt.ts:139-154`); F2 B1 approval matrix, F3 B5 board
  keyboard model, F4 B6 owner scope were genuinely missing; F5 hooks were
  documented but never installed; F6 (18.0/20 and C4 UNCERTAIN) is a NON-GOAL.
  Non-goals: no rubric change, no frozen-artifact edit, no user-global
  settings write, no C5 effectiveness round.
- **D** Do: two implementation subagents with disjoint ownership (P1: db.js /
  server.js / policy.ts / desk.ts / two seed JSONs; P2: board.ts / gantt.ts /
  graph.ts / app.ts / styles.css). Main session: tsc, `panel.html` script tag,
  8 unified CDP assertions in `selftest.js`, project-level hook install, all
  docs, the ledger and packaging. Cold reader R5 (no context, fixed read set)
  verified afterwards.
- **C** Check: real output, pasted.
  - `PANEL_PORT=4184 CDP_PORT=9234 node scripts/verify.js` ->
    `Result: 89/89 passed`, `RESULT: PASS (exit 0)`. Eight new C9 cases:
    `rows=7 enforced=3`; `human,main,subagent,team`; `status=400
    body={"error":"reject requires a reason"}`; `state=REJECTED reason=C9
    written reason`; `mount=function tables=3`;
    `{"n":18,"sorted":true,"board":18,"gantt":18,"boardOk":true,"ganttOk":true}`;
    `{"ok":true,"ids":["t7","t10"],"painted":true}`;
    `selected=2 persisted=2 t7:6 t10:9`.
  - `tsc -p tsconfig.json` -> `TSC_EXIT=0`, dist has NO ESM syntax.
  - Hook install: `PASS merge computed :: 2 new hook entries,
    events=UserPromptSubmit, Stop`; second `--apply` -> `0 new hook entries`;
    both referenced scripts exist. Target is the PROJECT-level
    `.workbuddy/settings.json`; no user-global file was written.
  - `node scripts/issue.js list` -> `OPEN=0`.
  - `node scripts/benchmark-adoption.js` -> `13/13 passed`, `ADOPT_EXIT=0`;
    `--negative` -> both controls PASS, `NEG_EXIT=2`; manifest re-signed
    v1.0.4. `node scripts/discipline-gate.js` -> `DISCIPLINE GATE PASS
    (8 hard / 2 soft)`, `GATE_EXIT=0`; `selftest-discipline.js` -> `15/15`.
  - `validate_skill.py` -> `VALIDATE_EXIT=0`, `broken=0`, `leaks=0`,
    `cjk_count=0`; `localize_check.py` -> `156 files / CJK_COUNT=0`;
    `prd-to-action.js` -> `10/10 passed`; four frozen hashes all MATCH.
  - `node scripts/scaffold.js --status` -> `DRIFT lock=v1.0.0 master=v1.1.0`
    for the two edited masters. This is the no-overwrite rule working; the
    adoption ledger now explains it instead of hiding it.
  - **Cold reader R5** (`docs/cold-read/R5-C9.md`, 35 lines, "needs revision"):
    A1-A5 PASS, A6-A8 UNVERIFIABLE from its restricted read set (the main
    session re-ran those gates above), D1-D6 logged. Its verdict is NOT
    rewritten.
  - **C9-1 correction** appended to the plan (append-only, A1-A8 unchanged):
    D1 stale snapshot narrative, D3 DRIFT explanation, D5 line numbers
    `130-153/:298` -> `139-154/:308`, and D2 A4 STRENGTHENED from one to two
    cards. The strengthened suite FAILED first (`selected=2 persisted=1`),
    which exposed a real `board.ts` bug: new sort values were based on the
    unselected subset, so `t7` was assigned its own old value. Fixed with
    whole-column extremes plus serial PUTs, then re-run to `89/89` with
    `persisted=2`. No failing result was reworded into a pass.
- **A** Act: PASS. Lessons: (1) re-check the code before asserting an item is
  still open - a stale OPEN item is itself a defect; (2) an acceptance
  criterion can be silently weakened by its own test, so a cold reader is
  worth more than another feature; (3) strengthening a test found a real bug
  that the weaker test could never see; (4) hooks documented but not
  installed are decoration. Scoreboard PASS 16 / FAIL 1. **18.0/20 and the C4
  UNCERTAIN verdict are unchanged**: this round is engineering remediation,
  not evidence of skill effectiveness.

### 2026-11-08 13:50 C10 - link-audit remediation G2 -> G1 -> G3 (tier L, by: main session + G2/G1/G3/G3-1 subagents)
- P Plan: fix the three link-audit gaps in order G2 (bug: issue status vocabulary fork) -> G1 (no PDCA-to-plan status write-back) -> G3 (two work-unit ID spaces). Acceptance: one status vocabulary across CLI/panel; a write-back tool with reject-path zero writes and a three-store consistency assertion inside prd-to-action gate X; plan work units visible in SQLite by the SAME id so done/todo travels by id. Non-goals: no UI redesign, no changes to frozen effectiveness artifacts, no demo-seed edits, no user-global settings.
- D Do: G2 subagent unified issue status to open|done (issue.js:85/:121, session-start.js:33, write-side validation, 15 legacy issues migrated closed->done via CLI, DISCIPLINE-INVARIANTS.md:93 example). G1 subagent built scripts/plan-sync.js --check/--set (three stores: PRD Status line / milestones.json / milestone-plan.json), extended prd-to-action gate X with three-store status equality (gate count stays 10), evidence-backed flips M4/M5/M6 + W10-W18 done, and corrected the stale M6 completion criterion "118 entries" -> "entry count matches the packaged file set of the same run" in all three stores (traced in I-017 reply). G3 subagent added --seed-tasks (W ids materialized into SQLite tasks + task_deps, demo rows untouched), SQLite coherence in --check when panel.db exists (SKIP when absent), and --set propagation by id. G3-1 subagent fixed the done-exit edge: --set takes ID:status:progress; leaving done demands explicit progress; progress=100 reserved for done; all reject paths zero-writes. Issues I-016/I-017/I-018 opened and closed through scripts/issue.js with evidence.
- C Check: `node scripts/issue.js list` -> OPEN=1 -> 0 after closes; negative control `--status closed` -> exit 1 zero write. `node scripts/plan-sync.js --check` -> PLAN-SYNC CHECK: 25/25 passed (SKIP SQLite coherence :: no panel.db). `--seed-tasks` -> 18 tasks (18 created), 16 relations, `demo rows :: 15 untouched`; re-run -> 0 created / 18 updated (idempotent). Teeth probes: deliberate `updateTask('W10',{status:'pending'})` -> `FAIL W10 coherence :: plan=done task=pending` exit 2, healed by `--set W10:done` -> 44/44; `--set W11:in_progress` on done -> exit 1 (explicit progress required), `--set W11:in_progress:55` -> PASS 25/25; four reject probes (done:55 / in_progress:100 / :120 / M4:done:50) -> exit 1, milestone-plan.json sha256 unchanged. Divergence probe on gate X (ms-only flip) -> 9/10 exit 2. `node scripts/prd-to-action.js` -> PRD-TO-ACTION GATE: 10/10 passed; `--negative` -> exit 2, gate A only. `node scripts/selftest-discipline.js` -> 15/15. `PANEL_PORT=4184 CDP_PORT=9234 node scripts/verify.js` -> Result: 89/89 passed. `python scripts/validate_skill.py` -> failed = 0. M6 pre-flip checks: validate_skill 14/14, handoffs/G1.md 39 lines / 4 sections, package.py 153 entries == same-run file set, checksum outside archive.
- Re-check (main): node scripts/plan-sync.js --check && node scripts/prd-to-action.js && node scripts/selftest-discipline.js -> 25/25, 10/10, 15/15 - PASS
- A Act: PASS. Lessons: (1) a vocabulary fork is worse than a missing link - both sides were "correct" locally and the mirror silently reversed meaning; audit links by listing writer/reader pairs and comparing semantic fields, not file existence. (2) a stale number inside an acceptance criterion (118 entries) makes the criterion unverifiable as the artifact legitimately grows; rewrite as a self-consistent invariant and keep the correction trace. (3) when two frozen rules can collide (leave-progress-untouched vs progress=100 means done), the tool must refuse with a demanded parameter instead of writing a state its own checker rejects. (4) transient runtime state (panel.db) needs a three-state SKIP, never an implicit create, in read-only modes.

### 2026-11-08 15:20 C11 - desk units become sheets with queryable history (tier L, by: main session + P-SVC/P-UI/P-TEST/P-FIX subagents)
- P Plan: user asked (a) whether the 4 Command-desk units are actually wired and (b) to split the 2x2 desk-grid into per-unit SHEETs with queryable history. Audit verdict (read-only, before any edit): all 4 units were already wired to SQLite/real computation (command -> meta.next_command + acks; notices/jobs -> importHandoff; ACKs -> acks state machine + rejections.json; signals -> blockingSignals() from tasks/deps/issues) but crammed onto one screen and history-less (signals ephemeral, command/ACK transitions unlogged). Acceptance: 4 sheet tabs with restore, per-sheet History with filter, event stream persistence, signal raise/clear logging, suite grows without touching existing assertions. Non-goals: no redesign of board/gantt/ledger views, no db.js API shape changes beyond the frozen /api/events contract, no user-global settings.
- D Do: P-SVC added desk_events table + GET/POST /api/events (unit/q/limit contract, validation 400s) and auto-log hooks in db.js (command/save deduped, command/generate, ack/send|approved|done|rejected deduped, job/import per row). P-UI split panel.html desk-grid into #deskTabs + 4 sheets (console/inbox/acks/signals), localStorage('desk.sheet') restore with bogus-value fallback, per-sheet History blocks (histFilter/histRefresh/histBody, 250ms debounce, store-driven refresh), ACK rows gained time.ack-created, board.ts gained the signal transition logger. P-TEST added 22 assertions as section 25 (suite 89 -> 111). P-FIX repaired a real defect P-TEST found: the signal diff key embedded a ticking hour counter, fabricating clear+raise pairs; keys are now stable (kind+entity id) with unchanged human-readable payload, verified across an actual hour-flip reload cycle (1 raise + 1 clear, zero noise).
- C Check: main-session final battery `PANEL_PORT=4184 CDP_PORT=9234 node scripts/verify.js` -> Result: 111/111 passed, exit 0 (P-TEST ran it twice green before the key fix; P-FIX re-ran green after). `node scripts/prd-to-action.js` -> 10/10. `node scripts/selftest-discipline.js` -> 15/15. Contract smokes (P-SVC): GET/POST /api/events 200/400 matrix, q case-insensitive hit, limit clamp, dedup probes (setCommand x2 -> 1 event; updateAck repeat -> 1 event), hook table pasted in I-019 reply. UI smokes (P-UI): 4 tabs/sheets present, exactly-one-active invariant, reload restore, tsc exit 0 / zero ESM in dist, 14 preserved DOM ids, 5 legacy h2 titles intact, zero CJK. Drift probe (P-FIX): open 25h -> 26h across 3 reloads -> signal event count stays 1 (no fabricated pairs), clear only on real deletion.
- Re-check (main): node scripts/verify.js && node scripts/prd-to-action.js && node scripts/selftest-discipline.js -> 111/111, 10/10, 15/15 - PASS
- A Act: PASS. Lessons: (1) the honest pre-edit audit matters: the units were already wired, so the real defect was layout + missing history, not dead UI - report what IS true before rebuilding. (2) a state-transition logger keyed on human-readable text drifts whenever the text drifts; keys must be entity identities, text is payload only - the test package earned its keep by catching this in the same round. (3) freeze the API contract before parallel packages (P-SVC/P-UI) and forbid them from touching each other's files; both landed without a single contract violation. (4) growing a frozen test suite is safe ONLY additively: the 22 new assertions never edit the 89, and screenshots stay byte-identical because the new section runs after the screenshot capture.

### 2026-11-09 R24 - release audit for 1.8.0 (tier M, by: main session)

- **P** Plan: a foreign session (C4-C11) changed the tree after the R23 push.
  Verify the full diff before it enters git. Acceptance: (1) every shipped
  gate green on the CURRENT tree; (2) the four frozen artifacts and the demo
  data byte-unchanged; (3) no npm dependency, no ESM in dist; (4) the data
  contract handoff names unchanged; (5) forbidden runtime state absent from
  git. Non-goals: no product code change, no rubric change, no re-run of C4.
- **D** Do: read-only diff review first (26 modified files + imports of
  scripts/, templates/, hooks/, docs/, references/). Findings fixed in this
  round, none in product code: (a) `release/` build zip and the per-turn gate
  evidence (session.json, issue-delta.json, gate-report.json,
  structure-gate.json) were untracked runtime state -> added to .gitignore;
  (b) `.workbuddy/` holds a machine-local hook install with an absolute path
  and a .bak file -> gitignored; the portable fragment in `hooks/` stays;
  (c) CHANGELOG/SKILL.md stopped at 1.7.0 while C10/C11 changed shipped code
  -> 1.8.0 entry added, version bumped; (d) three new `data/*.json` spec
  masters (approval-matrix, milestone-plan, owner-scope) are versioned spec,
  not demo rows -> kept. The demo set `demo-seed|module-deps|module-notes|
  notifications|rounds|status.json` has zero diff.
- **C** Check: real output, pasted.
  - `PANEL_PORT=4184 CDP_PORT=9234 node scripts/verify.js` -> `Result:
    111/111 passed`, `RESULT: PASS (exit 0)`, `0 JS exceptions / console
    errors`, runtime panel.db* removed by the runner.
  - `node scripts/selftest-discipline.js` -> `DISCIPLINE SELFTEST: 15/15
    passed  RESULT: PASS`.
  - `python scripts/validate_skill.py` -> `14/14 checks passed`,
    `broken=0`, `cjk_count=0`, `leaks=0`.
  - `python scripts/localize_check.py` -> `Text files scanned: 158`,
    `CJK_COUNT=0`.
  - `node scripts/discipline-gate.js` -> `DISCIPLINE GATE PASS (8 hard / 2
    soft)`, `GATE_EXIT=0` (I1-I10 all PASS).
  - `python docs/evidence/confirmatory/recompute.py` -> `VERDICT UNCERTAIN`,
    `RECOMPUTE_MATCH PASS`, four frozen hashes MATCH.
  - `node scripts/plan-sync.js --check` -> `PLAN-SYNC CHECK: 25/25 passed`.
  - `node scripts/issue.js list` -> `OPEN=0`.
  - `npx tsc -p tsconfig.json` -> `TSC_EXIT=0`; `grep -nE '^(import|export) '`
    over dist/*.js -> empty (no ESM).
  - Diff audit: `git diff --name-only` over the four frozen docs -> empty;
    over `data/*.json` -> empty; `git diff` removed lines in TASK-LOG = the
    scoreboard line + one pending re-check fill, nothing else (append-only
    holds). `package.json` carries zero dependencies.
- **A** Act: PASS. Lessons: (1) a foreign session's green claims are a
  handback, not proof - re-run the battery on the current tree before
  release; (2) a build zip left in the tree goes stale the moment the next
  round lands (its TASK-LOG copy lacked C10/C11) - build output is gitignored
  and rebuilt per release, never committed; (3) a version number that stops
  while shipped code moves is a silent contract break - the release audit
  bumps it in the same commit. Scoreboard PASS 17 / FAIL 1. 18.0/20 and the
  C4 UNCERTAIN verdict unchanged.

Re-check (main): `python scripts/validate_skill.py && python scripts/localize_check.py` after this entry -> `14/14 checks passed`, `leaks=0`, `CJK_COUNT=0` — PASS.
