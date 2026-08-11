# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Run all tests: `npm test` (runs `node --test tests/*.test.js`)
- Run a single test file: `node --test tests/logic.test.js`
- No build step, no bundler, no linter — plain ES modules loaded directly by the browser. There is nothing to "build"; edits to `js/*.js` are live on refresh.

## Architecture

Vanilla JS PWA, no framework, no backend/server — fully static, deployed to GitHub Pages (`https://basharqarat.github.io/store-purchase-app/`). All data lives in the browser's IndexedDB; there is no sync between devices or with the repo beyond manual export.

**Screens as render functions.** `js/app.js` holds a `SCREENS` map (`log`, `today`, `items`, `labels` — `labels` nav button is currently removed from `index.html` to hide that tab, but the screen code and route still exist) and a single `showScreen(name)` that toggles the active `<section>` and calls that screen's `render(container, db)` from `js/screens/*.js`. Every screen re-renders its container's full `innerHTML` from scratch on each call and re-derives its data from `db` — there's no persistent component state across renders *except* the purchase cart in `js/screens/logPurchase.js`, which is deliberately hoisted to module scope (not re-initialized inside `renderLogPurchase`) so scanning several items survives switching tabs and back.

**IndexedDB via `js/db.js`.** Two object stores: `items` (catalog) and `purchases` (logged buys). `js/logic.js` holds all pure/testable logic (id generation, amount math, cart operations, export shaping) — keep DOM and IndexedDB code out of it.

**Purchases copy item data at entry time.** A purchase record stores its own `itemName`, `price`, and `purchase_price` (and derives `amount`/`amount_purchase` from them) rather than referencing the item live — editing or deleting an item later must not rewrite purchase history.

**Vendored dependencies, not npm/CDN.** `vendor/jsbarcode/` is a pre-built UMD bundle loaded as a plain `<script>` tag in `index.html` (before the `type="module"` app script), so code references it as a bare global (`JsBarcode(...)`) rather than importing it — this is required for the service worker to cache the app fully offline, and there's no CDN dependency at runtime.

**Barcode scanning uses the native `BarcodeDetector` API** (`js/scan.js`, gated by `isBarcodeScanSupported()`). A vendored-ZXing (`@zxing/library`, pure-JS decoding) replacement was tried to fix scanning on a Tecno/Transsion phone (where `BarcodeDetector` reports itself supported but `detect()` never finds anything, likely a missing/broken Google Play Services ML Kit module) — it was reverted because it made scanning noticeably worse on the devices that did work (Xiaomi/Samsung). If revisiting Tecno support, don't just swap the whole detector again; consider detecting the stuck-no-results case and falling back, or testing ZXing's tuning (frame rate, hints) more carefully before replacing the default path.

Scan success plays a short synthesized beep (`playBeep` in `js/scan.js`, Web Audio API, no vendored audio asset) — the `AudioContext` is created up front in `startBarcodeScan` (same tick as the triggering click, before any `await`) so autoplay policies don't block it.

**Service worker cache versioning.** `service-worker.js` is cache-first (`ASSETS` array + `CACHE_NAME`). Installed PWAs keep serving whatever was cached under the current `CACHE_NAME` indefinitely — **`CACHE_NAME` must be bumped any time the content of an already-listed cached file changes**, not just when the asset list itself changes, or users silently keep running stale JS. `tests/serviceWorker.test.js` only checks that every listed asset exists on disk, it does not catch a missed version bump.

**Data model / seed file.** `data/seed-items.json` is the checked-in item catalog, auto-imported into IndexedDB on first run if the `items` store is empty (`seedItemsIfEmpty` in `js/db.js`). It has no `category` field (removed). The Items tab's "تصدير JSON" button downloads the current IndexedDB item list in this same shape so it can be manually copied back into `data/seed-items.json` and redeployed — this is a one-way manual snapshot, not a live sync.

**Testing split.** `js/logic.js`'s pure functions are unit-tested with `node:test` (`tests/logic.test.js`). Screens, camera scanning, IndexedDB, and service-worker runtime behavior are manual-verification only — `tests/*.shape.test.js` files are smoke tests that just assert a module's expected functions are exported, and `tests/vendorJsbarcode.test.js` / `tests/serviceWorker.test.js` / `tests/seedItems.test.js` / `tests/manifest.test.js` guard static file shape/presence, not runtime behavior.

**UI.** RTL Arabic throughout (`dir="rtl"` in `index.html`), all copy in Arabic. `css/styles.css` defines a small custom design system via CSS custom properties (no framework).

## History

`docs/superpowers/specs/` and `docs/superpowers/plans/` contain design specs and implementation plans written during prior feature work (via the Superpowers Claude Code skill workflow). They're a useful record of *why* things are shaped the way they are, but are not living documentation — don't treat them as a source of current behavior without checking the code.
