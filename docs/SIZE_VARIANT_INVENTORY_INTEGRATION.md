# Size Variant Inventory Integration

## Overview
This document describes the integration of label size variants with the core inventory management system. Size variants allow labels to have multiple sizes (e.g., XS, S, M, L, XL) with independent stock tracking for each size.

## Architecture

### Database Schema

#### Core Tables

1. **`size_categories`** - Reusable size templates
   - Stores arrays of sizes (e.g., ["XS", "S", "M", "L", "XL"])
   - Predefined templates: Men's Standard, Women's Standard, Kids Age, etc.
   - Can be created custom for specific needs

2. **`label_size_variants`** - Size variant junction table
   - Links labels to specific sizes
   - Fields:
     - `labelId` - References label_master
     - `sizeCategoryId` - Optional reference to size category
     - `size` - The actual size value (e.g., "M")
     - `stockQuantity` - Legacy field (kept for backward compatibility)
     - `isActive` - Enable/disable specific sizes
   - **New**: Reverse relation to `materials` table

3. **`materials`** - Central inventory table
   - **New Field**: `sizeVariantId` (String, optional, unique)
   - Links to specific size variant for label materials
   - Each size variant gets its own material record
   - Material naming: `{labelCode}-{size}` (e.g., "LAB-001-M")
   - Material name: `{labelName} - Size {size}` (e.g., "Main Label - Size M")

4. **`stock_levels`** - Inventory balance per material per warehouse
   - Tracks current quantity for each size variant material
   - Includes valuation rate and stock value
   - Reorder levels, min/max levels per variant

5. **`stock_movements`** - Transaction log
   - Records all stock changes (IN, OUT, TRANSFER, ADJUSTMENT)
   - Links to material ID (which can be a size variant material)
   - Full audit trail maintained

6. **`stock_transactions`** - Detailed ledger for costing
   - Supports weighted average costing per size variant
   - FIFO/LIFO/Weighted Average methods

### Data Flow

#### Creating Labels with Size Variants

1. User selects a size category (e.g., "Women's Standard")
2. User enables "Auto-generate size variants"
3. Backend creates:
   - Label master record
   - One `label_size_variants` record per size in category
   - One `materials` record per size variant
     - Material ID: `mat-{labelCode}-{size}` (lowercased)
     - Material Code: `{labelCode}-{size}`
     - Material Name: `{labelName} - Size {size}`
     - `materialType`: `LABEL`
     - `labelId`: Link to label master
     - `sizeVariantId`: Link to specific size variant
     - `categoryId`: Label material category
     - `unit`: `PIECE`

#### Stock In (Receiving Size Variants)

1. Navigate to Stock In form
2. Select "Label" material type
3. Dropdown shows:
   - Labels without size variants (as before)
   - Individual size variant materials (e.g., "LAB-001-M - Main Label - Size M")
4. Select specific size and quantity
5. System creates:
   - `stock_movements` record with materialId pointing to size variant material
   - `stock_levels` record (or updates existing) for that material+warehouse
   - `stock_transactions` record for cost tracking
   - Weighted average costing automatically calculated

#### Stock Out (Issuing Size Variants)

1. Navigate to Stock Out form
2. Select warehouse
3. Dropdown shows all materials with available stock, including size variants
4. Select specific size and quantity
5. System validates stock availability
6. Creates stock movement with decrease transaction

#### Viewing Stock Levels

1. Stock Level reports automatically show size variant materials
2. Each size displays as separate line item:
   - Material Code: `LAB-001-M`
   - Material Name: `Main Label - Size M`
   - Quantity per warehouse
   - Valuation rate and total value
3. Low stock alerts work at size level

#### Viewing in Label List

1. Label list shows size variants with stock levels
2. Each size displays as badge: `M (150)` where 150 is total stock across warehouses
3. Badge color indicates stock availability:
   - Default (blue): Stock available
   - Outline (gray): No stock

## Implementation Details

### Backend Changes

