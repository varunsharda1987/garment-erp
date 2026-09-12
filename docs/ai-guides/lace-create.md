---
slug: lace-create
title: Add a Lace Master
keywords:
  - lace
  - lase
  - laces
  - trim master
  - greige lace
  - finished lace
  - lace kaise banaye
  - naya lace
  - लेस
  - लेस मास्टर
  - कच्ची लेस
  - रंगाई
  - ट्रिम
  - चौड़ाई
  - lace image
  - lace photo
  - lace ki photo
  - फोटो
  - lace price
  - price per meter
  - lace rate
  - lace ka rate
  - कीमत
  - रेट
  - दाम
  - raw lace
  - ready lace
  - dyed lace
  - dyed variant
  - processed lace
  - source greige lace
  - greige lace kaise banaye
  - dyed lace kaise banaye
  - lace banana
  - nayi lace
  - lace master
  - lace supplier
  - shrinkage
  - lace shrinkage
  - lace ka supplier
  - ग्रेज लेस
  - रंगी हुई लेस
  - तैयार लेस
  - डाई
  - डाइंग
  - सिकुड़न
  - लेस सप्लायर
  - नई लेस
  - लेस बनाना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/LaceForm.tsx
  - frontend/src/pages/LaceList.tsx
  - frontend/src/pages/TrimMastersDashboard.tsx
  - frontend/src/components/SupplierCombobox.tsx
  - frontend/src/types/supplier.types.ts
  - frontend/src/components/cost-sheet/LaceSourcingStrategySelector.tsx
  - frontend/src/components/JobWorkOrderCreateDialog.tsx
  - backend/src/schemas/trimMasters.schema.ts
route: /laces/new
---

## Steps

1. Lace has no direct sidebar entry. Open **Materials & Masters → Trims Dashboard** in the sidebar. The page opens as **Trim Masters**.
2. Click **Add Trim** at the top right and choose **New Laces** under the **Decorative** heading. You can also click the **Laces** quick-access button to open the lace list first, then click **+ Add New Lace**.
3. The page title becomes **Create New Lace**.
4. **Lace Code** is assigned automatically on save (format LACE-000001). It cannot be typed or changed later.
5. Choose **Lace Nature**. This is the most important choice on the page:
   - **Ready-to-Use (Finished)** — coloured lace that goes straight into production.
   - **Raw/Greige** — uncoloured lace that must be dyed first.
6. Leave **Lace Name** empty and it is built automatically from buyer code, colour, design, composition and width. Type a name only if you want to override it.
7. Pick a **Lace Type** from the dropdown. If your type is not listed you can add it from the same dropdown.
8. Enter **Width (inches)**. It must be a positive number.
9. For **Ready-to-Use (Finished)** lace, pick a **Color** from the colour master. There is an **add a new color** link under the field if it is missing.
10. Still for finished lace, enter **Price per Meter (₹)**. This is the rate cost sheets use for the Ready Lace option, so fill it whenever the price is known. If a preferred supplier has a Price/Meter (step 14), that supplier price is used first.
11. Still for finished lace, **Source Greige Lace (Optional)** appears once at least one Raw/Greige lace exists. Pick the greige lace this one was dyed from (or **None**). This link is what lets cost sheets offer the Greige + Dyeing option for it.
12. For **Raw/Greige** lace, the colour, price and source-greige fields disappear and two extra fields appear: **Expected Shrinkage (%)** and **Greige Cost (per meter)**. Shrinkage must be 0 or more and below 100.
13. Fill **Composition**, **Design** and **Buyer Code** if known. All are optional.
14. Under **Suppliers**, click **Add Supplier**. On each row select the **Supplier** (only suppliers tagged with the **Lace Supplier** category are listed), then fill **Price/Meter (₹)** and **Notes** if known. Tick **Preferred Supplier** and **Active** as needed — the first row you add is ticked as preferred automatically. Use the bin icon to remove a row.
15. Add a **Supplier Reference Code** under **Reference Codes** if the supplier uses their own SKU.
16. Under **Style Associations**, use **Associated Styles** to select the styles that use this lace. The first style picked is treated as the primary one and goes into the auto-generated name.
17. Under **Additional Information**, add a **Description** if useful.
18. To attach a photo, scroll to **Lace Image** and click the box that says **Click to upload lace image**. JPG, PNG or WEBP files up to 5MB are accepted. On the preview, the upload button replaces the photo and the ✕ button removes it.
19. Click **Create Lace**. You return to the lace list, where the **Type** column shows **Greige**, **Ready**, or **Processed** (a finished lace linked to a source greige, with the greige code shown under it).

## Traps

- Nothing here except the lace nature choice is strictly enforced, so it is easy to save a thin record. Fill width, type and composition so the auto-generated name is meaningful.
- If **Price per Meter** is left empty and no supplier price is set, cost sheets show this lace at zero until someone enters a price in the cost sheet's sourcing window. Setting the price here avoids that.
- A supplier row where no **Supplier** was chosen is dropped silently on save. If the supplier you need is not in the dropdown, tag it with the **Lace Supplier** category in the supplier master first.
- When editing an existing lace, do not touch the **Suppliers** section unless you mean to change it. The form only sends supplier rows when that section was opened or edited.
- On edit, the name refreshes automatically when you change attributes, unless you have typed a name of your own.
- When editing an existing lace, the ✕ button on the photo removes it from the server immediately — it does not wait for you to click **Update Lace**.
- The photo also shows next to the lace in the style form's **Browse & Add Trims** window, so uploading one helps the team pick the right lace.
- You do not have to use this form to record a lace that is dyed from a greige. In a cost sheet's lace sourcing window, choose the greige lace, pick **Dye to Colour** and click **Create Dyed Variant & Cost**. In a lace job work order, pick the **Greige Lace** and either select the **Dyed Variant Expected Back** or type a new shade and click **Create**. Both create the finished lace already linked to its greige source. One variant exists per greige + colour — entering the same colour again reuses it instead of making a duplicate.
