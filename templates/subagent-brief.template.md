# Subagent brief template (self-contained)

A brief is the agent's whole world - ambiguity becomes rework. Fill every
section. Paste this into the assignment message itself; no brief directory is
required. File ownership MUST be mutually exclusive across parallel agents:
every writable path has exactly one owner, and a shared file gets exactly one
owner.

```
Task: <one-line goal>
Context: <2-4 lines: what exists, what was ruled out, why this package exists>
Output files: <exact paths you MAY write/create>
FORBIDDEN: <every path you must NOT touch - name the other agents' files and
  all read-only zones explicitly>
Hard constraints: <encoding (English-only / zero CJK), read-only zones,
  no network, no npm install, no external deps, project red lines, budgets,
  no scheduled-task registration, no process left running, no commits,
  no scoreboard edits>
Acceptance = evidence: <the exact command output / counts / exit codes /
  screenshots you MUST paste into the handoff and the PDCA Check section>
Verification you must run: <exact commands, e.g. python scripts/validate_skill.py,
  python scripts/localize_check.py, node --check scripts/verify.js>
Steps: <ordered; spell out anchors/contracts; when two agents must agree, fix
  the data contract as an exact JSON shape in both briefs>
Report <= 40 lines: <file list with line counts, key counts, pasted evidence
  lines, honest list of unverified items (headless limits, clipboard, toast)>
PDCA: when done, append ONE PDCA entry to docs/TASK-LOG.md per its template;
  the Check section must paste real verification evidence. Do not touch the
  scoreboard. State P/D/C/A; C MUST contain real output lines.
```

Rules of thumb:
- Acceptance is pasted evidence, never a claim. "It should work" is a FAIL.
- Mutually exclusive ownership: tools/ vs app/ vs the panel file; a shared
  file gets exactly one owner. List every forbidden path by name.
- Reporting limit is a hard cap; put only file lists, counts, evidence lines
  and unverified items in the report.
- Require honest reporting of what could NOT be verified - that list drives
  the main session's independent re-check (spot-check files, re-run the key
  command). A handback report is a claim, not proof.
- After landing, the main session re-runs the agent's key verification command
  once; independent re-runs catch confident mistakes.
