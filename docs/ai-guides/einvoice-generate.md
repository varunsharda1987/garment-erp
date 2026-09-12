---
slug: einvoice-generate
title: Generate e-Invoice (IRN)
keywords:
  # English
  - e-invoice
  - IRN
  - einvoice
  - GST e-invoice
  - invoice registration number
  - generate IRN
  - cancel IRN
  - e-invoice settings
  - IRP
  - invoice registration portal
  - QR code
  - e-invoicing
  - bulk IRN
  # Hinglish
  - e-invoice generate karna
  - IRN banana
  - IRN kaise banaye
  - e-invoice cancel karna
  - e-invoice settings
  - bulk IRN generate
  # Devanagari
  - ई-इनवॉइस
  - आईआरएन
  - ई-इनवॉइस जनरेट करना
  - आईआरएन बनाना
  - जीएसटी ई-इनवॉइस
  - आईआरएन कैंसल करना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/EInvoiceInvoices.tsx
  - frontend/src/pages/EInvoiceSettings.tsx
  - frontend/src/services/einvoice.service.ts
  - frontend/src/types/einvoice.types.ts
route: /settings/einvoice/invoices
---

## Before you start

1. **B2B invoices only** - e-Invoice IRN is generated only for B2B invoices (customer must have GSTIN). B2C invoices (no GSTIN) are not eligible.
2. **Invoice must be created first** - Create the invoice in the ERP before generating IRN.
3. **Settings must be configured** - API credentials and seller GSTIN must be set up in e-Invoice Settings.
4. **Mode selection** - Choose Sandbox for testing or Production for live IRNs. Production mode registers legally binding IRNs.

## Steps

### Configure e-Invoice Settings (one-time setup)

1. Go to **Team & Settings** > **GST e-Invoice** in the sidebar
2. Enable the **Enable e-Invoicing** toggle
3. Select **Mode**:
   - **Sandbox** - for testing (IRNs are not real)
   - **Production** - for live, legally binding IRNs
4. Enter your **Seller GSTIN**
5. Fill in API credentials (from e-Invoice portal > API Registration):
   - Client ID
   - Client Secret
   - API Username
   - API Password
6. Paste the **NIC Public Key** (download from portal after login)
7. Click **Save Settings**
8. Click **Test Connection** to verify credentials work

### Generate IRN for an invoice

1. From e-Invoice Settings page, click **IRN Generation** button (or go directly to Team & Settings > GST e-Invoice > IRN Generation via search)
2. Find your invoice using:
   - **Search** - by invoice number, customer name, or IRN
   - **Filter** - by status (All / Not Generated / Generated / Cancelled / With Errors)
3. **Run Preflight Check** (clipboard icon) - checks if invoice data is complete before generating
   - Shows problems that must be fixed
   - Shows warnings (non-blocking)
4. Click the **QR code icon** to generate IRN for that invoice
5. On success: IRN appears in the table, invoice is now locked

### Bulk generate IRNs

1. Use checkboxes to select multiple invoices (only pending invoices can be selected)
2. Click **Generate X Selected** button at the top
3. System generates IRNs one by one and shows success/failure count

### Cancel an IRN

1. Find the invoice with Generated status
2. Click the **ban icon** (only visible within 24 hours of generation)
3. Select a **Reason**:
   - Duplicate
   - Data entry mistake
   - Order cancelled
   - Others
4. Enter **Remarks** (minimum 3 characters)
5. Click **Cancel IRN**

**Warning:** Cancelled IRNs cannot be undone. The same invoice number can never be registered again on the IRP.

## How it works with Tally

1. Create invoice in ERP
2. Generate IRN here - invoice becomes locked (IRP only allows cancellation within 24h, never edits)
3. Push to Tally - voucher carries the IRN, so Tally records it as already e-invoiced
4. Invoice PDF automatically shows IRN and signed QR code

## Traps

- **B2C invoices not eligible** - If customer has no GSTIN, invoice shows "B2C - not eligible" badge and cannot generate IRN
- **24-hour cancel window** - IRN can only be cancelled within 24 hours of generation. After that, you must issue a Credit Note.
- **Invoice locks after IRN** - Once IRN is generated, invoice cannot be edited. Cancel the IRN first (within 24h) or issue Credit Note.
- **Sandbox vs Production keys differ** - Download the correct public key from the portal for your mode. Using wrong key = auth failure.
- **Saved secrets show as dots** - Existing secrets display as "........" - leave them unchanged to keep current value, submit empty to clear.
- **Test before going live** - Use Sandbox mode first to verify the integration works before switching to Production.
