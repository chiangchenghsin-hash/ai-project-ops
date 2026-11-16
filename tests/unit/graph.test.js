"use strict";
/**
 * Unit tests for dist/graph.js (CP dependency / critical-path maths).
 * Loads dist/time.js first because graph.js calls CP.parse / CP.fmt.
 * All dates are fixed; no DOM, no store, no network.
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
const GRAPH_JS = path.join(DIST, "graph.js");
vm.runInThisContext(fs.readFileSync(TIME_JS, "utf8"), {
  filename: TIME_JS,
});
vm.runInThisContext(fs.readFileSync(GRAPH_JS, "utf8"), {
  filename: GRAPH_JS,
});
const G = globalThis.CP;

function task(id, start, end, extra) {
  return Object.assign({ id, start, end, status: "todo", sort: 0 }, extra || {});
}

// ---- labels -------------------------------------------------------------
test("depTypeLabel: all four types plus passthrough default", () => {
  assert.equal(G.depTypeLabel("FS"), "finish -> start");
  assert.equal(G.depTypeLabel("SS"), "start -> start");
  assert.equal(G.depTypeLabel("FF"), "finish -> finish");
  assert.equal(G.depTypeLabel("SF"), "start -> finish");
  // Discrimination: unknown type must pass through, not map to FS text.
  assert.equal(G.depTypeLabel("XX"), "XX");
});

// ---- shared order -------------------------------------------------------
test("sharedOrder: orders by status, then sort, then id; input untouched", () => {
  const a = task("a", "2026-01-01T00:00", "2026-01-01T01:00", { status: "b", sort: 2 });
  const b = task("b", "2026-01-01T00:00", "2026-01-01T01:00", { status: "a", sort: 5 });
  const c = task("c", "2026-01-01T00:00", "2026-01-01T01:00", { status: "a", sort: 5 });
  const input = [a, b, c];
  const out = G.sharedOrder(input);
  assert.deepEqual(out.map((t) => t.id), ["b", "c", "a"]);
  // Discrimination: pure means no mutation of the caller's array order.
  assert.deepEqual(input.map((t) => t.id), ["a", "b", "c"]);
});

// ---- tree maths ---------------------------------------------------------
test("taskDepth: counts parent links; corrupt parent loop terminates", () => {
  const tasks = [
    task("root", "2026-01-01T00:00", "2026-01-01T01:00"),
    task("mid", "2026-01-01T00:00", "2026-01-01T01:00", { parent_id: "root" }),
    task("leaf", "2026-01-01T00:00", "2026-01-01T01:00", { parent_id: "mid" }),
    task("x", "2026-01-01T00:00", "2026-01-01T01:00", { parent_id: "y" }),
    task("y", "2026-01-01T00:00", "2026-01-01T01:00", { parent_id: "x" }),
  ];
  assert.equal(G.taskDepth(tasks, "root"), 0);
  assert.equal(G.taskDepth(tasks, "mid"), 1);
  assert.equal(G.taskDepth(tasks, "leaf"), 2);
  // Discrimination: a loop must stop (seen set), not spin forever or
  // walk infinitely - a finite depth is the contract.
  const loopDepth = G.taskDepth(tasks, "x");
  assert.ok(Number.isFinite(loopDepth) && loopDepth >= 1);
});

test("hasAncestor: true on the chain, false off it, false for self", () => {
  const tasks = [
    task("root", "2026-01-01T00:00", "2026-01-01T01:00"),
    task("mid", "2026-01-01T00:00", "2026-01-01T01:00", { parent_id: "root" }),
    task("leaf", "2026-01-01T00:00", "2026-01-01T01:00", { parent_id: "mid" }),
    task("other", "2026-01-01T00:00", "2026-01-01T01:00"),
  ];
  assert.equal(G.hasAncestor(tasks, "leaf", "root"), true);
  assert.equal(G.hasAncestor(tasks, "leaf", "mid"), true);
  assert.equal(G.hasAncestor(tasks, "mid", "leaf"), false);
  assert.equal(G.hasAncestor(tasks, "other", "root"), false);
  // Discrimination: a node is not its own ancestor.
  assert.equal(G.hasAncestor(tasks, "root", "root"), false);
});

// ---- depViolated (boundary discrimination) ------------------------------
const A0 = "2026-01-01T09:00";
const A1 = "2026-01-01T10:00";
const B0 = "2026-01-01T10:00";
const B1 = "2026-01-01T11:00";

test("depViolated FS: touching is legal, one minute early is not", () => {
  // Discrimination: exact boundary must be false (back-to-back ok);
  // 1 minute earlier must be true. An off-by-one here flips both.
  assert.equal(G.depViolated("FS", A0, A1, B0, B1), false);
  assert.equal(G.depViolated("FS", A0, A1, "2026-01-01T09:59", "2026-01-01T10:59"), true);
});

test("depViolated FS: lag shifts the bound; negative lag is a lead", () => {
  // lag 1h: successor must start at/after 11:00.
  assert.equal(G.depViolated("FS", A0, A1, "2026-01-01T11:00", "2026-01-01T12:00", 1), false);
  assert.equal(G.depViolated("FS", A0, A1, "2026-01-01T10:59", "2026-01-01T11:59", 1), true);
  // lag -2h (lead): bound moves down to 08:00 - touching legal again.
  assert.equal(G.depViolated("FS", A0, A1, "2026-01-01T08:00", "2026-01-01T09:00", -2), false);
  assert.equal(G.depViolated("FS", A0, A1, "2026-01-01T07:59", "2026-01-01T08:59", -2), true);
});

test("depViolated: SS/FF/SF compare against the correct endpoints", () => {
  // SS: successor start vs predecessor start (09:00).
  assert.equal(G.depViolated("SS", A0, A1, "2026-01-01T09:00", "2026-01-01T10:00"), false);
  assert.equal(G.depViolated("SS", A0, A1, "2026-01-01T08:59", "2026-01-01T09:59"), true);
  // FF: successor end vs predecessor end (10:00).
  assert.equal(G.depViolated("FF", A0, A1, "2026-01-01T09:00", "2026-01-01T10:00"), false);
  assert.equal(G.depViolated("FF", A0, A1, "2026-01-01T08:00", "2026-01-01T09:59"), true);
  // SF: successor end vs predecessor start (09:00).
  assert.equal(G.depViolated("SF", A0, A1, "2026-01-01T08:00", "2026-01-01T09:00"), false);
  assert.equal(G.depViolated("SF", A0, A1, "2026-01-01T07:00", "2026-01-01T08:59"), true);
});

test("depViolated: broken windows always violate; unknown type never does", () => {
  // Predecessor window inverted.
  assert.equal(G.depViolated("FS", A1, A0, B0, B1), true);
  // Successor window inverted.
  assert.equal(G.depViolated("FS", A0, A1, B1, B0), true);
  // Discrimination: default branch returns false for unknown types.
  assert.equal(G.depViolated("ZZ", A0, A1, "2026-01-01T00:00", "2026-01-01T01:00"), false);
});

// ---- criticalIds --------------------------------------------------------
test("criticalIds: tight chain is fully critical; isolated task is not", () => {
  const tasks = [
    task("A", "2026-01-05T09:00", "2026-01-05T10:00"),
    task("B", "2026-01-05T10:00", "2026-01-05T11:00"),
    task("C", "2026-01-05T11:00", "2026-01-05T12:00"),
    task("lonely", "2026-01-05T09:00", "2026-01-05T17:00"),
  ];
  const deps = [
    { from: "A", to: "B", type: "FS", lag: 0 },
    { from: "B", to: "C", type: "FS", lag: 0 },
  ];
  // Discrimination: with zero slack all three chain members must float 0;
  // a broken float computation drops or adds an id here.
  assert.deepEqual(G.criticalIds(tasks, deps), ["A", "B", "C"]);
});

test("criticalIds: a predecessor with slack drops out of the set", () => {
  const tasks = [
    task("A", "2026-01-05T09:00", "2026-01-05T10:00"),
    task("B", "2026-01-05T12:00", "2026-01-05T13:00"),
  ];
  const deps = [{ from: "A", to: "B", type: "FS", lag: 0 }];
  // A can slip 2h without moving B, so only B is critical.
  assert.deepEqual(G.criticalIds(tasks, deps), ["B"]);
});

test("criticalIds: empty inputs and no edges return empty", () => {
  assert.deepEqual(G.criticalIds([], []), []);
  const tasks = [task("A", "2026-01-05T09:00", "2026-01-05T10:00")];
  assert.deepEqual(G.criticalIds(tasks, []), []);
  // Edge referencing a missing task is ignored, not a throw.
  assert.deepEqual(
    G.criticalIds(tasks, [{ from: "A", to: "ghost", type: "FS", lag: 0 }]),
    []
  );
});

test("criticalIds: cyclic deps terminate via topo fallback", () => {
  const tasks = [
    task("A", "2026-01-05T09:00", "2026-01-05T10:00"),
    task("B", "2026-01-05T10:00", "2026-01-05T11:00"),
  ];
  const deps = [
    { from: "A", to: "B", type: "FS", lag: 0 },
    { from: "B", to: "A", type: "FS", lag: 0 },
  ];
  // Discrimination: must return (no hang), as a sorted array of participants.
  const out = G.criticalIds(tasks, deps);
  assert.ok(Array.isArray(out));
  assert.deepEqual(out.slice().sort(), ["A", "B"]);
});

test("criticalIds: placeholder tasks are excluded from participation", () => {
  const tasks = [
    task("A", "2026-01-05T09:00", "2026-01-05T10:00"),
    task("P", "2026-01-05T10:00", "2026-01-05T11:00", { placeholder: true }),
  ];
  const deps = [{ from: "A", to: "P", type: "FS", lag: 0 }];
  // P is not in byId, so the edge is dropped and A is untouched -> empty.
  assert.deepEqual(G.criticalIds(tasks, deps), []);
});

test("criticalIds: FF and SF edges feed the backward pass", () => {
  const tasks = [
    task("A", "2026-01-05T09:00", "2026-01-05T10:00"),
    task("B", "2026-01-05T10:00", "2026-01-05T11:00"),
    task("C", "2026-01-05T10:00", "2026-01-05T11:00"),
  ];
  const deps = [
    { from: "A", to: "B", type: "FF", lag: 0 },
    { from: "A", to: "C", type: "SF", lag: 0 },
  ];
  // B and C are pinned at both ends (zero float); A keeps 1h of slack
  // because its successors end at 11:00 while it finishes at 10:00.
  assert.deepEqual(G.criticalIds(tasks, deps), ["B", "C"]);
});

test("criticalIds: SS edge exercises the backward start-to-start bound", () => {
  const tasks = [
    task("A", "2026-01-05T09:00", "2026-01-05T10:00"),
    task("B", "2026-01-05T09:00", "2026-01-05T11:00"),
  ];
  const deps = [{ from: "A", to: "B", type: "SS", lag: 0 }];
  // Both starts are pinned at 09:00, so both float zero.
  assert.deepEqual(G.criticalIds(tasks, deps), ["A", "B"]);
});

// ---- bumpCascade --------------------------------------------------------
test("bumpCascade: drag pushes successors in order with exact windows", () => {
  const tasks = [
    task("A", "2026-01-05T09:00", "2026-01-05T10:00"),
    task("B", "2026-01-05T10:00", "2026-01-05T11:00"),
    task("C", "2026-01-05T11:00", "2026-01-05T12:00"),
  ];
  const deps = [
    { from: "A", to: "B", type: "FS", lag: 0 },
    { from: "B", to: "C", type: "FS", lag: 0 },
  ];
  // Drag A two hours later: B must shift +2h, then C +2h.
  const out = G.bumpCascade(tasks, deps, "A", "2026-01-05T11:00", "2026-01-05T12:00");
  // Discrimination: exact ids in cascade order and exact resulting windows.
  assert.deepEqual(out.map((m) => m.id), ["B", "C"]);
  assert.equal(out[0].start, "2026-01-05T12:00");
  assert.equal(out[0].end, "2026-01-05T13:00");
  assert.equal(out[1].start, "2026-01-05T13:00");
  assert.equal(out[1].end, "2026-01-05T14:00");
  // The dragged task itself is never in the output.
  assert.ok(!out.some((m) => m.id === "A"));
});

test("bumpCascade: no violation yields no moves; unknown id yields []", () => {
  const tasks = [
    task("A", "2026-01-05T09:00", "2026-01-05T10:00"),
    task("B", "2026-01-05T10:00", "2026-01-05T11:00"),
  ];
  const deps = [{ from: "A", to: "B", type: "FS", lag: 0 }];
  // Moving A earlier keeps FS satisfied -> empty cascade.
  assert.deepEqual(
    G.bumpCascade(tasks, deps, "A", "2026-01-05T08:00", "2026-01-05T09:00"),
    []
  );
  assert.deepEqual(G.bumpCascade(tasks, deps, "ghost", "2026-01-05T08:00", "2026-01-05T09:00"), []);
});

test("bumpCascade: placeholder successors are never moved", () => {
  const tasks = [
    task("A", "2026-01-05T09:00", "2026-01-05T10:00"),
    task("P", "2026-01-05T10:00", "2026-01-05T11:00", { placeholder: true }),
    task("C", "2026-01-05T11:00", "2026-01-05T12:00"),
  ];
  const deps = [
    { from: "A", to: "P", type: "FS", lag: 0 },
    { from: "P", to: "C", type: "FS", lag: 0 },
  ];
  const out = G.bumpCascade(tasks, deps, "A", "2026-01-05T12:00", "2026-01-05T13:00");
  // Discrimination: placeholder is skipped and does not forward the chain.
  assert.deepEqual(out, []);
});

test("bumpCascade: cyclic successor graph terminates", () => {
  const tasks = [
    task("A", "2026-01-05T09:00", "2026-01-05T10:00"),
    task("B", "2026-01-05T10:00", "2026-01-05T11:00"),
  ];
  const deps = [
    { from: "A", to: "B", type: "FS", lag: 0 },
    { from: "B", to: "A", type: "FS", lag: 0 },
  ];
  const out = G.bumpCascade(tasks, deps, "A", "2026-01-05T12:00", "2026-01-05T13:00");
  // seen-set must stop the walk; B moves once, A is already seen.
  assert.deepEqual(out.map((m) => m.id), ["B"]);
});
