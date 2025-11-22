# SKU/Variant Implementation Guide

This guide provides step-by-step instructions to implement proper SKU tracking in the garment ERP system.

## Overview

Currently, the system has:
- `size_options` table - stores sizes for a style
- `color_options` table - stores colors for a style
- **Missing**: A unified SKU/variant table that combines size + color with a unique SKU code

## Goal

Create a system where:
- Each Style (e.g., `DRE105`) has multiple SKUs
- Each SKU represents a unique size-color combination (e.g., `DRE105XS`, `DRE105S`, `DRE105M`)
- SKUs are automatically created/updated during bulk import
- Inventory, orders, and stock are tracked at SKU level

---

## Step 1: Create SKU/Variant Database Table

### 1.1 Create Prisma Migration

Create a new file: `backend/prisma/migrations/YYYYMMDDHHMMSS_add_style_variants/migration.sql`

```sql
-- Create style_variants table
CREATE TABLE "style_variants" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "sizeId" TEXT,
    "colorId" TEXT,
    "sizeName" TEXT,
    "colorName" TEXT,
    "barcode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_variants_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on SKU
CREATE UNIQUE INDEX "style_variants_sku_key" ON "style_variants"("sku");

-- Create index on styleId for faster queries
CREATE INDEX "style_variants_styleId_idx" ON "style_variants"("styleId");

-- Add foreign key to styles table
ALTER TABLE "style_variants" ADD CONSTRAINT "style_variants_styleId_fkey"
    FOREIGN KEY ("styleId") REFERENCES "styles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional: Add foreign keys to size and color options if you want strict referential integrity
ALTER TABLE "style_variants" ADD CONSTRAINT "style_variants_sizeId_fkey"
    FOREIGN KEY ("sizeId") REFERENCES "size_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "style_variants" ADD CONSTRAINT "style_variants_colorId_fkey"
    FOREIGN KEY ("colorId") REFERENCES "color_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

### 1.2 Update Prisma Schema

Add to `backend/prisma/schema.prisma`:

```prisma
model style_variants {
  id                    String                 @id @default(cuid())
  styleId               String
  sku                   String                 @unique
  sizeId                String?
  colorId               String?
  sizeName              String?
  colorName             String?
  barcode               String?
  isActive              Boolean                @default(true)
  sortOrder             Int                    @default(0)
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt

  // Relations
  style                 styles                 @relation(fields: [styleId], references: [id], onDelete: Cascade)
  size                  size_options?          @relation(fields: [sizeId], references: [id], onDelete: SetNull)
  color                 color_options?         @relation(fields: [colorId], references: [id], onDelete: SetNull)

  // Add to related tables as needed
  finished_goods_stock  finished_goods_stock[]
  order_item_breakup    order_item_breakup[]
  delivery_note_items   delivery_note_items[]

  @@index([styleId])
}
```

Also update related models to add the relation:

```prisma
model styles {
  // ... existing fields ...
  style_variants        style_variants[]
}

model size_options {
  // ... existing fields ...
  style_variants        style_variants[]
}

