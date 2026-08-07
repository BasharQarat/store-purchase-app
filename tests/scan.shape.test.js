import test from "node:test";
import assert from "node:assert/strict";
import * as scan from "../js/scan.js";

test("scan module exports the expected functions", () => {
  assert.equal(typeof scan.isBarcodeScanSupported, "function");
  assert.equal(typeof scan.startBarcodeScan, "function");
});
