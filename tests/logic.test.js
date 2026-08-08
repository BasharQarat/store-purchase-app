import test from "node:test";
import assert from "node:assert/strict";
import {
  nextItemId,
  calcAmount,
  isToday,
  filterItemsByQuery,
  buildExportPayload,
  findItemByBarcode,
  buildItemsExportPayload,
  addOrIncrementCartLine,
  updateCartLine,
  removeCartLine,
  cartTotal,
  buildPurchasesFromCart,
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

test("findItemByBarcode returns the matching item", () => {
  const items = [
    { id: "IT-0001", barcode: "111", name: "A" },
    { id: "IT-0002", barcode: "222", name: "B" },
  ];
  assert.deepEqual(findItemByBarcode(items, "222"), items[1]);
});

test("findItemByBarcode returns null when no item matches", () => {
  const items = [{ id: "IT-0001", barcode: "111", name: "A" }];
  assert.equal(findItemByBarcode(items, "999"), null);
});

test("buildItemsExportPayload maps items to the seed-items.json shape", () => {
  const items = [
    {
      id: "IT-0001",
      barcode: "111",
      name: "A",
      category: "cat",
      price: 100,
      purchase_price: 90,
    },
  ];
  assert.deepEqual(buildItemsExportPayload(items), [
    {
      id: "IT-0001",
      barcode: "111",
      name: "A",
      category: "cat",
      price: 100,
      purchase_price: 90,
    },
  ]);
});

test("buildItemsExportPayload falls back purchase_price to price when missing", () => {
  const items = [
    { id: "IT-0002", barcode: "222", name: "B", category: "cat", price: 50 },
  ];
  const [result] = buildItemsExportPayload(items);
  assert.equal(result.purchase_price, 50);
});

test("addOrIncrementCartLine adds a new line for an unseen item", () => {
  const cart = addOrIncrementCartLine([], { id: "IT-0001", name: "Pepsi", price: 4000 });
  assert.deepEqual(cart, [{ itemId: "IT-0001", itemName: "Pepsi", price: 4000, quantity: 1 }]);
});

test("addOrIncrementCartLine increments quantity when the item is already in the cart", () => {
  const cart = [{ itemId: "IT-0001", itemName: "Pepsi", price: 4000, quantity: 1 }];
  const result = addOrIncrementCartLine(cart, { id: "IT-0001", name: "Pepsi", price: 4000 });
  assert.deepEqual(result, [{ itemId: "IT-0001", itemName: "Pepsi", price: 4000, quantity: 2 }]);
});

test("addOrIncrementCartLine does not touch other lines", () => {
  const cart = [
    { itemId: "IT-0001", itemName: "Pepsi", price: 4000, quantity: 1 },
    { itemId: "IT-0002", itemName: "Chips", price: 6000, quantity: 1 },
  ];
  const result = addOrIncrementCartLine(cart, { id: "IT-0002", name: "Chips", price: 6000 });
  assert.equal(result[0].quantity, 1);
  assert.equal(result[1].quantity, 2);
});

test("updateCartLine patches only the matching line", () => {
  const cart = [
    { itemId: "IT-0001", itemName: "Pepsi", price: 4000, quantity: 1 },
    { itemId: "IT-0002", itemName: "Chips", price: 6000, quantity: 1 },
  ];
  const result = updateCartLine(cart, "IT-0001", { quantity: 3 });
  assert.equal(result[0].quantity, 3);
  assert.equal(result[1].quantity, 1);
});

test("removeCartLine drops the matching line", () => {
  const cart = [
    { itemId: "IT-0001", itemName: "Pepsi", price: 4000, quantity: 1 },
    { itemId: "IT-0002", itemName: "Chips", price: 6000, quantity: 1 },
  ];
  assert.deepEqual(removeCartLine(cart, "IT-0001"), [
    { itemId: "IT-0002", itemName: "Chips", price: 6000, quantity: 1 },
  ]);
});

test("cartTotal sums amount across all lines", () => {
  const cart = [
    { itemId: "IT-0001", itemName: "Pepsi", price: 4000, quantity: 2 },
    { itemId: "IT-0002", itemName: "Chips", price: 6000, quantity: 1 },
  ];
  assert.equal(cartTotal(cart), 14000);
});

test("buildPurchasesFromCart shapes each line into a full purchase record", () => {
  const cart = [{ itemId: "IT-0001", itemName: "Pepsi", price: 4000, quantity: 2 }];
  const purchases = buildPurchasesFromCart(cart, "2026-08-08T10:00:00.000Z");
  assert.equal(purchases.length, 1);
  assert.equal(typeof purchases[0].id, "string");
  assert.equal(purchases[0].itemId, "IT-0001");
  assert.equal(purchases[0].amount, 8000);
  assert.equal(purchases[0].timestamp, "2026-08-08T10:00:00.000Z");
});
