# Cost Sheet Implementation - Next Steps

## What Has Been Completed

### 1. Frontend Implementation ✅
- **New comprehensive form** at [frontend/src/pages/CostSheetForm.tsx](frontend/src/pages/CostSheetForm.tsx)
- **Updated TypeScript types** at [frontend/src/types/costSheet.types.ts](frontend/src/types/costSheet.types.ts)
- **Backup of old form** saved as `CostSheetForm.old.tsx`

#### Features Implemented:
- Dynamic fabric fields with add/remove capability
- Dynamic trims fields (Thread included by default)
- CMT breakdown (Cutting, Stitching, Finishing, Button Attachment, Handwork)
- Dynamic embroidery fields with add/remove capability
- Dynamic accessories fields with add/remove capability
- Auto-calculation of all totals
- Value Loss (default 2%)
- Markup (default 15%)
- Real-time total product cost calculation

### 2. Database Migration Created ✅
- Migration SQL file at [backend/prisma/migrations/add_comprehensive_cost_sheet/migration.sql](backend/prisma/migrations/add_comprehensive_cost_sheet/migration.sql)

### 3. Documentation ✅
- Implementation summary at [COST_SHEET_IMPLEMENTATION_SUMMARY.md](COST_SHEET_IMPLEMENTATION_SUMMARY.md)

## What Needs To Be Done

### Step 1: Update Prisma Schema
The schema file at `backend/prisma/schema.prisma` needs to be manually updated because it keeps getting modified by background processes.

**Manual Steps:**
1. Open `/backend/prisma/schema.prisma`
2. Find the `StyleCosting` model (around line 1320)
3. Add these new fields after the existing fields but before `createdAt`:

```prisma
// Basic Information
numberOfComponents  Int?
category            String?
subCategory         String?

// Fabric Details (JSON array)
fabricDetails       Json?
fabricTotal         Decimal  @default(0) @db.Decimal(10, 2)

// Trims Details (JSON array)
trimsDetails        Json?
trimsTotal          Decimal  @default(0) @db.Decimal(10, 2)

// CMT Individual Breakdown
buttonAttachmentCost Decimal @default(0) @db.Decimal(10, 2)
handworkCmtCost     Decimal  @default(0) @db.Decimal(10, 2)
cmtTotal            Decimal  @default(0) @db.Decimal(10, 2)

// Embroidery Details (JSON array)
embroideryDetails   Json?
embroideryTotal     Decimal  @default(0) @db.Decimal(10, 2)

// Accessories Details (JSON array)
accessoriesDetails  Json?
accessoriesTotal    Decimal  @default(0) @db.Decimal(10, 2)

// Value Loss
valueLossPercent    Decimal  @default(2) @db.Decimal(5, 2)
valueLossAmount     Decimal  @default(0) @db.Decimal(10, 2)

// Markup
markupPercent       Decimal  @default(15) @db.Decimal(5, 2)
markupAmount        Decimal  @default(0) @db.Decimal(10, 2)

// Calculated Totals
subtotal            Decimal  @default(0) @db.Decimal(15, 2)
totalProductCost    Decimal  @default(0) @db.Decimal(15, 2)

// Tracking
createdById         String
createdBy           User     @relation("CreatedCosting", fields: [createdById], references: [id])

// Approval Workflow
isApproved          Boolean  @default(false)
approvedById        String?
approvedBy          User?    @relation("ApprovedCosting", fields: [approvedById], references: [id])
approvedAt          DateTime?
```

4. Find the `User` model (around line 224)
5. Add these relations after line 251 (`approvedBOMs`):

```prisma
createdCostings        StyleCosting[]        @relation("CreatedCosting")
approvedCostings       StyleCosting[]        @relation("ApprovedCosting")
```

### Step 2: Update Backend Controller
The file `backend/src/controllers/styleCosting.controller.ts` needs to be updated to handle the new JSON structure.

**What needs updating:**
1. Validation schema to accept the new format
2. Calculation logic to iterate through JSON arrays
3. Storage logic to save JSON fields

**New Validation Schema:**
```typescript
const FabricDetailSchema = z.object({
  fabricName: z.string(),
  fabricWidth: z.number(),
  fabricAverage: z.number(),
  fabricRate: z.number(),
  fabricTotal: z.number(),
});

const TrimDetailSchema = z.object({
  trimName: z.string(),
  trimQuantity: z.number(),
  trimRate: z.number(),
  trimTotal: z.number(),
});

const EmbroideryDetailSchema = z.object({
  embroideryName: z.string(),
  embroideryAverage: z.number(),
  embroideryRate: z.number(),
  embroideryTotal: z.number(),
});

const AccessoryDetailSchema = z.object({
  accessoryName: z.string(),
  accessoryQuantity: z.number(),
  accessoryRate: z.number(),
  accessoryTotal: z.number(),
});

const CMTCostsSchema = z.object({
  cuttingCost: z.number().default(0),
  stitchingCost: z.number().default(0),
  finishingCost: z.number().default(0),
  buttonAttachmentCost: z.number().default(0),
  handworkCost: z.number().default(0),
});

const CreateCostSheetSchema = z.object({
  styleId: z.string().uuid(),
  numberOfComponents: z.number().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  fabricDetails: z.array(FabricDetailSchema),
  trimsDetails: z.array(TrimDetailSchema),
  cmtCosts: CMTCostsSchema,
  embroideryDetails: z.array(EmbroideryDetailSchema),
  accessoriesDetails: z.array(AccessoryDetailSchema),
  valueLossPercent: z.number().default(2),
  markupPercent: z.number().default(15),
  notes: z.string().optional(),
});
```

