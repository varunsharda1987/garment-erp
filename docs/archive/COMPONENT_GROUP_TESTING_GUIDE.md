# Component Group Master - Testing Guide

## Overview
This guide will help you test the complete Component Group Master system implementation.

**Implementation Status:** ✅ Complete (Phases 1-6)
**Backend Status:** ✅ Running on http://localhost:5000
**Frontend Status:** ✅ Running on http://localhost:3000 (or configured port)

---

## What Was Implemented

### Database Changes
1. ✅ **component_group_master** table - User-manageable component groups (TOP, BOTTOM, FULL, INNER, OUTER, ACCESS)
2. ✅ **pattern_part_master** table - Pattern parts for future use (BODY_FRONT, BODY_BACK, SLEEVE, etc.)
3. ✅ **component_pattern_parts** bridge table - Many-to-many relationship
4. ✅ **componentGroupId** field added to component_masters (replaces hardcoded componentCategory)
5. ✅ **minComponents** and **maxComponents** fields added to product_category_master

### Backend APIs (All Working)
- **Component Groups:** GET, POST, PUT, DELETE, Reorder
- **Pattern Parts:** GET, POST, PUT, DELETE, Reorder (backend only, no UI yet)
- **Component Masters:** Updated to use componentGroupId
- **Product Categories:** Updated to support min/max components

### Frontend Pages (All Working)
1. ✅ **Component Group Master** - New page at `/component-groups`
2. ✅ **Component Masters** - Updated with Component Group dropdown
3. ✅ **Product Category Master** - Updated with min/max components fields
4. ✅ **Style Form** - Updated with grouped component selection and validation

---

## Testing Checklist

### Phase 1: Component Group Master (/component-groups)

#### Test 1.1: View Component Groups
- [ ] Navigate to "Component Groups" in sidebar (under Masters section)
- [ ] Verify 6 default groups are displayed:
  - TOP (Top Wear)
  - BOTTOM (Bottom Wear)
  - FULL (Full Garment)
  - INNER (Inner Wear)
  - OUTER (Outer Wear)
  - ACCESS (Accessory)
- [ ] Check that each group shows component count
- [ ] Verify sorting by sortOrder

#### Test 1.2: Create New Component Group
- [ ] Click "Add Component Group" button
- [ ] Fill in form:
  - Code: `HEADWEAR` (automatically uppercase)
  - Name: `Head Wear`
  - Description: `Head covering garments`
  - Sort Order: `6`
  - Active: ✓ checked
- [ ] Click "Create"
- [ ] Verify success notification
- [ ] Verify new group appears in table
- [ ] **Expected Result:** New group created and visible

#### Test 1.3: Edit Component Group
- [ ] Click edit (pencil icon) on any group
- [ ] Modify name and description
- [ ] Verify code field is disabled (cannot change on edit)
- [ ] Click "Update"
- [ ] Verify success notification
- [ ] Verify changes reflected in table
- [ ] **Expected Result:** Group updated successfully

#### Test 1.4: Reorder Component Groups
- [ ] Use up/down arrows to reorder groups
- [ ] Move "OUTER" group up one position
- [ ] Verify order changes immediately
- [ ] **Expected Result:** Groups reordered and persisted

#### Test 1.5: Delete Component Group (Validation)
- [ ] Try to delete a group that has components (like TOP or BOTTOM)
- [ ] **Expected Result:** Error message - "Cannot delete component group. X component(s) are using this group."
- [ ] Delete your newly created HEADWEAR group (has 0 components)
- [ ] **Expected Result:** Success - group is soft deleted (isActive = false)

#### Test 1.6: Search Component Groups
- [ ] Type "top" in search box
- [ ] Verify only "Top Wear" group appears
- [ ] Clear search
- [ ] Verify all groups reappear
- [ ] **Expected Result:** Search filters correctly

---

### Phase 2: Component Masters (/component-masters)

#### Test 2.1: View Existing Components
- [ ] Navigate to "Component Masters"
- [ ] Verify existing components show their Component Group as badges
- [ ] Check for components with:
  - Component Group badge (outline style) - NEW
  - Legacy componentCategory badge (secondary style) - OLD
  - No group (shows "—") - UNASSIGNED
- [ ] **Expected Result:** All display correctly

#### Test 2.2: Create Component with Component Group
- [ ] Click "Add Component"
- [ ] Fill in form:
  - Name: `Crop Top`
  - Component Group: Select "Top Wear" from dropdown
  - Description: `Short fitted top`
  - Sort Order: `10`
  - Active: ✓ checked
