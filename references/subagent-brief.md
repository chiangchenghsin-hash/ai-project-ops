# Subagent brief template

Fill every section. A brief is the agent's whole world — ambiguity becomes rework.

```
Task: <one-line goal>
Context: <2-4 lines: what exists, what was ruled out, why this package>
Output files: <exact paths>; FORBIDDEN: <every path this agent must not touch>
Hard constraints: <read-only zones, encoding rules (PowerShell scripts pure
  ASCII), project red lines such as "no root-level Directory.Build.props",
  budgets like zero npm / zero external deps>
Acceptance = evidence: <the exact command output / counts / screenshots the
  agent must paste>
Steps: <ordered; spell out anchors/contracts; when two agents must agree, fix
  the data contract as an exact JSON shape in both briefs>
PDCA: when done, append ONE PDCA entry to docs/TASK-LOG.md per its template;
  the Check section must paste verification evidence. Do not touch the scoreboard.
Report <= N lines: <file list, key counts, evidence lines, unverified items>
```

Rules of thumb:
- File ownership must be mutually exclusive across parallel agents (tools/ vs
  app/ vs the panel file). A shared file gets exactly one owner.
- Forbid side effects beyond scope: no scheduled-task registration, no process
  left running, no commits, no scoreboard edits.
- Require honest reporting of what could NOT be verified (headless limits, toast,
  clipboard) — that list drives the main session's re-check.
- If the harness flags that a safety classifier skipped the agent's output, do a
  complete manual re-check before scoring: file paths, anchor asserts, stray
  files, process cleanup.
- Cross-check reported paths against reality — agents mistype (e.g. `docs\tasks\`
  vs `docs\`); a stray duplicate directory is a finding, not a typo to ignore.
- After landing, re-run the agent's key verification command yourself once;
  independent re-runs catch confident mistakes.
