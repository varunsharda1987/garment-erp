# Component Group Master - Quick Reference Card

## 🚀 Quick Start

### What Changed?
✅ Added **Component Group Master** - User-manageable component groupings (TOP, BOTTOM, OUTER, etc.)
✅ Replaced hardcoded `componentCategory` with database-driven groups
✅ Added min/max component counts to Product Categories
✅ Enhanced Style Form with grouped component selection and validation

---

## 📍 New Features at a Glance

### 1. Component Group Master Page
**Access:** Sidebar → Masters → Component Groups
**URL:** `/component-groups`

**What You Can Do:**
- ✏️ Create new component groups (e.g., "Head Wear", "Footwear")
- 📝 Edit existing groups
- 🔄 Reorder groups (up/down arrows)
- 🗑️ Delete groups (only if no components assigned)
- 🔍 Search groups

**Default Groups:**
- TOP (Top Wear)
- BOTTOM (Bottom Wear)
- FULL (Full Garment)
- INNER (Inner Wear)
- OUTER (Outer Wear)
- ACCESS (Accessory)

### 2. Component Masters - Enhanced
**Access:** Sidebar → Masters → Component Masters
**URL:** `/component-masters`

**What Changed:**
- Component Group dropdown (replaces free-text "componentCategory")
- Dropdown loads groups from database (fully flexible)
- Visual badges show component group assignment
- Can create components without groups (optional)

### 3. Product Categories - Variable Component Counts
**Access:** Sidebar → Masters → Product Categories
**URL:** `/product-categories`

**What Changed:**
- Min Components field (default: 1)
- Max Components field (default: 1)
- Examples:
  - T-Shirt: min=1, max=1 (exactly 1)
  - Co-Ords Set: min=2, max=3 (2 or 3 components)
  - Traditional Set: min=2, max=5 (2-5 components)

### 4. Style Form - Grouped Selection & Validation
**Access:** Sidebar → Styles → Create New Style
**URL:** `/styles/new`

**What Changed:**
- Components grouped by type in dropdown:
  - **Top Wear** → Blouse, Crop Top, Shirt, etc.
  - **Bottom Wear** → Pants, Palazzo, Skirt, etc.
  - **Other** → Ungrouped legacy components
- Number of Components validates against category min/max
- Visual feedback:
  - ✅ Green/normal when valid
  - ❌ Red border when invalid
- Helper messages:
  - "This category requires exactly 1 component"
  - "This category supports 2 to 3 components"

---

## 🎯 Common Use Cases

### Use Case 1: Create New Component Group
1. Navigate to Component Groups
2. Click "Add Component Group"
3. Enter:
   - Code: `FOOTWEAR` (auto-uppercase)
   - Name: `Footwear`
   - Description: `Shoes and sandals`
   - Sort Order: `7`
4. Click "Create"
5. ✅ New group available in Component Masters dropdown

### Use Case 2: Assign Component to Group
1. Navigate to Component Masters
2. Click "Add Component" or edit existing
3. Select Component Group from dropdown (e.g., "Top Wear")
4. Fill other fields
5. Click "Create" or "Update"
6. ✅ Component assigned to group

### Use Case 3: Create Variable Component Category
1. Navigate to Product Categories
2. Click "Add Category"
3. Enter:
   - Name: `Co-Ords Set`
   - Min Components: `2`
   - Max Components: `3`
4. Click "Create"
5. ✅ Category now supports 2-3 components

### Use Case 4: Create Style with Multiple Components
1. Navigate to Styles → Create New
2. Select Product Category: "Co-Ords Set"
3. Set Number of Components: `2` (or `3`)
4. Add Components:
   - Open dropdown → See grouped sections
   - Select from **Top Wear**: "Crop Top"
   - Select from **Bottom Wear**: "Palazzo"
5. ✅ Style created with grouped components

### Use Case 5: Reorder Component Groups
1. Navigate to Component Groups
2. Use ⬆️ / ⬇️ arrows next to each group
3. Move "OUTER" above "INNER"
4. ✅ Order saves automatically
5. Dropdown in Component Masters shows new order

---

## 🔧 API Endpoints (For Developers)

### Component Groups
```
GET    /api/component-groups              - List all (paginated)
POST   /api/component-groups              - Create new
GET    /api/component-groups/:id          - Get by ID
PUT    /api/component-groups/:id          - Update
DELETE /api/component-groups/:id          - Soft delete
POST   /api/component-groups/reorder      - Reorder
GET    /api/component-groups/:id/components - Get components in group
```

### Pattern Parts (Backend Only - No UI Yet)
```
GET    /api/pattern-parts                 - List all
POST   /api/pattern-parts                 - Create new
GET    /api/pattern-parts/:id             - Get by ID
PUT    /api/pattern-parts/:id             - Update
DELETE /api/pattern-parts/:id             - Soft delete
POST   /api/pattern-parts/reorder         - Reorder

Component-Pattern Part Associations:
GET    /api/components/:id/pattern-parts  - Get parts for component
POST   /api/components/:id/pattern-parts  - Add part to component
PUT    /api/components/:componentId/pattern-parts/:patternPartId - Update
DELETE /api/components/:componentId/pattern-parts/:patternPartId - Remove
```

---

## 🐛 Troubleshooting

### Component Groups Dropdown Empty
**Check:**
- Backend running? → http://localhost:5000/health
- Browser console errors? → F12 → Console
- API response? → F12 → Network → `/api/component-groups`

**Fix:**
- Restart backend server
- Check authentication token
- Verify seed script ran: `npm run seed:component-groups`

### Cannot Delete Component Group
**Message:** "Cannot delete component group. X component(s) are using this group."

