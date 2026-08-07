const CACHE_NAME = "store-purchase-app-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./css/fonts.css",
  "./js/app.js",
  "./js/db.js",
  "./js/logic.js",
  "./js/scan.js",
  "./js/screens/logPurchase.js",
  "./js/screens/today.js",
  "./js/screens/items.js",
  "./js/screens/labels.js",
  "./vendor/jsbarcode/JsBarcode.all.min.js",
  "./vendor/fonts/cairo-700-arabic.woff2",
  "./vendor/fonts/cairo-700-latin.woff2",
  "./vendor/fonts/tajawal-400-arabic.woff2",
  "./vendor/fonts/tajawal-400-latin.woff2",
  "./vendor/fonts/tajawal-500-arabic.woff2",
  "./vendor/fonts/tajawal-500-latin.woff2",
  "./vendor/fonts/tajawal-700-arabic.woff2",
  "./vendor/fonts/tajawal-700-latin.woff2",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
