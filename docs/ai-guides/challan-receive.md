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
  - issue challan
  - held for another order
  - take them anyway
  - challan issue karna
  - dusre order ka maal
  - चालान इश्यू
  - दूसरे ऑर्डर का माल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/ChallanDetail.tsx
  - frontend/src/pages/ChallanList.tsx
  - frontend/src/hooks/useHeldStockConfirm.tsx
  - frontend/src/components/WorkOrderCombobox.tsx
  - frontend/src/components/filters/FilterBar.tsx
  - backend/src/services/challan.service.ts
route: /manufacturing/challans
---

## Before you start

- A challan must exist with status **Issued**, **In Transit**, or **Partially Received**.
- You need the **challans** permission.
- Know the actual quantities received and any damaged quantities.

## Steps

1. Open **Manufacturing → Challans** in the sidebar.

2. Find the challan to receive against:
   - Type in the search box ("Search challan number, from, to, remarks…").
   - In the status dropdown (starts at **All statuses**), select **Issued**, **In Transit**, or **Partially Received** to see receivable challans.
   - Narrow by type (**All types**) or item type (**All item types**) if needed.
   - Use **Challan date** (From / To) or the **Today only** button to narrow by date.
   - To see one production run's challans, open the **All production runs** picker, type the run number and pick it.
   - Click **Clear N filters** (e.g. **Clear 2 filters**) to remove every filter. If nothing matches, the list says **No challans match these filters.** with a **Clear filters** button.

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

- **Receive button not visible**: The challan status must be Issued, In Transit, or Partially Received. Draft challans must be issued first (**Issue Challan**); Received or Cancelled challans cannot be received again.
- **Issuing asks about goods held for another order**: when you click **Issue Challan** on a draft and some of the goods are held for another order (they arrived on a PO linked to that order, or were taken for it with Use Stock), a box **These goods are held for another order** lists "Held for ORD… (STYLE): N" and asks "Take them anyway? That order will need them bought again." **No, keep them** issues nothing; **Take them anyway** issues the challan and that order's requirement goes back to needing the goods bought.
- **Partial receipts**: If you enter less than the sent quantity, the challan status becomes Partially Received and you can receive the balance later.
- **Damaged quantity**: Damaged items are tracked separately — they count as received but are flagged. Enter the damaged count in the **Damaged** column.
- **Cannot undo**: Once confirmed, a receipt cannot be reversed through the UI. Verify quantities before clicking Confirm Receipt.
- **Outstanding pre-fill**: The Received field pre-fills with the outstanding quantity (sent minus already received). Adjust it to the actual amount if different.

## After saving

- The challan status updates to **Received** (if all quantities fulfilled) or **Partially Received** (if quantities remain outstanding).
- The **Received Date** and **Received By** fields are recorded on the challan.
- The items table on the detail page shows **Received Qty** and **Damaged** columns with the recorded values.
- Stock levels are updated based on the received quantities.
- Trims or lace given back on a challan issued for an order are held for that order again, so another order cannot take them without asking.
- You can print the challan using the **Print** button to get a PDF copy.
