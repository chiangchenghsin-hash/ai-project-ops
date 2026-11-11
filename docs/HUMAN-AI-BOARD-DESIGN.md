# Human-AI battle board: Teambition-framework absorption map

Source: the human pasted a design framework in chat (Chinese, re-surfaced
2026-11-10): Teambition UI template strengths mapped onto human-AI agent
collaboration (humans + AI agents + subagents + several Claude Code sessions
in one project). This doc is the durable analysis so the framework stops
living in chat history. Original language: Chinese; translated here.

## The framework, translated

Three strengths worth borrowing:

1. One dataset, many views (kanban / list / table / gantt / calendar over the
   same tasks).
2. The task card carries context (owner, due, priority, subtasks, comments;
   discussion travels with the card).
3. Template-ized best practice (industry templates turn methodology into
   reusable flows).

Concept mapping (Teambition -> human-AI collaboration):

| Teambition       | Reused as                    | Why it holds |
|------------------|------------------------------|--------------|
| task (card)      | work item (the unified object) | humans and AI both "do one thing" |
| owner / members  | executor (human UNION AI)    | cards sort by ownership + state, not species |
| priority / tags  | approval gate / confidence / cost | AI-specific dimensions become fields |
| kanban / gantt / stats | kanban / dependency graph / audit trail | one dataset, many concerns |
| DingTalk approval fields | human sign-off gates | which actions AI may do alone |
| template library | human-AI SOP templates       | "AI writes -> self-test -> human approves -> merge" |

Four views, four questions:

1. Kanban: who is doing what now, where is it stuck (human and AI cards side
   by side).
2. Gantt / dependency graph: which agent waits on which, critical path,
   deadlock risk (the multi-session hazard).
3. Responsibility matrix: which actions AI may take alone vs which need a
   human sign-off (the DingTalk-approval replacement).
4. Audit trail / stats: who (which agent) did what when, token cost, approval
   pass rate, human wait time (finds the bottleneck).

Two SOP templates to fix first:

1. Code review SOP: AI writes -> AI self-tests -> human approve gate ->
   merge. A card with confidence below threshold auto-escalates to human.
2. Research SOP: AI searches -> human sets direction -> AI deep-dives ->
   human finalizes.

Three red lines (the borrowing limit):

1. No anthropomorphism: AI cards show model / instance id / cost - observable,
   never "like a colleague".
2. Approvals are not optional: any side effect (write files, send messages,
   call APIs) must pass a gate.
3. Audit first: every action leaves a trace a human can hold accountable.

External references named by the human (patterns, not vendored): AgentWebUI
(unified panel + token dashboards), ClawDeck (pure kanban agent
collaboration), mission-control class tools (governance + approvals + org
tree + monitoring).

## Absorption audit (evidence-based, 2026-11-10)

| Framework item | Status | Evidence |
|---|---|---|
| one dataset, many views | IMPLEMENTED | board + hour gantt + plan tree + desk + ledger over one SQLite store; battery 148/148 |
| task card context | PARTIAL | cards carry owner/status/cost/dates + dep links (I-029); missing gate/confidence/model fields (I-033) |
| template library | IN FLIGHT | I-031 wbs_templates + /api/templates (Teambition provenance line in R30 lock) |
| responsibility matrix | IMPLEMENTED | /api/policy/owner-scope 4 owner types (may_act_alone / needs_ack / never_automatic), BENCHMARK-ADOPTION.md B6; approval matrix /api/policy/approvals, B1 |
| gantt / dependency / deadlock view | IMPLEMENTED | task_deps + gdep arrows + critical path + I-029 card links |
| audit trail | PARTIAL | desk events (I-019) + PDCA ledger + rejections.json; missing pass-rate / wait-time aggregates (I-035) |
| stats dashboard | PARTIAL | Meter view (token cost); missing completion rate, member load, wait time (I-035) |
| confidence + auto-escalation | MISSING | -> I-033 |
| two SOP templates | MISSING | -> I-034 |
| three red lines as product rules | PARTIAL | red lines 2-3 enforced at API (B1/B6, events); red line 1 (card display rule) -> I-033 |
| AgentWebUI / ClawDeck / mission-control refs | RECORDED NOW | previously chat-only; listed above |

## Staged plan

- I-033: card-level AI dimension fields (gate state, confidence, token cost,
  model/instance) + red line 1 as a display rule + per-card audit link.
- I-034: SOP template pack (code review + research) living in the I-031
  template library as a process category; gate steps become explicit
  approval work items.
- I-035: ops stats (approval pass rate, human wait time, member load,
  completion rate) derived deterministically from events/ACK/task rows.
