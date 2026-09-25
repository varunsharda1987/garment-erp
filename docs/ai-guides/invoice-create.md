---
slug: invoice-create
title: Create a Sales Invoice
keywords:
  # English
  - invoice
  - sales invoice
  - billing
  - bill
  - tax invoice
  - create invoice
  - new invoice
  - generate invoice
  - customer invoice
  - GST invoice
  # Hinglish
  - invoice kaise banaye
  - bill banana
  - sales ka invoice
  - invoice banao
  - naya invoice
  - bill kaise banaye
  - customer ka bill
  # Devanagari
  - इनवॉइस
  - बिल
  - सेल्स इनवॉइस
  - टैक्स इनवॉइस
  - इनवॉइस कैसे बनाये
  - बिल बनाना
  - नया इनवॉइस
  - कस्टमर बिल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/InvoiceForm.tsx
  - frontend/src/pages/InvoiceList.tsx
  - backend/src/schemas/invoice.schema.ts
route: /invoices/new
---

## Before you start

1. **Customer must exist** - The customer you want to invoice must already be in the system
2. **Order must exist** - An invoice made on this page is linked to a production order; create the order first
3. **Goods shipped on a delivery note?** Raise the invoice from the delivery note instead: once its proof of delivery is recorded, open the note and click **Create Invoice**. It bills exactly what the buyer received at the sale order price, and links the invoice to the note (see *Invoice from a delivery note*)

## Steps

1. Open **Orders & Sales -> Invoices** in the sidebar.

2. Click the **New Invoice** button (top right).

3. Fill in the **Invoice Details** section:
   - **Customer** * - Select the customer from the dropdown (type to search)
   - **Order** * - Once customer is selected, choose the order to invoice (shows order number and total amount)
   - **Invoice Date** - Defaults to today; change if needed
   - **Due Date** * - Select when payment is expected
   - **Remarks** - Optional notes (max 500 characters)

4. Review the **Line Items** section:
   - When you select an Order, items are **auto-populated** from that order (style, quantity, unit price)
   - To add items manually, click **Add Item**
   - For each line item:
     - **Description** * - Item description (auto-filled from style if from order)
     - **HSN Code** - Harmonized System Nomenclature code for GST
     - **Qty** * - Quantity (positive number, max 10 lakh units)
     - **Unit Price** * - Price per unit in Rupees
     - **Amount** - Calculated automatically (Qty x Unit Price)
   - Click the trash icon to remove a line item

5. Review the **Subtotal** at the bottom:
   - GST is calculated automatically when you save, based on HSN codes and customer's state
   - The form shows "GST (auto-calculated on save)"

6. Click **Create Invoice** to save.

## Traps

- **Every line must be complete** - Description, Qty, and Unit Price are all required for each row; incomplete rows will block save
- **At least one line item required** - Empty invoices cannot be saved
- **Customer and Order are locked in edit mode** - You cannot change these after invoice creation
- **GST calculated from HSN + customer state** - If HSN codes are missing, GST may not calculate correctly
- **Delete only allowed for unpaid PENDING invoices** - Once a payment is recorded, the invoice cannot be deleted

## After saving

- **Invoice number generated** - System assigns a unique invoice number (e.g., INV-2026-0001)
- **Status is PENDING** - New invoices start with Pending status
- **View the invoice** - You're redirected to the invoice list; click the invoice number to view details
- **Print or download** - From the invoice detail page, you can print the tax invoice or generate PDF
- **Record payments** - Track payments against the invoice from the detail page
- **E-Invoice (IRN)** - If e-invoicing is enabled, generate the IRN from Team & Settings -> GST e-Invoice

## Status meanings

| Status | Meaning |
|--------|---------|
| Pending | No payment received yet |
| Partially Paid | Some payment received, balance remaining |
| Paid | Full amount received |
| Overdue | Due date passed, payment still pending |
| Settled with Credit | Closed using credit note adjustment |
