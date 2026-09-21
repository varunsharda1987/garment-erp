---
slug: challan-receive
title: Receive Against a Challan
keywords:
  # English
  - receive challan
  - challan receipt
  - challan receive
  - material receive
  - inward challan
  - receive goods
  - challan inward
  - partial receive
  - damaged quantity
  - receive material
  # Hinglish
  - challan receive karna
  - maal wapas aaya
  - challan ka maal lena
  - challan inward karna
  - maal receive karna
  - processor se maal aaya
  # Devanagari
  - चालान रिसीव
  - माल वापसी
  - इनवर्ड चालान
  - चालान का माल लेना
  - माल रिसीव करना
  - प्रोसेसर से माल आया
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/ChallanDetail.tsx
  - frontend/src/pages/ChallanList.tsx
route: /manufacturing/challans
---

## Before you start

- A challan must exist with status **Issued**, **In Transit**, or **Partially Received**.
- You need the **challans** permission.
- Know the actual quantities received and any damaged quantities.

## Steps

1. Open **Manufacturing → Challans** in the sidebar.

2. Find the challan to receive against:
   - Use the search box to search by challan number, processor name, or remarks.
   - Filter by **Status** dropdown — select **Issued**, **In Transit**, or **Partially Received** to see receivable challans.
   - Filter by **Type** or **Item Type** if needed.
   - Use **Today Only** button or date filters to narrow by date.

3. Click the **challan number** link to open the challan detail page.

4. Verify the challan details:
   - Check the **Movement Details** card showing **From → To** locations.
   - Review the **Items** table showing all materials with their sent quantities.

5. Click the **Receive** button in the top-right action bar.

6. In the **Receive Challan** dialog:
   - **Received Date**: Defaults to today; change if the actual receipt was on a different date.
   - For each item row:
     - **Received**: Enter the quantity actually received. The field is pre-filled with the outstanding quantity (sent minus any previously received).
     - **Damaged**: Enter any damaged quantity (optional). Leave blank or 0 if no damage.
   - **Remarks**: Add any notes about the receipt (optional).

7. Click **Confirm Receipt** to save the receipt.

8. A success toast "Challan received" confirms the action.

## Traps

- **Receive button not visible**: The challan status must be Issued, In Transit, or Partially Received. Draft challans must be issued first; Received or Cancelled challans cannot be received again.
- **Partial receipts**: If you enter less than the sent quantity, the challan status becomes Partially Received and you can receive the balance later.
- **Damaged quantity**: Damaged items are tracked separately — they count as received but are flagged. Enter the damaged count in the **Damaged** column.
- **Cannot undo**: Once confirmed, a receipt cannot be reversed through the UI. Verify quantities before clicking Confirm Receipt.
- **Outstanding pre-fill**: The Received field pre-fills with the outstanding quantity (sent minus already received). Adjust it to the actual amount if different.

## After saving

- The challan status updates to **Received** (if all quantities fulfilled) or **Partially Received** (if quantities remain outstanding).
- The **Received Date** and **Received By** fields are recorded on the challan.
- The items table on the detail page shows **Received Qty** and **Damaged** columns with the recorded values.
- Stock levels are updated based on the received quantities.
- You can print the challan using the **Print** button to get a PDF copy.