#### 1. Schema Migration
- Added `sizeVariantId` field to `materials` table
- Added unique constraint on `sizeVariantId`
- Added foreign key to `label_size_variants`
- Added index for performance

#### 2. Label Controller (`label.controller.ts`)
**Modified `createLabel` function:**
- Lines 149-217: Auto-generation logic
- If `generateSizeVariants` is true:
  - Fetches size category and its sizes
  - Creates `label_size_variants` records
  - **Creates `materials` record for each variant**
  - Returns material entries in response
- If false: Creates single material record (existing behavior)

**Modified queries:**
- Added `material` relation to sizeVariants query
- Includes `stock_levels` with warehouse info
- Shows actual inventory quantities

### Frontend Changes

#### 1. Type Definitions (`label.types.ts`)
- Lines 129-141: Added `material` object to size variant type
- Includes `stock_levels` array with quantity and warehouse info

#### 2. Label Form (`LabelForm.tsx`)
- Lines 40-42: Added state for size categories
- Lines 78-85: Fetch size categories on mount
- Lines 214-215: Include size variant fields in form submission
- Lines 447-504: Complete UI for size category selection
  - Dropdown showing available size categories
  - Preview of sizes in each category
  - Checkbox to enable auto-generation
  - Clear explanation of what will be created

#### 3. Label List (`LabelList.tsx`)
- Lines 159-199: Updated size column to show stock levels
- Displays size badges with quantities: `M (150)`
- Color-codes based on stock availability
- Shows total count of variants

#### 4. Stock In Form (`StockInForm.tsx`)
- Lines 193-216: Modified label fetching logic
- Detects labels with size variants
- Extracts material records from variants
- Adds to unified materials list with type `LABEL_VARIANT`
- Lines 309-326: Updated material selection handler
  - For LABEL_VARIANT: Uses direct material ID
  - For others: Uses `type:id` format (polymorphic)
- Lines 865-884: Updated dropdown rendering
  - Filters to show both LABEL and LABEL_VARIANT when LABEL selected
  - Uses correct value format per type

#### 5. Stock Out Form (`StockOutForm.tsx`)
- **No changes needed!**
- Automatically works because it fetches from `stock_levels` table
- Size variant materials appear automatically once stock is added

#### 6. Stock Level List (`StockLevelList.tsx`)
- **No changes needed!**
- Displays material code and name from materials table
- Size variants show with descriptive names automatically

## Usage Workflow

### Creating a Label with Size Variants

1. Navigate to **Materials → Labels**
2. Click **"+ Add New Label"**
3. Fill in basic label information (name, type, customer, etc.)
4. Scroll to **"Size Variants (Optional)"** section
5. Select a size category from dropdown (e.g., "Women's Standard")
   - Preview shows: "XS, S, M, L, XL, XXL, XXXL"
6. Check **"Auto-generate size variants"**
7. Click **"Create Label"**
8. System creates:
   - 1 label master
   - 7 size variant records
   - 7 material records (one per size)

### Adding Stock for Specific Sizes

1. Navigate to **Inventory → Stock In**
2. Select material type: **"Label"**
3. Dropdown shows all size variants:
   - `LAB-001-XS - Main Label - Size XS`
   - `LAB-001-S - Main Label - Size S`
   - `LAB-001-M - Main Label - Size M`
   - etc.
4. Select specific size (e.g., Medium)
5. Enter quantity: `1000`
6. Enter rate: `5.00`
7. Submit
8. Stock is tracked specifically for size M

### Checking Stock Levels

1. Navigate to **Inventory → Stock Levels**
2. See all size variants as separate entries:
   ```
   LAB-001-XS  | Main Label - Size XS | Warehouse A | 500 pcs
   LAB-001-S   | Main Label - Size S  | Warehouse A | 750 pcs
   LAB-001-M   | Main Label - Size M  | Warehouse A | 1000 pcs
   ```

### Issuing Stock

1. Navigate to **Inventory → Stock Out**
2. Select warehouse
3. Select specific size variant from dropdown
4. System validates available quantity
5. Issue stock for that specific size

## Benefits

