---
name: ai-project-ops
description: Operating discipline for AI-led engineering projects (esp. clean-room rewrites and reverse-engineering-driven development) where a human directs and Claude executes. Use when starting or running such a project, or when the user asks about task logging (PDCA), subagent task briefs, token/cost metering, a human-AI command panel (command snapshot / issue ledger / gantt), scheduled jobs that must not run unattended, or measured on/off decisions for token-spending automation. Triggers include "PDCA", "task ledger", "subagent brief", "token metering", "token spend", "command snapshot", "issue ledger", "presence gate", "scheduled tasks", "dashboard", "is it worth enabling", "rework", "re-planning", "todo sync", "memory and todos", "when to script", "script proposal".
---

# AI-led Project Ops Discipline

Apply these rules from day one. AI-led projects fail on traceability, cost
blindness, and unattended automation — not on code.

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
Template: [references/task-log-pdca.md](references/task-log-pdca.md).

## 2. Subagent briefs (delegate multifront work)

When 2+ independent packages are in flight, delegate with self-contained briefs:
paths + constraints + mutually-exclusive file ownership + acceptance = evidence +
report-length limit + the PDCA line ("when done, append a PDCA entry per the
TASK-LOG template; the Check section must paste verification evidence").
Template: [references/subagent-brief.md](references/subagent-brief.md).
Verify subagent output before trusting it (spot-check files, re-run its key
command); a handback report is a claim, not proof.

## 3. Token/cost metering (never estimate by hand)

- All spend numbers come from scripts reading your meter DB read-only (via a
  probe script). Never count by hand, never guess.
- Output format: ONE small table (project / requests / in / out / cache-read / $)
  plus one conclusion line. No essays.
- Billed = in + out + cache-read; also show fresh = in + out.
- Estimate work in token tiers (S≈10–50k, M≈50–200k, L≈0.2–1M, XL≈1–3M), not hours.
  Tiers are a planning vocabulary; measured columns above come only from the meter.
- Time axes on plans/gantts are HOUR-based (day-and-night work), never week-based.
  Future items are ordered bars labeled "placeholder / non-commitment" — dates are
  sorting slots, never commitments.

## 4. Command panel (human-AI loop)

**The panel is a BUILD deliverable, not documentation.** Project setup must end
with a working web panel the human can open in a browser; an AI that only
describes the panel has failed this section. (This skill ships the spec — you
build the page for the project.)

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
Panel spec: [references/panel.md](references/panel.md).

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

## 7. Structure gates (optional, for codebases)

For rewrites: keep a symbol-level code graph (project / type / member + implements /
references / tests) and 2–3 graph queries as structural acceptance rules (layer
bans, contract coverage, test wiring). Rebuild at milestone end; red rules block
"contract done" claims. Facts live in docs/ — the graph is an index, not the
source of truth.

## 8. Day-one bootstrap checklist (new project)

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
