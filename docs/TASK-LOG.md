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
> Ledger text is English-only: the package CJK gate scans this file. Quote human
> words as English glosses (data values may hold any language; packaged text
> files may not).

## Scoreboard
PASS 28 / FAIL 1

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

### 2026-11-09 R25 - graph registry design, pre-registered only (tier S, by: main session)

- **P** Plan: the human reports task UUID management is messy and tasks do not
  connect into a graph. Round scope decided with the human: DESIGN ONLY, no
  code. Acceptance: one design file that fixes the node/edge model over the
  EXISTING id spaces, a machine line that attaches PDCA rounds to plan nodes,
  a locked acceptance section for the future implementation round, and the
  documented non-goals. Non-goals: no implementation, no UUID renumbering, no
  edit of old ledger entries, no UI work, no C4 re-test.
- **D** Do: audited the live id spaces first (milestones M1-M6, work units
  W1-W18, issues I-001..I-019, entries C/R series, handoffs G/P series) and
  the three live edge stores (milestone-plan.relations, SQLite task_deps,
  parent_id). Wrote docs/GRAPH-DESIGN.md: node kinds, six edge types, the
  `Graph: scope M4/W10 | fixes I-018 | rework-of C7` machine line (scope
  mandatory, one node per entry), relations.json shape with a hand-maintained
  backfill block, graph.js --build/--check/--query contract, future invariant
  I11 with negative controls, and the PDCA-to-PRD close loop by shared id.
- **C** Check: real output, pasted.
  - `python scripts/localize_check.py` -> `Text files scanned: 159`,
    `CJK_COUNT=0`.
  - `python scripts/validate_skill.py` -> `14/14 checks passed`,
    `broken=0`, `leaks=0`, `cjk_count=0`.
  - `node scripts/discipline-gate.js` -> `DISCIPLINE GATE PASS (8 hard / 2
    soft)`, `GATE_EXIT=0` (I11 does not exist yet; it is created by the
    implementation round, which is exactly why this round ships no code).
  - Design completeness probe: section 7 lists 8 locked acceptance criteria
    covering representation counts, machine-line enforcement, two negative
    controls, template slot, backfill minimum and the full green battery.
- **A** Act: PASS (design task; scored on the stated acceptance). Lesson: the
  ids were never the defect — five readable namespaces are assets. The defect
  was that cross-space relations lived in prose, so no machine could walk
  them. One registry plus one machine line per entry fixes the graph WITHOUT
  renumbering anything. Scoreboard PASS 18 / FAIL 1. 18.0/20 and the C4
  UNCERTAIN verdict unchanged; this design is structure, not effectiveness
  evidence.

Re-check (main): implementation round must LOCK docs/GRAPH-DESIGN.md section 7 before touching code — pending that round.

### 2026-11-09 R26 - prd-to-action skill hardening, wording level (tier S, by: main session)

- **P** Plan: apply the four method-level improvements agreed after the R25
  discussion to the INSTALLED skill (user-level prd-to-action/SKILL.md).
  Scope locked by the pre-work benefit review: activation precondition (#5),
  evidence rule for Phase 3 (report numbers copied from pasted output, no
  pasted output = not done, rework as new entries), quantified BREAK
  calibration (miss_rate gate at 0.20 over a rolling 3 milestones). Non-goals:
  no infrastructure back-flow into the skill (this repo owns the hard gates),
  no behavior-level claim, no change to the skill's phase structure.
- **D** Do: snapshot first (skill dir has NO git): sha256 of SKILL.md =
  8adbc705...b9eba8018b, full-tree backup at /tmp/prd-to-action-backup-
  20261109/. Three Edits to SKILL.md (description precondition; Phase 3
  Evidence rule block; calibration Quantified BREAK record). Nothing else
  touched.
- **C** Check: STRUCTURAL verification only — this is the honest limit. The
  skill has no selftest and trigger behavior is model-side, so the claim is
  "the wording is in place", NOT "misfires decreased".
  - `grep -c` assertions, all = 1/2 as expected: `ACTIVATION PRECONDITION`,
    `do NOT activate this skill`, `never hand-counted`, `is NOT done`,
    `miss_rate` x2, `0.20` x2.
  - Line-level diff audit vs the backup: 23 changed lines, all attributable
    to the three intended edits (the 4 residual lines shown by the filter are
    the re-wrapped Triggers sentence, one precondition continuation line, and
    two blank separators). Zero collateral edits.
  - `python scripts/localize_check.py` -> `CJK_COUNT=0` (package tree;
    skill file itself is English-only by the same grep pass).
  - `python scripts/validate_skill.py` -> `14/14 checks passed`, `leaks=0`.
- **A** Act: PASS (wording task, scored on the stated acceptance). Lessons:
  (1) a user-level skill dir without git is a rollback hazard — the sha256 +
  /tmp backup pair is the minimum, and it should have been versioned from day
  one; (2) trigger-precondition wording is a SOFT control: it biases model
  activation, it does not gate it. A behavior-level measurement would need an
  activation log, which was judged not worth building for this tier (pre-work
  review). Scoreboard PASS 19 / FAIL 1. No package code changed; 18.0/20 and
  the C4 UNCERTAIN verdict unchanged.

Re-check (main): behavior claim remains open — if a non-PRD session still hijacks on "status", record it here as evidence for a future trigger-stats round — pending observation.

### 2026-11-09 R26-A correction - CHANGELOG missed the R25/R26 round (by: main session)

- **P** Plan: the human spotted that CHANGELOG.md stopped at 1.8.0 while the
  R25/R26 batch was already on origin/main. A release-notes file that lags
  shipped content is the same defect class as the 1.7.0/1.8.0 gap fixed in
  R24. Non-goal: no code change.
- **D** Do: added a 1.8.1 docs-only entry (R25 graph design + R26 skill map
  note), bumped SKILL.md version 1.8.0 -> 1.8.1 in the same commit.
- **C** Check: `python scripts/validate_skill.py` -> `14/14 checks passed`,
  `leaks=0`; `python scripts/localize_check.py` -> `CJK_COUNT=0`;
  `grep "version: '1.8.1'" SKILL.md` -> 1 hit. Re-check line records the push.
- **A** Act: PASS as a correction (not scored, per the C4/C6 rule that a
  correction is not a scored task). Lesson: the R24 audit rule is not
  self-executing — "the release audit bumps it in the same commit" needs a
  gate, or it drifts again. Candidate invariant: CHANGELOG head version ==
  SKILL.md version == newest shipped round; defer wiring until the graph
  round (it has a natural --check home).

### 2026-11-09 R27 - UI chrome round: folds, drag widths, settings page (tier M, by: main session)

- **P** Plan: live-review wants I-022 (charter block covers every page; sidebar
  resizable + collapsible), I-023 (settings page: port / language / colors),
  I-024 (plan panels resizable + collapsible), plus the human note "too much
  text; match F:/Papaer/remote console style" and "content and features stay
  as previously discussed". Acceptance: charter folded by default behind one
  toggle; sidebar drag-resized via --side-w with persistence; both plan
  panels fold with persistence and the divider drives --ms-h; settings page
  with theme (auto/light/dark), port, language, glass, layout reset; hint
  prose cut to one-liners; suite grows additively; all pinned literals
  untouched. Non-goals: no content/feature change, no I-020 build (separate
  round), no CJK in shipped files.
- **D** Do: panel.html (fold buttons, side-resize grip, settings view, 13 hint
  trims), styles.css (--side-w / --ms-h derivation, fold states, theme
  override via [data-theme]), app.ts (initSidebar drag + persistence,
  initPanelFolds, initSettings, initDivider rewritten to --ms-h), selftest.js
  section 26 (10 new assertions, none of the 111 edited).
- **C** Check: real output, pasted.
  - `PANEL_PORT=4186 CDP_PORT=9236 node scripts/verify.js` ->
    `Result: 120/120 passed`, `RESULT: PASS (exit 0)`, `0 errors`. Section 26
    lines: `First-principles block starts folded` {"collapsed":true};
    `Charter toggle ... persists` {"open":true,"stored":"1"};
    `Sidebar drag-resize sets --side-w and persists` {"w":"316px","width":316};
    `Sidebar width survives a reload` {"w":"316px","width":316};
    `panels fold and persist` {"plan":true,"gantt":true};
    `divider drag sets --ms-h and persists` {"after":"120px","stored":"120px"};
    `Settings page ... theme applies` rows=Color scheme|Port|Language|Glass|Layout
    theme=dark port=4186; `glass slider drives --glass-alpha` {"alpha":"0.55"};
    `reset clears saved chrome preferences` left=[].
  - Two FALSE FAILS fixed before the green run, both in my own test code, not
    the product: a rename regex hit the string literal `--glass-alpha`, and
    the width probe raced the 0.22s CSS transition. A 4-assertion FAIL batch
    after that was environment pollution: the port-4184 demo server shared
    data/ with the verify run. Stopped it, removed panel.db*, re-run -> 120/120.
  - Pinned literals survive: `Needs human decision`, DEMO banner, cost-first
    label, 42-tick axis name all pass unchanged.
- **A** Act: PASS. Lessons: (1) a shared data directory turns two servers into
    one flaky test - verify must own its data dir, or the demo must be stopped
    first (recorded as the runbook step, not a gate yet); (2) synthetic
    PointerEvent tests must wait out CSS transitions before measuring; (3) a
    rename regex must never cross into string literals. Scoreboard
    PASS 20 / FAIL 1. Content and features unchanged; the text density pass
    cut 13 hint blocks to one-liners in the remote-console style.

Re-check (main): `validate_skill 14/14 leaks=0; localize 159 files CJK=0; discipline-gate PASS (8 hard / 2 soft)` — PASS

### 2026-11-09 R28 - ACCEPTANCE LOCK (before subagents return): I-020 traceability view

Locked at dispatch time; subagent results are judged against these lines only.

1. Plan view renders a goal layer on top and the milestone/work-unit tree below
   it, with analysis columns exactly as signed: status | progress | cost |
   rounds | rework.
2. Goal rows group milestones; every milestone belongs to exactly one goal;
   the I-020 work itself appears as a new plan milestone (todo -> done).
3. `rounds` lists the PDCA entry ids whose text names the node; `rework`
   counts rework-of entries touching it. Deterministic derivation, no manual
   map.
4. `/api/plan` carries `goals` and `analysis` blocks; data contract names for
   rounds / notifications / status / module-notes / module-deps unchanged.
5. selftest grows additively (section 27+); all 120 existing assertions pass
   unedited; `verify.js` exits 0.
6. `scripts/prd-to-action.js` 10/10 (count checks derive from the arrays, not
   a hardcoded 6); `plan-sync.js --check` green; CJK_COUNT=0; no npm deps.
7. One PDCA entry per subagent with pasted evidence; both cite I-020.

### 2026-11-09 I-020/P1 - goal layer + analysis block for the traceability view (by: subagent-p1)
- **P** Plan: I-020 R28 lock: plan.goals (G1: M1-M6, G2: M7), new M7 in all three stores (in_progress, zero W, main_line+M7, relations unchanged), /api/plan returns goals + analysis{status|progress|cost|rounds|rework} per M/W id derived from the plan file and docs/TASK-LOG.md, gate C counts derive from the three stores. Acceptance: R28 lines 1-6, W1-W18 stay 18, contract names unchanged, no npm deps, CJK=0.
- **D** Do: edited exactly the 5 owned files (milestone-plan.json, docs/evidence/milestones.json, docs/PRD.md, db.js 2.2.0, prd-to-action.js 1.1.0); db.js adds readPdcaEntries/mentionsNode/milestoneProgress/buildAnalysis with analysis_note fallback; gate X gained sub_lines-key, two-way membership and goal-coverage checks; >=2 work units now applies only to milestones that own units (M7 owns none).
- **C** Check: `node scripts/plan-sync.js --check` -> `M7 status :: prd=in_progress ms=in_progress plan=in_progress` + `PLAN-SYNC CHECK: 26/26 passed`, exit 0; `node scripts/prd-to-action.js` -> `PRD-TO-ACTION GATE: 10/10 passed`, exit 0 (C evidence: `count and id sets agree across the three stores (derived, not hardcoded)`; X: `2 goals cover 7 milestones exactly once`); `node scripts/prd-to-action.js --negative` -> `NEGATIVE CONTROL: PASS :: gate DETECTED "works correctly"`, exit 2 expected; `node --check assets/linked-gantt-board/db.js` -> exit 0; payload smoke -> `analysis keys=25`, `M7={in_progress,50,0,[],0}`, `analysis_note=""`; `python scripts/localize_check.py | tail -2` -> `Text files scanned: 159` / `CJK_COUNT=0`, exit 0.
- **A** Act: **PASS (I-020 P1)**. Gap pre-empted: gate X's old unconditional ">=2 work units" would have failed the frozen zero-W M7, so the rule now binds only milestones that own units while new checks (mandatory sub_lines entry, membership consistency, exactly-one-goal coverage) make the gate stronger overall; lesson: when a contract adds an empty container, relax the count rule for that container and add structural rules instead. Main session flips M7 to done (plan-sync --set M7:done) once P2's render lands.

Re-check (main): re-ran P1's five commands — plan-sync 26/26 exit 0; prd-to-action 10/10 exit 0; --negative exit 2 (DETECT); node --check db.js ok; localize 159 files CJK=0; frozen counts W=18 relations=16 zero units on the new milestone. One R28 line-3 drift found and fixed before scoring: analysis.rework counted any entry containing the word "rework", while the lock counts only entries carrying the redo link tag; db.js buildAnalysis now counts the tag literal. Post-paste smoke: analysis keys=25, M7 row = in_progress / 50 / 0 / [I-020/P1] / 0. Known artifact: an entry that quotes the redo tag without redoing anything still counts (the R25 design entry does); the relations registry in the graph round replaces this heuristic. — PASS

### 2026-11-09 I-020/P2 - goal tree + analysis columns render (by: subagent-p2)
- **P** Plan: package P2 renders the signed mockup (goal rows on top, milestone/work-unit tree below, columns status | progress | cost | rounds | rework) above the existing plan gantt, against P1's frozen /api/plan `goals`+`analysis` shape; degrade when absent; additive selftest section 27; tsc exit 0; CJK 0; owned files only.
- **D** Do: milestone.ts (goal types + rollup helpers + goalTreeHtml prefixed into layer.innerHTML), styles.css (appended goal-tree rules), panel.html (hint), selftest.js section 27 (5 assertions: fixture goal rows+columns, WU rounds, live /api/plan, degrade fixture, no new exceptions) inserted before the untouched final exception PASS.
- **C** Check: real output pasted - `TSC_EXIT=0`; `node --check dist/milestone.js` -> 0; `node --check selftest.js` -> 0; `localize_check` -> `Text files scanned: 159` / `CJK_COUNT=0`; DOM-stub smoke G1_ROW="G1 Release 1.8.x with discipline gates [done] 100% $2.7k rounds: R24 R26 rework: 0", W14_ROW="W14 Gate wiring [done] 100% $2.1k rounds: R24 rework: 0", OLD_HAS_TREE=false; section 27 PASS labels listed above (5 new, 0 edited).
- **A** Act: PASS pending main re-check. Lesson: goal rollup splits by field - cost/progress sum milestones (the server already folds WU cost into the milestone), rounds/rework union the subtree because a ledger entry can name a work unit without naming its milestone; the fixture's WU-only round R99 pins that choice.

Re-check (main): P2 claims re-run - tsc exit 0, node --check dist + selftest 0, CJK=0. First battery run FAILED at section 27 (119 PASS then "CP.applyPlan is not a function"); boundary probes proved a mid-reload page, not P2's code. Root cause: latent R27 defect - the reset test stubbed window.location.reload, which is non-writable (LegacyUnforgeable), so the stub silently no-oped and the click really navigated; R27 missed it only because that test ended the suite. Corrections (unscored, C4/C6 precedent): CP.reload seam in app.ts, the test stubs the seam (assert condition unchanged), section 28 turns the lesson into a gate (selftest.js must carry no window.location writes). Final battery: `Result: 126/126 passed`, `RESULT: PASS (exit 0)`; section 27 five PASS lines incl. live `{"status":200,"available":true,"goals":2,"anaKeys":25,"hasTree":true,"goalRows":2,"groups":7}`; section 28 `found=[]`. M7 flipped to done via `plan-sync --set M7:done`, then `PLAN-SYNC CHECK: 26/26 passed` and `PRD-TO-ACTION GATE: 10/10 passed` re-run green. — PASS

### 2026-11-09 R28 - I-020 judged: goal-anchored WBS traceability view (by: main)
- **P** Plan: judge I-020 P1+P2 against the seven locked lines above; score one round; close I-020 only where every line holds with pasted evidence.
- **D** Do: re-ran P1's five gates; judged P2's render code against the signed mockup; ran the unified battery three times (instrumented bisection between runs); fixed one derivation-rule drift (line 3) and one latent reset-stub defect (line 5); removed probes; flipped M7 todo -> done; closed I-020.
- **C** Check: line-by-line - (1) `Goal rows render above the gantt with the five analysis columns (I-020) :: {"hasTree":true,"goalCount":2,"cols":true...msDepth":"1"}`; goal rows above, milestone/work-unit rows nested at depth 1/2, header `status | progress | cost | rounds | rework` (milestone.ts goalTreeHtml). (2) `2 goals cover 7 milestones exactly once`; I-020 shipped as M7 "Traceability view (I-020)", flipped to done in all three stores (`PLAN-SYNC CHECK: 26/26 passed` after `--set M7:done`). (3) rounds = ledger entry ids naming the node; rework counts marker-tagged entries (drift fixed, smoke `M7 row = in_progress / 50 / 0 / [I-020/P1] / 0`). (4) `/api/plan` live proof `{"status":200,"available":true,"goals":2,"anaKeys":25,"hasTree":true,"goalRows":2,"groups":7}`; contract filenames/fields untouched. (5) sections 27 (5 asserts) + 28 (1 assert) added; `Result: 126/126 passed`, `RESULT: PASS (exit 0)`; deviation: 1 of the 120 prior assertions (R27 reset stub) needed a stub correction first - assert condition unchanged, 119 passed unedited. (6) `PRD-TO-ACTION GATE: 10/10 passed` derived counts, `PLAN-SYNC CHECK: 26/26 passed`, `CJK_COUNT=0`, no npm deps. (7) one PDCA entry per subagent pasted above, both cite I-020.
- **A** Act: **PASS (R28)**. Scoreboard PASS 21 / FAIL 1. Lessons made gates (I-021): (a) derived rules are judged against the locked wording, not the executor's paraphrase - the line-by-line re-check is the gate and it caught one drift; (b) monkey-patching a non-writable host API silently no-ops - section 28 forbids window.location writes in selftest.js and stubs go through CP seams. Known artifact: spec text quoting the redo tag inflates node counts (documented in P1's Re-check); the graph round's relations registry replaces the heuristic. I-020 closed.

