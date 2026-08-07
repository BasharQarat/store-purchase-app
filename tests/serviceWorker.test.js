import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

test("every asset listed in service-worker.js exists on disk", () => {
  const source = readFileSync(join(root, "service-worker.js"), "utf8");
  const match = source.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(match, "ASSETS array not found in service-worker.js");
  const entries = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(entries.length > 0, "ASSETS array should not be empty");
  for (const entry of entries) {
    if (entry === "./") continue;
    const relative = entry.replace(/^\.\//, "");
    assert.ok(existsSync(join(root, relative)), `missing asset: ${relative}`);
  }
});
