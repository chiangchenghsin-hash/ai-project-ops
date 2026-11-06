#!/usr/bin/env python3
"""
BACKGROUND: Replaces the manual "does this package look publishable" eyeball
check with one deterministic, offline gate. It encodes the WorkBuddy
open-platform 8-field frontmatter contract, the SkillHub red lines and the
zip/state rules documented in references/packaging-spec.md, so a cold reader
can verify the package without any external spec.
CONDITIONS: Python 3, standard library only (no pip, no network). Run from any
working directory: the package root is derived from this file's location. It
writes docs/evidence/validation-report.json (per-check PASS/FAIL + severity)
and prints a summary. Exit codes: 0 = all checks pass, 1 = one or more warning
checks failed (reviewable), 2 = one or more blocking checks failed (do not
publish). Whole-package scans (links, CJK, paths/credentials) are warning-level
because other agents' files may still be in flight; every other check is a hard
blocking gate on this package's own deliverables. Deterministic: directories
and filenames are sorted, no timestamps, no absolute paths are written out.
VERSION: 1.2.0 - 1.1.0 initial English release (C2); 1.2.0 GitHub publication.
"""

import fnmatch
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT = os.path.join(ROOT, "docs", "evidence", "validation-report.json")

# CJK = Chinese / Japanese / Korean character ranges. Written with \u escapes
# so this source file itself stays pure ASCII (zero CJK characters).
CJK = re.compile(
    "["
    "\u2e80-\u2fff"   # CJK radicals
    "\u3000-\u303f"   # CJK symbols and punctuation
    "\u3040-\u30ff"   # Hiragana / Katakana
    "\u3100-\u312f"   # Bopomofo
    "\u3190-\u31ff"   # CJK strokes
    "\u3400-\u4dbf"   # CJK ext A
    "\u4e00-\u9fff"   # CJK unified ideographs
    "\uac00-\ud7af"   # Hangul syllables
    "\uf900-\ufaff"   # CJK compatibility ideographs
    "\ufe30-\ufe4f"   # CJK compatibility forms
    "\uff00-\uffef"   # Halfwidth and fullwidth forms
    "]"
)

BINARY_EXT = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".bmp", ".webp", ".pdf",
    ".woff", ".woff2", ".ttf", ".eot", ".otf", ".zip", ".gz", ".db",
    ".sqlite", ".pyc", ".class", ".o", ".so", ".dll", ".exe", ".map",
}

# Generated output is excluded from whole-package scans so the scan input does
# not depend on a previous run's result (determinism).
EXCLUDE_FILES = {"docs/evidence/validation-report.json"}

# Tooling scratch and runtime state are local dev residue, never package
# content. The scans skip them so a developer tree with a running panel or a
# browser-automation scratch folder is not reported as a package defect.
EXCLUDE_DIRS = {".git", ".playwright-mcp", ".research", "node_modules", "__pycache__"}

STATE_PATTERNS = ["*.db", "*.pid", "*.sqlite", "*.sqlite3", "*.db-shm",
                  "*.db-wal", ".chrome-check*"]

REQUIRED_FIELDS = ["name", "display_name", "display_name_en", "description",
                   "description_zh", "description_en", "version", "author"]

OVERCLAIM = [
    "fully automatic", "fully automated", "one-click solves all",
    "supports everything", "solves everything", "handles everything",
    "zero effort", "no human needed", "100% automatic", "works for everything",
    "does everything", "automatic all",
]

ABS_PATH = re.compile(
    r"(?i)("
    r"[a-z]:[\\/]+users[\\/]+[a-z0-9_.\-]+"
    r"|[a-z]:[\\/]+documents and settings[\\/]+[a-z0-9_.\-]+"
    r"|/(?:users|home)/[a-z0-9_.\-]+"
    r")"
)
CRED = re.compile(
    r"(?i)\b(?:api[_-]?key|secret|passwd|password|private[_-]?key|"
    r"access[_-]?token|auth[_-]?token)\s*[:=]\s*[\"'][A-Za-z0-9/+_\-]{16,}[\"']"
    r"|\b(?:AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b"
)

