# Competitive synthesis: where we win on AI-human collaboration

Produced by round R17 Front A. Five reports, 226 cited source URLs, 50 Align
items / 30 Surpass items / 24 Never-copy items. Reports live outside the
package (`.research/`); this file is the promoted conclusion.

Method note. Every claim below is a cross-report claim: it is stated by at
least two independent groups and is not contradicted by any report. Two
load-bearing claims from one report could not be reproduced in this
environment and are excluded (see "Claims not promoted").

## The four claims

### 1. Cost on the artifact, not behind an admin wall

**No competitor in either market puts token or dollar cost on the task card or
the gantt bar.**

- ClickUp prices in credits at $0.001 and shows a per-agent cost panel; the
  unit is a platform credit and it hangs off the agent, not the work unit.
- Asana bills per request ($0.50 / $0.60) with 65/85/100% alerts and a spend
  cap. The surface is an admin console.
- Linear ships a Usage explorer split per session. The issue card carries no
  money.
- Feishu Project publishes an AI point price table (0.1 point ~ CNY 0.005 per
  trigger) with a free pool and per-function monthly caps. The bar stays blank.
- ONES exposes admin request counts under a config centre. PingCode and
  Teambition show no AI cost surface at all in their help.

Our position: `costLabel()` prints `103.7M/$2.24 | name` on the bar itself.
The operator sees spend on the artifact they are already reading. Nobody else
does this at task granularity. **Keep it, and extend it to rollups.**

### 2. Content adjudication with a mandatory written reject reason

**Nobody adjudicates content. They check permissions, or they prompt.**

- ClickUp's "seek human approval" is configured in the agent's instructions.
  It is a prompt-level soft gate: editable, skippable, unlogged.
- Asana has a real per-action approval matrix, but it covers the permission
  surface (remove collaborators, change visibility, send mail). It does not
  ask whether the conclusion is correct.
- Feishu and ONES offer preview-then-confirm. A yes/no confirm is not a
  judgement with a rationale.
- Teambition's approval is a workflow trigger that fires automation.
- PingCode and Feishu review objects are strong, but they review work items
  with pass-rules, not AI output with a stored reject reason.

Our position: the ACK row cannot close without Approve or Reject, and Reject
requires a written `reason` that lands in `data/rejections.json` as a PDCA
entry. An AI cannot write its own approval. **This is the deepest structural
difference in the whole set, not a feature gap.**

### 3. Parallel AI agents on one timeline

**No competitor schedules multiple AI agents as parallel lanes against a NOW
line with blocking signals.**

- Feishu's resource lanes are per-**human** scheduling across spaces.
- Linear, PingCode, ONES, ClickUp, Monday, Notion and Teambition all schedule
  human work items. The strongest human gantt features are PingCode and ONES
  dependency / critical-path / baseline, which we should borrow.
- Height marketed autonomy; its own archived notes reduce most of it to
  *suggests* / *for review*, and the product shut down on 2025-09-24.

Our position: `OWNER_TYPES` distinguishes Human member / AI main session /
Subagent / Agent team, and `lanePlan()` packs them as lanes on one hour axis
with a NOW line and blocking signals. **The field is open. The gantt features
worth borrowing are dependency types, critical-path and baseline compare.**

### 4. AI as a named owner with a declared scope

**No competitor names an AI as the owner of a bar and states what it may do
without asking.**

- Feishu writes AI actions into the operator log, but the assignee on the card
  is a human.
- ONES Assistant creates work items assigned to a person and is bounded by that
  user's permissions.
- ClickUp gives the agent an avatar and a DM, and treats it as a user, but the
  scope rules live in prompts.
- Teambition's help carries no AI assignee concept at all.

Our position: `owner_type` is stored on the work unit and rendered on the card.
The next step is a written scope per owner type: what a subagent may do alone,
what needs an ACK, what is never automatic.

## Never-copy, consolidated

Across the 24 anti-patterns four recur:

1. **Cost hidden in billing while the work surface is cost-blind.**
   Principle: print spend on the artifact the operator is reading.
2. **"Approval" reduced to a confirm dialog or a permission bit.**
   Principle: content adjudication stores a written reason.
3. **Unattended AI writes with no measured on/off.**
   Principle: token spend runs only after a measured probe (section 6).
4. **A temporary bypass left permanently in the documentation.**
   Principle: every bypass is registered, versioned, and given an expiry.

## Claims not promoted

Two claims from the ClickUp / Asana / Motion report were queued as mandatory
spot-checks and did not survive:

- Asana's public documentation is said to expose a temporary bypass flag named
  `##TemporarilyAllowAiTeammateMultihomingWithoutApproval` that "currently
  completely bypasses approval".
- ClickUp's "seek human approval" is said to be a prompt-level soft gate.

**Status: UNCERTAIN, not refuted.** The cited help centres are JavaScript
shells; a direct fetch returns a 743 KB stub with no article body and a
headless render returned zero text. An exact-token web search returned no
corroboration for either. The report itself already graded the second claim
"not found in configuration documentation, needs live confirmation". These two
claims are therefore excluded from the four claims above and must not be cited
as fact until someone reads the rendered page. The ClickUp conclusion is
independently supported by the report's quoted privacy text and by the absence
of any documented approval toggle, so claim 2 above rests on that weaker but
adequate footing, not on the flagged claim.

## What to build first

Ordered by value per unit of work:

1. Per-action approval matrix behind the ACK gate (Asana's structure, our
   reject-reason rule). Effort M.
2. Dependency lines with blue-not-violated / red-violated semantics and a drag
   bump chain (Linear / PingCode / ONES). Effort M.
3. Baseline snapshot and compare on the gantt (PingCode / ONES). Effort M.
4. Critical-path toggle that dims non-critical bars. Effort M.
5. Board keyboard model: multi-select, move to top/bottom within a column,
   list and board sharing one order (Linear). Effort S.
6. Owner scope document per `owner_type`. Effort S.
