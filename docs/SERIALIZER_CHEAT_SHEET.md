# Serializer Cheat Sheet

> Quick reference for how the backend serializer transforms API response keys.
> The frontend **MUST** use the "Frontend Key" column when accessing API data.

## How It Works

The serializer (`backend/src/utils/serializer.ts`) does a 3-stage transform:

1. **Decimal/BigInt → number** — Prisma Decimal objects become JS numbers
2. **snake_case → camelCase** — `humps` library converts all keys (`brand_categories` → `brandCategories`)
3. **RELATION_MAPPINGS** — Custom dictionary renames specific camelCase keys (`styleComponents` → `components`)

## CRITICAL: Key Rename Rules

### Rule 1: Simple relations (no custom mapping)
Most relations use automatic camelCase and are NOT renamed:
```
Prisma include       → Frontend key
─────────────────────────────────────
order_items          → orderItems        ✅ auto
work_orders          → workOrders        ✅ auto
brand_categories     → brandCategories   ✅ auto
stock_levels         → stockLevels       ✅ auto
```

### Rule 2: Custom-mapped relations (THESE CAUSE BUGS)
These get renamed beyond simple camelCase:
```
Prisma include       → camelCase         → Frontend key (FINAL)
──────────────────────────────────────────────────────────────
style_components     → styleComponents   → components        ⚠️
style_processes      → styleProcesses    → processes         ⚠️
style_costing        → styleCosting      → costing           ⚠️
style_fabrics        → styleFabrics      → fabrics           ⚠️
style_accessories    → styleAccessories  → accessories       ⚠️
color_options        → colorOptions      → colors            ⚠️
size_options         → sizeOptions       → sizes             ⚠️
customers            → customers         → customer          ⚠️ (singular!)
suppliers            → suppliers         → supplier          ⚠️ (singular!)
styles               → styles            → style             ⚠️ (singular!)
purchase_order_items → purchaseOrderItems→ items             ⚠️
grn_items            → grnItems          → items             ⚠️
bom_items            → bomItems          → items             ⚠️
quotation_items      → quotationItems    → items             ⚠️
delivery_note_items  → deliveryNoteItems → items             ⚠️
stock_count_items    → stockCountItems   → items             ⚠️
material_req_items   → materialRequisitionItems → items      ⚠️
supplier_contacts    → supplierContacts  → contacts          ⚠️
quality_defects      → qualityDefects    → defects           ⚠️
order_item_breakup   → orderItemBreakup  → breakup           ⚠️
work_order_breakup   → workOrderBreakup  → breakup           ⚠️
customers_billing    → customersBilling  → billing           ⚠️
customers_shipping   → customersShipping → shipping          ⚠️
suppliers_billing    → suppliersBilling  → billing           ⚠️
suppliers_shipping   → suppliersShipping → shipping          ⚠️
payment_terms_rel    → paymentTermsRel   → paymentTerms      ⚠️
customer_accessory_preset_items → customerAccessoryPresetItems → presetItems ⚠️
order_item_costings  → orderItemCostings → costings          ⚠️
lace_suppliers       → laceSuppliers     → suppliers         ⚠️
```

### Rule 3: Verbose Prisma user relations
```
Prisma relation                                  → Frontend key
───────────────────────────────────────────────────────────────
users_orders_createdByIdTousers                  → createdBy
users_orders_approvedByIdTousers                 → approvedBy
users_purchase_orders_createdByIdTousers         → createdBy
users_purchase_orders_approvedByIdTousers        → approvedBy
users_goods_receiving_notes_receivedByIdTousers  → receivedBy
users_order_bom_createdByIdTousers               → createdBy
users_order_bom_approvedByIdTousers              → approvedBy
(pattern: *ByIdTo* → extracted field name)
```

## Common Mistakes

### Mistake 1: Using plural instead of singular
```typescript
// ❌ WRONG — serializer renames 'customers' to 'customer'
invoice.customers?.name

// ✅ CORRECT
invoice.customer?.name
```

### Mistake 2: Using camelCase instead of mapped name
```typescript
// ❌ WRONG — serializer renames 'quotationItems' to 'items'
quotation.quotationItems?.length

// ✅ CORRECT
quotation.items?.length
```

### Mistake 3: Using snake_case in frontend
```typescript
// ❌ WRONG — snake_case doesn't exist after serialization
material.stock_levels

// ✅ CORRECT
material.stockLevels
```

