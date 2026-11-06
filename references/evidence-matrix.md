# Four-layer evidence matrix (C2)

A single PASS line is not evidence. The C2 release classifies every
verification case into one (or more) of four layers. A claim is accepted only
when the layers it depends on are all satisfied; a gap in a lower layer cannot
be repaired by a strong result in a higher one. See
`references/pdca-three-state.md` for the PASS / FAIL / UNCERTAIN verdict rules
and `references/error-codes.md` for the E01-E12 signals used below.

## Layer definitions

| Layer | What counts as evidence | Machine check | Failure mode | Resulting PDCA state |
|---|---|---|---|---|
| **1. Configuration** | The artifact is correctly constituted: files exist, frontmatter is complete, JSON parses, paths are consistent, ownership is declared, frozen hashes match, case counts reconcile. Static; no program is run against behavior. | `python -c "import json;json.load(open(...))"` for every JSON; CJK regex scan (count == 0); SHA-256 compare against the freeze manifest; frontmatter field-count assert; `../`-base grep; ownership table diff; case-count reconciliation (19/19 PRE-C2 vs >=30 C2). | Missing file, schema mismatch, undeclared owner, mixed path base, frozen artifact changed, self-hash gap, missing frontmatter field. | PASS if every config assertion is green. FAIL for a concrete assertion failure (E02, E07). UNCERTAIN if a config file cannot be read or a manifest is absent (evidence incomplete). |
| **2. Execution** | A command actually ran and produced real output: exit codes, pasted PASS lines, 0 exceptions, persisted writes. Dynamic, but not yet consumed by a real user. | `node selftest.js` (capture stdout, assert PASS count and `0 JS exceptions`); `node panel.js start|stop`; PUT-persistence assert; clipboard-path assert; `node:sqlite` presence check; grep for the literal string `should work` in Check sections. | Command not run, false "should work" claim, snapshot copy failed, PUT rollback, degradation shim invoked, no Check evidence. | PASS if all commands ran with pasted PASS output. FAIL if a performed command returned negative (E01, E05, E06, E09, E11). UNCERTAIN if a command could not be executed at all (E12). |
| **3. Consumer-load** | A real consumer loaded the artifact: CDP-driven Chrome rendered the panel, a cold reader consumed the docs with no context, a browser actually copied the snapshot, state survived a reload. | CDP suite attached to `Chrome --headless=new --remote-debugging-port=9224`; cold-read protocol (3 readers, no context); `/data/` returns 403 and only `/api/*` is read; clipboard event fired by a real user gesture; reload-survival assert. | "The page opens" claimed as delivery, Chrome unavailable / UI unverified, raw JSON read directly, presence-gate false start, consumer observed a defect. | PASS if a real consumer loaded it cleanly. UNCERTAIN if the consumer was unavailable so the UI is unverified (E12) - UNCERTAIN wins over FAIL here. FAIL if the consumer loaded it and observed a defect (E03, E05). |
| **4. Acceptance** | The stated acceptance criteria were met and can be discriminated: all 2x2 cells populated, statistical power sufficient, blinding intact, no veto fired, PDCA verdict with pasted evidence. | 2x2 cell-completeness assert; `p_min <= 0.05` power assert; per-cell discrimination statistic; blind-key exposure scan; veto-condition scan; PDCA three-state verdict with evidence lines. | Underpowered experiment, missing 2x2 cell, no discrimination in a failure cell, unblinding, frozen-artifact veto, contradictory criteria. | PASS only if all criteria met, evidence pasted and no veto. UNCERTAIN if the experiment is underpowered or evidence incomplete (E04, E08, E10). FAIL / VOID if a veto fired or a criterion was contradicted (E07, E08). A veto always wins (see below). |

Precedence recap (full rules in `references/pdca-three-state.md`):
UNCERTAIN wins over FAIL when evidence is incomplete; a veto wins over a
positive primary result. So a layer-4 "30/30 PASS" is void if a layer-1 veto
(E07 frozen artifact changed) fired, and a layer-2 "command did not run" is
UNCERTAIN, not FAIL, when Chrome was unavailable (E12).

