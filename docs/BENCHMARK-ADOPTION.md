# Benchmark adoption ledger (R17 -> shipped)

## Why this file exists

Round R17 ran five competitive research subagents: Linear + Height,
Notion + Monday.com, ClickUp + Asana + Motion, Devin + Jules + Copilot, and a
China-market group (Feishu Project / ONES / PingCode / Teambition). Output:
5 reports, 226 cited source URLs, 50 ALIGN / 30 SURPASS / 24 NEVER-COPY items,
promoted into `docs/competitive-synthesis.md`. The research reports live in
hidden `.research/` directories and are NOT package content (they contain CJK
and are excluded by `scripts/localize_check.py`, `validate_skill.py` and
`scripts/package.py`).

The human's complaint on 2026-11-08 was correct: **the research produced a
synthesis but no adoption chain**. No landing map, no template derived from a
benchmark, and no gate that could detect a future round forgetting it again.
This file is that chain. `scripts/benchmark-adoption.js` checks it on every
Stop hook (invariant I10).

## The six "What to build first" items, reconciled against the tree

Source: `docs/competitive-synthesis.md:122-135`. Status checked against code,
not against memory.

| # | Recommended (source) | status | landing evidence |
|---|---|---|---|
| B1 | Per-action approval matrix behind the ACK gate (Asana structure + our reject-reason rule) | **IMPLEMENTED** (C9) | `GET /api/policy/approvals` returns 7 seeded SQLite rows (`db.js listApprovals`); `PUT /api/acks/:id` with `state:REJECTED` and a blank reason returns HTTP 400; a valid reject persists `reject_reason` and survives reload. CDP assertion: `89/89 passed`. |
| B2 | Dependency lines blue/red + drag bump chain (Linear / PingCode / ONES) | **IMPLEMENTED** (corrected C9) | `gantt.ts:139-154 drawEdges()` emits `<path class="gdep" marker-end="url(#arrowOk/arrowBad)">` with blue-not-violated / red-violated semantics; `:308` click-to-delete; `:195-210` drag preview; `graph.ts:210 bumpCascade()`. The earlier claim that arrow lines were missing was a stale judgement; I-006 is closed with this evidence. |
| B3 | Baseline snapshot and compare on the gantt (PingCode / ONES) | **IMPLEMENTED** | `server.js` `/api/baseline`, `db.js snapshotBaseline()`, `tasks.baseline_start / baseline_end`, `btnBaseline` in `panel.html`. |
| B4 | Critical-path toggle that dims non-critical bars | **IMPLEMENTED** | `app.ts:268 btnCritical`, `graph.ts` critical set. |
| B5 | Board keyboard model: multi-select, move to top/bottom, list and board sharing one order (Linear) | **IMPLEMENTED** (C9) | `graph.ts:19 CP.sharedOrder`, `board.ts:289 CP.Board` with `selectedIds()` / `moveSelected()` / `clearMulti()`; `Alt+ArrowUp/Down` persists a new `sort` via PUT. CDP: `sharedOrder n=18 sorted=true board=18 gantt=18`; `move-to-top sort 6 -> 8`. |
| B6 | Owner scope document per `owner_type` | **IMPLEMENTED** (C9) | `GET /api/policy/owner-scope` returns exactly 4 SQLite rows (`human,main,subagent,team`) with `may_act_alone` / `needs_ack` / `never_automatic`; `src/policy.ts` mounts an owner-scope table into the desk view. |

R18's ledger admitted "Board keyboard model and Timeline dependency lines are
logged as follow-up, not built here". C9 closed both: B5 now has a real keyboard
model, and B2's arrow lines turned out to ALREADY exist in the code. A follow-up
with no owner and no gate is a lost item; I10 fixes the mechanism.

## C9 remediation (1.7.0)

The human asked to "look at the problem properly, output a correction plan,
then start work". `docs/REMEDIATION-PLAN-C9.md` was pre-registered with A1-A8
and failure cells. Re-checking the tree found F1: the recorded OPEN issue
**I-006 was stale** - the dependency arrow-line overlay was ALREADY built in
`gantt.ts:139-154` (blue/red paths, arrow markers, click-to-delete, drag
preview). I-006 was closed with code evidence, not by "building" it again.
F2/F3/F4 (B1, B5, B6) were genuinely missing and are now implemented and
asserted by 8 new CDP cases (81 -> 89). F5: the discipline hooks were
documented but never installed; they are now merged at PROJECT level into
`.workbuddy/settings.json` with an idempotency check. F6 (18.0/20 and the C4
UNCERTAIN verdict) remains an explicit NON-GOAL: answering it requires a new
C5 freeze id, not this engineering round.

