---
slug: tax-master-create
title: Add a Tax Master
keywords:
  # English
  - tax master
  - GST rate
  - tax rate
  - add tax
  - create tax
  - IGST
  - CGST
  - SGST
  - CESS
  - TDS
  - TCS
  - HSN code
  - SAC code
  # Hinglish
  - tax rate add karna
  - GST rate dalna
  - tax master banana
  - naya tax rate
  # Devanagari
  - टैक्स मास्टर
  - जीएसटी रेट
  - टैक्स रेट
  - नया टैक्स
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/TaxMasterList.tsx
route: /tax-masters
---

## Steps

1. Go to **Reports & Finance** in the sidebar
2. Click **Tax & GST** to open the tax hub
3. Click **Tax Masters** (or search "Tax Masters" in Ctrl+K)
4. Click the **Add Tax Rate** button (top right)
5. Fill in the required fields:
   - **Tax Code** - unique identifier (e.g., GST_12, IGST_18)
   - **Tax Type** - select from GST, IGST, CGST, SGST, CESS, CUSTOM, TDS, or TCS
   - **Tax Name** - display name (e.g., "GST 12%")
   - **Tax Rate %** - the percentage rate (0-100)
   - **Applicable From** - start date for this rate
6. Optionally fill:
   - **HSN/SAC Code** - link to specific goods/services (e.g., 62114210)
   - **Description** - notes about when to use this rate
   - **Applicable To** - end date (leave blank for no end)
7. Click **Create** to save

## Traps

- **Tax Code must be unique** - you cannot have two rates with the same code
- **Applicable From is required** - every rate needs a validity start date
- **Applicable To blank = no expiry** - the rate stays active indefinitely
- **Deleting a rate deactivates it** - deletes mark the rate inactive, not removed from system
- **Type matters for GST filing** - use CGST+SGST for intra-state, IGST for inter-state; do not mix
