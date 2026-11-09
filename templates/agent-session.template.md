<!-- Benchmark: .research/linear-height.md A1 (Agent Session six-state machine + first-response SLA), A2 (delegate issues, not accountability) -->
<!-- ai-project-ops.agent-session/1.0 -->
# Agent session contract

> Instantiate with `node scripts/scaffold.js` (registry id `agent-session`).
> Source: Linear's Agent Session state machine, adapted to our ACK gate.
> Linear delegates the ISSUE but keeps ACCOUNTABILITY with the human. We copy
> that boundary; we do not copy its credit/billing surface.

## 1. Six states (A1)

| state | meaning | who moves it |
|---|---|---|
| `queued` | brief received, no session started | system |
| `working` | session active, files owned | AI |
| `awaiting_human` | a decision is required; SLA starts here | AI (must stop and ask) |
| `acknowledged` | human approved with a written decision | human only |
| `rejected` | human refused with a mandatory written reason | human only |
| `done` | Check evidence pasted and verified | main session |

Forbidden transition: `awaiting_human -> done` without a human decision. An AI
cannot write its own approval (`docs/competitive-synthesis.md` claim 2).

## 2. First-response SLA (A1)

| field | value |
|---|---|
| SLA start | when the session enters `awaiting_human` |
| default SLA | 24 h (matches `stuck > 24h` in section 4) |
| on breach | state -> `UNCERTAIN`, never auto-approve, show "Needs human" |
| veto | a veto outranks any positive primary result |

This is the "human as an unreliable external service" rule: timeout,
degraded state, no silent fallback.

## 3. Accountability never delegates (A2)

| item | owner |
|---|---|
| task execution | AI (may be a subagent) |
| file ownership | declared in the brief, mutually exclusive |
| verdict (PASS / FAIL / UNCERTAIN) | main session |
| closing an issue | main session, after pasted evidence |
| scoreboard line | main session only |

A subagent handback is a claim, not proof (SKILL.md section 2).

## 4. Falsifiable acceptance

- Remove the `awaiting_human` row from the state table: the contract is void.
- Any path that lets an AI set `acknowledged` is a FAIL.
- A breach that produces `done` instead of `UNCERTAIN` is a FAIL.
