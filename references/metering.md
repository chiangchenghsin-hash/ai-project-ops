# Token metering and measured on/off switches

## Metering rules

- Source of truth: your proxy's meter DB (whatever your proxy writes — schemas
  differ by tool; introspect yours first and adapt the join below). No meter DB
  at all → read the per-call usage fields the API returns; never estimate. Open
  it READ-ONLY (`file:...?mode=ro`). Never write it; never echo secrets/config rows.
- Attribute spend to projects via session transcripts (example join on one
  tool's schema — adapt to yours: `session_log_sync.file_path LIKE '%' ||
  session_id || '%'` → project slug).
  Per-run attribution: each `claude -p` invocation is its own session — measure
  per session id, not by guessing.
- Columns to report: requests / in / out / cache-read / billed (= in+out+cacheR) /
  fresh (= in+out) / USD. ONE small table + one conclusion line. (These are
  measured columns; the S/M/L/XL tiers are a separate planning scale — never mix
  the two in one table.)
- Keep a reusable probe script in the repo (`tools/usage_probe.py` style) and a
  round-segment script (`tools/gantt_rounds.py` style) that sums spend over task
  time-windows whose boundaries come from the human's command timestamps.
- Windows console pitfalls: run Python with UTF-8 stdout reconfigured inside the
  script (not via env when using `python -I`), and read UTF-8 JSON via files, not
  through pipes with locale encoding.

## Measured on/off protocol (for anything that spends tokens unattended)

1. Ship the automation DISABLED (registered but off). Money decisions need a nod.
2. Probe: run it 1–3 times for real. Record wall time, exit code, output sample.
3. Measure cost: meter-DB delta across the runs (T0/T1 sums or per-session).
4. Score usefulness honestly:
   - KEEP/ENABLE if output is specific and actionable (quotes real project facts,
     names next steps, catches real gaps).
   - KEEP-DISABLED or DELETE if output is generic filler, overlaps an existing
     digest, or fails/times out.
5. Record the verdict + numbers in the PDCA ledger and in project instructions.

Field results from one project (measured 2026-11-05 — expect different prices
elsewhere; the pattern is the takeaway): a synthesis "daily digest" at ~$0.05/run
that quotes real data and self-finds gaps = worth enabling; an anomaly root-cause
wake fired only on red states = highest quality per token; a standing "morning
brief" that merely re-states numbers = negative control, script territory, and it
timed out producing nothing. Deterministic counting/status checks never wake an
LLM.

## Budget guardrails

- Daily spend guard in settlement jobs (e.g. warn when day cost > $2).
- Scheduled `claude -p` jobs carry a hard timeout (600s) so a hang skips one run
  instead of freezing the scheduler.
- Combine with the presence gate: absent human → zero spend, even for AI jobs.
