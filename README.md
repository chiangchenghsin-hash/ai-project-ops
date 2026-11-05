# ai-project-ops

Operating discipline for AI-led engineering projects — a human directs, an AI
executes. Battle-tested rules for traceability, cost control, and safe
unattended automation. Ships as a Claude Code skill.

## Contents

| File | What it gives you |
|---|---|
| `SKILL.md` | The 7 core disciplines, loaded when the skill triggers |
| `references/task-log-pdca.md` | PDCA ledger template + scoring rules (`docs/TASK-LOG.md`) |
| `references/subagent-brief.md` | Task-brief template for delegating to subagents |
| `references/metering.md` | Token/cost metering rules + measured on/off protocol |
| `references/panel.md` | Human–AI command panel spec + presence gate for scheduled jobs |

## The 7 disciplines

1. **PDCA task log** — one append-only ledger; no Check evidence = task not done.
2. **Subagent briefs** — self-contained briefs, mutually exclusive file ownership, acceptance = pasted evidence.
3. **Token/cost metering** — numbers from scripts reading the meter DB read-only; one small table + one conclusion line.
4. **Command panel** — command snapshot / issue ledger / hour-axis gantt; data contracts for jobs.
5. **Presence gate** — scheduled jobs run only while the human is active in the project.
6. **Measured on/off switches** — token-spending automation ships disabled; probe, meter, score, then decide.
7. **Structure gates** — optional symbol-graph structural rules for rewrites.

## Install

Copy (or clone) this folder into your Claude Code skills directory:

```
~/.claude/skills/ai-project-ops/
```

Restart Claude Code; the skill triggers on task-logging / delegation / metering /
panel / scheduling questions.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
