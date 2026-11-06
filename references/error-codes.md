# Error codes E01-E12 (C2 verification signals)

Each code is a machine-detectable signal, not a suggestion. When a code fires,
the round resolves to the stated PDCA state (definitions and precedence in
`references/pdca-three-state.md`; layer classification in
`references/evidence-matrix.md`). Codes are referenced by the handoff reports
and by the C2 verification cases.

## Summary

| Code | Short name | Primary layer | Required PDCA state |
|---|---|---|---|
| E01 | no Check evidence | Execution | FAIL |
| E02 | meter schema mismatch | Configuration / Acceptance | UNCERTAIN |
| E03 | presence gate false start | Consumer-load | FAIL |
| E04 | rework merged into old entry | Execution | FAIL |
| E05 | snapshot copy failed | Execution / Consumer-load | FAIL (UNCERTAIN if headless limit) |
| E06 | PUT rollback | Execution | FAIL |
| E07 | frozen artifact changed | Configuration (veto) | FAIL + round VOID |
| E08 | unblinding detected | Acceptance (veto) | UNCERTAIN + round VOID |
| E09 | self-check failed | Execution | FAIL |
| E10 | no discrimination in a failure cell | Acceptance | UNCERTAIN |
| E11 | Node/sqlite degradation invoked | Execution | FAIL |
| E12 | Chrome unavailable / UI unverified | Consumer-load | UNCERTAIN |

Veto codes (E07, E08) override any positive primary result. UNCERTAIN codes
(E02, E08, E10, E12) win over FAIL when the evidence is incomplete. E05 is the
one code whose state depends on whether a test actually ran (FAIL) or could
not be executed at all (UNCERTAIN, via E12).

---

## E01 - no Check evidence

- **Trigger:** A PDCA entry's Check section has no pasted command output,
  counts, exit codes or screenshots, or contains only the phrase `should work`.
- **Detection command or signal:** `grep -n "should work" docs/TASK-LOG.md docs/handoffs/*.md`
  returns non-empty, or a Check body has zero fenced output lines.
- **Required PDCA state:** **FAIL** (`SKILL.md` section 1: no Check evidence =
  task not done).
- **Remediation:** Re-run the verification command, paste the real output lines
  into Check, or mark the entry FAIL with a one-line lesson. Do not score it.

## E02 - meter schema mismatch

- **Trigger:** The probe script reads a meter DB whose schema differs from the
  assumed join (table/column names changed), so measured spend cannot be
  attributed to a project.
- **Detection command or signal:** `sqlite3 <meter> ".schema"` diff against the
  documented join; the probe returns 0 rows, `KeyError`, or `no such column`;
  the join from `references/metering.md` yields empty attribution.
- **Required PDCA state:** **UNCERTAIN** (measured numbers are missing; the
  "never estimate" rule forbids guessing).
- **Remediation:** Introspect the schema first, adapt the join, re-run the probe
  READ-ONLY, keep the numbers out of the ledger until measured. UNCERTAIN wins
  over FAIL here because the evidence is incomplete, not negative.

## E03 - presence gate false start

- **Trigger:** A scheduled token-spending job ran while the human was absent
  (no 3-signal presence), or was shipped ENABLED by default.
- **Detection command or signal:** `status.json` shows a real run (not
  `skipped: not present`) while transcript mtimes are older than the window and
  observatory ports are closed; the job registry shows default-enabled.
- **Required PDCA state:** **FAIL**.
- **Remediation:** Ship the job DISABLED, add the 3-signal presence check,
  re-verify the skip path (VC14), and purge any spend from the run.

## E04 - rework merged into old entry

- **Trigger:** An existing PDCA entry was edited in place to absorb a rework
  instead of appending a NEW entry.
- **Detection command or signal:** `git diff` shows an in-place edit of a scored
  entry; no `rework-of:` link and no new gantt bar exist for the redo.
- **Required PDCA state:** **FAIL**.
- **Remediation:** Void the silent edit, append a NEW PDCA entry with
  `rework-of: <original entry>`, draw its own cost-first gantt bar, and cite the
  original's FAIL lesson. Never edit old entries (SKILL.md section 9).

## E05 - snapshot copy failed

- **Trigger:** Clipboard copy (the `navigator` path or the `execCommand`
  fallback) did not place the command snapshot text.
- **Detection command or signal:** The selftest clipboard case returns FAIL;
  `copyText()` returns false; a clipboard read-back is empty.
- **Required PDCA state:** **FAIL** when a test actually ran and failed;
  **UNCERTAIN** when it is a headless clipboard limit (delegated to E12).
