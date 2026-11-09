#!/usr/bin/env python3
"""BACKGROUND: Hook installation must not overwrite a user's existing hook
arrays. The local machine already has PreToolUse/PostToolUse/UserPromptSubmit
entries in both settings files. This helper merges the discipline fragment
idempotently and never touches a user-global settings file.

CONDITIONS: Python 3 stdlib only. Default is DRY RUN (prints merged JSON,
writes nothing). --apply writes the target after creating <target>.bak.
--allow-global is required (and discouraged) to target a path containing
'/users/' and '/.claude/settings.json' at global scope. Exit 0 success,
1 bad input, 2 on a blocked global target.

VERSION: 1.0.0 - initial idempotent project-level hook merge.
"""
import argparse
import json
import pathlib
import shutil
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fragment", required=True)
    ap.add_argument("--target", required=True)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--allow-global", action="store_true")
    a = ap.parse_args()

    frag_path = pathlib.Path(a.fragment)
    tgt = pathlib.Path(a.target)
    if not frag_path.is_file():
        print("FAIL  fragment missing :: " + str(frag_path))
        return 1
    frag = json.loads(frag_path.read_text(encoding="utf-8"))
    frag.pop("_comment", None)

    low = tgt.as_posix().lower()
    globalish = ("users" in low or low.startswith("~")) and (
        "/.claude/settings" in low or "/.workbuddy/settings" in low
    )
    if globalish and not a.allow_global:
        print("FAIL  global target blocked :: " + str(tgt) +
              " (install at project level; see hooks/INSTALL.md)")
        return 2

    current = {}
    if tgt.is_file():
        try:
            current = json.loads(tgt.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print("FAIL  target is not valid JSON :: " + str(e))
            return 1

    added = 0
    for event, entries in frag.items():
        arr = current.setdefault(event, [])
        for entry in entries:
            commands = [h.get("command") for h in entry.get("hooks", [])]
            if any(h.get("command") in commands for e2 in arr
                   for h in e2.get("hooks", [])):
                continue
            arr.append(entry)
            added += 1

    merged = json.dumps(current, indent=2, ensure_ascii=False) + "\n"
    print("PASS  merge computed :: " + str(added) + " new hook entries, events=" +
          ", ".join(frag.keys()))
    if not a.apply:
        print("DRY RUN - nothing written. Re-run with --apply to install.")
        print(merged[:1200])
        return 0

    tgt.parent.mkdir(parents=True, exist_ok=True)
    if tgt.is_file():
        shutil.copy2(tgt, pathlib.Path(str(tgt) + ".bak"))
        print("PASS  backup written :: " + str(tgt) + ".bak")
    tgt.write_text(merged, encoding="utf-8")
    print("PASS  hooks installed :: " + str(tgt))
    return 0


if __name__ == "__main__":
    sys.exit(main())
