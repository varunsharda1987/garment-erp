---
slug: cad-planning-create
title: Create a CAD Plan (Marker)
keywords:
  # English
  - CAD
  - CAD planning
  - marker
  - marker efficiency
  - fabric consumption
  - average
  - cuttable width
  - layer length
  - size breakdown
  - pattern parts
  - greige selection
  - fabric width
  - CAD average
  - marker plan
  - cutting plan
  - production CAD
  - create CAD from stock
  - fabric stock available
  - received lot
  - GRN lot
  - rejected CAD
  - approve production CAD
  - CAD filter
  - filter by buyer
  - filter by brand
  - styles on order
  - CAD pending styles
  - missing CAD
  - CAD history
  - who changed the CAD
  - CAD in use
  - correct CAD
  - correction pending
  - CAD image
  - marker image
  - marker screenshot
  - Nest EXPERT
  - mini marker
  - attach CAD image
  - use these values
  - differs from the CAD image
  - needs image
  - not checked
  - save with a reason
  - cad imgae
  - margin
  - layer margin
  - how is CAD average calculated
  - buyer style code
  - not used yet
  - sizes could not be read
  - title bar cut off
  - piece list sizes
  - lot width
  - wrong width
  - correct width
  - spare width
  - wider than lot
  - marker fits the lot
  - cutable width of lot
  # Hinglish
  - CAD banana
  - marker banane ka tarika
  - average nikalna
  - fabric ka consumption
  - cutting plan banana
  - width select karna
  - greige dalna
  - lot ka CAD banana
  - production CAD approve karna
  - CAD reject ho gaya
  - maal aa gaya CAD
  - buyer se filter karna
  - order wale style
  - kiska CAD baaki hai
  - CAD kisne badla
  - CAD ki history
  - CAD galat hai
  - CAD ki photo lagana
  - marker ka screenshot dalna
  - image se value lena
  - image se match nahi ho raha
  - reason dekar save karna
  - margin kitna hai
  - average kaise nikla
  - buyer ka style code
  - size nahi padha
  - screenshot kata hua
  - lot ki width galat hai
  - chaudai galat
  - 52 ka marker 53 pe
  - width sahi karna
  # Devanagari (MANDATORY)
  - कैड
  - कैड प्लानिंग
  - मार्कर
  - एवरेज
  - फैब्रिक कंजम्पशन
  - कटिंग प्लान
  - ग्रेज
  - साइज ब्रेकडाउन
  - लेयर लेंथ
  - प्रोडक्शन कैड
  - लॉट
  - कैड रिजेक्ट
  - कैड अप्रूव
  - फिल्टर
  - बायर
  - ब्रांड
  - ऑर्डर वाले स्टाइल
  - कैड बाकी
  - कैड हिस्ट्री
  - कैड किसने बदला
  - कैड सुधारना
  - कैड इमेज
  - मार्कर इमेज
  - मार्कर फोटो
  - स्क्रीनशॉट
  - इमेज से वैल्यू
  - कारण के साथ सेव
  - मार्जिन
  - एवरेज कैसे निकला
  - साइज नहीं पढ़ा
  - अभी इस्तेमाल नहीं
  - बायर स्टाइल कोड
  - चौड़ाई
  - कटेबल चौड़ाई
  - लॉट की चौड़ाई
  - चौड़ाई सही करना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/CADPlanningPage.tsx
  - frontend/src/pages/CADPlanningList.tsx
  - frontend/src/components/cad/CADSpreadsheetTable.tsx
  - frontend/src/components/cad/StockSummaryBanner.tsx
  - frontend/src/components/cad/CadInUseNotice.tsx
  - frontend/src/components/cad/CadHistoryDialog.tsx
  - frontend/src/components/cad/CorrectCadDialog.tsx
  - frontend/src/components/ui/combobox.tsx
  - frontend/src/components/cad/MarkerImageDialog.tsx
  - frontend/src/components/cad/MiniMarkerDialog.tsx
  - frontend/src/components/cad/MiniMarkerBadge.tsx
  - frontend/src/components/fabric/CorrectLotWidthDialog.tsx
  - backend/src/services/helpers/lot-width.helper.ts
  - backend/src/controllers/cad-embroidery.controller.ts
