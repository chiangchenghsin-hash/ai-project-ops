# ai-project-ops

Operating discipline for AI-led engineering projects — a human directs, an AI
executes. Battle-tested rules for traceability, cost control, and safe
unattended automation. Ships as a Claude Code / WorkBuddy skill.

> Starter-kit caveat: the shipped `assets/linked-gantt-board/` panel is a
> STARTER KIT / reference implementation, not a finished production panel and
> not a substitute for the panel your project must build. Copying or opening
> that page does NOT satisfy SKILL.md section 4. You build (or adapt) a working
> panel for your own project and prove it with pasted verification output.

## Contents

| File | What it gives you |
|---|---|
| `SKILL.md` | The 12 core disciplines, loaded when the skill triggers; 8-field frontmatter |
| `references/task-log-pdca.md` | PDCA ledger template + scoring rules (`docs/TASK-LOG.md`) |
| `references/subagent-brief.md` | Task-brief template for delegating to subagents |
| `references/metering.md` | Token/cost metering rules + measured on/off protocol |
| `references/panel.md` | Human–AI command panel spec + presence gate for scheduled jobs |
| `references/linked-board-reference.md` | Spec↔implementation map, run/verify commands, remaining gaps for the shipped panel |
| `references/packaging-spec.md` | Official 8-field frontmatter, `@references` layout, zip rules, red lines, release checklist |
| `references/response-style-ste100.md` | 80% ASD-STE100 controlled response style, graded provenance, Chinese adaptation and the mandatory fact-retention gate |
| `references/effectiveness.md` | C4 confirmatory no-skill round: UNCERTAIN verdict, exact p, failure cells, threat reconciliation and the 18.0/20 caveat |
| `assets/linked-gantt-board/` | Working TypeScript panel + SQLite service (starter kit): hour-axis gantt, linked drag, custom status columns, command snapshot, issue ledger, metering, CDP verification |
| `assets/linked-gantt-board/data/milestone-plan.json` | Panel milestone-plan data: main line, sub-lines and relations (one of the three I9 single sources) |
| `docs/PRD.md` | PRD source for milestone structure; the plan backbone per SKILL.md section 13 |
| `docs/evidence/milestones.json` | Machine-readable milestone structure (I9 single source) |
| `references/prd-to-action.md` | PRD-to-action harness map: Phase 0 INGEST, Milestone template and the adversarial gate wiring |
| `scripts/` | `validate_skill.py`, `verify.js`, `localize_check.py`, `session-start.js`, `discipline-gate.js`, `prd-to-action.js`, `issue.js`, `scaffold.js`, `selftest-discipline.js`, `merge-hooks.py`, `package.py` |
| `templates/` | Blank `TASK-LOG.template.md`, `PLAN.template.md`, `pdca-entry.template.md`, `subagent-brief.template.md` — instantiate with `node scripts/scaffold.js` |
| `hooks/` | `settings.fragment.json` + `INSTALL.md`: project-level UserPromptSubmit / Stop hooks, never user-global |
| `docs/DISCIPLINE-INVARIANTS.md` | The ten machine-checked invariants (I1-I10), fail-open rules, wiring status and the negative control |
| `docs/competitive-synthesis.md` | R17 competitive synthesis: four claims, never-copy list, six ordered build-first items |
| `docs/BENCHMARK-ADOPTION.md` | R17 -> shipped landing map; every build-first item has a status and code evidence |
| `docs/REMEDIATION-PLAN-C9.md` | Pre-registered C9 plan: A1-A8 acceptance, failure cells, mutually exclusive ownership, non-goals |
| `templates/registry.json` | Versioned master registry with publish roles, instances and benchmark provenance |
| `docs/DISCIPLINE-ISSUES.md` | Skill's own defect ledger: twelve issues from real usage; I-006 plus I-008..I-012 OPEN pending main-session verification |
| `docs/RELEASE-CHECKLIST.md` | Pre-publish gates + post-publish trigger-regression reminder |
| `docs/TRIGGER-REGRESSION.md` | 20 positive / 10 negative trigger phrases + pass rule |
| `CHANGELOG.md` | Release history |

**New in 1.5.0 (C7).** The PRD-to-action backbone makes `docs/PRD.md`,
`docs/evidence/milestones.json` and
`assets/linked-gantt-board/data/milestone-plan.json` the single source for
milestone structure, enforced by `scripts/prd-to-action.js` (invariant I9).
The reference panel now ships two standalone views: the Milestone gantt and
the Work-division kanban on separate pages, with the sidebar/charter
description (Purpose / Technical resources / Evaluation) filled. The visual
style is macOS 27 "Golden Gate" (WWDC26): readability-fixed Liquid Glass, a
transparency slider, and colored sidebar icons. See
`references/prd-to-action.md` and `CHANGELOG.md`.

