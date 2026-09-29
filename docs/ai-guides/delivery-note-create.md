---
slug: delivery-note-create
title: Create a Delivery Note (DN) for Dispatch
keywords:
  # English
  - delivery note
  - dispatch
  - DN
  - shipment
  - shipping
  - delivery
  - send goods
  - finished goods dispatch
  - customer delivery
  - create DN
  - dispatch sale order
  - ship sale order
  - dispatched quantity
  - over shipment
  - extra pieces
  - not enough stock
  - stock short
  - admin override
  - finished goods not available
  # Hinglish
  - delivery note kaise banaye
  - dispatch karna
  - maal bhejana
  - shipment banana
  - customer ko maal bhejna
  - DN banana
  - sale order ka maal bhejna
  - extra maal bhejna
  - dispatched quantity nahi badh rahi
  - stock kam hai delivery note nahi ban raha
  - maal stock mein nahi hai
  # Devanagari
  - डिलीवरी नोट
  - डिस्पैच
  - माल भेजना
  - शिपमेंट
  - डीएन बनाना
  - ग्राहक को माल भेजना
  - तैयार माल भेजना
  - सेल ऑर्डर का माल भेजना
  - ज़्यादा माल भेजना
  - स्टॉक कम है
  - एडमिन ओवरराइड
  # No colour
  - no colour
  - style has no colour
  - colour optional
  - style and size are required
  - comes in several colours choose one
  - bina colour ke dispatch
  - colour nahi hai
  - बिना रंग
  - रंग नहीं है
  - रंग चुनें
  # Style code
  - buyer style code
  - buyer ka style code
  - बायर स्टाइल कोड
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/DispatchDeliveryNoteForm.tsx
  - frontend/src/pages/SaleOrderDetail.tsx
  - backend/src/schemas/dispatch.schema.ts
  - backend/src/controllers/dispatch.controller.ts
  - backend/src/services/helpers/sale-order-dispatch.helper.ts
  - frontend/src/components/AdminOverrideModal.tsx
  - frontend/src/pages/DispatchList.tsx
  - backend/src/services/helpers/sku-colour.helper.ts
  - frontend/src/components/OrderCombobox.tsx
  - frontend/src/components/CustomerCombobox.tsx
  - frontend/src/components/ui/combobox.tsx
route: /manufacturing/dispatch/delivery/new
---

## Before you start

1. The **Order** must exist in the system with at least one item that has a size breakup (Style / Size / Quantity — plus the colour when the style has one).
2. The **Customer** must be linked to the order (or you can select a different customer).
3. **Finished Goods (FG) Stock** must cover every size you dispatch. Finished goods reach stock when Finishing clicks **Generate Transfer Slip**. If stock is short, the note is **not created** — see *Traps*.

## Steps

1. Open **Manufacturing > Dispatch** in the sidebar.

2. Click **New Delivery Note** (top-right button) or use the **Create Delivery Note** action (package icon) on an approved ASN in the **ASN Applications** tab.
   From a sale order you can also open **Actions** → **Create Delivery Note** on the sale order page (see *Dispatching a sale order* below).

3. In the **Delivery Details** card:
   - Click **Order *** ("Select order...") and type part of the order number, customer, buyer style code or style code, then pick the order. Each order lists its styles under it, Buyer Style Code first (e.g. `SP27DR27 (EBWW-021)`). Newest orders come first; if the list says **Showing … of …**, keep typing to bring up an older one.
   - The **Customer *** auto-fills from the selected order. To change it, click the box and type part of the customer code or name.
   - Set the **Delivery Date *** (defaults to today).

