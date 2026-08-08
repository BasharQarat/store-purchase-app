# Items: Scan-to-Add Barcode + JSON Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the buyer scan a barcode when adding a new item on the Items tab, and export the current IndexedDB item list as a downloadable `seed-items.json` so it can be copied back into the repo.

**Architecture:** Two new pure-logic helpers in `js/logic.js` (barcode lookup, export shaping), one new tiny shared module `js/download.js` (extracted from the existing Today-screen download code, reused by both screens), and edits to `js/screens/items.js` to wire up the barcode field/scan button, duplicate-barcode redirect, and export button. `service-worker.js` gets the new file added to its offline cache list.

**Tech Stack:** Vanilla JS (ES modules), `node:test` for unit tests, existing `startBarcodeScan`/`isBarcodeScanSupported` from `js/scan.js` (BarcodeDetector + camera, unchanged).

## Global Constraints

- No backend/server — stays fully static/client-side (per both design docs).
- `data/seed-items.json` shape is fixed and test-enforced by `tests/seedItems.test.js`: every item needs string `id`, `barcode`, `name`, `category`, and **number** `price` and `purchase_price`. The export payload must produce this exact shape.
- `id` stays auto-sequential via existing `nextItemId`; it is independent from `barcode` after this change.
- Barcode uniqueness: if the add form's barcode matches an existing item, redirect to editing that existing item instead of creating a duplicate.
- Export is manual/on-demand only (a button), not automatic on every change.
- Follow existing code style: no framework, template-string rendering, `container.querySelector` + `addEventListener` wiring, Arabic UI copy matching existing screens' tone.

---

### Task 1: `findItemByBarcode` and `buildItemsExportPayload` in `js/logic.js`

**Files:**
- Modify: `js/logic.js`
- Test: `tests/logic.test.js`

**Interfaces:**
- Produces: `findItemByBarcode(items: Array<{barcode: string}>, barcode: string): object | null`
- Produces: `buildItemsExportPayload(items: Array<{id, barcode, name, category, price, purchase_price?}>): Array<{id, barcode, name, category, price, purchase_price}>` — `purchase_price` falls back to `price` when the stored item doesn't have one (new items created via the Add Item form don't collect `purchase_price`).

- [ ] **Step 1: Write the failing tests**

Add to `tests/logic.test.js` (extend the existing import list at the top to include `findItemByBarcode, buildItemsExportPayload`):

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `findItemByBarcode is not a function` / `buildItemsExportPayload is not a function`.

- [ ] **Step 3: Implement in `js/logic.js`**

Add at the end of `js/logic.js`:

```js
export function findItemByBarcode(items, barcode) {
  return items.find((item) => item.barcode === barcode) || null;
}

export function buildItemsExportPayload(items) {
  return items.map((item) => ({
    id: item.id,
    barcode: item.barcode,
    name: item.name,
    category: item.category,
    price: item.price,
    purchase_price: item.purchase_price ?? item.price,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests including the 4 new ones green.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.test.js
git commit -m "feat: add barcode lookup and items export shaping to logic.js"
```

---

### Task 2: Extract `triggerDownload` into `js/download.js`, reuse in Today screen

**Files:**
- Create: `js/download.js`
- Modify: `js/screens/today.js:1,53-82`
- Test: `tests/download.shape.test.js` (new)

**Interfaces:**
- Produces: `triggerDownload(file: File): void` — creates an object URL for `file`, clicks a throwaway `<a download>`, revokes the URL. Pure DOM side effect, no return value.
- Consumes (Task 3/4 will use this too): same `triggerDownload(file)` signature.

- [ ] **Step 1: Write the failing shape test**

Create `tests/download.shape.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import * as download from "../js/download.js";

test("download module exports triggerDownload as a function", () => {
  assert.equal(typeof download.triggerDownload, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../js/download.js`.

- [ ] **Step 3: Create `js/download.js`**

```js
export function triggerDownload(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Update `js/screens/today.js` to use it**

In `js/screens/today.js`, change the top import (line 1) from:

```js
import { getAllPurchases, deletePurchase, savePurchase } from "../db.js";
```

to:

```js
import { getAllPurchases, deletePurchase, savePurchase } from "../db.js";
import { triggerDownload } from "../download.js";
```

Then in the `#share-btn` click handler, replace the local `downloadFile` function and its calls. Before:

```js
    function downloadFile() {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "مشتريات اليوم" });
      } catch (err) {
        if (err.name !== "AbortError") {
          downloadFile();
        }
      }
    } else {
      downloadFile();
    }
```

After:

```js
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "مشتريات اليوم" });
      } catch (err) {
        if (err.name !== "AbortError") {
          triggerDownload(file);
        }
      }
    } else {
      triggerDownload(file);
    }
```

