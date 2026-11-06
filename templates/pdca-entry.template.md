# PDCA entry template (append-only)

Append one block per completed task to docs/TASK-LOG.md. Copy the lines below
and replace every <placeholder>. Do not edit the scoreboard header.

### <YYYY-MM-DD HH:MM> <task name> (tier S/M/L/XL, by: main session / subagent-xxx)
- P Plan: goal / acceptance criteria / explicit non-goals
- D Do: method (tools, order) / output files
- C Check: verification method + REAL evidence (paste command output lines /
  counts / exit codes / screenshots; "should work" is not evidence)
- A Act: PASS -> promote <what was crystallized> | FAIL -> lesson <one line>;
  incentive +/-1

Rules: PASS = stated criteria met with pasted evidence; FAIL = criteria missed,
evidence absent, or a later re-check contradicted the claim. For a rework, add
a NEW entry with a rework-of: <original entry> link and its own gantt bar; cite
the original's FAIL lesson. The main session appends a one-line re-check
verdict before scoring: Re-check (main): <command> -> <result> - PASS|FAIL.
