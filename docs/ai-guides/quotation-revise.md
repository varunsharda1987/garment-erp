---
slug: quotation-revise
title: Revise a Quotation
keywords:
  # English
  - revise quotation
  - edit quotation
  - update quote
  - modify quotation
  - quotation revision
  - change quotation
  - quotation edit
  - update quotation
  # Hinglish
  - quotation edit karna
  - quote update karna
  - quotation me badlav
  - quotation change karna
  - quote revise karna
  # Devanagari
  - कोटेशन एडिट
  - कोटेशन अपडेट
  - भाव बदलना
  - कोटेशन में बदलाव
  - कोटेशन संशोधन
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/QuotationForm.tsx
  - frontend/src/pages/QuotationDetail.tsx
route: /quotations
---

## Before you start

- Only quotations with status **Draft** can be edited
- Once a quotation is marked as **Sent**, **Accepted**, **Rejected**, or **Expired**, it cannot be revised
- The **Customer** field cannot be changed after creation - you must create a new quotation for a different customer

## Steps

1. Open **Orders & Sales > Quotations** in the sidebar.

2. Find the quotation you want to revise and click on its row to open the detail page.

3. Verify the quotation shows status **Draft** - the **Edit** button only appears for draft quotations.

4. Click the **Edit** button in the top-right action bar.

5. The **Edit Quotation** form opens with existing values pre-filled.

6. Update the header details as needed:
   - **Quotation Date** - date of the quotation
   - **Valid Until** - expiry date for the quote (required)
   - **Remarks** - additional notes
   - **Terms and Conditions** - payment terms, delivery conditions

7. Modify quotation items:
   - Change the **Style** selection from the dropdown
   - Update **Quantity** (must be greater than 0)
   - Adjust **Unit Price** 
   - Set **Delivery Days** for lead time
   - Add **Description** for item specifications
   - Click **Add Item** to include more line items
   - Click the trash icon to remove an item (at least one item required)

8. Review the **Quotation Total** at the bottom - GST is calculated automatically on save.

9. Click **Update Quotation** to save changes.

10. The system shows "Quotation updated - Quotation has been successfully updated" and returns to the quotations list.

## Traps

- **Customer locked**: The customer cannot be changed once a quotation is created - create a new quotation instead
- **Status restriction**: Edit is only available for **Draft** quotations - sent or responded quotations are locked
- **Minimum items**: At least one quotation item is required - cannot remove the last item
- **Validation**: Each item needs a style, quantity greater than 0, and unit price of 0 or more
- **GST auto-calc**: Tax is estimated automatically based on customer state and HSN codes - not editable directly

## After saving

- The quotation retains its original **Quotation Number**
- Updated values are reflected immediately in the detail page
- GST breakdown (CGST/SGST or IGST) is recalculated based on item changes
- The quotation remains in **Draft** status until you click **Mark as Sent**
- Version history is not maintained - changes overwrite existing data
