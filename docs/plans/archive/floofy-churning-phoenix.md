# Fix: Trims Not Displaying in Style View Mode

## Problem Summary
Trims data shows correctly in Edit mode (StyleForm) but not in View mode (StyleDetail).

## Background: Why `style_garment_trims` Exists But Isn't Used

### The Evolution
1. **Phase 1 (Original Design):** `style_garment_trims` was created as a simple table to store trims directly on styles with basic fields: `trimName`, `trimType`, `quantityPerPiece`, `unit`, `supplier`.

2. **Phase 2 (Material BOM System):** A more powerful `style_material_bom` system was introduced (see schema line 1700-1731) that:
   - Links to actual material masters (lace_master, button_master, thread_master, etc.)
   - Supports multiple usage categories: `GARMENT_TRIM`, `PACKAGING`, etc.
   - Has direct foreign keys to each material type for performance and type safety
   - Tracks costs, units, and component associations
   - All material masters now have `style_material_bom[]` relations (lines 4463, 4496, 4530, 4619, 4650, 4690, 4770)

3. **Current State:** `style_garment_trims` was never deleted from schema but is now effectively deprecated. The StyleForm uses the new `style_material_bom` system, but StyleDetail still looks at the old table.

### Why Keep style_garment_trims?
- May contain historical data from before the migration
- Schema migrations are destructive; safer to leave it
- Could be cleaned up in a future migration

## Root Cause
**Data source mismatch:**
- Backend saves trims to `style_material_bom` table (line 849 in style.service.ts)
- StyleDetail.tsx reads from `style.garmentTrims` (line 437) which maps to the empty `style_garment_trims` table
- StyleFormRedesigned.tsx correctly reads from `style.styleMaterialBom` (line 760)

The `style_garment_trims` table is deprecated - all new trims go to `style_material_bom`.

## Solution
Full cleanup: Update StyleDetail.tsx to use `styleMaterialBom` AND remove the deprecated `style_garment_trims` table.

## Files to Modify

### 1. Frontend Display Fix

**[frontend/src/pages/StyleDetail.tsx](frontend/src/pages/StyleDetail.tsx)** - Lines 437-484
- Replace `style.garmentTrims` with filtered `style.styleMaterialBom`
- Filter by `usageCategory === 'GARMENT_TRIM'`
- Extract trim names from appropriate masters (buttonMaster, laceMaster, etc.)

### 2. Remove Deprecated Type

**[frontend/src/types/style.types.ts](frontend/src/types/style.types.ts)**
- Line 77: Remove `garmentTrims: StyleGarmentTrim[];` from Style interface
- Lines 674-684: Remove `StyleGarmentTrim` interface entirely

### 3. Backend Cleanup

**[backend/src/services/style.service.ts](backend/src/services/style.service.ts)**
- Line 46: Remove `style_garment_trims?: unknown[];` from type
- Lines 368, 536, 1007: Remove `style_garment_trims: true` from includes

**[backend/src/utils/serializer.ts](backend/src/utils/serializer.ts)**
- Line 199: Remove `styleGarmentTrims: 'garmentTrims'` mapping

**[backend/src/types/style.types.ts](backend/src/types/style.types.ts)**
- Lines 114-122: Remove deprecated `GarmentTrimInput` interface
- Line 226: Remove `garmentTrims?: GarmentTrimInput[];` from CreateStyleInput

### 4. Schema Cleanup (Optional - creates migration)

**[backend/prisma/schema.prisma](backend/prisma/schema.prisma)**
- Lines 1604-1617: Remove `style_garment_trims` model
- Line 1805: Remove `style_garment_trims` relation from `styles` model

**Note:** This requires running `npx prisma migrate dev` to create a migration.

### 5. Documentation Updates (Optional)

Files with references that may need updates:
- `docs/PRODUCT_FLOW_GUIDE.md`
- `docs/DATABASE_SCHEMA.md`
- Various migration/rollback scripts (can be left as-is for historical reference)

## Implementation Steps

