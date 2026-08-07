# Barcode Purchase Logging PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vanilla JS/HTML/CSS PWA where the buyer scans a barcode (or searches a list) to select an item, enters quantity/price, submits, reviews/edits today's entries, and shares the day's JSON — replacing the old voice-note logging flow.

**Architecture:** Static, no-build-step PWA. `js/logic.js` holds pure functions (unit-testable in Node). `js/db.js` wraps IndexedDB for `items` and `purchases`. `js/scan.js` wraps the native browser `BarcodeDetector` API (no vendored scanning library needed — see note below). Four screen modules under `js/screens/` each export a `render(container, db)` function; `js/app.js` wires them to a tab nav. `service-worker.js` caches the full app shell for offline use. Deployed to GitHub Pages for the HTTPS URL camera access requires.

**Tech Stack:** Vanilla JS (ES modules), HTML, CSS, browser IndexedDB, browser `BarcodeDetector`/`getUserMedia` APIs, vendored JsBarcode (label generation only), Node's built-in `node:test` for the parts that are meaningfully unit-testable, GitHub Pages for hosting.

**Deviation from spec:** The spec named `@zxing/browser` as the vendored scanning library. This plan uses the native `BarcodeDetector` API instead (supported on Chrome/Android, which is the buyer's expected phone) — zero dependency risk, no library to vendor/version-pin for scanning, less code. If `BarcodeDetector` is unsupported (e.g. iOS Safari), the screen falls back to the existing search-and-tap flow, which the spec already requires as a fallback path anyway. JsBarcode is still vendored for label generation (that one has a simple, stable, well-known API). Flag this to the user before running Task 5.

## Global Constraints

- No build step, no bundler, no framework — plain `<script type="module">` files.
- No CDN-loaded runtime assets — every file the app needs offline must be vendored locally so the service worker can cache it.
- No backend/server — all data lives in IndexedDB on the buyer's phone.
- UI language is Arabic, RTL layout (`dir="rtl"` on `<html>`).
- Per the approved spec, automated tests cover only pure logic (`logic.js`) and lightweight "module loads and exports the right shape" checks — IndexedDB/camera/screen/service-worker *behavior* is manually verified in a real browser, not mocked.
- `package.json` exists only to declare `"type": "module"` (so Node's test runner parses ESM) and a `test` script — it introduces no dependencies and no build tooling.

---

### Task 1: Pure logic module (`js/logic.js`)

**Files:**
- Create: `js/logic.js`
- Create: `package.json`
- Test: `tests/logic.test.js`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `nextItemId(existingIds: string[]): string`, `calcAmount(quantity: number, price: number): number`, `isToday(isoTimestamp: string, now?: Date): boolean`, `filterItemsByQuery(items: {name: string}[], query: string): array`, `buildExportPayload(purchases: array): {exportedAt: string, entries: array}`. All later tasks that need these import from `../logic.js` (or `../../logic.js` from `tests/`).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "store-purchase-app",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/logic.test.js`:

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module '../js/logic.js'`.

- [ ] **Step 4: Implement `js/logic.js`**

```js
export function nextItemId(existingIds) {
  let max = 0;
  for (const id of existingIds) {
    const match = /^IT-(\d+)$/.exec(id);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `IT-${String(max + 1).padStart(4, "0")}`;
}

export function calcAmount(quantity, price) {
  return Math.round(quantity * price * 100) / 100;
}

export function isToday(isoTimestamp, now = new Date()) {
  const d = new Date(isoTimestamp);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function filterItemsByQuery(items, query) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => item.name.toLowerCase().includes(q));
}

export function buildExportPayload(purchases) {
  return {
    exportedAt: new Date().toISOString(),
    entries: purchases.map((p) => ({
      itemName: p.itemName,
      quantity: p.quantity,
      price: p.price,
      amount: p.amount,
      timestamp: p.timestamp,
    })),
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json js/logic.js tests/logic.test.js
git commit -m "feat: add pure purchase-logic helpers"
```

(This project has no git repo yet — run `git init` first if/when the user wants version control; otherwise leave this step as a plain file change.)

---

### Task 2: Project shell — HTML, manifest, CSS, service worker, icon

**Files:**
- Create: `index.html`
- Create: `manifest.json`
- Create: `icons/icon.svg`
- Create: `css/styles.css`
- Create: `service-worker.js`
- Test: `tests/manifest.test.js`
- Test: `tests/serviceWorker.test.js`

**Interfaces:**
- Consumes: nothing new yet (screens/app.js don't exist until later tasks — `index.html` references `js/app.js` via `<script type="module">`, which won't resolve until Task 10; that's fine, static HTML doesn't error on a missing script until loaded in a browser).
- Produces: the DOM containers later tasks render into: `#screen-log`, `#screen-today`, `#screen-items`, `#screen-labels`, and the `#tabs` nav buttons with `data-screen` attributes `log`/`today`/`items`/`labels`.

- [ ] **Step 1: Write the failing tests**

Create `tests/manifest.test.js`:

```js
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
```

Create `tests/serviceWorker.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/`
Expected: both FAIL — `manifest.json`/`service-worker.js` don't exist yet (`ENOENT`).

- [ ] **Step 3: Create `manifest.json`**

```json
{
  "name": "تسجيل مشتريات المحل",
  "short_name": "مشتريات",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a73e8",
  "icons": [
    {
      "src": "icons/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 4: Create `icons/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="32" fill="#1a73e8"/>
  <text x="96" y="120" font-size="90" text-anchor="middle" fill="#ffffff" font-family="sans-serif">🛒</text>
</svg>
```

- [ ] **Step 5: Create `css/styles.css`**

```css
:root {
  font-family: system-ui, sans-serif;
  font-size: 18px;
}

body {
  margin: 0;
  padding-bottom: 64px;
  direction: rtl;
}

.screen {
  display: none;
  padding: 16px;
}

.screen.active {
  display: block;
}

button {
  min-height: 44px;
  min-width: 44px;
  font-size: 1rem;
  margin: 4px 0;
  padding: 0 12px;
}

input {
  min-height: 40px;
  font-size: 1rem;
  width: 100%;
  box-sizing: border-box;
  margin: 4px 0;
}

label {
  display: block;
  margin: 8px 0;
}

#tabs {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: #f0f0f0;
  border-top: 1px solid #ccc;
}

#tabs button {
  flex: 1;
  border: none;
  background: none;
  padding: 12px 0;
  margin: 0;
}

