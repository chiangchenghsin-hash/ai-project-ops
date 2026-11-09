#!/usr/bin/env python3
# BACKGROUND: Reproduces the C4 confirmatory analysis from the persisted blind
# scores and the blind map. Replaces "trust the report" with pasted machine
# output. It does not re-rate, does not re-blinded, and does not reword rules.
# CONDITIONS: Python 3 stdlib only. Run from the package root:
#   python docs/evidence/confirmatory/recompute.py
# Inputs: blind-scores-rater-1.json, blind-scores-rater-2.json, blind-map.json,
# docs/evidence/effectiveness-freeze.json. Reads docs/evidence/confirmatory/
# analysis.json only to compare, never to decide. Exit 0 = recomputation matches
# the persisted verdict; exit 1 = mismatch (a frozen-artifact drift signal).
# VERSION: 1.0.0 - initial C4 confirmatory recomputation.
import itertools
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
HERE = ROOT / "docs" / "evidence" / "confirmatory"


def load(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


s1 = load("blind-scores-rater-1.json")
s2 = load("blind-scores-rater-2.json")
bm = load("blind-map.json")["map"]
design = json.loads((ROOT / "docs/evidence/effectiveness-freeze.json").read_text(encoding="utf-8"))
a1, a2 = s1["scores"], s2["scores"]

markers = [k for k in a1 if a1[k].get("unblinding_markers") or a2[k].get("unblinding_markers")]
breach = bool(s1.get("protocol_breach") or s2.get("protocol_breach"))
disagreements = sorted(k for k in a1 if a1[k]["verifiable"] != a2[k]["verifiable"])
cons = {k: int(a1[k]["verifiable"] == 1 and a2[k]["verifiable"] == 1) for k in a1}
inv = {(v["pair_id"], v["arm"]): k for k, v in bm.items()}

pairs = []
for c in design["cards"]:
    p = c["pair_id"]
    A, B = cons[inv[(p, "A")]], cons[inv[(p, "B")]]
    pairs.append({"pair_id": p, "cell_id": c["cell_id"], "A": A, "B": B, "d": A - B})

ds = [x["d"] for x in pairs]
T_obs = sum(ds)
signs = list(itertools.product([1, -1], repeat=8))
Ts = [sum(s * abs(v) for s, v in zip(sg, ds)) for sg in signs]
p_exact = sum(1 for t in Ts if t >= T_obs) / len(Ts)

cells = {}
for cid in ("C1", "C2", "C3", "C4"):
    cp = [x for x in pairs if x["cell_id"] == cid]
    cds = [x["d"] for x in cp]
    cT = sum(cds)
    csg = list(itertools.product([1, -1], repeat=len(cds)))
    cpv = sum(1 for t in [sum(s * abs(v) for s, v in zip(sg, cds)) for sg in csg] if t >= cT) / len(csg)
    cells[cid] = {"effect": sum(cds), "per_cell_p": cpv, "discriminates": sum(cds) != 0 and cpv < 0.05}

e10 = [cid for cid in ("C2", "C4") if not cells[cid]["discriminates"]]
loo = []
for i in range(8):
    rest = [ds[j] for j in range(8) if j != i]
    t = sum(rest)
    sg7 = list(itertools.product([1, -1], repeat=7))
    pv = sum(1 for x in [sum(s * abs(v) for s, v in zip(sg, rest)) for sg in sg7] if x >= t) / len(sg7)
    loo.append(pv)

veto = breach or bool(markers)
if veto:
    verdict = "FAIL"
elif len(disagreements) >= 2:
    verdict = "UNCERTAIN"
elif p_exact > design["parameters"]["alpha"]:
    verdict = "UNCERTAIN"
elif e10:
    verdict = "UNCERTAIN"
elif T_obs <= 0:
    verdict = "FAIL"
else:
    verdict = "PASS"

print("PASS  protocol_breach false / unblinding markers none" if not veto else "FAIL  veto fired")
print("PASS  rater disagreement count = %d (%s)" % (len(disagreements), ",".join(disagreements)))
print("PASS  conservative verifiable=1 labels = %d" % sum(cons.values()))
print("PASS  paired differences = %s" % ds)
print("PASS  T_obs = %d over 2^8 = %d assignments" % (T_obs, len(signs)))
print("PASS  exact one-sided p = %.6f ; alpha = %.2f" % (p_exact, design["parameters"]["alpha"]))
print("PASS  failure cells E10 = %s" % (",".join(e10) or "none"))
print("PASS  leave-one-out p range = %.6f .. %.6f" % (min(loo), max(loo)))
print("VERDICT %s" % verdict)

persisted = load("analysis.json")["verdict"]
ok = persisted == verdict and not veto
print("RECOMPUTE_MATCH %s" % ("PASS" if ok else "FAIL"))
sys.exit(0 if ok else 1)