1. **Fix StyleDetail.tsx first** - This solves the immediate bug
2. **Remove frontend type** - Clean up StyleGarmentTrim interface
3. **Remove backend includes** - Stop querying the deprecated table
4. **Remove serializer mapping** - Clean up camelCase conversion
5. **Remove from schema** - Drop the table (requires migration)
6. **Run `npx prisma migrate dev`** - Create migration to drop table

## Data Structure for styleMaterialBom

```typescript
// Each trim record contains:
{
  materialType: 'BUTTON' | 'THREAD' | 'ZIPPER' | 'ELASTIC' | 'LACE',
  usageCategory: 'GARMENT_TRIM',
  quantityPerGarment: number,
  unit: string,
  // Master relations (one will be populated based on materialType):
  buttonMaster?: { buttonCode, buttonName, ... },
  laceMaster?: { laceCode, laceName, ... },
  threadMaster?: { threadCode, threadName, ... },
  zipperMaster?: { zipperCode, zipperName, ... },
  elasticMaster?: { elasticCode, elasticName, ... },
}
```

## Testing
After implementation, verify:
1. View a style with trims - trims should display in the Bill of Materials tab
2. Different trim types (buttons, lace, thread) display correctly with names and codes
3. Edit mode still works as expected
4. No TypeScript errors after type removal
5. Database migration runs successfully

---

# Follow-up Fix: Trims Validation Error on Save

## Problem
When saving a style with trims, getting validation error:
```
Validation failed: trims.0.masterId: Master ID is required
```

## Root Cause
In **StyleFormRedesigned.tsx lines 818-819**, when loading trims from `styleMaterialBom`:

```typescript
const masterId = bom.buttonId || bom.threadId || bom.zipperId ||
                 bom.elasticId || bom.laceId || '';  // Falls back to empty string
```

If all FK fields are null (e.g., records created before proper FK population), `masterId` becomes `''`.

When submitting, **style.schema.ts line 144** requires:
```typescript
masterId: z.string().min(1, 'Master ID is required')
```

This fails validation for any trim with empty `masterId`.

## Solution
Filter out trims with empty `masterId` before submission in StyleFormRedesigned.tsx.

### File: [frontend/src/pages/StyleFormRedesigned.tsx](frontend/src/pages/StyleFormRedesigned.tsx)

In the `saveStyle` function (around line 1390), before sending `trims` to the API, filter:

```typescript
// Filter out trims with empty masterId (invalid/incomplete records)
const validTrims = selectedTrims.filter(trim => trim.masterId && trim.masterId.trim() !== '');

// Use validTrims instead of selectedTrims in the request body
trims: validTrims.map(trim => ({
  trimType: trim.trimType,
  masterId: trim.masterId,
  color: trim.color || null,
})),
```

This ensures only valid trims with proper masterId are submitted.

---

# Fix: SKU Auto-Generation Not Working and Not Saving

## Problem Summary
1. **SKU Generation**: "Auto-Generate SKUs" button generates SKUs in UI but they don't persist after save
2. **Size Presets**: Selecting a size preset should populate sizes but variants not being saved
3. **Variants Not Saved**: SKU variants are being submitted from frontend but NOT saved to database during style creation

## Root Cause Analysis

### Issue 1: Backend `createWithRelations` Does NOT Handle `skuVariants`

**File: [backend/src/services/style.service.ts](backend/src/services/style.service.ts) - Lines 180-375**

The `createWithRelations()` method creates styles with nested relations for:
- ✅ `style_components` (line 341)
- ✅ `style_processes` (line 342)
- ✅ `style_material_bom` (line 343)
- ❌ **`style_variants` - NOT HANDLED!**

The frontend sends `skuVariants` in the request (line 1397 in StyleFormRedesigned.tsx):
```typescript
skuVariants: skuVariants.filter(v => v.isActive),
```

But the backend completely ignores this field during CREATE. The `skuVariants` handling only exists in `updateWithRelations()` (lines 763-826) which is called during UPDATE operations.

### Issue 2: Frontend Filters Out Empty SKUs

The backend filters variants with empty SKUs (line 772):
```typescript
const validVariants = (data.skuVariants as SKUVariantInput[])
  .filter(v => v.sku && v.sku.trim() !== '')
```

