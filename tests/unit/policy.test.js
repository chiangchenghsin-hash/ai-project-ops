"use strict";
/**
 * Unit tests for dist/policy.js (CP pure policy-table rules).
 * Only the pure, argument-reading functions are exercised here;
 * fetch and DOM builders need a browser and are out of scope for this layer.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DIST = path.join(
  __dirname, "..", "..", "assets", "linked-gantt-board", "dist"
);
const POLICY_JS = path.join(DIST, "policy.js");
vm.runInThisContext(fs.readFileSync(POLICY_JS, "utf8"), {
  filename: POLICY_JS,
});
const P = globalThis.CP;

test("isEnforced: only the numeric flag 1 counts as enforced", () => {
  assert.equal(P.isEnforced({ enforced: 1 }), true);
  // Discrimination: string "1" also coerces; 0 and missing must stay false.
  assert.equal(P.isEnforced({ enforced: "1" }), true);
  assert.equal(P.isEnforced({ enforced: 0 }), false);
  assert.equal(P.isEnforced({ enforced: "0" }), false);
  assert.equal(P.isEnforced({}), false);
});

test("enforcedActions: filters rows and preserves input order", () => {
  const rows = [
    { action: "alpha", enforced: 1 },
    { action: "beta", enforced: 0 },
    { action: "gamma", enforced: "1" },
    { action: "delta" },
  ];
  // Discrimination: order must follow input, not alphabetical re-sort.
  assert.deepEqual(P.enforcedActions(rows), ["alpha", "gamma"]);
  assert.deepEqual(P.enforcedActions([]), []);
});

test("needsWrittenReason: mirrors the requires_reason flag", () => {
  assert.equal(P.needsWrittenReason({ requires_reason: 1 }), true);
  assert.equal(P.needsWrittenReason({ requires_reason: 0 }), false);
  assert.equal(P.needsWrittenReason({ requires_reason: "1" }), true);
  assert.equal(P.needsWrittenReason({}), false);
});

test("isRejected: case- and whitespace-insensitive on the state string", () => {
  assert.equal(P.isRejected("REJECTED"), true);
  assert.equal(P.isRejected("rejected"), true);
  assert.equal(P.isRejected("  Rejected  "), true);
  // Discrimination: partial words and other states must not match.
  assert.equal(P.isRejected("REJECTED_LATER"), false);
  assert.equal(P.isRejected("approved"), false);
  assert.equal(P.isRejected(""), false);
});

test("rejectReasonError: rejected without a written reason is an error", () => {
  // Locked negative rule - exact message asserted.
  assert.equal(
    P.rejectReasonError("REJECTED", ""),
    "reject requires a written reason"
  );
  assert.equal(
    P.rejectReasonError("rejected", "   "),
    "reject requires a written reason"
  );
  assert.equal(P.rejectReasonError("REJECTED", null), "reject requires a written reason");
  // Discrimination: a real reason clears the gate; non-rejected states
  // never demand a reason even when the reason is empty.
  assert.equal(P.rejectReasonError("REJECTED", "scope creep"), null);
  assert.equal(P.rejectReasonError("APPROVED", ""), null);
  assert.equal(P.rejectReasonError("pending", "anything"), null);
});
