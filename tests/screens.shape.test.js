import test from "node:test";
import assert from "node:assert/strict";
import { renderLogPurchase } from "../js/screens/logPurchase.js";
import { renderToday } from "../js/screens/today.js";
import { renderItems } from "../js/screens/items.js";
import { renderLabels } from "../js/screens/labels.js";

test("renderLogPurchase is exported as a function", () => {
  assert.equal(typeof renderLogPurchase, "function");
});

test("renderToday is exported as a function", () => {
  assert.equal(typeof renderToday, "function");
});

test("renderItems is exported as a function", () => {
  assert.equal(typeof renderItems, "function");
});

test("renderLabels is exported as a function", () => {
  assert.equal(typeof renderLabels, "function");
});
