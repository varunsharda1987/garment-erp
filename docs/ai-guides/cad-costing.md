---
slug: cad-costing
title: Cost a CAD Plan (Fabric Costing)
keywords:
  # English
  - fabric costing
  - CAD costing
  - processing cost
  - fabric cost
  - greige cost
  - shrinkage
  - processor rate
  - cost per meter
  - landed price
  - build-up costing
  - transport cost
  - screen cost
  # Hinglish
  - fabric costing karna
  - CAD ki costing
  - processing ka rate
  - greige ka rate
  - shrinkage kitna hai
  - meter ka cost
  - processor rate card
  # Devanagari (MANDATORY)
  - फैब्रिक कॉस्टिंग
  - कैड कॉस्टिंग
  - प्रोसेसिंग कॉस्ट
  - श्रिंकेज
  - ग्रेज रेट
  - प्रोसेसर रेट कार्ड
  - मीटर का रेट
  - ट्रांसपोर्ट कॉस्ट
  - लैंडेड प्राइस
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/FabricCostingPage.tsx
  - frontend/src/pages/CADPlanningPage.tsx
route: /fabric-costing
---

## Before you start

- The style must have CAD data from **CAD Planning** (fabric consumption per piece)
- If CAD is not done, go to **Pre-Production > CAD Planning** first
- CAD approval is NOT required for costing, but costing cannot be approved without CAD approval

## How to open Fabric Costing

**Option 1: From CAD Planning page**
1. Open the style in **Pre-Production > CAD Planning**
2. Click **Actions** dropdown (top right)
3. Select **View Fabric Costing** or **Push to Fabric Costing**

**Option 2: Direct navigation**
1. Go to **Pre-Production > Fabric Costing**
2. Search for the style using the **Quick Search** box
3. Or select **Customer** first, then pick the **Style**

## Steps

### 1. Select the style
- Use the **Quick Search** box to find by style code, buyer ref, or name
- Or pick **Customer** from the dropdown, then select the **Style**

### 2. Choose the costing mode (tabs)
- **Costing** - For quotation pricing (default)
- **Raw Mat Calculation** - For MRP after order confirmation
- **Production** - Final locked costings for production

### 3. Enter Order Quantity (pcs)
- This quantity is used for rate slab lookup
- If you change the quantity later, a NEW costing option is created (original preserved)

### 4. Cost each fabric row

Each row represents one fabric from CAD Planning. You have two costing modes:

**Mode toggle: B (Build-up) or L (Landed Price)**
- Switch using the toggle in the **Mode** column

#### Build-up Mode (B) - Component-wise costing

Fill in these fields:
1. **Greige** (per meter) - The raw greige fabric cost
   - Auto-populated from greige master or recent GRN
   - You can override manually (shows "manual" label)
   - If stale, click the refresh icon to use current rate
   
2. **Transport** (per meter) - Transport cost to bring greige
   - Default is usually set
   
3. **Processor** - Select the dyeing/printing mill
   - Choose from the dropdown
   - For DYEING: rate lookup happens automatically
   - For PRINTING: select print type first
   
4. **Colors** (printing only) - Number of colors/screens

5. **Print Type** (printing only) - Select screen type
   - Options: Rotary, Flat Bed, Digital, etc.

6. Click **Get Rate** (refresh icon next to processor) to fetch:
   - Processing cost per meter (from rate card)
   - Shrinkage percentage
   - Screen cost per screen (for printing)

#### Landed Price Mode (L) - Single price

- Enter the final **Landed Price per meter** directly
- Use when you have an all-inclusive fabric price
- Processor and processing fields are disabled

### 5. Check the calculated values

- **Process** - Processing cost per meter from rate card
- **Shrink** - Shrinkage cost (greige adjusted for shrinkage)
- **Screen** - Screen cost amortized per meter (printing only)
- **Total** - Final cost per meter
- **Part Cost** - Total per meter multiplied by CAD consumption
- **Fabric Req** - Finished fabric required (CAD per meter)
- **Greige Req** - Greige required (adjusted for shrinkage)

### 6. Save the costing
- Click **Save Costing** button
- After saving, optionally create a **Costing Run** (groups related options)

## Understanding the costs

### Total Cost Formula (Build-up mode)
```
Total per meter = Greige + Transport + Shrinkage Cost + Processing + Screen
```

### Shrinkage calculation
- If shrinkage is 10%, you need more greige to get the same finished fabric
- Shrinkage cost = Greige price adjusted for the shrinkage percentage
- Example: Greige at 100 per meter, 10% shrinkage = 111.11 per meter effective

### Batch rate advantage
- Fabrics with the same greige + processor + color are batched together
- Combined quantity gets a better rate slab
- You see "batch" label and savings per meter shown

## Traps to avoid

- **No CAD data**: If you see "No CAD Data Found" warning, go to CAD Planning first
- **Missing greige rate**: Enter a rate or set it on the Greige Master
- **Wrong processor**: Make sure processor has the rate card for this greige
- **Quantity matters**: Rate slabs depend on quantity - higher quantity = better rate
- **Approved rows**: You cannot modify a row with approved costing - unapprove first on the Options page

## After saving

1. **View Saved Options** - Opens the costing options page for this style
2. **View All Options** button - See all costing options across styles
3. **Create Cost Sheet** - Use the costing in the cost sheet (Pre-Production > Cost Sheets)
4. To approve a costing option, go to **Pre-Production > Costing Options**

## Related pages

- **CAD Planning** - Where fabric consumption is calculated
- **Costing Options** - View/approve all costing options
- **Cost Sheets** - Full garment costing using fabric costings
- **Processor Rate Cards** - Manage processor rates (Materials & Masters)
