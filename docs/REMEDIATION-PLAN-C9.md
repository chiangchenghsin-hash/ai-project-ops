# C9 remediation plan (pre-registered before work)

Status: `PRE_REGISTERED_BEFORE_WORK`. Version 1.6.0 -> 1.7.0.
Written 2026-11-08 by the main session. Editing acceptance criteria after
results arrive is a FAIL; any change must be a numbered correction.

## 0. Why this plan exists

The human said: "look at the problem properly, output a correction plan, then
start work". A read-only re-check of the tree found that one recorded open item
was stale and that the discipline layer was never actually installed.

## 1. Findings, re-checked against code (not against memory)

| id | finding | evidence | action |
|---|---|---|---|
| F1 | **I-006 is STALE.** Dependency arrow lines already exist. | `gantt.ts:130-153` `drawEdges()` / `<path class="gdep" marker-end="url(#arrowOk/arrowBad)">`; `:298` click-to-delete edge; `:195-210` drag preview; `graph.ts:210` bump cascade. | Correct the ledger and close I-006. Do NOT build it again. |
| F2 | B1 per-action approval matrix is NOT implemented. | `server.js:69-70` has only `/api/acks` GET/POST; `db.js` exports `updateAck` but no policy table. `templates/approval-matrix.template.md` is a spec only. | Implement a real, persisted matrix + enforce written reject reason. |
| F3 | B5 board keyboard model is NOT implemented. | `board.ts` has no `keydown`; `app.ts:305-318` is Escape + ArrowLeft/Right 1-hour shift only; `grep multiSelect/moveToTop/sharedOrder src/` -> NONE. | Implement multi-select, move to top/bottom, and one shared order for list and board. |
| F4 | B6 owner scope is a template, not runtime data. | `owner_type` stored at `types.ts:4` / `db.js:68`, rendered at `board.ts:90`, but no API exposes the scope. | Expose the four scopes via API and show them in the UI. |
| F5 | **Hooks are documented but NOT installed.** All I1-I10 runs so far were manual. | `find . -name settings.json` -> none in the project. | Install the fragment at PROJECT level only and prove registration. |
| F6 | 18.0/20 and the C4 UNCERTAIN verdict. | `references/effectiveness.md`, four frozen hashes MATCH. | NON-GOAL. Answering it needs a new C5 freeze id, not this engineering round. |

## 2. Acceptance criteria (locked, machine-checkable)

| id | criterion | check command | failure cell |
|---|---|---|---|
| A1 | I-006 corrected and closed; `OPEN=0` | `node scripts/issue.js list` | A stale item stays open, or is closed without pasting code evidence |
| A2 | B1 approval matrix persisted and enforced | `GET /api/policy/approvals` returns >=6 rows; a reject with an empty reason returns HTTP 400; a valid reject survives reload | Matrix only in memory / no negative test |
| A3 | B6 owner scope readable at runtime | `GET /api/policy/owner-scope` returns 4 owner types with may/needs-ACK/never | Endpoint invented in docs only |
| A4 | B5 keyboard model real | CDP assertions: multi-select 2 cards, move-to-top changes `sort` in SQLite and in the board order, list and board share the same order | Only a keydown listener exists with no persisted effect |
| A5 | Hooks installed at project level | `settings.json` contains both `UserPromptSubmit` and `Stop` commands; a dry-run merge is idempotent (no duplicate entries) | Written to a user-global settings file = FAIL |
| A6 | No regression | `PANEL_PORT=4184 CDP_PORT=9234 node scripts/verify.js` >= 86 assertions, all PASS, exit 0 | Any old assertion deleted or weakened = FAIL |
| A7 | Full gates | `validate_skill.py` 0, `localize_check.py` CJK=0, `discipline-gate.js` 0, `prd-to-action.js` 10/10, `benchmark-adoption.js` 13/13, four frozen hashes MATCH | Any gate red at delivery |
| A8 | Honest scoring | 18.0/20 and UNCERTAIN unchanged; no rubric edit; one PDCA entry with pasted Check output | Score raised by relabelling a non-goal |

## 3. File ownership (mutually exclusive)

| owner | files |
|---|---|
| P1 (subagent) | `assets/linked-gantt-board/db.js`, `server.js`, `src/policy.ts` (new), `src/desk.ts`, `data/approval-matrix.json`, `data/owner-scope.json` |
| P2 (subagent) | `assets/linked-gantt-board/src/board.ts`, `src/app.ts`, `src/types.ts`, `styles.css` |
| Main session | `selftest.js`, `dist/` (tsc rebuild), `panel.html`, hook install, all docs, `docs/TASK-LOG.md`, PDCA, packaging |
| Cold reader | read-only report |

Rule: no package may edit `panel.html`, `selftest.js` or `docs/TASK-LOG.md`.
All existing DOM ids and API contracts MUST be preserved. New UI is built with
`document.createElement`, not by renaming ids.

## 4. Non-goals (explicit)

- No C5 effectiveness round, no rubric change, no re-test of C4.
- No edit to any frozen artifact (E07 would void the round).
- No edit to the user-global `~/.claude/settings.json` or
  `~/.workbuddy/settings.json`.
- No new competitive report, no new visual redesign.
- No claim that 18.0/20 proves the skill improves engineering.

## 5. Corrections

None at registration. Any change to A1-A8 or to section 3 must be issued as
`C9-n` with the reason, the old text, and the new text BEFORE the affected
result is scored.

## 6. Reproduction

```
node scripts/issue.js list
PANEL_PORT=4184 CDP_PORT=9234 node scripts/verify.js
python scripts/validate_skill.py
python scripts/localize_check.py
node scripts/discipline-gate.js
node scripts/prd-to-action.js
node scripts/benchmark-adoption.js
python scripts/package.py --out <zip>
```

## Correction C9-1 (issued after cold reader R5, BEFORE the final verdict)

Reason: R5 found D1 (generated issue snapshot still said I-006 was OPEN),
D2 (the A4 assertion selected ONE card and never proved list/board order
equality), D3 (DRIFT locks needed an explanation) and D5 (line-number drift
between `130-153` / `:298` and the actual `139-154` / `:308`).

- Old A4 check: `ids.length === 1`; order evidence was only "data-order
  attributes exist". New A4 check: `ids.length === 2`, BOTH selected cards
  get a persisted new `sort`, and EVERY board card and gantt bar must carry
  the SAME `CP.sharedOrder` index for its task id. **This STRENGTHENS the
  acceptance criterion; no failing result was reworded into a pass.**
- Old I-006 citation: `gantt.ts:130-153`, `:298`. New: `139-154`, `:308`.
- The earlier `89/89 passed` run is retained as an INTERMEDIATE result. The
  strengthened suite is re-run and its output is the scored Check evidence.
- Sections 0-6, criteria A1-A8, failure cells and file ownership are
  unchanged. This correction is append-only, as section 5 requires.
