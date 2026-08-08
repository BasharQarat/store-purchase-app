import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, "..", "data", "seed-items.json");

test("seed-items.json is a non-empty array of well-formed items with unique ids and barcodes", () => {
  const items = JSON.parse(readFileSync(seedPath, "utf8"));
  assert.ok(Array.isArray(items) && items.length > 0);

  const ids = new Set();
  const barcodes = new Set();
  for (const item of items) {
    assert.equal(typeof item.id, "string");
    assert.equal(typeof item.barcode, "string");
    assert.equal(typeof item.name, "string");
    assert.equal(typeof item.price, "number");
    assert.equal(typeof item.purchase_price, "number");
    ids.add(item.id);
    barcodes.add(item.barcode);
  }
  assert.equal(ids.size, items.length, "item ids must be unique");
  assert.equal(barcodes.size, items.length, "barcodes must be unique");
});
