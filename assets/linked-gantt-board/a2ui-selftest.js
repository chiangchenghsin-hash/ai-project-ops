"use strict";
/**
 * AUI-01 Stage A selftest for CP.A2UI (run: node a2ui-selftest.js).
 * Asserts: v1.0 wire message shapes; literal + @path binding resolution;
 * updateDataModel refreshes text WITHOUT structural re-render (node identity);
 * decision clicks emit agent-side events only; the renderer function registry
 * never contains the agentOnly function; rendererOnly formatAskAge resolves;
 * an agentOnly @call in a dynamic slot throws instead of executing.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

vm.runInThisContext(
  fs.readFileSync(path.join(__dirname, "dist", "a2ui.js"), "utf8"),
  { filename: "dist/a2ui.js" }
);
const A2UI = globalThis.CP.A2UI;

let passed = 0;
function ok(cond, label) {
  if (!cond) {
    console.error("FAIL " + label);
    process.exit(1);
  }
  passed += 1;
  console.log("PASS " + label);
}

// ---- minimal DOM stub -------------------------------------------------
function FakeText(text) {
  this.nodeValue = text;
}
function FakeEl(tag) {
  this.tag = tag;
  this.attrs = {};
  this.children = [];
  this.onclick = null;
}
FakeEl.prototype.appendChild = function (child) {
  this.children.push(child);
  return child;
};
FakeEl.prototype.setAttribute = function (name, value) {
  this.attrs[name] = value;
};
const fakeDoc = {
  createElement: function (tag) { return new FakeEl(tag); },
  createTextNode: function (text) { return new FakeText(text); }
};
function textOf(node) {
  if (node instanceof FakeText) return node.nodeValue;
  return node.children.map(textOf).join("");
}

// ---- wire shapes ------------------------------------------------------
const m1 = A2UI.createSurface("surf-1", A2UI.GOVERNANCE_CATALOG_ID, [], { owner: "chian" });
ok(m1.version === "1.0" && m1.createSurface.surfaceId === "surf-1", "createSurface v1.0 shape");
ok(m1.createSurface.catalogId === A2UI.GOVERNANCE_CATALOG_ID, "createSurface carries catalogId");
const m2 = A2UI.updateComponents("surf-1", [{ id: "root", component: "Text", text: "x" }]);
ok(m2.updateComponents.components[0].id === "root", "updateComponents v1.0 shape");
const m3 = A2UI.updateDataModel("surf-1", { owner: "next" });
ok(m3.updateDataModel.dataModel.owner === "next", "updateDataModel v1.0 shape");

// ---- render + bindings -----------------------------------------------
const events = [];
const comps = [
  { id: "root", component: "AskCard", askId: "A-1",
    title: { "@path": "/headline" },
    question: "Ship Stage A?",
    evidence: ["ev1"], options: ["btn-yes", "btn-no"] },
  { id: "ev1", component: "Text", text: { "@call": "formatAskAge", args: { openedAt: "2026-11-14T00:00:00Z" } } },
  { id: "btn-yes", component: "Button", label: "Approve",
    action: { event: { name: "ask.decide", userMessage: { "@path": "/askId" } } } },
  { id: "btn-no", component: "Button", label: "Reject",
    action: { event: { name: "ask.decide", userMessage: "reject" } } }
];
const model = { owner: "chian", headline: "Sign-off: chian", askId: "A-1" };
const container = new FakeEl("div");
const handle = A2UI.renderSurface(container, comps, model, {
  doc: fakeDoc,
  onEvent: function (name, msg) { events.push([name, msg]); }
});
const surfaceText = textOf(container);
ok(surfaceText.indexOf("Ship Stage A?") >= 0, "literal text renders");
ok(surfaceText.indexOf("Sign-off: chian") >= 0, "@path binding resolves");
ok(surfaceText.indexOf("2026-11-14T00:00:00Z") < 0 && /(\d+d \d+h|\d+h \d+m|\d+m)/.test(surfaceText),
  "rendererOnly formatAskAge resolves display-side");

// ---- updateDataModel: text changes, structure identical ---------------
const askEl = container.children[0].children[0];
const nodeBefore = askEl.children[0].children[0];
handle.updateDataModel({ headline: "Sign-off: next" });
const nodeAfter = askEl.children[0].children[0];
ok(nodeBefore === nodeAfter, "updateDataModel keeps node identity (no structural re-render)");
ok(textOf(container).indexOf("Sign-off: next") >= 0, "updateDataModel refreshes bound text");

// ---- event round-trip: agent-side only --------------------------------
ok(A2UI.rendererFunctionNames().indexOf("recordDecision") < 0,
  "renderer function registry excludes agentOnly recordDecision");
const btnYes = container.children[0].children[0].children[3].children[0];
btnYes.onclick();
ok(events.length === 1 && events[0][0] === "ask.decide" && events[0][1] === "A-1",
  "decision click emits agent event with resolved userMessage");

let threw = false;
try {
  A2UI.resolve({ "@call": "recordDecision", args: { askId: "A-1" } }, model);
} catch (e) {
  threw = true;
}
ok(threw, "agentOnly @call in a dynamic slot throws instead of executing");

console.log("a2ui-selftest: " + passed + " assertions passed");
process.exit(0);
