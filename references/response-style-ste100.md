# Response style: 80% ASD-STE100 (C3)

## 1. Why this file exists

Section 4 of this skill treats the panel as the human's steering wheel. A
snapshot, a ledger row and a status column only help if a human can read them.
Long sentences, hedging and synonym rotation make AI output hard to check. This
file gives a controlled writing style for replies, snapshot lines, PDCA Check
lines, subagent briefs and issue replies.

The style governs **clarity, not truth**. See section 6.

## 2. Provenance (graded, do not upgrade)

| Claim | Level | Evidence |
|---|---|---|
| Andrej Karpathy posted on X on 2026-10-02 about understanding model output | Secondary, corroborated | LINE TODAY (2026-10), Web Pulse News (checked 2026-10-05), dev.to article, justbeingresourceful.com (2026-10-19) |
| He recommended asking a model to answer in ASD-STE100 | Secondary, corroborated | same four sources |
| He softened it to "about 80% of the way to ASD-STE100" because the full spec is stringent | Secondary, corroborated | Web Pulse News; justbeingresourceful.com |
| ASD-STE100 is Simplified Technical English for aircraft maintenance manuals; ~900 approved words, 53 writing rules, 20-word procedural / 25-word descriptive caps, active voice, one word one meaning | Secondary | Web Pulse News; dev.to; justbeingresourceful.com. Issue 9 dated 2025-01 in these reports. Verify against the official ASD publication before quoting as authoritative. |
| Chinese-language users call the softened style "aircraft maintenance manual style" | Community usage, reported by the maintainer | Maintainer input, 2026-11-06. Not an official term. |
| No official Chinese clause of ASD-STE100 exists; Karpathy did not discuss Chinese | Secondary, corroborated | LINE TODAY explicitly states ASD-STE100 is an English specification and Karpathy did not address Chinese |
| View count of the X post | **UNVERIFIED — do not cite** | Sources disagree (6.7M vs 7.9M); primary post URL not retrieved |

Primary X post URL: **not verified**. Treat the whole provenance table as
secondary. This file does not claim to reproduce the original post.

## 3. The 80% rule set

Use these six rules. Do not add dictionary enforcement. Full ASD-STE100 is too
strict for conversational replies.

1. **Short sentences.** One sentence carries one instruction or one fact.
2. **Active voice with a named actor.** Write "Save the file." Do not write
   "The file should be saved."
3. **One word, one meaning.** Pick one term and keep it. Do not rotate
   `function`, `routine`, `method`, `procedure` for the same thing.
4. **Numbered steps.** Number procedures. One step holds one action.
5. **No hedging.** Delete `might`, `arguably`, `in some sense`, `generally`.
   State the fact, or state that evidence is missing.
6. **No decorative synonyms.** Repeat the same noun. Repetition is a feature.

### Chinese adaptation (local approximation, not a standard)

- ASD-STE100 has **no official Chinese clause**. Do not claim one.
- Use roughly **20 Chinese characters per sentence** as a local budget. It is a
  working approximation, not a rule from ASD.
- Keep rule 2, 3, 4 and 5 unchanged when writing Chinese.
- This package is English-only. The maintainer's Chinese prompt is recorded here
  as an English equivalent, not as CJK text:
  "Answer in 80% ASD-STE100 style: short sentences, active voice, one word one
  meaning, numbered steps."

## 4. Prompt templates

```
Answer in 80% ASD-STE100 style. Use short sentences. Use active voice.
Use one word with one meaning. Number the steps. Do not hedge.
Keep every number, date, condition and caveat from the source.
```

For a rewrite of existing text:

```
Rewrite the text below in 80% ASD-STE100 style. Keep short sentences and
active voice. Number the steps. Preserve every number, date, condition,
negation and caveat. Then list the preserved numbers and conditions.
```

## 5. Where to use it in this skill

| Surface | Rule |
|---|---|
| Command snapshot lines | Rules 1-5. Keep measured spend numbers verbatim. |
| PDCA Check lines | Rules 1-4. Paste real output. Never replace output with a summary. |
| Subagent briefs | Rules 1-4. State file ownership in one sentence per owner. |
| Issue ledger replies | Rules 1-3. One reply holds one decision. |
| Frozen artifacts (plan, design, freeze JSON) | **Do not rewrite.** C2 lesson: editing a frozen artifact voids its round. |

## 6. Fact-retention gate (mandatory)

Short rewrites drop facts. This is the known failure mode. Apply this gate
before accepting any rewritten text.

1. Extract the set of numbers, dates, negations and conditions from the source.
2. Extract the same set from the rewrite.
3. Compare the two sets.
4. PASS only when the sets are equal and no condition lost its scope.
5. On any difference, restore the missing item. Do not accept "same meaning".

Worked example:

- Source: "If the meter DB is unavailable, do not enable the job; the probe runs
  1-3 times before the decision."
- Bad rewrite: "Run the probe. Then enable the job." -> drops the condition, the
  negation and the range 1-3. **FAIL.**
- Good rewrite: "1. Check the meter DB. 2. If the DB is unavailable, do not
  enable the job. 3. If the DB is available, run the probe 1-3 times. 4. Then
  decide." -> **PASS**, sets equal.

This gate is an application of section 1 of SKILL.md: no Check evidence = task
not done. A clean sentence is not evidence.

## 7. Machine self-check before adoption

1. Give the style rules to a model with a text containing at least two numbers,
   one negation and one condition.
2. Require the rewritten text plus the extracted fact set.
3. Compare sets automatically.
4. A true positive keeps all facts. A true negative drops at least one.
5. Record both outcomes. Do not adopt the prompt until both are observed.

## 8. Correction record

- C3 (2026-11-06): added this reference and SKILL.md section 11. Frozen
  artifacts were not edited. The C2 freeze remains valid; see
  `docs/evidence/freeze-manifest.json`.