.print-only {
  display: none;
}

@media print {
  body > *:not(#print-root) {
    display: none !important;
  }
  #print-root {
    display: block !important;
  }
  .label {
    display: inline-block;
    width: 45%;
    margin: 8px;
    text-align: center;
  }
}
```

- [ ] **Step 6: Create `service-worker.js`**

```js
const CACHE_NAME = "store-purchase-app-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/db.js",
  "./js/logic.js",
  "./js/scan.js",
  "./js/screens/logPurchase.js",
  "./js/screens/today.js",
  "./js/screens/items.js",
  "./js/screens/labels.js",
  "./vendor/jsbarcode/JsBarcode.all.min.js",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

Note: this lists files created in later tasks (Tasks 3-9). The `serviceWorker.test.js` assertion in this task will only pass once all of those files exist — that's expected; re-run it after Task 9 to confirm, and don't be alarmed if it still fails right after this task (record that and move on, per the plan's task order).

- [ ] **Step 7: Create `index.html`**

```html
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>تسجيل مشتريات المحل</title>
  <link rel="manifest" href="manifest.json" />
  <link rel="stylesheet" href="css/styles.css" />
  <script src="vendor/jsbarcode/JsBarcode.all.min.js"></script>
</head>
<body>
  <main id="screens">
    <section id="screen-log" class="screen active"></section>
    <section id="screen-today" class="screen"></section>
    <section id="screen-items" class="screen"></section>
    <section id="screen-labels" class="screen"></section>
  </main>
  <div id="print-root" class="print-only"></div>
  <nav id="tabs">
    <button data-screen="log">تسجيل شراء</button>
    <button data-screen="today">اليوم</button>
    <button data-screen="items">الأصناف</button>
    <button data-screen="labels">الملصقات</button>
  </nav>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 8: Run manifest test to verify it passes**

Run: `node --test tests/manifest.test.js`
Expected: PASS.

(Leave `serviceWorker.test.js` failing for now — see the note in Step 6. It'll be re-checked at the end of Task 9.)

- [ ] **Step 9: Commit**

```bash
git add index.html manifest.json icons/icon.svg css/styles.css service-worker.js tests/manifest.test.js tests/serviceWorker.test.js
git commit -m "feat: add PWA app shell (HTML, manifest, styles, service worker)"
```

---

### Task 3: Vendor JsBarcode (label generation)

**Files:**
- Create: `vendor/jsbarcode/JsBarcode.all.min.js` (downloaded, pinned version)
- Test: `tests/vendorJsbarcode.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: global `JsBarcode(element, value, options)` function, loaded via the `<script src="vendor/jsbarcode/JsBarcode.all.min.js">` tag already in `index.html` (Task 2). `js/screens/labels.js` (Task 9) calls this global directly.

- [ ] **Step 1: Write the failing test**

Create `tests/vendorJsbarcode.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "..", "vendor", "jsbarcode", "JsBarcode.all.min.js");

test("vendored JsBarcode file exists and is non-trivial in size", () => {
  const stats = statSync(filePath);
  assert.ok(stats.size > 10000, `expected a real bundle, got ${stats.size} bytes`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/vendorJsbarcode.test.js`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Download the pinned library file**

```bash
mkdir -p vendor/jsbarcode
curl -L -o vendor/jsbarcode/JsBarcode.all.min.js https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/vendorJsbarcode.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vendor/jsbarcode/JsBarcode.all.min.js tests/vendorJsbarcode.test.js
git commit -m "chore: vendor JsBarcode for offline label generation"
```

---

### Task 4: IndexedDB wrapper (`js/db.js`)

**Files:**
- Create: `js/db.js`
- Test: `tests/db.shape.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `openDb(dbName?: string): Promise<IDBDatabase>`, `getAllItems(db): Promise<array>`, `getItemByBarcode(db, barcode): Promise<item|null>`, `saveItem(db, item): Promise<item>`, `deleteItem(db, id): Promise<void>`, `getAllPurchases(db): Promise<array>`, `savePurchase(db, purchase): Promise<purchase>`, `deletePurchase(db, id): Promise<void>`. All four screen modules (Tasks 6-9) import from `../db.js`.

Per the approved spec, IndexedDB *behavior* is verified manually in a real browser (Task 10), not mocked in Node — `fake-indexeddb`-style mocking was explicitly ruled out as not catching real issues. This task's automated test only checks the module's export shape (catches typos/syntax errors, doesn't test IndexedDB semantics).

- [ ] **Step 1: Write the failing test**

Create `tests/db.shape.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/db.shape.test.js`
Expected: FAIL — `Cannot find module '../js/db.js'`.

- [ ] **Step 3: Implement `js/db.js`**

```js
const DEFAULT_DB_NAME = "store_purchases_db";
const DB_VERSION = 1;

export function openDb(dbName = DEFAULT_DB_NAME) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("items")) {
        db.createObjectStore("items", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("purchases")) {
        db.createObjectStore("purchases", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function store(db, name, mode) {
  return db.transaction(name, mode).objectStore(name);
}

export function getAllItems(db) {
  return new Promise((resolve, reject) => {
    const req = store(db, "items", "readonly").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getItemByBarcode(db, barcode) {
  const items = await getAllItems(db);
  return items.find((i) => i.barcode === barcode) || null;
}

export function saveItem(db, item) {
  return new Promise((resolve, reject) => {
    const req = store(db, "items", "readwrite").put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

export function deleteItem(db, id) {
  return new Promise((resolve, reject) => {
    const req = store(db, "items", "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function getAllPurchases(db) {
  return new Promise((resolve, reject) => {
    const req = store(db, "purchases", "readonly").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function savePurchase(db, purchase) {
  return new Promise((resolve, reject) => {
    const req = store(db, "purchases", "readwrite").put(purchase);
    req.onsuccess = () => resolve(purchase);
    req.onerror = () => reject(req.error);
  });
}

export function deletePurchase(db, id) {
  return new Promise((resolve, reject) => {
    const req = store(db, "purchases", "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/db.shape.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.shape.test.js
git commit -m "feat: add IndexedDB wrapper for items and purchases"
```

---

### Task 5: Barcode scan wrapper (`js/scan.js`)

**Files:**
- Create: `js/scan.js`
- Test: `tests/scan.shape.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `isBarcodeScanSupported(): boolean`, `startBarcodeScan(videoElement, onDetected: (barcode: string) => void): Promise<() => void>` (the returned function cancels the scan and stops the camera stream). `js/screens/logPurchase.js` (Task 6) imports both.

Uses the native `BarcodeDetector` API (see the "Deviation from spec" note at the top of this plan) — no vendored library needed for scanning.

- [ ] **Step 1: Write the failing test**

Create `tests/scan.shape.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import * as scan from "../js/scan.js";

test("scan module exports the expected functions", () => {
  assert.equal(typeof scan.isBarcodeScanSupported, "function");
  assert.equal(typeof scan.startBarcodeScan, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scan.shape.test.js`
Expected: FAIL — `Cannot find module '../js/scan.js'`.

- [ ] **Step 3: Implement `js/scan.js`**

```js
export function isBarcodeScanSupported() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export async function startBarcodeScan(videoElement, onDetected) {
  const detector = new BarcodeDetector({ formats: ["code_128"] });
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
  });
  videoElement.srcObject = stream;
  await videoElement.play();

  let stopped = false;

  function stopStream() {
    stream.getTracks().forEach((track) => track.stop());
  }

  async function tick() {
    if (stopped) return;
    try {
      const barcodes = await detector.detect(videoElement);
      if (barcodes.length > 0) {
        stopped = true;
        stopStream();
        onDetected(barcodes[0].rawValue);
        return;
      }
    } catch {
      // A transient bad frame can throw; keep scanning.
    }
    requestAnimationFrame(tick);
  }

  tick();

  return function cancelScan() {
    stopped = true;
    stopStream();
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/scan.shape.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/scan.js tests/scan.shape.test.js
git commit -m "feat: add native BarcodeDetector scan wrapper"
```

---

### Task 6: Log Purchase screen

**Files:**
- Create: `js/screens/logPurchase.js`
- Test: `tests/screens.shape.test.js` (new file — Tasks 7-9 append to it)

**Interfaces:**
- Consumes: `getAllItems`, `getItemByBarcode`, `savePurchase` from `../db.js`; `filterItemsByQuery`, `calcAmount` from `../logic.js`; `isBarcodeScanSupported`, `startBarcodeScan` from `../scan.js`.
- Produces: `renderLogPurchase(container: HTMLElement, db): Promise<void>`. `js/app.js` (Task 10) imports this for the `log` tab.

- [ ] **Step 1: Write the failing test**

Create `tests/screens.shape.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { renderLogPurchase } from "../js/screens/logPurchase.js";

test("renderLogPurchase is exported as a function", () => {
  assert.equal(typeof renderLogPurchase, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/screens.shape.test.js`
Expected: FAIL — `Cannot find module '../js/screens/logPurchase.js'`.

- [ ] **Step 3: Implement `js/screens/logPurchase.js`**

```js
import { getAllItems, getItemByBarcode, savePurchase } from "../db.js";
import { filterItemsByQuery, calcAmount } from "../logic.js";
import { isBarcodeScanSupported, startBarcodeScan } from "../scan.js";

export async function renderLogPurchase(container, db) {
  const items = await getAllItems(db);
  container.innerHTML = `
    <h2>تسجيل شراء</h2>
    ${isBarcodeScanSupported() ? '<button id="scan-btn">مسح الباركود</button>' : ""}
    <video id="scan-video" playsinline style="display:none; width:100%;"></video>
    <input id="search-input" type="text" placeholder="ابحث عن صنف..." />
    <ul id="search-results"></ul>
    <div id="selected-item" style="display:none;">
      <p id="selected-name"></p>
      <label>السعر <input id="price-input" type="number" step="0.01" /></label>
      <label>الكمية <input id="qty-input" type="number" step="1" value="1" /></label>
      <button id="add-btn">إضافة</button>
    </div>
    <p id="toast" style="display:none;"></p>
    <p id="not-found" style="display:none;">صنف غير معروف</p>
  `;

  let selectedItem = null;

  function selectItem(item) {
    selectedItem = item;
    container.querySelector("#not-found").style.display = "none";
    container.querySelector("#selected-item").style.display = "block";
    container.querySelector("#selected-name").textContent = item.name;
    container.querySelector("#price-input").value = item.price;
    container.querySelector("#qty-input").value = 1;
    container.querySelector("#search-results").innerHTML = "";
    container.querySelector("#search-input").value = "";
  }

  container.querySelector("#search-input").addEventListener("input", (e) => {
    const matches = filterItemsByQuery(items, e.target.value);
    container.querySelector("#search-results").innerHTML = matches
      .map((item) => `<li data-id="${item.id}">${item.name} — ${item.price}</li>`)
      .join("");
  });

  container.querySelector("#search-results").addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    if (!li) return;
    const item = items.find((i) => i.id === li.dataset.id);
    if (item) selectItem(item);
  });

  const scanBtn = container.querySelector("#scan-btn");
  if (scanBtn) {
    scanBtn.addEventListener("click", async () => {
      const video = container.querySelector("#scan-video");
      video.style.display = "block";
      await startBarcodeScan(video, async (barcode) => {
        video.style.display = "none";
        const item = await getItemByBarcode(db, barcode);
        if (item) {
          selectItem(item);
        } else {
          container.querySelector("#not-found").style.display = "block";
        }
      });
    });
  }

  container.querySelector("#add-btn").addEventListener("click", async () => {
    if (!selectedItem) return;
    const price = parseFloat(container.querySelector("#price-input").value);
    const quantity = parseFloat(container.querySelector("#qty-input").value);
    if (!(price > 0) || !(quantity > 0)) return;
    await savePurchase(db, {
      id: crypto.randomUUID(),
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      price,
      quantity,
      amount: calcAmount(quantity, price),
      timestamp: new Date().toISOString(),
    });
    container.querySelector("#selected-item").style.display = "none";
    const toast = container.querySelector("#toast");
    toast.textContent = "تمت الإضافة";
    toast.style.display = "block";
    setTimeout(() => (toast.style.display = "none"), 1500);
    selectedItem = null;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/screens.shape.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/screens/logPurchase.js tests/screens.shape.test.js
git commit -m "feat: add Log Purchase screen (scan/search, add entry)"
```

---

### Task 7: Today screen

**Files:**
- Create: `js/screens/today.js`
- Modify: `tests/screens.shape.test.js` (append)

**Interfaces:**
- Consumes: `getAllPurchases`, `deletePurchase`, `savePurchase` from `../db.js`; `isToday`, `calcAmount`, `buildExportPayload` from `../logic.js`.
- Produces: `renderToday(container, db): Promise<void>`. `js/app.js` (Task 10) imports this for the `today` tab.

- [ ] **Step 1: Write the failing test**

Append to `tests/screens.shape.test.js`:

```js
import { renderToday } from "../js/screens/today.js";

test("renderToday is exported as a function", () => {
  assert.equal(typeof renderToday, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/screens.shape.test.js`
Expected: FAIL — `Cannot find module '../js/screens/today.js'`.

- [ ] **Step 3: Implement `js/screens/today.js`**

```js
import { getAllPurchases, deletePurchase, savePurchase } from "../db.js";
import { isToday, calcAmount, buildExportPayload } from "../logic.js";

export async function renderToday(container, db) {
  const all = await getAllPurchases(db);
  const todays = all
    .filter((p) => isToday(p.timestamp))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const total = todays.reduce((sum, p) => sum + p.amount, 0);

  container.innerHTML = `
    <h2>اليوم</h2>
    <ul id="today-list">
      ${todays
        .map(
          (p) => `<li data-id="${p.id}">
            <span>${p.itemName} — ${p.quantity} × ${p.price} = ${p.amount}</span>
            <button class="edit-btn" data-id="${p.id}">تعديل</button>
            <button class="delete-btn" data-id="${p.id}">حذف</button>
          </li>`
        )
        .join("")}
    </ul>
    <p>الإجمالي: ${total}</p>
    <button id="share-btn">مشاركة</button>
    <button id="clear-btn">مسح اليوم</button>
  `;

  container.querySelector("#today-list").addEventListener("click", async (e) => {
    const delBtn = e.target.closest(".delete-btn");
    if (delBtn) {
      if (confirm("حذف هذا الإدخال؟")) {
        await deletePurchase(db, delBtn.dataset.id);
        renderToday(container, db);
      }
      return;
    }
    const editBtn = e.target.closest(".edit-btn");
    if (editBtn) {
      const entry = todays.find((p) => p.id === editBtn.dataset.id);
      const newQty = parseFloat(prompt("الكمية:", entry.quantity));
      const newPrice = parseFloat(prompt("السعر:", entry.price));
      if (newQty > 0 && newPrice > 0) {
        entry.quantity = newQty;
        entry.price = newPrice;
        entry.amount = calcAmount(newQty, newPrice);
        await savePurchase(db, entry);
        renderToday(container, db);
      }
    }
  });

  container.querySelector("#share-btn").addEventListener("click", async () => {
    const payload = buildExportPayload(todays);
    const file = new File(
      [JSON.stringify(payload, null, 2)],
      `purchases-${new Date().toISOString().slice(0, 10)}.json`,
      { type: "application/json" }
    );
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "مشتريات اليوم" });
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  });

  container.querySelector("#clear-btn").addEventListener("click", async () => {
    if (!confirm("مسح كل إدخالات اليوم؟")) return;
    for (const p of todays) {
      await deletePurchase(db, p.id);
    }
    renderToday(container, db);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/screens.shape.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/screens/today.js tests/screens.shape.test.js
git commit -m "feat: add Today screen (list, edit, delete, share, clear)"
```

---

### Task 8: Items screen

**Files:**
- Create: `js/screens/items.js`
- Modify: `tests/screens.shape.test.js` (append)

**Interfaces:**
- Consumes: `getAllItems`, `saveItem`, `deleteItem` from `../db.js`; `nextItemId`, `filterItemsByQuery` from `../logic.js`.
- Produces: `renderItems(container, db): Promise<void>`. `js/app.js` (Task 10) imports this for the `items` tab.

- [ ] **Step 1: Write the failing test**

Append to `tests/screens.shape.test.js`:

```js
import { renderItems } from "../js/screens/items.js";

test("renderItems is exported as a function", () => {
  assert.equal(typeof renderItems, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/screens.shape.test.js`
Expected: FAIL — `Cannot find module '../js/screens/items.js'`.

- [ ] **Step 3: Implement `js/screens/items.js`**

```js
import { getAllItems, saveItem, deleteItem } from "../db.js";
import { nextItemId, filterItemsByQuery } from "../logic.js";

export async function renderItems(container, db) {
  const items = await getAllItems(db);

  container.innerHTML = `
    <h2>الأصناف</h2>
    <input id="item-search" type="text" placeholder="ابحث..." />
    <ul id="items-list">
      ${items
        .map(
          (item) => `<li data-id="${item.id}">
            ${item.name} — ${item.category} — ${item.price} — ${item.barcode}
            <button class="edit-item-btn" data-id="${item.id}">تعديل</button>
            <button class="delete-item-btn" data-id="${item.id}">حذف</button>
          </li>`
        )
        .join("")}
    </ul>
    <h3>إضافة صنف</h3>
    <label>الاسم <input id="new-name" type="text" /></label>
    <label>الفئة <input id="new-category" type="text" /></label>
    <label>السعر <input id="new-price" type="number" step="0.01" /></label>
    <button id="add-item-btn">إضافة</button>
  `;

  container.querySelector("#item-search").addEventListener("input", (e) => {
    const matches = filterItemsByQuery(items, e.target.value);
    container.querySelectorAll("#items-list li").forEach((li) => {
      li.style.display = matches.some((m) => m.id === li.dataset.id) ? "" : "none";
    });
  });

  container.querySelector("#add-item-btn").addEventListener("click", async () => {
    const name = container.querySelector("#new-name").value.trim();
    const category = container.querySelector("#new-category").value.trim();
    const price = parseFloat(container.querySelector("#new-price").value);
    if (!name || !(price > 0)) return;
    const id = nextItemId(items.map((i) => i.id));
    await saveItem(db, { id, barcode: id, name, category, price });
    renderItems(container, db);
  });

  container.querySelector("#items-list").addEventListener("click", async (e) => {
    const delBtn = e.target.closest(".delete-item-btn");
    if (delBtn) {
      if (confirm("حذف هذا الصنف؟")) {
        await deleteItem(db, delBtn.dataset.id);
        renderItems(container, db);
      }
      return;
    }
    const editBtn = e.target.closest(".edit-item-btn");
    if (editBtn) {
      const item = items.find((i) => i.id === editBtn.dataset.id);
      const newName = prompt("الاسم:", item.name);
      const newCategory = prompt("الفئة:", item.category);
      const newPrice = parseFloat(prompt("السعر:", item.price));
      if (newName && newPrice > 0) {
        item.name = newName;
        item.category = newCategory;
        item.price = newPrice;
        await saveItem(db, item);
        renderItems(container, db);
      }
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/screens.shape.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/screens/items.js tests/screens.shape.test.js
git commit -m "feat: add Items screen (add/edit/delete, auto barcode assignment)"
```

---

### Task 9: Labels screen

**Files:**
- Create: `js/screens/labels.js`
- Modify: `tests/screens.shape.test.js` (append)

**Interfaces:**
- Consumes: `getAllItems` from `../db.js`; global `JsBarcode` (from the vendored script tag in `index.html`, Task 3).
- Produces: `renderLabels(container, db): Promise<void>`. `js/app.js` (Task 10) imports this for the `labels` tab. Renders into `#print-root` (defined in `index.html`, Task 2) for print output.

- [ ] **Step 1: Write the failing test**

Append to `tests/screens.shape.test.js`:

```js
import { renderLabels } from "../js/screens/labels.js";

test("renderLabels is exported as a function", () => {
  assert.equal(typeof renderLabels, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/screens.shape.test.js`
Expected: FAIL — `Cannot find module '../js/screens/labels.js'`.

- [ ] **Step 3: Implement `js/screens/labels.js`**

```js
import { getAllItems } from "../db.js";

export async function renderLabels(container, db) {
  const items = await getAllItems(db);

  container.innerHTML = `
    <h2>الملصقات</h2>
    <label><input type="checkbox" id="select-all" /> تحديد الكل</label>
    <ul id="label-items">
      ${items
        .map(
          (item) => `<li>
            <label><input type="checkbox" class="label-check" value="${item.id}" /> ${item.name}</label>
          </li>`
        )
        .join("")}
    </ul>
    <button id="print-btn">طباعة</button>
  `;

  container.querySelector("#select-all").addEventListener("change", (e) => {
    container.querySelectorAll(".label-check").forEach((cb) => (cb.checked = e.target.checked));
  });

  container.querySelector("#print-btn").addEventListener("click", () => {
    const selectedIds = [...container.querySelectorAll(".label-check:checked")].map((cb) => cb.value);
    const selectedItems = items.filter((item) => selectedIds.includes(item.id));
    const printRoot = document.getElementById("print-root");
    printRoot.innerHTML = selectedItems
      .map(
        (item) => `<div class="label">
          <div class="label-name">${item.name}</div>
          <svg class="barcode" data-barcode="${item.barcode}"></svg>
        </div>`
      )
      .join("");
    printRoot.querySelectorAll(".barcode").forEach((svg) => {
      JsBarcode(svg, svg.dataset.barcode, { format: "CODE128", displayValue: true });
    });
    window.print();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/screens.shape.test.js`
Expected: PASS (5 tests total across the file now).

- [ ] **Step 5: Run the full test suite**

Run: `node --test tests/`
Expected: all tests PASS, including `tests/serviceWorker.test.js` (every file it lists now exists).

- [ ] **Step 6: Commit**

```bash
git add js/screens/labels.js tests/screens.shape.test.js
git commit -m "feat: add Labels screen (select items, generate and print barcode labels)"
```

---

### Task 10: Wire `js/app.js` and manually verify locally

**Files:**
- Create: `js/app.js`

**Interfaces:**
- Consumes: `openDb` from `./db.js`; `renderLogPurchase`, `renderToday`, `renderItems`, `renderLabels` from `./screens/*.js`.
- Produces: nothing further downstream — this is the app's entry point, loaded by `index.html`'s `<script type="module" src="js/app.js">`.

- [ ] **Step 1: Implement `js/app.js`**

```js
import { openDb } from "./db.js";
import { renderLogPurchase } from "./screens/logPurchase.js";
import { renderToday } from "./screens/today.js";
import { renderItems } from "./screens/items.js";
import { renderLabels } from "./screens/labels.js";

const SCREENS = {
  log: { el: document.getElementById("screen-log"), render: renderLogPurchase },
  today: { el: document.getElementById("screen-today"), render: renderToday },
  items: { el: document.getElementById("screen-items"), render: renderItems },
  labels: { el: document.getElementById("screen-labels"), render: renderLabels },
};

let db;

async function showScreen(name) {
  for (const [key, screen] of Object.entries(SCREENS)) {
    screen.el.classList.toggle("active", key === name);
  }
  await SCREENS[name].render(SCREENS[name].el, db);
}

document.getElementById("tabs").addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-screen]");
  if (!btn) return;
  showScreen(btn.dataset.screen);
});

async function main() {
  db = await openDb();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
  await showScreen("log");
}

main();
```

- [ ] **Step 2: Serve the app locally over `localhost`**

Browsers treat `localhost` as a secure context, so camera access and the service worker both work here without deploying anything yet.

Run (from the project root):
```bash
python -m http.server 8000
```

Open `http://localhost:8000/` in a desktop Chrome/Edge browser (needed for `BarcodeDetector` support).

- [ ] **Step 3: Manually verify the full flow**

Walk through and confirm each of these works:
- Items tab: add a test item (name/category/price) — appears in the list with an auto-generated `IT-0001`-style barcode.
- Log Purchase tab: search for the item by name, tap it, confirm price is pre-filled and editable, set a quantity, tap "إضافة" — toast confirms, form resets.
- If your desktop browser supports `BarcodeDetector` (check DevTools console: `"BarcodeDetector" in window`): tap "مسح الباركود", allow camera access, point at a printed/on-screen Code128 barcode matching an item's `barcode` value, confirm it auto-selects that item. If unsupported, confirm the button doesn't render at all and search-based selection still works.
- Today tab: confirm the entry appears with the correct amount and running total; edit it (quantity/price via the prompt dialogs) and confirm it updates; add a second entry and delete one via "حذف".
- Today tab: tap "مشاركة" — confirm either the native share sheet opens (if supported) or a JSON file downloads; open the file and confirm it's valid JSON shaped like the `buildExportPayload` output.
- Today tab: tap "مسح اليوم", confirm the confirmation prompt, confirm entries clear after accepting.
- Labels tab: select an item, tap "طباعة", confirm the browser print preview shows the item name and a rendered barcode image.
- DevTools > Application > Service Workers: confirm the service worker registered successfully; DevTools > Application > IndexedDB: confirm `store_purchases_db` has `items` and `purchases` object stores with the expected data.

If any step fails, fix the relevant screen/module file and re-verify — don't proceed to Task 11 until this full walkthrough passes.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: wire screens into tab navigation, bootstrap IndexedDB and service worker"
```

---

### Task 11: Deploy to GitHub Pages

**Files:** none (deployment only).

This task creates a GitHub repository and pushes code to it — an action visible to others and not easily reversed. **Stop and get explicit confirmation from the user before running any step in this task** (repo name, public/private, and confirmation they want it pushed now).

- [ ] **Step 1: Confirm with the user**

Ask: repo name, public or private, and confirm they want to proceed with creating it and pushing now.

- [ ] **Step 2: Initialize git (if not already done) and make the initial commit**

```bash
git init
git add -A
git commit -m "feat: initial barcode purchase logging PWA"
```

(Skip if Tasks 1-10 were already committed incrementally with git available throughout.)

- [ ] **Step 3: Create the GitHub repository and push**

```bash
gh repo create <repo-name> --public --source=. --remote=origin --push
```

(Use `--private` instead of `--public` per the user's answer in Step 1.)

- [ ] **Step 4: Enable GitHub Pages**

```bash
gh api repos/:owner/<repo-name>/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

If this fails (Pages may need to be enabled via repo Settings > Pages the first time instead of the API), direct the user to do it manually: Settings > Pages > Source: Deploy from branch > `main` / `/ (root)`.

- [ ] **Step 5: Verify on a real phone**

Once Pages finishes building (check `gh api repos/:owner/<repo-name>/pages` or the Settings > Pages UI for the live URL), open the URL on the buyer's actual phone, confirm the camera scan works (this is the real test the localhost verification in Task 10 couldn't fully cover — real device, real camera, real lighting conditions in the market), and confirm "Add to Home Screen" installs it.

No automated test for this task — it's inherently a real-device, real-network verification step.

## Self-Review Notes

- **Spec coverage:** all four screens, the data model, offline/PWA mechanics, and the barcode label generator from the spec are covered (Tasks 2-3, 4, 6-9, 10). The one deviation (native `BarcodeDetector` instead of vendored ZXing) is called out explicitly at the top of this plan and must be flagged to the user before Task 5 executes.
- **Type/interface consistency:** checked that every screen module's imports (`getAllItems`, `saveItem`, `nextItemId`, etc.) match the exact export names defined in `js/db.js` (Task 4) and `js/logic.js` (Task 1); `js/app.js` (Task 10) imports the exact `renderX` function names defined in Tasks 6-9.
- **No placeholders:** every step has literal file contents or exact commands; the two spots that depend on later tasks (the service-worker asset list in Task 2, and `tests/screens.shape.test.js` growing across Tasks 6-9) are called out explicitly rather than hidden.
- **Testing approach matches the approved spec:** pure logic gets real unit tests (Task 1); IndexedDB/scan/screens get lightweight "does it export the right shape" checks (catches syntax/typo errors) plus one comprehensive manual walkthrough (Task 10) instead of mocked behavioral tests, matching the spec's explicit reasoning for avoiding heavy mocking.
