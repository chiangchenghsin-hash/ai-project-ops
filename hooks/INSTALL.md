# Installing the discipline hooks

## Scope rule (read first)

Install at **PROJECT level only**:

- Claude Code: `{workspace}/.claude/settings.local.json` (or
  `{workspace}/.claude/settings.json` if the project is private).
- WorkBuddy: `{workspace}/.workbuddy/settings.json`.

Do **not** write `~/.claude/settings.json` or `~/.workbuddy/settings.json`.
Those are user-global; a `Stop` hook there would block every unrelated project
on this machine. This package never modifies either global file.

## Verified configuration format

Both platforms use the same shape on this machine (checked against the live
user-global files on 2026-11-08):

```json
{
  "UserPromptSubmit": [
    { "matcher": "", "hooks": [
      { "type": "command", "command": "node ...", "timeout": 5 }
    ]}
  ],
  "Stop": [
    { "matcher": "", "hooks": [
      { "type": "command", "command": "node ...", "timeout": 15 }
    ]}
  ]
}
```

`hooks/settings.fragment.json` is the ready-to-merge fragment. Replace
`<SKILL_ROOT>` with this package's absolute path, then merge the two keys into
the project settings file. If the file already has `UserPromptSubmit` or `Stop`
entries (the machine does), **append** the hook objects to the existing arrays;
do not replace the arrays. Back up the file first.

## Merge helper (dry-run by default)

```
python scripts/merge-hooks.py --fragment hooks/settings.fragment.json --target <project-settings.json>
python scripts/merge-hooks.py --fragment hooks/settings.fragment.json --target <project-settings.json> --apply
```

The first command prints the merged JSON without writing. The second writes it
after creating a `<target>.bak` copy. Both are idempotent: an already-present
command is not duplicated.

## What each hook does

| hook | script | behaviour |
|---|---|---|
| `UserPromptSubmit` | `scripts/session-start.js` | Writes `docs/evidence/session.json` (start snapshot) and injects a <120-token reminder with the open-issue count and the three mandatory closing actions. Always exit 0. |
| `Stop` | `scripts/discipline-gate.js` | Recomputes the eight invariants in `docs/DISCIPLINE-INVARIANTS.md`. Missing I1-I6 -> exit 2 with a fix hint on stderr, which blocks the turn. I7/I8 are UNCERTAIN and never block. |

## Escape hatches

- `DISCIPLINE_GATE_DRYRUN=1` — report without blocking (use during rollout).
- `DISABLE_DISCIPLINE_GATE=1` — disable for one installation.
- Internal errors are fail-open (`GATE-DEGRADED`, exit 0).

## Rollout check (paste as PDCA Check evidence)

```
node scripts/selftest-discipline.js        # expect 12/12 passed, RESULT: PASS, exit 0
node scripts/session-start.js              # expect the reminder block
node scripts/issue.js list                 # expect the open-issue table
node scripts/scaffold.js                   # expect two PASS lines
node scripts/discipline-gate.js            # expect PASS after the steps above
```

If the Stop hook does not fire, check that the `Stop` key is registered and
that the `command` path resolves. The local CDP gate has a recorded history of
"script exists but the line is not wired" — verify the registration, not just
the file.
