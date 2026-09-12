---
slug: tally-setup
title: Set Up Tally Integration
keywords:
  # English
  - Tally integration
  - Tally setup
  - Tally sync
  - accounting integration
  - Tally connection
  - Tally ledger
  - push to Tally
  - Tally ERP
  # Hinglish
  - Tally setup karna
  - Tally connection karna
  - Tally me push karna
  - Tally settings
  # Devanagari
  - टैली इंटीग्रेशन
  - टैली सेटअप
  - टैली कनेक्शन
  - टैली में पुश करना
  - टैली सेटिंग्स
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/TallySettings.tsx
  - frontend/src/services/tally.service.ts
route: /settings/tally
---

## Before you start

1. TallyPrime must be running on a PC accessible over the network
2. In Tally, enable "Act as Server" (Gateway of Tally > F12 > Advanced Configuration > Act as Server = Yes)
3. Note the Tally PC's IP address and port (default 9000)
4. Know the exact company name as open in Tally

## Steps

### Navigate to Tally Integration

1. Click **Settings** in the sidebar
2. Click **Tally Integration**

### Configure Connection Settings

1. Toggle **Enable Tally integration** ON
2. Enter **Tally Host (IP)** - the IP address of the PC running Tally (e.g., 192.168.1.x)
3. Enter **Port** - default is 9000
4. Enter **Company Name** - must match exactly as open in Tally (case-sensitive)
5. Click **Test Connection** to verify - you should see:
   - Green checkmarks for connected company
   - List of open companies in Tally
   - Warnings for any missing ledgers

### Load Tally Data

Before configuring ledgers, load data from Tally:

1. Click **Load Ledgers** to fetch all ledgers from Tally
2. Click **Load Voucher Types** to fetch voucher types
3. Click **Load Groups** to fetch account groups
4. Once loaded, all dropdown fields will autocomplete as you type

### Configure Sales Voucher Settings

1. **Voucher Type** - typically "Sales"
2. **Party Group** - typically "Sundry Debtors"
3. **Sales Ledger (Intra-state)** - ledger for sales within same state (e.g., "Intrastate Sales @5%")
4. **Sales Ledger (Inter-state)** - ledger for sales to other states (e.g., "Interstate Sales @5%")

### Configure GST Output Ledgers

For 5% rate (apparel up to Rs 2,500/pc):
1. **CGST @2.5%** - Central GST output ledger
2. **SGST @2.5%** - State GST output ledger
3. **IGST @5%** - Integrated GST output ledger

For 18% rate (apparel above Rs 2,500/pc):
1. **CGST @9%** - Central GST output ledger
2. **SGST @9%** - State GST output ledger
3. **IGST @18%** - Integrated GST output ledger

### Configure Other Ledgers

1. **Round Off Ledger** - for invoice rounding (e.g., "Round Off")
2. **Freight Ledger** - for shipping charges (e.g., "Freight & Forwarding")

### Configure Inventory Settings

1. **Godown Name** - where stock is maintained in Tally (e.g., "Main Location")
2. **Stock Unit** - unit of measurement (e.g., "Pcs")

### Create Missing Ledgers

If Test Connection shows missing ledgers:
1. Click **Create Missing Ledgers**
2. System will create the configured ledgers in Tally
3. Connection will auto-test after creation

### Save Settings

1. Click **Save Settings** to store all changes
2. Green success message confirms settings saved

## Tally Tools

After setup, use these tools from the Tally Integration page:

- **Customer-Ledger Matching** - link ERP customers to Tally party ledgers
- **Supplier Matching** - link ERP suppliers to Tally creditor ledgers
- **Invoice Push** - push sales invoices to Tally
- **Credit Note Push** - push credit notes to Tally
- **Debit Note Push** - push debit notes to Tally
- **Receipt Push** - push customer payments to Tally
- **Outstanding Sync** - sync receivables from Tally

## Traps

- **Company name must match exactly** - including spaces and case; test connection shows available companies
- **Tally must be running** - connection fails if Tally is closed or "Act as Server" is disabled
- **Firewall may block** - ensure port 9000 (or your Tally port) is open between servers
- **Ledgers must exist** - use "Create Missing Ledgers" button before pushing vouchers
- **One company at a time** - if multiple companies are open in Tally, ensure the correct one is configured
- **GST rates must match** - configure both 5% and 18% ledgers for proper tax handling
