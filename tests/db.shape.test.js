import test from "node:test";
import assert from "node:assert/strict";
import * as db from "../js/db.js";

test("db module exports the expected functions", () => {
  for (const name of [
    "openDb",
    "getAllItems",
    "getItemByBarcode",
    "saveItem",
    "deleteItem",
    "getAllPurchases",
    "savePurchase",
    "deletePurchase",
  ]) {
    assert.equal(typeof db[name], "function", `${name} should be exported as a function`);
  }
});
