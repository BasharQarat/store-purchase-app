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

// Module-level so the in-progress cart survives switching tabs and back —
// renderLogPurchase re-runs its whole body (including a fresh innerHTML)
// every time the tab is shown, but this variable is not re-initialized.
let cart = [];

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
