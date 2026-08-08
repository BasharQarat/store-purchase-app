# Purchase Cart, Easier Quantity, and Inline Item Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `purchase_price` field and inline (non-`prompt()`) add/edit form to the Items tab, and turn Log Purchase's single-item selection into a multi-line cart with a quantity stepper.

**Architecture:** Five new pure helpers in `js/logic.js` (cart add/increment/update/remove/total/shape-for-save) drive a rewritten `js/screens/logPurchase.js` cart UI. `js/screens/items.js` gains an `editingId`-tracked inline edit mode replacing the old `prompt()` chain, plus a `purchase_price` field and a form reposition. `css/styles.css` gets new rules for the cart rows/stepper and the form's cancel button.

**Tech Stack:** Vanilla JS (ES modules), `node:test`. No new libraries.

## Global Constraints

- No backend/server.
- `data/seed-items.json` shape unchanged; `purchase_price` already flows through `buildItemsExportPayload` (existing fallback to `price` when absent) — just need the form to be able to set it.
- Barcode stays read-only once an item exists (tied to a printed label) — enforced by making the barcode input `readOnly` while `editingId` is set, but still settable via rescan (JS `.value` assignment bypasses `readOnly`, intentionally, so a wrong barcode can be corrected by rescanning without allowing free typing).
- Screen re-render after save/delete follows the existing pattern in this codebase (`renderItems(container, db)` / re-fetch), not partial DOM patching, except where noted (cart re-render is partial, since a full re-fetch would be wasteful mid-cart-building and isn't needed — items list doesn't change while building a purchase cart).

---

### Task 1: Cart pure logic helpers in `js/logic.js`

**Files:**
- Modify: `js/logic.js`
- Test: `tests/logic.test.js`

**Interfaces:**
- Produces: `addOrIncrementCartLine(cart: Line[], item: {id, name, price}): Line[]` where `Line = {itemId, itemName, price, quantity}`
- Produces: `updateCartLine(cart: Line[], itemId: string, patch: Partial<Line>): Line[]`
- Produces: `removeCartLine(cart: Line[], itemId: string): Line[]`
- Produces: `cartTotal(cart: Line[]): number`
- Produces: `buildPurchasesFromCart(cart: Line[], timestamp?: string): Purchase[]` — `Purchase` matches the existing shape saved by `savePurchase` (`id, itemId, itemName, price, quantity, amount, timestamp`)

- [ ] **Step 1: Write the failing tests**

Add to `tests/logic.test.js` (extend the top import list to include the five new names):

```js
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test` — expect `addOrIncrementCartLine is not a function` etc.

- [ ] **Step 3: Implement in `js/logic.js`** (append after `buildItemsExportPayload`)

```js
export function addOrIncrementCartLine(cart, item) {
  const idx = cart.findIndex((line) => line.itemId === item.id);
  if (idx === -1) {
    return [...cart, { itemId: item.id, itemName: item.name, price: item.price, quantity: 1 }];
  }
  return cart.map((line, i) => (i === idx ? { ...line, quantity: line.quantity + 1 } : line));
}

export function updateCartLine(cart, itemId, patch) {
  return cart.map((line) => (line.itemId === itemId ? { ...line, ...patch } : line));
}

export function removeCartLine(cart, itemId) {
  return cart.filter((line) => line.itemId !== itemId);
}

export function cartTotal(cart) {
  return cart.reduce((sum, line) => sum + calcAmount(line.quantity, line.price), 0);
}

export function buildPurchasesFromCart(cart, timestamp = new Date().toISOString()) {
  return cart.map((line) => ({
    id: crypto.randomUUID(),
    itemId: line.itemId,
    itemName: line.itemName,
    price: line.price,
    quantity: line.quantity,
    amount: calcAmount(line.quantity, line.price),
    timestamp,
  }));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test` — expect all green (existing 25 + 7 new = 32).

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.test.js
git commit -m "feat: add cart pure-logic helpers to logic.js"
```

---

### Task 2: Log Purchase — cart UI

**Files:**
- Modify: `js/screens/logPurchase.js` (full rewrite of the render function body)
- Modify: `css/styles.css` (append new rules)

**Interfaces:**
- Consumes: `addOrIncrementCartLine`, `updateCartLine`, `removeCartLine`, `cartTotal`, `buildPurchasesFromCart` from Task 1 (`js/logic.js`); existing `filterItemsByQuery`, `calcAmount`; existing `getAllItems`, `getItemByBarcode`, `savePurchase` from `js/db.js`; existing `isBarcodeScanSupported`, `startBarcodeScan` from `js/scan.js`.

- [ ] **Step 1: Replace `js/screens/logPurchase.js` in full**

```js
import { getAllItems, getItemByBarcode, savePurchase } from "../db.js";
import {
  filterItemsByQuery,
  calcAmount,
  addOrIncrementCartLine,
  updateCartLine,
  removeCartLine,
  cartTotal,
  buildPurchasesFromCart,
} from "../logic.js";
import { isBarcodeScanSupported, startBarcodeScan } from "../scan.js";

