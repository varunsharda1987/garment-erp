---
slug: sale-order-create
title: Create a Sale Order (Sell from Stock)
keywords:
  - sale order
  - SO
  - sell from stock
  - stock sale
  - sale order kaise banaye
  - naya sale order
  - सेल ऑर्डर
  - बिक्री
  - ऑर्डर
  - स्टॉक
  - ग्राहक
  - finished goods
  - fg stock
  - allocate stock
  - b2b
  - add item
  - link production order
  - amend quantities
  - change size split
  - size wise quantity galat hai
  - confirmed order ki quantity badlo
  - मात्रा बदलें
  - साइज़ वाइज़ मात्रा
  - link to production order
  - create delivery note
  - dispatch sale order
  - sale order ka maal bhejo
  - डिलीवरी नोट बनाएं
  - production order link karo
  - sale order ko order se jodo
  - प्रोडक्शन ऑर्डर जोड़ें
  - उत्पादन ऑर्डर लिंक
  - size breakdown
  - buyer po
  - buyer po document
  - po copy
  - po pdf
  - attach po
  - upload po
  - customer po
  - delivery location
  - po date
  - po kaise attach kare
  - बायर पीओ
  - पीओ अपलोड
  - पीओ दस्तावेज़
  - डिलीवरी लोकेशन
  - साइज़ ब्रेकडाउन
  - sale order filter
  - sale order search
  - order dhundo
  - ऑर्डर खोजें
  - फ़िल्टर
  - buyer style ref
  - buyer style code
  - style code se order dhundo
  - बायर स्टाइल कोड
  - स्टाइल कोड
  - स्टाइल नंबर
  - style number changed
  - buyer code change
  - color not showing
  - colour not appearing
  - color N/A
  - no colors defined for this style
  - set style colour
  - primary color
  - rang nahi aa raha
  - color kaise set kare
  - रंग
  - रंग नहीं दिख रहा
  - रंग सेट करें
  - कलर
  - season
  - season column
  - which season
  - sale order season
  - season kahan dikhega
  - season filter
  - filter by season
  - season wise orders
  - season se order dhundo
  - सीज़न फ़िल्टर
  - सीज़न से खोजें
  - सीज़न
  - सीजन
  - मौसम
  - size order
  - size sequence
  - sizes out of order
  - XS to XXXL
  - size missing
  - size not showing
  - size nahi dikh raha
  - XXXL dikh raha hai
  - sizes kahan se aate hain
  - साइज़
  - साइज़ क्रम
  - साइज़ नहीं दिख रहा
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/SaleOrderList.tsx
  - frontend/src/pages/SaleOrderDetail.tsx
  - frontend/src/components/sale-order/SaleOrderForm.tsx
  - frontend/src/components/sale-order/SaleOrderItemsTable.tsx
  - frontend/src/components/sale-order/SaleOrderItemDialog.tsx
  - frontend/src/components/sale-order/SizeBreakdownDialog.tsx
  - frontend/src/components/sale-order/sale-order-lines.ts
  - frontend/src/services/saleOrder.service.ts
  - backend/src/schemas/saleOrder.schema.ts
  - backend/src/routes/saleOrder.routes.ts
  - backend/src/services/saleOrder.service.ts
  - frontend/src/pages/DispatchDeliveryNoteForm.tsx
route: /sale-orders
---

## Before you start
A Sale Order sells finished goods that are already in stock, or triggers production for that quantity. It is different from a production order. The customer must exist in Customers and every line's style must exist in Styles. Sale orders can also arrive automatically from the House of Kasya B2B app with items already filled in — check the list before typing a new one.

