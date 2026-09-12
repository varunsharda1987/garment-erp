---
slug: tally-push-invoices
title: Push Invoices to Tally
keywords:
  # English
  - push to Tally
  - Tally invoices
  - sync invoices
  - Tally export
  - invoice voucher
  - push sales invoice
  - Tally integration
  - bulk push
  - re-push invoice
  # Hinglish
  - Tally mein bhejne
  - invoice push karna
  - Tally sync karna
  - invoice voucher banana
  - bulk mein push
  # Devanagari
  - टैली में भेजना
  - इनवॉइस पुश
  - टैली सिंक
  - वाउचर बनाना
  - बल्क पुश
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/TallyInvoices.tsx
  - frontend/src/services/tally.service.ts
  - frontend/src/types/tally.types.ts
  - frontend/src/pages/TallySettings.tsx
route: /settings/tally/invoices
---

## Before you start

1. **Tally must be running** on the configured host/port (default: localhost:9000)
2. **Tally settings configured**: Go to Team & Settings > Tally Integration > verify connection settings (host, port, company name, ledger mappings)
3. **Customer must be linked**: The invoice's customer must be matched to a Tally ledger via Team & Settings > Tally Integration > Customer-Ledger Matching

## Steps

### Navigate to Invoice Push

1. Click **Team & Settings** in the sidebar
2. Click **Tally Integration**
3. On the Tally Settings page, click **Invoice Push** in the Tally Tools card
   - Or go directly to `/settings/tally/invoices`

### Push a single invoice

1. Find the invoice in the list (use search or filter by status)
2. Check the status column:
   - **Pending** = ready to push (customer linked, not yet pushed)
   - **Pushed** = already in Tally (shows date/time)
   - **Customer Not Linked** = must link customer first
   - **Error** = previous push failed (hover to see error)
3. Click the **Upload** icon button on the invoice row
4. On success: shows "Pushed" with the Tally voucher number

### Push multiple invoices at once

1. Use the checkbox column to select invoices
   - Only invoices with status "Pending" can be selected
   - Use the header checkbox to select all pushable invoices on the page
2. Click **Push X Selected** button in the header
3. System pushes invoices one by one and reports success/failure count

### Re-push an invoice

If an invoice was already pushed but you need to update it in Tally:
1. Find the invoice with "Pushed" status
2. Click the **Upload** icon button
3. The invoice will be pushed again (updates the existing voucher or creates new)

### Filter invoices

Use the status dropdown to filter:
- **All Invoices** = show everything
- **Not Pushed** = pending invoices ready to push
- **Pushed** = invoices already synced to Tally
- **With Errors** = invoices that failed to push

## Traps

- **"Customer Not Linked"**: You must link the customer to a Tally ledger first. Go to Team & Settings > Tally Integration > Customer-Ledger Matching. Search for the customer, select the matching Tally ledger, and click Link.

- **Tally must be running**: If Tally is closed or the company is not open, push will fail. Open Tally, load the correct company, then retry.

- **Wrong voucher type**: If invoices create wrong voucher types in Tally, check the voucher type setting in Tally Settings (default: "Sales").

- **GST ledger errors**: If push fails with ledger errors, verify the GST ledger mappings (CGST, SGST, IGST) in Tally Settings match your Tally ledger names exactly.

- **Re-push creates duplicates**: Some Tally configurations may create duplicate vouchers when re-pushing. Check Tally settings for how duplicate invoice numbers are handled.
