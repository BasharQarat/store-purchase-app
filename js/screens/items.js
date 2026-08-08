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