- [ ] Click "Create"
- [ ] Verify component appears with "Top Wear" badge (outline style)
- [ ] **Expected Result:** Component created with group link

#### Test 2.3: Create Component without Component Group
- [ ] Click "Add Component"
- [ ] Fill in name only, leave Component Group empty
- [ ] Click "Create"
- [ ] Verify component shows "—" for group
- [ ] **Expected Result:** Component created without group (allowed)

#### Test 2.4: Edit Component Group Assignment
- [ ] Edit an existing component
- [ ] Change Component Group from dropdown
- [ ] Click "Update"
- [ ] Verify badge updates in table
- [ ] **Expected Result:** Component group updated

#### Test 2.5: Verify Grouped Dropdown
- [ ] Open Component Group dropdown
- [ ] Verify groups are loaded from database (not hardcoded)
- [ ] Verify all active groups appear
- [ ] **Expected Result:** Dropdown shows all active component groups

---

### Phase 3: Product Category Master (/product-categories)

#### Test 3.1: View Existing Categories
- [ ] Navigate to "Product Categories"
- [ ] Open any category for edit
- [ ] Check for new fields:
  - Min Components (default: 1)
  - Max Components (default: 1)
- [ ] **Expected Result:** Fields present with default values

#### Test 3.2: Create Category with Component Count Range
- [ ] Create new category:
  - Code: `COORDS_SET`
  - Name: `Co-Ords Set`
  - Level: 1 (L1)
  - Min Components: `2`
  - Max Components: `3`
- [ ] Click "Create"
- [ ] Verify category created
- [ ] **Expected Result:** Category supports 2-3 components

#### Test 3.3: Validation - Min > Max
- [ ] Try to create/edit category with:
  - Min Components: `3`
  - Max Components: `2`
- [ ] **Expected Result:** Error message - "Min components cannot be greater than max components"

#### Test 3.4: Create Single Component Category
- [ ] Create category:
  - Name: `T-Shirt`
  - Min Components: `1`
  - Max Components: `1`
- [ ] **Expected Result:** Category requires exactly 1 component

#### Test 3.5: Create Variable Component Category
- [ ] Create category:
  - Name: `Traditional Set`
  - Min Components: `2`
  - Max Components: `5`
- [ ] **Expected Result:** Category supports 2-5 components

---

### Phase 4: Style Form - Grouped Component Selection

#### Test 4.1: View Grouped Components
- [ ] Navigate to create new style
- [ ] Select a Product Category (any)
- [ ] Open Component Selection dropdown
- [ ] Verify components are grouped by Component Group:
  - **Top Wear** section (with heading)
    - Blouse
    - Crop Top
    - etc.
  - **Bottom Wear** section (with heading)
    - Pants
    - Palazzo
    - etc.
  - **Other** section (ungrouped legacy components)
- [ ] **Expected Result:** Components grouped with clear visual sections

#### Test 4.2: Component Count Validation - Exact Count
- [ ] Select "T-Shirt" category (min: 1, max: 1)
- [ ] Check "Number of Components" field
- [ ] Try to change from 1 to 2
- [ ] **Expected Result:**
  - Helper text shows "This category requires exactly 1 component"
  - Red border on input when invalid (out of range)

#### Test 4.3: Component Count Validation - Range
- [ ] Select "Co-Ords Set" category (min: 2, max: 3)
- [ ] Check Number of Components field
- [ ] Verify helper text: "This category supports 2 to 3 components"
- [ ] Try setting to 1 (below min)
- [ ] **Expected Result:** Red border, invalid state
- [ ] Try setting to 4 (above max)
- [ ] **Expected Result:** Red border, invalid state
- [ ] Set to 2 or 3
- [ ] **Expected Result:** Valid, no red border

#### Test 4.4: Add Multiple Components
- [ ] Select "Co-Ords Set" category
- [ ] Set Number of Components to 2
- [ ] Add components:
  1. Crop Top (from Top Wear group)
  2. Palazzo (from Bottom Wear group)
- [ ] Verify both components added
- [ ] **Expected Result:** Can select from different groups

#### Test 4.5: Component Filtering by Category
- [ ] Select a category that has component defaults configured
- [ ] Open component dropdown
- [ ] Verify only relevant components appear (filtered)
- [ ] **Expected Result:** Dropdown shows category-appropriate components

---

### Phase 5: Backend API Testing (Optional - For Developers)

Use cURL, Postman, or Thunder Client to test APIs directly:

#### Test 5.1: Get All Component Groups
```bash
curl http://localhost:5000/api/component-groups
```
**Expected:** Returns all component groups with pagination