**This is correct behavior!** You cannot delete groups that have components assigned.

**Fix:**
1. Reassign components to different groups
2. Then delete the group

### Validation Not Working in Style Form
**Check:**
- Does product category have min/max values set?
- Browser console for errors?

**Fix:**
1. Edit product category
2. Set Min Components and Max Components
3. Save
4. Try again

### Components Not Grouped in Dropdown
**Cause:** Components don't have componentGroupId assigned

**Fix:**
1. Edit each component
2. Select a Component Group from dropdown
3. Save
4. Components will now appear in that group's section

---

## 📊 Database Quick Reference

### Tables
```
component_group_master      - Component groups (TOP, BOTTOM, etc.)
pattern_part_master         - Pattern parts (SLEEVE, COLLAR, etc.)
component_pattern_parts     - Bridge table (many-to-many)
component_masters           - Added: componentGroupId
product_category_master     - Added: minComponents, maxComponents
```

### Seed Data
```bash
# Run seed script (if not already done)
cd backend
npm run seed:component-groups

# Result:
# - 6 component groups created
# - 12 pattern parts created
# - Existing components migrated
```

---

## 🎨 UI Component Reference

### Component Group Badge Styles
```tsx
// New component with group
<Badge variant="outline">{group.name}</Badge>

// Legacy component with old category
<Badge variant="secondary">{componentCategory}</Badge>

// No group assigned
<span className="text-gray-400">—</span>
```

### Validation States
```tsx
// Valid
<Input className="" />

// Invalid (out of range)
<Input className="border-red-500" />

// Helper text
<p className="text-xs text-gray-600">
  This category supports 2 to 3 components
</p>
```

---

## 📋 Testing Checklist (Quick)

- [ ] View Component Groups page
- [ ] Create new component group
- [ ] Edit component group
- [ ] Reorder component groups
- [ ] Try to delete group with components (should fail)
- [ ] Delete group without components (should succeed)
- [ ] Create component with group assigned
- [ ] View grouped dropdown in Component Masters
- [ ] Create category with min/max components
- [ ] Validate component count in Style Form
- [ ] Create style with multiple components from different groups
- [ ] Verify existing functionality still works

**Full Testing Guide:** See [COMPONENT_GROUP_TESTING_GUIDE.md](./COMPONENT_GROUP_TESTING_GUIDE.md)

---

## 🎓 Key Concepts

### Component Group vs Product Category
| Aspect | Component Group | Product Category |
|--------|----------------|------------------|
| **Purpose** | Physical grouping by garment placement | Business/market categorization |
| **Examples** | TOP, BOTTOM, OUTER, INNER | Ethnic, Western, Fusion, Kids |
| **Usage** | Organize components by body location | Classify products for catalog |
| **User Control** | Fully manageable via UI | Fully manageable via UI |

### Backward Compatibility
- ✅ Old components with `componentCategory` still work
- ✅ Display shows legacy badge for old components
- ✅ New components use `componentGroupId`
- ✅ Both can coexist
- ⏳ Future: Remove `componentCategory` after full migration

### Pattern Parts (Future)
- ✅ Backend infrastructure ready
- ✅ 12 default parts seeded (SLEEVE, COLLAR, etc.)
- ⏳ UI not implemented yet
- 🔮 Use when: CAD integration, pattern making, fabric calculation per part

---

## 🚢 Deployment Notes

### Environment Requirements
- Node.js 18+
- PostgreSQL with database created
- Prisma configured

### Deployment Steps
```bash
# 1. Database
cd backend
npx prisma migrate deploy           # Run migration
npm run seed:component-groups        # Seed default data

# 2. Backend
npm run build                       # Build backend
npm start                           # Start server

# 3. Frontend
cd ../frontend
npm run build                       # Build frontend
# Deploy dist/ folder to web server

# 4. Verify
# Visit: http://your-domain/component-groups
# Should see 6 default groups
```

---

## 📞 Support

### Documentation
- **Testing Guide:** [COMPONENT_GROUP_TESTING_GUIDE.md](./COMPONENT_GROUP_TESTING_GUIDE.md)
- **Full Summary:** [COMPONENT_GROUP_IMPLEMENTATION_SUMMARY.md](./COMPONENT_GROUP_IMPLEMENTATION_SUMMARY.md)
- **This Card:** [COMPONENT_GROUP_QUICK_REFERENCE.md](./COMPONENT_GROUP_QUICK_REFERENCE.md)

### Logs
- **Backend:** Check PowerShell window running `npm run dev`
- **Frontend:** Browser DevTools → Console (F12)
- **Database:** Run `npx prisma studio` to view data

### Common Commands
```bash
# Backend
cd backend
npm run dev              # Start dev server
npm run build            # Build for production
npx prisma studio        # Open database GUI
npx tsc --noEmit         # Check TypeScript errors

# Frontend
cd frontend
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
```

---

## ✨ Success Indicators

Your implementation is successful if:

1. ✅ Backend starts without errors
2. ✅ Frontend builds without errors
3. ✅ Component Groups page loads and shows 6 default groups
4. ✅ Component Masters dropdown loads groups from database
5. ✅ Product Categories accept min/max component values
6. ✅ Style Form shows grouped component dropdown
7. ✅ Validation works (red border for invalid counts)
8. ✅ Can create new component groups through UI
9. ✅ No console errors in browser
10. ✅ Existing functionality (manufacturing, orders, etc.) still works

---

**Version:** 1.0.0
**Date:** 2025-12-17
**Status:** ✅ Implementation Complete - Ready for Testing

🎉 **Congratulations!** Component Group Master system is fully implemented and ready for use.