## Coverage table: verification case -> layer

The C2 release ships **>=30 verification cases**; `docs/evidence/freeze-manifest.json`
(P4) is the authoritative instance-level enumeration. The table below lists the
case families in the C2 evidence matrix and the layer(s) each covers. `X` =
the layer this case verifies; a case may cover two layers. Cases VC01-VC07 are
configuration, VC08-VC14 execution, VC15-VC19 consumer-load, VC20-VC24
acceptance. The PRE-C2 19/19 selftest suite maps to VC08, VC11, VC12, VC13,
VC15, VC16, VC18 and VC19 (execution + consumer-load); it had no configuration
or acceptance-layer cases, which is why the cold-read defects went undetected.

| Case | Description | CFG | EXE | LOAD | ACC |
|---|---|---|---|---|---|
| VC01 | CJK scan over all owned English files: count == 0 | X | - | - | - |
| VC02 | `json.load` on every `docs/evidence/*.json` (incl. P4 freeze files) | X | - | - | - |
| VC03 | Frozen SHA-256 matches files; manifest self-hash present (no gap) | X | - | - | - |
| VC04 | 8 required frontmatter fields present in every cold-read report | X | - | - | - |
| VC05 | Package-root-relative paths consistent; gaps list matches `references/panel.md`; deviation NOT a gap | X | - | - | - |
| VC06 | Mutually-exclusive file ownership: every path has exactly one owner | X | - | - | - |
| VC07 | Case-count reconciliation: 19/19 PRE-C2 baseline vs >=30 C2 | X | - | - | - |
| VC08 | `node selftest.js` runs, PASS lines pasted, exit 0 | - | X | - | - |
| VC09 | Check sections contain real output; literal `should work` absent | - | X | - | - |
| VC10 | `node:sqlite` active, Node >= 22.5, no degradation shim | - | X | - | - |
| VC11 | Snapshot clipboard: navigator + execCommand both PASS | - | X | X | - |
| VC12 | PUT persists to SQLite; rollback detected and handled | - | X | - | - |
| VC13 | Incremental reconciler; no full-page re-render | - | X | - | - |
| VC14 | Presence-gate skip path: absent -> `skipped: not present`, zero spend | - | X | - | - |
| VC15 | CDP Chrome renders panel; 0 JS exceptions / console errors | - | - | X | - |
| VC16 | UI never reads raw JSON: `/data/` 403, `/api/*` only | - | - | X | - |
| VC17 | 3 cold readers consumed docs with no context (M1 fixed) | - | - | X | - |
| VC18 | Snapshot actually copied in browser by a real user gesture | - | - | X | - |
| VC19 | Reload survival: time / status / columns / command / reply | - | - | X | - |
| VC20 | 2x2 experiment: all four cells populated and recorded | - | - | - | X |
| VC21 | Statistical power: p_min <= 0.05 with enough paired cards | - | - | - | X |
| VC22 | Unblinding check: blind keys not exposed before scoring | - | - | - | X |
| VC23 | PDCA three-state verdict with precedence and pasted evidence | - | - | - | X |
| VC24 | Veto rules + voided-round-as-correction (E07 / E08) | X | - | - | X |

Legend: CFG = Configuration, EXE = Execution, LOAD = Consumer-load,
ACC = Acceptance.

## Why four layers

- A command that ran (layer 2) is not proof a consumer loaded it (layer 3):
  an AI that only documents the panel has not delivered it (`SKILL.md` section
  4). Layer 3 kills the "the page opens" false PASS.
- A correct-looking artifact (layer 1) can still be underpowered (layer 4):
  the PRE-C2 experiment's `p_min=0.0625 > 0.05` with 4 paired cards is exactly
  a layer-4 defect that no layer-1/2 check could catch.
- The cold-read meta-finding (a reader could not discover the 8 frontmatter
  fields) is a layer-1 + layer-3 defect: the spec was not internalized into the
  artifact and the no-context consumer could not verify it.

Machine-readable form of this matrix: `docs/evidence/evidence-layer-coverage.json`.
