# Kashaya Fabs ERP - Features Guide

**Last Updated:** November 25, 2025
**Version:** 2.0.0

---

## Table of Contents

1. [Material Management System](#material-management-system)
2. [Style & BOM Management](#style--bom-management)
3. [Material-Style Linking](#material-style-linking)
4. [SKU & Variant System](#sku--variant-system)
5. [Icon System](#icon-system)
6. [Search & Filtering](#search--filtering)

---

## Material Management System

### Overview

The system provides comprehensive material management with category-specific controllers and specialized fields for each material type.

### Material Categories

#### 1. **Fabrics**
**Controller:** `fabric.controller.ts`
**Route:** `/api/fabrics`

**Specialized Fields:**
- Composition (Cotton, Polyester, Blend, etc.)
- GSM (Grams per Square Meter)
- Width (in inches/cm)
- Construction type (Woven, Knit, Non-woven)
- Finish type (Dyed, Printed, Embroidered)
- Care instructions

**Features:**
- Fabric lifecycle tracking (Greige → Processed)
- Quality inspection (4-point system)
- Lab dip management
- Shade management
- Supplier linking
- Stock tracking by roll

#### 2. **Buttons**
**Controller:** `button.controller.ts`
**Route:** `/api/buttons`

**Specialized Fields:**
- Button type (Shirt, Trouser, Decorative, Snap, etc.)
- Size (measured in Ligne: 14L, 16L, 18L, 20L, etc.)
- Material (Plastic, Metal, Wood, Shell, etc.)
- Shape (Round, Square, Oval, Custom)
- Color/finish
- Holes (2-hole, 4-hole, shank)

**Features:**
- Auto-code generation: `BTN-0001`, `BTN-0002`...
- Size standardization
- Multiple suppliers per button
- Stock tracking by quantity
- Image uploads

#### 3. **Elastic**
**Controller:** `elastic.controller.ts`
**Route:** `/api/elastic`

**Specialized Fields:**
- Elastic type (Knitted, Woven, Braided)
- Width (6mm, 10mm, 25mm, 38mm, etc.)
- Stretch percentage (100%, 150%, 200%)
- Material composition
- Color
- Usage (Waistband, Sleeve, Leg opening)

**Features:**
- Auto-code generation: `ELA-0001`, `ELA-0002`...
- Width and stretch tracking
- Usage classification
- Stock tracking by meters/yards
- Supplier management

#### 4. **Labels & Tags**
**Controller:** `label.controller.ts`
**Route:** `/api/labels`

**Specialized Fields:**
- Label type (Main, Care, Size, Brand, Barcode, Hangtag)
- Material (Woven, Printed, Heat Transfer)
- Size dimensions (width × height)
- Printing type (Screen, Digital, Thermal)
- Position (Neck, Side seam, Pocket)
- Text content
- Brand/logo requirements

**Features:**
- Auto-code generation: `LAB-0001`, `LAB-0002`...
- Type classification
- Multi-language support
- Position tracking
- Compliance labels (Care instructions, Country of origin)
- Image previews

#### 5. **Lace & Trimmings**
**Controller:** `lace.controller.ts`
**Route:** `/api/lace`

**Specialized Fields:**
- Lace type (Flat, Galloon, Insertion, Edging)
- Width (in mm/cm)
- Material (Cotton, Nylon, Polyester)
- Pattern/design code
- Color
- Edge type (Scalloped, Straight)

**Features:**
- Auto-code generation: `LACE-0001`, `LACE-0002`...
- Width standardization
- Pattern cataloging
- Stock tracking by meters/yards
- Image gallery

#### 6. **Packaging Materials**
**Controller:** `packaging.controller.ts`
**Route:** `/api/packaging`

**Specialized Fields:**
- Packaging type (Polybag, Box, Carton, Hanger, Tag)
- Material (LDPE, HDPE, Cardboard, Paper)
- Size/dimensions
- Thickness/GSM
- Printed/plain
- Quantity per pack
- Recyclable/eco-friendly flag

**Features:**
- Auto-code generation: `PKG-0001`, `PKG-0002`...
- Type classification
- Size specifications
- Environmental compliance tracking
- Cost per unit calculation

#### 7. **Threads**
**Controller:** `thread.controller.ts`
**Route:** `/api/threads`

**Specialized Fields:**
- Thread type (Sewing, Embroidery, Overlock)
- Material (Cotton, Polyester, Nylon, Core-spun)
- Count/Weight (40/2, 60/2, 120/2)
- Color code (Pantone, brand-specific)
- Finish (Mercerized, Bonded, Textured)
- Usage (Top stitch, Button attach, Seaming)

**Features:**
- Auto-code generation: `THR-0001`, `THR-0002`...
- Color code management
- Count standardization
- Usage classification
- Stock tracking by spools/cones
- Supplier thread charts

#### 8. **Zippers**
**Controller:** `zipper.controller.ts`
**Route:** `/api/zippers`

**Specialized Fields:**
- Zipper type (Metal, Nylon, Invisible, Open-end, Closed-end)
- Length (in inches/cm)
- Teeth size (#3, #5, #8, #10)
- Color
- Slider type (Auto-lock, Pin-lock, Non-lock)
- End type (Open, Closed, Two-way)
- Material (Brass, Aluminum, Plastic)

**Features:**
- Auto-code generation: `ZIP-0001`, `ZIP-0002`...
- Length standardization
- Teeth size classification
- Type and usage tracking
- Stock tracking by quantity
- Slider and puller variations

### Common Features Across All Materials

**All material categories include:**

1. **Auto-Code Generation**
   - Sequential numbering by category
   - Prefix-based codes (BTN-, ELA-, LAB-, etc.)
   - Manual override option

2. **Multiple Unit Support**
   - Pieces, Meters, Yards, Kilograms, etc.
   - Unit conversion

3. **Supplier Management**
   - Multiple suppliers per material
   - Supplier-specific codes
   - Lead time tracking
   - Preferred supplier flag

4. **Cost Tracking**
   - Purchase cost
   - Weighted average cost
   - Last purchase price
   - Cost currency

5. **Stock Management**
   - Current stock levels
   - Reorder level
   - Maximum stock level
   - Multi-warehouse support

6. **Quality Standards**
   - Quality grade
   - Acceptance criteria
   - Testing requirements
   - Certifications

7. **Image Support**
   - Multiple image uploads
   - Primary image selection
   - Image gallery view

8. **Custom Fields**
   - Category-specific attributes
   - Flexible data structure
   - Future extensibility

---

## Style & BOM Management

### Style Master

**Controller:** `style.controller.ts`
**Route:** `/api/styles`

**Core Information:**
- Style code (auto-generated or manual)
- Style name and description
- Category (Tops, Bottoms, Dress, etc.)
- Gender (Men, Women, Unisex, Kids)
- Season (Spring/Summer, Fall/Winter)
- Brand/customer
- Target price
- Status (Development, Approved, Discontinued)

### Bill of Materials (BOM)

**Controller:** `style-material-bom.controller.ts`
**Route:** `/api/style-material-bom`

**BOM Components:**

1. **Fabric Requirements**
   - Main fabric
   - Lining fabric
   - Interlining/fusible
   - Consumption per garment
   - Fabric placement (Body, Sleeves, Collar, etc.)

2. **Garment Trims**
   - Buttons (quantity and positions)
   - Zippers (type and length)
   - Elastic (type and meters)
   - Labels (types and positions)
   - Lace/trimmings
   - Thread requirements
   - Packaging materials

3. **Consumption Calculation**
   - Quantity per piece
   - Unit of measure
   - Wastage percentage
   - Total requirement
   - Cost calculation

### Size & Color Matrix

**Tables:** `size_options`, `color_options`

**Features:**
- Multiple sizes per style
- Color variants
- Size-specific patterns
- Color-specific consumption
- SKU generation (Size + Color)

---

## Material-Style Linking

### Workflow

#### Step 1: Create Materials
1. Navigate to material category (e.g., `/materials/lace`)
2. Click "Create New"
3. Fill in specialized fields
4. Save (auto-generates code: LACE-0001)

#### Step 2: Create Style & Add Materials
1. Navigate to `/styles/create`
2. Fill in style basic information
3. Go to "Trims & Variants" tab
4. Click "+ Add Trim"
5. Select material from dropdown
6. Enter quantity per piece
7. Select unit
8. Save

**Example Configuration:**
```
Style: ABC-001 "Fancy Top"

Fabric:
- FABRIC-0015 (Cotton Poplin White)
  Quantity: 1.5 meters

Trims:
- LACE-0001 (White Floral Lace 2inch)
  Quantity: 2 meters

- BTN-0001 (Pearl Button 15mm)
  Quantity: 5 pieces

- THR-0001 (White Thread 40/2)
  Quantity: 50 meters

- LAB-0005 (Care Label)
  Quantity: 2 pieces

- ZIP-0010 (Invisible Zipper 16inch)
  Quantity: 1 piece
```

### Material Requirement Calculation

**API Endpoint (Planned):**
```
POST /api/materials/calculate-requirement
```

**Request:**
```json
{
  "styleId": "abc-001-id",
  "orderQuantity": 1000
}
```

**Response:**
```json
{
  "styleCode": "ABC-001",
  "orderQuantity": 1000,
  "requirements": [
    {
      "materialCode": "LACE-0001",
      "materialName": "White Floral Lace 2inch",
      "quantityPerPiece": 2,
      "totalRequired": 2000,
      "unit": "meters",
      "availableStock": 1500,
      "shortfall": 500,
      "status": "SHORTAGE"
    },
    {
      "materialCode": "BTN-0001",
      "materialName": "Pearl Button 15mm",
      "quantityPerPiece": 5,
      "totalRequired": 5000,
      "unit": "pieces",
      "availableStock": 6000,
      "shortfall": 0,
      "status": "SUFFICIENT"
    }
  ],
  "summary": {
    "totalItems": 7,
    "sufficient": 5,
    "shortage": 2,
    "canProceed": false
  }
}
```

### Stock Reservation

When an order is confirmed:
1. System calculates material requirements
2. Checks available stock
3. Creates reservation/allocation
4. Updates available stock
5. Generates purchase requisition for shortages

---

## SKU & Variant System

### Overview

Each style has multiple SKUs representing unique size-color combinations.

### SKU Structure

**Format:** `{StyleCode}{Size}{Color}`

**Examples:**
- Style: DRE105
- SKUs:
  - DRE105-XS-BLK (Extra Small, Black)
  - DRE105-S-BLK (Small, Black)
  - DRE105-M-BLK (Medium, Black)
  - DRE105-XS-WHT (Extra Small, White)
  - DRE105-S-WHT (Small, White)

### Implementation

**Database Table:** `style_variants`

**Fields:**
- id (UUID)
- styleId (reference to styles table)
- sku (unique code)
- sizeId (reference to size_options)
- colorId (reference to color_options)
- sizeName (denormalized for performance)
- colorName (denormalized for performance)
- barcode (optional)
- isActive (boolean)
- sortOrder (for display)

### SKU Auto-Generation

**When creating/updating style:**
1. System reads size options
2. System reads color options
3. Generates SKU for each size × color combination
4. Creates/updates style_variants records
5. Maintains existing stock allocations

### Usage

**Inventory Tracking:**
- Stock tracked at SKU level
- Each SKU has own stock quantity
- Warehouse-wise stock by SKU

**Order Management:**
- Orders placed for specific SKUs
- Packing list by SKU
- Shipment tracking by SKU

**Reporting:**
- Sales by SKU
- Best-selling SKUs
- Slow-moving SKUs

---

## Icon System

### Overview

The ERP uses **Lucide React** icon library for a consistent, modern icon system across the application.

### Installation

```bash
npm install lucide-react
```

Already installed in the project.

### Usage

**Import icons:**
```typescript
import { Package, Users, ShoppingCart, Warehouse } from 'lucide-react';
```

**Use in components:**
```typescript
<Package className="w-4 h-4" />
<Users className="w-5 h-5 text-blue-600" />
```

### Icon Categories

**Navigation & UI:**
- Home, Menu, ChevronDown, ChevronRight, X, Plus, Minus
- Settings, User, Search, Filter

**Business Modules:**
- Package (Materials, Inventory)
- Users (Customers, Suppliers)
- ShoppingCart (Orders, Sales)
- Warehouse (Stock, Locations)
- FileText (Documents, Reports)
- DollarSign (Financial, Pricing)
- Truck (Shipping, Delivery)
- ClipboardCheck (Quality, Inspection)

**Actions:**
- Edit, Trash2, Save, Download, Upload
- Eye, EyeOff, Lock, Unlock
- Check, X, AlertTriangle, Info

### Size Standards

- **Small:** `w-4 h-4` (16px) - Inline text, buttons
- **Medium:** `w-5 h-5` (20px) - Default size
- **Large:** `w-6 h-6` (24px) - Headers, emphasis
- **XL:** `w-8 h-8` (32px) - Feature icons

### Color Standards

- **Primary:** `text-blue-600` - Main actions
- **Success:** `text-green-600` - Confirmation, success
- **Warning:** `text-yellow-600` - Warnings, attention
- **Danger:** `text-red-600` - Delete, errors
- **Neutral:** `text-gray-600` - Secondary info

### Resources

- [Lucide Icons Browser](https://lucide.dev/icons/)
- [Lucide React Docs](https://lucide.dev/guide/packages/lucide-react)

---

## Search & Filtering

### Material Search Strategy

**Multi-Field Search:**
- Material code
- Material name
- Category
- Supplier
- Custom attributes

**Search Implementation:**
```typescript
// API endpoint
GET /api/materials/search?q=cotton&category=fabric&supplier=S001

// Database query
WHERE (
  materialCode ILIKE '%cotton%' OR
  materialName ILIKE '%cotton%' OR
  description ILIKE '%cotton%'
)
AND category = 'fabric'
AND supplierId = 'S001'
```

### Advanced Filtering

**Available Filters:**

1. **By Category**
   - Fabric, Button, Elastic, Label, etc.

2. **By Status**
   - Active/Inactive
   - In Stock/Out of Stock
   - Below Reorder Level

3. **By Supplier**
   - Single or multiple suppliers
   - Supplier rating

4. **By Cost Range**
   - Min/Max cost
   - Currency

5. **By Date**
   - Created date
   - Last purchase date
   - Last updated date

### Sorting Options

- **Alphabetical:** Code A→Z, Name A→Z
- **Date:** Newest first, Oldest first
- **Stock:** High to low, Low to high
- **Cost:** Expensive to cheap, Cheap to expensive

### Pagination

**Default:** 20 items per page
**Options:** 10, 20, 50, 100, All

**API Parameters:**
```
?page=1&limit=20
```

---

## Best Practices

### Material Management

1. **Create materials before styles**
   - Ensures BOM accuracy
   - Prevents data inconsistency

2. **Use auto-generated codes**
   - Maintains consistency
   - Prevents duplicates

3. **Keep supplier information updated**
   - Lead times
   - Contact details
   - Pricing

4. **Set reorder levels**
   - Based on historical consumption
   - Consider lead time
   - Safety stock

### Style & BOM

1. **Complete BOM before approval**
   - All materials listed
   - Quantities verified
   - Costs calculated

2. **Version control**
   - Track BOM changes
   - Document revisions
   - Maintain history

3. **Regular reviews**
   - Update consumption
   - Verify costs
   - Remove obsolete materials

### SKU Management

1. **Consistent naming**
   - Follow standard format
   - Clear size/color codes
   - Avoid special characters

2. **Active management**
   - Disable discontinued SKUs
   - Archive old variants
   - Clean up duplicates

---

## Related Documentation

- **Current State:** [CURRENT_STATE.md](CURRENT_STATE.md)
- **Implementation Phases:** [IMPLEMENTATION_PHASES.md](IMPLEMENTATION_PHASES.md)
- **Database Schema:** [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)
- **Business Rules:** [BUSINESS_RULES.md](BUSINESS_RULES.md)

---

**Maintained By:** Kashaya Fabs Development Team
**Last Review:** November 25, 2025
**Next Review:** December 25, 2025
