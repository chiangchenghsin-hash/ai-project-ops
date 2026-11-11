---
name: ai-project-ops
display_name: 'AI Project Ops'
display_name_en: 'AI Project Ops'
description: 'Operating discipline for AI-led engineering projects (especially clean-room rewrites and reverse-engineering-driven development) where a human directs and an AI executes. Use when starting or running such a project, or when the user asks about PDCA task logging, subagent task briefs, token/cost metering, a human-AI command panel (command snapshot / issue ledger / linked gantt), presence-gated scheduled jobs, or measured on/off decisions for token-spending automation. Triggers include "PDCA", "task ledger", "subagent brief", "token metering", "token spend", "command snapshot", "issue ledger", "presence gate", "scheduled tasks", "is it worth enabling", "rework", "re-planning", "linked gantt board", "day-one bootstrap", "script proposal", "when to script", "ASD-STE100", "simplified technical English", "aircraft maintenance manual style", "short sentences", "80% STE", "discipline gate", "Stop hook", "session start hook", "issue ledger update", "scaffold plan", "task dependency DAG", "PRD to action", "milestone main line", "work breakdown structure", "macOS 27 Golden Gate", "Liquid Glass", "transparency slider", "benchmark adoption", "template registry", "master instance publish", "competitive research landing". Not for: pure report or document generation, multi-tenant authentication or authorization systems, 3D or spatial views, cloud file sync, or answering conceptual questions about what skills are or how the skill system works.'
description_zh: 'Operating discipline for AI-led engineering projects: PDCA task logs, subagent briefs, token metering, a human-AI command panel, and presence-gated scheduled automation. Not for: pure report generation, multi-tenant auth systems, 3D views, cloud sync, or conceptual questions about skills.'
description_en: 'Apply traceability, cost-control, and safe-automation rules to AI-led engineering projects: a single PDCA ledger, self-contained subagent briefs, measured token metering, a built command panel, and measured on/off switches. Not for: pure report generation, multi-tenant auth systems, 3D views, cloud sync, or answering conceptual questions about skills.'
version: '1.9.0'
author: 'Chiang Chenghsin'
agent_created: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
examples_zh:
  - 'Start a clean-room rewrite and stand up the PDCA task log'
  - 'Draft a subagent brief with mutually exclusive file ownership'
  - 'Meter token spend and decide whether to enable a scheduled digest'
examples_en:
  - 'Set up a PDCA ledger for a reverse-engineering-driven rewrite'
  - 'Write a self-contained subagent brief whose acceptance is pasted evidence'
  - 'Measure token spend from the meter DB before enabling an unattended job'
---

# AI-led Project Ops Discipline

Apply these rules from day one. AI-led projects fail on traceability, cost
blindness, and unattended automation — not on code.

Release packaging (the 8 required frontmatter fields, resource-directory
conventions, zip rules, SkillHub red lines and the release checklist) is
specified in [references/packaging-spec.md](references/packaging-spec.md).
Blank templates live in [templates/](templates/); validation and E2E scripts
live in [scripts/](scripts/).

## 1. PDCA task log (single ledger, `docs/TASK-LOG.md`)

Every task — especially every subagent package — appends one entry on completion:

- **P**lan: goal / acceptance criteria / explicit non-goals
- **Do**: method (tools, order) / output files
- **Check**: verification method + REAL evidence (command output lines, counts, screenshots)
- **Act**: PASS → promote reusable practice (memory / project instructions / templates);
  FAIL → one-line lesson

Rules: **no Check evidence = task not done**. PASS = the stated acceptance
criteria were met with pasted evidence; FAIL = criteria missed, evidence absent,
or a later re-check contradicted the claim. Keep a scoreboard (`PASS n / FAIL m`)
— the main session owns that header line; entry bodies are append-only.
FAIL entries must be referenced by name in later briefs ("lessons learned").
Template: [references/task-log-pdca.md](references/task-log-pdca.md). Blank
files: [templates/TASK-LOG.template.md](templates/TASK-LOG.template.md) and
[templates/pdca-entry.template.md](templates/pdca-entry.template.md).

## 2. Subagent briefs (delegate multifront work)

