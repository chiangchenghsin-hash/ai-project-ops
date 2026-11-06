# Release checklist

Pre-publish gates for the English GitHub release. The authoritative packaging
rules (8-field frontmatter, `@references` layout, zip rules, red lines) are in
[references/packaging-spec.md](../references/packaging-spec.md).

## Pre-publish gates

- [ ] `SKILL.md` frontmatter has all 8 required fields (`name`, `display_name`,
      `display_name_en`, `description`, `description_zh`, `description_en`,
      `version`, `author`); `name` == directory name; `version` bumped in
      [SKILL.md](../SKILL.md), [README.md](../README.md) and
      [CHANGELOG.md](../CHANGELOG.md); `agent_created: true` kept.
- [ ] `examples_zh` / `examples_en` (3 each) and `allowed-tools` present.
- [ ] `description` carries a "Not for:" negative-trigger list; NO unbounded
      claim words (fully automatic / one-click solves all / supports everything)
      in any `description*` field.
- [ ] Starter-kit caveat stated plainly in SKILL.md section 4; shipping or
      opening the shipped panel does NOT satisfy section 4; "paste verification
      output" rule intact.
- [ ] Metering columns unified: SKILL.md section 3 and references/metering.md
      both use one table (project / requests / in / out / cache-read / $) with
      billed / fresh as FORMULA NOTES, not columns.
- [ ] `python scripts/validate_skill.py` exits 0 (or 1 with every warning
      reviewed and justified). It writes docs/evidence/validation-report.json.
- [ ] `python scripts/localize_check.py` prints `CJK_COUNT=0`.
- [ ] `python -m py_compile scripts/validate_skill.py scripts/localize_check.py`
      exits 0; `node --check scripts/verify.js` exits 0.
- [ ] `node scripts/verify.js` E2E passes (real Chrome over CDP; run by the
      main session, not by a subagent). Paste the PASS lines as evidence.
- [ ] All markdown relative links resolve (validator check is green).
- [ ] Zero CJK characters in packaged text files; no absolute personal paths
      (`C:\Users\<name>`, `/Users/<name>`, `/home/<name>`) and no credentials.
- [ ] No runtime state in the tree: no `*.db`, `*.pid`, `*.db-shm`,
      `*.db-wal`, `.chrome-check*`, no browser profiles, no `.git/`.
- [ ] Zip built with UTF-8 filenames and the UTF-8 filename flag (`0x800`);
      arcnames relative; no packaged `*.zip`.
- [ ] Install paths documented for BOTH Claude Code and WorkBuddy in README.
- [ ] `CHANGELOG.md` has an entry for the version being released; handoffs
      archived.

## Post-publish reminder

- Re-run the trigger regression in
  [TRIGGER-REGRESSION.md](TRIGGER-REGRESSION.md): all 20 positive phrases must
  activate the skill, all 10 negative phrases must not. Do this after ANY
  edit to `description` (or `description_en` / `description_zh`), because a
  trigger-list change can silently break routing. A missed positive or a
  caught negative is a FAIL -> fix and re-publish.
- Re-run `python scripts/validate_skill.py` and
  `python scripts/localize_check.py` on the published tree once more.
