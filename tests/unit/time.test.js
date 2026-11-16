"use strict";
/**
 * Unit tests for dist/time.js (CP time helpers).
 * Classic script: loaded via vm.runInThisContext, same pattern as
 * assets/linked-gantt-board/a2ui-selftest.js.
 * Deterministic and offline: assertions use fixed dates away from
 * northern-hemisphere DST transitions (January).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DIST = path.join(
  __dirname, "..", "..", "assets", "linked-gantt-board", "dist"
);
const TIME_JS = path.join(DIST, "time.js");
vm.runInThisContext(fs.readFileSync(TIME_JS, "utf8"), {
  filename: TIME_JS,
});
const T = globalThis.CP;

test("parse: full ISO minute precision maps to local calendar fields", () => {
  const d = T.parse("2026-01-15T09:07");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 0);
  assert.equal(d.getDate(), 15);
  assert.equal(d.getHours(), 9);
  assert.equal(d.getMinutes(), 7);
});

test("parse: non-matching input falls through to Date constructor", () => {
  // Discrimination: if parse wrongly returned null/epoch for garbage,
  // this NaN assertion would fail.
  assert.ok(Number.isNaN(T.parse("not-a-date").getTime()));
});

test("fmt: round-trips a parsed value back to the same string", () => {
  assert.equal(T.fmt(T.parse("2026-01-15T09:07")), "2026-01-15T09:07");
  assert.equal(T.fmt(T.parse("2026-01-05T00:00")), "2026-01-05T00:00");
});

test("addHours: crosses a day boundary and pads fields", () => {
  // Discrimination: a date-rolloff bug would yield 2026-01-05T24:30 or
  // 2026-01-06T23:30 instead of the exact expected string.
  assert.equal(T.addHours("2026-01-05T23:30", 1), "2026-01-06T00:30");
  assert.equal(T.addHours("2026-01-05T09:00", -9), "2026-01-05T00:00");
  assert.equal(T.addHours("2026-01-01T00:00", -1), "2025-12-31T23:00");
});

test("diffHours: signed difference, exact halves, zero for identical", () => {
  // Contract: diffHours(a, b) === time(b) - time(a).
  assert.equal(T.diffHours("2026-01-01T00:00", "2026-01-01T06:30"), 6.5);
  // Discrimination: swapping arguments must flip the sign exactly.
  assert.equal(T.diffHours("2026-01-01T00:00", "2026-01-02T00:00"), 24);
  assert.equal(T.diffHours("2026-01-02T00:00", "2026-01-01T00:00"), -24);
  assert.equal(T.diffHours("2026-01-01T00:00", "2026-01-01T00:00"), 0);
});

test("tickLabel: renders MM-DD H:00 with zero-padded parts", () => {
  assert.equal(T.tickLabel("2026-01-05T09:00"), "01-05 09:00");
  assert.equal(T.tickLabel("2026-12-31T00:00"), "12-31 00:00");
});

test("isMidnight: hour-level check - any minute of hour 00 counts", () => {
  assert.equal(T.isMidnight("2026-01-05T00:00"), true);
  assert.equal(T.isMidnight("2026-01-05T00:59"), true);
  // Discrimination: 23:00 and 01:00 must not be mistaken for hour 00.
  assert.equal(T.isMidnight("2026-01-05T23:00"), false);
  assert.equal(T.isMidnight("2026-01-05T01:00"), false);
});

test("axisStart: always a Monday at 00:00", () => {
  const s = T.axisStart();
  assert.match(s, /^\d{4}-\d{2}-\d{2}T00:00$/);
  const d = T.parse(s);
  assert.equal(d.getHours(), 0);
  // getDay() === 1 is Monday; axisStart floors back to the Monday of the
  // week seven days before now.
  assert.equal(d.getDay(), 1);
});

test("todayStr: YYYY-MM-DD shape", () => {
  assert.match(T.todayStr(), /^\d{4}-\d{2}-\d{2}$/);
});

test("hoursUntil: empty input is infinite; past dates are negative", () => {
  assert.equal(T.hoursUntil(""), Number.POSITIVE_INFINITY);
  assert.equal(T.hoursUntil(undefined), Number.POSITIVE_INFINITY);
  // Deterministic regardless of clock: 2000 is always in the past.
  assert.ok(T.hoursUntil("2000-01-01") < 0);
});