## Steps
1. Open **Orders & Sales → Sale Orders** in the sidebar. The list shows each order's styles, buyer style codes, **Season**, total quantity in pcs, amount and status. The Season is the style's own season (set on the style's form, e.g. WT26) — a sale order has no season field of its own, so it shows **—** until the style has one. To find an order, type into the search box — it matches the sale order number, any buyer PO on the order, the customer name or code, the remarks, our style code, the style name, the buyer's own style code (both the one saved on the order and the style's current one), and the style's season (for example type WT26). Typing several words narrows the list — each word must match something, so a customer name and a style code together find exactly that order. You can also narrow with the **All Customers** picker, the **All Status** dropdown, the **All Seasons** dropdown, or the **Sale date range** calendar. **All Seasons** lists the seasons from the Season master (the same ones the style form offers) and shows the orders whose styles carry the chosen season; an order whose styles have no season set appears under none of them.
2. Click **New Sale Order**. A panel titled **New Sale Order** slides in from the right.
3. In **Customer \***, search and pick the customer.
4. Everything else in the header is optional: **Buyer PO Number** (the buyer's own PO reference), **Primary Style** (for single-style orders), **Expected Ship Date**, **Buyer Deadline**, **Order Date**, **Delivery Date**, **Payment Terms**, **Delivery Address**, **Remarks**.
5. Under **Items**, click **Add Item**. In the dialog pick **Style \*** — the box lists published styles alphabetically by code, up to 200 at a time. If the bottom of the list says **Showing 200 of …**, type part of our style code, the style name, the customer, or the buyer's own code to narrow; several words together each have to match, so a customer name plus a code finds exactly that style, and "LNG 229" finds LNG229. **Buyer Style Ref** fills in with that style's current buyer code and can be overtyped for this line. **Color** fills in by itself from the style's own **Primary Color**. If the style has no colour yet, the Color field instead says **This style has no colour yet** and offers a colour box — pick the colour and click **Set as style colour**. That saves it as the style's Primary Color, so cutting, stock and dispatch all see it too, not just this order; a style has one colour, and an existing one is never replaced. Color and Size are both optional (leave Size as "Size to be decided" if unknown). The **Size** list shows only the sizes ticked under **Size Variants & SKUs** on that style's form, smallest first (XS, S, M, L, XL, XXL, XXXL). If a size is missing, or one shows that should not, open the style in **Styles**, tick or untick it there and save the style — then reopen Add Item. Enter **Quantity \*** and **Unit Price \*** (the price auto-fills from the style's selling price when one is set, and you can clear it and type your own), then click **Add Single Item**.
6. To split one quantity across sizes, fill Quantity and Unit Price first, then click **Size Breakdown** and enter per-size quantities — one line is added per size. The breakdown lists the same sizes as the Size box, smallest first. Percentages are read against 100, so the sizes must add up to the full quantity before it will save.
7. Add more lines the same way. The Items table keeps them in order — by style, then colour, then size from XS upward — whatever order you add them in, and shows each line's **Season**. Use the pencil and bin icons on a line to edit or remove it. The **Total Amount** box sums the order. Adding the same style, colour and size twice is safe — the two lines are merged into one with the quantities added together.
8. Click **Create Sale Order**. The sale order opens with status **Draft**. You may also save with no items at all and add them later — the hint under the Items table says so.
9. While Draft, the **Edit** button on the order page changes details and items, including the **Buyer PO Number**.
10. To record the customer's own purchase orders, use the **Buyer PO Numbers** card and click **Add PO**. Fill **PO Number \***, pick the **Delivery Location** from that customer's saved addresses, set the **PO Date** printed on their PO, and choose the **PO Document** (PDF, JPG or PNG, up to 10MB). The customer raises one PO per delivery location, and each location has its own PO number, so add one PO per location. If the Delivery Location list is empty, add the locations on that customer's page first and come back.
11. On each PO row the location, PO date and attached document are shown. Use the upload icon to attach or replace the document, the cross icon to remove it, the star to make that PO primary, and the bin to remove the PO. Click the document name to open it — it opens in a new tab and needs you to be signed in, because a PO carries prices.
12. The same PO and its document are then visible to the dispatch team on the **Delivery Note** page and to accounts on the **Invoice** page, so nobody has to ask for a copy.
13. If the Color column shows **N/A** on lines taken before the style had a colour, set the style's colour first (step 5), then click **Apply style colour to N lines** above the Items table. The button only appears while the order is Draft, so do this before Confirm — lines cannot be changed afterwards.
14. Once the order has at least one item, click **Confirm**. The dialog shows stock availability and style readiness before you approve it.
15. To ship from stock: on each item row click **Allocate**. In **Allocate Finished Goods Stock**, click an available stock line, set **Quantity to Allocate**, then click **Allocate**. Each reservation is then listed under the **Allocated** column with its quantity and location, and a **Release** button next to it puts that stock back if you picked the wrong lot.
16. If production for this style was already planned before the buyer's PO came in (an order raised early so greige could be bought and dyed), open **Actions** and click **Link to Production Order** instead. The dialog lists the production orders for this sale order's styles that are not linked to any sale order; one for a different customer is shown but cannot be picked. Choose it and click **Link Production Order**. If that production order has no sizes yet, this sale order's sizes and colour are copied onto it exactly — its quantity becomes the sale order's — and its production run is created. While such an order exists, **Start Production** is not offered, so the same goods are never planned twice.
17. To make the goods when nothing is planned yet: open **Actions** and click **Start Production**. In the dialog choose **What to produce** — **Only what stock does not cover** (the default; the pieces not already allocated or dispatched from finished-goods stock) or **Full sale-order quantity** — then set **Expected Delivery Date** (pre-filled with the sale order's **Expected Ship Date**, or the buyer deadline when there is no ship date — production must finish by the ship date), **Priority**, optional **Remarks**, and click **Create Production Order**. This creates one linked production order for that quantity, with work orders per style. If stock already covers every line, the default choice is refused with "nothing to produce" — pick the full quantity to make it anyway.
18. To ship: open **Actions** and click **Create Delivery Note** (shown while the order is Confirmed, Partially/Fully Allocated or Partially Dispatched). If a production order is linked, the delivery note form opens on that order; if not (goods from finished-goods stock), it opens on this sale order with each line pre-filled at what it still has to ship. The form says **Booked against sale order …** — creating the note moves this order's **Dispatched** quantities and status.
19. To correct the quantities of an order that is already confirmed (for example, the size-wise split was entered wrong): open **Actions** and click **Amend Quantities**. Only an administrator sees this. The dialog lists every line with its **Style**, **Colour**, **Size**, **Allocated / Dispatched** and **Ordered** quantity; choose how to enter it — **Absolute** (type the corrected pieces in **New Qty**), **Percentage** (type a % per line and the **Total pcs**; the percentages must add up to 100) or **Ratio** (type a ratio per line, e.g. 1:2:3:3:2:1, and the **Total pcs**); in Percentage and Ratio the **New Qty** is worked out for you and always adds up to the total. Check **New total**, write a **Reason \***, and click **Save Quantities**. If a production order is linked and its sizes still match this sale order, it is updated to the new sizes too, along with its pending production run and size-wise labels. If its sizes had already been changed on the order page, it is left as it is and the message names it — correct those sizes on the order with **Edit Size Breakdown**.

## Validation traps
- Only the customer is required to create a new order — the **Create Sale Order** button stays disabled until one is picked. Items may be added afterwards.
- When you **edit** an existing order you cannot remove every line: an edit replaces the whole item list, so at least one must remain.
- In the Add Item dialog, Style, a quantity above zero and a unit price are required.
- Only **published (Active)** styles can be put on a sale order — a Draft style does not appear in the Style box or the Primary Style box until it is published from Styles. If a style you expect is missing, check its status there first.
- **Confirm** only appears while the order is Draft and has at least one item, and it is refused on an order with no items.
- The same style, colour and size on two lines must carry the same unit price — differing prices are refused, naming both.
- The delete (bin) icon on the list only works on Draft sale orders.
- **Start Production** only appears when the status is Confirmed or Partially Allocated, items exist, no live production order is linked already, and no unlinked production order already plans one of its styles (then **Link to Production Order** appears instead; Start Production is refused naming that order).
- A confirmed order cannot be changed with **Edit**; only **Amend Quantities** changes it, and only for an administrator. A line cannot go below what is already allocated or dispatched on it, **Save Quantities** stays disabled until something changed and a reason is written, and an order cannot be amended to zero pieces (cancel it instead).
- **Link to Production Order** copies the sizes only when the style has a colour. If the message says **This style has no colour yet**, the link is still made — set the style's Primary Color, then enter the sizes on the production order with **Add Size Breakdown**. Every line must have a size, and every style needs an approved cost sheet.
- Expected Delivery Date is required in the Start Production dialog. It pre-fills from the Expected Ship Date, or the buyer deadline when no ship date is set.
- A size cannot be dispatched beyond what the buyer ordered, unless the customer has an **Over-shipment allowed (%)** on the Customer page (5 lets 100 ordered ship as up to 105).
- **Allocate** only shows on lines that have a size; a size-less line shows "Set a size to allocate" instead. Allocation is limited to what the line still needs and only accepts stock of that exact style, colour and size.
- **Cancel Order** is refused once anything on the order has been dispatched, or while a production order is still live.
- Buyer POs can be added, removed or made primary only while the order is still live — not after it is Cancelled or Delivered. The same applies to attaching or removing a PO document.
- A PO number can only appear once on an order. Each delivery location has its own PO number, so add a separate PO per location.
- Only PDF, JPG and PNG files up to 10MB are accepted as a PO document. Uploading a new one replaces the old one.
- A delivery location must already be saved on the customer before it can be picked on a PO.

## Why the buyer's style code is saved on the line
The buyer's code is stored **with the order line**, not just on the style. If the buyer later
renumbers that style, existing orders and their invoices keep showing the code the goods were
actually ordered under, while new orders pick up the new code. Search finds the order either way.
Editing a style's Buyer Style Ref in Styles therefore does not disturb orders already placed.

## After saving
The status moves on its own: Draft → Confirmed → Partially/Fully Allocated → Partially Dispatched → Dispatched → Delivered. There is no way to type or edit the status by hand — it always follows from what actually happened to the items (confirm, allocation, dispatch, delivery). "Allocated" means stock is reserved but has not left; once a delivery note ships those pieces they stop counting as allocated and start counting as dispatched. Delivered is only stamped once every delivery note on the order has its proof of delivery recorded. Linked production orders appear in a **Production** card at the top. On the order page, in **Amend Quantities** and in the **Confirm** preview, lines are always listed style by style with sizes from XS upward, and the Items table has a **Season** column.