export async function renderLogPurchase(container, db) {
  const items = await getAllItems(db);
  container.innerHTML = `
    <h2>تسجيل شراء</h2>
    ${isBarcodeScanSupported() ? '<button id="scan-btn">مسح الباركود</button>' : ""}
    <video id="scan-video" playsinline style="display:none; width:100%;"></video>
    <input id="search-input" type="text" placeholder="ابحث عن صنف..." />
    <ul id="search-results"></ul>
    <p id="not-found" style="display:none;">صنف غير معروف</p>

    <h3>السلة</h3>
    <p id="cart-empty">امسح أو ابحث عن صنف لإضافته</p>
    <ul id="cart-list"></ul>
    <p id="cart-total-row" style="display:none;">الإجمالي: <span class="amount" id="cart-total">0</span></p>
    <button id="save-cart-btn" style="display:none;">حفظ الكل</button>

    <p id="toast" style="display:none;"></p>
  `;

  let cart = [];
  let lastUpdatedItemId = null;

  function renderCart() {
    const listEl = container.querySelector("#cart-list");
    const emptyEl = container.querySelector("#cart-empty");
    const totalRow = container.querySelector("#cart-total-row");
    const saveBtn = container.querySelector("#save-cart-btn");

    if (cart.length === 0) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      totalRow.style.display = "none";
      saveBtn.style.display = "none";
      return;
    }

    emptyEl.style.display = "none";
    totalRow.style.display = "block";
    saveBtn.style.display = "block";

    listEl.innerHTML = cart
      .map(
        (line) => `<li class="ticket cart-line${line.itemId === lastUpdatedItemId ? " cart-line-updated" : ""}" data-item-id="${line.itemId}">
          <div class="cart-line-top">
            <span class="cart-line-name">${line.itemName}</span>
            <button type="button" class="remove-cart-line-btn" data-item-id="${line.itemId}">حذف</button>
          </div>
          <div class="cart-line-controls">
            <label class="cart-price-label">السعر
              <input type="number" step="0.01" class="cart-price-input" data-item-id="${line.itemId}" value="${line.price}" />
            </label>
            <div class="qty-stepper">
              <button type="button" class="qty-decrement" data-item-id="${line.itemId}" aria-label="إنقاص الكمية">−</button>
              <input type="number" step="1" class="cart-qty-input" data-item-id="${line.itemId}" value="${line.quantity}" />
              <button type="button" class="qty-increment" data-item-id="${line.itemId}" aria-label="زيادة الكمية">+</button>
            </div>
          </div>
          <p class="cart-line-amount">المجموع: <span class="amount">${calcAmount(line.quantity, line.price)}</span></p>
        </li>`
      )
      .join("");

    container.querySelector("#cart-total").textContent = cartTotal(cart);
    lastUpdatedItemId = null;
  }

  function addItemToCart(item) {
    cart = addOrIncrementCartLine(cart, item);
    lastUpdatedItemId = item.id;
    container.querySelector("#not-found").style.display = "none";
    container.querySelector("#search-results").innerHTML = "";
    container.querySelector("#search-input").value = "";
    renderCart();
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
    if (item) addItemToCart(item);
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
          addItemToCart(item);
        } else {
          container.querySelector("#not-found").style.display = "block";
        }
      });
    });
  }

  container.querySelector("#cart-list").addEventListener("click", (e) => {
    const removeBtn = e.target.closest(".remove-cart-line-btn");
    if (removeBtn) {
      cart = removeCartLine(cart, removeBtn.dataset.itemId);
      renderCart();
      return;
    }
    const decBtn = e.target.closest(".qty-decrement");
    if (decBtn) {
      const line = cart.find((l) => l.itemId === decBtn.dataset.itemId);
      if (line) {
        cart = updateCartLine(cart, line.itemId, { quantity: Math.max(1, line.quantity - 1) });
        renderCart();
      }
      return;
    }
    const incBtn = e.target.closest(".qty-increment");
    if (incBtn) {
      const line = cart.find((l) => l.itemId === incBtn.dataset.itemId);
      if (line) {
        cart = updateCartLine(cart, line.itemId, { quantity: line.quantity + 1 });
        renderCart();
      }
    }
  });

  container.querySelector("#cart-list").addEventListener("change", (e) => {
    const qtyInput = e.target.closest(".cart-qty-input");
    if (qtyInput) {
      const quantity = parseFloat(qtyInput.value);
      if (quantity > 0) {
        cart = updateCartLine(cart, qtyInput.dataset.itemId, { quantity });
        renderCart();
      }
      return;
    }
    const priceInput = e.target.closest(".cart-price-input");
    if (priceInput) {
      const price = parseFloat(priceInput.value);
      if (price > 0) {
        cart = updateCartLine(cart, priceInput.dataset.itemId, { price });
        renderCart();
      }
    }
  });

  container.querySelector("#save-cart-btn").addEventListener("click", async () => {
    if (cart.length === 0) return;
    const purchases = buildPurchasesFromCart(cart);
    for (const purchase of purchases) {
      await savePurchase(db, purchase);
    }
    const count = cart.length;
    cart = [];
    renderCart();
    const toast = container.querySelector("#toast");
    toast.textContent = `تمت إضافة ${count} عنصر`;
    toast.style.display = "block";
    setTimeout(() => (toast.style.display = "none"), 1500);
  });

  renderCart();
}
```

- [ ] **Step 2: Append cart CSS to `css/styles.css`**

```css
/* Purchase cart */

