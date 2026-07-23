# B2B Integration Guide — House of Kasya B2B Sales app ↔ this ERP

**Status: LIVE since 2026-07-23.** The House of Kasya B2B sales app (`C:\Users\NEW\kasya-b2b-sales`,
its own PM2 apps `kasya-b2b-api`/`kasya-b2b-web`, ports 4000/8080) is a **pure API consumer** of
this ERP over the LAN (`http://localhost:5000/api`). It never touches this ERP's database or code.
House of Kasya's **Purchase Order** to Kashaya Fabs is pushed here as a **Sale Order**
(customer = "House Of Kasya Pvt Ltd"). This document is the contract: what the B2B app calls, the
exact shapes it sends and reads, and what must not change without coordinating.

Counterpart docs in the B2B repo: `docs/HOK-B2B-ERP-INTEGRATION-PLAN.md` (§12 = current state).
B2B-side client code: `backend/src/services/garmentErp.service.ts` (thin client),
`purchaseOrderErp.service.ts` (push/preview/read-back), `erpStatusSync.service.ts` (background sync).

## 1. Identity

| What | Value |
|---|---|
| Service account | `b2b-integration@kasya.in` (ADMIN — owner decision, Phase 0) |
| ERP customer | `House Of Kasya Pvt Ltd`, code `CUST-B2B-DOM-001`, id `c4a5436d-0ae3-40ca-be18-2cfd553f89ea` |
| Brands pushed | Kasya + Nihsamah only (enforced on the B2B side) |

The B2B app resolves the customer **by name search** (`GET /customers?search=House Of Kasya Pvt
Ltd`, exact case-insensitive name match) — renaming that customer breaks the push with a clear
error. The account must stay active with access to the routes in §2.

## 2. Endpoints consumed (the contract surface)

| Endpoint | Used for | Notes |
|---|---|---|
| `POST /auth/login` | JWT (cached, re-login on 401) | First login after ERP idle measured ~11 s; B2B allows 30 s |
| `GET /customers?search=&limit=` | Resolve the one buyer | Exact name match client-side |
| `GET /styles?search=&limit=` | Resolve style by code | Search is a PREFIX match; B2B exact-matches `styleCode` (LNG215 ≠ LNG215N — colourways are distinct styles) |
| `GET /styles/:id` | `data.sizeOptions[{id,sizeName,sizeCode,isActive}]`, `data.colorOptions[{id,colorName,isActive}]` | Resolves `sizeId`/`colorId` for sale-order items |
| `POST /sale-orders` | Create the sale order | Size-wise items — see §3 |
| `PUT /sale-orders/:id` | Re-send after PO edit | Same items shape; ERP replaces items wholesale; **DRAFT-only** |
| `GET /sale-orders/:id` | Status read-back + background sync | Fields read in §4 |
| `GET /production-status/by-order?styleId=&limit=` | Production progress per style | Kebab-case mount; `styleId` filters at DB level |

## 3. The push payload (what the B2B app sends)

```json
POST /api/sale-orders
{
  "customerId": "c4a5436d-0ae3-40ca-be18-2cfd553f89ea",
  "expectedShipDate": "2026-08-15T00:00:00.000Z",
  "remarks": "House of Kasya PO PO-0012 (KASYA) — …",
  "items": [
    { "styleId": "…", "colorId": null, "sizeId": "…", "quantity": 2, "unitPrice": 450 },
    { "styleId": "…", "colorId": null, "sizeId": "…", "quantity": 3, "unitPrice": 450 }
  ]
}
```

- One item per **style + colour + size** (aggregated B2B-side to respect
  `sale_order_items @@unique([saleOrderId, styleId, colorId, sizeId])`).
- `unitPrice` is the **GST-exclusive net rate** from the B2B price agreement (owner rule).
- `colorId` is best-effort (matched by `colorName`); `null` when the colour isn't on the style.
- `PUT` sends the identical shape; the ERP replaces the item set wholesale.

**History (why the schema looks like this):** until 2026-07-23 `saleOrder.schema.ts` stripped
`sizeId`/`colorId`/`unitPrice` (fields the service layer requires) and had no `expectedShipDate`,
so **every** API create failed 400 — including this ERP's own frontend add-items flow. The schema
was fixed (owner-authorized, the only B2B-driven change ever made in this repo) and verified live:
`POST` → 201 `SO-2607-0001` → read-back → `DELETE`.

## 4. What the B2B app reads back (field names matter)

From `GET /sale-orders/:id` (response is the **unwrapped** object, camelized by the global
serializer — note `_count` becomes `count`):

- `status` — `DRAFT | CONFIRMED | PARTIALLY_DISPATCHED | DISPATCHED | DELIVERED | CANCELLED`.
  B2B treats DISPATCHED/DELIVERED/CANCELLED as **terminal** and stops polling that order.
