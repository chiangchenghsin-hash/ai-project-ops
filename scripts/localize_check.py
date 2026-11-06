#!/usr/bin/env python3
"""
BACKGROUND: Single-purpose localization gate. Replaces a human eyeballing the
package for stray CJK characters with one deterministic counter, so the
English-only release rule is machine-checkable.
CONDITIONS: Python 3, standard library only (no pip, no network). Run from any
working directory; the package root is derived from this file's location. It
prints a per-file breakdown and a final CJK_COUNT line. Exit codes: 0 = zero
CJK characters found, 1 = one or more CJK characters found. Deterministic:
directories and filenames are sorted. Binary files (images, archives, *.db)
are skipped; every other UTF-8-readable text file is scanned.
VERSION: 1.2.0 - 1.1.0 initial English release (C2); 1.2.0 GitHub publication.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CJK = re.compile(
    "["
    "\u2e80-\u2fff"
    "\u3000-\u303f"
    "\u3040-\u30ff"
    "\u3100-\u312f"
    "\u3190-\u31ff"
    "\u3400-\u4dbf"
    "\u4e00-\u9fff"
    "\uac00-\ud7af"
    "\uf900-\ufaff"
    "\ufe30-\ufe4f"
    "\uff00-\uffef"
    "]"
)

BINARY_EXT = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".bmp", ".webp", ".pdf",
    ".woff", ".woff2", ".ttf", ".eot", ".otf", ".zip", ".gz", ".db",
    ".sqlite", ".pyc", ".class", ".o", ".so", ".dll", ".exe", ".map",
}

# Tooling scratch and vendored deps are not package text. Scanning them reports
# a CJK count for content the package never ships.
EXCLUDE_DIRS = {".git", ".playwright-mcp", ".research", "node_modules", "__pycache__"}


def rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def main():
    total = 0
    per_file = []
    scanned = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        for fn in sorted(filenames):
            full = os.path.join(dirpath, fn)
            if os.path.splitext(fn)[1].lower() in BINARY_EXT:
                continue
            try:
                with open(full, "r", encoding="utf-8") as fh:
                    data = fh.read()
            except (UnicodeDecodeError, OSError, ValueError):
                continue
            if "\x00" in data:
                continue
            scanned += 1
            n = len(CJK.findall(data))
            if n:
                per_file.append((rel(full), n))
                total += n
    for p, n in per_file:
        print("  " + str(n) + "  " + p)
    print("Text files scanned: " + str(scanned))
    print("CJK_COUNT=" + str(total))
    sys.exit(1 if total > 0 else 0)


if __name__ == "__main__":
    main()