LINK = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")

CHECKS = []


def add(cid, description, severity, ok, detail=""):
    CHECKS.append({
        "id": cid,
        "description": description,
        "severity": severity,
        "status": "PASS" if ok else "FAIL",
        "detail": str(detail),
    })
    return ok


def rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def read(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def iter_all_files():
    out = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        for fn in sorted(filenames):
            out.append(rel(os.path.join(dirpath, fn)))
    return out


def iter_text_files():
    out = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        for fn in sorted(filenames):
            full = os.path.join(dirpath, fn)
            r = rel(full)
            if r in EXCLUDE_FILES:
                continue
            if os.path.splitext(fn)[1].lower() in BINARY_EXT:
                continue
            try:
                data = read(full)
            except (UnicodeDecodeError, OSError, ValueError):
                continue
            if "\x00" in data:
                continue
            out.append((r, data))
    return out


def strip_fences(text):
    out = []
    in_fence = False
    for line in text.splitlines():
        if re.match(r"^\s*(```|~~~)", line):
            in_fence = not in_fence
            out.append("")
            continue
        out.append(line if not in_fence else "")
    return "\n".join(out)


def strip_quotes(s):
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ("'", '"'):
        return s[1:-1]
    return s


def parse_scalar(v):
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
        return v[1:-1]
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1]
        return [strip_quotes(x) for x in inner.split(",") if x.strip()]
    return v


def parse_frontmatter(text):
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, "missing opening ---"
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        return None, "missing closing ---"
    fm_lines = lines[1:end]
    data = {}
    i = 0
    while i < len(fm_lines):
        line = fm_lines[i]
        if not line.strip() or line.lstrip().startswith("#"):
            i += 1
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$", line)
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2).strip()
        if val in (">-", ">", "|", "|-", ">+", "|+"):
            block = []
            i += 1
            while i < len(fm_lines) and (
                fm_lines[i].startswith(" ") or fm_lines[i].startswith("\t") or not fm_lines[i].strip()
            ):
                block.append(fm_lines[i].strip())
                i += 1
            data[key] = " ".join(x for x in block if x)
            continue
        if val == "":
            seq = []
            j = i + 1
            while j < len(fm_lines) and re.match(r"^\s+-\s+", fm_lines[j]):
                seq.append(strip_quotes(re.sub(r"^\s+-\s+", "", fm_lines[j])))
                j += 1
            if seq:
                data[key] = seq
                i = j
                continue
            data[key] = ""
            i += 1
            continue
        data[key] = parse_scalar(val)
        i += 1
    return data, None


def check_links():
    broken = []
    nlinks = 0
    nfiles = 0
    for r, data in iter_text_files():
        if not r.endswith(".md"):
            continue
        nfiles += 1
        scan = strip_fences(data)
        # Inline code (single backticks) is not a real navigation link.
        scan = re.sub(r"`[^`\n]*`", " ", scan)
        for m in LINK.finditer(scan):
            t = m.group(1).strip()
            t = re.sub(r"\s+[\"'].*$", "", t).strip()
            t = t.split("#")[0].strip()
            if not t:
                continue
            low = t.lower()
            if low.startswith(("http://", "https://", "mailto:", "data:", "#")):
                continue
            nlinks += 1
            target = os.path.normpath(os.path.join(os.path.dirname(r), t))
            if not os.path.exists(os.path.join(ROOT, target)):
                broken.append(r + " -> " + t)
    return broken, nlinks, nfiles


