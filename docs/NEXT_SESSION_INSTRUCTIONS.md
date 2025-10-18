# Next Session Instructions - Style Master Implementation

**Date**: 2025-10-18
**Status**: Ready to Build
**Blueprint**: See [STYLE_MASTER_BLUEPRINT.md](./STYLE_MASTER_BLUEPRINT.md)

---

## Quick Start for Next Session

### 1. Read These Documents First
1. [STYLE_MASTER_BLUEPRINT.md](./STYLE_MASTER_BLUEPRINT.md) - Complete implementation spec
2. [AGENTS_START_HERE.md](./AGENTS_START_HERE.md) - Project overview
3. This file - Implementation instructions

### 2. Current State
- ✅ User Management Module: Complete and working
- ✅ Dashboard: Redesigned with 12 production workflow cards (showing 0s)
- ✅ Database: PostgreSQL on Railway, Prisma ORM
- ⏳ Style Master: Blueprint ready, not yet implemented

### 3. Implementation Order

#### Phase 1: Database Schema (Backend Agent)
```bash
# 1. Update backend/prisma/schema.prisma
# Add all tables from blueprint:
# - Style (extend existing model)
# - StyleComponent
# - StyleFabric
# - StyleAccessory
# - StyleProcess
# - StyleCosting
# - StyleSizeBreakdown
# - ProductionTracking
# - ProductionStage enum
# - Order (optional)

# 2. Create migration
cd backend
npx prisma migrate dev --name add_style_master_complete

# 3. Generate Prisma client
npx prisma generate

# 4. Verify migration
npx prisma studio
```

**Important Notes**:
- Existing Style model already exists - EXTEND it, don't replace
- Add new fields: buyerName, brandName, imageUrl
- Make order fields OPTIONAL (orderQuantity, orderDate, deliveryDate, orderValue)
- Check existing relationships before adding new ones

#### Phase 2: Backend API (Backend Agent)

**Controllers to Create**:
1. `backend/src/controllers/style.controller.ts`
   - createStyle (with nested components/processes)
   - getAllStyles (paginated, searchable)
   - getStyleById (with all relations)
   - updateStyle
   - deleteStyle (soft delete)
   - uploadStyleImage

2. `backend/src/controllers/styleComponent.controller.ts`
   - createComponent
   - updateComponent
   - deleteComponent

3. `backend/src/controllers/styleFabric.controller.ts`
   - createFabric
   - updateFabric (including CAD averages)
   - deleteFabric

4. `backend/src/controllers/styleAccessory.controller.ts`
   - createAccessory
   - updateAccessory
   - deleteAccessory

5. `backend/src/controllers/styleProcess.controller.ts`
   - createProcess
   - updateProcess
   - deleteProcess

6. `backend/src/controllers/styleCosting.controller.ts`
   - createOrUpdateCosting
   - getCosting
   - calculateCosting (auto-calculate from components)

7. `backend/src/controllers/productionTracking.controller.ts`
   - createTracking
   - updateStage (with piece counts)
   - getTrackingByStyle

8. `backend/src/controllers/dashboard.controller.ts` (UPDATE EXISTING)
   - getDashboardSummary (implement with real queries)
   - getStylesByStage (for drill-down)

**Routes to Create**:
```typescript
// backend/src/routes/style.routes.ts
router.post('/styles', authenticate, authorize(['ADMIN', 'MERCHANDISER']), createStyle);
router.get('/styles', authenticate, getAllStyles);
router.get('/styles/:id', authenticate, getStyleById);
router.put('/styles/:id', authenticate, authorize(['ADMIN', 'MERCHANDISER']), updateStyle);
router.delete('/styles/:id', authenticate, authorize(['ADMIN']), deleteStyle);
router.post('/styles/:id/image', authenticate, authorize(['ADMIN', 'MERCHANDISER']), uploadStyleImage);

// Component routes
router.post('/styles/:styleId/components', authenticate, authorize(['ADMIN', 'MERCHANDISER']), createComponent);
router.put('/components/:id', authenticate, authorize(['ADMIN', 'MERCHANDISER']), updateComponent);
router.delete('/components/:id', authenticate, authorize(['ADMIN', 'MERCHANDISER']), deleteComponent);

// Fabric routes
router.post('/components/:componentId/fabrics', authenticate, authorize(['ADMIN', 'MERCHANDISER']), createFabric);
router.put('/fabrics/:id', authenticate, authorize(['ADMIN', 'MERCHANDISER']), updateFabric);
router.delete('/fabrics/:id', authenticate, authorize(['ADMIN', 'MERCHANDISER']), deleteFabric);

// Similar for accessories, processes, costing, production tracking

// Dashboard routes
router.get('/dashboard/summary', authenticate, getDashboardSummary);
router.get('/dashboard/stage/:stage', authenticate, getStylesByStage);
```

