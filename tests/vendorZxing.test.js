import test from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "..", "vendor", "zxing", "zxing.min.js");

test("vendored ZXing file exists and is non-trivial in size", () => {
  const stats = statSync(filePath);
  assert.ok(stats.size > 10000, `expected a real bundle, got ${stats.size} bytes`);
});