## ALIGN items now promoted into templates

Every template below carries a `Benchmark:` header naming the report and item
it came from. This is the part that was entirely missing before this release.

| template | report item | what was borrowed |
|---|---|---|
| `templates/template-governance.template.md` | `.research/notion-monday.md` A1 / A2 / A3 / A4 (A1 graded HIGHEST priority) | Monday master -> instance -> Publish, owner/member roles, default properties + page skeleton, "only affects future instances" (upgrades never swallow local edits) |
| `templates/agent-session.template.md` | `.research/linear-height.md` A1 / A2 | Linear Agent Session six-state machine + first-response SLA; "delegate issues, not accountability" |
| `templates/approval-matrix.template.md` | `.research/clickup-asana-motion.md` A3 + synthesis B1 | Asana per-action approval matrix, upgraded with our mandatory written reject reason |
| `templates/owner-scope.template.md` | synthesis claim 4 + B6 + `.research/devin-jules-copilot.md` | One written scope per owner type: may act alone / needs ACK / never automatic |
| `templates/registry.json` (data, not markdown) | Notion/Monday A1 + A2 | Machine-readable master registry: id, version, publish role, instance path, no-overwrite policy |

## Template governance actually wired (revised after cold reader R4)

`scripts/scaffold.js` v2.1.0 reads `templates/registry.json`. It writes
`docs/evidence/template-lock.json` with master path, master version and
timestamp. Existing instances are NEVER overwritten — Monday's "only affects
future instances" rule made executable. Pre-existing instances are registered
with an explicit honesty note: their master version is ASSUMED, not proven.

R4 found v2.0.0 overstated three claims. Fixed, with real code:
- `--status` now reads the lock and reports IN-SYNC / DRIFT / NO-LOCK /
  PRE-EXISTING per instance (it used to print only present/absent).
- `--publish <id>` now bumps the patch version in the registry and records the
  publish event in the lock (it used to be a role check plus a print).
- `--all` instantiates EVERY registry master with an instance path, so the four
  benchmark templates are no longer masters with zero instances.

## Never-copy (kept as constraints, not features)

From `docs/competitive-synthesis.md:88-99`: cost hidden in billing,
"approval" reduced to a confirm dialog, unattended AI writes with no measured
on/off, and temporary bypasses left permanently in documentation. These are
checked as constraints in `references/pdca-three-state.md` and
`references/packaging-spec.md`; they are deliberately NOT turned into
templates.

## Claims not promoted

`docs/competitive-synthesis.md:101-120` grades two ClickUp/Asana claims
UNCERTAIN because the cited help centres rendered no article body. They are
excluded here too. Do not cite them as fact.

## Machine gate (hardened after R4)

```
node scripts/benchmark-adoption.js            # 13 checks, exit 0 when complete
node scripts/benchmark-adoption.js --negative # two perturbations, must exit 2
```

v1.0.0 was gameable (R4/D4): it checked only literal `| B# |` tokens and one
global regex, never opened a landing, had no fixed master-id list, and could be
edited without detection. v1.1.0 checks EACH B row's status and concrete
landing reference, enforces the four benchmark ids, requires the four
INSTANCES to exist, checks scaffold wiring keywords, and verifies the SHA-256
of this ledger and of the gate against `docs/evidence/adoption-manifest.json`.
`--negative` now runs TWO in-memory perturbations: delete a benchmark template,
and relabel B1 as IMPLEMENTED. Both must be detected.

Honest residual boundary: the manifest cannot hash itself (circular). Editing
the manifest is treated exactly like editing a frozen artifact — it requires a
new version id (E07 analogue). No third-party signature exists. This is
documented, not hidden.

## C9 master drift is expected, not a broken lock

C9 edited two masters (approval-matrix, owner-scope) and bumped their
registry versions to v1.1.0. Their instances were created at v1.0.0 and are
NOT rewritten, so `node scripts/scaffold.js --status` reports
`DRIFT lock=v1.0.0 master=v1.1.0`. That is Monday's "only affects future
instances" rule working, not a failed publish. Reconciliation is a HUMAN
decision; the tool never auto-merges a master into an existing instance.
A real `--publish <id>` is the commanded way to record a version bump.

## Cold reader R4 (kept, not deleted)

`docs/cold-read/R4-benchmark-adoption.md` judged the first draft "needs
revision" with six defects D1-D6. The main session independently re-checked all
six against `app.ts:305-318`, `gantt.ts:347-355`, `scaffold.js` and the
instance directory, and CONFIRMED every one. D5 changed B5 from PARTIAL to NOT
IMPLEMENTED. This failure stays on file under the skill's rule that a negative
result is not deleted or re-tested away.
