const DEFAULT_DB_NAME = "store_purchases_db";
const DB_VERSION = 1;

export function openDb(dbName = DEFAULT_DB_NAME) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("items")) {
        db.createObjectStore("items", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("purchases")) {
        db.createObjectStore("purchases", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function store(db, name, mode) {
  return db.transaction(name, mode).objectStore(name);
}

export function getAllItems(db) {
  return new Promise((resolve, reject) => {
    const req = store(db, "items", "readonly").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getItemByBarcode(db, barcode) {
  const items = await getAllItems(db);
  return items.find((i) => i.barcode === barcode) || null;
}

export function saveItem(db, item) {
  return new Promise((resolve, reject) => {
    const req = store(db, "items", "readwrite").put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

export function deleteItem(db, id) {
  return new Promise((resolve, reject) => {
    const req = store(db, "items", "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function getAllPurchases(db) {
  return new Promise((resolve, reject) => {
    const req = store(db, "purchases", "readonly").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function savePurchase(db, purchase) {
  return new Promise((resolve, reject) => {
    const req = store(db, "purchases", "readwrite").put(purchase);
    req.onsuccess = () => resolve(purchase);
    req.onerror = () => reject(req.error);
  });
}

export function deletePurchase(db, id) {
  return new Promise((resolve, reject) => {
    const req = store(db, "purchases", "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function seedItemsIfEmpty(db, seedUrl = "./data/seed-items.json") {
  const existing = await getAllItems(db);
  if (existing.length > 0) return;
  const response = await fetch(seedUrl);
  if (!response.ok) return;
  const items = await response.json();
  for (const item of items) {
    await saveItem(db, item);
  }
}
