# Import Systems Guide - Garment ERP

## Overview

The Garment ERP has **TWO SEPARATE** import systems. Use the correct one based on the module you're importing.

---

## System 1: Generic Import System (For Simple Modules)

**Used For:** Customers, Suppliers, Materials
**Endpoint:** `/api/import/:module`
**Frontend Component:** `ImportButton` component

### How to Use:
1. Add `<ImportButton module="customers" />` to your page
2. Click the Import button dropdown
3. Select "CSV Template" or "Excel Template" to download
4. Fill in the template
5. Upload via "Upload CSV/Excel"

### Supported Modules:
- `customers` - Customer master data
- `suppliers` - Supplier master data
- `materials` - Generic materials

### Template Structure:
Simple flat structure with basic fields only.

**Example (Customers):**
```csv
Customer Code,Customer Name,Type,Category,Contact Person,Email,Phone
CUST001,ABC Textiles,BUYER,DOMESTIC,John Doe,john@abc.com,9876543210
```

---

## System 2: Dedicated Import Pages (For Complex Modules)

**Used For:** Greige, Finished Fabrics, Styles
**These modules have dedicated import pages with comprehensive templates**

### 2A. Greige Fabric Import

**Page:** `/greige-bulk-import` ([GreigeBulkImport.tsx](frontend/src/pages/GreigeBulkImport.tsx))
**Backend:** `/api/fabric-greige/greige/bulk-import`

**How to Use:**
1. Navigate to Greige List → "Bulk Import" button
2. Click "Download Template" to get Excel template
3. Fill in greige specifications
4. Upload the file

**Template Fields:**
- Generic Fabric Name
- Yarn Count
- Construction
- Greige Width (inches)
- Composition
- Weave Type
- GSM Range
- Expected Finished Width Min/Max
- Average Shrinkage %
- Description, Notes, Is Active

---

### 2B. Finished Fabric Import

**Page:** `/fabric-bulk-import` ([FabricBulkImport.tsx](frontend/src/pages/FabricBulkImport.tsx))
**Backend:** `/api/fabric-greige/fabric/bulk-import`

**How to Use:**
1. Navigate to Fabric List → "Bulk Import" button
2. Click "Download Template" to get Excel template
3. Fill in fabric details with greige references
4. Upload the file

**Template Fields:**
- Greige Code (must exist in system!)
- Generic Fabric Name
- Fabric Name
- Color Name/Code
- Finish Type
- Print Design
- Actual Width/Cutable Width
- Finished Construction
- Actual GSM
- Value Addition/Cost
- Style Reference
- Component Type
- Is Generic, Is Active

**Important:** Greige Code must reference an existing greige record!

---

### 2C. Style Import ✅ **COMPREHENSIVE**

**Page:** `/styles/import` ([StyleBulkImport.tsx](frontend/src/pages/StyleBulkImport.tsx))
**Backend:** `/api/styles/import`
**Service:** [style-import.service.ts](frontend/src/services/style-import.service.ts)

**How to Use:**
1. Go to Style List page
2. Click "Bulk Import" button (navigates to dedicated page)
3. Click "Download Template" for comprehensive Excel template
4. Fill in style AND fabric details
5. Upload with options:
   - Overwrite existing styles
   - Skip duplicates

**Template Fields (Comprehensive):**
- **Basic:** Status, StyleCode, SKU, Size, Color
- **Category:** Category, ProductName, ItemDescription, Bullet Points
- **Business:** Customer, Brand, Season, Gender, ProjectGroup
- **Fabric Details:** ComponentName, GreigeName, FabricDescription
- **And many more fields including fabric specifications**

**Features:**
- Batch processing with status tracking
- Retry failed imports
- Detailed error reporting
- Creates style WITH fabric linkages

---

## Quick Reference

| Module | System | Page/Component | Template Download |
|--------|--------|----------------|-------------------|
| Customers | Generic | `ImportButton` | Simple CSV/Excel |
| Suppliers | Generic | `ImportButton` | Simple CSV/Excel |
| Materials | Generic | `ImportButton` | Simple CSV/Excel |
| Greige | Dedicated | `/greige-bulk-import` | Frontend-generated Excel |
| Finished Fabric | Dedicated | `/fabric-bulk-import` | Frontend-generated Excel |
| **Styles** | **Dedicated** | **/styles/import** | **Backend-generated comprehensive Excel** |

---

## Common Mistakes to Avoid

### ❌ DON'T:
1. Don't use `<ImportButton module="styles">` - it won't work properly
2. Don't use generic import for Greige/Fabric/Style
3. Don't try to import fabrics without existing greige records

### ✅ DO:
1. Use the "Bulk Import" button on the Style List page
2. Download templates from the correct page
3. Import greige BEFORE finished fabrics
4. Use the dedicated pages for complex modules

---

## For Developers

### Adding New Modules to Generic Import

If adding a simple module to the generic import system:

1. Add column definitions to `backend/src/controllers/import.controller.ts`:
```typescript
mymodule: [
  { fieldName: 'code', displayName: 'Code', required: true, type: 'text' },
  // ... more fields
]
```

2. Add import logic in `executeModuleImport()` function
3. Use `<ImportButton module="mymodule" />` in frontend

### For Complex Modules

Create a dedicated import page like Style/Greige/Fabric imports with:
- Custom template generation
- Advanced validation logic
- Batch processing
- Comprehensive error handling

---

## Template Download Endpoints

- **Generic:** `GET /api/import/:module/template?format=csv|excel`
- **Style:** `GET /api/styles/import/template`
- **Greige:** Frontend-generated (no backend endpoint)
- **Fabric:** Frontend-generated (no backend endpoint)

---

**Last Updated:** January 24, 2025
**Status:** Active - Production Ready
