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
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - frontend/src/pages/LaceForm.tsx
  - frontend/src/pages/LaceList.tsx
  - frontend/src/pages/TrimMastersDashboard.tsx
  - backend/src/schemas/trimMasters.schema.ts
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
9. For **Ready-to-Use (Finished)** lace, pick a **Color** from the colour master. There is a link to add a new colour if it is missing.
10. Still for finished lace, enter **Price per Meter (₹)**. This is the rate cost sheets use for the Ready Lace option, so fill it whenever the price is known. If a preferred supplier has a Price/Meter (step 13), that supplier price is used first.
11. You can also set **Source Greige Lace (Optional)** on a finished lace to record which greige lace it was dyed from — this link is what lets cost sheets offer the Greige + Dyeing option for it.
12. For **Raw/Greige** lace, the colour and price fields disappear and two extra fields appear: **Expected Shrinkage (%)** and **Greige Cost (per meter)**. Shrinkage must be below 100.
13. Fill **Composition**, **Design** and **Buyer Code** if known. All are optional.
14. Under **Suppliers**, click **Add Supplier**, select the **Supplier**, and fill **Price/Meter** if known. Tick **Preferred Supplier** and **Active** as needed. Use the bin icon to remove a row.
15. Add a **Supplier Reference Code** under **Reference Codes** if the supplier uses their own SKU.
16. Under **Style Associations**, select the styles that use this lace. The first style picked is treated as the primary one and goes into the auto-generated name.
17. Add a **Description** if useful.
18. To attach a photo, scroll to **Lace Image** and click the box that says **Click to upload lace image**. JPG, PNG or WEBP files up to 5MB are accepted. On the preview, the upload button replaces the photo and the ✕ button removes it.
19. Click **Create Lace**.

## Traps

- Nothing here except the lace nature choice is strictly enforced, so it is easy to save a thin record. Fill width, type and composition so the auto-generated name is meaningful.
- If **Price per Meter** is left empty and no supplier price is set, cost sheets show this lace at zero until someone enters a price in the cost sheet's sourcing window. Setting the price here avoids that.
- When editing an existing lace, do not touch the **Suppliers** section unless you mean to change it. The form only sends supplier rows when that section was opened or edited.
- On edit, the name refreshes automatically when you change attributes, unless you have typed a name of your own.
- When editing an existing lace, the ✕ button on the photo removes it from the server immediately — it does not wait for you to click **Update Lace**.
- The photo also shows next to the lace in the style form's **Browse & Add Trims** window, so uploading one helps the team pick the right lace.
