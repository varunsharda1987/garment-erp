# Materials Master Management Guide

> **Complete Guide to Material Masters & Supplier Linking**
> **Last Updated:** January 12, 2026
> **Coverage:** 19 Material Types, 16 Supplier Tables, Complete CRUD Operations

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Material Masters](#2-core-material-masters)
3. [Extended Trim Masters](#3-extended-trim-masters)
4. [Material Categories](#4-material-categories)
5. [Supplier Linking System](#5-supplier-linking-system)
6. [Material Import/Export](#6-material-importexport)
7. [Material Stock Management](#7-material-stock-management)
8. [API Reference](#8-api-reference)
9. [Frontend Components](#9-frontend-components)
10. [Best Practices](#10-best-practices)

---

## 1. Overview

### 1.1 What are Material Masters?

Material Masters are the foundation of the Garment ERP system, representing all raw materials, trims, and accessories used in garment manufacturing. The system supports **19 distinct material types**, each with specialized attributes.

### 1.2 Material Classification

| Category | Material Types | Count |
|----------|---------------|-------|
| **Core Trims** | Lace, Button, Thread, Zipper, Elastic, Label, Packaging | 7 |
| **Fasteners** | Hook & Eye, Snap Button, Buckle, Belt | 4 |
| **Tapes & Cords** | Velcro, Drawstring, Ribbon | 3 |
| **Decorative** | Sequin, Bead, Motif | 3 |
| **Functional** | Interlining, Padding | 2 |

### 1.3 Key Features

- ✅ Unique material codes per type
- ✅ Supplier linking (16 supplier relation tables)
- ✅ Pricing support (per piece, per meter, per gross)
- ✅ Image upload support
- ✅ Active/inactive status management
- ✅ Audit trail (createdBy, createdAt, updatedAt)
- ✅ Customer-specific materials (Labels, Packaging)
- ✅ Brand-specific linking

---

## 2. Core Material Masters

### 2.1 Lace Master

**Model:** `lace_master`

**Key Fields:**
```prisma
{
  id: string (UUID)
  laceCode: string (unique among active)
  laceName: string
  supplierCode: string? (reference from supplier)
  buyerCode: string?
  width: decimal (cm/inches)
  design: string?
  color: string?
  composition: string? (e.g., "100% Polyester", "Cotton Blend")
  laceType: string? (e.g., "Crochet", "Eyelet", "Guipure")
  pricePerMeter: decimal
  image: string? (URL)
  supplierId: string? (FK to suppliers)
  isActive: boolean (default: true)
}
```

**Pricing Model:** Per meter

**Common Lace Types:**
- Crochet Lace
- Eyelet Lace
- Guipure Lace
- Chantilly Lace
- Venetian Lace
- Chemical Lace

**Usage Scenarios:**
- Dress trims
- Lingerie applications
- Decorative edges
- Sleeve cuffs
- Collar embellishments

---

### 2.2 Button Master

**Model:** `button_master`

**Key Fields:**
```prisma
{
  id: string
  buttonCode: string (unique among active)
  buttonName: string
  size: string? (e.g., "12mm", "16mm", "20mm", "L-18", "L-24")
  holes: int? (2-hole, 4-hole, shank)
  color: string?
  material: string? ("Plastic", "Metal", "Wood", "Shell", "Fabric-covered")
  shape: string? ("Round", "Square", "Oval", "Novelty")
  pricePerPiece: decimal
  pricePerGross: decimal (144 pieces)
  supplierId: string?
}
```

**Pricing Models:**
1. **Per Piece** - For bulk orders
2. **Per Gross** - Standard button industry unit (144 buttons)

**Button Size Chart:**
| Ligne (L) | MM | Inches |
|-----------|-----|---------|
| L-18 | 12mm | 1/2" |
| L-24 | 16mm | 5/8" |
| L-28 | 18mm | 11/16" |
| L-32 | 20mm | 3/4" |
| L-36 | 24mm | 15/16" |

**Material Types:**
- **Plastic:** ABS, Polyester, Acrylic
- **Metal:** Brass, Zinc Alloy, Stainless Steel
- **Natural:** Wood, Shell, Horn, Coconut
- **Fabric-covered:** Self-fabric buttons

---

### 2.3 Thread Master

**Model:** `thread_master`

**Key Fields:**
```prisma
{
  id: string
  threadCode: string
  threadName: string
  brand: string? (e.g., "Coats", "Madeira", "Gütermann")
  packagingType: enum (CONE | TUBE)
  piecesPerBox: int? (6 for Cone, 10 for Tube)
  metersPerUnit: decimal (meters per cone/tube)
  color: string?
  colorCode: string? (e.g., Pantone code)
  coneSize: string? (legacy field)
  pricePerCone: decimal
  supplierId: string?
}
```

**Packaging Standards:**
- **Cone:** 6 cones per box
- **Tube:** 10 tubes per box

**Common Thread Types:**
- Spun Polyester (general sewing)
- Core Spun (strength)
- Texturized Polyester (stretch fabrics)
- Cotton Thread (natural fabrics)
- Metallic Thread (decorative)
- Nylon Bonded (heavy-duty)

**Thread Count Reference:**
| Thread Count | Use Case |
|--------------|----------|
| 20/3 | Heavy duty (jeans, bags) |
| 40/2 | Standard garment sewing |
| 60/2 | Fine sewing (shirts, lingerie) |
| 80/2 | Extra fine (embroidery) |

---

### 2.4 Zipper Master

**Model:** `zipper_master`

**Key Fields:**
```prisma
{
  id: string
  zipperCode: string
  zipperName: string
  length: decimal (inches/cm)
  teethType: string? ("Metal", "Plastic", "Nylon", "Invisible")
  color: string?
  brand: string? (e.g., "YKK", "SBS", "KCC")
  sliderType: string? ("Auto-lock", "Pin-lock", "Two-way")
  tapeWidth: decimal (mm)
  pricePerPiece: decimal
  supplierId: string?
}
```

**Teeth Types:**
- **Metal:** Brass, Nickel, Antique brass finish
- **Plastic:** Resin molded teeth
- **Nylon (Coil):** Flexible, lightweight
- **Invisible:** Concealed teeth

**Slider Types:**
- **Auto-lock:** Stays in position
- **Pin-lock:** Manual lock
- **Two-way:** Opens from both ends
- **Reversible:** Can slide both directions

**Standard Lengths:**
- Pants: 6-9 inches
- Jackets: 18-24 inches
- Dresses: 14-22 inches
- Bags: 12-36 inches

---

### 2.5 Elastic Master

**Model:** `elastic_master`

**Key Fields:**
```prisma
{
  id: string
  elasticCode: string
  elasticName: string
  width: decimal (mm)
  stretchPercent: decimal (e.g., 100%, 150%, 200%)
  color: string?
  composition: string? ("Polyester/Spandex", "Nylon/Spandex")
  elasticType: string? ("Woven", "Knitted", "Braided")
  pricePerMeter: decimal
  supplierId: string?
}
```

**Elastic Types:**
- **Woven:** Strong, non-roll, good recovery
- **Knitted:** Soft, comfortable, stretches in all directions
- **Braided:** Budget-friendly, narrows when stretched

**Common Widths:**
- 6mm - Underwear leg bands
- 12mm - Waistbands (children)
- 25mm - Waistbands (adults)
- 38mm - Wide waistbands
- 50mm - Heavy-duty applications

**Composition Guide:**
| Composition | Stretch % | Use Case |
|-------------|-----------|----------|
| 80% Polyester / 20% Spandex | 100-120% | General garments |
| 90% Nylon / 10% Spandex | 150-180% | Activewear |
| 85% Polyester / 15% Rubber | 100-150% | Budget options |

---

### 2.6 Label Master

**Model:** `label_master`

**Key Fields:**
```prisma
{
  id: string
  labelCode: string
  labelName: string
  customerId: string? (customer-specific)
  brandCategoryId: string? (brand-specific)
  labelCategory: enum (SEWN_IN | HANGTAG | PRICE_TAG)
  labelType: string? ("Woven", "Printed", "Care", "Size", "Hangtag")
  size: string? (dimensions)
  fabricContent: string? ("100% Cotton", "65% Polyester 35% Cotton")
  washcareInstructions: string?
  printMethod: string? ("Screen", "Digital", "Woven", "Embossed")
  material: string? ("Satin", "Taffeta", "Paper", "Cotton")
  color: string?
  pricePerPiece: decimal
  pricePerHundred: decimal
  supplierId: string?
}
```

**Label Categories:**
1. **SEWN_IN (Trims):**
   - Woven brand labels
   - Care labels
   - Size labels
   - Content labels

2. **HANGTAG (Accessories):**
   - Brand hangtags
   - Marketing tags
   - Barcode tags

3. **PRICE_TAG:**
   - Retail price tags

**Label Materials:**
- **Satin:** Premium brand labels
- **Taffeta:** Standard woven labels
- **Cotton:** Natural fiber labels
- **Paper:** Hangtags and price tags
- **Polyester:** Durable care labels

**Print Methods:**
- **Woven:** High-end brand labels
- **Printed:** Cost-effective labels
- **Screen Print:** Bulk production
- **Digital Print:** Small batches, full color

---

### 2.7 Packaging Master

**Model:** `packaging_master`

**Key Fields:**
```prisma
{
  id: string
  packagingCode: string
  packagingName: string
  customerId: string? (customer-specific)
  brandCategoryId: string? (brand-specific)
  packagingType: string? ("Polybag", "Carton", "Hanger", "Tissue", "Sticker")
  size: string? (dimensions)
  material: string? ("LDPE", "HDPE", "Corrugated", "Plastic")
  thickness: string? (microns for polybags, ply for cartons)
  printDetails: string?
  pricePerPiece: decimal
  pricePerHundred: decimal
  supplierId: string?
}
```

**Packaging Types:**

1. **Polybags:**
   - LDPE (Low-Density Polyethylene) - Flexible
   - HDPE (High-Density Polyethylene) - Rigid
   - Thickness: 25-100 microns
   - Sizes: Various (8x12", 10x14", 12x18", etc.)

2. **Cartons:**
   - 3-Ply - Light garments
   - 5-Ply - Standard
   - 7-Ply - Heavy duty
   - Sizes: Custom per requirement

3. **Hangers:**
   - Plastic - Budget
   - Metal - Premium
   - Wooden - High-end

4. **Tissue Paper:**
   - White/Colored
   - Branded/Plain

5. **Stickers:**
   - Barcode stickers
   - Brand stickers
   - Size stickers

---

## 3. Extended Trim Masters

### 3.1 Hook & Eye Master

**Model:** `hook_eye_master`

**Key Fields:**
```prisma
{
  hookEyeCode: string
  hookEyeName: string
  size: string? ("0", "1", "2", "3" or "Small", "Medium", "Large")
  material: string? ("Metal", "Plastic", "Brass")
  color: string?
  finish: string? ("Nickel", "Antique Brass", "Black", "Chrome")
  pricePerPair: decimal
  pricePerGross: decimal (144 pairs)
}
```

**Sizes:**
- **Size 0:** Extra small (bras, lingerie)
- **Size 1:** Small (light blouses)
- **Size 2:** Medium (standard garments)
- **Size 3:** Large (coats, heavy fabrics)

**Common Finishes:**
- Nickel - Silver, rust-resistant
- Antique Brass - Vintage look
- Black - Modern, sleek
- Chrome - High shine

**Applications:**
- Bras and lingerie
- Waistband closures
- Coat fasteners
- Traditional garment closures

---

### 3.2 Snap Button Master

**Model:** `snap_button_master`

**Key Fields:**
```prisma
{
  snapButtonCode: string
  snapButtonName: string
  size: string? ("10mm", "12mm", "15mm", "18mm")
  type: string? ("Ring Snap", "Pearl Snap", "Heavy Duty", "Magnetic")
  material: string? ("Metal", "Plastic", "Brass", "Stainless Steel")
  color: string?
  pricePerPiece: decimal
  pricePerGross: decimal
}
```

**Snap Types:**
- **Ring Snap:** Standard 4-part snap
- **Pearl Snap:** Decorative top (Western shirts)
- **Heavy Duty:** Industrial applications
- **Magnetic:** Easy closure for adaptive clothing

**Size Guide:**
| Size | Use Case |
|------|----------|
| 10mm | Light fabrics, baby clothing |
| 12mm | Standard garments |
| 15mm | Jeans, jackets |
| 18mm | Heavy coats, bags |

---

### 3.3 Buckle Master

**Model:** `buckle_master`

**Key Fields:**
```prisma
{
  buckleCode: string
  buckleName: string
  width: string? ("25mm", "38mm", "50mm")
  type: string? ("Pin Buckle", "Slide Buckle", "D-Ring", "O-Ring", "Side-Release")
  material: string? ("Metal", "Plastic", "Wooden")
  color: string?
  finish: string? ("Chrome", "Antique", "Matte Black", "Brushed")
  pricePerPiece: decimal
}
```

**Buckle Types:**
- **Pin Buckle:** Traditional belt buckle with prong
- **Slide Buckle:** Adjustable strap buckle
- **D-Ring:** Half-circle ring for strap adjustment
- **O-Ring:** Full circle ring
- **Side-Release:** Plastic quick-release (bags, tactical gear)

**Common Widths:**
- 25mm (1") - Thin belts, bag straps
- 38mm (1.5") - Standard belts
- 50mm (2") - Wide belts, luggage straps

---

### 3.4 Belt Master

**Model:** `belt_master`

**Key Fields:**
```prisma
{
  beltCode: string
  beltName: string
  width: string? ("25mm", "38mm", "50mm")
  type: string? ("Leather Belt", "Fabric Belt", "Chain Belt", "Elastic Belt")
  material: string? ("Genuine Leather", "PU Leather", "Canvas", "Fabric")
  color: string?
  buckleType: string? ("Pin Buckle", "Slide Buckle", "D-Ring", "No Buckle")
  pricePerPiece: decimal
}
```

**Belt Types:**
- **Leather Belt:** Classic, durable
- **Fabric Belt:** Casual, washable
- **Chain Belt:** Decorative, fashion
- **Elastic Belt:** Comfortable, stretch

**Material Quality:**
| Material | Durability | Price Range | Use Case |
|----------|------------|-------------|----------|
| Genuine Leather | High | $$$ | Premium garments |
| PU Leather | Medium | $$ | Mid-range fashion |
| Canvas | Medium | $ | Casual wear |
| Fabric | Low-Medium | $ | Fast fashion |

---

### 3.5 Velcro Master

**Model:** `velcro_master`

**Key Fields:**
```prisma
{
  velcroCode: string
  velcroName: string
  width: string? ("16mm", "20mm", "25mm", "50mm")
  type: string? ("Sew-On", "Adhesive", "Both")
  color: string? ("White", "Black", "Beige")
  pricePerMeter: decimal
}
```

**Velcro Types:**
- **Hook Side:** Rough, hooks onto loop
- **Loop Side:** Soft, fuzzy surface
- **Hook & Loop Tape:** Both sides together

**Application Methods:**
- **Sew-On:** Stitched to fabric
- **Adhesive:** Stick-on backing
- **Both:** Hybrid options

**Common Widths:**
- 16mm - Lightweight applications
- 20mm - Standard closures
- 25mm - Garment closures
- 50mm - Heavy-duty, industrial

---

### 3.6 Drawstring Master

**Model:** `drawstring_master`

**Key Fields:**
```prisma
{
  drawstringCode: string
  drawstringName: string
  width: string? ("3mm", "5mm", "8mm", "10mm")
  material: string? ("Cotton", "Polyester", "Nylon", "Leather")
  color: string?
  hasAglets: boolean (metal or plastic tips)
  pricePerMeter: decimal
}
```

**Materials:**
- **Cotton:** Natural, soft, comfortable
- **Polyester:** Durable, quick-dry
- **Nylon:** Strong, weather-resistant
- **Leather:** Premium, decorative

**Aglets:** Metal or plastic tips that:
- Prevent fraying
- Easier threading
- Professional finish

**Applications:**
- Hoodie cords
- Waistbands (pants, shorts)
- Bag closures
- Parka hoods

---

### 3.7 Ribbon Master

**Model:** `ribbon_master`

**Key Fields:**
```prisma
{
  ribbonCode: string
  ribbonName: string
  width: string? ("6mm", "10mm", "15mm", "25mm", "38mm")
  type: string? ("Satin", "Grosgrain", "Velvet", "Organza", "Taffeta")
  color: string?
  pattern: string? ("Solid", "Striped", "Printed", "Jacquard")
  pricePerMeter: decimal
}
```

**Ribbon Types:**
- **Satin:** Smooth, shiny, both sides
- **Grosgrain:** Ribbed texture, stiff
- **Velvet:** Soft, luxurious
- **Organza:** Sheer, delicate
- **Taffeta:** Crisp, formal

**Common Uses:**
- Bows and ties
- Decorative trim
- Waistband ties
- Lingerie straps
- Gift wrap (packaging)

---

### 3.8 Sequin Master

**Model:** `sequin_master`

**Key Fields:**
```prisma
{
  sequinCode: string
  sequinName: string
  size: string? ("3mm", "5mm", "8mm", "10mm")
  shape: string? ("Round", "Square", "Star", "Heart", "Leaf")
  finish: string? ("Matte", "Shiny", "Holographic", "Iridescent")
  color: string?
  onTape: boolean (loose or pre-strung on tape)
  pricePerMeter: decimal (if on tape)
  pricePerPack: decimal (if loose)
}
```

**Sequin Shapes:**
- Round - Classic, versatile
- Square/Rectangle - Modern
- Star - Decorative
- Heart - Novelty
- Leaf/Flower - Nature-inspired

**Finishes:**
- **Matte:** Subtle, no glare
- **Shiny:** High shine, reflective
- **Holographic:** Rainbow effect
- **Iridescent:** Color-changing

**Formats:**
- **Loose:** Sold by weight/pack
- **On Tape:** Pre-strung, priced per meter

---

### 3.9 Bead Master

**Model:** `bead_master`

**Key Fields:**
```prisma
{
  beadCode: string
  beadName: string
  size: string? ("2mm", "4mm", "6mm", "8mm", "10mm")
  shape: string? ("Round", "Oval", "Tube", "Drop", "Faceted")
  material: string? ("Glass", "Plastic", "Pearl", "Crystal", "Wood")
  color: string?
  pricePerPack: decimal
  packSize: int (beads per pack)
}
```

**Bead Materials:**
- **Glass:** Classic, weight, shine
- **Plastic:** Lightweight, budget
- **Pearl:** Elegant, formal
- **Crystal:** Premium, sparkle
- **Wood:** Natural, rustic

**Shapes:**
- Round - Standard
- Oval - Elongated
- Tube - Long cylinder
- Drop/Teardrop - Pendant style
- Faceted - Cut surfaces (sparkle)

---

### 3.10 Motif Master

**Model:** `motif_master`

**Key Fields:**
```prisma
{
  motifCode: string
  motifName: string
  size: string? ("Small", "Medium", "Large" or dimensions)
  type: string? ("Embroidered", "Beaded", "Sequined", "Applique", "Printed")
  design: string? (design description)
  color: string?
  pricePerPiece: decimal
}
```

**Motif Types:**
- **Embroidered:** Thread-based designs
- **Beaded:** Hand-beaded or machine
- **Sequined:** Sequin-covered designs
- **Applique:** Fabric cutouts sewn on
- **Printed/Transfer:** Heat-applied designs

**Common Designs:**
- Floral patterns
- Geometric shapes
- Brand logos
- Animal designs
- Abstract art

**Applications:**
- Jackets (back, sleeves)
- Jeans (pockets, legs)
- Dresses (bodice, hem)
- Bags and accessories

---

### 3.11 Interlining Master

**Model:** `interlining_master`

**Key Fields:**
```prisma
{
  interliningCode: string
  interliningName: string
  weight: string? ("30gsm", "60gsm", "90gsm", "120gsm")
  type: string? ("Woven", "Non-Woven", "Knit", "Tricot")
  fusible: boolean (iron-on vs sew-in)
  width: string? ("90cm", "110cm", "150cm")
  color: string? ("White", "Black", "Charcoal")
  pricePerMeter: decimal
}
```

**Interlining Types:**
- **Woven:** Stable, structured (collars, cuffs)
- **Non-Woven:** Budget, various weights
- **Knit:** Stretch, comfortable (activewear)
- **Tricot:** Soft, drapey (lightweight garments)

**Weight Guide:**
| Weight | Use Case |
|--------|----------|
| 30gsm | Lightweight shirts, blouses |
| 60gsm | Standard collars, cuffs |
| 90gsm | Jackets, coats |
| 120gsm+ | Heavy coats, structured garments |

**Fusible vs Sew-In:**
- **Fusible:** Heat-activated adhesive backing
- **Sew-In:** Stitched into garment (dry-clean only garments)

---

### 3.12 Padding Master

**Model:** `padding_master`

**Key Fields:**
```prisma
{
  paddingCode: string
  paddingName: string
  thickness: string? ("3mm", "5mm", "10mm")
  type: string? ("Foam", "Wadding", "Batting", "Shoulder Pad")
  material: string? ("Polyester", "Cotton", "Memory Foam")
  density: string? ("Light", "Medium", "Heavy")
  pricePerMeter: decimal (for foam/wadding)
  pricePerPiece: decimal (for shoulder pads)
}
```

**Padding Types:**
- **Foam:** Shoulder pads, bra cups
- **Wadding:** Quilted jackets, blankets
- **Batting:** Insulation, puffer jackets
- **Shoulder Pads:** Structured garments

**Materials:**
- **Polyester:** Budget, lightweight
- **Cotton:** Natural, breathable
- **Memory Foam:** Premium, comfort

**Thickness Guide:**
- 3mm - Light padding (bra cups)
- 5mm - Standard (shoulder pads)
- 10mm+ - Heavy insulation (winter coats)

---

## 4. Material Categories

### 4.1 Category Structure

**Model:** `material_categories`

```prisma
{
  id: string
  categoryName: string
  parentCategoryId: string? (for hierarchical categories)
  categoryType: enum (RAW_MATERIAL | TRIM | ACCESSORY | PACKAGING)
  sortOrder: int
  isActive: boolean
}
```

### 4.2 Category Hierarchy Example

```
RAW_MATERIAL
├── Fabric
│   ├── Woven
│   ├── Knit
│   └── Non-Woven
├── Greige
└── Yarn

TRIM
├── Fasteners
│   ├── Buttons
│   ├── Zippers
│   ├── Snaps
│   └── Hooks & Eyes
├── Tapes
│   ├── Elastic
│   ├── Velcro
│   ├── Ribbon
│   └── Drawstring
└── Labels
    ├── Woven Labels
    ├── Printed Labels
    └── Care Labels

ACCESSORY
├── Decorative
│   ├── Sequins
│   ├── Beads
│   └── Motifs
└── Functional
    ├── Interlining
    └── Padding

PACKAGING
├── Polybags
├── Cartons
├── Hangers
└── Tissue Paper
```

---

## 5. Supplier Linking System

### 5.1 Overview

The ERP system maintains **16 separate supplier relation tables**, linking each material type to its suppliers. This allows:
- Multiple suppliers per material
- Supplier-specific pricing
- Supplier preference management
- Supplier performance tracking

### 5.2 Supplier Relation Tables

| Material Type | Relation Table | Purpose |
|---------------|----------------|---------|
| Lace | `lace_suppliers` | Link lace materials to suppliers |
| Button | `button_suppliers` | Link buttons to suppliers |
| Thread | `thread_suppliers` | Link threads to suppliers |
| Zipper | `zipper_suppliers` | Link zippers to suppliers |
| Elastic | `elastic_suppliers` | Link elastics to suppliers |
| Label | `label_suppliers` | Link labels to suppliers |
| Packaging | `packaging_suppliers` | Link packaging to suppliers |
| Machine Parts | `machine_part_suppliers` | Link machine parts to suppliers |
| Hook & Eye | `hook_eye_master.supplierId` | Direct FK |
| Snap Button | `snap_button_master.supplierId` | Direct FK |
| Buckle | `buckle_master.supplierId` | Direct FK |
| Belt | `belt_master.supplierId` | Direct FK |
| Velcro | `velcro_master.supplierId` | Direct FK |
| Drawstring | `drawstring_master.supplierId` | Direct FK |
| Ribbon | `ribbon_master.supplierId` | Direct FK |
| Sequin | `sequin_master.supplierId` | Direct FK |
| Bead | `bead_master.supplierId` | Direct FK |
| Motif | `motif_master.supplierId` | Direct FK |
| Interlining | `interlining_master.supplierId` | Direct FK |

### 5.3 Supplier Relation Schema (Example: Lace)

```prisma
model lace_suppliers {
  id               String    @id @default(uuid())
  laceId           String
  supplierId       String
  supplierMaterialCode String? // Supplier's code for this material
  pricePerUnit     Decimal?  @db.Decimal(10, 2)
  leadTimeDays     Int?
  minimumOrderQty  Decimal?  @db.Decimal(10, 2)
  isPreferred      Boolean   @default(false)
  lastPurchaseDate DateTime?
  createdAt        DateTime  @default(now())

  // Relations
  lace     lace_master @relation(fields: [laceId])
  supplier suppliers   @relation(fields: [supplierId])

  @@unique([laceId, supplierId])
}
```

### 5.4 Preferred Supplier Management

**Business Rules:**
- Each material can have multiple suppliers
- Only ONE supplier can be marked as `isPreferred: true`
- Preferred supplier is used for automatic PO suggestions
- System tracks `lastPurchaseDate` for supplier performance

### 5.5 Supplier-Specific Pricing

Different suppliers can offer different prices for the same material:

```json
{
  "laceId": "abc-123",
  "laceName": "Floral Lace 25mm",
  "suppliers": [
    {
      "supplierId": "sup-001",
      "supplierName": "ABC Laces Ltd",
      "pricePerMeter": 15.50,
      "isPreferred": true,
      "leadTimeDays": 7
    },
    {
      "supplierId": "sup-002",
      "supplierName": "XYZ Trims Co",
      "pricePerMeter": 16.00,
      "isPreferred": false,
      "leadTimeDays": 10
    }
  ]
}
```

---

## 6. Material Import/Export

### 6.1 Bulk Import

**Supported Formats:**
- Excel (.xlsx)
- CSV (.csv)

**Import Templates:**
Each material type has a dedicated import template with required columns.

**Example: Lace Import Template**

| Column | Required | Type | Example |
|--------|----------|------|---------|
| laceCode | Yes | String | LAC-001 |
| laceName | Yes | String | Floral Crochet Lace |
| width | No | Decimal | 25.00 |
| design | No | String | Floral pattern |
| color | No | String | White |
| composition | No | String | 100% Polyester |
| laceType | No | String | Crochet |
| pricePerMeter | No | Decimal | 15.50 |
| supplierCode | No | String | SUP-001 |

**Import Process:**
1. Download template from UI
2. Fill in material data
3. Upload file
4. System validates data
5. Preview errors/warnings
6. Confirm import
7. Materials created/updated

**Validation Rules:**
- `laceCode` must be unique among active materials
- If `supplierCode` provided, supplier must exist
- Numeric fields must be valid decimals
- Required fields cannot be empty

### 6.2 Bulk Export

**Export Formats:**
- Excel (.xlsx) - Formatted with headers
- CSV (.csv) - Raw data

**Export Options:**
- Export all materials
- Export active materials only
- Export by supplier
- Export by date range

**Example: Export API**

```typescript
GET /api/materials/lace/export?format=xlsx&activeOnly=true
```

---

## 7. Material Stock Management

### 7.1 Stock Tracking

Materials are tracked in the `inventory_stock` table:

```prisma
model inventory_stock {
  id              String @id @default(uuid())
  materialType    enum (LACE | BUTTON | THREAD | ZIPPER | ...)
  materialId      String
  warehouseId     String
  quantityOnHand  Decimal
  quantityReserved Decimal
  quantityAvailable Decimal (computed: onHand - reserved)
  unitOfMeasure   String (meter, piece, gross, kg)
  reorderLevel    Decimal
  reorderQuantity Decimal
  lastRestockDate DateTime
}
```

### 7.2 Units of Measure

| Material Type | Primary Unit | Alternate Units |
|---------------|--------------|-----------------|
| Lace | Meter | Yard |
| Button | Piece | Gross (144 pcs) |
| Thread | Cone/Tube | Box (6/10 pcs) |
| Zipper | Piece | - |
| Elastic | Meter | Yard |
| Label | Piece | Hundred |
| Packaging | Piece | Hundred, Thousand |
| Fabric | Meter | Yard, Roll |

### 7.3 Reorder Management

**Reorder Point Formula:**
```
Reorder Level = (Average Daily Usage × Lead Time Days) + Safety Stock
```

**Example:**
- Material: Thread (40/2)
- Average daily usage: 10 cones
- Supplier lead time: 7 days
- Safety stock: 20 cones
- **Reorder Level = (10 × 7) + 20 = 90 cones**

**Automated Alerts:**
- System generates alerts when `quantityAvailable < reorderLevel`
- Alerts visible on dashboard
- Email notifications to procurement team

---

## 8. API Reference

### 8.1 Lace Master API

**Base URL:** `/api/materials/lace`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all lace materials (paginated) |
| GET | `/:id` | Get single lace material by ID |
| POST | `/` | Create new lace material |
| PUT | `/:id` | Update lace material |
| DELETE | `/:id` | Soft delete (set isActive=false) |
| GET | `/search` | Search lace by code/name/color |
| GET | `/supplier/:supplierId` | Get lace materials by supplier |
| GET | `/export` | Export lace materials |
| POST | `/import` | Bulk import lace materials |

**Query Parameters (List):**
```
?page=1
&limit=20
&search=floral
&color=white
&supplierId=abc-123
&activeOnly=true
&sortBy=laceName
&sortOrder=asc
```

**Example Request (Create):**

```bash
POST /api/materials/lace
Content-Type: application/json

{
  "laceCode": "LAC-001",
  "laceName": "Floral Crochet Lace",
  "width": 25.00,
  "design": "Floral pattern",
  "color": "White",
  "composition": "100% Polyester",
  "laceType": "Crochet",
  "pricePerMeter": 15.50,
  "supplierId": "sup-001"
}
```

**Example Response:**

```json
{
  "id": "lace-uuid-123",
  "laceCode": "LAC-001",
  "laceName": "Floral Crochet Lace",
  "width": 25.00,
  "design": "Floral pattern",
  "color": "White",
  "composition": "100% Polyester",
  "laceType": "Crochet",
  "pricePerMeter": 15.50,
  "supplierId": "sup-001",
  "supplier": {
    "id": "sup-001",
    "name": "ABC Laces Ltd",
    "code": "SUP-001"
  },
  "isActive": true,
  "createdAt": "2026-01-12T10:30:00Z",
  "updatedAt": "2026-01-12T10:30:00Z"
}
```

### 8.2 Common API Patterns

**All material types follow the same API pattern:**
- `/api/materials/{materialType}`
- Standard CRUD operations
- Search & filter capabilities
- Supplier linking
- Import/export functionality

**Material Types for API:**
- `lace`
- `button`
- `thread`
- `zipper`
- `elastic`
- `label`
- `packaging`
- `hook-eye`
- `snap-button`
- `buckle`
- `belt`
- `velcro`
- `drawstring`
- `ribbon`
- `sequin`
- `bead`
- `motif`
- `interlining`
- `padding`

---

## 9. Frontend Components

### 9.1 Material Selector Component

Reusable component for selecting materials in forms:

```tsx
import MaterialSelector from '@/components/MaterialSelector';

<MaterialSelector
  materialType="lace" // or button, thread, etc.
  value={selectedMaterialId}
  onChange={handleMaterialChange}
  label="Select Lace"
  required
  showImage
  showPrice
  filterBySupplier={supplierId} // optional
/>
```

### 9.2 Material Form Component

Generic form for creating/editing materials:

```tsx
import MaterialForm from '@/components/MaterialForm';

<MaterialForm
  materialType="button"
  mode="create" // or "edit"
  initialData={existingMaterial} // for edit mode
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

### 9.3 Material List Component

Display materials in a searchable, filterable table:

```tsx
import MaterialList from '@/components/MaterialList';

<MaterialList
  materialType="zipper"
  showImages
  allowBulkActions
  onEdit={handleEdit}
  onDelete={handleDelete}
  onExport={handleExport}
/>
```

---

## 10. Best Practices

### 10.1 Material Coding Standards

**Format:** `{TYPE}-{SEQUENCE}-{VARIANT}`

**Examples:**
- `LAC-001-WHT` - Lace 001, White
- `BTN-025-BLK-12MM` - Button 025, Black, 12mm
- `THR-040-RED-CONE` - Thread 040, Red, Cone

**Guidelines:**
- Use consistent prefixes per material type
- Include size/color in code for easy identification
- Keep codes short but descriptive
- Avoid special characters except hyphen

### 10.2 Supplier Management

**Best Practices:**
- Always mark a preferred supplier
- Update `lastPurchaseDate` after each PO
- Review supplier performance quarterly
- Maintain at least 2 suppliers per critical material
- Negotiate bulk pricing for high-volume materials

### 10.3 Pricing Strategy

**Update Frequency:**
- Review prices monthly
- Update after significant currency fluctuations
- Document price change history
- Notify stakeholders of major price changes (>10%)

**Bulk Discounts:**
- Negotiate tiered pricing with suppliers
- Document MOQ (Minimum Order Quantity)
- Calculate break-even points for bulk orders

### 10.4 Stock Management

**Reorder Point Calculation:**
```
Reorder Level = (Average Daily Usage × Lead Time) + Safety Stock
```

**Safety Stock Factors:**
- Supplier reliability (± 20%)
- Lead time variability (± 10%)
- Demand volatility (± 15%)
- Criticality of material (± 25%)

**Example:**
- Daily usage: 50 meters
- Lead time: 14 days
- Safety stock: 200 meters (20% buffer)
- **Reorder Level = (50 × 14) + 200 = 900 meters**

### 10.5 Data Quality

**Required Actions:**
- Upload high-quality images (min 800x800px)
- Fill all technical specifications
- Document material compositions
- Link to correct suppliers
- Update status (active/inactive) regularly

**Validation Checklist:**
- [ ] Unique material code
- [ ] Descriptive material name
- [ ] Accurate measurements
- [ ] Current pricing
- [ ] Valid supplier link
- [ ] High-quality image
- [ ] Complete technical specs

---

## Appendix A: Material Type Quick Reference

| Material | Code Prefix | Unit | Key Attributes |
|----------|-------------|------|----------------|
| Lace | LAC | Meter | Width, Design, Type |
| Button | BTN | Piece/Gross | Size, Holes, Material |
| Thread | THR | Cone/Tube | Brand, Color, Packaging |
| Zipper | ZIP | Piece | Length, Teeth Type |
| Elastic | ELS | Meter | Width, Stretch % |
| Label | LBL | Piece/Hundred | Type, Material, Print |
| Packaging | PKG | Piece/Hundred | Type, Size, Material |
| Hook & Eye | HKE | Pair/Gross | Size, Material, Finish |
| Snap Button | SNP | Piece/Gross | Size, Type, Material |
| Buckle | BCK | Piece | Width, Type, Finish |
| Belt | BLT | Piece | Width, Type, Material |
| Velcro | VLC | Meter | Width, Type |
| Drawstring | DRW | Meter | Width, Material, Aglets |
| Ribbon | RBN | Meter | Width, Type, Pattern |
| Sequin | SEQ | Meter/Pack | Size, Shape, Finish |
| Bead | BED | Pack | Size, Shape, Material |
| Motif | MOT | Piece | Size, Type, Design |
| Interlining | INT | Meter | Weight, Type, Fusible |
| Padding | PAD | Meter/Piece | Thickness, Type |

---

## Appendix B: Supplier Performance Metrics

Track these KPIs for each supplier:

| Metric | Formula | Target |
|--------|---------|--------|
| On-Time Delivery % | (On-Time Deliveries / Total Deliveries) × 100 | >95% |
| Quality Rejection % | (Rejected Qty / Total Received Qty) × 100 | <2% |
| Price Competitiveness | (Supplier Price / Market Average) × 100 | <105% |
| Lead Time Accuracy | (Actual Lead Time / Promised Lead Time) × 100 | 90-110% |
| Fill Rate % | (Filled Qty / Ordered Qty) × 100 | >98% |

---

**Status:** Production Ready
**Coverage:** 19 Material Types, 16 Supplier Tables
**Last Updated:** January 12, 2026
