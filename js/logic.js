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
