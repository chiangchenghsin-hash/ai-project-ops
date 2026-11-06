# Trigger regression (20 positive / 10 negative)

Guard the `description` trigger surface of [SKILL.md](../SKILL.md). Re-run this
regression after ANY edit to `description`, `description_en` or
`description_zh`, and before every publish (see
[RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md)).

## Deterministic proxy

This is an offline, keyword-based proxy for the skill router so the gate is
checkable without a live model. Define:

- TRIGGER keywords (case-insensitive substrings, drawn from the description):
  `pdca`, `task log`, `task ledger`, `subagent brief`, `token metering`,
  `token spend`, `token/cost`, `metering`, `command snapshot`, `issue ledger`,
  `presence gate`, `scheduled job`, `scheduled task`, `is it worth enabling`,
  `rework`, `re-planning`, `linked gantt`, `day-one bootstrap`,
  `script proposal`, `when to script`, `command panel`, `measured on/off`.
- EXCLUSION topics (the "Not for" red line): pure report/document generation,
  multi-tenant auth systems, 3D or spatial views, cloud file sync, conceptual
  questions about skills.

A phrase ACTIVATES the skill iff it contains >= 1 TRIGGER keyword and 0
EXCLUSION signals. The regression PASSES iff all 20 positives ACTIVATE and all
10 negatives do NOT. Every negative must also concern >= 1 EXCLUSION topic.

## 20 positive phrases (must match)

| # | Phrase | Trigger keyword present |
|---|---|---|
| 1 | Set up a PDCA task log for my new clean-room rewrite | pdca, task log |
| 2 | How do I keep a task ledger with real Check evidence? | task ledger |
| 3 | Write a subagent brief for a parallel refactor | subagent brief |
| 4 | I need self-contained subagent briefs for two agents | subagent brief |
| 5 | Meter token spend from the usage database | token spend |
| 6 | Show token/cost metering as one small table | token/cost, metering |
| 7 | Build a human-AI command panel with a command snapshot | command panel, command snapshot |
| 8 | Add an issue ledger with reply cells and ENDDATE | issue ledger |
| 9 | Add a presence gate for scheduled jobs | presence gate, scheduled job |
| 10 | Is it worth enabling this scheduled task that spends tokens? | is it worth enabling, scheduled task |
| 11 | Decide the measured on/off switch for unattended automation | measured on/off |
| 12 | We are re-planning after rework; log a new PDCA entry | re-planning, rework, pdca |
| 13 | Day-one bootstrap checklist for a reverse-engineering rewrite | day-one bootstrap |
| 14 | When to script a repeated deterministic flow? | when to script |
| 15 | Draft a script proposal for a repeated flow | script proposal |
| 16 | Linked gantt board with one dataset and linked drag | linked gantt |
| 17 | Command snapshot copied to the clipboard for Claude | command snapshot |
| 18 | Estimate work in token tiers S/M/L/XL and meter token spend | token spend |
| 19 | Linked gantt board with hour-based placeholder bars | linked gantt |
| 20 | Rework must be its own gantt bar and PDCA entry | rework, pdca |

## 10 negative phrases (must NOT match)

| # | Phrase | Why it is out of scope |
|---|---|---|
| 1 | Generate a pure weekly status report PDF for my manager | pure report generation |
| 2 | Build a multi-tenant OAuth2 and SSO authentication service | multi-tenant auth systems |
| 3 | Create a 3D WebGL model viewer | 3D or spatial views |
| 4 | Set up cloud file sync between my laptop and desktop | cloud file sync |
| 5 | Explain what a Claude Code skill is conceptually | conceptual questions about skills |
| 6 | How does the skill frontmatter parser work in general? | conceptual questions about skills |
| 7 | Write a generic marketing dashboard with charts | generic report/dashboard generation |
| 8 | Implement a real-time multiplayer game server | unrelated software domain |
| 9 | Translate this paragraph into French | unrelated task |
| 10 | Design a relational database schema for an e-commerce app | unrelated software domain |

## Pass rule

- All 20 positive phrases contain >= 1 TRIGGER keyword and 0 EXCLUSION signals
  -> the router MUST activate the skill for each.
- All 10 negative phrases contain 0 TRIGGER keywords and >= 1 EXCLUSION topic
  -> the router MUST NOT activate the skill for any.
- PASS iff both conditions hold. A single missed positive or caught negative
  is a FAIL: fix the `description` trigger list (or the "Not for" clause) and
  re-run. No unbounded-claim words may be added while fixing triggers (see
  [references/packaging-spec.md](../references/packaging-spec.md)).
