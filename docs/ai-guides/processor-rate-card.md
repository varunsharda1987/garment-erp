---
slug: processor-rate-card
title: Manage Processor Rate Cards
keywords:
  # English
  - rate card
  - processor rate
  - dyeing rate
  - printing rate
  - processing cost
  - quantity slab
  - shrinkage
  - processing price
  - mill rate
  - fabric processing
  - lace dyeing
  # Hinglish
  - rate card banana
  - processor ka rate
  - dyeing ka rate
  - printing ka rate
  - slab banana
  - mill rate card
  - processing rate set karna
  # Devanagari
  - रेट कार्ड
  - प्रोसेसर रेट
  - डाइंग रेट
  - प्रिंटिंग रेट
  - स्लैब
  - प्रोसेसिंग कॉस्ट
  - मिल रेट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/ProcessorRateCardPage.tsx
  - frontend/src/components/processor-rate-card/ProcessorRateCardSummary.tsx
  - frontend/src/types/processorRateCardV2.types.ts
route: /processor-rate-cards
---

## Before you start

- Processors (dyeing/printing mills) must be created in Suppliers with processor type
- Greige fabrics must exist in Greige Master for fabric rate cards
- Greige laces must exist in Lace Master for lace rate cards

## How to access

Sidebar: Materials & Masters > Configuration > Processor Rate Cards

## Understanding the system

Rate cards define what a processor charges per meter for dyeing or printing fabric/lace. Rates vary by:
- **Material type**: Fabric or Lace
- **Processing type**: Dyeing or Printing (fabric only)
- **Printing sub-type**: Pigment, Procian, Discharge, or Pigment Discharge
- **Greige/Lace**: Each base material can have different rates
- **Quantity slabs**: Larger orders often get better rates

## Steps to create a rate card

### Step 1: Select material type

At the top, choose between:
- **Fabric** - for greige fabric processing rates
- **Lace** - for greige lace dyeing rates (lace only supports dyeing)

### Step 2: Select processing type (fabric only)

For fabric, choose:
- **Dyeing** - solid colour processing
- **Printing** - then select sub-type: Pigment, Procian, Discharge, or Pigment Discharge

### Step 3: Select processor

Choose a processor (mill) from the dropdown. The summary dashboard shows all processors with their configuration status:
- **Complete** - fully configured with rates
- **Partial** - some rates configured
- **Not Configured** - no rates set

### Step 4: Add quantity slabs

Slabs define price tiers based on order quantity (in meters).

1. Click "Add Slab" button in the table header
2. Enter min and max quantity (e.g., 0-500m, 500-2000m)
3. Click the checkmark to save the slab range

**Important**: Slabs auto-sort by min quantity. Rates are per meter within each range.

### Step 5: Add material rows

Click "Add Greige Row" (or "Add Lace Row" for lace mode):
1. Search for greige fabrics/laces in the popup
2. Select multiple items using checkboxes
3. Click "Add X Greige(s)" to add selected rows

### Step 6: Enter rates

For each greige/lace row:
1. Enter shrinkage percentage (fabric only) - used in costing calculations
2. Enter rate per meter for each quantity slab

Click "Save Changes" to persist all entries.

## Working with rate cards

### Copy rates between processors

1. Configure rates for one processor
2. Click "Copy to Another Processor"
3. Select target processor
4. Optionally check "Copy rates" (slabs always copy)
5. Click "Copy Structure"

This is useful when multiple processors have similar rates.

### Copy row data

To quickly apply the same rates to multiple greiges:
1. Click the clipboard icon on a configured row to copy
2. Click paste icon on other rows to apply same shrinkage + rates
3. Or click "Paste to New Greige" to add new rows with copied rates

### Default rates mode

Click "Default Rates" button to configure system-wide fallback rates:
- These rates apply when no processor is specified in Fabric Costing
- Useful for initial costing estimates before processor selection

### Edit slabs

Click on a slab header (e.g., "0-500m") to edit the range:
1. Modify min and max quantities
2. Click checkmark to confirm
3. Slabs auto-reorder based on min quantity

### Remove items

- **Remove slab**: Hover over slab header, click X (deletes rates for all materials in that slab)
- **Remove greige/lace row**: Click trash icon in Actions column

## Understanding the summary dashboard

When no processor is selected, the dashboard shows:
- **Stats cards**: Total processors, configured, complete, total greiges
- **Processor cards**: Click any to configure
- **Coverage bar**: Percentage of matrix filled with rates
- **Rate range**: Min and max rates configured

Filter and sort options:
- Search by processor name/code
- Filter by status (All, Complete, Partial, Not Configured)
- Sort by name, status, or coverage percentage

## Traps

- **Save before switching**: Unsaved changes block switching material type, processing type, or processor
- **Slab deletion warning**: Deleting a slab removes ALL rates for that quantity range
- **Shrinkage is per-processor**: Each processor can have different shrinkage for the same greige
- **Default shrinkage**: If not set, the greige master's average shrinkage is used as placeholder
- **Lace is dyeing only**: Lace rate cards only support dyeing (no printing option)
