import { getAllItems, saveItem, deleteItem } from "../db.js";
import { nextItemId, filterItemsByQuery, findItemByBarcode } from "../logic.js";
import { isBarcodeScanSupported, startBarcodeScan } from "../scan.js";

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
    <label>الباركود <input id="new-barcode" type="text" /></label>
    ${isBarcodeScanSupported() ? '<button id="scan-item-btn" type="button">مسح الباركود</button>' : ""}
    <video id="item-scan-video" playsinline style="display:none; width:100%;"></video>
    <button id="add-item-btn">إضافة</button>
  `;

  container.querySelector("#item-search").addEventListener("input", (e) => {
    const matches = filterItemsByQuery(items, e.target.value);
    container.querySelectorAll("#items-list li").forEach((li) => {
      li.style.display = matches.some((m) => m.id === li.dataset.id) ? "" : "none";
    });
  });

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
      await editItemPrompt(item);
    }
  });
}