**Calculation Logic:**
```typescript
// Calculate totals from arrays
const fabricTotal = validatedData.fabricDetails.reduce((sum, f) => sum + f.fabricTotal, 0);
const trimsTotal = validatedData.trimsDetails.reduce((sum, t) => sum + t.trimTotal, 0);
const cmtTotal = Object.values(validatedData.cmtCosts).reduce((sum, c) => sum + c, 0);
const embroideryTotal = validatedData.embroideryDetails.reduce((sum, e) => sum + e.embroideryTotal, 0);
const accessoriesTotal = validatedData.accessoriesDetails.reduce((sum, a) => sum + a.accessoryTotal, 0);

// Calculate subtotal
const subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal + accessoriesTotal;

// Calculate value loss
const valueLossAmount = (subtotal * validatedData.valueLossPercent) / 100;
const totalAfterValueLoss = subtotal + valueLossAmount;

// Calculate markup
const markupAmount = (totalAfterValueLoss * validatedData.markupPercent) / 100;
const totalProductCost = totalAfterValueLoss + markupAmount;
```

**Storage:**
```typescript
const costSheet = await prisma.styleCosting.create({
  data: {
    styleId: validatedData.styleId,
    numberOfComponents: validatedData.numberOfComponents,
    category: validatedData.category,
    subCategory: validatedData.subCategory,

    fabricDetails: validatedData.fabricDetails,
    fabricTotal,

    trimsDetails: validatedData.trimsDetails,
    trimsTotal,

    cuttingCost: validatedData.cmtCosts.cuttingCost,
    stitchingCost: validatedData.cmtCosts.stitchingCost,
    finishingCost: validatedData.cmtCosts.finishingCost,
    buttonAttachmentCost: validatedData.cmtCosts.buttonAttachmentCost,
    handworkCmtCost: validatedData.cmtCosts.handworkCost,
    cmtTotal,

    embroideryDetails: validatedData.embroideryDetails,
    embroideryTotal,

    accessoriesDetails: validatedData.accessoriesDetails,
    accessoriesTotal,

    valueLossPercent: validatedData.valueLossPercent,
    valueLossAmount,

    markupPercent: validatedData.markupPercent,
    markupAmount,

    subtotal,
    totalProductCost,

    notes: validatedData.notes,
    createdById: userId,
  },
});
```

### Step 3: Run Migration
Once the database is accessible:

```bash
cd backend
npx prisma migrate dev --name add_comprehensive_cost_sheet_fields
npx prisma generate
```

### Step 4: Update Backend Service (Optional)
Update `backend/src/services/costSheet.service.ts` if it exists to match the new structure.

### Step 5: Test the Implementation

1. Start the backend:
```bash
cd backend
npm run dev
```

2. Start the frontend:
```bash
cd frontend
npm run dev
```

3. Test the cost sheet form:
   - Create a new cost sheet
   - Add multiple fabrics
   - Add multiple trims
   - Add embroidery
   - Add accessories
   - Verify all calculations are correct
   - Verify value loss and markup are applied correctly

## Testing Checklist

- [ ] Schema migration runs successfully
- [ ] Backend generates Prisma client without errors
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can select a style
- [ ] Can add/remove fabric rows
- [ ] Can add/remove trim rows
- [ ] Can add/remove embroidery rows
- [ ] Can add/remove accessory rows
- [ ] All individual totals calculate correctly
- [ ] Subtotal calculates correctly
- [ ] Value loss applies correctly (default 2%)
- [ ] Markup applies correctly (default 15%)
- [ ] Total product cost is correct
- [ ] Can save the cost sheet
- [ ] Can view saved cost sheet
- [ ] Can edit cost sheet
- [ ] Can approve cost sheet (if you have permissions)

## Troubleshooting

### Issue: Database not accessible
**Solution:** Ensure your Railway database is running and the connection string in `.env` is correct.

### Issue: Prisma migration fails
**Solution:** Check if the StyleCosting model already has the new fields. If so, you may need to modify the migration or reset the database.

### Issue: Frontend shows type errors
**Solution:** Make sure you've replaced the old `costSheet.types.ts` file with the new one.

### Issue: Backend validation errors
**Solution:** Ensure the validation schema in the controller matches the new structure.

### Issue: Calculations are incorrect
**Solution:** Check that the frontend is calculating totals correctly before sending to backend, and verify backend calculation logic.

## Important Notes

1. **Backward Compatibility:** All legacy fields have been kept in the schema to ensure existing cost sheets continue to work.

2. **JSON Storage:** Fabric, Trims, Embroidery, and Accessories are stored as JSON arrays in PostgreSQL, which allows unlimited entries.

3. **Auto-calculation:** The frontend calculates totals in real-time, and the backend recalculates them on save for data integrity.

4. **Approval Workflow:** Approved cost sheets cannot be modified or deleted.

5. **Thread Default:** The trims section always starts with "Thread" as the first entry, but it can be modified or removed.

## Summary

All frontend code is complete and ready to use. The backend needs:
1. Manual schema update (due to file modification issues)
2. Controller update to handle new JSON structure
3. Migration to be run when database is accessible

The implementation document at `COST_SHEET_IMPLEMENTATION_SUMMARY.md` contains all the details about the structure and fields.