## The disciplines

1. **PDCA task log** — one append-only ledger; no Check evidence = task not done.
2. **Subagent briefs** — self-contained briefs, mutually exclusive file ownership, acceptance = pasted evidence.
3. **Token/cost metering** — numbers from scripts reading the meter DB read-only; one small table (project / requests / in / out / cache-read / $) + one conclusion line, with billed / fresh as formula notes.
4. **Command panel** — command snapshot / issue ledger / work-division board / hour-axis gantt; SQLite is the single source of truth, the panel is a TypeScript UI over the service API. It is a BUILD deliverable, not documentation.
5. **Presence gate** — scheduled jobs run only while the human is active in the project.
6. **Measured on/off switches** — token-spending automation ships disabled; probe, meter, score, then decide.
7. **Structure gates** — optional symbol-graph structural rules for rewrites.
8. **Day-one bootstrap** — ordered checklist to stand the discipline up on a fresh project.
9. **Rework, replanning & sync loops** — rework = new PDCA entry + its own gantt bar; deterministic sync scripts; memory↔todos boundary; git for artifacts, SQLite for state.
10. **Script-value judgment** — repeated deterministic flows become versioned scripts (BACKGROUND / CONDITIONS / VERSION header); the AI proactively proposes scripting.

## Install

Claude Code — copy (or clone) this folder into your skills directory:

```
~/.claude/skills/ai-project-ops/
```

Restart Claude Code; the skill triggers on task-logging / delegation / metering /
panel / scheduling questions.

WorkBuddy — install under either scope:

```
~/.workbuddy/skills/ai-project-ops/                 # user scope
<workspace>/.workbuddy/skills/ai-project-ops/      # project scope
```

The `agent_created: true` frontmatter flag marks it as agent-authored so the
skill manager can modify/delete it. See
[references/packaging-spec.md](references/packaging-spec.md) for the required
frontmatter fields and packaging rules.

## Requirements and dependencies

- **Node >= 22.5** for the reference panel (built-in `node:sqlite`, global
  `fetch` + `WebSocket`). Standard library only: zero npm dependencies, no
  external runtime deps, no network needed to run the panel.
- **Python 3** for `scripts/validate_skill.py` and `scripts/localize_check.py`.
  Standard library only (no pip, no network).
- **Chrome / Chromium** for the E2E verification (`node scripts/verify.js`);
  override the binary with `CHROME_PATH` or `CHROME_BIN`.
- `tsc -p tsconfig.json` rebuilds `dist/` from `src/` (only needed when editing
  the panel TypeScript). The SQLite file `data/panel.db` is runtime state —
  never commit or ship it.

## Validate and verify (from the package root)

```
python scripts/validate_skill.py          # frontmatter / links / CJK / state gates; exit 0|1|2
python scripts/localize_check.py          # prints CJK_COUNT; exit 1 if > 0
python -m py_compile scripts/validate_skill.py scripts/localize_check.py
node --check scripts/verify.js            # syntax check only
node scripts/verify.js                    # full E2E: server + headless Chrome + selftest
```

`validate_skill.py` writes `docs/evidence/validation-report.json` with a
per-check PASS/FAIL and exits 0 (all pass), 1 (warnings), or 2 (blocking).
`verify.js` starts `assets/linked-gantt-board/server.js` with `PANEL_PORT=4174`,
waits for `GET /healthz`, launches headless Chrome with
`--remote-debugging-port=9224` and `--no-proxy-server` at
`http://localhost:4174/`, runs `assets/linked-gantt-board/selftest.js`, then
stops the server via `POST /shutdown` and terminates Chrome. It propagates a
non-zero exit if any step fails. The full E2E needs a Chrome binary; the main
session runs it. See [docs/RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md) and
[docs/TRIGGER-REGRESSION.md](docs/TRIGGER-REGRESSION.md) for the release gates.

## Run the reference panel (manually)

```
cd assets/linked-gantt-board
node panel.js start          # or: panel.bat start   (Windows)
node panel.js open           # optional
node selftest.js             # CDP verification, needs Chrome --remote-debugging-port=9224
node panel.js stop           # uses POST /shutdown
```

See [references/linked-board-reference.md](references/linked-board-reference.md)
for what the sample implements and what it deliberately does not (presence-gated
jobs, measured on/off probes, module inventory / archive map, virtualized
tables). A page that merely opens is not evidence; paste the CDP suite's PASS
lines.

## License

Apache License 2.0 — see [LICENSE](LICENSE). History: [CHANGELOG.md](CHANGELOG.md).