4. In the **Items** card:
   - The system pre-fills items from the order's SKU breakup.
   - For each row, verify or select:
     - **Style** — click the box ("Select style") and type part of the buyer style code, style code or name; only the styles on the order are listed. Each reads e.g. `SP27DR27 (EBWW-021) — Style Name` (our Style Code in brackets only when it differs). Against a sale order, the buyer style code is the one captured on the sale order line
     - **Color** (from the selected style's colours). A style with no colour shows **—** here and the box is greyed out — leave it. A style that comes in several colours must have one chosen.
     - **Size** (from the selected style's size options)
     - **Quantity** (number of pieces to dispatch)
   - Click **Add Item** to add more rows.
   - Click the trash icon to remove a row.

5. Optionally, add notes in the **Remarks** field.

6. Click **Create Delivery Note** to save.

## Dispatching a sale order

On the sale order page, open **Actions** and click **Create Delivery Note** (shown while the order is Confirmed, Partially/Fully Allocated or Partially Dispatched).
- If a production order is linked to the sale order, the form opens with that **Order** already selected.
- If there is no production order (goods sold from finished-goods stock), the form opens with the **Sale Order** shown in place of the Order box, and the items are pre-filled with what each sale order line still has to ship. A line ordered without a colour is filled with the style's colour when the style has only one, and stays without a colour (**—**) when the style has none.

Either way the page says **Booked against sale order …**: when you click **Create Delivery Note**, the sale order's **Dispatched** quantities go up and its status moves to Partially Dispatched / Dispatched. A delivery note for a production order that is linked to a sale order is always booked against that sale order, even when you start from **Manufacturing > Dispatch**.

## Creating from an ASN

When you click **Create Delivery Note** from an approved ASN:
- The form opens with `?asnId=...` in the URL.
- The order and items are pre-filled from the ASN's shipment plan.
- The remarks auto-populate with "Against ASN {number}".
- The delivery note is linked to the ASN. Once it is dispatched, the ASN page's **Dispatched against this ASN** card counts it per size.
- Only an **Approved** ASN of the same production order can be used; any other is refused.

## Traps

- Every item row needs **Style** and **Size** — otherwise "Item N: style and size are required". **Color** is optional: only a style that comes in several colours needs one picked ("Item N: this style comes in several colours — choose one").
- A row left without a colour on a style that has only one colour is saved in that colour, so it counts against the order's sizes as usual.
- Finished-goods stock with no colour (from a style with no colour) can ship against any row of that style and size, whatever colour the row names.
- **Quantity** must be a positive whole number (no decimals, no zero).
- You need at least one item row with valid data. An empty items list blocks submission.
- If FG stock does not cover a size, the note is **refused** and nothing is saved. A red box lists each short size, style named Buyer Style Code first (e.g. "SP27DR27 (EBWW-021) Red M: need 50, in stock 30"). Record finishing first (**Generate Transfer Slip**), or ask an administrator: an admin sees **Create anyway (admin override)** and must write a reason (at least 10 characters), which is saved on the note.
- Stock reserved (allocated) for this sale order is used first. Stock reserved for a **different** sale order is never taken, even if it is on the shelf.
- A size cannot ship more than the buyer ordered — unless the customer has an **Over-shipment allowed (%)** set on the Customer page (for example 5 lets 100 ordered ship as up to 105). Anything above that is refused, naming the size and how many can still go.
- Against a sale order, every row must match one of its lines: same style and size, and the colour must match — or the line was ordered without a colour, or (for a row with no colour) the sale order has only one line of that style and size. Otherwise it is refused ("… has no line for [style] size [size] in that colour.").
- Changing the **Style** on a row clears the Color and Size selections because they depend on the style.

## After saving

- The delivery note is created with status **PENDING**.
- You return to the Dispatch list page.
- From the list, you can:
  - **Dispatch** the note (mark it as in-transit).
  - **Cancel** it while it is still Pending (made by mistake): the stock and the sale order's Dispatched quantity go back, and the note stays in the list marked Cancelled.
  - **Record POD** (Proof of Delivery) when the customer receives the goods.
  - **Invoice** once the POD is recorded and the note is Delivered — it opens the note with **Create Invoice**.
- When the note is booked against a sale order, that sale order's **Dispatched** quantity and status update straight away (the House of Kasya B2B app sees the same numbers).
