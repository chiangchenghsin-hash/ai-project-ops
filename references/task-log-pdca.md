# TASK-LOG (PDCA) template

File: `docs/TASK-LOG.md`. Entries are append-only; the header scoreboard line
(`PASS n / FAIL m`) is maintained by the main session at scoring time (that is a
header edit, not an entry edit). Header block:

```markdown
# TASK-LOG (PDCA ledger)

> Discipline: every task (especially every subagent package) appends one PDCA
> entry on completion. No Check evidence = task not done.
> Scorekeeping: PASS +1 → promote the reusable practice into project
> instructions / memory / templates; FAIL −1 → write a one-line lesson that
> later briefs must cite by name ("lessons learned").

## Scoreboard
PASS n / FAIL m

---
```

Entry template (append at file end):

```markdown
### <YYYY-MM-DD HH:MM> <task name> (tier S/M/L/XL, by: main session / subagent-xxx)
- P Plan: goal / acceptance criteria / boundaries (explicit non-goals)
- D Do: method (tools, order) / output files
- C Check: verification method + result (evidence: command output lines /
  screenshots / counts — paste the key lines)
- A Act: PASS → promote <what was crystallized> | FAIL → lesson <one line>;
  incentive ±1
```

Battle-tested rules:
- PASS = the stated acceptance criteria were met and the evidence pasted; FAIL =
  criteria missed, evidence missing, or a later re-check contradicted the claim.
- The subagent self-appends its entry; the main session re-verifies and appends a
  one-line re-check verdict before scoring. If a safety classifier skipped the
  subagent's output, the re-check must be manual and complete.
- Check must paste actual output (`R1 PASS 183 edges 0 violations`,
  `counts={...}`) — never "should work".
- When several packages land at once, keep one archive entry pointing to the
  per-package entries; the scoreboard counts only scored entries.
- A gap found and fixed during verification belongs in Check (honesty) and its
  lesson in Act.
- Date/name skew between entries is fine; the ledger is a log, not a schedule.