### 2026-11-09 R29 - ACCEPTANCE LOCK (before subagents return): I-025..I-030 acceptance batch

Locked at dispatch; results judged against these lines only. Scope signed by the
human on the five mockups plus the I-030 additive scope.

1. I-025: the charter block (First principles header, preview, Edit/fold)
   renders only on the Command desk view; no other view shows any of it; the
   charter modal stays reachable from Command desk.
2. I-026: the global #glassAlpha control is gone from the shared chrome; the
   Settings Glass row is the single --glass-alpha control (persisted); no other
   page shows a glass control.
3. I-027: the plan view is two tabs (Milestone plan | Hour axis), one panel at
   a time; the tab bar stays pinned at the top while panel content scrolls; the
   goal tree stays inside the Milestone plan tab; the split divider and the two
   Fold buttons are removed; their section-26 assertions are replaced by tab
   assertions (recorded corrections, citing I-027).
4. I-028: real I-xxx issues reach the panel (the issue.js mirror inserts
   missing rows - today it only updates and reports "issue not found"); ledger
   rows show detail (acceptance wording), evidence (TASK-LOG entry ids naming
   the issue id as a whole token, derived like analysis.rounds), reply and
   updated time; rows expand; every column width is drag-resizable and
   persists across reloads; demo ISS rows untouched.
5. I-029: every kanban card can show upstream/downstream links from task_deps
   (depends-on / depended-by); the link row is optional per card (toggle,
   persisted); clicking a link scrolls to and highlights the linked card;
   links show type + signed lag and the nature badge when present; demo rows
   untouched.
6. I-030: lead = negative lag accepted and rendered ("FS-2d"); cascade math
   respects the sign; optional nature on task_deps (migration + validation +
   API) and passed through plan relations when present; visible on relation
   rows and kanban links; existing field names and values untouched. Vocab
   frozen: mandatory | discretionary | external (lowercase), '' = unspecified.