- `saleOrderNumber`, `saleDate`, `expectedShipDate`
- `items[].quantity / allocatedQty / dispatchedQty / unitPrice`,
  `items[].style{styleCode,styleName}`, `items[].color{colorName}`, `items[].size{sizeName,sizeCode}`
- `count.deliveryNotes`, `count.invoices`

From `GET /production-status/by-order?styleId=`:
`orderNumber, customerId, customerName, quantity, currentStage, piecesInStage, overallProgress,
deliveryDate, isDelayed, stageBreakdown{inCutting,inStitching,inFinishing,readyToShip,shipped,completed}`.
(B2B knows `stageBreakdown` only fills the current-stage bucket and displays currentStage + pieces
+ overall % instead.)

## 5. Do NOT change without coordinating with the B2B app

1. **`saleOrderItemSchema`** must keep accepting
   `{styleId, colorId?, sizeId, quantity, unitPrice, remarks?}` — re-stripping any of these
   re-breaks every push (and this ERP's own add-items flow).
2. **`expectedShipDate`** on create + update must accept **both** bare `YYYY-MM-DD` (this ERP's own
   `<input type="date">`) and full ISO (the B2B app). That's why it's a lenient `Date.parse`
   refine, not `.datetime()`.
3. **Response serialization**: the B2B app reads the camelized keys (`count.deliveryNotes`,
   `saleDate`). Changing the humps serializer or wrapping `GET /sale-orders/:id` in an envelope
   silently zeroes/blanks its Factory-status view.
4. **HTTP status semantics**: a deleted sale order must return **404** on `GET /sale-orders/:id` —
   the B2B app maps that to a terminal "Deleted in factory" state (and auto re-creates on the next
   send). The production error middleware masks error *messages*, so status **codes** are the only
   signal it gets.
5. **DRAFT-only updates**: the B2B app pre-flights the status and refuses its own re-send with a
   clear message when the order is confirmed. If this rule ever changes (e.g. editable confirmed
   orders), tell the B2B side so it can relax the pre-flight.
6. **Status enum values** (§4) — renaming/adding states affects the B2B badge + terminal logic.
7. **Style identity**: `styleCode` is the join key; colourways stay distinct styles. Renaming a
   pushed style's code doesn't break existing links (they're by id) but breaks future resolution
   of that code.

## 6. Traffic profile (so it isn't mistaken for abuse)

Low volume, all sequential by design: interactive preview/push (a handful of calls per PO);
Factory-status modal on demand; a background sync every **15 min** (≤30 sequential
`GET /sale-orders/:id`, ~400 ms apart, early-abort if the ERP is unreachable); production read-back
only when the modal opens (per distinct style, 45 s budget). Don't aggressively rate-limit the
service account.

## 7. Known ERP-side gaps the B2B app currently works around (nice-to-fix here)

- **`sale_order_items.remarks` is accepted but never persisted** (create/update map drops it). The
  B2B app sends the colour name there when it can't match a `colorId`; today that context is lost —
  persisting it would make unmatched colours visible on the factory side.
- **`expectedShipDate` can't be cleared** via update (absent = no change; it isn't nullable in the
  update path). Clearing the date on a B2B PO therefore never clears it here.
- **No sale-order → production-order link** in the schema. The B2B app matches production progress
  **by style**, which can show another buyer's production of the same style. A structured link
  (sale order ↔ orders/work_orders) would make factory tracking exact.
- **This ERP's own frontend header-only sale-order create sends `items: []`**, which the controller
  rejects — its create-from-list flow is broken independent of the B2B app (found 2026-07-22).

## 8. Reconciliation checklist (how to "tally" the two systems)

For any pushed PO, these must line up:

| B2B side | ERP side |
|---|---|
| PO size grid (qty per size per style/colour) | `sale_order_items` quantities, one row per style+colour+size |
| PO line **net rate** (GST-exclusive) | `sale_order_items.unitPrice` (and `totalPrice = qty × unitPrice`) |
| PO "expected date" | `sale_orders.expectedShipDate` |
| PO list factory badge (`erpSoStatus`, ≤15 min stale) | `sale_orders.status` |
| Factory-status modal: Ordered/Allocated/Dispatched per line | `quantity` / `allocatedQty` / `dispatchedQty` |
| Delivery-note / invoice counts in the modal | `_count` of `delivery_notes` / `invoices` on the SO |

Quick live test (safe, self-cleaning): log in as the service account, `POST /api/sale-orders` with
one real `styleId`/`sizeId` from `GET /styles/:id` → expect **201** → `DELETE /api/sale-orders/:id`.
If that 400s, someone re-broke §5.1/§5.2.
