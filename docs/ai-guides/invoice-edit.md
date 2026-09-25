---
slug: invoice-edit
title: Edit a Draft Invoice
keywords:
  # English
  - edit invoice
  - modify invoice
  - change invoice
  - update invoice
  - draft invoice edit
  - edit line items
  - change due date
  - update invoice date
  # Hinglish
  - invoice edit karna
  - invoice me changes
  - bill update karna
  - invoice badalna
  - due date change karna
  # Devanagari (MANDATORY)
  - इनवॉइस एडिट
  - इनवॉइस बदलना
  - बिल अपडेट
  - इनवॉइस में बदलाव
  - ड्यू डेट बदलना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/InvoiceForm.tsx
  - frontend/src/pages/InvoiceDetail.tsx
route: /invoices
---

## Before you start

Only **PENDING** invoices can be edited. You cannot edit an invoice if:
- The invoice has any recorded payments
- The invoice status is PARTIALLY_PAID, PAID, or OVERDUE
- An IRN (e-Invoice) has been generated for the invoice (IRN-registered documents are legally locked)

## Steps

1. Open **Orders & Sales > Invoices** in the sidebar.

2. Find the invoice you want to edit:
   - Use the search box to search by invoice number
   - Or scroll through the list

3. Click on the invoice row to open the invoice detail page.

4. Click the **Edit** button in the top-right corner.
   - The Edit button only appears for PENDING invoices without an IRN

5. On the Edit Invoice page, you can modify:
   - **Invoice Date** - Change the invoice date
   - **Due Date** - Update the payment due date (required)
   - **Remarks** - Add or edit notes
   - The customer and order cannot be changed. An invoice raised from a delivery note for goods sold from stock has no production order — its Order box stays empty, and it can still be saved.

6. Edit line items as needed:
   - Click **Add Item** to add a new line
   - For each item, enter:
     - **Description** (required)
     - **HSN Code** (optional)
     - **Qty** (required, must be greater than 0)
     - **Unit Price** (required, must be greater than 0)
   - Click the trash icon to remove a line item
   - The **Amount** column calculates automatically (Qty x Unit Price)

7. Review the **Subtotal** at the bottom of the line items table.
   - GST will be calculated automatically when you save

8. Click **Update Invoice** to save your changes.

## Traps

- **Customer and Order cannot be changed** - These fields are locked in edit mode. If you need a different customer or order, delete this invoice and create a new one.

- **IRN-locked invoices cannot be edited** - Once an e-Invoice (IRN) is generated, the invoice is legally immutable. You will see a lock icon indicating this.

- **Partially paid invoices cannot be edited** - If any payment has been recorded, the Edit button will not appear.

- **Incomplete line items will be rejected** - Every line item must have a description, quantity greater than 0, and unit price greater than 0. Blank rows are ignored, but partially filled rows will show an error.

## After saving

- The invoice remains in PENDING status
- GST amounts (CGST/SGST or IGST) are recalculated based on HSN codes and customer state
- The total amount updates to reflect any changes to line items
- You can continue to edit the invoice until a payment is recorded or an IRN is generated

- **Buyer PO** under Customer & Order Information shows the customer's PO number and a **View PO** link to their PO document, when the invoice came from a sale order. It is read-only here — the PO and its document are managed on the sale order.