def main():
    skill_text = read(os.path.join(ROOT, "SKILL.md"))
    fm, err = parse_frontmatter(skill_text)
    if fm is None:
        fm = {}

    # --- blocking checks (this package's own deliverables) ---
    missing = [k for k in REQUIRED_FIELDS if not str(fm.get(k, "")).strip()]
    add("required_frontmatter_fields",
        "SKILL.md has all 8 required frontmatter fields", "blocking",
        not missing, "missing=" + (",".join(missing) if missing else "none")
        + ("; " + err if err else ""))

    add("name_matches_directory",
        "frontmatter name equals the package directory name", "blocking",
        str(fm.get("name", "")) == os.path.basename(ROOT),
        "name=" + str(fm.get("name", "")) + " dir=" + os.path.basename(ROOT))

    desc_all = " ".join(str(fm.get(k, "")) for k in
                        ("description", "description_zh", "description_en")).lower()
    hits = [w for w in OVERCLAIM if w in desc_all]
    add("no_overclaim_words_in_description",
        "no unbounded-claim phrases in any description field", "blocking",
        not hits, "overclaim_hits=" + (",".join(hits) if hits else "none"))

    not_for_ok = all("not for" in str(fm.get(k, "")).lower()
                     for k in ("description", "description_zh", "description_en"))
    add("not_for_negative_triggers",
        "each description field carries a Not for negative-trigger clause",
        "blocking", not_for_ok, "present=" + str(not_for_ok))

    add("agent_created_true",
        "agent_created: true is kept", "blocking",
        str(fm.get("agent_created", "")).lower() == "true",
        "value=" + str(fm.get("agent_created", "")))

    ez, ee = fm.get("examples_zh"), fm.get("examples_en")
    opt_ok = (isinstance(ez, list) and len(ez) >= 3
              and isinstance(ee, list) and len(ee) >= 3
              and "allowed-tools" in fm)
    add("optional_frontmatter_fields",
        "examples_zh/examples_en (3 each) and allowed-tools present",
        "blocking", opt_ok,
        "examples_zh=" + str(len(ez) if isinstance(ez, list) else "n/a")
        + " examples_en=" + str(len(ee) if isinstance(ee, list) else "n/a")
        + " allowed-tools=" + ("yes" if "allowed-tools" in fm else "no"))

    readme = read(os.path.join(ROOT, "README.md"))
    dep_head = re.search(r"(?im)^#{1,3}\s*(requirements|dependencies|runtime)", readme)
    dep_node = ("Node >= 22.5" in readme) or ("Node 22.5" in readme)
    dep_std = re.search(
        r"(?i)(standard library|stdlib|no npm|zero npm|no external depend|only built-in|zero external)",
        readme)
    dep_ok = bool(dep_head and dep_node and dep_std)
    add("dependency_declarations_present",
        "README declares runtime + dependency policy", "blocking", dep_ok,
        "section=" + str(bool(dep_head)) + " node=" + str(dep_node)
        + " stdlib=" + str(bool(dep_std)))

    spec = read(os.path.join(ROOT, "references", "packaging-spec.md")).lower()
    need = ["utf-8", ".git", "*.db", "browser profile", "zip", "0x800"]
    miss = [t for t in need if t not in spec]
    add("zip_utf8_flag_policy_documented",
        "packaging-spec documents zip UTF-8 flag + exclusion rules",
        "blocking", not miss, "missing_markers=" + (",".join(miss) if miss else "none"))

    state = [p for p in iter_all_files()
             if any(fnmatch.fnmatch(os.path.basename(p).lower(), pat)
                    for pat in STATE_PATTERNS)]
    add("runtime_state_files_absent",
        "no *.db / *.pid / .chrome-check* runtime state in package",
        "blocking", not state, "found=" + (",".join(state) if state else "none"))

    req_scripts = ["validate_skill.py", "verify.js", "localize_check.py"]
    req_templates = ["TASK-LOG.template.md", "pdca-entry.template.md",
                     "subagent-brief.template.md"]
    sd = os.path.join(ROOT, "scripts")
    td = os.path.join(ROOT, "templates")
    st_ok = (os.path.isdir(sd) and all(os.path.isfile(os.path.join(sd, x)) for x in req_scripts)
             and os.path.isdir(td) and all(os.path.isfile(os.path.join(td, x)) for x in req_templates))
    add("scripts_and_templates_exist",
        "scripts/ and templates/ exist with the required files", "blocking",
        st_ok, "scripts=" + str(os.path.isdir(sd)) + " templates=" + str(os.path.isdir(td)))

    hdr_ok = True
    hdr_detail = []
    for s in req_scripts:
        t = read(os.path.join(ROOT, "scripts", s))
        good = all(k in t for k in ("BACKGROUND", "CONDITIONS", "VERSION"))
        hdr_detail.append(s + "=" + ("ok" if good else "MISSING"))
        hdr_ok = hdr_ok and good
    add("validation_scripts_have_headers",
        "BACKGROUND/CONDITIONS/VERSION header on all three scripts",
        "blocking", hdr_ok, ", ".join(hdr_detail))

    # --- warning checks (whole package; other agents' files may be in flight) ---
    broken, nlinks, nfiles = check_links()
    add("all_markdown_relative_links_resolve",
        "every markdown relative link resolves", "warning", not broken,
        str(nlinks) + " links / " + str(nfiles) + " md files; broken="
        + (str(len(broken)) + ": " + "; ".join(sorted(broken)) if broken else "0"))

    cjk_total = 0
    cjk_files = []
    for r, data in iter_text_files():
        n = len(CJK.findall(data))
        if n:
            cjk_files.append(r + "=" + str(n))
            cjk_total += n
    add("no_cjk_in_packaged_text_files",
        "zero CJK characters in any packaged text file", "warning",
        cjk_total == 0, "cjk_count=" + str(cjk_total)
        + (" in " + ", ".join(cjk_files) if cjk_files else ""))

    leaks = []
    for r, data in iter_text_files():
        for m in ABS_PATH.finditer(data):
            leaks.append(r + ": path " + repr(m.group(0)))
        for m in CRED.finditer(data):
            leaks.append(r + ": credential " + repr(m.group(0)[:40]))
    add("no_absolute_personal_paths_or_credentials",
        "no absolute personal paths or hardcoded credentials", "warning",
        not leaks, "leaks=" + (str(len(leaks)) + ": " + "; ".join(sorted(leaks))
                               if leaks else "0"))

    # --- verdict + report ---
    blocking_failed = sum(1 for c in CHECKS
                          if c["severity"] == "blocking" and c["status"] == "FAIL")
    warning_failed = sum(1 for c in CHECKS
                         if c["severity"] == "warning" and c["status"] == "FAIL")
    if blocking_failed:
        exit_code = 2
    elif warning_failed:
        exit_code = 1
    else:
        exit_code = 0

    passed = sum(1 for c in CHECKS if c["status"] == "PASS")
    report = {
        "schema": "ai-project-ops/validation-report/v1",
        "tool": "scripts/validate_skill.py",
        "version": "1.2.0",
        "deterministic": True,
        "summary": {
            "total": len(CHECKS),
            "passed": passed,
            "failed": len(CHECKS) - passed,
            "blocking_failed": blocking_failed,
            "warning_failed": warning_failed,
            "exit_code": exit_code,
        },
        "exit_code_meaning": {"0": "all pass", "1": "warnings", "2": "blocking"},
        "checks": CHECKS,
    }
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    with open(REPORT, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=True)
        fh.write("\n")

    print("validate_skill: " + str(passed) + "/" + str(len(CHECKS))
          + " checks passed; exit_code=" + str(exit_code))
    for c in CHECKS:
        print("  [" + c["status"] + "] (" + c["severity"] + ") "
              + c["id"] + ": " + c["detail"])
    print("wrote " + rel(REPORT))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