- [ ] **Step 5: Run tests to verify everything passes**

Run: `npm test`
Expected: PASS (new shape test plus all existing tests, including `tests/screens.shape.test.js` which still imports `renderToday` successfully).

- [ ] **Step 6: Commit**

```bash
git add js/download.js js/screens/today.js tests/download.shape.test.js
git commit -m "refactor: extract triggerDownload helper, reuse from Today screen"
```

---

### Task 3: Add barcode field + scan button + duplicate redirect to Add Item form

**Files:**
- Modify: `js/screens/items.js`

**Interfaces:**
- Consumes: `findItemByBarcode(items, barcode)` from Task 1 (`js/logic.js`); `isBarcodeScanSupported()`, `startBarcodeScan(videoElement, onDetected)` from `js/scan.js` (existing, same signatures as used in `js/screens/logPurchase.js`).

- [ ] **Step 1: Update imports at the top of `js/screens/items.js`**

Before:

```js
import { getAllItems, saveItem, deleteItem } from "../db.js";
import { nextItemId, filterItemsByQuery } from "../logic.js";
```

After:

```js
import { getAllItems, saveItem, deleteItem } from "../db.js";
import { nextItemId, filterItemsByQuery, findItemByBarcode } from "../logic.js";
import { isBarcodeScanSupported, startBarcodeScan } from "../scan.js";
```

- [ ] **Step 2: Add the barcode input, scan button, and scan video to the template**

In the `container.innerHTML` template, after the `السعر` label and before the `#add-item-btn` button, add:

```html
    <label>الباركود <input id="new-barcode" type="text" /></label>
    ${isBarcodeScanSupported() ? '<button id="scan-item-btn" type="button">مسح الباركود</button>' : ""}
    <video id="item-scan-video" playsinline style="display:none; width:100%;"></video>
```

So the full block reads:

```js
    <h3>إضافة صنف</h3>
    <label>الاسم <input id="new-name" type="text" /></label>
    <label>الفئة <input id="new-category" type="text" /></label>
    <label>السعر <input id="new-price" type="number" step="0.01" /></label>
    <label>الباركود <input id="new-barcode" type="text" /></label>
    ${isBarcodeScanSupported() ? '<button id="scan-item-btn" type="button">مسح الباركود</button>' : ""}
    <video id="item-scan-video" playsinline style="display:none; width:100%;"></video>
    <button id="add-item-btn">إضافة</button>
```

- [ ] **Step 3: Extract the existing edit-prompt logic into a reusable function**

Before (current edit branch inside the `#items-list` click handler):

```js
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
```

Replace the whole `renderItems` function body's click handler section with a version that calls a new top-level-in-function helper `editItemPrompt`, defined once before the handlers are wired up (right after the `container.querySelector("#item-search")` block):

```js
  async function editItemPrompt(item) {
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
```

And simplify the edit branch in the `#items-list` click handler to:

```js
    const editBtn = e.target.closest(".edit-item-btn");
    if (editBtn) {
      const item = items.find((i) => i.id === editBtn.dataset.id);
      await editItemPrompt(item);
    }
```

- [ ] **Step 4: Wire up the scan button**

Add this block after the search-input wiring and before (or after) the `editItemPrompt` definition — order relative to `editItemPrompt` doesn't matter, both are defined before `#add-item-btn`'s handler runs:

```js
  const scanBtn = container.querySelector("#scan-item-btn");
  if (scanBtn) {
    scanBtn.addEventListener("click", async () => {
      const video = container.querySelector("#item-scan-video");
      video.style.display = "block";
      await startBarcodeScan(video, (barcode) => {
        video.style.display = "none";
        container.querySelector("#new-barcode").value = barcode;
      });
    });
  }
```

- [ ] **Step 5: Update the Add Item handler to read the barcode field and redirect on duplicates**

Before:

```js
  container.querySelector("#add-item-btn").addEventListener("click", async () => {
    const name = container.querySelector("#new-name").value.trim();
    const category = container.querySelector("#new-category").value.trim();
    const price = parseFloat(container.querySelector("#new-price").value);
    if (!name || !(price > 0)) return;
    const id = nextItemId(items.map((i) => i.id));
    await saveItem(db, { id, barcode: id, name, category, price });
    renderItems(container, db);
  });
```

After:

```js
  container.querySelector("#add-item-btn").addEventListener("click", async () => {
    const name = container.querySelector("#new-name").value.trim();
    const category = container.querySelector("#new-category").value.trim();
    const price = parseFloat(container.querySelector("#new-price").value);
    const barcode = container.querySelector("#new-barcode").value.trim();
    if (!name || !(price > 0)) return;

    if (barcode) {
      const existing = findItemByBarcode(items, barcode);
      if (existing) {
        await editItemPrompt(existing);
        return;
      }
    }

    const id = nextItemId(items.map((i) => i.id));
    await saveItem(db, { id, barcode, name, category, price });
    renderItems(container, db);
  });
```

