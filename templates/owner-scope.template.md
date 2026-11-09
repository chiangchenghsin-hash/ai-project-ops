<!-- Benchmark: docs/competitive-synthesis.md claim 4 + B6; .research/devin-jules-copilot.md -->
<!-- ai-project-ops.owner-scope/1.0 -->
# Owner scope by owner_type

> Instantiate with `node scripts/scaffold.js` (registry id `owner-scope`).
> Source: synthesis claim 4 — no competitor names an AI as the owner of a bar
> AND states what it may do without asking. `owner_type` is already stored on
> every work unit (`src/types.ts:4`) and rendered on the card (`board.ts:90`),
> but until this file exists the scope is implicit.
> STATUS OF THE SHIP (C9): B6 is IMPLEMENTED. `GET /api/policy/owner-scope`
> serves the four scopes from SQLite; `src/policy.ts` renders them in the desk.

## 1. Four owner types

| owner_type | may act alone | needs ACK | never automatic |
|---|---|---|---|
| `human` | all human decisions | n/a | n/a |
| `main` | plan, delegate, verify, append PDCA entries | changing frozen artifacts, scoreboard edits | approving its own output; closing a veto |
| `subagent` | only files inside its declared ownership | any file outside the brief; any verdict | writing `docs/TASK-LOG.md`; reading the blind map |
| `team` | parallel work on disjoint files | cross-team dependency changes | merging another team's ownership |

## 2. Rules that apply to every AI owner type

1. A handback report is a claim, not proof. Re-run its key command.
2. Every Check line pastes real command output. "Should work" is FAIL (E01).
3. No AI may close an issue. The main session closes it after pasted evidence.
4. No AI may edit a frozen artifact. A correction uses a NEW freeze id.
5. Token spend on an automated probe requires a measured on/off decision.

## 3. Scope statement on the work unit

Each task row in `docs/PLAN.md` names `owner`, `owner_type`, `acceptance` and
`evidence path`. A row with no owner or no acceptance is a FAIL under the
structure gate. The owner scope is inherited from `owner_type`, never
re-negotiated in chat.

## 4. Falsifiable acceptance

- Give a subagent a brief without a FORBIDDEN list: the brief is void.
- Let a `subagent` append to `docs/TASK-LOG.md`: MUST be blocked by ownership.
- Any row where "needs ACK" is empty for `subagent`: the table is decorative.
