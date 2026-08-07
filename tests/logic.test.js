import test from "node:test";
import assert from "node:assert/strict";
import {
  nextItemId,
  calcAmount,
  isToday,
  filterItemsByQuery,
  buildExportPayload,
} from "../js/logic.js";

test("nextItemId starts at IT-0001 with no existing ids", () => {
  assert.equal(nextItemId([]), "IT-0001");
});

test("nextItemId increments from the highest existing id", () => {
  assert.equal(nextItemId(["IT-0001", "IT-0003", "IT-0002"]), "IT-0004");
});

test("nextItemId ignores ids that don't match the IT-#### pattern", () => {
  assert.equal(nextItemId(["IT-0001", "weird-id"]), "IT-0002");
});

test("calcAmount multiplies quantity by price", () => {
  assert.equal(calcAmount(3, 1500), 4500);
});

test("calcAmount rounds to 2 decimal places", () => {
  assert.equal(calcAmount(3, 0.1), 0.3);
});

test("isToday is true for a timestamp matching now", () => {
  const now = new Date(2026, 7, 7, 10, 0, 0);
  assert.equal(isToday(now.toISOString(), now), true);
});

test("isToday is false for a different calendar day", () => {
  const now = new Date(2026, 7, 7, 10, 0, 0);
  const yesterday = new Date(2026, 7, 6, 10, 0, 0);
  assert.equal(isToday(yesterday.toISOString(), now), false);
});

test("filterItemsByQuery filters case-insensitively by name", () => {
  const items = [{ name: "Pepsi" }, { name: "Chips" }];
  assert.deepEqual(filterItemsByQuery(items, "chip"), [{ name: "Chips" }]);
});

test("filterItemsByQuery returns all items for an empty query", () => {
  const items = [{ name: "Pepsi" }, { name: "Chips" }];
  assert.deepEqual(filterItemsByQuery(items, ""), items);
});

test("buildExportPayload shapes purchases into an entries array", () => {
  const purchases = [
    {
      id: "1",
      itemId: "IT-0001",
      itemName: "Pepsi",
      price: 4000,
      quantity: 2,
      amount: 8000,
      timestamp: "2026-08-07T10:00:00.000Z",
    },
  ];
  const payload = buildExportPayload(purchases);
  assert.equal(payload.entries.length, 1);
  assert.equal(payload.entries[0].itemName, "Pepsi");
  assert.equal(payload.entries[0].amount, 8000);
  assert.ok(payload.exportedAt);
});
