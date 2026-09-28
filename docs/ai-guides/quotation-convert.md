---
slug: quotation-convert
title: Convert Quotation to Order
keywords:
  # English
  - convert quotation
  - quotation to order
  - accept quotation
  - confirm quote
  - accepted quotation
  - order from quotation
  - quote conversion
  # Hinglish
  - quotation se order banana
  - quote accept karna
  - order me convert
  - quotation convert karna
  - order banana quotation se
  # Devanagari (MANDATORY)
  - कोटेशन से ऑर्डर
  - कोटेशन कन्वर्ट
  - क्वोट एक्सेप्ट
  - ऑर्डर में बदलना
  - कोटेशन स्वीकार
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/QuotationDetail.tsx
  - frontend/src/pages/QuotationList.tsx
  - frontend/src/components/filters/FilterBar.tsx
  - frontend/src/components/filters/DateRangeFilter.tsx
  - frontend/src/components/SearchInput.tsx
  - frontend/src/components/CustomerCombobox.tsx
  - frontend/src/pages/OrderForm.tsx
  - frontend/src/pages/OrderList.tsx
  - backend/src/services/order.service.ts
  - backend/src/services/helpers/order-status.helper.ts
route: /quotations
---

## Before you start
A quotation must be in **Accepted** status before it can be converted to a production order. The workflow is: Draft → Sent → Accepted. You cannot convert a quotation that is still Draft, Sent, Rejected or Expired.

## Steps
1. Open **Orders & Sales → Quotations** in the sidebar.
2. Find the quotation you want to convert. Narrow the list with the filter row: the search box (quotation number, customer, style or buyer style), the **All customers** picker (type to find a customer), the **All statuses** dropdown (choose **Accepted** to see only quotations ready to convert), or the **Quotation date** range (a from date and a to date). **Clear N filters** removes them all and goes back to page 1. If nothing matches, the list says "No quotations match these filters." with a **Clear filters** button.
3. Click the quotation row or click **View** to open the quotation detail page.
4. If the quotation is in **Draft** status, first click **Mark as Sent** to move it to Sent status.
5. If the quotation is in **Sent** status, click **Accept** to move it to Accepted status. A confirmation dialog appears — click **Update Status** to confirm.
6. Once the status shows **Accepted**, the **Convert to Order** button appears in the header.
7. Click **Convert to Order**. This opens the **Create New Order** form with details pre-filled from the quotation.

## What gets copied
- **Customer** — the quotation's customer is pre-selected.
- **Style** — the first quoted item's style is pre-selected.
- **Unit Price** — the quoted price for that style is filled in.
- A note "Converted from quotation {quotation number}" is saved with the order. The form has no Remarks box, so you will not see it there.

The form has no Priority, Payment Terms or Shipping Address boxes; the printed order form takes the payment terms and ship-to address from the customer's own record.

## Multi-style quotations
A production order covers one style at a time. When the quotation has multiple styles, only the **first item's style** is used for the initial order. The saved note says how many styles were quoted, and you must create separate orders for the remaining styles.

## Complete the order
After conversion, you are on the new order form with the pre-filled data. You still need to:
1. Select or validate the **Cost Sheet** for the style.
2. Fill in sizes, colours and quantities. If this customer already has a confirmed sale order for the style, the form fills them (and the delivery date and price) from that sale order and links the order to it — see *Create a Production Order*.
3. Enter **Total Qty \*** and the **Delivery \*** date — both are required.
4. Click **Create Order** to save.

## Traps
- The **Convert to Order** button only appears when the quotation status is **Accepted** — not on Draft, Sent, Rejected or Expired quotations.
- Converting does not mark the quotation as "converted" or change its status — the quotation stays Accepted and can be converted again (creating another order from the same quote).
- Only the first quoted item is used; additional items require separate orders.
- The order is not saved automatically — you must complete the order form and click **Create Order**.

## After converting
The quotation remains in Accepted status. The new production order starts as **Pending** and its status moves by itself: **In Production** when a production run starts, **Completed** when the runs are done, **Dispatched** when everything has shipped. To find the orders made from a quotation, type the quotation number in the search box on **Orders & Sales → Orders** — it matches the saved note.
