# Items: Scan-to-Add Barcode + JSON Export — Design

Date: 2026-08-08

## Problem

The Items tab's "Add Item" form only accepts typed name/category/price; the
`barcode` is auto-derived from the auto-generated `id` (`IT-0001`, ...).
There's no way to scan a real product barcode when adding an item, and all
item data lives only in IndexedDB in the browser — there's no way to get
newly added/edited items back into `data/seed-items.json` in the repo, so
the seed file drifts from what's actually in use on the phone.

## Goal

1. Let the buyer scan a barcode (camera) when adding a new item, same
   scanning mechanism already used in Log Purchase.
2. Let the buyer export the current full item list from IndexedDB as a
   downloadable `seed-items.json`, so it can be manually copied back into
   the repo (`data/seed-items.json`) and redeployed — keeping the seed file
   in sync with real usage.

## Out of scope

- Any backend/server. The app stays fully client-side, offline-capable, and
  deployed to GitHub Pages, consistent with
  `docs/superpowers/specs/2026-08-07-barcode-purchase-pwa-design.md`.
- Automatic/live sync between IndexedDB and the repo file. Export is a
  manual, on-demand snapshot — IndexedDB remains the live source of truth
  for the running app.
- File System Access API (writing directly to a local file) — not supported
  on iOS Safari, which the buyer's phone may be.

## Design

### Add Item form — barcode field + scan

`js/screens/items.js`'s Add Item form gains a `barcode` text input,
independent of the auto-generated `id`. If `isBarcodeScanSupported()`
(from `js/scan.js`) is true, a "مسح الباركود" button appears next to the
field; tapping it opens the camera via `startBarcodeScan` (same function
Log Purchase already uses) and fills the barcode input with the scanned
value on detection.

`id` keeps its current auto-sequential behavior (`nextItemId`), unrelated
to the barcode value now. Barcode may be left empty (item has no scannable
label yet) — this matches today's implicit behavior before barcode/id were
split.

### Duplicate barcode handling

On Add, before creating a new item, check if the entered/scanned barcode
already belongs to an existing item (linear scan over the in-memory
`items` list already loaded for the screen — no new DB helper needed,
list is small). If a match is found:
- Don't create a new item.
- Open the existing edit flow (today's `prompt()`-based edit) pre-filled
  with that item, so the buyer updates the existing entry instead of
  creating a duplicate.

If no match, proceed with creating the new item as today, now also storing
the entered/scanned `barcode` value.

### JSON export

Items screen gets a "تصدير JSON" button (placed near the top, above the
search box). On click:
- Read the full current item list from IndexedDB (already loaded on
  render).
- Serialize to the same shape as `data/seed-items.json` (`id`, `barcode`,
  `name`, `category`, `price`, `purchase_price`).
- Trigger a file download named `seed-items.json` containing that JSON.

Reuse the existing download-fallback logic from the Today screen's
share/export flow (`js/screens/today.js`) rather than duplicating
Blob/anchor-download code — extract the shared bit if it isn't already a
standalone function.

The buyer (or store owner) then manually replaces `data/seed-items.json`
in the repo with the downloaded file and redeploys, when they want the
seed data to reflect current items.

### Data model

No changes to the `items` object store shape in IndexedDB — `barcode` was
already a field, just previously always equal to `id`. `purchase_price` is
not currently collected by the Add Item form; keeping scope minimal, the
export will pass through whatever's already in the stored item objects
(new items created via this form won't have `purchase_price` set unless a
future change adds that field to the form — not part of this design).

## Testing

Unit tests (`node:test`, following existing `tests/*.test.js` pattern) for
the pure-logic pieces:
- Duplicate-barcode lookup helper (given items list + barcode, returns
  matching item or null).
- Export shaping helper (given items list, returns array in
  `seed-items.json` field order/shape).

Camera scan integration and actual file download remain manual-verification
items (same reasoning as the original design doc — not meaningfully
unit-testable without heavy mocking).