**Middleware to Create**:
```typescript
// backend/src/middleware/upload.middleware.ts
// Image upload with multer
// - Accept only JPG/PNG
// - Max 5MB
// - Store in uploads/styles/
// - Return file path
```

**Testing**:
```bash
# Test all endpoints with Thunder Client or Postman
# Create test data:
# - 2 styles with orders
# - 1 style without order
# - Different production stages
# - Verify dashboard shows correct counts
```

#### Phase 3: Frontend Types & Services (Frontend Agent)

**Types to Create**:
```typescript
// frontend/src/types/style.types.ts
// Copy complete types from blueprint:
// - Style
// - StyleComponent
// - StyleFabric
// - StyleAccessory
// - StyleProcess
// - StyleCosting
// - StyleSizeBreakdown
// - ProductionTracking
// - ProductionStage enum
// - DashboardSummary
```

**Service to Create**:
```typescript
// frontend/src/services/style.service.ts
// All CRUD operations
// Image upload
// Dashboard queries
```

#### Phase 4: Frontend UI (Frontend Agent)

**Pages to Create**:

1. `frontend/src/pages/StyleList.tsx`
   - Similar to Users.tsx
   - Table with columns: Image, Code, Name, Buyer, Brand, Order Qty, Status
   - Search by code/name/buyer/brand
   - Pagination
   - Filter by production stage (from URL param)
   - Click row to view details
   - "Create Style" button (ADMIN/MERCHANDISER only)

2. `frontend/src/pages/StyleForm.tsx` (Multi-step wizard)
   - **Step 1: Basic Info**
     - Style Code (required, unique)
     - Style Name (required)
     - Buyer/Customer Name (required)
     - Brand Name (required)
     - Description (optional)
     - Season (optional)
     - Image Upload (JPG/PNG)
     - ORDER SECTION (optional - all or none):
       - Order Quantity
       - Order Date
       - Delivery Date
       - Order Value
     - "Next" button

   - **Step 2: Components**
     - Add components (minimum 1)
     - Component Name (e.g., "Top", "Bottom")
     - Component Type (e.g., "Kurta", "Pant")
     - Sort order (drag/drop or up/down buttons)
     - "Add Component" button
     - "Previous" / "Next" buttons

   - **Step 3: Fabrics**
     - For each component (tabs):
       - Add fabrics (minimum 1 per component)
       - Fabric Name
       - Fabric Type (dropdown: Cotton, Silk, Polyester, etc.)
       - Color
       - GSM
       - Width
       - **CAD Average (Meters)** - Manual entry
       - **CAD Average (Yards)** - Manual entry
       - Supplier Name
       - Unit Price
       - "Add Fabric" button
     - "Previous" / "Next" buttons

   - **Step 4: Accessories**
     - For each component (tabs):
       - Add accessories (optional)
       - Accessory Name
       - Accessory Type (dropdown: Button, Zipper, Thread, etc.)
       - Quantity per piece
       - Unit (dropdown: pcs, meters, dozen)
       - Supplier Name
       - Unit Price
       - "Add Accessory" button
     - "Previous" / "Next" buttons

   - **Step 5: Processes**
     - Checkbox list of available processes:
       - [ ] Printing (cost, days, vendor)
       - [ ] Dying (cost, days, vendor)
       - [ ] Embroidery (cost, days, vendor)
       - [ ] Handwork (cost, days, vendor)
     - Show cost/days/vendor inputs only if checked
     - "Previous" / "Next" buttons

   - **Step 6: Review & Submit**
     - Show summary of all data
     - "Auto-Calculate Costing" button
     - Show calculated costing breakdown
     - Edit costing if needed
     - "Previous" / "Create Style" buttons

