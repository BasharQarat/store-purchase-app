# Barcode Purchase Logging PWA — Design

Date: 2026-08-07

## Problem

Small store has one buyer who goes out to purchase stock (snacks, drinks,
bread, dairy, etc.) for the store. He needs an easy way to log each purchase
(item, quantity, price paid) from his phone, without typing much or fighting
a laptop. The previous approach (WhatsApp voice notes transcribed and parsed
by a Python/Whisper script) is set aside for now due to accuracy problems
with dialect speech and noisy audio — this project replaces that channel with
a phone-based app instead.

## Goal

A phone-installable web app (PWA) where the buyer either scans a barcode or
picks from a searchable list to select an item, enters quantity (and,
optionally, overrides the price), and submits. Entries accumulate locally on
the phone for the day; at day's end the buyer shares the day's JSON straight
to the store owner (e.g. over WhatsApp), the same habit as today's voice
notes, then clears the list for the next day.

## Out of scope

- Turning the exported JSON into an Excel-style report (separate follow-up
  script, not part of this project).
- The old voice-note/Whisper pipeline (`test_store_script/`) — untouched,
  set aside.
- Any backend/server — this is a fully client-side, offline-capable app.
- Manufacturer/real product barcodes — the store generates and prints its own
  barcode labels per item.

## Tech stack

Vanilla JS/HTML/CSS, no build step or framework. Chosen over React+Vite
because the app is small (4 screens, one user) and this keeps it inspectable
and hand-editable, consistent with the low-tooling style of the existing
Python script project.

Libraries (vendored locally under `vendor/`, not loaded from a CDN — the app
must work fully offline after first install, so every asset the service
worker needs to cache must be a local file):
- `@zxing/browser` — camera barcode scanning/decoding.
- `JsBarcode` — barcode image generation (Code128) for printable labels.

## Hosting

Deployed as static files to GitHub Pages, giving a permanent HTTPS URL. This
is required, not optional: camera access (`getUserMedia`) and service workers
both require a secure context, which plain HTTP over local WiFi does not
satisfy on most mobile browsers. The buyer opens the URL once and uses
"Add to Home Screen" to install it like a native app.

## Data model (IndexedDB)

Two object stores in a database named `store_purchases_db`:

**`items`**
```
{
  id: string,        // e.g. "IT-0001", also encoded into the barcode
  barcode: string,    // Code128-compatible value, same as id
  name: string,
  category: string,
  price: number        // reference/default purchase price
}
```

**`purchases`**
```
{
  id: string,          // uuid
  itemId: string,       // references items.id
  itemName: string,     // copied at entry time — editing the item later
  price: number,        // must not rewrite history
  quantity: number,
  amount: number,       // quantity * price, computed at entry time
  timestamp: string     // ISO 8601, local device time
}
```
"Today" is determined by comparing `timestamp`'s local calendar date to the
device's current date — no separate day-boundary concept needed.

## Screens

Single-page app with a persistent 4-tab bottom (or top) nav bar:

### 1. Log Purchase (default tab)
- Prominent "Scan Barcode" button opens the camera via `@zxing/browser`.
  On successful decode, look up the item by barcode in IndexedDB:
  - Found: show item name, price (pre-filled from item, editable), and a
    quantity input (numeric, default 1). "Add" button saves a new purchase
    entry, shows a brief confirmation toast, and resets the form so the
    buyer can immediately scan the next item without extra navigation.
  - Not found: show "صنف غير معروف" (unknown item) with a button to fall
    back to the search list below.
- Below the scan button, a search box filters the item list by name; tapping
  a result pre-fills the same item/price/quantity form as a successful scan.

### 2. Today
- List of today's purchase entries (item, quantity, price, amount), newest
  first, with a running total of `amount` at the bottom.
- Tapping an entry opens an edit view (quantity and price editable, item
  fixed) with Save/Delete.
- Two actions at the bottom:
  - **Share** — builds a JSON file of today's entries and triggers the Web
    Share API (`navigator.share` with a `File`) so the buyer can send it
    directly to the store owner over WhatsApp or any installed app. Falls
    back to a Download link if the Web Share API or file-sharing isn't
    supported by the browser.
  - **Clear Today** — manual, asks for confirmation, then deletes today's
    entries from the `purchases` store. Intentionally separate from Share
    (not automatic) so a cancelled/failed share never silently loses data.

### 3. Items
- List of all items (search/filter by name).
- "Add Item" form: name, category, price. On save, the app auto-generates
  the next sequential `id`/`barcode` (`IT-0001`, `IT-0002`, ...) and persists
  the new item.
- Tapping an existing item opens an edit form: name/category/price editable;
  barcode is read-only after creation (it's already printed on a label) with
  a Delete option. Deleting an item is safe — past purchase entries keep
  their own copy of `itemName`/`price` and don't reference the item live.

### 4. Labels
- List of items with checkboxes (plus "select all").
- "Print" renders a print-friendly page (CSS print stylesheet) with each
  selected item's name and a generated Code128 barcode image (via
  `JsBarcode`), laid out in a label grid. Uses the browser's native print
  dialog — no PDF generation library needed.

## Offline / PWA mechanics

- `manifest.json` — name, icons, `start_url`, `display: standalone` for
  home-screen install.
- `service-worker.js` — caches the full app shell (HTML/CSS/JS/vendor files/
  icons) on install via the Cache API, so the app loads and runs with zero
  network after the first successful visit.
- IndexedDB persists all data locally regardless of connectivity; nothing
  about item selection, scanning, or entry logging requires a network call.

## Testing

No existing test tooling in this new project. Given a vanilla JS/no-backend
app, testing is split:
- Pure logic (barcode ID generation, amount calculation, JSON export
  shaping, today/date filtering) — unit tests in plain JS, run via a
  lightweight runner (Node's built-in `node:test`, no extra dependency).
- Screens/camera/IndexedDB/service-worker behavior — manual verification in
  a real mobile browser after deploying to GitHub Pages (these depend on
  browser APIs that aren't meaningfully unit-testable without heavy mocking
  that wouldn't catch real issues).
