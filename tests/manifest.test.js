import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, "..", "manifest.json");

test("manifest.json has the required PWA fields", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(typeof manifest.name, "string");
  assert.equal(typeof manifest.short_name, "string");
  assert.equal(manifest.display, "standalone");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
});
