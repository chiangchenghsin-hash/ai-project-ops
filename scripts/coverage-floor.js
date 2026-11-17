#!/usr/bin/env node
/**
 * BACKGROUND: A-10 T3 coverage-floor gate (docs/TASK-LOG.md 2026-11-17 A-10 LOCK).
 * Reads the merged output of `node --test --experimental-test-coverage`
 * (run with the standard tests glob) on stdin, extracts the all-files line-% from the
 * coverage table, and enforces a floor (argv[2] or default 80.00, the lock
 * value: measured 83.03 locally, 3-point margin for Node 22-vs-26
 * instrumentation noise). Exit 0 at/above floor; exit 1 below floor OR on
 * parse miss - a gate that cannot read its own number must never pass.
 * CONDITIONS: node >= 22.5; stdlib only. VERSION: 1.0.0
 */
'use strict';
const fs = require('fs');

const FLOOR = parseFloat(process.argv[2] || process.env.COVERAGE_FLOOR || '80');
const input = fs.readFileSync(0, 'utf8');
const rows = input.split('\n').filter(l => /all files/.test(l));
const m = rows.map(l => l.match(/all files\s*\|\s*([0-9]+(?:\.[0-9]+)?)\s*\|/)).filter(Boolean);
if (!m.length) {
  console.error('COVERAGE FLOOR: no "all files" coverage row found in input; refusing a vacuous pass');
  process.exit(1);
}
const linePct = parseFloat(m[0][1]);
console.log('COVERAGE FLOOR :: all-files line % = ' + linePct.toFixed(2) + ' :: floor = ' + FLOOR.toFixed(2));
if (!(linePct >= FLOOR)) {
  console.error('COVERAGE FLOOR: FAIL - line coverage below floor');
  process.exit(1);
}
console.log('COVERAGE FLOOR: PASS');
process.exit(0);
