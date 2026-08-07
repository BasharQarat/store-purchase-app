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
    <div id="selected-item" class="ticket" style="display:none;">
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
