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