#cart-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.cart-line-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cart-line-name {
  font-weight: 700;
  font-size: 1.05rem;
}

.cart-line-controls {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  margin-top: 8px;
}

.cart-price-label {
  flex: 1;
  margin: 0;
}

.cart-price-label input {
  margin: 4px 0 0;
}

.qty-stepper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.qty-stepper button {
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border-radius: 999px;
  font-size: 1.3rem;
  line-height: 1;
}

.qty-stepper input {
  width: 56px;
  text-align: center;
  margin: 0;
}

.cart-line-amount {
  margin: 10px 0 0;
  font-weight: 500;
}

.cart-line-updated {
  box-shadow: 0 0 0 2px var(--teal);
}

.remove-cart-line-btn {
  background: transparent;
  border-color: var(--sumac);
  color: var(--sumac-dark);
  min-height: 40px;
  padding: 0 14px;
  font-size: 0.85rem;
}

.remove-cart-line-btn:hover {
  background: var(--sumac);
  color: var(--paper);
}

#cart-empty {
  color: var(--ink-soft);
  font-size: 0.9rem;
}

#save-cart-btn {
  display: block;
  width: 100%;
  min-height: 56px;
  font-size: 1.15rem;
  background: var(--teal);
  border-color: var(--teal);
  color: var(--paper);
}

#save-cart-btn:hover {
  background: var(--teal-dark);
  border-color: var(--teal-dark);
}

#cart-total-row {
  font-weight: 700;
  margin: 14px 0 6px;
}
```

- [ ] **Step 3: Run tests**

Run: `npm test` — expect all pass (screen shape test just checks `renderLogPurchase` is a function; no regression expected).

- [ ] **Step 4: Commit**

```bash
git add js/screens/logPurchase.js css/styles.css
git commit -m "feat: replace single-item selection with a multi-line purchase cart"
```

---

### Task 3: Items — purchase_price field, top-of-page form, inline add/edit

**Files:**
- Modify: `js/screens/items.js` (full rewrite of the render function body)
- Modify: `css/styles.css` (append new rules)

**Interfaces:**
- Consumes: `findItemByBarcode`, `buildItemsExportPayload`, `nextItemId`, `filterItemsByQuery` (existing, `js/logic.js`); `isBarcodeScanSupported`, `startBarcodeScan` (`js/scan.js`); `triggerDownload` (`js/download.js`); `getAllItems`, `saveItem`, `deleteItem` (`js/db.js`).

- [ ] **Step 1: Replace `js/screens/items.js` in full**

```js
import { getAllItems, saveItem, deleteItem } from "../db.js";
import {
  nextItemId,
  filterItemsByQuery,
  findItemByBarcode,
  buildItemsExportPayload,
} from "../logic.js";
import { isBarcodeScanSupported, startBarcodeScan } from "../scan.js";
import { triggerDownload } from "../download.js";