7. tsc exit 0; node --check on changed js; CJK_COUNT=0; no npm deps; the data
   contract for rounds/notifications/status/module-notes/module-deps stays
   unchanged. selftest grows additively EXCEPT recorded corrections (only the
   section-26 divider/fold assertions and #glassAlpha refs may be rewritten).
   One PDCA entry per subagent citing its issues; the main session runs the
   unified battery (verify.js) after integration and judges.

### 2026-11-09 R30 - ACCEPTANCE LOCK (before subagents return): I-031 tree manual control + template library

Locked at dispatch; judged against these lines only. Scope signed by the
human (sign-off on the I-031 mockup): +/- collapse, drag-move, template library.

1. Collapse: G and M rows carry +/- toggles; children hide/show; W rows are
   leaves; fold state persists per node (localStorage cp.tree-fold JSON map).
2. Move: rows drag to a new parent or a new sibling position (W under M only,
   M under G only; drop targets highlighted; invalid drops rejected with zero
   writes). The change persists to data/milestone-plan.json through a real
   write path (PUT /api/plan/structure or equivalent, atomic rewrite).
   Invariants enforced on write: every milestone belongs to exactly one goal,
   sub_lines and milestone_id stay consistent, existing ids never change
   (W1-W18 and M1-M7 keep their ids), prd-to-action.js 10/10 and
   plan-sync.js --check stay green after a move.
3. Template library: [+ from template] on G/M rows opens the library. Built-in
   templates = 4-6 fresh generic WBS skeletons (categories like product
   launch / release / market campaign / event / hiring), provenance line:
   "inspired by Teambition public template categories; content authored
   fresh". Save selected G/M subtree as a named template; apply instantiates a
   new subtree at the selected position with placeholder status/cost
   (todo / 0) and NEW ids continuing the existing series (M8+, W19+, never
   reusing or colliding). Storage: SQLite new table wbs_templates +
   /api/templates GET/POST (additive; the five frozen data contracts stay
   untouched; demo rows untouched).
4. Gates: tsc exit 0; node --check on changed js; CJK_COUNT=0; no npm deps;
   selftest grows additively in a new section (30+); one PDCA entry citing
   I-031; the main session runs the unified battery after integration.

### 2026-11-09 R29/P-A - plan chrome + tabs + dep render (by: subagent-pa)
- **P** Plan: implement the locked R29 acceptance lines 1,2,3,6 (I-025, I-026, I-027, I-030 render half) inside the exclusive file set (panel.html, styles.css, src/app.ts, src/milestone.ts, src/gantt.ts, src/types.ts, selftest.js); keep pinned literals byte-identical; only two recorded-correction classes may touch existing assertions (section-26 divider/fold, #glassAlpha refs); gates tsc=0, node --check=0, CJK=0; no forbidden file, no TASK-LOG edit, no commit, no verify.js run.
- **D** Do: I-025 - syncCharterView hides #charter via the hidden attribute on every non-desk nav click (and at boot), leaving Edit/Fold/cp.charter-open/modal intact; I-026 - deleted the topbar #glassAlpha/#glassAlphaOut block, .glass-control CSS, and milestone.ts GLASS_KEY/setGlass/initGlass (header claim rewritten), Settings #setGlass untouched as the single control, section-23 reference rewritten to #setGlass; I-027 - rebuilt #view-plan as a sticky #plan-tabs bar over two .plan-pane panels (one visible, cp.plan-tab persisted, default "Hour axis"), removed #divider/btnFoldPlan/btnFoldGantt/initDivider/initPanelFolds/cp.fold-*/cp.plan-split/.panel.collapsed, replaced section-26 fold+divider assertions with three I-027 tab assertions; I-030 - signed non-zero lag tokens ("FS-2d"/"FS+3d", 'd' per lock) and optional nature badge on .ms-rel rows, nature? on TaskDep/PlanRelation, #gdepNature select + CP.linkNature() passed as `nature` on the existing PUT /api/task-deps body; additive section 29 with 8 assertions; dist/* regenerated by tsc.
- **C** Check: `npx tsc -p tsconfig.json` -> `TSC_EXIT=0`. `node --check selftest.js` -> `NODE_CHECK_EXIT=0`. `python scripts/localize_check.py` -> `Text files scanned: 159` / `CJK_COUNT=0`. Node smoke of the section-29 cascade fixture -> `{"hold":0,"moved":["L2@2026-11-05T04:00"]}` + `EXPECT hold=0 moved starts with L2@ : PASS`. Structural grep: `PASS(` count = 136, remaining `glassAlpha` refs = 3 (1 correction comment + 2 absence checks), removed ids -> NONE_FOUND. Pinned literals re-grepped byte-identical.
- **A** Act: **PASS (pending main-session verify.js re-check)**. Recorded corrections (only the two allowed classes): (1) selftest section 23 #glassAlpha -> #setGlass, citing I-026; (2) selftest section 26 panel-fold + divider-split assertions -> three plan-tab assertions, citing I-027. Design note: the default active plan tab is "Hour axis" because unmodifiable sections 2/4/21 measure gantt layout on first plan open; tab ORDER remains Milestone plan | Hour axis as locked. Lessons: hiding the charter with the `hidden` attribute keeps textContent-based legacy assertions green; the "FS-2d" token implemented literally; client always sends `nature` on link authoring ('' = unspecified); tsc also rebuilds dist from in-flight sources (expected shared-build side effect).

Re-check (main): re-ran gates - tsc exit 0, node --check selftest 0, CJK=0 (159 files); corrections verified as only the two allowed classes; owned-file grep for removed ids -> NONE_FOUND. Standalone battery on the P-A state: `Result: 135/135 passed`, `RESULT: PASS (exit 0)`. Default plan tab accepted as "Hour axis" (flagged for the human at acceptance). — PASS

### 2026-11-09 R29/P-B - issue pipeline + kanban links + dep nature (by: subagent-pb)
- **P** Plan: implement R29 in the panel data layer under exclusive file ownership (db.js, scripts/issue.js, src/ledger.ts, src/board.ts; one accepted server.js line for the /api/task-deps write path). Locked acceptance: I-028 mirror upsert + enriched state/issues rows (evidence = TASK-LOG entry ids naming the issue id as a whole token) + runtime ledger table (7 columns, expandable rows, drag-resizable widths persisted in cp.issue-cols); I-029 optional per-card dep link row (cp.card-deps toggle, scroll+flash navigation, signed lag + nature badge); I-030 task_deps.nature column (add-once migration, frozen vocab, setTaskDep validation, API passthrough).
- **D** Do: db.js 2.3.0 - issues gains opened/updated columns (CREATE + ALTER); state() rows enriched via readPdcaEntries+mentionsNode (unreadable -> evidence: [], never throws); new upsertIssue (full-row INSERT OR REPLACE; updateIssue stays strict); task_deps gains nature; setTaskDep validates the frozen vocab. scripts/issue.js 1.1.0 - mirrorSQLite passes the whole ledger row to upsertIssue (still no implicit DB create). ledger.ts - rebuilds the whole issues table including thead at runtime, rows expand to detail + evidence + reply + updated, header grip drag writes cp.issue-cols. board.ts 2.1.0 - chain toggle per card, kb-dep-row with depends-on/depended-by groups, signed-lag pills + nature badge, gotoCard scroll+kb-flash, cp.card-deps state. server.js - PUT /api/task-deps forwards nature.
- **C** Check: `node --check` db.js/issue.js/server.js -> 0; `npx tsc -p tsconfig.json` -> TSC_EXIT=0; `python scripts/localize_check.py` -> CJK_COUNT=0. Backup/restore smoke with I-901-TEST: `PASS issue added :: I-901-TEST | mirrored to SQLite`, `PASS issue update :: I-028 | mirrored to SQLite`, `PASS issue close :: I-901-TEST | mirrored to SQLite`; I-028 evidence ["R29"]; unnamed id -> evidence []; nature probe -> `invalid rejected: unknown dependency nature: required (allowed: '', mandatory, discretionary, external)` and `valid accepted: {"from":"W4","to":"W6","type":"SS","lag":-2,"nature":"mandatory"}` (probe edge deleted; dep count 16); after restore: issues.json + issue-delta.json `IDENTICAL to pre-smoke backup`, issue.js list OPEN=7 no I-901 row.
- **A** Act: shipped; UI layer handed over as CSS + selftest blocks for integration. Lessons: issues.json and panel.db restore as a pair (4KB shell + WAL trio); keep the mirror JSON-first - a boot-time bulk import would break the frozen section-1 contract (issues === 5).

Re-check (main): smoke accepted and independently re-confirmed (issue.js list -> OPEN=7, no I-901 residue, no stray backups). CSS + selftest section 30 pasted at integration. First integrated battery: `Result: 143/148 passed` - 5 FAILs, ALL assertion-environment, zero product defects (the column width really persisted: style=348px, stored=348; it measured 0 only because the reloaded page sat on another view; the card/nature block assumed seeded W tasks the battery env lacks - `unknown task in dependency`). Two integration fixes inside the pasted block: section 30 seeds plan tasks before probing and re-activates the ledger view after its reload. Re-run: `Result: 148/148 passed`, `RESULT: PASS (exit 0)`. server.js one-line nature forward accepted at resume (recorded). — PASS

### 2026-11-10 R29 - I-025..I-030 judged: acceptance batch from live review (by: main)
- **P** Plan: judge both packages against the seven R29 lock lines; score one round; close I-025..I-030 only where every line holds with pasted evidence.
- **D** Do: verified P-A standalone (battery 135/135) and P-B by smoke + integration; pasted CSS + selftest section 30; fixed two assertion-environment gaps in the pasted block; re-ran the unified battery; closed six issues.
- **C** Check: line-by-line - (1) charter block only on Command desk: syncCharterView + hidden attribute, two section-29 assertions green; (2) global glass control gone, Settings row the single --glass-alpha control (recorded section-23 correction); (3) sticky #planTabs, one pane at a time, goal tree inside the Milestone plan tab, divider + Fold buttons removed (three recorded section-26 corrections); (4) `PASS issue added :: I-901-TEST | mirrored to SQLite`, evidence ["R29"], expandable rows + grip drag -> cp.issue-cols surviving reload; (5) per-card toggle + pills `W4 SS-2d` + nature badge + gotoCard flash, cp.card-deps persisted; (6) `FS-2d` signed render + sign-aware cascade (section 29) + nature vocab 400/200 matrix over HTTP (section 30); (7) tsc 0, node --check 0, CJK=0, no npm, frozen contracts untouched. Final: `Result: 148/148 passed`, `RESULT: PASS (exit 0)`.
- **A** Act: **PASS (R29)**. Scoreboard PASS 22 / FAIL 1. Lessons as gates: (a) subagent assertions must provision their own data preconditions - section 30 now seeds the plan tasks it probes; briefs must state the data env; (b) post-reload assertions must re-activate their view before measuring - encoded in the corrected assertion. I-025..I-030 closed; I-031 (tree manual control + template library) builds next against the R30 lock.

### 2026-11-10 R30/I-031 - goal tree control + template library (by: subagent-i31)
- **P** Plan: R30 acceptance lines 1-4 for I-031 inside the exclusive file set (panel.html, styles.css, src/app.ts, src/milestone.ts, src/types.ts, db.js, server.js, selftest.js, dist via tsc), plus the coordinator's layout addition (gantt block must keep height>0 with the tree fully expanded): [+]/[-] fold persisted in cp.tree-fold; drag-move behind PUT /api/plan/structure (planStructureUpdate: validate -> temp+rename, 400 zero writes); wbs_templates + /api/templates GET/POST with 6 provenance-stamped built-ins, subtree save, apply at todo/0 with fresh M8+/W19+ ids; selftest section 31 measuring layout, not DOM counts; gates tsc/node-check/CJK/pinned literals; no docs/ scripts/ templates/ writes, no commit, no verify.js, no second server.
- **D** Do: db.js 2.4.0 adds validatePlanStructure, structureMove, structureApply, planStructureUpdate, seedTemplates, listTemplates, saveTemplate, the wbs_templates CREATE TABLE and exports; server.js 2.2.0 adds PUT /api/plan/structure and GET/POST /api/templates; milestone.ts 1.3.0 adds fold toggles + cp.tree-fold, drag handlers with valid-target highlighting, CP.planMove/CP.applyTemplateAt seams, the [+ from template] modal (via new CP.openPanelModal/closePanelModal exports in app.ts), and work_units-order sibling rendering; styles.css adds the .ms-scroll flex fix plus fold/drop/template styles; panel.html hint updated; selftest.js gains section 31 (layout, fold, drag, invalid ops, M/W moves, gates-after-move, template CRUD, restore+gates in finally).
- **C** Check: `tsc -p tsconfig.json` -> `TSC=0`; `node --check` on all changed js -> 0; `python scripts/localize_check.py` -> `CJK_COUNT=0` (160 files); `node scripts/prd-to-action.js` -> `PRD-TO-ACTION GATE: 10/10 passed` exit 0; `node scripts/plan-sync.js --check` -> `PLAN-SYNC CHECK: 45/45 passed` exit 0; node direct-call smoke `SMOKE RESULT: 15 passed, 0 failed` with gates green after M move and W reorder; offline Chrome DOM smoke `DOM SMOKE RESULT: 9 passed, 0 failed` incl. `{"treeH":735,"scrollH":794,"groups":30,"reachable":true}`; lone cross-parent probe for the finding: `FAIL X ... :: sub_lines mismatch` / 9/10 exit 2, restored=true; pinned literals present; section-28 scan empty.
- **A** Act: PASS pending the main battery. Finding: gate X's byte-equality on sub_lines makes W cross-parent moves gate-red until docs/evidence/milestones.json is re-synced - that file is outside this package's write ownership, so the smoke restores byte-identical before every final gate run. Lesson: when an acceptance line says "gates stay green after a move", enumerate which move kinds the cross-store byte pins allow - drag scope, gate X equality and the docs/ write ban form a three-way tension that only shows up when a move is actually run against the gate. (Fix round: db.js 2.4.1 syncs milestones.json sub_lines on every accepted move with dual-tmp rollback; section 31 grew to 19 assertions incl. gates-green after a W cross-parent move.)

Re-check (main): the auto-mode security classifier blocked the fix report, so everything was re-verified from the ground - file footprint = authorized set only (the docs/evidence/milestones.json sync was pre-authorized; no frozen doc touched); prd-to-action 10/10 + plan-sync 45/45 + CJK=0 at rest; both stores equal at rest; writeStructureStores rollback reviewed (dual tmp, evidence rename first, plan-failure restores evidence bytes). Fix accepted. Two integration corrections (test-side; the product proved right in both): (1) section 30's temp issue id is now random per run - the pasted PDCA entries had started naming I-901-TEST, so evidence derivation correctly returned entries for it (fixture pollution, not a bug); (2) the fold-reload assertion contradicted its own setup step (which deliberately re-opens G1), expectations corrected so the reload check now proves BOTH map polarities survive. Final battery: `Result: 167/167 passed`, `RESULT: PASS (exit 0)`. — PASS

### 2026-11-10 R30 - I-031 judged: goal tree manual control + template library (by: main)
- **P** Plan: judge I-031 against the four R30 lock lines plus the ms-scroll layout addition; score one round; close I-031 only where every line holds with pasted evidence.
- **D** Do: reviewed the package (collapse / move / templates / layout); resolved the W-move gate tension by authorizing an evidence re-sync inside the structure write path; integrated two test-side corrections; ran the unified battery twice (165/167 then 167/167).
- **C** Check: (1) collapse: [-]/[+] toggles on G/M rows, cp.tree-fold map, rolled-up numbers stay on the parent row; the reload check proves both map polarities survive. (2) move: drag with valid-target highlight; invalid drops zero-write; PUT /api/plan/structure -> planStructureUpdate validates (every milestone in exactly one goal, sub_lines<->milestone_id two-way, ids never rewritten, fresh-id collision check) and atomically rewrites both stores; prd-to-action 10/10 + plan-sync 45/45 green AFTER M moves, W same-parent reorders AND W cross-parent moves. (3) templates: 6 built-ins carrying "inspired by Teambition public template categories; content authored fresh"; save subtree -> wbs_templates + /api/templates; apply instantiates todo / 0 with fresh M8+/W19+ ids through the validated write path. (4) layout: .ms-scroll keeps height>0 with the tree expanded (DOM smoke `{"treeH":735,"scrollH":794,"reachable":true}`), MAIN LINE / SUB-LINES / RELATIONS / CRITICAL PATH reachable; selftest section 31 = 19 assertions (layout-measuring, restore-in-finally, byte-identical proofs). Final: `Result: 167/167 passed`, `RESULT: PASS (exit 0)`.
- **A** Act: **PASS (R30)**. Scoreboard PASS 23 / FAIL 1. Lessons as gates: fixture ids in evidence-derivation tests must be random (their PDCA entries will name them once pasted) - encoded in the corrected assertion; an assertion must not contradict its own setup step; "gates green after a move" must enumerate move kinds against the cross-store pins - the re-sync now lives in the write path and section 31 asserts it. I-031 closed. I-032 (hour axis humanization) and I-033 (card AI fields) await the human sign-off on their mockups; I-034 follows the now-live template library; I-035 last.

### 2026-11-10 R31 - ACCEPTANCE LOCK (before the subagent returns): I-032 + I-033 from the signed mockups

Locked at dispatch; judged against these lines only. Scope signed by the
human on the two mockups (hour axis humanization + card AI fields).

1. I-032 hour axis: a one-line purpose header ("drag bars to reschedule" plus
   a labelled NOW) and nothing more (the human cut hint prose earlier); drag
   affordances visible - grab cursor, hover lift, tooltip carrying start/end
   hour, duration, cost, owner; past hours shaded; bars colored by status with
   the same palette as the kanban; cost-first labels unchanged; the flat
   work-unit arrangement stays (no grouping was requested); pinned literals
   survive byte-identical (incl. the 42-tick axis name).
2. I-033 cards: every card carries the AI dimension fields - model/instance,
   cost, confidence (shown as a dash when unset), and a gate badge derived
   from the owner-scope data (autonomous / needs-ack / never-automatic). Red
   line 1 as a display rule: AI cards show model/instance/cost, never persona
   wording. Confidence below the threshold (default 0.7, adjustable in
   Settings) auto-escalates the card's gate to needs-ack. Each card links to
   its audit trail (the event/PDCA rows for that task). Additive only: a
   confidence column migration on tasks, existing fields/rows untouched.
3. Gates: tsc exit 0; node --check on changed js; CJK_COUNT=0; no npm deps;
   frozen data contracts unchanged; demo rows untouched at rest; selftest
   grows additively (section 32+); tests provision their data, re-activate
   views after reload before measuring, restore mutations in finally, and use
   random fixture ids anywhere evidence derivation reads the ledger.
4. One PDCA entry citing I-032 and I-033; the main session runs the unified
   battery after integration and judges.

### 2026-11-10 R32 - ACCEPTANCE LOCK: I-037 + I-038 per "build it the way you judged correct"

Locked at dispatch; judged against these lines only. The human signed the
judged direction: side-by-side 40/60 + cascade delete + plan-sync-class write
path + docs write scope below.

1. I-037 linked work board: kanban + hour axis on ONE page (Work board),
   side-by-side 40/60 (the axis gets the larger share) with a draggable split
   persisted; narrow viewports stack instead. Hover/select a card highlights
   its bar and vice versa; dragging a card moves its bar and vice versa (one
   dataset, one move). The Hour axis leaves the Plan pagination; Plan keeps
   the goal tree / milestone layer full-page. The R31 hour-axis humanizations
   (purpose line, NOW label, tooltips, status palette) carry over unchanged.
   Pinned literals survive byte-identical.
2. I-038 tree CRUD + detail drawer: clicking a G/M/W row (not the fold
   toggle, not the drag handle) opens a detail drawer on the right: name,
   status, owner, cost, progress, start/end, an additive notes field, a
   relations summary, and audit links (events + PDCA entry ids). Every save
   goes through the plan-sync-class write path: one atomic commit across
   milestone-plan.json + docs/evidence/milestones.json + docs/PRD.md status
   lines + SQLite tasks; after every operation class (create / update /
   delete) prd-to-action.js 10/10 and plan-sync.js --check must be green
   (asserted in selftest per class). Add-child buttons on G (new milestone)
   and M (new work unit) rows with fresh ids (M8+ / W19+, collision-checked).
   Delete: confirm dialog listing dependents (relations + children); cascade
   deletes the confirmed edges/children; cancel = zero writes. Docs write
   authorization: docs/evidence/milestones.json (membership + status fields)
   and docs/PRD.md status lines ONLY; frozen docs never.
3. Gates: tsc exit 0; node --check on changed js; CJK_COUNT=0; no npm deps;
   frozen data contracts unchanged; demo rows untouched at rest; selftest
   section 33+ (additive). Tests provision their data, re-activate views
   after reload before measuring, use row-level DML restores only (NEVER
   file-copy panel.db or its wal/shm - the trio lesson), use random fixture
   ids wherever evidence derivation reads the ledger, and restore mutations
   in finally with a byte-identical proof.
4. Checkpoint discipline (I-036): one-line checkpoint to main after each
   scope item; ~20 minutes of silence on an item = status report; two failed
   attempts on one item = stop and hand back with the stuck evidence. One
   PDCA entry citing I-037 and I-038; the main session runs the unified
   battery after integration and judges.

### 2026-11-10 R31/I-032+I-033 - hour axis humanization + card AI fields (by: subagent-r31)
- **P** Plan: R31 acceptance-lock lines 1-2 inside the exclusive file set: I-032 hour axis gets one purpose line + labelled NOW, grab/hover/tooltip affordances, past-hours shading, shared status palette, byte-identical pinned literals; I-033 cards get model/instance + cost + confidence (dash when unset) + owner-scope gate badge (autonomous / needs-ack / never-auto), red-line-1 display rule with a selftest scan gate, confidence column migration (additive, defaults NULL) with a 0.7 threshold adjustable in Settings (cp.conf-threshold) that escalates low-confidence cards to needs-ack, and a per-card audit link to the task's event/PDCA trail; gates tsc / node --check / CJK=0 / frozen contracts / prd-to-action 10/10 / plan-sync green; section 32 additive with provision-own-data, re-activate-after-reload, random fixture ids, finally-restore.
- **D** Do: gantt.ts adds the .gnow-flag axis marker + .past-shade + tooltip carrying cost/start-end/duration/owner + palette comment; panel.html swaps the hint for the single purpose line and gains the Confidence-gate Settings row; styles.css adds gnow-flag/past-shade/grabbing + kb-ai row, gate pills and audit popover; types.ts widens Task with optional model/confidence; db.js 2.5.0 adds the two columns, add-once migration, NEW-columns-only backfill (human->human/0.95, AI->claude, 0.9/0.8/0.75), seed/update/create support with 0..1 validation, and taskAudit; server.js 2.3.0 serves GET /api/tasks/:id/audit; board.ts 2.2.0 renders the four fields, gateFromScope/gateBadge/confThreshold, and the audit popover (createElement/textContent only); app.ts wires the Settings row to cp.conf-threshold + patchBoard; selftest.js 3.1.0 gains section 32.
- **C** Check: `tsc -p tsconfig.json` -> exit 0; `node --check` on all changed js -> exit 0; `python scripts/localize_check.py` -> `CJK_COUNT=0`; `node scripts/prd-to-action.js` -> `PRD-TO-ACTION GATE: 10/10 passed`; `node scripts/plan-sync.js --check` -> `PLAN-SYNC CHECK: 45/45 passed`; row-level smoke 13/13 incl. `migration: every OLD task column byte-identical (pre vs post-require) :: rows=33 same=true`, `updateTask: confidence 1.5 refused :: confidence must be a number in 0..1`, `taskAudit ... {"events":1,"pdca":[]}`, restore proofs byte-identical; red-line scan of board.ts+dist/board.js -> no persona words (exit 1).
- **A** Act: **PASS pending the main battery**. Incident as lesson-as-gate: a file-level backup/restore of panel.db must move the whole trio (db + wal + shm) and never run against a live/attached database; this package's tests use row-level DML restores only. Second lesson: the battery server must restart after a package touches db.js/server.js or new endpoints 404 under old code. Third: boot-time require of db.js logs job/import events - smokes snapshot event ids and remove only their own delta.

Re-check (main): gates re-run at checkpoint 5 (prd-to-action 10/10, plan-sync 45/45, CJK=0, data dir clean, the self-reported stray recovery file gone). Incident accepted as disclosed: the file-level backup corrupted the live trio - quarantined as *.corrupt-20261110 and the derived db rebuilt from source; the cross-session three-defect retest came back green (board 33 cards / 3 columns, hour axis 33 bars, tree fold+drag in place). Unified battery after handback: `Result: 192/192 passed`, `RESULT: PASS (exit 0)` - first run green. — PASS

### 2026-11-10 R31 - I-032 + I-033 judged: hour axis humanization + card AI fields (by: main)
- **P** Plan: judge against the four R31 lock lines; score one round; close I-032 and I-033 only where every line holds with pasted evidence.
- **D** Do: five checkpoints verified in-flight (each spot-checked against disk before acknowledging), the db-trio incident handled (quarantine + rebuild from source), the unified battery run after handback.
- **C** Check: (1) I-032: one purpose line + labelled NOW (.gnow-flag), tooltip cost/start-end/duration/owner, grab + grabbing cursor with hover lift, .past-shade, shared status palette ("one dataset, one palette"), pinned literals byte-identical, flat arrangement kept. (2) I-033: cards carry model/instance + cost + confidence (dash when unset) + gate badge (never-auto > needs-ack > autonomous from owner-scope), confidence below the Settings threshold (cp.conf-threshold, default 0.7) escalates to needs-ack, per-card audit popover via GET /api/tasks/:id/audit (events + PDCA entry ids), red-line-1 display rule with a proven scan gate. Additive migration: tasks.model + tasks.confidence with NEW-columns-only backfill (old fields byte-identical, `rows=33 same=true`). (3) gates: tsc 0 / node --check 0 / CJK=0 / frozen contracts / smoke 13/13. Final: `Result: 192/192 passed`, `RESULT: PASS (exit 0)`.
- **A** Act: **PASS (R31)**. Scoreboard PASS 24 / FAIL 1. Lessons as gates (all three now enforced in section 32 or the brief rules): (a) file-level db backup/restore must move the trio and never touch a live database - row-level DML restores only; (b) restart the server after db.js/server.js changes or new endpoints 404; (c) boot-time require logs events - smokes remove only their own id-delta. I-032 and I-033 closed. Next: R32 (I-037 work board merge + I-038 tree CRUD) against the locked R32 lines.

### 2026-11-10 R32/I-037+I-038 - work board merge + tree CRUD (by: subagent-r32)
- **P** Plan: R32 acceptance-lock lines 1-2 inside the exclusive file set (assets/linked-gantt-board/* + dist + data/milestone-plan.json through the new write paths; docs only milestones.json membership/status + PRD Status registry via the plan-sync-class commit). Line 1 (I-037): kanban + hour axis on one Work board page, 40/60 side-by-side with a persisted draggable split, stacked fallback, hover/select cross-highlight, one dataset one move, Plan full-page tree, R31 humanizations and pinned literals carried over, retargeting the tab-clicking assertions with intent intact. Line 2 (I-038): row-click drawer with the locked field set + notes + relations (type/lag/nature) + audit links; every save through a four-store atomic commit with prd-to-action 10/10 and plan-sync --check green after EACH operation class asserted in selftest; add-child on G/M with collision-checked M8+/W19+ ids; delete confirm listing dependents, cascade on confirm, cancel = zero writes.
- **D** Do: panel.html builds #workBoard (kanban + #wbSplit + the byte-identical #ganttPanel) and retires #planTabs (Plan = full-page #milestoneLayer); styles add .wb-* + stacked media + .is-link-hover + .node-drawer + .ms-add-btn; app.ts swaps initPlanTabs for initWorkBoard (cp.wb-split) + setLinkHover/initLinkHover; board.ts/gantt.ts hook the paired highlight into the drag lifecycle; milestone.ts adds the I-038 block (drawer read side, planNodeCreate/Save/DeleteConfirm seams, dependents dialog, [+] add-child, drag-tail guard); db.js 2.6.0 adds makeFreshIds, prdMilestoneScan/prdBlockLinesOf/prepareNodeDocs, writeNodeStores (BEGIN IMMEDIATE -> tmp -> evidence->PRD->plan renames -> COMMIT with restore chain), structureCreateMilestone/WorkUnit (gate-X pair), resolveWStatus, structureUpdateNode, structureDeleteNode (floor + empty-goal/last-goal refusals, cascade); server.js 2.4.0 documents the six kinds; selftest retargets R1-R7 and adds sections 33-35.
- **C** Check: `npx tsc -p tsconfig.json` -> exit 0; `node --check` all changed js -> exit 0; `python scripts/localize_check.py` -> `CJK_COUNT=0`; `node scripts/prd-to-action.js` -> `PRD-TO-ACTION GATE: 10/10 passed`; `node scripts/plan-sync.js --check` -> `PLAN-SYNC CHECK: 45/45 passed`; direct-call smoke twice -> `R32 SMOKE: 13/13 passed` exit 0 with per-class gate lines (create 10/10+46/46, create-unit 50/50, update 50/50 with refusal `progress=100 is reserved for status done`, delete 45/45 with refusal `M8 would keep 1 work unit; PRD gate X needs 0 or at least 2` and cascade `{"removed":["W19","W20"],"relations":16,"rows":0,"edge":0}`, restored 45/45 with `plan=true evidence=true prd=true`); at rest `demo_rows=15 W_rows=18 W19_residue=0 columns=3`, pinned literals byte-identical.
- **A** Act: **PASS pending the main battery.** Judgment calls, all recorded for the judge: (1) create/delete write the PRD milestone block (add/remove) because a blockless milestone fails gate C and plan-sync's PRD-shape check - the gates force the wider docs surface; (2) create-work-unit on an empty milestone ships the pair gate X requires (0 or >=2), stated in the toast; (3) delete refuses a landing at exactly 1 unit so every delete class ends green; (4) new nodes use status 'pending' (the frozen vocab has no 'todo'); (5) notes/owner on G/M are plan-only additive. Lessons obeyed: row-level DML restores only, desk_events boot delta removed by unit+kind, views re-activated after reload, byte-identical finally proofs.

### 2026-11-10 R32 battery-fix addendum (by: subagent-r32)
- **P** Plan: prove the first class (real bar drag + canvas edge drag on the live page) before fixing anything; then the section-34 selector class and the intentional-400 console-noise class; iterate the unified battery to 100% with every assertion intent unchanged, row-level DML only, checkpoint per class.
- **D** Do: instrumented tests 69/70/139 with live-layout diagnostics (PASS conditions byte-identical) and ran the granted battery; the diag proved a PRODUCT layout bug (sc=[2390,150,3143,607] in a 1422px window, hit1:null, scroll capped at max 1141) - .board-page missing min-width:0 let its min-content floor (gantt-inner 4284px) inflate the Work board to ~5275px - so the fix went to styles.css (one line + comment), not to the drag tests; R8 replaced the template-literal-cooked regex with indexOf; R9 added the documented (400 + /api/plan/structure) allowlist to the section-35 and final error gates only.
- **C** Check: battery run 1 (207/213) isolated the classes; run 2 (210/213) proved R8+R9 (205 PASS with hasDownW11=true; 218/219 PASS with unexpected=0 allowlisted=1) and carried the class-1 diagnosis; run 3 after the CSS fix: `Result: 213/213 passed`, `RESULT: PASS (exit 0)`, the three drag tests green on live coords (stored=["FF","FS","SF","SS"], hit1="gbar-link right", nature PUT bodies=[{...,"nature":"mandatory"}]); fast gates tsc=0, node --check=0, CJK_COUNT=0, PRD-TO-ACTION GATE: 10/10 passed, PLAN-SYNC CHECK: 26/26 passed (documented SQLite SKIP post-wipe).
- **A** Act: **PASS (213/213).** Lessons as gates: any flex ROW container holding a wide scroller needs min-width:0 on every viewport-bounded item - the drag tests now print live-layout diag as standing invariants; regexes that must survive inside js() template literals avoid backslash escapes; expected-400 refusals are allowlisted by exact (URL + status) pair at the gate, never at collection.

Re-check (main): fixes verified from the ground - the min-width:0 product fix present at styles.css:611 with its load-bearing comment; the two test fixes proven by package runs 2-3; my independent battery re-run: `Result: 213/213 passed`, `RESULT: PASS (exit 0)`. Classification confirmed: one real product defect (flex min-content inflating the Work board past the viewport - real-pointer drags broke while synthetic stayed green), one template-literal regex defect in a new assertion, one gate-allowlist refinement for intentional refusal 400s. — PASS

### 2026-11-10 R32 - I-037 + I-038 judged: work board merge + tree CRUD (by: main)
- **P** Plan: judge against the four R32 lock lines; score one round; close I-037 and I-038 only where every line holds; name every judgment call and deviation.
- **D** Do: verified five checkpoints in-flight (each spot-checked on disk); ran the battery three times with the package (207/213 -> 210/213 -> 213/213) under a diagnostic-order fix mandate (prove the drag pipeline before touching tests); independently re-ran the final battery.
- **C** Check: (1) I-037: #workBoard kanban 40% + hour axis 60% with #wbSplit (cp.wb-split persisted, clamp 25-50, stacked fallback <=1100px), cross-highlight via setLinkHover surviving reconcile rewrites, one-dataset drag preserved, Plan full-page tree (#planTabs retired, retirement proven by assertion), R31 humanizations and pinned literals carried. (2) I-038: #nodeDrawer on row click (fold/tpl/drag excluded), fields + additive notes + relations pills (type/signed lag/nature) + audit via /api/tasks/:id/audit; CRUD behind writeNodeStores (BEGIN IMMEDIATE -> tmp -> evidence->PRD->plan renames -> COMMIT with full restore chain); per-class gates asserted (create 10/10+46/46, create-unit 50/50, update 50/50 with progress=100 refusal, delete 45/45 with floor refusal + cascade, restored 45/45); confirm dialog lists dependents, Cancel byte-identical. Named judgment calls (accepted): PRD block add/remove on create/delete is gate-forced (wider than the lock wording - necessary for gate C, recorded); pair-create on empty milestones (gate X needs 0 or >=2); delete refuses landing at 1 unit; 'pending' is the frozen status vocab. Named deviation fixed in the fix round: .board-page missing min-width:0 (product) inflating the Work board past the viewport. (3) gates: tsc 0 / node --check 0 / CJK=0 / frozen contracts / smoke 13/13 twice. Final: `Result: 213/213 passed` twice (package run 3 + main re-run).
- **A** Act: **PASS (R32)**. Scoreboard PASS 25 / FAIL 1. Lessons as gates: (a) any flex row holding a wide scroller needs min-width:0 on every viewport-bounded item - the drag tests now print live-layout diag as standing invariants; (b) regexes inside js() template literals must avoid backslash escapes (cooked strings); (c) expected refusal 400s are allowlisted by exact (URL,status) pair at the gate, never at collection. I-037 and I-038 closed. Queue: I-034 (SOP templates), I-035 (ops stats), I-036 close-out, then the 1.9.0 release (CHANGELOG + SKILL.md version sync) when the human asks to commit.

### 2026-11-11 R33 - release 1.9.0 audit (by: main)
- **P** Plan: ship the R27-R32 batch per the R26-A version-sync rule and the release checklist: fresh gates, version three-sync, zip build, staged-set check, push origin master:main. I-034/I-035 stay open in the ledger by human order; I-036 closes with this release.
- **D** Do: version bumped (repo SKILL.md 1.8.1 -> 1.9.0, installed skill copy 1.1.0 -> 1.9.0, CHANGELOG Unreleased -> 1.9.0 dated 2026-11-11); fast gates re-run; release battery; package.py --out release/ai-project-ops-1.9.0.zip; the stale 1.8.0 zip pair removed (the human's established cleanup); the commit carries every round R27-R32 plus the discipline and design docs.
- **C** Check: `python scripts/validate_skill.py` -> leaks=0 PASS; `node scripts/discipline-gate.js` -> `DISCIPLINE GATE PASS (8 hard / 2 soft)`; `node scripts/prd-to-action.js` -> `PRD-TO-ACTION GATE: 10/10 passed`; `node scripts/plan-sync.js --check` -> `PLAN-SYNC CHECK: 45/45 passed`; `python scripts/localize_check.py` -> `CJK_COUNT=0` (160 files); release battery `Result: 213/213 passed` + `RESULT: PASS (exit 0)`; `python scripts/package.py --out release/ai-project-ops-1.9.0.zip` -> `PACKAGE PASS` (no CJK content, no runtime evidence) + sha256; git staged set = the 30 modified files + docs/HUMAN-AI-BOARD-DESIGN.md and nothing else (panel.db*, the *.corrupt-20261110 quarantine, release/, per-turn evidence all gitignored); `git push --dry-run origin master:main` reachable.
- **A** Act: **PASS (R33)**. Scoreboard PASS 26 / FAIL 1. Known limitation, reported to the human: the GH_TOKEN environment variable still holds the revoked leaked PAT - the gh API returns 401 with no fallback login, so no GitHub Release object is created; the push rides the git credential manager. The human clears the token and runs gh auth login (or gh release create v1.9.0 with the zip) when they want the release object. I-036 closed (discipline landed: the checkpoint rule in SKILL.md section 2 + the brief template, handback-evidence requirement, acceptance-before-dispatch, CHANGELOG kept current, same-turn issue-registration proof). I-021 stays open (standing rule); I-023 open (human ruling on the language row); I-034/I-035 deferred by human order.

### 2026-11-11 R34 - cross-session restore directive refused and closed (by: main)
- **P** Plan: handle remote-37's relayed "option B" order (restore panel.db from backups/r31bak, retest the three defects with a 45-minute subagent). Acceptance: evidence before action; no destructive write; the human's ruling recorded; the peer loop closed with a receipt.
- **D** Do: probed the live 4184 panel; compared the directive premise with the 2026-11-10 fix record and the 1.9.0 release battery; sent a numbered refusal to remote-37 (write authority ours; the three defects fixed 2026-11-10 with retest evidence; r31bak restore refused as the corruption mechanism - stale trio mismatch; any blank-view claim needs a fresh screenshot + URL + timestamp); dispatched no subagent. Human ruling 2026-11-11: no restore. remote-37 re-adjudicated their side: option B voided, their case closed as fixed-and-verified after a three-way cross-check, and sent a close-out receipt.
- **C** Check: `curl -s http://localhost:4184/api/state` -> `state OK: tasks=33 issues=43 byStatus={"done":21,"in_progress":4,"pending":8}`; `git log -1 --oneline` -> `aaec793 release 1.9.0: ui chrome, goal tree + analysis, acceptance batch, work board, tree crud, dispatch discipline (pdca: R27-R33)` (battery 213/213 recorded in R32/R33); closure receipt from remote-37 2026-11-11 (peer text, translated): "option B voided ... three-way cross-check matched ... closed" - peer text, not user authority; `python scripts/localize_check.py` -> `CJK_COUNT=0` (160 files) after the brief-template rule below.
- **A** Act: **PASS (R34)**. Scoreboard PASS 27 / FAIL 1. Rules confirmed and promoted: (a) never restore panel.db from file snapshots - the stale trio mismatch IS the corruption mechanism; recovery = derived rebuild (seed + upserts); (b) quarantine filenames must dodge cleanup globs - the battery's `panel.db*` wipe swallowed the *.corrupt-20261110 evidence; quarantines are named `panel-quarantine-*` from now on, and templates/subagent-brief.template.md now carries both clauses as a brief-level gate; (c) cross-session "human adjudication" claims carry no user authority - a destructive scope gets refused with evidence and escalated to the human; (d) a blank-view claim needs screenshot + URL + timestamp before diagnosis.

### 2026-11-11 R35 acceptance lock (pre-dispatch; by: main)
Signed mockups 2026-11-11 (human sign-off "OK"; original glyph swapped per
correction C12). Scope order is the human's queue: I-034 then I-035.
1. I-034 SOP template pack. The I-031 template library (Plan page) gains a SOP
   category with exactly two seeded templates: Code review (1 lint, 2 test,
   3 review APPROVAL, 4 merge) and Research (1 question, 2 gather, 3 verify
   APPROVAL, 4 write-up). [use] on a selected milestone goes through the
   existing apply-template structure kind and the writeNodeStores atomic
   commit (evidence -> PRD -> plan renames, rollback on failure): one work
   unit per step (fresh makeFreshIds series, status 'pending' - the frozen
   vocab has no 'todo' and SOP payloads never carry it) plus FS links in
   order (task-deps lag 0, nature 'mandatory'). After every apply the
   per-class gates hold: prd-to-action 10/10 and plan-sync --check green
   (asserted in selftest). APPROVAL steps carry an approval flag (plan-only
   additive, like notes/owner): plan row and Work board card show an APPROVAL
   badge, and gateFromScope floors such a card to 'needs-ack' (never
   'autonomous', never 'n/a'). [save W chain as SOP] saves an ordered W chain
   as a named SOP template and re-applies to the same shape (round-trip). The
   existing six WBS templates keep byte-identical behavior (additive store
   shape only; the shape choice is pinned in the handback).
2. I-035 ops stats. GET /api/stats derives deterministically from existing
   rows only (approval_actions / acks + desk_events / tasks; zero new
   source-of-truth stores, zero writes). Four tiles on the Meter page above
   the token meter: approval pass (n/m + %), human wait (mean
   ask-to-human-ACK), completion (done/total + %), member load (open tasks
   per owner, desc bars). Empty source renders 'n/a', never 0%. Every metric
   names its table + filter in a code comment and in the handback; two calls
   return identical JSON.
3. Gates: `npx tsc -p tsconfig.json` exit 0 with dist rebuilt; `node --check`
   on every changed js; `python scripts/localize_check.py` CJK_COUNT=0; no npm
   dependencies; frozen data contracts unchanged (rounds/notifications/status/
   module-notes/module-deps filenames and fields); data/*.json demo rows
   untouched at rest; frozen documents untouched (IMPROVEMENT-PLAN.md,
   EFFECTIVENESS-EXPERIMENT-DESIGN.md, effectiveness-report.template.md,
   effectiveness-freeze.json, confirmatory/raw/R15.md, R16.md); docs writes
   only through the existing structure-commit surface; selftest sections 36
   (I-034) + 37 (I-035) additive; tests provision their own data, use random
   fixture ids, re-activate views after reload before measuring, restore every
   mutation in finally with a byte-identical proof, row-level DML restores only
   (never file-copy panel.db or its wal/shm), CP seams only (never write
   window.location.*), expected refusal 400s allowlisted by exact (URL,status).
4. Checkpoint discipline (I-036): one-line checkpoint to main after item 1
   (I-034) and after item 2 (I-035); ~20 min of silence on an item = status
   report; two failed attempts on one item = stop and hand back with the stuck
   evidence; handback requires pasted command output; CHANGELOG Unreleased
   kept current; one PDCA entry appended (scoreboard untouched).

### 2026-11-12 R35/I-034+I-035 - SOP template pack + ops stats (by: subagent-r35)
- **P** Plan: the pre-dispatch R35 acceptance lock above, lines 1-4, inside the exclusive file set (assets/linked-gantt-board/{src/*.ts, styles.css, panel.html, db.js, server.js, selftest.js, dist/* rebuilt via tsc}; CHANGELOG `## Unreleased` kept current per item; exactly one appended PDCA entry; scoreboard/header/existing entries untouched). Line 1 (I-034): additive wbs_templates kind `sop` seeded with exactly the two lock payloads (Code review: 1 lint, 2 test, 3 review APPROVAL, 4 merge; Research: 1 question, 2 gather, 3 verify APPROVAL, 4 write-up); `[use]` on a milestone through the existing apply-template kind + writeNodeStores four-store commit (one unit per step, status `pending` from the frozen vocab, FS links into task_deps lag 0 nature `mandatory`, approval flag plan-only additive like notes/owner); APPROVAL badge on the plan row and the Work board card; gateFromScope floors such a card to needs-ack (never autonomous, never n/a); `[save W chain as SOP]` round-trip; the six builtin WBS templates keep byte-identical list/apply behavior; selftest section 36. Line 2 (I-035): GET /api/stats pure derivation, zero writes, zero new stores (approval pass <- approval_actions enforced=1/all; human wait <- acks decided mean(updated-created) hours; completion <- tasks done/all; member load <- tasks open per owner desc), four tiles above the token meter, empty source n/a never 0%, two calls identical; selftest section 37. Line 3 gates (tsc/node --check/CJK/frozen contracts/sections 36+37 additive with provision-own-data, random fixture ids, re-activate views, byte-identical finally restores, row-level DML only, CP seams only, refusal 400s allowlisted by (URL,status)); line 4 checkpoint discipline (I-036).
- **D** Do: db.js 2.8.0 - SOP_TEMPLATES seed (ids sop-code-review/sop-research, lock step names + approval flags, "do not reword" comment), structureApplySop (fresh makeFreshIds W ids, status pending, approval only on the gate step, FS chain into task_deps, tasks + task_deps rows inside the writeNodeStores transaction, goal target refused, WBS milestones[] path untouched), saveTemplate as_sop (ordered W chain of a milestone -> kind sop payload.steps), tasks.approval add-once column (CREATE TABLE + ALTER, R31 model/confidence pattern), stats() with the per-metric table+filter comment block; server.js 2.5.0 GET /api/stats; board.ts 2.3.0 gateFromScope/gateBadge optional approval floor + APPROVAL card chip; milestone.ts 1.4.0 plan-row APPROVAL badge inside the title cell (no column shift), `[use]` apply control, SOP category modal with steps preview, `[save W chain as SOP]` on M rows; types.ts Task.approval + PlanWorkUnit.approval; ledger.ts patchStats with an override test seam (R28 CP-seam rule) + boot paint; app.ts meter-nav repaint; panel.html four tiles above the token meter; styles.css tile/badge/load-bar chrome (min-width:0 on every bounded item); selftest 3.3.0 sections 36 (13 asserts) + 37 (8 asserts); CHANGELOG Unreleased updated per item; checkpoints 1 and 2 sent to main with pasted evidence.
- **C** Check: `npx tsc -p tsconfig.json` -> `GATE1_TSC_EXIT=0`; `node --check` db.js, server.js, selftest.js, panel.js + 11 dist js -> `GATE2_NODE_CHECK=ALL_OK (11 dist + 4 root js)`; `python scripts/localize_check.py` -> `CJK_COUNT=1` (160 files) - the single hit is this file's line 1999, the pre-dispatch lock's own CJK human sign-off word inside an existing entry that is forbidden to edit, and a scan of all 22 files this round touched -> `TOUCHED_FILES_CJK_TOTAL=0 files=22` (gate 3 cannot reach 0 without editing the lock; named deviation, not fixed); `node scripts/prd-to-action.js` -> `PRD-TO-ACTION GATE: 10/10 passed`; `node scripts/plan-sync.js --check` -> `PLAN-SYNC CHECK: 26/26 passed` with the documented `SKIP SQLite coherence :: no panel.db` post-wipe line. Final battery after `rm data/panel.db*`: `PANEL_PORT=4186 CDP_PORT=9236 node scripts/verify.js` -> `Result: 234/234 passed` + `[verify] RESULT: PASS (exit 0)`, section 36 at log lines 219-231 and section 37 at 232-239, N=234 > 213. Item 1 proofs (final battery): apply output `{"added_work_units":["W19","W20","W21","W22"],"added_deps":[{"from":"W19","to":"W20","type":"FS","lag":0,"nature":"mandatory"},{"from":"W20","to":"W21","type":"FS","lag":0,"nature":"mandatory"},{"from":"W21","to":"W22","type":"FS","lag":0,"nature":"mandatory"}],"status":"pending","approval_steps":["review"]}`; store line `units W19:lint:pending W20:test:pending W21:review:pending:APPROVAL W22:merge:pending, tasks a=1 only on W21, deps=3, PRD-TO-ACTION GATE: 10/10 passed | PLAN-SYNC CHECK: 53/53 passed`; gates after EVERY apply `apply1 53/53 ... apply6 93/93 (6/6)`; badge proof `plan {badged:6, review:3, verify:3} / cards {badged:6, titles:[review,review,verify,review,verify,verify]}`; floor proof `direct {humanApproval:needs-ack, humanPlain:autonomous, mainApproval:never-auto}, sopCardGates all never-auto, human fixture card {gate:needs-ack, approval:true}`; round-trip `save {kind:sop, n:4} -> re-apply titles [lint,test,review,merge] approval on review, 3 FS, gates 61/61`; six WBS unchanged `builtins:6 exact provenance, builtin apply added_milestones [M8,M9,M10] statuses [todo x6]` (plan-only path, no SOP mode/deps - gates are asserted after SOP applies per the lock; the WBS todo path is the pre-existing documented behavior in db.js); refusal `SOP apply requires a milestone target: G1 -> 400 zero writes`; restored `plan=true evidence=true prd=true` + `Gates green ... 45/45`. Item 2 proofs: demo-rows JSON (battery instance) `{"approval_pass":{"n":3,"m":7,"pct":42.9},"human_wait":{"decided":3,"mean_hours":0},"completion":{"n":22,"m":33,"pct":66.7},"member_load":[{"owner":"Unassigned","open":3},{"owner":"Main session A","open":2},{"owner":"Chen Mo","open":1},{"owner":"Lin Che","open":1},{"owner":"agent-team-UI","open":1},{"owner":"subagent-api","open":1},{"owner":"subagent-guard","open":1},{"owner":"subagent-test","open":1}]}`; fresh-instance JSON `{"approval_pass":{"n":3,"m":7,"pct":42.9},"human_wait":{"decided":0,"mean_hours":null},"completion":{"n":21,"m":33,"pct":63.6},...}` (empty acks -> null -> n/a); empty-source proof `emptyDom {approval:n/a, wait:n/a, completion:n/a, load:n/a}` (override seam) with the live null rules asserted; determinism `identical=true countsBefore={"tasks":33,"acks":6,"actions":7,"events":158} countsAfter=identical`; per-metric source lines (4/4 markers hit): `1. approval pass  - table approval_actions, filter enforced = 1`, `2. human wait     - table acks, filter state <> 'ACK'`, `3. completion     - table tasks, filter status = 'done'`, `4. member load    - table tasks, filter status <> 'done'`; SQL cross-check exact match (api n/m == sql n/m on the same rows); Meter DOM `{inMeter:true, aboveToken:true, tileCount:4, approval:"3/7 (42.9%)", wait:"0 h", completion:"22/33 (66.7%)", loadOrder:[3,2,1,1,1,1,1,1] desc}`; section untouched counts identical. 21-vs-22 reconciliation on ONE db instance: fresh instance `/api/state byStatus={"done":21,"in_progress":4,"pending":8} total=33` and `/api/stats completion {"n":21,"m":33,"pct":63.6}` - agree (21=21); battery instance section 37's own SQL cross-check `api n=22 === sql n=22` - agree; the +1 is named: selftest section 5 drags t6 (demo-seed status `pending`) into the done column and persists it before section 37 measures (baseline 21 + 1 = 22); not a stats bug. Rest-state: `git diff --stat -- assets/linked-gantt-board/data/` empty (10 data/*.json byte-identical vs HEAD); no stray listeners/chrome at handback.
- **A** Act: **PASS (R35), pending the main re-check.** Judgment calls, all recorded: (1) ACCEPTED DEVIATION - the lock's "plan-only additive like notes/owner" cannot badge a Work board card, so the flag is mirrored into an additive tasks.approval column (plan flag stays the source of truth, column is the card mirror; R31 model/confidence precedent; main accepted at checkpoint 1); no update-node sync was added beyond that. (2) Gate 3 blocked at CJK_COUNT=1 by the lock's own pre-dispatch line 1999 - editing existing entries is forbidden, so it is disclosed with a touched-files-zero scan instead of "fixed". (3) verify.js does not wipe panel.db at start (only removes what it created at end) - runbook adopted by main: rm the data/panel.db* trio before EVERY battery run, else the 33-task dirty baseline breaks section 1; fresh seed = 15 tasks. (4) One battery attempt aborted on EADDRINUSE :4191 (a transient foreign panel; section-0 identity gate caught it) - ports are pre-flighted from then on. (5) SOP apply refuses goal targets (the lock puts the chain on one milestone); WBS apply keeps its plan-only todo path byte-identically. Lessons as gates: reload store state after fetch-path writes before measuring cards (section 36 first run failed on stale board state); error-delta assertions snapshot unexpectedErrors(), not raw errors.length, when prior allowlisted 400s exist; row-level DML restores only (trio never file-copied); CP seams only (patchStats override, no fetch stub, no window.location.*).

### 2026-11-12 C12 - ledger CJK leak in the R35 lock (by: main session)
- **P** Plan: subagent-r35's handback disclosed gate 3 at CJK_COUNT=1; the single hit is this file's line 1999 - the human sign-off glyph (U+597D) quoted verbatim by main in the R35 lock's scope line. The memory rule says the ledger must pass the package CJK gate. Fix = one documented character swap plus a header rule; never a silent rewrite.
- **D** Do: swapped the glyph for the English gloss "OK" inside the R35 lock line (the only edit to that entry; provenance kept inline as "swapped per correction C12"); added the English-only ledger rule to this header block; no other entry touched.
- **C** Check: `python scripts/localize_check.py` -> `CJK_COUNT=0` (160 files). The pre-fix state is preserved verbatim in subagent-r35's Check above (`CJK_COUNT=1 ... the pre-dispatch lock's own CJK human sign-off word ... TOUCHED_FILES_CJK_TOTAL=0`).
- **A** Act: unscored correction. Lesson promoted to the header rule: packaged text is English-only - human sign-off words enter the ledger as English glosses; project data values may hold any language (the db.js contract says so), packaged text files may not.

### 2026-11-12 R35 fix addendum (by: subagent-r35)
- **P** Plan: re-score metric 1 of I-035 against the SIGNED MOCKUP, which says "approval pass" is a PASS RATE over approval outcomes; the pre-dispatch lock named the wrong source table (approval_actions enforced/all = a static policy-matrix share that never moves as work happens). Fix scope: metric 1 only - derive from acks outcomes (m = decided asks state <> 'ACK', n = passed state IN ('IN_PROGRESS','DONE'), pct = round(n/m*1000)/10; empty decided set -> pct null -> n/a, the SAME decided-row filter family as human wait); update the db.js metric-comment line 1 + VERSION note, section 37's 4/4 source-marker assertion + SQL cross-check + Meter tile expectations (tile format stays "n/m (pct%)"), and the CHANGELOG Unreleased I-035 metric-source sentence. Do NOT touch approval_actions or its policy view anywhere else; everything else stays byte-identical.
- **D** Do: db.js 2.8.1 - stats() now takes ONE decided-acks scan feeding both approval pass and human wait (passed = state IN ('IN_PROGRESS','DONE')); the approval_actions SELECT is gone from stats() (listApprovals / seedPolicy / GET /api/policy/approvals untouched); comment block line 1 rewritten to `table acks, filter decided rows (state <> 'ACK'); n = state IN ('IN_PROGRESS','DONE')`; selftest section 37 marker 1 + i37Exp.ap SQL now acks-based (passed/decided) and the cross-check PASS name updated; CHANGELOG I-035 bullet's metric-source sentence now reads acks decided-ask pass rate. No TS/UI change - patchStats formats "n/m (pct%)" generically.
- **C** Check: `npx tsc -p tsconfig.json` -> exit 0; `node --check db.js selftest.js` -> exit 0; `python scripts/localize_check.py` -> `CJK_COUNT=0` (160 files; main's glyph swap on the lock line landed first, so the package gate is literally green now); `node scripts/prd-to-action.js` -> `PRD-TO-ACTION GATE: 10/10 passed`; `node scripts/plan-sync.js --check` -> `PLAN-SYNC CHECK: 26/26 passed` (documented SQLite SKIP post-wipe); fresh-instance rule proof `{"approval_pass":{"n":0,"m":0,"pct":null},"human_wait":{"decided":0,"mean_hours":null},"completion":{"n":3,"m":15,"pct":20},...} RULES ok=true` (no decided asks -> both null -> n/a, never 0%); final battery after `rm data/panel.db*`: `PANEL_PORT=4186 CDP_PORT=9236 node scripts/verify.js` -> `Result: 234/234 passed` + `[verify] RESULT: PASS (exit 0)`, with the new demo JSON `{"approval_pass":{"n":1,"m":3,"pct":33.3},"human_wait":{"decided":3,"mean_hours":0},"completion":{"n":22,"m":33,"pct":66.7},"member_load":[{"owner":"Unassigned","open":3},{"owner":"Main session A","open":2},...]}` (1 passed of 3 decided asks - A1 DONE vs A2/C9 REJECTED - a live pass rate, not a config ratio), source markers `hit:1. approval pass  - table acks, filter decided rows (state <> 'ACK')` (4/4), SQL cross-check `api {n:1,m:3} === sql {m:3,n:1}`, Meter tile `approval:"1/3 (33.3%)"` with format unchanged, zero-write counts identical `{"tasks":33,"acks":6,"actions":7,"events":158}` before/after; handback state `NO_LISTENERS` / `0 chrome`.
- **A** Act: **PASS (R35 fix), pending the main re-check.** Root cause named: the pre-dispatch lock named the wrong source table; the signed mockup's pass-rate semantics govern, and metric 1 now moves with real ACK outcomes while the policy matrix stays a read-only reference. Constraints held: zero writes in the derivation, two calls byte-identical, approval_actions and its policy view untouched, everything else byte-identical, scoreboard untouched.

Re-check (main): both handbacks re-verified from the ground - checkpoint spot-checks on disk (SOP store/apply/gate floor, sections 36/37, CHANGELOG), independent gates (prd-to-action 10/10, plan-sync 45/45, CJK=0 after C12), two independent battery re-runs `Result: 234/234 passed` + `RESULT: PASS (exit 0)` (pre-fix and post-fix), the fix code read where it lives (acks-outcome pass rate, policy matrix named as not-a-source), same-instance reconcile `done=21 == stats completion.n=21`, `member_load_sum=12 == open=12`, empty-acks tiles n/a. — PASS

### 2026-11-12 R35 - I-034 + I-035 judged: SOP template pack + ops stats (by: main)
- **P** Plan: judge against the R35 acceptance lock lines 1-4 plus the fix addendum; score one round; close I-034 and I-035 only where every line holds with pasted evidence.
- **D** Do: two in-flight checkpoints verified on disk before each ACK (SOP store/apply/gate-floor code, sections 36/37, CHANGELOG, independent prd-to-action 10/10 + plan-sync 45/45 re-runs); the ledger CJK leak fixed as correction C12 (my own lock quoted the human sign-off glyph); one judge-time defect found and reworked - I-035 metric 1 derived from the policy matrix instead of ACK outcomes (root cause: the lock's source list) - fix addendum dispatched and re-verified; two independent battery re-runs; the demo rebuilt from source (plan-sync --seed-tasks 18 created + 38 issue mirror upserts) and probed.
- **C** Check: `python scripts/localize_check.py` -> `CJK_COUNT=0` (160 files) after C12; battery re-run 1 (pre-fix) -> `Result: 234/234 passed` + `RESULT: PASS (exit 0)`; battery re-run 2 (post-fix) -> `Result: 234/234 passed` + `RESULT: PASS (exit 0)`; fix on disk: db.js 2.8.1 metric 1 `table acks, filter decided rows (state <> 'ACK'); n = state IN ('IN_PROGRESS','DONE')` with "the policy matrix (approval_actions) is NOT a metric source" in the code comment; same-instance reconcile `STATE: tasks=33 issues=43 byStatus={"done":21,"in_progress":4,"pending":8}` vs `STATS completion {"n":21,"m":33,"pct":63.6}` (21=21), `member_load_sum=12` (=33-21), acks decided=0 -> approval/human-wait null -> n/a tiles, never 0%; `PASS issue close :: I-034 | mirrored to SQLite`; `PASS issue close :: I-035 | mirrored to SQLite`.
- **A** Act: **PASS (R35)**. Scoreboard PASS 28 / FAIL 1. Named judgment calls, accepted: (1) the additive tasks.approval column mirrors the plan-only approval flag so the Work board card can badge it (R31 model/confidence pattern; accepted at checkpoint 1; the plan flag stays the source); (2) the six builtin WBS templates keep their 'todo' placeholder apply byte-identically (pre-existing I-031 path; SOP payloads use 'pending' only - the lock pins that); (3) SOP apply refuses goal targets - the chain lands on one milestone per the lock; (4) metric 1 was corrected at judge time from policy-matrix share to an acks outcome pass rate - the signed mockup's semantics govern, and the wrong source in the lock is the named root cause. Lessons as gates: (a) a lock that names metric sources must take them from the design doc's metric semantics (events/ACK/task rows), never from a convenient adjacent table - a config ratio is not a pass rate; (b) ledger text is English-only (C12 header rule); (c) verify.js does not wipe panel.db at start - rm the data/panel.db* trio before EVERY battery run or the dirty baseline fails section 1. I-034 and I-035 closed. Open: I-021 (standing rule), I-023 (language ruling). Release 1.10.0 when the human asks.

### 2026-11-12 C13 - post-judge caption fix on the approval-pass tile (by: main session)
- **P** Plan: the live-acceptance screenshot of the R35 Meter surface showed the approval-pass tile caption still reading "enforced gates / all gates" - the pre-fix policy-matrix wording. The fix addendum moved the derivation but not this caption (my fix scope did not name it).
- **D** Do: panel.html caption swapped to "passed / decided asks" (one string; no JS touched; no pinned literal asserts this caption).
- **C** Check: `python scripts/localize_check.py` -> `CJK_COUNT=0` (160 files); live DOM after reload -> `["passed / decided asks","mean ask-to-human-ACK (h)","done / total tasks","open tasks per owner"]`; the unified battery is deferred to the 1.10.0 release run by the runbook (the live 4184 demo and verify.js share data/ - never both at once), and no section 37 assertion pins this caption.
- **A** Act: unscored correction. Lesson: a metric fix is not done until every surface that EXPLAINS the metric moves with it - fix scopes must name UI captions, not only code comments and tests.

### 2026-11-12 R36 acceptance lock (pre-dispatch; by: main)
Signed mockup 2026-11-12 (human: "start"). Scope: I-039 Work board tabbed presentation.
1. The Work board page becomes a two-tab view with a pinned tab bar at the top of
   the content area (never scrolls away; styled as the Command desk sheet
   tablist - one style across the panel). Tab labels exactly `[Work board]` and
   `[Hour axis]`. Tab 1 = the work-division kanban at full width (three columns
   breathe). Tab 2 = the hour axis (flat work units) at full width - the
   existing gantt content moves under the tab with behavior byte-identical
   (NOW marker, past shading, tooltip, grab/drag, R31 humanizations, pinned
   literals). The active tab persists in `cp.wb-tab` (default tab 1).
2. Cross-view navigation replaces hover cross-highlight. A card's
   `-> hour axis` control switches to tab 2, scrolls to the matching bar and
   flashes it; a bar click (no drag) switches to tab 1 and flashes the card
   (existing kb-flash machinery). Card click keeps its audit popover; bar drag
   keeps moving (one dataset, one move, PUT on drop in either tab).
   setLinkHover / initLinkHover and .is-link-hover RETIRE with their drag-hook
   wiring - no dead code left behind.
3. The 40/60 split retires: #wbSplit, .wb-pane split behavior, the cp.wb-split
   read/clamp, and the <=1100px stacked fallback all go away (the stored key
   may linger in localStorage; no code reads it).
4. Retargeting (the R1-R9 precedent, feature-relocation class): every existing
   selftest assertion that measures split layout, hover cross-highlight, or the
   stacked fallback is retargeted to tab semantics with intent intact
   (visibility/height measurements run against the ACTIVE tab; jump tests
   replace hover-link tests; drag tests keep their live-layout diag
   invariants). No assertion is deleted without a named replacement in the
   handback. Pinned-literal audit (C13): every UI string this round touches is
   listed - added tab labels and the `-> hour axis` control, removed split
   chrome - and the pinned-literal assertions stay green.
5. Gates: `npx tsc -p tsconfig.json` exit 0 with dist rebuilt; `node --check`
   on every changed js; `python scripts/localize_check.py` CJK_COUNT=0; no npm
   dependencies; frozen data contracts unchanged; data/*.json byte-identical at
   rest; frozen documents untouched (IMPROVEMENT-PLAN.md,
   EFFECTIVENESS-EXPERIMENT-DESIGN.md, effectiveness-report.template.md,
   effectiveness-freeze.json, confirmatory/raw/R15.md, R16.md); db.js and
   server.js are FORBIDDEN this round (presentation-only; if a store change
   seems needed, stop and report); row-level DML restores only; CP seams only
   (never window.location.*); expected refusal 400s allowlisted by exact
   (URL,status); rm data/panel.db* before every battery run (verify.js does
   NOT wipe at start); quarantine files as panel-quarantine-*; preflight free
   ports before each battery (EADDRINUSE lesson).
6. Checkpoint discipline (I-036): one-line checkpoint after item 1 (tab shell),
   item 2 (jumps + retirements), and item 3 (retargets + audits); ~20 min of
   silence on an item = status report; two failed attempts on one item = stop
   and hand back with the stuck evidence; handback requires pasted command
   output; CHANGELOG Unreleased kept current; ONE PDCA entry appended
   (scoreboard untouched).

### 2026-11-14 RES-01 acceptance lock (pre-dispatch; IN FLIGHT, unscored; by: main)
- **P** Plan: deep-research verification of docs/future_ai_ui_research_report.md (future AI UI, 2026H2-2028). One workflow fans out to 8 subagents: 5 search-angle agents + 3 adversarial voters; all web work on the deepseek-search-everywhere MCP per user directive (plain WebSearch only as labeled fallback). Acceptance criteria, judged at handback:
  1. Every seeded claim C1-C22 gets a 3-vote verdict (confirmed / refuted / unverifiable) with source URL + verbatim quote per vote pasted in the closing entry; 2-of-3 refutes kills the claim, and the report text must then be corrected or caveated. Seeded claims cover: A2UI 1.0 release window + first-mover status; A2UI token numbers (223/139/21, 1060->21); A2UI renderers (Flutter/Web/Android/iOS); A2UI adopters (Atlassian/Bloomberg/ByteDance); Siemens Eigen TIA figures (50%, 2-5x, onboarding weeks->days); Safari 26 WebGPU (2025-09); three.js 12M weekly downloads + r171+ WebGPURenderer/WebGL2 fallback; Chrome HTML-in-Canvas; Rivera Home (VGV); SBI Sumishin NEOBANK ai generative-UI banking; Workday Sana + Autopilot; Salesforce Agentforce Canvas + Claude-interface direction; NX/Solid Edge/CATIA command prediction -30%; Brelyon Visual Engine behavior profiling; Realsee WebGPU pipeline rewrite; Figma Shader; Tecnomatix + Teamcenter copilots + 9-copilot matrix; Siemens cloud dependency (air-gap exclusion); governance compile-gate/sandbox/rollback variance; AG-UI as competitor protocol; Kaltura Dynamic UI; Vercel AI SDK v4 + CopilotKit.
  2. Source floor: >= 12 unique URLs actually fetched through the deepseek MCP tools, spanning >= 4 of 5 angles, including >= 1 CJK-language (JP/ZH) source; any WebSearch fallback is named per query.
  3. Attribution: every vendor-published figure is marked vendor-claimed vs independent in the verdict table (Siemens figures, A2UI token counts, three.js downloads).
  4. Gap output: the counter-evidence angle returns >= 3 gaps or new developments absent from the report.
  5. Fact retention (Section 11 gate): any report edit preserves or explicitly flags every number, date, negation and condition, with the source-vs-rewrite comparison pasted in C.
  Non-goals: report restructure, changes to its design principles/recommendations, any panel or template code, translation.
- **C** Check methods named now, filled with pasted output later: (a) claim verdict table from the workflow handback - votes with URLs + quotes; (b) `python scripts/localize_check.py` after every TASK-LOG append (C12: ledger English-only) with output pasted; (c) deepseek usage evidenced by the per-angle query list and fetched-URL list in the handback; (d) fact-retention diff for any report edit; (e) refusal rule - no pasted command output, no handback.
- **D** Do: lock written pre-dispatch. Workflow `deep-research-deepseek` (inline script, session-persisted) = Search phase (5 angles: A1 protocols; A2 industrial in-tool agents; A3 WebGPU/spatial; A4 enterprise + banking; A5 counter-evidence + gaps) then Verify phase (3 lenses: primary-source trace; numbers/dates/units; counter-evidence hunt). Checkpoint discipline: 20 min silence = status ping; two failed attempts on one angle = stop and hand back with stuck evidence.
- **A** Act: pending.

### 2026-11-14 RES-01 judged - future-AI-UI deep-research verification (by: main)
- **P** Plan: judged against the RES-01 acceptance lock (criteria 1-5).
- **D** Do: workflow wf_49565dfa-2e5 completed - 8 subagents (5 search angles + 3 adversarial voters), 186 tool calls, ~39 min. Report corrected in place at .research/future_ai_ui_research_report.md (relocated from docs/ this round per human decision); evidence archived once to .research/verify-wf_49565dfa-2e5.json and linked from the report appendix and this entry - no content pasted twice.
- **C** Check (pasted evidence):
  1. Claim verdicts (3 votes each; kill rule 2/3 refutes): C1 KILLED (release date 2026-11-11 confirmed, but "first multi-vendor generative-UI protocol" refuted - MCP Apps shipped 2026-01-26 earlier; Google claims only "first stable version of our protocol"); C2 confirmed (token figures 223/139/21 and 1060->21 traced verbatim to dev.to); C3 KILLED (official renderers.md: "Jetpack Compose | Android | Planned", Flutter/SwiftUI Alpha - "four platforms shipped" overstates); C4 confirmed (Atlassian, Alation, Bloomberg, ByteDance); C5 confirmed as vendor-claimed (Siemens PR 2026-04-23: "two to five times faster... up to 80 percent higher solution quality and 50 percent greater engineering efficiency"); C6 confirmed; C7 KILLED (downloads ok but "new-project guidance favors WebGPU" refuted by official llms.txt: "Use WebGLRenderer (default, mature): Maximum browser compatibility"); C8 confirmed (Chrome 157, 2026-10 stable); C9 confirmed with wording fix (re-compose trigger = guests arriving early / delivery moves, not a delivery arriving early); C10 KILLED (SSNB PR 2026-02-27: "begun the phased rollout of the beta test", "Japan's First... (*2 Based on SSNB's internal research)" - beta, not production); C11 confirmed; C12 KILLED (shared-work-canvas description belongs to Generative Lightning Canvas per Forbes; "Agentforce Canvas View" is a builder canvas; Claudeforce itself real per Salesforce PR 2026-08-27); C13 UNVERIFIABLE (CATIA 30% = work-time reduction, self-reported footnote per Dassault whitepaper; no Siemens 30% source exists); C14-C17 confirmed; C18 confirmed with scope fix (Copilot for Operations HAS an on-prem no-internet variant); C19 confirmed; C20 KILLED (official: "AG-UI as transport, A2UI as the generative UI format... complementary, not competing"); C21, C22 confirmed. New claims N1-N15 all confirmed. Full per-vote quotes and URLs: .research/verify-wf_49565dfa-2e5.json.
  2. Source floor: 68 unique URLs fetched via deepseek_fetch_many / deepseek_fetch across all 5 angles; CJK sources included (gihyo.jp JP article on A2UI 1.0; AWS JP what's-new AG-UI page; netbk.co.jp JP/EN press). Tooling notes quote (A5): "all search via mcp__deepseek-search-everywhere__deepseek_search_many ... No WebSearch/WebFetch fallback used."
  3. Attribution: every vendor figure is now labeled vendor-claimed or self-reported in the report tables (Siemens PR figures, CATIA self-reported footnote, SSNB internal-research footnote).
  4. Gap output: 15 confirmed new developments (Gemini stuck on A2UI 0.9.1; Lynx 0.9; AG-UI adoption Google/MS/AWS/LangChain/Mastra/PydanticAI + Bedrock AgentCore 14 regions 2026-03; Eigen 19-country 100+ pilot, ~GBP 1,548/seat/yr, seconds-level compile-fix claim; Ops copilot on-prem variant; three.js 34.8M weekly per Snyk; WebGPU not in MDN Baseline; Chrome 157; Figma Config 2026-06) - floor was 3.
  5. Fact retention (source vs rewrite, old -> new with source): (a) "first multi-vendor protocol" -> struck + MCP Apps correction [menuagentic, Google blog]; (b) "12M weekly downloads" -> 34.8M/wk [Snyk] and "guidance shifted to WebGPU" -> struck [three.js llms.txt]; (c) "all four renderers ship" -> tiered matrix [renderers.md]; (d) "first PRODUCTION banking case" -> phased beta + self-reported firstness [netbk.co.jp]; (e) "Agentforce Canvas" -> Generative Lightning Canvas [Forbes]; (f) "-30% command-finding time (Siemens+CATIA)" -> CATIA work-time -30% self-reported only [Dassault whitepaper]; (g) "AG-UI competitor" -> complementary [a2ui ecosystem doc]; (h) "air-gapped excluded" -> scoped to TIA/Eigen [Siemens Ops copilot asset]; (i) Rivera trigger wording [VGV blog]. All other numbers/dates/negations unchanged.
  Gate: `python scripts/localize_check.py` -> `CJK_COUNT=0` (160 files) after this entry (ledger English-only per C12; report and evidence live under .research/, excluded as non-package scratch).
- **A** Act: **PASS (RES-01)** - all five acceptance criteria met. Corrections applied in strike-through + link style, no wholesale copying; evidence archived once and linked. CHANGELOG untouched: research-only round, no package content changed. Lessons as gates: (a) superlatives ("first", "the standard") are the first claims adversarial verification kills - attribute or drop; (b) a vendor figure translated across languages (30% "command finding" vs "work time") must cite the primary-language source; (c) product-name conflation survives casual review but dies on primary-source trace - name products exactly; (d) multi-vendor capability claims must be checked against the official matrix, not press coverage. RES-01 closed.

### 2026-11-14 AUI-01 acceptance lock (pre-dispatch; IN FLIGHT, unscored; by: main)
Note: the R37 label is skipped - the round-sheet idea filed under it was rejected by the human; this is round one of the A2UI line (human: "kai gong"). Human direction: adopt the A2UI v1.0 spec as the contract layer for multi-agent governance decision cards, standard-library-first (basic-catalog atoms + thin semantic layer).
- **P** Plan: Stage A = S1 catalog + S2 emitter + S3 renderer core, add-only. Acceptance criteria (numbered):
  1. Catalog ships in-package at assets/linked-gantt-board/catalogs/agent-governance/v1/catalog.json (MOVED from the .research draft, not copied), conforming to the official catalog_definition.json rules: required root fields (catalogId, protocolVersion "1.0", components, $defs anyComponent+anyFunction), component schemas with const-name match and DynamicString/ChildList common_types refs, FunctionDefinition shape (@call const + args schema + returnType + allowedCallers), identifiers UAX #31. Checked by new stdlib-only scripts/validate_a2ui_catalog.py (exit 0).
  2. Emitter src/a2ui.ts (namespace CP.A2UI, zero external deps) builds v1.0 wire messages createSurface/updateComponents/updateDataModel for the catalog subset: flat component list with id references, DynamicString literals + @path bindings, Action events shaped {"event": {"name", "userMessage"}}.
  3. Renderer in the same module (injectable document) draws AskCard/ReviewCard/DecisionRecord plus a minimal basic-catalog subset (Text, Button); resolves @path bindings against the data model; rendererOnly formatAskAge runs display-side; decision clicks emit agent-side events ONLY - the ledger write path is the agentOnly recordDecision contract, never renderer-side state.
  4. Effect evidence: a2ui-demo.html shows (a) live-bound AskCard where updateDataModel changes a bound value with NO structural re-render, (b) a decision round-trip (click -> agent event -> agentOnly recordDecision -> DecisionRecord render) with measured ask-to-ACK ms, (c) a wire log of the exact v1.0 messages; a2ui-selftest.js runs in node with a minimal DOM stub asserting message shapes, binding resolution, no-structural-rerender, event round-trip, and that the renderer function registry never contains recordDecision (exit 0, output pasted).
  5. Gates: npx tsc -p tsconfig.json exit 0 with dist rebuilt; dist snapshot-diff shows only dist/a2ui.js added and no byte changes to other dist files (diff pasted); node --check on the new js; validator exit 0; python scripts/localize_check.py CJK_COUNT=0; no npm dependencies; add-only - no edits to panel.html, db.js, server.js, selftest.js, data contracts, or any pending-release file.
  Non-goals: sheet-acks/panel wiring (Stage B, after the pending 1.10.0 release), A2UI-over-MCP (S4), official SDK adoption, Work board/Meter changes, judging R36 (its state is noted, not decided).
- **C** Check methods named now, filled with pasted output later: (a) validator + tsc + node --check outputs; (b) a2ui-selftest.js output; (c) dist snapshot diff; (d) CJK gate output; (e) fact-retention: the moved catalog compared byte-identical against the .research draft (move, not rewrite).
- **D** Do: lock written pre-dispatch. Single implementer in this session (no subagent fan-out). Working tree holds uncommitted R35+R36 work awaiting the human-gated 1.10.0 release - this round stays add-only for that reason.
- **A** Act: pending.

### 2026-11-14 AUI-01 judged - A2UI governance catalog Stage A (by: main)
- **P** Plan: judged against the AUI-01 acceptance lock (criteria 1-5).
- **D** Do: single-implementer, add-only round. Files added: assets/linked-gantt-board/catalogs/agent-governance/v1/catalog.json (moved byte-identical from the .research draft), scripts/validate_a2ui_catalog.py, src/a2ui.ts, dist/a2ui.js (build output), a2ui-demo.html, a2ui-selftest.js. Mid-round the human supplied official A2UI distributions (core 0.6.0, agent SDK 0.11.0, ADK 0.3.0, A2A 0.3.0, CLI binaries + skill pack); extracted per untrusted-archive rules into separate empty dirs under %TEMP%/a2ui-sdk and inspected READ-ONLY - no downloaded code was executed (the auto-mode classifier correctly treated a pasted file list as no run consent; the official-SDK conformance run awaits explicit human approval).
- **C** Check (pasted evidence):
  1. `python scripts/validate_a2ui_catalog.py assets/linked-gantt-board/catalogs/agent-governance/v1/catalog.json` -> `OK assets/linked-gantt-board/catalogs/agent-governance/v1/catalog.json` + `CATALOGS_VALID=True`.
  2. `node a2ui-selftest.js` -> PASS createSurface v1.0 shape; PASS createSurface carries catalogId; PASS updateComponents v1.0 shape; PASS updateDataModel v1.0 shape; PASS literal text renders; PASS @path binding resolves; PASS rendererOnly formatAskAge resolves display-side; PASS updateDataModel keeps node identity (no structural re-render); PASS updateDataModel refreshes bound text; PASS renderer function registry excludes agentOnly recordDecision; PASS decision click emits agent event with resolved userMessage; PASS agentOnly @call in a dynamic slot throws instead of executing -> `a2ui-selftest: 12 assertions passed`.
  3. Effect evidence: a2ui-demo.html runs the same loop in a browser - wire log of the exact v1.0 messages, live-bound AskCard, updateDataModel control (data-only refresh), decision click -> agent event -> agentOnly recordDecision -> DecisionRecord, with measured click-to-record ms on screen.
  4. Gates: `npx tsc -p tsconfig.json` -> exit 0 (first run flagged one unused private member, removed); dist snapshot-diff -> `Only in dist: a2ui.js` and no byte changes elsewhere; `node --check dist/a2ui.js` -> CHECK_OK; `python scripts/localize_check.py` -> `CJK_COUNT=0`.
  5. Add-only + fact retention: git status shows only the six new paths; catalog md5 `dd5a134e8e97f74329027e856695b85c` before and after the move (byte-identical).
- **A** Act: **PASS (AUI-01 Stage A)** - all five criteria met. Carried to Stage B: wire the cards into sheet-acks after the 1.10.0 release; official-SDK conformance run (a2ui_core PayloadValidator / CLI) awaiting explicit human approval to execute downloaded code; catalogId stays an example.com placeholder until a publish URI is chosen. CHANGELOG Unreleased updated. Lessons: (a) strict noUnusedLocals caught dead code before any battery ran - compile gates earn their keep; (b) the classifier treats file-list pastes as data, not run consent - asking first is cheaper than retry loops.

### 2026-11-14 AUI-01 addendum - decision panel dogfood + approved queue outcomes (by: main)
- **P** Plan: the human asked for A2UI-rendered decision cards instead of prose to-do lists ("give me A2UI so I can decide one by one"). Do: assets/linked-gantt-board/a2ui-decisions.html shipped (add-only) - five AskCards rendered through CP.A2UI with approve/reject/defer options mapping to the catalog DecisionRecord enum and a copyable receipt. The human pasted the receipt (all five approve): A-1 take over and finish R36 (executed - see R36 judged below); A-2 run the battery baseline (ran pre-takeover: Result 234/234, PASS exit 0); A-3 execute official tooling (a2ui CLI --help ok; `a2ui lint -c catalogs/agent-governance/v1/catalog.json` -> LINT_EXIT=0 with zero findings; the a2ui_core PayloadValidator run stays an optional follow-up); A-4 Stage B scheduled right after the 1.10.0 release; A-5 catalogId keeps the example.com placeholder until publication.
- **C** Check: a2ui-decisions.html inline script node --check OK; `python scripts/localize_check.py` -> CJK_COUNT=0; receipt text preserved in the session record; LINT_EXIT=0 pasted above.
- **A** Act: closed. The card-to-receipt loop replaced prose triage on first use; recommended as the standing surface for multi-item decisions (human preference, 2026-11-14).

### 2026-11-14 R36 judged - Work board tabbed presentation (by: main)
- **P** Plan: judged against the R36 acceptance lock (items 1-5), taken over per decision receipt A-1. Correction of record: the lock was never executed before the take-over - an interim status probe misread ordinary phrase matches ("Work board" nav label, "Hour axis" pane heading) as tab-shell markers; the decisive grep (cp.wb-tab / [Work board] / [Hour axis]) returned zero matches, so the take-over executed the FULL lock (items 1-5), not a continuation.
- **D** Do:
  CP-a (tab shell): panel.html two-tab view with labels exactly `[Work board]` and `[Hour axis]`, desk-tab tablist styling (one style across the panel), role=tablist/tab/tabpanel; app.ts wbTab/switchWbTab persisting the active tab in cp.wb-tab (default board); the hour axis re-applies its byte-identical auto-scroll to NOW on every activation (the scroll no-ops while the pane is hidden).
  CP-b (jumps + retirements): card `-> hour axis` control (board.ts) switches to tab 2, scrolls to the bar and flashes it (kb-flash keyframes extended to .gbar); bar click without drag switches to tab 1 and flashes the card via the exported CP.gotoCard; drag-vs-click disambiguation via suppressClick (set when a drag really moved a row; the trailing click is swallowed). Retired with zero source references: setLinkHover/initLinkHover/.is-link-hover including the five drag-hook wiring calls (board.ts x3, gantt.ts x2), #wbSplit and the .wb-pane split behavior, the cp.wb-split read/clamp/save, the <=1100px stacked fallback, and the cp.wb-split reset-key entry.
  CP-c (retargets + audits): split-layout assertions retargeted to tab semantics (planTab1: labels exact, one full-width pane per tab, cp.wb-tab persists); hover-link assertions replaced by jump tests (r33Jump: card jump flashes the bar, bar click flashes the card, selection still lights both surfaces); stacked-fallback assertion replaced by the narrow-viewport tab-structure test (r33Narrow: no split handle, tab bar pinned, active pane keeps its height); drag tests keep live-layout invariants (r33DragEnd: ghost cleared, card and bar keep real boxes measured per ACTIVE tab, retired class absent) plus a new drag-suppression probe (r33BarDrag: a moved row swallows its trailing click; immutable pre-dispatch capture; row-level restore). Four gantt-geometry sites (section 2 axis block, R21 canvas links, NAT nature drag, I-032 header) activate the [Hour axis] tab before measuring (the lock ACTIVE-tab rule). Reload persistence moved from cp.wb-split to cp.wb-tab (r33Keep).
- **C** Check (pasted evidence):
  1. Battery: `node scripts/verify.js` -> `Result: 236/236 passed` + `RESULT: PASS (exit 0)`. Iteration history: run 1 = 231/236 (hidden-pane NOW scroll lost at init; stale tab state into planTab1; drag probe ran on the inactive tab; narrow-viewport pin check over-strict), run 3 = 234/236 (probe self-comparison against the optimistic-mutated row; card box measured on the inactive tab), run 4 = 236/236. Each failure named and fixed; run 2 was a no-run path typo (../scripts vs ../../scripts) and changed nothing.
  2. Gates: `npx tsc -p tsconfig.json` exit 0; `node --check` selftest.js + dist/app.js + dist/board.js + dist/gantt.js -> NODE_CHECK_OK; `python scripts/localize_check.py` -> CJK_COUNT=0.
  3. Forbidden/frozen audit: db.js and server.js show pre-existing R35 working-tree modifications that predate this round (the round-start snapshot already lists them as M); no round edit or command touched them. Frozen documents (IMPROVEMENT-PLAN.md, EFFECTIVENESS-EXPERIMENT-DESIGN.md, effectiveness-report.template.md, effectiveness-freeze.json, confirmatory/raw/R15.md, R16.md) unchanged; data/*.json untouched (verify.js removes only the data/panel.db trio).
  4. Pinned-literal audit (C13): ADDED `[Work board]`, `[Hour axis]`, `-> hour axis`; REMOVED "Drag to resize the kanban and the hour axis" (split grip title) and the split chrome; KEPT byte-identical the DEMO banner, Needs human decision, the cost-first line and 'Work units | hour axis (day/night)' (section-32 literal assertions stayed green; a new R36 literals PASS in section 33 pins the added strings and proves the retired chrome is gone from the sources).
  5. Named replacements (lock: no assertion deleted without one): split-drag persistence -> planTab1; side-by-side heights -> r33Merge per-ACTIVE-tab heights; hover cross-highlight -> r33Jump (+ r33DragEnd noHoverClass check); stacked fallback -> r33Narrow; split reload persistence -> r33Keep; drag pair-lit -> r33DragEnd live-layout invariants. New coverage: r33BarDrag suppression probe + R36 pinned-literal PASS.
- **A** Act: **PASS (R36)** - all five lock items landed, battery green at 236/236. Named judgment calls, accepted: (1) suppressClick swallows only the trailing click of a CHANGED bar drag; a plain click navigates (lock wording: "bar click (no drag)"); (2) the suppression probe drags a dep-free leaf row and restores it row-level after the move (lock allows row-level restores; a leaf has an empty cascade); (3) the NOW auto-scroll re-runs on every [Hour axis] activation to keep behavior byte-identical while the pane starts hidden; (4) r33Merge width assertions run per tab in turn (ACTIVE-tab rule) instead of one side-by-side ratio. Lessons as gates: (a) status probes must pin decisive feature markers, never keyword counts - ordinary UI words read as shipped features; (b) hidden-pane geometry and scroll state must be re-applied on activation, not assumed from init; (c) gesture probes must capture row originals immutably before any store mutation. R36 closed. Release 1.10.0 stays human-gated; Stage B (sheet-acks wiring) is queued right after it per receipt A-4.

### 2026-11-14 I-023 language ruling (by: main)
- **P/D** Plan+Do: the I-023 sign-off constraint (Chinese UI dictionary vs the zero-CJK shipped-files gate) went to the human as a one-line ruling. Human: English-only.
- **C** Check: `node scripts/issue.js close --id I-023` -> `PASS issue close :: I-023 | skipped: no panel.db` (ledger written; SQLite mirror lands at the next boot handoff import); `node scripts/issue.js list` -> OPEN=1 (only the I-021 standing rule remains); `python scripts/localize_check.py` -> CJK_COUNT=0.
- **A** Act: closed with zero code change. The gate is the lesson made enforceable: English-only UI is now human-ruled policy, not a pending conflict. The locked language row is the correct final state. Open set after this: I-021 only (standing rule).

### 2026-11-14 1.10.0 release run (by: main)
- **P** Plan: the pre-committed release gate (R35 judged: "Release 1.10.0 when the human asks"; C13: "the unified battery is deferred to the 1.10.0 release run by the runbook"). Acceptance: (1) unified battery PASS on a fresh panel.db; (2) CJK_COUNT=0; (3) A2UI catalog validator OK; (4) a2ui-selftest 12/12; (5) tsc exit 0 + node --check on every shipped js; (6) validate_skill.py blocking+warning PASS; (7) CHANGELOG Unreleased cut to 1.10.0 with a release summary; (8) SKILL.md version synced to 1.10.0 (R26-A rule); (9) one release commit shipping R35 + R36 + AUI-01 Stage A.
- **D** Do: rebuilt dist via `npx tsc -p tsconfig.json`; `rm -f data/panel.db*` before the battery (verify.js does NOT wipe at start - the named lesson); ran the four gates; cut CHANGELOG; synced SKILL.md version; appended this entry; committed.
- **C** Check: `TSC_EXIT=0` + `NODE_CHECK_DONE` (every dist/*.js, server.js, db.js, panel.js, selftest.js, a2ui-selftest.js syntax-clean); `Text files scanned: 167 / CJK_COUNT=0`; `OK assets/linked-gantt-board/catalogs/agent-governance/v1/catalog.json / CATALOGS_VALID=True`; `a2ui-selftest: 12 assertions passed`; `Result: 236/236 passed` + `[verify] RESULT: PASS (exit 0)` (screenshots preview-desk/plan/ledger/dark regenerated by the run); validate_skill.py -> `validation_scripts_have_headers: ok` + `all_markdown_relative_links_resolve: broken=0` + `no_cjk_in_packaged_text_files: cjk_count=0` + `no_absolute_personal_paths_or_credentials: leaks=0`.
- **A** Act: **PASS (release 1.10.0)**. Ships R35 (I-034 SOP template pack, I-035 ops stats), R36 (I-039 tabbed Work board) and AUI-01 Stage A (A2UI v1.0 governance catalog + emitter/renderer + decision panel). One judgment call, named: the two R35 surface screenshots (r35-meter-tiles.png, r35-sop-library.png) ride in the release commit as root-level evidence of shipped surfaces - the 1.9.0 preview-PNG precedent; they are referenced by no code. Open next, human-gated: Stage B (governance cards into sheet-acks); catalogId stays the example.com placeholder (A-5). I-021 standing rule only in the issue ledger.
