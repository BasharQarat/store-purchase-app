# Purchase Cart, Easier Quantity, and Inline Item Editing — Design

Date: 2026-08-08

## Problem

Three friction points reported after using the app for real purchases:

1. **Items tab:** Add Item form has no `purchase_price` (cost) field, only
   `price` (selling price) — it's added implicitly at export time (falls
   back to `price`), but the buyer can never enter the real purchase price.
   The form also sits below the full item list, requiring scrolling past
   every item before reaching it.
2. **Log Purchase tab:** scanning a second item before saving the first
   overwrites the in-progress selection — there's no way to log several
   purchases from one shopping trip without saving (and re-navigating)
   after every single scan. Adjusting quantity also requires typing into a
   bare number input, no quick +/- control.
3. **Items tab, add-by-scan:** scanning a barcode that already belongs to
   an item currently pops a chain of three browser `prompt()` dialogs to
   edit it — jarring, and disconnected from the form the buyer was just
   filling in.

## Goal

1. Items tab: add a `purchase_price` field to the Add/Edit form (flows
   into IndexedDB and the JSON export, `[[2026-08-08-items-scan-and-export-design]]`'s
   existing export path already passes it through). Move the Add/Edit form
   above the item list.
2. Log Purchase tab: turn item selection into a running cart. Scanning or
   searching an item not yet in the cart adds a new row (qty 1); scanning
   the *same* barcode again increments that row's quantity instead of
   replacing anything. Each row gets a quantity +/- stepper. A single
   "Save All" commits every row as its own purchase entry.
3. Items tab: replace the `prompt()`-based edit flow with the same inline
   Add/Edit form used for adding — editing a list item, or scanning/typing
   a barcode that already exists, populates the form fields directly so
   the buyer edits and saves in place instead of clicking through dialogs.

## Out of scope

- No backend/server (unchanged from prior designs).
- No change to the JSON export shape — `purchase_price` was already part
  of it; this just gives the form a way to set it explicitly.
- No persistent/offline cart recovery — if the app is closed mid-cart
  (before "Save All"), unsaved cart rows are lost, same as today's
  behavior where an unsaved selected item is lost on navigation. Not
  addressed here; the buyer is expected to save before switching tabs.

## Design

### 1. Items tab — form fields + placement

Add a `سعر الشراء` (purchase price) number input to the form, alongside
the existing `الاسم` / `الفئة` / `السعر` / `الباركود` fields. Optional —
if left blank, the stored item has no `purchase_price` and export falls
back to `price` (existing behavior, unchanged).

The whole form (`<div class="ticket" id="item-form-card">`) moves to the
top of the screen, directly under the "تصدير JSON" button and above the
search box and item list.

### 2. Items tab — unified inline Add/Edit form

The form gains an edit mode, tracked by a local `editingId` variable
(`null` = add mode):

- **Tapping "تعديل" on a list item** fills the form fields from that item,
  changes the heading to "تعديل صنف" and the submit button to "حفظ
  التعديل", shows a "إلغاء" (cancel) button, makes the barcode field
  read-only (barcode stays tied to a printed label — consistent with the
  original items design), and smooth-scrolls the form into view (it's now
  off-screen above a long list when تعديل is tapped further down).
- **Scanning a barcode in the form (add mode) that matches an existing
  item** immediately switches to edit mode for that item — the same as
  tapping تعديل — overwriting whatever was typed so far with the existing
  item's stored values, since the scan just proved this barcode already
  belongs to that item. This also fires if the "إضافة" button is clicked
  with a typed (not scanned) barcode that matches an existing item.
- **Scanning again while in edit mode** re-fills the (read-only-to-typing)
  barcode field with the new scan — lets the buyer correct a wrong barcode
  by rescanning without allowing accidental edits by typing.
- **"إلغاء"** exits edit mode by re-rendering the screen from scratch
  (same pattern the rest of this screen already uses after save/delete).
- Submitting in edit mode updates the existing item in place; submitting
  in add mode creates a new item (auto id, as today) — both re-render the
  screen, which naturally resets the form to add mode.

This replaces `editItemPrompt` (three chained `prompt()` calls) entirely;
the delete button/flow is unchanged.

### 3. Log Purchase tab — cart

Replace the single `selectedItem` panel with a `cart` array
(`{ itemId, itemName, price, quantity }` per row), rendered as a list.

- Scanning or picking a search result calls a new pure helper,
  `addOrIncrementCartLine(cart, item)`: if `item.id` is already a row,
  its quantity goes up by 1; otherwise a new row is appended with
  quantity 1 and price defaulted from `item.price`. The affected row
  gets a brief highlight (CSS flash) so a rescan's effect is visible.
- Each cart row shows: name, an editable price input, a quantity stepper
  (− button / number input / + button, minimum 1), the row's computed
  amount, and a remove (×) button. Editing price or quantity, or
  tapping +/−/×, updates that row via three more pure helpers:
  `updateCartLine(cart, itemId, patch)`, `removeCartLine(cart, itemId)`.
- A running total (`cartTotal(cart)`, sum of `calcAmount(qty, price)`
  across rows) shows above the "حفظ الكل" (Save All) button.
- "حفظ الكل" calls `buildPurchasesFromCart(cart)` — shapes every row into
  a full purchase record (own uuid, `amount`, ISO timestamp) — saves each
  via the existing `savePurchase`, empties the cart, and shows a toast
  with the count saved (e.g. "تمت إضافة 3 عناصر"). Not-found barcode
  handling (صنف غير معروف) is unchanged.
- An empty-cart state shows a short hint ("امسح أو ابحث عن صنف لإضافته")
  instead of an empty list.

### New pure logic helpers (`js/logic.js`)

```
addOrIncrementCartLine(cart, item) -> newCart
updateCartLine(cart, itemId, patch) -> newCart
removeCartLine(cart, itemId) -> newCart
cartTotal(cart) -> number
buildPurchasesFromCart(cart, timestamp?) -> purchase[]
```

All pure/unit-testable, following the existing `logic.js` pattern (no DOM,
no DB).

## Testing

Unit tests (`node:test`) for the five new `logic.js` helpers: cart
add/increment, update, remove, total, and purchase-record shaping —
covering the "second scan increments instead of replacing" behavior
explicitly, since that's the core bug being fixed.

Screen wiring (cart rendering, stepper buttons, inline edit form,
scan-triggered edit-mode switch) remains manual-verification, consistent
with this project's existing testing split (camera/DOM/IndexedDB behavior
isn't meaningfully unit-testable here).