When 2+ independent packages are in flight, delegate with self-contained briefs:
paths + constraints + mutually-exclusive file ownership + acceptance = evidence +
report-length limit + the PDCA line ("when done, append a PDCA entry per the
TASK-LOG template; the Check section must paste verification evidence").
Template: [references/subagent-brief.md](references/subagent-brief.md). Blank
brief: [templates/subagent-brief.template.md](templates/subagent-brief.template.md).
Verify subagent output before trusting it (spot-check files, re-run its key
command); a handback report is a claim, not proof.

Checkpoint discipline (free-range agents fail): a brief for any package
with 2+ scope items orders an interim one-line checkpoint to the main
session after each item, a status pause before any item exceeds ~20
minutes, and a stop after two failed attempts on the same item (hand back
with the stuck evidence). The main session pings once on silence, then
re-plans. A handback without pasted command output is not a handback.

## 3. Token/cost metering (never estimate by hand)

- All spend numbers come from scripts reading your meter DB read-only (via a
  probe script). Never count by hand, never guess.
- Report format: ONE small table with exactly these six columns, plus one
  conclusion line. No essays.

  | project | requests | in | out | cache-read | $ |
  |---|---|---|---|---|---|
  | <slug> | <n> | <tokens> | <tokens> | <tokens> | <usd> |

- Derived figures are FORMULA NOTES under the table, never extra columns:
  billed = in + out + cache-read; fresh = in + out.
- Estimate work in token tiers (S≈10–50k, M≈50–200k, L≈0.2–1M, XL≈1–3M), not hours.
  Tiers are a planning vocabulary; measured columns above come only from the meter.
- Time axes on plans/gantts are HOUR-based (day-and-night work), never week-based.
  Future items are ordered bars labeled "placeholder / non-commitment" — dates are
  sorting slots, never commitments.

## 4. Command panel (human-AI loop)

**The panel is a BUILD deliverable, not documentation.** Project setup must end
with a working web panel the human can open in a browser; an AI that only
describes the panel has failed this section. This skill ships a STARTER KIT /
reference implementation (below), not your finished project panel: copying or
opening that shipped page does NOT satisfy this section. You build (or adapt) a
working panel for YOUR project, backed by YOUR data contract, and you prove it
with pasted verification output.

Human intent flows through a snapshot, not through chat archaeology:
- Command desk: the human types the "next command" and fills reply cells → one
  button generates a command snapshot (command + checkbox state + measured spend +
  latest rounds) → clipboard → paste to Claude. Panel state lives in SQLite (jobs
  deliver through JSON handoff files, humans edit via PUT endpoints); the UI is
  replaceable, the data contract is not.
- Issue ledger: one row per open question (id / source / title / reply cell /
  ENDDATE / urgent / status). Highlights: overdue = red, due ≤48h = amber,
  urgent = red edge. Replies travel via the snapshot.
- Buttons/tabs never carry dynamic counts (they rot). Counts live in data views.
- Descriptive filenames only (`progress.html`, never `index__sharecode_*`).
- Stack contract: jobs write JSON → service imports into SQLite (single source of
  truth); the panel is a TypeScript UI over the service API. Keep a work-division
  board (human members / AI main sessions / subagents / agent teams — who owns
  what, what is stuck). Useful only: nothing ships unless it steers a decision.
Panel spec: [references/panel.md](references/panel.md). Signature interaction:
the gantt and the work-division kanban are one dataset — dragging a card or a
time bar is the same move (linked drag; custom status columns; Apple-style
visual example included).

**Reference implementation (starter kit, ships with this skill):**
[assets/linked-gantt-board/](assets/linked-gantt-board/) is a working TypeScript
panel plus a SQLite service that implements this signature interaction: hour-axis
gantt with cost-first labels and non-commitment placeholders, linked drag with
optimistic UI and PUT-on-drop, status columns stored in SQLite (not hardcoded),
Apple-style light/dark, command snapshot with clipboard fallback, issue ledger,
job status and token metering. It is a STARTER KIT / reference implementation —
a starting point to learn from and fork, NOT a complete production panel and NOT
a substitute for the panel your project must build under this section. Shipping
or opening this page therefore does NOT satisfy section 4. Read
[references/linked-board-reference.md](references/linked-board-reference.md)
for the spec-to-implementation map, the run/verify commands and the remaining
gaps BEFORE claiming a build is delivered. A page that merely opens is not
evidence; paste verification output (the CDP suite prints PASS lines).

## 5. Presence gate for scheduled jobs

Scheduled work runs ONLY while the human is active in the project. Gate every job
with a cheap 3-signal check (any = present): project session transcripts written
recently; tracked-file mtimes changed recently; observatory port accepting
connections. Window ~6h, env-overridable. Absent → quiet skip, record
`skipped: not present`, zero notifications, zero spend.
Pattern: [references/panel.md](references/panel.md#presence-gate).

## 6. Measured on/off switches

Anything that spends tokens unattended (scheduled `claude -p`, auto-reports) is
registered DISABLED by default. Enable only after a probe: run it 1–3 times for
real, measure cost from the meter DB (before/after delta, per-session
attribution), score output usefulness (specific + actionable vs generic filler),
then decide enable / keep-disabled / delete. Deterministic counting and status
checking is script territory — do not wake an LLM for it.
Details: [references/metering.md](references/metering.md).

## 7. Structure gates (default ON, for codebases)

Default ON, not optional. `scripts/discipline-gate.js` recomputes the
dependency graph every turn (I4 cycles, I5 dangling ids and orphans) and
writes `docs/evidence/structure-gate.json`. A cycle or a dangling id
blocks the turn.

For rewrites: keep a symbol-level code graph (project / type / member + implements /
references / tests) and 2–3 graph queries as structural acceptance rules (layer
bans, contract coverage, test wiring). Rebuild at milestone end; red rules block
"contract done" claims. Facts live in docs/ — the graph is an index, not the
source of truth.

## 8. Day-one bootstrap checklist (new project)

**Templates are mandatory, not optional.** Run `node scripts/scaffold.js`
before any other bootstrap step. It instantiates `docs/TASK-LOG.md` and
`docs/PLAN.md` from `templates/` (idempotent, never overwrites). The Stop
hook checks invariant I3; a hand-written plan without the
`ai-project-ops.plan/1.0` marker is FAIL.

Create, in order: `docs/TASK-LOG.md` (header block from
[references/task-log-pdca.md](references/task-log-pdca.md)); `tools/usage_probe.py`
against YOUR meter DB (introspect the schema first — the join in
[references/metering.md](references/metering.md) is one working example, not a
standard); empty `rounds.json` / `notifications.json` / `status.json` per the
data contracts in [references/panel.md](references/panel.md); BUILD the web panel
— a working TypeScript page plus one launcher that serves it (day one may render
the JSON files directly; a tiny service over SQLite is the target and the sole
state store). Day-one minimum views: command desk (snapshot button) + issue
ledger + job status; add gantt / tokens / modules only when needed. Done = the
page opens, one click copies a command snapshot, a reply cell survives reload.
Then: scheduled jobs in whatever scheduler the OS provides (cron /
schtasks / launchd; typical starters: usage refresh, test regression, red-line
guard, git patrol, snapshot), each gated per section 5 and shipped per section 6. Briefs live inside the assignment message
itself (template in [references/subagent-brief.md](references/subagent-brief.md))
— no brief directory is required.

## 9. Rework, replanning & sync loops (expected, not exceptions)

- Rework and re-plans WILL happen. Log each as a NEW PDCA entry (the ledger is
  append-only for exactly this reason) and draw the redo as its own gantt bar
  (cost-first label) beside the round it repairs. Never edit old entries to
  absorb a rework — the trace of the redo is the value. Score the redo as its own
  entry and link it (`rework-of: <original entry>`); cite the original's FAIL
  lesson in the redo entry if there was one.
- Todo/issue/status sync between files, panel, and meter = deterministic
  scheduled scripts under the presence gate (section 5), zero-token. If a sync
  ever needs judgment, split it: the script moves bytes; an LLM wakes only on
  anomalies (section 6).
- Memory ↔ todos boundary: memory holds durable facts (preferences, lessons,
  contracts); the issue ledger / todos hold in-flight state. Cross-link by
  reference (an issue cites a memory slug); never copy content both ways.
- Version control split: artifacts (code, docs, the ledger itself) live in git —
  one PDCA entry per commit; identity = git author for humans, `by: subagent-xxx`
  in the entry for AI work. In-flight state (todos / issues / work-division rows)
  lives in SQLite only — never commit it. PR review only when ≥2 humans write code.

## 10. Script-value judgment (propose, don't re-reason)

- Value gate: a deterministic flow that repeats (same steps, stable I/O, seen 2+
  times) is worth a script — one scripted run is cheaper, faster, and reproducible
  compared with an LLM re-reasoning it every time. LLMs judge and improvise;
  scripts execute. (Token-spending scripts still obey section 6.)
- Script header contract — every script documents three things, or it is not
  done: BACKGROUND (what it replaces and why it exists), CONDITIONS (env / deps /
  preconditions / exit codes), VERSION (number + one-line changelog).
- Proactive proposal duty: the moment a flow repeats or a manual step shows up a
  second time, propose "script this?" with a one-line cost/benefit. Do not wait
  for the human to ask.

## 11. Response style for human comprehension

A human directs this project. A human must read every snapshot, Check line and
reply. Write those surfaces in the softened controlled style described in
[references/response-style-ste100.md](references/response-style-ste100.md):
short sentences, active voice with a named actor, one word with one meaning,
numbered steps, no hedging, no synonym rotation. Number procedures. One step
holds one action.

Apply it to command snapshots, PDCA Check lines, subagent briefs and issue
replies. Do not apply it to frozen artifacts: editing a frozen document voids
its round (correction C2).

Mandatory gate: the style controls clarity, not truth. Short rewrites drop
numbers, dates, negations and conditions. Before accepting any rewritten text,
extract those four sets from the source and from the rewrite. Accept only when
the sets match. Paste that comparison as Check evidence. A clean sentence is not
evidence.

Provenance is graded in the reference file. The 2026-10 ASD-STE100 suggestion is
corroborated by secondary reports only. Do not cite an unverified primary post
or a disputed view count. Chinese has no official ASD-STE100 clause; treat the
~20-character sentence as a local approximation.

## 12. Hooks are mandatory (C5 discipline layer)

A human reported from real usage that the AI "refuses to update the issue
ledger every time". Prose rules were the cause: they are optional at runtime.
The bottleneck was never model capability. This skill buys management cost to
compensate for weak project management, weak software engineering and weak
human command of an AI swarm; that cost is worthless if the AI skips it.
Discipline is therefore enforced by two hooks plus an agent-side write path.
Install at PROJECT level only; see `hooks/INSTALL.md`.

- Start of turn: `scripts/session-start.js` (UserPromptSubmit) injects the
  open-issue count and the three mandatory closing actions, and snapshots the
  session.
- Issue ledger: `scripts/issue.js list | add | update | close | no-new --reason`.
  Every turn either changes an issue or records a deliberate `no-new`. Silence
  is a FAIL (I1). The complaint that opened this round became entry I-001 in
  `docs/DISCIPLINE-ISSUES.md`.
- End of turn: `scripts/discipline-gate.js` (Stop) recomputes eight invariants
  (`docs/DISCIPLINE-INVARIANTS.md`). Missing I1-I6 -> exit 2; the turn is
  blocked with a concrete fix hint. I7/I8 are UNCERTAIN and never block.
- Templates: `scripts/scaffold.js`. Section 7 defaults ON.
- Negative control: `node scripts/selftest-discipline.js` must print 12/12.
  A gate that never fires is decoration.
- Release: `python scripts/package.py --out <zip>` — reproducible exclusions,
  UTF-8 names, checksum outside the archive.

Do not claim discipline was followed without pasting the gate output. A clean
sentence is not evidence.

## 13. PRD-to-action is the plan backbone (I9)

A plan with no milestones, no sub-lines and no relations is an empty plan.
Three files are the single source for milestone structure: `docs/PRD.md`,
`docs/evidence/milestones.json` and
`assets/linked-gantt-board/data/milestone-plan.json`. The main line is the
ordered milestones; sub-lines are the work units per milestone; relations are
the dependency edges. `scripts/prd-to-action.js` enforces falsifiable
Completion fields and concrete Verify commands by reusing the adversarial gate
of the locally installed `prd-to-action` skill (user-level skills directory,
`prd-to-action/SKILL.md`, Phase 0 INGEST and the Milestone template). A turn
that edits the plan MUST re-run that gate: invariant I9, HARD/blocking. See
`docs/DISCIPLINE-INVARIANTS.md`.

## 14. Competitive research is a gate, not a report

R17 researched five competitor groups (Linear + Height, Notion + Monday.com,
ClickUp + Asana + Motion, Devin + Jules + Copilot, and the China-market group
Feishu Project / ONES / PingCode / Teambition): 5 reports, 226 sources,
50 ALIGN / 30 SURPASS / 24 NEVER-COPY items. The promoted conclusion is
`docs/competitive-synthesis.md` with six ordered "What to build first" items.
A human later pointed out that none of it had reached `templates/`. That is a
real failure: research without a landing map and a gate is wasted work.

- `docs/BENCHMARK-ADOPTION.md` maps all six items to IMPLEMENTED / PARTIAL /
  IMPLEMENTED with `file:line` evidence. After C9 all six items are
  implemented in code and asserted by 89 CDP cases; I-006 was corrected, not
  rebuilt.
- Four templates now carry a `Benchmark:` header naming the report item they
  came from: template governance (Monday master -> instance -> Publish, A1),
  agent session (Linear A1/A2), approval matrix (Asana A3), owner scope
  (synthesis claim 4 + B6).
- `templates/registry.json` + `scripts/scaffold.js` v2.0.0 make that governance
  executable: versioned masters, a template lock, role-checked `--publish`,
  drift `--status`, and a no-overwrite rule for existing instances.
- `scripts/benchmark-adoption.js` (Stop-hook invariant I10) fails when any
  landing disappears. `--negative` proves it has discrimination.
- The Chinese research reports stay in hidden `.research/` directories, are
  excluded from the release, and are NOT read by the gate. Claims graded
  UNCERTAIN in the synthesis stay excluded.

Do not write another competitive report without adding its landing row and
running I10 in the same turn.
The hooks are INSTALLED at project level in this repository
(`.workbuddy/settings.json`); they are not merely documented. Never write them
into a user-global settings file.
A cold reader (R4) found the first adoption draft overstated drift, publish and
instance creation; `docs/cold-read/R4-benchmark-adoption.md` is retained. Fix a
landing claim with code, never with wording.