route: /cad-planning
---

## Before you start

A style must exist with:
- At least one component (e.g., Top, Bottom, Sleeve)
- Fabrics assigned to components (fabric finish type, greige linked)
- Size category assigned to the style (for size breakdown options)

## Steps

### 1. Open CAD Planning

1. Click **Pre-Production** in the sidebar.
2. Click **CAD Planning**.
3. The list shows styles organized by status tabs:
   - **Pending** tab: Styles with CAD work pending (includes IN_PROGRESS)
   - **Approved** tab: Styles with approved CAD plans

### 2. Find your style

- Type in the **Search** box ("Search buyer style code, style code, name, buyer, brand, greige…"). It searches across both tabs.
- Each row shows the **Buyer Style Code** first (bold, with the style name under it), then our **Style Code** in the next column. A style with no separate buyer code shows its Style Code in both.
- Narrow the list with the filters in the row above the tabs. They work on both tabs, and the numbers on the **Pending** and **Approved** tabs change to count only the matching styles:
  - **Buyer** - starts at **All buyers**; tick one or more buyers
  - **Brand** - starts at **All brands**; tick one or more brands
  - **Category** - starts at **All categories**; tick one or more product categories
  - **Orders** - **All styles**, **On an open order** (styles on a sale order or production order that is still running) or **No open order** (the rest)
  - **CAD Progress** - **All styles**, **No CAD yet**, **No Costing CAD**, **No Raw Mat CAD**, **No Production CAD**, **Has Costing CAD**, **Has Raw Mat CAD**, **Has Production CAD**. It matches the ticks in the **Progress** column
- Click **Clear N filters** (e.g. **Clear 2 filters**) to remove them all. You stay on the same tab.
- If nothing matches, the list says **No styles match these filters.** Click **Clear filters** under it.
- The filters stay when you click **Open CAD** and come back, and you can copy the page link to share a filtered view.
- Tip: **Orders: On an open order** + **CAD Progress: No Production CAD** lists the ordered styles that still need a Production CAD.
- Click the expand arrow on any row to see existing CAD width details grouped by purpose.
- Check the **Progress** column to see which purposes are done:
  - **Costing** - for cost sheet generation
  - **Raw Mat** - for raw material requirement planning
  - **Production** - for actual production cutting

### 3. Open the CAD spreadsheet

1. Click **Open CAD** button on your style row.
2. The CAD Planning page opens. Under the **CAD Planning** heading it names the style, Buyer Style Code first, e.g. `SP27DR27 (EBWW-021) — Style Name`. It has three tabs:
   - **CAD Spreadsheet** - main editing area (default)
   - **CAD History** - view all historical CAD options
   - **Order History** - orders using this style's CAD

### 4. Add a CAD row

1. On the CAD Spreadsheet tab, click the **Add Row** button.
2. In the **Add CAD Rows** dialog:
   - Pick the **CAD Purpose**: COSTING, RAW MAT, or PRODUCTION
   - Tick the component-fabric pairs this CAD covers
   - For **PRODUCTION**: you must also pick the received lot in **Select stock...**
3. Click **Add N … Rows** (e.g. **Add 1 COSTING Row**) to create the rows.

> **Received fabric?** For a Production CAD, use **Create CAD** on the lot in the **Fabric Stock Available** box instead (section 10) — it fills the marker in for you.

> **Tip**: To create a combined-cutting row (one marker for several components), tick them all and click **Combine as 1 … Row**. Components can be combined only when they are the SAME fabric: same generic greige, same finish, same colour (or print design) and same embroidery. The box under the list says **Can be combined** or tells you why not.

### 5. Fill in CAD row data

The columns, left to right: **Purpose**, **Ver**, **Component**, **Part**, **Finish**, **Emb.**, **Generic Greige**, **Greige / Fabric**, **Design Name**, **Width**, **Print**, **Sizes**, **Pcs**, **Layer(M)**, **Margin**, **CAD Avg**, **CAD Image**, **Actions**.

