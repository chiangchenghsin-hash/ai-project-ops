# Packaging spec (internalized from the WorkBuddy open-platform skill spec)

This file exists so a cold reader, with no context and no access to an external
spec, can verify that this package is constituted correctly. It is the fix for
the cold-read meta-finding: the official spec used to live only on a web page,
so a no-context reader could not even enumerate the required fields. Here they
are written into the package.

Authoritative companion documents: the release gates in
[docs/RELEASE-CHECKLIST.md](../docs/RELEASE-CHECKLIST.md), the trigger phrases in
[docs/TRIGGER-REGRESSION.md](../docs/TRIGGER-REGRESSION.md), and the live
frontmatter in [SKILL.md](../SKILL.md).

## 1. Required frontmatter fields (8)

`SKILL.md` must start with a YAML `---` block. These eight fields are required:

| # | Field | Meaning | This package |
|---|---|---|---|
| 1 | `name` | Skill identifier; MUST equal the directory name. | `ai-project-ops` |
| 2 | `display_name` | Human-facing name. | `AI Project Ops` |
| 3 | `display_name_en` | English display name. | `AI Project Ops` |
| 4 | `description` | What the skill does + trigger phrases + a "Not for" negative-trigger clause. | see SKILL.md |
| 5 | `description_zh` | Short Chinese-market gloss. | English gloss (release is English-only) |
| 6 | `description_en` | Short English gloss. | see SKILL.md |
| 7 | `version` | Semver string. | `1.2.0` |
| 8 | `author` | Author identifier. | `Chiang Chenghsin` |

Optional but recommended and present here: `examples_zh`, `examples_en` (3 each),
`allowed-tools`, and the `agent_created: true` flag (marks the skill as
agent-authored so the skill manager may modify/delete it).

`name` equality with the directory name is a hard gate: `name: ai-project-ops`
in a directory named `ai-project-ops`.

## 2. Resource-directory conventions

The skill root (the directory holding `SKILL.md`) may contain:

- `references/` — long-form reference docs, cited from `SKILL.md` as
  `@references/xxx.md`. The `@references/` citation is the platform convention;
  this package ALSO uses ordinary package-root-relative markdown links (a label
  in square brackets followed by a target in parentheses, e.g. a link whose
  target is `references/xxx.md`) so plain markdown viewers resolve them. Keep
  every path package-root-relative; never mix `../`, bare filenames and rooted
  paths.
- `scripts/` — executable helpers (Python 3 standard library, Node built-ins).
  Every script carries the BACKGROUND / CONDITIONS / VERSION header.
- `templates/` — blank, copy-ready files (ledger, PDCA entry, subagent brief).
- `assets/` — shipped runtime artifacts (the starter-kit panel lives here).
- `docs/` — evidence, handoffs and release gates.

## 3. Red lines (SkillHub)

- `description` MUST contain a **"Not for:" negative-trigger list**. This package
  excludes: pure report/document generation, multi-tenant auth systems, 3D or
  spatial views, cloud file sync, and conceptual questions about skills.
- NO unbounded claims. Banned phrases include "fully automatic",
  "one-click solves all", "supports everything", "solves everything",
  "handles everything", "zero effort", "no human needed", "100% automatic".
  Describe what the skill does; never promise it does everything.
- Package text MUST be English-only: zero CJK characters in shipped text files.
- No absolute personal paths (no `C:\Users\<name>`, `/Users/<name>`,
  `/home/<name>`) and no hardcoded credentials in any file.

## 4. Zip / packaging rules

When building the release archive from the skill root:

- Exclude the `.git/` directory entirely.
- Exclude runtime state: no `*.db` (including `panel.db` and `*.db-shm` /
  `*.db-wal`), no `*.pid`, no `.chrome-check*` files, and no browser profiles
  (Chrome/Chromium `user-data-dir` folders).
- Exclude local screenshots of live data and any `*.zip` of the package itself.
- Use UTF-8 filenames and set the zip UTF-8 filename flag. With Python's
  `zipfile`, set the general-purpose bit 11 (`0x800`) so non-ASCII names are
  decoded as UTF-8:

  ```python
  import zipfile
  zf = zipfile.ZipFile("ai-project-ops.zip", "w", zipfile.ZIP_DEFLATED)
  info = zipfile.ZipInfo("SKILL.md")
  info.flag_bits |= 0x800          # UTF-8 filename flag
  info.compress_type = zipfile.ZIP_DEFLATED
  zf.writestr(info, open("SKILL.md", "rb").read())
  ```

  Equivalent: `zip -r -UN=UTF8 ...` or 7-Zip `cu=on`. Keep every arcname
  relative (no leading drive letter or absolute path).

## 5. Release checklist (summary)

Full gate list: [docs/RELEASE-CHECKLIST.md](../docs/RELEASE-CHECKLIST.md).

1. All 8 required frontmatter fields present; `name` == directory name; version
   bumped in `SKILL.md`, `README.md` and `CHANGELOG.md`.
2. "Not for" clause present; no overclaim words in any `description*` field.
3. `python scripts/validate_skill.py` exits 0 (or 1 with every warning reviewed).
4. `python scripts/localize_check.py` prints a CJK count of 0.
5. `python -m py_compile scripts/validate_skill.py scripts/localize_check.py`
   and `node --check scripts/verify.js` both exit 0.
6. `node scripts/verify.js` E2E passes (needs Chrome; run by the main session).
7. All markdown relative links resolve; metering columns unified between
   `SKILL.md` section 3 and `references/metering.md`.
8. Zip built per section 4; no runtime state files left in the tree.
9. Post-publish: re-run `docs/TRIGGER-REGRESSION.md` after any `description` edit.