If user doesn't click "Auto-Generate SKUs" button, all SKU fields are empty and ALL variants are filtered out.

### Data Flow Problem

```
CREATE NEW STYLE:
Frontend → sends skuVariants array → Backend createWithRelations() → IGNORES skuVariants → No variants saved

UPDATE EXISTING STYLE:
Frontend → sends skuVariants array → Backend updateWithRelations() → Creates variants → ✅ Works
```

## Solution

### Option A: Add skuVariants handling to `createWithRelations()` (Recommended)

Add logic to create `style_variants` and `size_options` during style creation, similar to how `updateWithRelations()` handles it.

### Files to Modify

**[backend/src/services/style.service.ts](backend/src/services/style.service.ts)**

Add skuVariants handling after line 371 (after style creation, before return):

```typescript
// Handle SKU variants if provided (after style creation)
if (data.skuVariants && data.skuVariants.length > 0) {
  const validVariants = (data.skuVariants as SKUVariantInput[])
    .filter(v => v.sku && v.sku.trim() !== '')
    .reduce((acc, variant) => {
      if (!acc.some(v => v.sku === variant.sku)) {
        acc.push(variant);
      }
      return acc;
    }, [] as SKUVariantInput[]);

  for (const variant of validVariants) {
    // Get or create size option
    let sizeOption = await this.prisma.size_options.findFirst({
      where: { styleId: style.id, sizeName: variant.size },
    });

    if (!sizeOption) {
      sizeOption = await this.prisma.size_options.create({
        data: {
          id: randomUUID(),
          styleId: style.id,
          sizeName: variant.size,
          sizeCode: variant.size,
          sortOrder: getSizeOrder(variant.size),
          isActive: true,
        },
      });
    }

    // Create style_variant
    await this.prisma.style_variants.create({
      data: {
        id: randomUUID(),
        styleId: style.id,
        sizeId: sizeOption.id,
        sizeName: variant.size,
        sku: variant.sku,
        barcode: variant.barcode || null,
        accountingSKU: variant.accountingSKU || null,
        isActive: variant.isActive !== false,
        sortOrder: getSizeOrder(variant.size),
      },
    });
  }
}
```

### Additional UX Improvement (Optional)

**[frontend/src/pages/StyleFormRedesigned.tsx](frontend/src/pages/StyleFormRedesigned.tsx)**

Auto-generate SKUs when style code changes (to ensure SKUs are never empty):

Add effect around line 1158:
```typescript
// Auto-generate SKUs when styleCode changes (ensure variants have SKUs)
useEffect(() => {
  if (styleCode && styleCode.trim() !== '') {
    setSkuVariants(prev => prev.map(v => ({
      ...v,
      sku: v.isActive && !v.sku ? `${styleCode}${v.size}` : v.sku
    })));
  }
}, [styleCode]);
```

Or alternatively, auto-generate SKUs during save if they're empty (before validation):

In `saveStyle()` function, add before line 1288:
```typescript
// Auto-generate SKUs for variants that don't have them
const skuVariantsWithGenerated = skuVariants.map(v => ({
  ...v,
  sku: v.sku || (styleCode ? `${styleCode}${v.size}` : `STYLE${v.size}`)
}));
```

## Implementation Steps

1. **Fix backend `createWithRelations()`** - Add skuVariants handling after style creation
2. **Test creation flow** - Create new style with sizes/SKUs, verify they save
3. **(Optional) Auto-generate SKUs** - Ensure SKUs are never empty at save time
4. **Test update flow** - Verify existing update functionality still works

## Testing

After implementation:
1. Create a new style with a customer that has size presets
2. Select a size preset - sizes should populate
3. Click "Auto-Generate SKUs" - SKU fields should fill in
4. Save the style
5. Re-open the style - SKU variants should persist
6. Edit and update - variants should still work

---

# Fix: Buttons Not Showing & Packaging in Wrong Section

