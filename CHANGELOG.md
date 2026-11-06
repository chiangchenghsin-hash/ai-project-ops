# Changelog

All notable changes to this skill package. Versions follow semver.

## 1.2.0 - 2026-11-06 (GitHub release)

- **Published to GitHub** as `chiangchenghsin-hash/ai-project-ops` on branch
  `main`. The archive now ships the complete package: 11 disciplines, the
  linked-gantt panel starter kit, the validation / E2E / localize scripts, the
  blank templates, and the C2/C3 evidence layer.
- **C3 response style**: added SKILL.md section 11 and
  `references/response-style-ste100.md`. Covers the softened 80% ASD-STE100
  style (short sentences / active voice / one word one meaning / numbered
  steps / no hedging / no synonym rotation), graded source provenance, the
  Chinese ~20-character local approximation, prompt templates, and the
  mandatory fact-retention gate. Frozen artifacts were not edited; the C2
  freeze remains valid.
- Added response-style trigger phrases to the SKILL.md description.

## 1.1.0 - 2026-11-05 (English GitHub release)

- **C2 verification-evidence layer**: three cold-read reports, four-layer
  evidence matrix, error codes E01-E12, PDCA three-state verdict
  (PASS / FAIL / UNCERTAIN) and the C2 acceptance classification added to the
  package.
- **English localization**: whole package converted to English-only text
  (zero CJK characters); `assets/linked-gantt-board/` localized to strict ASCII,
  compiled `dist/` regenerated.
- **S1-S4 panel increments**: linked gantt / work-division starter kit, ACK
  command loop, blocking-signal desk with "Needs human decision", health /
  backup / restore / degraded DEMO mode, and a >=30-case CDP selftest suite.
- **Cold-read fixes**: internalized the official spec into
  `references/packaging-spec.md` (8-field frontmatter table, `@references`
  conventions, zip rules, red lines, release checklist); unified metering
  column definitions between `SKILL.md` section 3 and `references/metering.md`;
  stated the starter-kit caveat plainly so shipping the page no longer reads as
  satisfying section 4; kept the "paste verification output" rule.
- **8-field frontmatter**: `SKILL.md` now carries `name`, `display_name`,
  `display_name_en`, `description`, `description_zh`, `description_en`,
  `version` (1.2.0) and `author`, plus `examples_zh` / `examples_en` (3 each),
  `allowed-tools` and `agent_created: true`. `description` gained a "Not for:"
  negative-trigger list and lost all unbounded-claim wording.
- **Validation scripts**: added `scripts/validate_skill.py` (14 deterministic
  offline checks, writes `docs/evidence/validation-report.json`, exit 0/1/2),
  `scripts/verify.js` (one-command server + headless Chrome + selftest E2E),
  `scripts/localize_check.py` (CJK counter). All carry the
  BACKGROUND / CONDITIONS / VERSION header.
- **New docs and templates**: `templates/` (TASK-LOG, PDCA entry, subagent
  brief), `docs/TRIGGER-REGRESSION.md` (20 positive / 10 negative phrases),
  `docs/RELEASE-CHECKLIST.md` (pre-publish gates + post-publish reminder),
  `docs/handoffs/P3.md`. README documents install paths for both Claude Code
  and WorkBuddy plus the verify/validate commands.

## 1.0.0 - pre-C2

Initial Chinese-language package: 10 disciplines, PDCA ledger, subagent briefs,
metering rules, command-panel spec, and a linked gantt / work-division board
starter kit. Superseded by the English 1.1.0 release.