3. `frontend/src/pages/StyleDetail.tsx`
   - View-only display of all style data
   - Tabs:
     - Basic Info (with image)
     - Components (accordion for each)
     - Fabrics (per component, show CAD averages)
     - Accessories (per component)
     - Processes
     - Costing Breakdown
     - Production Tracking (visual progress bar)
   - "Edit" button (ADMIN/MERCHANDISER only)
   - "Back to List" button

4. `frontend/src/pages/Dashboard.tsx` (UPDATE EXISTING)
   - Import styleService
   - Fetch dashboard summary on mount
   - Update all 12 cards with real data:
     - Show style count
     - Show piece count
     - Add onClick to navigate to filtered list
   - Loading states
   - Error handling

**Components to Create** (if needed):
```
frontend/src/components/style/
├── StyleBasicForm.tsx (Step 1 of wizard)
├── StyleComponentForm.tsx (Step 2)
├── StyleFabricForm.tsx (Step 3)
├── StyleAccessoryForm.tsx (Step 4)
├── StyleProcessForm.tsx (Step 5)
├── StyleCostingForm.tsx (Step 6)
└── ProductionProgressBar.tsx (visual tracker)
```

#### Phase 5: Routes & Navigation

**Update App.tsx**:
```typescript
// Add routes
<Route path="/styles" element={<PrivateRoute><StyleList /></PrivateRoute>} />
<Route path="/styles/new" element={<PrivateRoute><StyleForm mode="create" /></PrivateRoute>} />
<Route path="/styles/:id" element={<PrivateRoute><StyleDetail /></PrivateRoute>} />
<Route path="/styles/:id/edit" element={<PrivateRoute><StyleForm mode="edit" /></PrivateRoute>} />
```

**Update Dashboard Quick Actions**:
```typescript
// Change "Styles" button from disabled to active
<Button
  variant="outline"
  className="h-auto py-4"
  onClick={() => navigate('/styles')}
>
  <div className="text-center">
    <div className="text-2xl mb-1">👔</div>
    <div className="font-semibold text-sm">Styles</div>
    <div className="text-xs text-gray-500">Manage styles</div>
  </div>
</Button>
```

#### Phase 6: Testing

**E2E Tests to Write**:
```typescript
// frontend/tests/styles.spec.ts

test('admin can create style without order', async ({ page }) => {
  // Login as admin
  // Navigate to /styles/new
  // Fill basic info (no order)
  // Add components
  // Add fabrics with CAD averages
  // Skip accessories
  // Select processes
  // Review and submit
  // Verify style appears in list
});

test('merchandiser can create style with order', async ({ page }) => {
  // Similar but include order fields
});

test('dashboard shows correct counts', async ({ page }) => {
  // Login
  // Check dashboard cards show numbers > 0
  // Click card
  // Verify navigates to filtered list
});

test('can search styles', async ({ page }) => {
  // Go to styles list
  // Type in search
  // Verify filtered results
});
```

**Manual Testing Checklist**:
- [ ] Create style without order
- [ ] Create style with order
- [ ] Upload image (JPG)
- [ ] Upload image (PNG)
- [ ] Try to upload PDF (should fail)
- [ ] Add 2-component style
- [ ] Add 3-component style
- [ ] Enter CAD averages (meters and yards)
- [ ] Add multiple fabrics to one component
- [ ] Skip all processes
- [ ] Select some processes
- [ ] Auto-calculate costing
- [ ] Edit style
- [ ] View style details
- [ ] Dashboard drill-down works
- [ ] Search styles
- [ ] Pagination works

---

## Important Reminders

### Database Considerations
1. **Existing Style Model**: Don't delete existing Style model - EXTEND it
2. **Migration**: Existing Style records need migration script for new required fields
3. **Relationships**: Check existing foreign keys before adding new ones

