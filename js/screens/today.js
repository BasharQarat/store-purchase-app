import { getAllPurchases, deletePurchase, savePurchase } from "../db.js";
import { isToday, calcAmount, buildExportPayload } from "../logic.js";
import { triggerDownload } from "../download.js";

export async function renderToday(container, db) {
  const all = await getAllPurchases(db);
  const todays = all
    .filter((p) => isToday(p.timestamp))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const total = todays.reduce((sum, p) => sum + p.amount, 0);

  container.innerHTML = `
    <h2>اليوم</h2>
    ${todays.length === 0 ? '<p class="empty-hint">لا توجد مشتريات مسجلة اليوم بعد</p>' : ""}
    <ul id="today-list">
      ${todays
        .map(
          (p) => `<li data-id="${p.id}" class="ticket">
            <span>${p.itemName} — ${p.quantity} × ${p.price} = <span class="amount">${p.amount}</span></span>
            <button class="edit-btn" data-id="${p.id}">تعديل</button>
            <button class="delete-btn" data-id="${p.id}">حذف</button>
          </li>`
        )
        .join("")}
    </ul>
    <p>الإجمالي: <span class="amount">${total}</span></p>
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
  });

  container.querySelector("#clear-btn").addEventListener("click", async () => {
    if (!confirm("مسح كل إدخالات اليوم؟")) return;
    for (const p of todays) {
      await deletePurchase(db, p.id);
    }
    renderToday(container, db);
  });
}