- [ ] **Step 6: Run tests to verify nothing broke**

Run: `npm test`
Expected: PASS — `tests/screens.shape.test.js` still passes (`renderItems` still exports as a function); no other test touches `items.js` internals yet.

- [ ] **Step 7: Commit**

```bash
git add js/screens/items.js
git commit -m "feat: scan barcode when adding an item, redirect duplicates to edit"
```

---

### Task 4: Export items as `seed-items.json`

**Files:**
- Modify: `js/screens/items.js`

**Interfaces:**
- Consumes: `buildItemsExportPayload(items)` from Task 1 (`js/logic.js`); `triggerDownload(file)` from Task 2 (`js/download.js`).

- [ ] **Step 1: Add the import**

Update the `logic.js` import line from Task 3's version:

```js
import { nextItemId, filterItemsByQuery, findItemByBarcode } from "../logic.js";
```

to:

```js
import { nextItemId, filterItemsByQuery, findItemByBarcode, buildItemsExportPayload } from "../logic.js";
```

And add a new import line:

```js
import { triggerDownload } from "../download.js";
```

- [ ] **Step 2: Add the export button to the template**

At the top of the template, right after the `<h2>الأصناف</h2>` line, add:

```html
    <button id="export-items-btn" type="button">تصدير JSON</button>
```

So the template starts:

```js
  container.innerHTML = `
    <h2>الأصناف</h2>
    <button id="export-items-btn" type="button">تصدير JSON</button>
    <input id="item-search" type="text" placeholder="ابحث..." />
```

- [ ] **Step 3: Wire up the export button**

Add near the other event listener wiring (e.g. right after the search-input listener):

```js
  container.querySelector("#export-items-btn").addEventListener("click", () => {
    const payload = buildItemsExportPayload(items);
    const file = new File(
      [JSON.stringify(payload, null, 2)],
      "seed-items.json",
      { type: "application/json" }
    );
    triggerDownload(file);
  });
```

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `npm test`
Expected: PASS — all existing tests green, including `tests/screens.shape.test.js`.

- [ ] **Step 5: Commit**

```bash
git add js/screens/items.js
git commit -m "feat: add JSON export button to Items screen"
```

---

### Task 5: Register `js/download.js` with the service worker

**Files:**
- Modify: `service-worker.js:1,10`

**Interfaces:**
- None (config-only change). `tests/serviceWorker.test.js` verifies every listed asset exists on disk.

- [ ] **Step 1: Bump the cache name and add the new asset**

Before:

```js
const CACHE_NAME = "store-purchase-app-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./css/fonts.css",
  "./data/seed-items.json",
  "./js/app.js",
  "./js/db.js",
  "./js/logic.js",
  "./js/scan.js",
  "./js/screens/logPurchase.js",
```

After:

```js
const CACHE_NAME = "store-purchase-app-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./css/fonts.css",
  "./data/seed-items.json",
  "./js/app.js",
  "./js/db.js",
  "./js/download.js",
  "./js/logic.js",
  "./js/scan.js",
  "./js/screens/logPurchase.js",
```

(Rest of the `ASSETS` array is unchanged.)

- [ ] **Step 2: Run tests to verify**

Run: `npm test`
Expected: PASS — `tests/serviceWorker.test.js` confirms `./js/download.js` exists on disk (created in Task 2).

- [ ] **Step 3: Commit**

```bash
git add service-worker.js
git commit -m "chore: cache js/download.js in service worker, bump cache version"
```

---

## Manual Verification (after all tasks)

Automated tests cover pure logic only; camera scanning, the DOM download flow, and IndexedDB behavior need a real browser (per the original design doc's testing approach). After implementing:

1. Serve the app locally (e.g. `npx http-server .` or any static server) and open it in Chrome (desktop or Android — `BarcodeDetector` support required for the scan button to appear).
2. Go to الأصناف (Items) tab, tap مسح الباركود in the Add Item form, scan a barcode (or a printed one from the Labels tab), confirm it fills the الباركود field.
3. Add the item, confirm it appears in the list with the scanned barcode.
4. Try adding another item with the same barcode — confirm it opens the edit prompts for the existing item instead of creating a duplicate.
5. Tap تصدير JSON, confirm a `seed-items.json` file downloads containing the full current item list in the correct shape (spot-check `purchase_price` is present even for the newly added item).
6. Reload with network disabled (offline) to confirm the service worker still serves the app shell correctly after the cache version bump.