## Problem Summary (from screenshot)
1. **Buttons not showing**: User selected buttons at style creation but they don't appear in view mode
2. **PACKAGING in wrong section**: A PACKAGING item appears in "Garment Trims" instead of "Packaging Materials"
3. **Trim names showing "Unknown"**: The `getTrimDetails()` helper can't find master data

## Root Cause Analysis

### Issue 1: Accessories Don't Have `usageCategory` Set

**Frontend sends accessories without `usageCategory`:**
```typescript
// StyleFormRedesigned.tsx line 1314-1318
const finalAccessories = selectedAccessories.map(acc => ({
  ...acc,
  materialType: acc.accessoryType, // Only maps accessoryType to materialType
  // usageCategory is NOT SET!
}));
```

**Backend defaults to 'GARMENT_TRIM':**
```typescript
// style.service.ts line 296
usageCategory: bom.usageCategory || 'GARMENT_TRIM',  // Defaults to wrong value!
```

This causes LABEL and PACKAGING items to be saved with `usageCategory: 'GARMENT_TRIM'` instead of `'PACKAGING'`.

### Issue 2: Trim/Button Master Data Not Loading

The trims are saved with `materialId` → `buttonId` FK correctly, but when loading the style, the `buttonMaster` relation may not be populated if:
1. The `buttonId` is null (invalid master ID from frontend)
2. The Prisma include for `button_master` isn't returning the expected fields

### Issue 3: StyleDetail Uses `style.packaging` (Wrong Source)

**StyleDetail.tsx lines 514-529** reads from `style.packaging`:
```typescript
{style.packaging && style.packaging.length > 0 ? (
```

But packaging is saved to `style_material_bom` with `materialType: 'PACKAGING'`. The `style.packaging` relation points to a separate (possibly empty) `style_packaging` table.

## Solution

### Fix 1: Set `usageCategory` for Accessories

**[frontend/src/pages/StyleFormRedesigned.tsx](frontend/src/pages/StyleFormRedesigned.tsx)**

Update the finalAccessories mapping to set usageCategory:

```typescript
// Accessories - transform to backend format (accessoryType -> materialType)
const finalAccessories = selectedAccessories.map(acc => ({
  ...acc,
  materialType: acc.accessoryType,
  usageCategory: 'PACKAGING' as const, // All accessories are packaging items
}));
```

### Fix 2: Update StyleDetail to Show Packaging from `styleMaterialBom`

**[frontend/src/pages/StyleDetail.tsx](frontend/src/pages/StyleDetail.tsx)**

Change the Packaging Materials section to filter `styleMaterialBom` by `usageCategory === 'PACKAGING'`:

```typescript
{(() => {
  const packagingItems = style.styleMaterialBom?.filter(
    (bom) => bom.usageCategory === 'PACKAGING'
  ) || [];

  const getPackagingDetails = (bom) => {
    if (bom.labelMaster) return { name: bom.labelMaster.labelName, code: bom.labelMaster.labelCode };
    if (bom.packagingMaster) return { name: bom.packagingMaster.packagingName, code: bom.packagingMaster.packagingCode };
    return { name: 'Unknown', code: '' };
  };

  // ... render packagingItems
})()}
```

### Fix 3: Verify Button Master Relation Population

Check if the `button_master` include is returning expected fields. The Prisma include in `findByIdOrThrow()` (line 589-595) already includes all masters:
```typescript
style_material_bom: {
  include: {
    button_master: true,  // Should include all button fields
    ...
  }
}
```

Debug step: Add logging to verify `buttonId` is being saved and `buttonMaster` is populated.

## Implementation Steps

1. **Fix frontend accessories mapping** - Add `usageCategory: 'PACKAGING'`
2. **Fix StyleDetail packaging section** - Read from `styleMaterialBom` filtered by `usageCategory`
3. **Debug button master population** - Verify FK and relation
4. **Test end-to-end** - Create style with buttons and packaging, verify display

## Files to Modify

1. **[frontend/src/pages/StyleFormRedesigned.tsx](frontend/src/pages/StyleFormRedesigned.tsx)** - Line ~1317
2. **[frontend/src/pages/StyleDetail.tsx](frontend/src/pages/StyleDetail.tsx)** - Lines 509-545