### File Upload
1. **Storage**: Files stored in `backend/uploads/styles/`
2. **Path**: Store relative path in database: `/uploads/styles/style-123.jpg`
3. **Serve**: Configure Express to serve static files from uploads directory
4. **Validation**: Only JPG/PNG, max 5MB

### User Permissions
- **Create/Edit Styles**: ADMIN, MERCHANDISER only
- **View Styles**: All authenticated users
- **Production Updates**: Will add specific roles later

### Performance
- **Dashboard**: Uses aggregations - might need caching for large datasets
- **Image Loading**: Use lazy loading for style list images
- **Pagination**: Load 10-20 styles per page

### UX Considerations
1. **Multi-step Form**: Show progress indicator (Step 1 of 6)
2. **Form State**: Use localStorage to save draft if user navigates away
3. **Validation**: Show errors inline, not just on submit
4. **Auto-save**: Consider auto-saving drafts every 30 seconds
5. **Confirmation**: Ask "Are you sure?" before deleting

---

## Expected Outcomes

After implementation, users should be able to:

✅ Create complete style master with all details
✅ Upload style image
✅ Enter CAD averages from external software
✅ Add multiple components (2-pc, 3-pc sets)
✅ Add multiple fabrics per component
✅ Track accessories per component
✅ Select which processes are needed
✅ See auto-calculated costing
✅ View dashboard with real production counts
✅ Click dashboard card to see styles in that stage
✅ Search and filter styles
✅ Track production at piece level

---

## Git Workflow

### Before Starting
```bash
git status
git log --oneline -5
```

### After Each Phase
```bash
git add .
git commit -m "feat: Add Style Master - Phase X completed

- Details of what was added
- Any notable changes

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote
git push origin main
```

---

## Troubleshooting

### If Prisma Migration Fails
```bash
# Reset database (WARNING: Deletes all data)
npx prisma migrate reset

# Or manually fix migration file and retry
npx prisma migrate dev
```

### If Image Upload Fails
```bash
# Check uploads directory exists
ls -la backend/uploads/styles

# Check permissions
chmod 755 backend/uploads/styles

# Check Express static middleware
# In backend/src/index.ts:
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
```

### If Dashboard Shows Wrong Counts
```bash
# Open Prisma Studio
npx prisma studio

# Check ProductionTracking table
# Verify currentStage and piecesInStage values
```

### If E2E Tests Fail
```bash
# Update Playwright
npm install -D @playwright/test@latest

# Update browsers
npx playwright install

# Run in headed mode to debug
npm run test:e2e -- --headed
```

---

## Contacts & Resources

- **Blueprint**: [STYLE_MASTER_BLUEPRINT.md](./STYLE_MASTER_BLUEPRINT.md)
- **Project Docs**: [AGENTS_START_HERE.md](./AGENTS_START_HERE.md)
- **Testing Guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Prisma Docs**: https://www.prisma.io/docs
- **React Hook Form**: https://react-hook-form.com
- **shadcn/ui**: https://ui.shadcn.com

---

## Success Criteria

The Style Master module is complete when:

1. ✅ All database tables created and migrated
2. ✅ All backend API endpoints working
3. ✅ All frontend pages created and functional
4. ✅ Image upload working (JPG/PNG only)
5. ✅ Multi-step form wizard working smoothly
6. ✅ Dashboard shows real data (not 0s)
7. ✅ Dashboard drill-down working
8. ✅ Search and pagination working
9. ✅ Can create styles with and without orders
10. ✅ Can enter CAD averages manually
11. ✅ Can add multiple components and fabrics
12. ✅ Auto-calculate costing working
13. ✅ E2E tests passing
14. ✅ TypeScript compilation clean
15. ✅ No console errors

---

## Start Here

**First Task**: Read the complete [STYLE_MASTER_BLUEPRINT.md](./STYLE_MASTER_BLUEPRINT.md) to understand the full scope.

**Second Task**: Start with Phase 1 - Database Schema. Backend agent should update Prisma schema and run migrations.

**Third Task**: Build backend API endpoints one by one, testing as you go.

**Fourth Task**: Create frontend types and services.

**Fifth Task**: Build UI components and pages.

**Sixth Task**: Write and run E2E tests.

Good luck! 🚀
