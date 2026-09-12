---
slug: reports-view
title: View Standard Reports
keywords:
  # English
  - reports
  - style report
  - fabric report
  - style fabric report
  - fabric usage report
  - GST reports
  - GSTR-1
  - GSTR-3B
  - analytics
  - stock availability
  - can make garments
  - bottleneck
  # Hinglish
  - report dekhna
  - report nikalna
  - fabric ka report
  - style ka report
  - GST report nikalna
  - kitna bana sakte
  # Devanagari
  - रिपोर्ट
  - रिपोर्ट देखना
  - रिपोर्ट निकालना
  - फैब्रिक रिपोर्ट
  - स्टाइल रिपोर्ट
  - जीएसटी रिपोर्ट
  - कितना बना सकते
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/StyleFabricReport.tsx
  - frontend/src/pages/FabricUsageReport.tsx
  - frontend/src/pages/GSTReports.tsx
route: /reports
---

## Available reports

The system provides three main report types:

1. **Style-Fabric Report** - Shows fabric stock and production capacity per style
2. **Fabric Usage Report** - Shows which styles use each fabric and consumption history
3. **GST Reports** - GSTR-1 and GSTR-3B tax compliance reports

## Steps to view Style-Fabric Report

1. Go to **Reports & Finance** in the sidebar
2. Click **Style-Fabric Report**
3. Use filters at the top:
   - **Search**: Type style code or name
   - **Buyer**: Filter by customer
   - **Season**: Filter by season
   - **Stock Status**: All / Has Stock / Low Stock / No Stock
4. Click any row to expand and see fabric details
5. The expanded view shows:
   - Component name and fabric code
   - Required meters per garment
   - Available and reserved stock
   - **Can Make** column shows how many garments possible
   - Bottleneck indicator marks the limiting fabric
6. Click **Add Fabric Stock** to add stock for that style
7. Click **View Details** to open the style

## Steps to view Fabric Usage Report

1. Go to **Reports & Finance** in the sidebar
2. Click **Fabric Usage Report**
3. Use filters:
   - **Search**: Type fabric code or name
   - **Filter by style reference**: Type to filter
4. Click any fabric row to expand
5. The expanded view shows two sections:
   - **Styles using this fabric**: Style code, buyer ref, component, CAD meters, allocated, consumed
   - **Stock History**: Receipt records with quantity, width, roll numbers, warehouse, cost, date
6. The badge shows number of styles using each fabric

## Steps to view GST Reports

1. Go to **Reports & Finance** in the sidebar
2. Click **Tax & GST**
3. Navigate to GST Reports or go directly to `/gst-reports`
4. Select date range:
   - Use From/To date pickers, OR
   - Click quick-select: **This Month**, **Last Month**, **This Quarter**, **This FY**
5. Choose report tab:
   - **GSTR-1**: Sales/outward supplies
   - **GSTR-3B**: Summary return
6. Click **Generate Report**

### GSTR-1 sections
- **Summary cards**: Total invoices, taxable value, tax amount, invoice value
- **B2B**: Business-to-business invoices with GSTIN, customer, amounts
- **B2CS**: B2C small (unregistered) sales by place of supply
- **CDNR**: Credit/debit notes for registered customers
- **HSN Summary**: Tax breakup by HSN code

### GSTR-3B sections
- **3.1 Outward Supplies**: Taxable value and tax breakup (CGST/SGST/IGST)
- **4 Eligible ITC**: Input tax credit from purchases
- **6 Net Tax Payable**: Output tax minus input credit = amount to pay

## Understanding the data

### Style-Fabric Report
- **Can Make**: Minimum garments possible based on ALL fabric stocks
- **Bottleneck**: The fabric limiting production (shown in red with "(Bottleneck)" label)
- **Stock Status badges**:
  - Green "In Stock": Can make 50+ garments
  - Yellow "Low Stock": Can make 1-49 garments
  - Red "No Stock": Cannot make any garments

### Fabric Usage Report
- **CAD (meters)**: Fabric required per garment from CAD planning
- **Allocated**: Stock reserved for orders
- **Consumed**: Stock actually used in production

## Traps

- **Stock data loads on expand**: Click a row first to load its stock details (saves time on large lists)
- **Filters work together**: Clear one filter if you see no results when combined
- **GST reports require date range**: Reports won't generate without From and To dates
- **Financial year is April-March**: "This FY" uses Indian financial year (Apr 1 - Mar 31)
- **B2CS shows place-wise totals**: Not individual invoices, aggregated by state
- **Generate button must be clicked**: Changing dates or tabs doesn't auto-refresh the data