Open the row menu (three dots) > **Edit** to change a row, then click the save icon (or the cross to cancel).

**Pre-populated (grey):** **Purpose** (a row cannot be switched into or out of Production: a Production CAD comes only from a received lot), **Component**, **Finish**, **Emb.**, **Generic Greige**.

**Editable (blue):**
- **Part** * - the pattern part (e.g. All Parts, Body, Sleeve)
- **Greige / Fabric** * - the exact greige (or ready fabric). Click **Select Greige** and type part of the greige name (or its generic greige or supplier) to search; only greiges of the row's generic greige are listed
- **Width** * - cuttable width in inches, as on the marker. On a Production row it may be narrower than its lot, never wider (the line under it shows **Lot …" · …" spare**, or **Wider than lot** in red)
- **Print** - 1-Way or 2-Way
- **Sizes** * - click the calculator button to set the pieces per size
- **Layer(M)** * - the marker length in metres, as printed on the marker

**Calculated (green):** **Pcs** (total pieces in the marker), **Margin** (added to the layer length by rule — it reads "auto" while a new Layer(M) is being typed, and is set when you save) and **CAD Avg** (metres per piece). Hover over **CAD Avg** to see the sum, e.g. "(3.85 + 0.05) ÷ 5 = 0.78 m/pc". The margin cannot be typed.

> **Raw Mat and Production rows are filled from their marker image** — see section 6. Their Layer(M), Width and Sizes cannot be saved without it.

### 6. Attach the marker image (CAD Image column)

Each row's **CAD Image** column shows its marker image state:
- **Needs image** (red) - a Raw Mat or Production row with values but no image. It cannot be saved or approved like this
- **Add** - no image yet (a Costing row may have one; it is optional there)
- **Not used yet** (grey) - the row has its image but no values yet (a new row). Open it and click **Use these values**, then save the row. It cannot be approved before that
- **Matches** (green) - the row is what its image says
- **Differs** / **Not checked** (red) - the row differs from its image, or the image could not be read, and no reason was given
- **Differs · reason given** / **Not checked · reason given** (amber) - saved with a reason
- **No image** (grey) - an approved row from before images were required. It keeps its values. Click it to attach its marker image: an approved row takes an image only when it says exactly what the row holds (see below)

To attach it:
1. Make the marker in Nest EXPERT and take a screenshot of the whole window (the title bar with the sizes, the piece list under the toolbar, and the status bar with Placed, Eff, Length and Width). A PDF export also works. If the title bar is cut off, the sizes are read from the piece list instead — the window then says "Sizes read from the piece list under the toolbar — the title bar is not in the screenshot".
2. Click the row's **CAD Image** cell. The **CAD image** window opens.
3. Click **Upload image** (JPG, PNG or PDF, up to 10 MB). Or choose one already uploaded for the style in **…or use an uploaded image** — choosing it uses it at once. The list also shows this row's earlier images ("this row's earlier image"), so a wrong choice is undone by choosing the earlier one again.
4. Wait while it reads: "Reading the marker — about 10 seconds…".
5. The window shows the image and a table: **Image** against **Row** for **Layer length**, **Width**, **Sizes**, **Pieces**, **Placed** and **Efficiency**. Lines that differ are highlighted. On a new row with no values yet the window says **Not used yet** — nothing differs, the row is simply empty.
6. Click **Use these values**. The row opens for editing with Layer(M), Width and Sizes filled from the marker ("Values from the CAD image are filled in — check them and click Save").
7. Click the save icon on the row. The chip turns **Matches**.

Other buttons in the window: **Replace image** (a new screenshot replaces the old; the old one is kept in the history) and **Read again**.

The table in the window also shows **Margin (by rule)** and **CAD Avg (m/pc)** for the image and for the row — what the marker's length and sizes give by the same formula — so you can see at once whether the average would change.