- **Remediation:** Exercise both paths with a real user gesture, restore the
  `execCommand` fallback, re-run VC11 / VC18, and paste the PASS lines.

## E06 - PUT rollback

- **Trigger:** An optimistic UI update was not persisted; the PUT endpoint
  rolled back or rejected the write.
- **Detection command or signal:** After a drop, SQLite still holds the old
  value; the selftest PUT-persistence case (VC12) FAILs; a non-2xx response
  from `PUT /api/*`.
- **Required PDCA state:** **FAIL**.
- **Remediation:** Re-apply via PUT, fix the endpoint transaction, re-run VC12.
  Never leave the UI showing unpersisted state as done.

## E07 - frozen artifact changed

- **Trigger:** A file listed in the freeze manifest no longer matches its
  recorded SHA-256, or the manifest itself was edited (the self-hash gap).
- **Detection command or signal:** A hash-compare command over the frozen set
  plus the manifest's own digest; any mismatch. The PRE-C2 frozen SHA-256 values
  are retained in `docs/TASK-LOG.md` for audit.
- **Required PDCA state:** **FAIL**, and the round is **VOID** (a veto). A
  positive primary result (e.g. 30/30 PASS) is overridden.
- **Remediation:** Void the round as a CORRECTION (not a scored entry), restore
  from `archive-pre-c2/`, re-freeze with new hashes (P4). Never silently edit a
  frozen artifact.

## E08 - unblinding detected

- **Trigger:** A reader or scorer can see the control/treatment identity of a
  card (label, filename, metadata, path) before scoring.
- **Detection command or signal:** Audit of card labels / blind-key exposure; a
  card name or path reveals the arm; a blind-key file is present in the package.
- **Required PDCA state:** **UNCERTAIN**, and the affected round is **VOID** (a
  veto) - re-blind and re-run.
- **Remediation:** Void the round as a correction, re-blind all cards, re-run
  the 2x2 scoring (VC22). Do not score the exposed cards.

## E09 - self-check failed

- **Trigger:** The canonical self-check list (4 checks after the C2 fix; the
  PRE-C2 spec was ambiguous between 3 and 4) reports a failing check.
- **Detection command or signal:** Self-check command output contains `FAIL`;
  one of the 4 required checks is red or missing.
- **Required PDCA state:** **FAIL**.
- **Remediation:** Fix the failing item, re-run all 4 self-checks until green,
  then hand off. Do not hand off a partially-checked package.

## E10 - no discrimination in a failure cell

- **Trigger:** In the 2x2 experiment a failure cell shows no measurable
  difference between control and treatment (effect = 0, or p >= 0.05 for that
  cell), or the cell is missing entirely (the PRE-C2 three-cell conflict).
- **Detection command or signal:** Per-cell discrimination statistic absent or
  zero; a cell missing from the 2x2; the sign test cannot reject.
- **Required PDCA state:** **UNCERTAIN** (efficacy cannot be claimed from a cell
  that does not discriminate) - neither FAIL nor PASS.
- **Remediation:** Populate the missing 2x2 cell, add paired cards so
  `p_min <= 0.05` (VC20 / VC21), recompute per-cell discrimination.

## E11 - Node/sqlite degradation invoked

- **Trigger:** Code fell back to a degraded path (JSON-file mode, in-memory
  shim, or a stub) because Node < 22.5 or `node:sqlite` was unavailable.
- **Detection command or signal:** A degradation log line;
  `typeof Database === "undefined"`; the SQLite file is never created;
  `node -v` reports a version below 22.5.
- **Required PDCA state:** **FAIL** (the "SQLite = single source of truth"
  stack contract is violated).
- **Remediation:** Require Node >= 22.5, remove the shim, restore SQLite as the
  only store, re-run VC10 and VC12.

## E12 - Chrome unavailable / UI unverified

- **Trigger:** `selftest.js` cannot attach to Chrome over CDP (no
  `--headless=new --remote-debugging-port=9224`), so the UI / consumer-load
  cases did not run.
- **Detection command or signal:** A CDP connection error; missing PASS lines
  for VC15-VC19; `node selftest.js` exits before the browser suite.
- **Required PDCA state:** **UNCERTAIN** - UNCERTAIN wins over FAIL when the
  evidence is incomplete; never claim "the page opens" as delivery.
- **Remediation:** Start Chrome with the required flags, re-run the CDP suite,
  paste the PASS lines. If Chrome truly cannot run, list it as an unverified
  item in the handoff report (per `references/subagent-brief.md`).