export async function renderItems(container, db) {
  const items = await getAllItems(db);
  let editingId = null;

  container.innerHTML = `
    <h2>الأصناف</h2>
    <button id="export-items-btn" type="button">تصدير JSON</button>

    <div class="ticket" id="item-form-card">
      <h3 id="item-form-title">إضافة صنف</h3>
      <label>الاسم <input id="new-name" type="text" /></label>
      <label>الفئة <input id="new-category" type="text" /></label>
      <label>سعر البيع <input id="new-price" type="number" step="0.01" /></label>
      <label>سعر الشراء <input id="new-purchase-price" type="number" step="0.01" /></label>
      <label>الباركود <input id="new-barcode" type="text" /></label>
      ${isBarcodeScanSupported() ? '<button id="scan-item-btn" type="button">مسح الباركود</button>' : ""}
      <video id="item-scan-video" playsinline style="display:none; width:100%;"></video>
      <div class="item-form-actions">
        <button id="add-item-btn" type="button">إضافة</button>
        <button id="cancel-edit-btn" type="button" style="display:none;">إلغاء</button>
      </div>
    </div>

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
  `;

  function fillForm(item) {
    container.querySelector("#new-name").value = item.name;
    container.querySelector("#new-category").value = item.category;
    container.querySelector("#new-price").value = item.price;
    container.querySelector("#new-purchase-price").value = item.purchase_price ?? "";
    container.querySelector("#new-barcode").value = item.barcode;
  }

  function enterEditMode(item) {
    editingId = item.id;
    fillForm(item);
    container.querySelector("#item-form-title").textContent = "تعديل صنف";
    container.querySelector("#add-item-btn").textContent = "حفظ التعديل";
    container.querySelector("#cancel-edit-btn").style.display = "";
    container.querySelector("#new-barcode").readOnly = true;
    container.querySelector("#item-form-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  container.querySelector("#item-search").addEventListener("input", (e) => {
    const matches = filterItemsByQuery(items, e.target.value);
    container.querySelectorAll("#items-list li").forEach((li) => {
      li.style.display = matches.some((m) => m.id === li.dataset.id) ? "" : "none";
    });
  });

  container.querySelector("#export-items-btn").addEventListener("click", () => {
    const payload = buildItemsExportPayload(items);
    const file = new File(
      [JSON.stringify(payload, null, 2)],
      "seed-items.json",
      { type: "application/json" }
    );
    triggerDownload(file);
  });

  const scanBtn = container.querySelector("#scan-item-btn");
  if (scanBtn) {
    scanBtn.addEventListener("click", async () => {
      const video = container.querySelector("#item-scan-video");
      video.style.display = "block";
      await startBarcodeScan(video, (barcode) => {
        video.style.display = "none";
        container.querySelector("#new-barcode").value = barcode;
        const existing = findItemByBarcode(items, barcode);
        if (existing) {
          enterEditMode(existing);
        }
      });
    });
  }

  container.querySelector("#cancel-edit-btn").addEventListener("click", () => {
    renderItems(container, db);
  });

  container.querySelector("#add-item-btn").addEventListener("click", async () => {
    const name = container.querySelector("#new-name").value.trim();
    const category = container.querySelector("#new-category").value.trim();
    const price = parseFloat(container.querySelector("#new-price").value);
    const purchasePrice = parseFloat(container.querySelector("#new-purchase-price").value);
    const barcode = container.querySelector("#new-barcode").value.trim();
    if (!name || !(price > 0)) return;

    if (editingId) {
      const item = items.find((i) => i.id === editingId);
      item.name = name;
      item.category = category;
      item.price = price;
      item.purchase_price = purchasePrice > 0 ? purchasePrice : undefined;
      await saveItem(db, item);
      renderItems(container, db);
      return;
    }

    if (barcode) {
      const existing = findItemByBarcode(items, barcode);
      if (existing) {
        enterEditMode(existing);
        return;
      }
    }

    const id = nextItemId(items.map((i) => i.id));
    await saveItem(db, {
      id,
      barcode,
      name,
      category,
      price,
      purchase_price: purchasePrice > 0 ? purchasePrice : undefined,
    });
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
      enterEditMode(item);
    }
  });
}
```

- [ ] **Step 2: Append form/edit-mode CSS to `css/styles.css`**

```css
/* Item add/edit form */

.item-form-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

#cancel-edit-btn {
  background: transparent;
  border-color: var(--ink-soft);
  color: var(--ink-soft);
}

#cancel-edit-btn:hover {
  background: var(--ink-soft);
  color: var(--paper);
}

input[readonly] {
  background: var(--bg);
  color: var(--ink-soft);
}
```

- [ ] **Step 3: Run tests**

Run: `npm test` — expect all pass (screen shape test only checks `renderItems` is a function).

- [ ] **Step 4: Commit**

```bash
git add js/screens/items.js css/styles.css
git commit -m "feat: inline add/edit form with purchase price, moved to top of Items tab"
```

---

## Manual Verification (after all tasks)

1. Serve locally, open Log Purchase: scan/search item A (row appears, qty 1), scan/search item A again (same row's quantity becomes 2, briefly highlighted), scan a different item B (new row, qty 1). Adjust B's quantity with +/-. Tap حفظ الكل — confirm both rows land as separate entries on the Today tab, cart clears.
2. Items tab: confirm the form is above the list. Add a new item with a سعر الشراء value; tap تصدير JSON and confirm the exported item has that value.
3. Tap تعديل on an existing item — confirm the form (not a prompt) fills in, scrolls into view, barcode field is read-only, and إلغاء resets it.
4. In the (empty) add form, scan/type a barcode that already belongs to an item — confirm it switches into edit mode for that item instead of creating a duplicate.
