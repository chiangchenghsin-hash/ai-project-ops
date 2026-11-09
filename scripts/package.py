#!/usr/bin/env python3
"""BACKGROUND: Release archives were previously built by one-off shell
snippets, so exclusion rules drifted: .git, runtime *.db, browser profiles,
accumulating JSON (rejections.json) and hidden research caches all leaked into
one archive or another. This script makes packaging a reproducible engineering
step instead of a manual ritual.

CONDITIONS: Python 3 stdlib only. Run from anywhere: `python scripts/package.py
--out <zip>`. Source root = AIOPS_ROOT or the parent of scripts/. Excludes
hidden directories by DEFAULT, plus runtime state and per-turn evidence. Sets
the UTF-8 filename flag on every entry. Writes the SHA-256 to a sibling
<zip>.sha256 file OUTSIDE the archive (a checksum inside its own archive is
circular). Prints a machine-readable summary for pasting into a PDCA Check.
Exit 0 on success, 1 on a failed gate (CJK content, forbidden entry).

VERSION: 1.0.0 - initial reproducible release builder (C5 discipline layer).
"""
import argparse
import hashlib
import os
import pathlib
import re
import sys
import zipfile

EXCL_DIRS = {"__pycache__", "node_modules", ".git"}
EXCL_SUFFIX = {".db", ".db-wal", ".db-shm", ".pid", ".pyc", ".zip"}
EXCL_NAMES = {
    "rejections.json",          # accumulates on every E2E run
    "session.json",             # per-turn start snapshot
    "issue-delta.json",         # per-turn gate evidence
    "gate-report.json",         # per-turn gate evidence
    "structure-gate.json",      # recomputed per turn
}
CJK = re.compile(r"[\u4e00-\u9fff]")


def skip(rel: pathlib.Path) -> bool:
    for part in rel.parts[:-1]:
        if part.startswith(".") or part in EXCL_DIRS:
            return True
    name = rel.name
    if name.startswith(".") and name != ".gitkeep":
        return True
    return name in EXCL_NAMES or rel.suffix.lower() in EXCL_SUFFIX


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--root", default=None)
    a = ap.parse_args()

    root = pathlib.Path(a.root or os.environ.get("AIOPS_ROOT")
                        or pathlib.Path(__file__).resolve().parent.parent)
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    files = [(p, "ai-project-ops/" + p.relative_to(root).as_posix())
             for p in sorted(root.rglob("*"))
             if p.is_file() and not skip(p.relative_to(root))]

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for src, arc in files:
            zi = zipfile.ZipInfo(arc)
            zi.flag_bits |= 0x800
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, src.read_bytes())

    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    pathlib.Path(str(out) + ".sha256").write_text(
        digest + "  " + out.name + "\n", encoding="ascii")

    with zipfile.ZipFile(out) as z:
        names = z.namelist()
        bad = [n for n in names
               if "/.git/" in n or n.endswith(".db")
               or any(h in n for h in (".research/", ".playwright-mcp/"))]
        cjk = [n for n in names
               if not n.endswith((".png", ".db"))
               and CJK.search(z.read(n).decode("utf-8", errors="ignore"))]
        has = lambda s: any(n.endswith(s) for n in names)

    print("PASS  archive built :: " + str(len(files)) + " entries, " +
          str(out.stat().st_size) + " bytes")
    print("PASS  sha256 :: " + digest)
    print("PASS  checksum file :: " + str(out) + ".sha256 (outside archive)")
    for label, ok in [
        ("SKILL.md present", has("SKILL.md")),
        ("issue ledger present", has("docs/evidence/issues.json")),
        ("gate scripts present", has("scripts/discipline-gate.js")),
        ("hook fragment present", has("hooks/settings.fragment.json")),
        ("no git/db/research entries", not bad),
        ("no CJK content", not cjk),
        ("no runtime evidence entries", not any(
            n.endswith(x) for n in names for x in EXCL_NAMES)),
    ]:
        print(("PASS  " if ok else "FAIL  ") + label)
    ok = not bad and not cjk
    print("PACKAGE " + ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
