import test from "node:test";
import assert from "node:assert/strict";
import * as download from "../js/download.js";

test("download module exports triggerDownload as a function", () => {
  assert.equal(typeof download.triggerDownload, "function");
});
