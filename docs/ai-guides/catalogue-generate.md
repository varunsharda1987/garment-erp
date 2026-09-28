---
slug: catalogue-generate
title: Generate a Style Catalogue
keywords:
  # English
  - catalogue
  - catalog
  - style catalogue
  - lookbook
  - PDF catalogue
  - product catalogue
  - generate catalogue
  - download catalogue
  - share catalogue
  - WhatsApp catalogue
  - filter styles
  - clear filters
  # Hinglish
  - catalogue generate karna
  - catalogue banana
  - lookbook banana
  - catalogue download karna
  - catalogue share karna
  - WhatsApp pe catalogue bhejana
  - catalogue filter karna
  # Devanagari
  - कैटलॉग
  - स्टाइल कैटलॉग
  - लुकबुक
  - कैटलॉग बनाना
  - कैटलॉग डाउनलोड
  - कैटलॉग शेयर
  - फिल्टर
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/CatalogueGenerator.tsx
route: /catalogue-generator
---

## Steps

### Open the Catalogue Generator
1. Click **Pre-Production** in the sidebar
2. Click **Catalogue Generator**
3. The page shows all ACTIVE styles with images, codes, and prices

### Select Styles
1. **Manual selection**: Click the checkbox next to each style you want to include
2. **Select all visible**: Click the **Select All** button at the top to select all styles matching current filters
3. **Bulk selection**: In the left panel under **Bulk Selection**, paste style codes separated by commas, newlines, or tabs (e.g., `KF-001, KF-002, KF-003`), then click **Add Styles**

### Filter Styles (Optional)
Use the **Filters** panel on the left to narrow down styles:
- **Search**: Type style code, buyer's code, name, category, brand category or season. Every word you type must match
- **Category**: Starts at **All categories**. Click it and type to find a product category (e.g., Kurta, Dupatta)
- **Brand Category**: Pick a brand category, or **All brand categories**
- **Season**: Starts at **All seasons**. Click it and type to find a season (e.g., SS24, AW24)
- **Size Availability**: Click size badges (S, M, L, XL, etc.) to filter by size
- **Price Range**: Enter minimum and maximum price values
- To remove every filter, click **Clear N filters** (e.g. **Clear 2 filters**) at the top of the Filters panel
- If nothing matches, the list says **No styles match these filters.** Click **Clear filters**, or **Load more styles** — filters only look at the styles loaded so far

### Configure Catalogue Options
In the **Catalogue Options** panel:
1. **Catalogue Name**: Enter a name for your catalogue (appears on the PDF cover)
2. **Layout**: Select columns per page:
   - 1 Column = Large images (best for hero products)
   - 2 Columns = Default balanced view
   - 3 Columns = Compact view
   - 4 Columns = Grid view (maximum products per page)
3. **Price Display**:
   - B2B (Cost Price) = Show wholesale/cost price
   - B2R (MRP) = Show retail selling price
   - Both Prices = Show both B2B and B2R
   - No Prices = Hide all prices (for lookbooks)
4. **Additional options**:
   - Show Fabric Details = Include fabric composition info
   - Show Size Range = Display available sizes per style
   - Include Index Page = Add a table of contents at the start

### Download the Catalogue
1. Click the **Download** button (shows count of selected styles)
2. Select **Download PDF** from the dropdown menu
3. The PDF file downloads automatically with name format: `{CatalogueName}_{Date}.pdf`

### Share via WhatsApp
1. Click the **Download** button
2. Select **Share via WhatsApp**
3. Enter the recipient's phone number (with country code, e.g., `919876543210` for India)
4. Click **Open WhatsApp** to open WhatsApp with a pre-filled message containing the download link

## Options

| Option | Values | Description |
|--------|--------|-------------|
| Catalogue Name | Free text | Title displayed on the catalogue |
| Layout | 1-4 columns | Number of product cards per row |
| Price Display | B2B, B2R, Both, None | Which prices to show |
| Show Fabric Details | On/Off | Include fabric composition |
| Show Size Range | On/Off | Display available sizes |
| Include Index | On/Off | Add table of contents page |

## Traps

- **No styles selected**: You must select at least one style before downloading. The Download button shows "(0)" if nothing is selected.
- **Missing images**: Styles without images show a placeholder icon. Upload images via Style Master before generating catalogues for best results.
- **Large catalogues**: Catalogues with 100+ styles may take longer to generate. Consider splitting into multiple smaller catalogues.
- **Load More needed**: Only 50 styles load initially. Click **Load More Styles** at the bottom if the style you need is not visible.
- **WhatsApp phone format**: Enter the phone number without the + symbol but include the country code (e.g., `919876543210` for India, not `+91 98765 43210`).
- **Only ACTIVE styles**: The catalogue generator only shows styles with ACTIVE status. Draft or inactive styles are not available for selection.
