---
slug: invoice-view
title: View and Print an Invoice
keywords:
  # English
  - view invoice
  - print invoice
  - invoice detail
  - download invoice
  - invoice PDF
  - invoice Excel
  - send invoice WhatsApp
  - invoice status
  - payment history
  - record payment
  - push to tally
  - generate IRN
  - e-invoice
  # Hinglish
  - invoice dekhna
  - invoice print karna
  - bill nikalna
  - invoice download karna
  - payment record karna
  - tally push
  # Devanagari
  - इनवॉइस देखना
  - इनवॉइस प्रिंट करना
  - बिल निकालना
  - इनवॉइस डाउनलोड
  - पेमेंट रिकॉर्ड
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/InvoiceDetail.tsx
  - frontend/src/pages/InvoiceList.tsx
  - frontend/src/components/DocumentShareMenu.tsx
  - frontend/src/types/invoice.types.ts
route: /invoices
---

## Steps to find an invoice

1. Open **Orders & Sales > Invoices** in the sidebar.
2. Use the **search box** to search by invoice number.
3. Use the filters to narrow down:
   - **Customer dropdown** to filter by a specific customer.
   - **Status dropdown**: All Statuses, Pending, Partially Paid, Paid, Overdue, or Settled with Credit.
4. Click on an **invoice number** or the **View** button to open the invoice detail page.

## Steps to download or print

1. Open the invoice detail page (click on invoice number from the list).
2. Click the **Download** button in the top-right corner.
3. Choose from the dropdown:
   - **Download PDF** - Opens the Tax Invoice PDF in a new browser tab. Use the browser's print function (Ctrl+P) to print.
   - **Download Excel** - Downloads the invoice data as an Excel file.
   - **Send via WhatsApp** - Opens a dialog to send the PDF directly to a customer's phone via your linked WhatsApp number.

## Understanding invoice status

| Status | Meaning |
|--------|---------|
| **Pending** | Invoice created, no payment received yet |
| **Partially Paid** | Some payment received, balance still due |
| **Paid** | Fully paid, balance is zero |
| **Overdue** | Due date has passed and balance remains |
| **Settled with Credit** | Closed with a credit note adjustment |

## Invoice detail page sections

The detail page shows:

- **Summary cards** at the top: Status, Total Amount, Paid Amount, Balance.
- **Tally Status** (if pushed): Shows when it was pushed and the voucher number.
- **e-Invoice (IRN) Status** (if registered): Shows the IRN number, acknowledgment details, and a lock icon indicating the invoice is immutable.
- **Invoice Information**: Invoice Date, Due Date, Subtotal, Tax Amount, and Remarks.
- **Customer & Order Information**: Customer name, linked Order Number (click to navigate), Created By, and Created At.
- **Invoice Items**: Table with Description, HSN, Qty, Unit Price, Amount, GST %, Tax, and Total.
- **Tax Breakdown**: Subtotal, IGST (or CGST+SGST for intra-state), Total Tax, Grand Total.
- **Payment History**: Shows all recorded payments with amount, date, method, and reference.

## Available actions on invoice detail

- **Record Payment** - Available when balance > 0 and status is not PAID. Opens a dialog to enter amount, date, payment method (Cash, Cheque, Bank Transfer, UPI), reference number, and remarks.
- **Edit** - Available only when status is PENDING and no IRN has been generated.
- **Delete** - Available only when status is PENDING, no payments recorded, and no IRN generated.
- **Generate IRN** - Registers the invoice on the government e-Invoice portal. Once generated, the invoice is locked and cannot be edited or deleted.
- **Cancel IRN** - Available within 24 hours of IRN generation. Opens a dialog to select reason and enter remarks.
- **Push to Tally** / **Re-push to Tally** - Syncs the invoice to Tally accounting software.

## Sending invoice via WhatsApp

1. Click **Download** button.
2. Select **Send via WhatsApp**.
3. Enter the recipient's phone number (with country code, e.g., 919876543210).
4. Optionally add a message/caption.
5. Click **Send on WhatsApp**.

Note: Your WhatsApp must be linked in **Team & Settings > My WhatsApp** for this feature to work.

## Traps

- An invoice with **IRN generated** (e-Invoice registered) cannot be edited or deleted. A lock icon appears next to the IRN status. You can only cancel the IRN within 24 hours if needed.
- **Delete** button only appears for PENDING invoices with no payments and no IRN. Once any payment is recorded, the invoice cannot be deleted.
- Overdue status is shown in red. The due date text also appears in red when the invoice is past due.
- The **Download Excel** option is available only for Tax Invoices, not for other document types like Proforma Invoice or Order Form.