model color_options {
  // ... existing fields ...
  style_variants        style_variants[]
}
```

### 1.3 Run Migration

```bash
cd backend
npx prisma migrate dev --name add_style_variants
npx prisma generate
```

---

## Step 2: Create Backend Types

Create `backend/src/types/style-variant.types.ts`:

```typescript
export interface StyleVariantData {
  sku: string;
  sizeName?: string;
  colorName?: string;
  sizeId?: string;
  colorId?: string;
  barcode?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateStyleVariantsRequest {
  styleId: string;
  variants: StyleVariantData[];
}

export interface StyleVariantResponse {
  id: string;
  styleId: string;
  sku: string;
  sizeName: string | null;
  colorName: string | null;
  barcode: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Step 3: Create Style Variant Service

Create `backend/src/services/style-variant.service.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { StyleVariantData } from '../types/style-variant.types';

const prisma = new PrismaClient();

export class StyleVariantService {
  /**
   * Create or update variants for a style
   */
  async upsertStyleVariants(
    styleId: string,
    variants: StyleVariantData[]
  ): Promise<number> {
    let createdCount = 0;

    for (const variant of variants) {
      // Check if variant with this SKU already exists
      const existing = await prisma.style_variants.findUnique({
        where: { sku: variant.sku },
      });

      if (existing) {
        // Update existing variant
        await prisma.style_variants.update({
          where: { id: existing.id },
          data: {
            sizeName: variant.sizeName,
            colorName: variant.colorName,
            sizeId: variant.sizeId,
            colorId: variant.colorId,
            barcode: variant.barcode,
            isActive: variant.isActive ?? true,
            sortOrder: variant.sortOrder ?? 0,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new variant
        await prisma.style_variants.create({
          data: {
            id: `${styleId}-${variant.sku}-${Date.now()}`,
            styleId,
            sku: variant.sku,
            sizeName: variant.sizeName || null,
            colorName: variant.colorName || null,
            sizeId: variant.sizeId || null,
            colorId: variant.colorId || null,
            barcode: variant.barcode || null,
            isActive: variant.isActive ?? true,
            sortOrder: variant.sortOrder ?? 0,
          },
        });
        createdCount++;
      }
    }

    return createdCount;
  }

  /**
   * Get all variants for a style
   */
  async getStyleVariants(styleId: string) {
    return await prisma.style_variants.findMany({
      where: { styleId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get variant by SKU
   */
  async getVariantBySKU(sku: string) {
    return await prisma.style_variants.findUnique({
      where: { sku },
      include: {
        style: true,
        size: true,
        color: true,
      },
    });
  }

  /**
   * Find or create size option
   */
  async findOrCreateSize(styleId: string, sizeName: string): Promise<string | null> {
    if (!sizeName) return null;

    const existing = await prisma.size_options.findFirst({
      where: {
        styleId,
        sizeName,
      },
    });

    if (existing) return existing.id;

    const newSize = await prisma.size_options.create({
      data: {
        id: `${styleId}-size-${sizeName}-${Date.now()}`,
        styleId,
        sizeName,
        sizeCode: sizeName.toUpperCase(),
        sortOrder: 0,
      },
    });

    return newSize.id;
  }

  /**
   * Find or create color option
   */
  async findOrCreateColor(styleId: string, colorName: string): Promise<string | null> {
    if (!colorName) return null;

    const existing = await prisma.color_options.findFirst({
      where: {
        styleId,
        colorName,
      },
    });

    if (existing) return existing.id;

    const newColor = await prisma.color_options.create({
      data: {
        id: `${styleId}-color-${colorName}-${Date.now()}`,
        styleId,
        colorName,
        colorCode: null,
        sortOrder: 0,
      },
    });

    return newColor.id;
  }
}

export default new StyleVariantService();
```

---

## Step 4: Update Style Import Service

Modify `backend/src/services/style-import.service.ts`:

### 4.1 Add Import at the Top

```typescript
import StyleVariantService from './style-variant.service';
import { StyleVariantData } from '../types/style-variant.types';
```

### 4.2 Add Variant Tracking to ImportSummary

In `backend/src/types/style-import.types.ts`:

```typescript
export interface ImportSummary {
  totalRows: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;

  stylesCreated: number;
  stylesUpdated: number;
  componentsCreated: number;
  fabricsCreated: number;
  cadEntriesCreated: number;
  variantsCreated: number;  // ADD THIS

  processingTimeMs: number;
}
```

### 4.3 Update Import Logic

In the `importStylesFromCSV` method, after processing components:

```typescript
// Around line 105-110, after processComponentsAndFabrics
summary.componentsCreated += componentMap.componentsCreated;
summary.fabricsCreated += componentMap.fabricsCreated;
summary.cadEntriesCreated += componentMap.cadEntriesCreated;

// ADD THIS: Process variants
const variantCount = await this.processStyleVariants(style.id, styleCode, rows);
summary.variantsCreated += variantCount;

summary.successCount += rows.length;
```

### 4.4 Add processStyleVariants Method

Add this new method to `StyleImportService` class:

```typescript
/**
 * Process and create variants for a style from CSV rows
 */
private async processStyleVariants(
  styleId: string,
  styleCode: string,
  rows: StyleImportRow[]
): Promise<number> {
  // Extract unique SKU/size/color combinations from rows
  const variantMap = new Map<string, StyleVariantData>();

  for (const row of rows) {
    const csvRow = row as any; // Access original CSV data

    if (csvRow.sku) {
      // Use SKU as key to deduplicate
      if (!variantMap.has(csvRow.sku)) {
        variantMap.set(csvRow.sku, {
          sku: csvRow.sku,
          sizeName: csvRow.size || null,
          colorName: csvRow.color || null,
        });
      }
    }
  }

  // If no SKUs found in CSV, skip variant creation
  if (variantMap.size === 0) {
    return 0;
  }

  // Convert map to array and process variants
  const variants = Array.from(variantMap.values());

  // Find or create size/color options and link them
  for (const variant of variants) {
    if (variant.sizeName) {
      variant.sizeId = await StyleVariantService.findOrCreateSize(styleId, variant.sizeName);
    }
    if (variant.colorName) {
      variant.colorId = await StyleVariantService.findOrCreateColor(styleId, variant.colorName);
    }
  }

  // Create/update variants
  return await StyleVariantService.upsertStyleVariants(styleId, variants);
}
```

---

## Step 5: Update Frontend Types

In `frontend/src/types/style-import.types.ts`:

```typescript
export interface StyleImportResponse {
  success: boolean;
  importBatchId: string;
  summary: {
    totalRows: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    stylesCreated: number;
    stylesUpdated: number;
    componentsCreated: number;
    fabricsCreated: number;
    cadEntriesCreated: number;
    variantsCreated: number;  // ADD THIS
    processingTimeMs: number;
  };
  errors?: Array<{
    rowNumber: number;
    styleCode: string;
    componentName: string;
    fabricDescription: string;
    errorMessage: string;
    errorType: string;
  }>;
}
```

---

## Step 6: Update Frontend UI

In `frontend/src/pages/StyleBulkImport.tsx`, add display for variants created:

Around line 196-209, add a new stat box:

```typescript
<div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
  <div className="p-3 bg-gray-50 rounded">
    <div className="text-lg font-semibold text-gray-900">{summary.stylesCreated}</div>
    <div className="text-sm text-gray-600">Styles Created</div>
  </div>
  <div className="p-3 bg-gray-50 rounded">
    <div className="text-lg font-semibold text-gray-900">{summary.componentsCreated}</div>
    <div className="text-sm text-gray-600">Components Created</div>
  </div>
  <div className="p-3 bg-gray-50 rounded">
    <div className="text-lg font-semibold text-gray-900">{summary.fabricsCreated}</div>
    <div className="text-sm text-gray-600">Fabrics Created</div>
  </div>
  <div className="p-3 bg-gray-50 rounded">
    <div className="text-lg font-semibold text-gray-900">{summary.variantsCreated || 0}</div>
    <div className="text-sm text-gray-600">SKUs Created</div>
  </div>
</div>
```

---

## Step 7: Create API Endpoints for SKU Management

Create `backend/src/controllers/style-variant.controller.ts`:

```typescript
import { Request, Response } from 'express';
import StyleVariantService from '../services/style-variant.service';

class StyleVariantController {
  async getStyleVariants(req: Request, res: Response) {
    try {
      const { styleId } = req.params;
      const variants = await StyleVariantService.getStyleVariants(styleId);

      return res.status(200).json({
        success: true,
        data: variants,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getVariantBySKU(req: Request, res: Response) {
    try {
      const { sku } = req.params;
      const variant = await StyleVariantService.getVariantBySKU(sku);

      if (!variant) {
        return res.status(404).json({
          success: false,
          message: 'Variant not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: variant,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new StyleVariantController();
```

Add routes in `backend/src/routes/styles.routes.ts` or create new variant routes file.

---

## Step 8: Testing

### 8.1 Test Database Migration

```bash
cd backend
npx prisma migrate dev
npx prisma studio
# Check if style_variants table exists
```

### 8.2 Test Import with SKUs

1. Download the template from the UI
2. Fill in SKU, Size, and Color columns
3. Upload and verify:
   - Variants are created
   - Summary shows "X SKUs Created"
   - Check database: `SELECT * FROM style_variants;`

### 8.3 Verify Relationships

```sql
-- Check variants for a specific style
SELECT sv.*, s.styleCode, s.styleName
FROM style_variants sv
JOIN styles s ON sv."styleId" = s.id
WHERE s."styleCode" = 'DRE105';
```

---

## Step 9: Future Enhancements

Once basic SKU tracking is working, consider:

1. **Inventory Integration**: Update stock tables to reference `variantId` instead of just `styleId`
2. **Order Management**: Link orders to specific variants
3. **Barcode Generation**: Auto-generate barcodes for each SKU
4. **Pricing per Variant**: Store different prices for different sizes
5. **SKU Management UI**: Create a dedicated page to manage SKUs
6. **Stock Reporting by SKU**: Update reports to show stock per SKU

---

## Rollback Plan

If something goes wrong:

```bash
cd backend
npx prisma migrate resolve --rolled-back MIGRATION_NAME
# Or manually drop the table:
# DROP TABLE style_variants;
```

---

## Summary

This implementation:
- ✅ Creates a proper SKU/variant table
- ✅ Links SKUs to styles, sizes, and colors
- ✅ Imports SKUs from bulk upload
- ✅ Tracks SKU creation in import summary
- ✅ Provides API to query SKUs
- ✅ Ready for inventory/order integration

**Estimated Time**: 2-3 hours

**Files Modified**:
- `backend/prisma/schema.prisma`
- `backend/src/types/style-import.types.ts`
- `backend/src/types/style-variant.types.ts` (new)
- `backend/src/services/style-import.service.ts`
- `backend/src/services/style-variant.service.ts` (new)
- `backend/src/controllers/style-variant.controller.ts` (new)
- `frontend/src/types/style-import.types.ts`
- `frontend/src/pages/StyleBulkImport.tsx`

---

## Need Help?

If you encounter any issues during implementation, check:
1. Prisma migrations applied successfully
2. Backend restarted after changes
3. Frontend types match backend response
4. Database foreign keys are correct
