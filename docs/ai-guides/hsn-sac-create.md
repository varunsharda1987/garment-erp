---
slug: hsn-sac-create
title: Add HSN/SAC Code
keywords:
  # English
  - HSN code
  - SAC code
  - GST code
  - tax code
  - add HSN
  - add SAC
  - harmonized system nomenclature
  - services accounting code
  - GST rate
  - tax master
  # Hinglish
  - HSN code dalna
  - SAC code add karna
  - GST code banana
  - tax code dalna
  - HSN SAC master
  # Devanagari
  - एचएसएन कोड
  - एसएसी कोड
  - जीएसटी कोड
  - टैक्स कोड
  - एचएसएन जोड़ना
  - एसएसी जोड़ना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/HSNSACMasterList.tsx
route: /hsn-sac
---

## Before you start

Understand the difference between HSN and SAC codes:

| Type | Full Form | Used For | Example |
|------|-----------|----------|---------|
| **HSN** | Harmonized System Nomenclature | Goods (physical products) | 62114210 (Ladies Garments - Cotton) |
| **SAC** | Services Accounting Code | Services | 998361 (Dyeing Services) |

HSN/SAC codes are mandatory for GST invoicing. Each code carries a default GST rate (0%, 5%, 12%, 18%, or 28%) that auto-fills when you select it on invoices and purchase orders.

## Steps

### Navigate to HSN/SAC Masters

1. Press **Ctrl+K** to open the command palette
2. Type **"HSN"** or **"SAC"** and select **"HSN/SAC Codes"**
3. Or go to **Reports & Finance** > **Tax & GST** > click **HSN/SAC Codes**

### Add a new code

1. Click the **"Add Code"** button (top right)
2. A dialog opens with these fields:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **Code** | Yes | The HSN or SAC number (4-8 digits) | `62114210` |
| **Type** | Yes | Select HSN (Goods) or SAC (Services) | `HSN` |
| **Description** | Yes | What the code covers | `Ladies Garments - Cotton` |
| **Chapter** | No | HSN chapter number (first 2 digits) | `62` |
| **Section** | No | Category name | `Apparel` |
| **Default GST Rate %** | Yes | 0%, 5%, 12%, 18%, or 28% | `5%` |
| **Unit** | No | Default unit of measure | `PCS`, `MTR`, `KG` |

3. Click **"Create"** to save

### Edit an existing code

1. Find the code in the table (use the search box or Type filter)
2. Click the **pencil icon** in the Actions column
3. Update fields as needed
4. Click **"Update"** to save

### Delete a code

1. Click the **trash icon** in the Actions column
2. Confirm deletion in the dialog
3. Note: This deactivates the code rather than permanently deleting it

## Traps

- **Wrong type selection**: HSN is for goods (fabric, trims, garments), SAC is for services (dyeing, printing, stitching). Selecting the wrong type will cause GST filing issues.

- **Incorrect GST rate**: Verify the current GST rate for the code on the [GST Council website](https://cbic-gst.gov.in) before adding. Rates change with policy updates.

- **Missing chapter/section**: While optional, filling chapter and section helps organize and search codes. Chapter 62 = Articles of apparel (not knitted), Chapter 61 = Knitted/crocheted apparel.

- **Code already exists**: If you get a duplicate error, search for the existing code using the search box. It may be inactive.

## Common HSN codes for garments

| Code | Description | GST Rate |
|------|-------------|----------|
| 62114210 | Ladies blouses - cotton | 5% |
| 62114290 | Ladies blouses - other | 5% |
| 62044200 | Women's dresses - cotton | 5% |
| 61099010 | T-shirts - knitted cotton | 5% |
| 62034200 | Men's trousers - cotton | 5% |
| 58042100 | Lace - mechanically made | 12% |
| 52030000 | Cotton carded or combed | 5% |

## Common SAC codes for services

| Code | Description | GST Rate |
|------|-------------|----------|
| 998361 | Textile dyeing services | 5% |
| 998362 | Textile printing services | 5% |
| 998363 | Fabric finishing services | 5% |
| 998821 | Tailoring/stitching services | 5% |