#### Test 5.2: Create Component Group
```bash
curl -X POST http://localhost:5000/api/component-groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "code": "NECKWEAR",
    "name": "Neck Wear",
    "description": "Neckline accessories",
    "sortOrder": 7
  }'
```
**Expected:** 201 Created, returns new group

#### Test 5.3: Update Component Group
```bash
curl -X PUT http://localhost:5000/api/component-groups/{id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Neck Accessories"
  }'
```
**Expected:** 200 OK, returns updated group

#### Test 5.4: Get Components by Group
```bash
curl http://localhost:5000/api/component-groups/{id}/components
```
**Expected:** Returns all components in that group

---

## Verification Points

### ✅ Key Features to Verify

1. **No Naming Confusion**
   - [ ] Component Groups are clearly distinct from Product Categories
   - [ ] Component Groups = physical grouping (TOP, BOTTOM, etc.)
   - [ ] Product Categories = business categories (Ethnic, Western, etc.)

2. **User Management**
   - [ ] Users can create new Component Groups through UI
   - [ ] No hardcoded values - all groups come from database
   - [ ] Groups can be reordered, edited, and deactivated

3. **Flexible Component Counts**
   - [ ] "Co-Ords Set" can have 2 OR 3 components
   - [ ] "T-Shirt" requires exactly 1 component
   - [ ] Validation shows helpful messages

4. **Grouped Selection**
   - [ ] Component dropdown shows clear grouping
   - [ ] Components sorted by group sortOrder
   - [ ] Ungrouped legacy components appear in "Other" section

5. **Backward Compatibility**
   - [ ] Old components with componentCategory still work
   - [ ] Display shows legacy badge for old components
   - [ ] New components use Component Group
   - [ ] Both can coexist

---

## Common Issues & Solutions

### Issue 1: Component Groups Dropdown Empty
**Cause:** Component groups not loading
**Solution:**
- Check browser console for errors
- Verify backend API `/api/component-groups` returns data
- Check authentication token

### Issue 2: Cannot Delete Component Group
**Cause:** Components are assigned to that group
**Expected Behavior:** This is correct - you cannot delete groups in use
**Solution:** First reassign components to different groups, then delete

### Issue 3: Components Not Grouped in Style Form
**Cause:** Components don't have componentGroupId assigned
**Solution:** Edit components and assign them to a component group

### Issue 4: Validation Not Working
**Cause:** Product category doesn't have min/max values set
**Solution:** Edit category and set minComponents/maxComponents

---

## Performance Testing

### Load Test
- [ ] Create 50+ components across different groups
- [ ] Verify dropdown loads quickly
- [ ] Check grouped rendering performance
- [ ] Verify search/filter remains fast

### Concurrent Users
- [ ] Have 2 users edit different component groups simultaneously
- [ ] Verify no conflicts
- [ ] Check real-time updates

---

## Regression Testing

### Test Existing Functionality
- [ ] Manufacturing modules still work (cutting, stitching, finishing)
- [ ] Work orders display components correctly
- [ ] Style list shows all styles
- [ ] Existing styles with old componentCategory still display
- [ ] BOM calculation works correctly

---

## Success Criteria

The implementation is successful if:

1. ✅ All 6 default component groups are visible and manageable
2. ✅ Users can create new component groups through UI
3. ✅ Component Masters show grouped dropdown
4. ✅ Product Categories support min/max components
5. ✅ Style Form shows grouped component selection
6. ✅ Validation works for component counts
7. ✅ No naming confusion between groups and categories
8. ✅ Existing functionality still works (no regressions)
9. ✅ Backend APIs respond correctly
10. ✅ No console errors in browser

---

## Next Steps After Testing

### If All Tests Pass:
1. Mark Phase 7 as complete
2. Consider removing deprecated `componentCategory` field (Phase 8)
3. Plan Pattern Part UI implementation (future enhancement)
4. Deploy to staging environment

### If Issues Found:
1. Document specific errors with screenshots
2. Note which test cases failed
3. Provide error messages from console
4. Report for immediate fixing

---

## Support

If you encounter any issues during testing:

1. **Backend Logs:** Check PowerShell window running backend server
2. **Frontend Logs:** Open browser DevTools → Console tab
3. **Network Errors:** DevTools → Network tab → Check failed requests
4. **Database Issues:** Check Prisma Studio at `npx prisma studio`

---

## Testing Completed By

- **Tester Name:** _______________
- **Date:** _______________
- **Build Version:** Component Group Master v1.0
- **Overall Result:** ☐ PASS ☐ FAIL ☐ PARTIAL

**Notes:**
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________