**An approved row** keeps its values: the window has no **Use these values**. It still takes its marker image — upload it or pick an uploaded one — but only when the image says exactly what the row holds (length, width, sizes, every piece placed). Then the chip turns **Matches**. If the image differs, it is not linked: the window shows "Not linked — it differs from this approved row" with the differences, and the image is kept in the style's images. To change the row's values, use row menu > **Correct…** and pick that image there.

If the marker has a size the style does not offer (e.g. XXL on a style with XS–XL), that size is not put on the row: "The marker has XXL — this style has no such size". Add the size to the style, or save with a reason.

### 7. Saving values that differ from the image

If you save a Layer(M), Width or Sizes that differ from the row's image, the window **These values differ from the CAD image** lists each difference (e.g. "Layer length: image 3.82 m, row 3.85 m"). If the image could not show a value at all (e.g. no sizes could be read), the window is called **The CAD image could not check these values** instead. Either:
- click **Open CAD image** and use the marker's values, or
- type the **Reason** and click **Save with this reason**. The reason is kept on the row (hover the chip) and in its **History**.

A reason covers only those differences. If you later change the values again and they still differ, a new reason is asked for.

**How the average is worked out:** **CAD Avg** = (**Layer(M)** + **Margin**) ÷ **Pcs**. The margin is added automatically from the length (2 cm up to 1 m, 5 cm up to 5 m, 10 cm up to 10 m, 20 cm up to 20 m, else 30 cm) and shows in the **Margin** column. So Layer(M) must be the marker's own length — never add a margin to it by hand.

> **Important**: CAD Avg is the key output used in cost sheets, MRP and cutting.

### 8. Approve the CAD plan

Once all rows have CAD values — and every Raw Mat and Production row has its marker image, with any difference saved with a reason:

1. The status card shows: "All CAD entries complete. Ready to approve!"
2. Click **Actions** dropdown > **Approve CAD Plan**.
3. Review the confirmation:
   - "Once approved, the CAD plan will be locked..."
   - "You won't be able to change fabric widths or values after approval"
4. Click **Approve & Lock**.

After approval:
- Status changes to **APPROVED** (green badge)
- You can now generate cost sheets
- CAD values are locked for this style. To fix an approved Costing or Raw Mat row later, use row menu > **Correct…** (see Row actions)

### 9. Push to Fabric Costing (optional)

Push creates costing records for Costing and Raw Mat rows only — Production rows are skipped, because a Production CAD is the marker for a received lot and is never costed.

The **Fabric Costing** button on the CAD Planning list opens Fabric Costing on the **Raw Mat Calculation** tab when the style has Raw Mat CAD, otherwise on the **Costing** tab.

After approval, to create fabric costing records:

1. Click **Actions** dropdown > **Push to Fabric Costing**.
2. Review what will be created:
   - Shows count of new records to create
   - Shows count of existing records (skipped)
3. Click **Create X Records** to proceed.
4. You are redirected to the Fabric Costing page.

### 10. Make the Production CAD for received fabric

When processed fabric has been received for the style, a green **Fabric Stock Available** box appears above the spreadsheet. It lists every lot with its GRN number, **cutable** width and metres, e.g. `GRN2609-0080 · 53" cutable • 852.1m`, and a badge such as **2 need CAD**. Hover a lot to see its measured width too. The cutable width is the measured width less the selvedge (2") — the widest a marker for that lot may be.

**Check the lot's width first.** If the fabric measures differently from what was recorded at receipt (e.g. recorded 57", the fabric is 55"), click **Width** next to the lot and correct it before making its CAD (see *Correct a fabric lot's width*).