### 1. Independent Size Tracking
- Each size has its own stock balance
- Prevents confusion when different sizes have different quantities
- Accurate for demand forecasting per size

### 2. Full Integration with Inventory System
- Weighted average costing per size
- Stock movement history per size
- Low stock alerts per size
- Stock aging reports per size
- Complete audit trail

### 3. Backward Compatibility
- Labels without size variants continue to work as before
- Existing labels are not affected
- Migration is opt-in per label

### 4. Flexible Size Management
- Predefined size templates for quick setup
- Custom size categories for special needs
- Can enable/disable specific sizes per label
- Can add new sizes to existing labels (future enhancement)

## Future Enhancements

### Phase 2 Potential Features

1. **Bulk Stock Upload**
   - CSV import with size-level quantities
   - Template: `LabelCode, Size, Warehouse, Quantity`

2. **Size-Level BOM Integration**
   - Style BOM specifies size breakdown
   - Auto-calculates material requirements per size

3. **Size-Level Reports**
   - Best-selling sizes analysis
   - Size distribution reports
   - Size-wise stock valuation

4. **Smart Reorder Suggestions**
   - AI-based reorder point per size
   - Seasonal size trend analysis

5. **Size Variant Transfer**
   - Inter-warehouse transfer at size level
   - Size consolidation across warehouses

## Technical Considerations

### Performance
- All queries use indexed fields
- Material lookups O(1) with unique constraints
- Stock level aggregation O(n) where n = number of warehouses

### Data Integrity
- Unique constraint ensures one material per size variant
- Foreign keys maintain referential integrity
- Cascade delete from label removes all variants and materials
- Prisma transactions ensure ACID compliance

### Scalability
- Design supports unlimited sizes per label
- Stock calculations remain efficient with indexes
- Material table grows linearly with variants

## Migration Notes

### For Existing Labels
- Existing labels continue to work without changes
- To convert existing label to size variants:
  1. Edit label
  2. Select size category
  3. Enable size variants
  4. System will create material records
  5. Manually transfer stock from old material to new variants

### Database Migration
- Migration file: `20251218_add_label_size_variant_support/migration.sql`
- Adds `sizeVariantId` column to materials
- Creates unique index
- Adds foreign key constraint
- Safe to run on production (non-breaking change)

## Testing Checklist

- [ ] Create label with size variants
- [ ] Verify material records created
- [ ] Add stock for specific size via Stock In
- [ ] Verify stock appears in Stock Levels
- [ ] Verify stock shows in Label List badges
- [ ] Issue stock for specific size via Stock Out
- [ ] Verify stock quantity updates
- [ ] Check stock movement history
- [ ] Verify weighted average costing
- [ ] Test low stock alerts per size
- [ ] Test search/filter in stock reports
- [ ] Verify backward compatibility (labels without variants)

## Support & Troubleshooting

### Common Issues

**Issue**: Size variant materials not appearing in Stock In dropdown
- **Solution**: Ensure "Label" type is selected, check if label has size variants with material records

**Issue**: Stock not showing in Label List badges
- **Solution**: Verify stock was added to correct size variant material, check warehouse assignment

**Issue**: Cannot issue more than available stock
- **Solution**: This is correct behavior - stock validation works at size level

### Debug Queries

```sql
-- Check size variants for a label
SELECT * FROM label_size_variants WHERE labelId = 'label-id-here';

-- Check material records for size variants
SELECT * FROM materials WHERE sizeVariantId IS NOT NULL;

-- Check stock levels for size variant materials
SELECT m.code, m.name, sl.quantity, w.code as warehouse
FROM stock_levels sl
JOIN materials m ON sl.materialId = m.id
JOIN warehouses w ON sl.warehouseId = w.id
WHERE m.sizeVariantId IS NOT NULL;
```

## Conclusion

The size variant inventory integration provides robust, independent stock tracking for each label size while maintaining full compatibility with the existing inventory system. All standard inventory operations (stock in/out, transfers, adjustments, reports) work seamlessly with size variants through the polymorphic materials table design.
