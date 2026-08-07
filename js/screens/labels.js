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
