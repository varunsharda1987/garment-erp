---
slug: lace-defect-create
title: Record a Lace Defect
keywords:
  # English
  - lace defect
  - lace damage
  - quality issue
  - lace rejection
  - weave defect
  - color variation
  - width variation
  - lace claim
  - defect log
  - record defect
  # Hinglish
  - lace kharab
  - defect dalna
  - lace mein problem
  - claim submit karna
  - quality issue dalna
  # Devanagari
  - लेस डिफेक्ट
  - लेस खराबी
  - क्वालिटी इश्यू
  - लेस में प्रॉब्लम
  - डिफेक्ट डालना
  - क्लेम करना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/LaceDefectForm.tsx
  - frontend/src/pages/LaceDefectList.tsx
  - frontend/src/types/laceDefect.types.ts
route: /laces/defects/new
---

## Before you start

- The lace stock lot must already exist in the system (received via GRN)
- You need the Trim Masters permission to access this page

## Steps

1. Go to **Masters > Lace Defects**
2. Click the **Log Defect** button (top right)
3. Select the **Stock Lot** from the dropdown (shows lace name, lot number, and available quantity)
4. Choose the **Defect Type**:
   - Weave Defect - issues in the weave pattern
   - Color Variation - shade or color inconsistency
   - Width Variation - lace width not as specified
   - Damage - physical damage to the lace
5. Enter the **Defect Quantity** in meters
6. Select **Discovered At** (where the defect was found):
   - Receiving - during GRN inspection
   - Cutting - during cutting process
   - Stitching - during garment assembly
   - Quality Check - during QC inspection
7. Optionally add a **Description** for details
8. Optionally link to an **Order ID** or **Style ID** if related
9. Click **Log Defect** to save

## Submit a claim

After logging a defect, submit a supplier claim:

1. Go to **Masters > Lace Defects**
2. Find the defect row (status will be "Pending")
3. Click the **$** (dollar) icon in the Actions column
4. Enter the **Claim Reference** (e.g., CLM-2024-001)
5. Enter the **Claim Amount** in INR
6. Optionally add notes
7. Click **Submit Claim**

## Claim workflow

| Status | Meaning | Next actions |
|--------|---------|--------------|
| Pending | Defect logged, no claim yet | Submit Claim |
| Submitted | Claim sent to supplier | Approve or Reject |
| Approved | Supplier accepted claim | Mark Resolved |
| Rejected | Supplier denied claim | Mark Resolved |
| Resolved | Claim closed | None |

## Traps

- **Quantity cannot exceed available stock** - the system limits defect qty to the lot's available meters
- **Order/Style IDs must be valid UUIDs** - leave blank if you do not know them; partial text will be rejected
- **Claims need both reference and amount** - you cannot submit a claim without both fields

## After saving

- The defect is recorded against that stock lot
- Summary cards on the list page update (Total Defects, Pending Claims, etc.)
- You can filter by defect type, claim status, or discovery stage to track claims
- Click the eye icon to view full defect details including resolution history
