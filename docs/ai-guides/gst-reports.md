---
slug: gst-reports
title: Generate GST Reports
keywords:
  # English
  - GST report
  - GSTR-1
  - GSTR-3B
  - GST filing
  - GST return
  - tax report
  - B2B invoices
  - HSN summary
  - input tax credit
  - ITC
  - outward supplies
  # Hinglish
  - GST report nikalna
  - GST return banana
  - tax report dekhna
  - filing ke liye report
  # Devanagari
  - जीएसटी रिपोर्ट
  - जीएसटीआर-1
  - जीएसटीआर-3बी
  - टैक्स रिपोर्ट
  - जीएसटी फाइलिंग
  - इनपुट टैक्स क्रेडिट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/GSTReports.tsx
route: /gst-reports
---

## How to access

1. Press **Ctrl+K** and search "GST Reports"
2. Or go to **Reports & Finance** > **Tax & GST** hub, then click GST Reports

## Steps to generate a report

1. Select the **From Date** and **To Date** for the period
2. Or use the quick-select buttons:
   - **This Month** - current calendar month
   - **Last Month** - previous calendar month
   - **This Quarter** - current quarter (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)
   - **This FY** - current financial year (April 1 to March 31)
3. Choose the report type tab: **GSTR-1** or **GSTR-3B**
4. Click **Generate Report**
5. The report data will load in the tables below

## Report types

### GSTR-1 (Outward Supplies)

Monthly/quarterly return for all outward supplies (sales). Shows:

- **Summary cards**: Total Invoices, Total Taxable Value, Total Tax, Total Invoice Value
- **B2B (Business to Business)**: Invoices to registered dealers with GSTIN
  - Shows: Customer GSTIN, Name, Invoice #, Date, Taxable Value, CGST, SGST, IGST, Total
- **B2CS (B2C Small)**: Supplies to unregistered consumers aggregated by place of supply
  - Shows: Place of Supply, Taxable Value, CGST, SGST, IGST
- **CDNR (Credit/Debit Notes - Registered)**: Credit and debit notes issued to registered dealers
  - Shows: Customer GSTIN, Name, Note #, Invoice #, Date, Value, Reason
- **HSN Summary**: Tax breakup by HSN code
  - Shows: HSN Code, Taxable Value, CGST, SGST, IGST, Total Tax

### GSTR-3B (Summary Return)

Monthly summary return with tax liability and ITC. Shows:

- **3.1 Outward Supplies & Outward Tax**: Total outward taxable supplies with CGST, SGST, IGST breakup
- **4. Eligible Input Tax Credit (ITC)**: ITC available from purchases (CGST, SGST, IGST)
- **6. Net Tax Payable**: Output Tax minus ITC = Net amount to pay
  - Separate rows for CGST, SGST, IGST
  - Total row shows grand total payable

## Tax terminology

| Term | Meaning |
|------|---------|
| CGST | Central GST - goes to central government |
| SGST | State GST - goes to state government |
| IGST | Integrated GST - for inter-state supplies |
| ITC | Input Tax Credit - tax paid on purchases that can be claimed |
| B2B | Business to Business - sales to registered dealers |
| B2CS | B2C Small - small value sales to unregistered consumers |
| HSN | Harmonized System of Nomenclature - product classification code |

## Traps

- **No data?** Make sure invoices exist for the selected period. Only finalized invoices appear
- **Wrong period**: Financial year runs April to March (not January to December)
- **Inter-state vs intra-state**: Same-state sales show CGST+SGST; different-state sales show IGST
- **Credit notes reduce tax**: CDNR entries reduce the total tax liability
- **HSN codes required**: Invoices without HSN codes will not appear in HSN Summary