1. Click **Create CAD** next to a lot. There is one Production CAD per lot; two lots of the same width each get their own.
2. A new **Production** row appears, filled from the approved Raw Mat (or Costing) marker when that marker **fits** the lot — no wider than the lot's cutable width. It keeps the marker's own width (a 52" marker on a 53" lot stays 52"), with Sizes, Pcs, Layer(M), CAD Avg and the marker's image.
   - Under **Width** the row shows the lot and what is left over, e.g. **Lot 53" · 1" spare**. It turns amber when more than 2" is spare, and Create CAD warns: "This lot is 56" cutable and the marker is 52" — 4" spare. A wider marker may save fabric."
   - If the approved marker is **wider** than the lot, it cannot be used: a warning says "…it will not fit". The sizes are copied, but **Layer(M)** and **CAD Avg** are left empty and no image comes with it — make a marker at the lot's cutable width or less, then attach its image in the **CAD Image** column and use its values (section 6).
3. Check the row and its **CAD Image** chip (it must not say **Needs image** or **Differs**). Then open the row menu (three dots) > **Approve**.
4. Repeat for every lot in the box.

**Cutting needs an APPROVED Production CAD with a CAD Average.** A pending or rejected Production CAD does not count, and Push to Cutting / Create Batch will refuse until one is approved.

## Traps

- **Missing greige selection**: Each row must have a greige selected. Without it, CAD calculations cannot run.
- **Zero size breakdown**: If no sizes are entered, Pcs = 0 and CAD Avg cannot be calculated.
- **"Attach this Raw Mat CAD's marker image first"** (or Production): the row's Layer(M), Width or Sizes cannot be saved without its image. The **CAD image** window opens — upload the screenshot and click **Use these values**. Changing only the greige, part, print or notes needs no image.
- **Approve refused — "Attach this row's CAD image before approving"** or **"The values differ from the CAD image — correct them, or save them with a reason, before approving"**: attach the image, or save the values with a reason, then approve.
- **Approve refused — "This row has no values yet — click Use these values in its CAD image, save the row, then approve"**: the chip says **Not used yet**. Open the CAD image, click **Use these values**, save the row, then approve.
- **"The image was kept, but it could not be read"**: a phone photo, another CAD program or a cut-off screenshot. The chip says **Not checked**. Upload a clear screenshot of the whole Nest EXPERT window, or save with a reason.
- **"The sizes could not be read from the image — not checked"**: neither the title bar nor the piece list gave the sizes (both cut off, or the piece list scrolled). Upload a screenshot that shows the title bar, or enter the sizes and save with a reason (e.g. "sizes counted from the piece list").
- **"Only 4 of the marker's 60 pieces are placed"**: the marker was not finished in Nest EXPERT. Finish it and upload a new screenshot, or save with a reason (e.g. an embroidery-panel marker).
- **Wrong cutable width**: Using greige width instead of cutable width leads to wrong fabric consumption. Cutable width is typically 1-2 inches less than greige width due to selvedge.
- **"This marker is 54" but lot … is 53" cutable — it will not fit"**: a Production CAD cannot be saved or approved wider than its lot. Make a marker at the lot's cutable width or less — or, if the lot was recorded at the wrong width, click **Width** on the lot in the **Fabric Stock Available** box and correct it.
- **The lot's width was recorded wrong at receipt** (e.g. 57" instead of 55"): click **Width** next to the lot and correct it. Do not reverse the receipt for this. A lot whose approved Production CAD would no longer fit cannot be narrowed — reject that CAD first.
- **Approving without Production CAD**: Costing CAD is sufficient for cost sheets, but cutting needs an APPROVED Production CAD made from the received lot.
- **"Cannot tell which fabric of … this lot belongs to"**: Create CAD could not match the lot to one of the style's fabrics (same greige and finish). Check the style's fabrics, then press **Create CAD** again. Nothing was created.
- **"This lot already has a Production CAD"**: each lot gets one. Find it in the Production section of the table.
- **"This Production CAD has no average yet"**: Approve is refused until the row has a Layer (M) and a Size Breakdown. Fill them in, save, then Approve.
- **A lot shows a red Rejected chip**: its Production CAD was rejected. Press **Create CAD** again to make a new one.
- **"This Production CAD is not on a received fabric lot"**: a Production row with no lot cannot be approved. Use **Link to Stock**, or delete the row and press **Create CAD** on the lot.
- **"This lot (…) is not a fabric of …"**: the lot picked in **Select stock...** or **Link to Stock** was received for another style or fabric. Pick one of this style's own lots.
- **"A Production CAD is made for a received fabric lot"**: Copy and a Purpose change cannot make a Production CAD. Press **Create CAD** on the lot in the **Fabric Stock Available** box.
- **Deleting approved rows**: Approved CAD rows linked to fabric costing or orders cannot be deleted.
- **Combining different colours**: A White Poplin top and a Burgundy Poplin shirt are two different fabrics, even on the same greige — they cannot share one marker. Click **Add 2 … Rows** to plan them separately.

## After saving

- **CAD Average** is used by:
  - Cost sheets (fabric cost calculation)
  - MRP (raw material requirement planning)
  - Cutting charts (layer planning)

- **Next steps**:
  - Open **Fabric Costing** to add processing costs and approve rates
  - Create or update **Cost Sheet** with fabric costs
  - When orders are placed, Production CAD is used for cutting

## Where the images are kept

The paperclip badge next to the status badge at the top (**Mini markers**) opens every CAD image of the style by purpose. Each shows **Marker of** its row (e.g. "Raw Mat · Pants · All Parts · 52″"), **Was marker of** (replaced), or **Not on a CAD row**. The marker of an approved row, or of a Raw Mat / Production row with values, cannot be deleted — replace it from the row's **CAD Image** instead.

## Row actions

Click the row menu (three dots) for:
- **Approve** - Approve this CAD entry (pending or rejected rows). On a Production row it shows only once the row is on a received lot
- **Reject** - Enter a **Rejection Reason** and click **Reject CAD**. The row becomes REJECTED and shows a red **Rejected** badge under its purpose; hover it to see who rejected it, when and why. Rejecting also clears the row's fabric price approval
  - If a yellow box **This CAD is already in use — it cannot be rejected** appears, an approved cost sheet or an order's BOM is built on this CAD, and the row is NOT rejected. Click **Correct instead** to fix it with **Correct…**
- **Correct…** - Fix an approved Costing or Raw Mat row (layer length, size breakup, greige or width) and carry the fix to the cost sheets, order BOMs and requirements built on it. Enter the new values and a **Reason**, click **Check impact**, then **Submit correction** (or **Send for approval** when an approved cost sheet or order uses it — an admin then approves the new cost sheet version). While it waits, the row shows a **Correction pending** badge and **Correct…** is hidden. Not shown on Production rows. See the guide "Correct an approved CAD"
- **Create Version** - New version of an approved Costing or Raw Mat entry. A Production CAD has no versions: **Reject** it, edit the row, then **Approve** it again
- **Copy to Raw Mat** (on Costing rows) - Copies the marker, size breakdown and marker image. There is no Copy to Production: a Production CAD is made with **Create CAD** on the received lot (section 10)
- **Link to Stock** - Attach one of the style's own received lots to a pending Production row
- **History** - Opens **CAD history**: who created, edited, approved, rejected or corrected the row, with date and time, the old and new values (CAD average, layer length, pieces, width, greige, sizes) and the reason. A correction also shows where it stands (waiting for the admin, approved, or rejected). Changes are recorded from 26-Sep-2026; the row's creator and creation date are shown at the top
- **Edit** / **Delete** - Not available on approved rows (the Size Breakup button is greyed out too) — use **Correct…** on an approved Costing or Raw Mat row. A pending or rejected row can be deleted while nothing uses it (a cost sheet line, an order BOM line, an order, or a fabric stock reservation)

## Reject CAD plan

If the approved plan needs changes and nothing approved is built on it yet:

1. Click **Actions** dropdown > **Reject CAD Plan**.
2. Enter **Reason for rejection** * (required).
3. Click **Reject & Unlock**.
4. If a yellow box **This CAD is already in use — it cannot be rejected** appears, it lists the approved cost sheets and orders built on the CAD. The plan is NOT rejected and **Reject & Unlock** stays greyed out. Click **Cancel**, then fix the row with row menu (three dots) > **Correct…**.
5. Otherwise the Costing and Raw Mat rows reset to PENDING and you can edit them again. Their fabric price approval is cleared (the cost figures are kept). Production CADs stay approved, because cutting uses them.