### Mistake 4: Array relation renamed to singular
```typescript
// The serializer globally renames 'suppliers' to 'supplier'
// This applies even to ARRAY relations (e.g., material.suppliers[])

// ❌ WRONG
material.suppliers?.map(s => ...)

// ✅ CORRECT (still an array, just singular key name)
material.supplier?.map(s => ...)
```

## Full RELATION_MAPPINGS Reference

| Source (camelCase) | Target (Frontend) | Context |
|---|---|---|
| materialCategories | category | Material category |
| inventoryStock | inventoryStock | Stock levels |
| styleCategories | category | Style category |
| styleComponents | components | Style components |
| styleProcesses | processes | Style processes |
| styleCosting | costing | Style costing |
| styleProductionTracking | productionTracking | Production tracking |
| styleValueAdditions | valueAdditions | Value additions |
| stylePackaging | packaging | Packaging |
| styleFabrics | fabrics | Style fabrics |
| styleAccessories | accessories | Accessories |
| colorOptions | colors | Color options |
| sizeOptions | sizes | Size options |
| styleVariants | styleVariants | No rename |
| styleMaterialBom | styleMaterialBom | No rename |
| seasonMaster | seasonMaster | Season |
| customers | customer | **Singular** |
| orderItemBreakup | breakup | Order breakup |
| styles | style | **Singular** |
| workOrders | workOrders | No rename |
| workOrderBreakup | breakup | WO breakup |
| suppliers | supplier | **Singular** (even arrays!) |
| supplierContacts | contacts | Contacts |
| paymentTermsRel | paymentTerms | Payment terms |
| purchaseOrders | purchaseOrders | No rename |
| purchaseOrderItems | items | PO items |
| goodsReceivingNotes | goodsReceivingNotes | No rename |
| grnItems | items | GRN items |
| billOfMaterials | billOfMaterials | No rename |
| bomItems | items | BOM items |
| stockLevels | stockLevels | No rename |
| stockMovements | stockMovements | No rename |
| stockReservations | stockReservations | No rename |
| stockTransactions | stockTransactions | No rename |
| stockCounts | stockCounts | No rename |
| stockCountItems | items | Stock count items |
| finishedGoodsStock | finishedGoodsStock | No rename |
| warehouses | warehouses | No rename |
| deliveryNotes | deliveryNotes | No rename |
| deliveryNoteItems | items | DN items |
| invoices | invoices | No rename |
| qualityInspections | qualityInspections | No rename |
| qualityDefects | defects | Defects |
| productionTracking | productionTracking | No rename |
| materialRequisitions | materialRequisitions | No rename |
| materialRequisitionItems | items | MR items |
| quotations | quotations | No rename |
| quotationItems | items | Quotation items |
| samples | samples | No rename |
| customersBilling | billing | Customer billing |
| customersShipping | shipping | Customer shipping |
| suppliersBilling | billing | Supplier billing |
| suppliersShipping | shipping | Supplier shipping |
| customerGstBilling | gstBilling | GST billing |
| supplierGstBilling | gstBilling | GST billing |
| invoicesPlaceOfSupply | placeOfSupply | Place of supply |
| quotationsPlaceOfSupply | placeOfSupply | Place of supply |
| customerAccessoryPresetItems | presetItems | Preset items |
| orderItemCostings | costings | Costings |
| materialRequirements | materialRequirements | No rename |
| materialRequirementsPreferred | preferredSupplier | Preferred supplier |
| laceSuppliers | suppliers | Lace suppliers |

## Debug Tools

### Enable transform logging
```bash
# See every key rename in real-time
DEBUG_TRANSFORM=true npm run dev
```

### Validate mappings for collisions
```bash
# Check for duplicate target keys at startup
SERIALIZER_VALIDATE=true npm run dev
```

### Programmatic cheat sheet
```typescript
import { getSerializerCheatSheet } from '../utils/serializer';
console.table(getSerializerCheatSheet());
```

## Adding New Relations

When adding a new Prisma `include`, ask yourself:

1. **Does the relation name need simplifying?** (e.g., `styleComponents` → `components`)
   - YES → Add to RELATION_MAPPINGS in `serializer.ts`
   - NO → Auto camelCase works fine, nothing to do

2. **Is the target name already used by another mapping?**
   - Check the table above for collisions
   - If collision exists, add to `KNOWN_SAFE_COLLISIONS` if they never appear on the same object

3. **Update the frontend type** to use the FINAL key name (after mapping)
