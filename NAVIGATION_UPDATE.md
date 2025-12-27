# Navigation Update - Fabric Costing System

## ✅ New Pages Added to Sidebar

The following pages have been added to the sidebar navigation:

### 1. **Fabric Costing** (Top-Level Navigation)
- **Location:** Main navigation area, after "Cost Sheets"
- **Path:** `/fabric-costing`
- **Icon:** Calculator
- **Badge:** "TEST" (indicates testing/preview feature)
- **Permission:** `costSheets`
- **Purpose:** Standalone page for testing fabric sourcing strategies

**How to Access:**
1. Open sidebar
2. Look for "Fabric Costing" with blue "TEST" badge
3. Click to open the fabric costing calculator

---

### 2. **Processor Rate Cards** (Masters Section)
- **Location:** Masters → After "Suppliers"
- **Path:** `/processor-rate-cards`
- **Icon:** FileSpreadsheet
- **Permission:** `suppliers`
- **Purpose:** Manage processor rate cards with quantity slabs

**How to Access:**
1. Open sidebar
2. Expand "Masters" section
3. Find "Processor Rate Cards" right after "Suppliers"
4. Click to open rate card management

---

## 📋 Complete Navigation Structure

### Top-Level Items
```
📊 Main Dashboard          → /dashboard
📖 Process Guide           → /process-guide
📈 Production Status       → /production/status
👕 Styles                  → /styles
📏 CAD Planning            → /styles?cadStatus=PENDING
🧮 Cost Sheets             → /cost-sheets
🧮 Fabric Costing [TEST]   → /fabric-costing          ⭐ NEW
🧪 Testing (FPT/GPT)       → /testing
```

### Masters Section (Expanded)
```
Masters
  ├─ All Masters              → /master-data
  ├─────────────────────────────
  ├─ Customers                → /customers
  ├─ Suppliers                → /suppliers
  ├─ Processor Rate Cards     → /processor-rate-cards  ⭐ NEW
  ├─────────────────────────────
  ├─ Greige Master            → /greige
  ├─ Fabric Master            → /fabric
  ├─ Embroidery Master        → /embroidery
  ├─ Trims                    → /trim-masters
  ├─ Labels                   → /materials/label
  ├─ Packaging                → /materials/packaging
  ├─ Machine Parts            → /materials/machine-part
  ├─ Other Materials          → /materials/other
  ├─────────────────────────────
  ├─ Colors                   → /colors
  ├─ Size Categories          → /masters/size-categories
  ├─ Component Groups         → /component-groups
  ├─ Component Masters        → /component-masters
  ├─ Product Categories       → /product-categories
  ├─────────────────────────────
  └─ Warehouses               → /inventory/warehouses
```

---

## 🎯 Usage Workflow

### Recommended Testing Order

1. **Setup Phase:**
   ```
   Sidebar → Masters → Processor Rate Cards
   - View existing rate cards
   - Create new rate cards for testing
   - Configure quantity slabs
   ```

2. **Testing Phase:**
   ```
   Sidebar → Fabric Costing [TEST]
   - Test single fabric calculations
   - Test batch calculations
   - View sourcing options (Stock, Ready, Greige+Processing)
   - Verify processor rates are used
   ```

3. **Production Phase:**
   ```
   Sidebar → Cost Sheets → Create New
   - Use fabric costing in actual cost sheets
   - Select sourcing strategies
   - Complete cost sheet with all costs
   ```

---

## 🔍 Visual Indicators

### TEST Badge
- **Color:** Blue (`bg-blue-100 text-blue-700`)
- **Purpose:** Indicates feature is in testing/preview mode
- **Pages with TEST badge:**
  - Fabric Costing (top-level nav)

### Icons Used
- **Fabric Costing:** 🧮 Calculator icon
- **Processor Rate Cards:** 📊 FileSpreadsheet icon

---

## 🔐 Permissions

Both new pages use existing permissions:

| Page | Permission Required | Who Has Access |
|------|-------------------|----------------|
| Fabric Costing | `costSheets` | Users with cost sheet permissions |
| Processor Rate Cards | `suppliers` | Users with supplier management permissions |

**Note:** No new permissions needed - uses existing permission system.

---

## 📱 Responsive Behavior

The sidebar maintains its responsive behavior:
- **Desktop:** Full sidebar visible
- **Mobile/Tablet:** Collapsible sidebar
- **Touch:** Swipe to open/close

Both new pages are fully responsive and work on all devices.

---

## 🎨 Styling Consistency

### Active State
When a page is active (currently viewing):
- Background: Light indigo (`bg-indigo-50`)
- Text: Indigo (`text-indigo-700`)
- Font: Medium weight

### Hover State
When hovering over a link:
- Background: Light gray (`hover:bg-gray-100`)

### Group Headers
- Font: Semibold, smaller text
- Expandable with chevron icons
- Hover background on click

---

## 🧪 Testing the Navigation

### Test Checklist

**Fabric Costing Link:**
- [ ] Visible in top-level navigation
- [ ] Shows "TEST" badge in blue
- [ ] Clicking opens `/fabric-costing` page
- [ ] Active state highlights when on page
- [ ] Calculator icon displays correctly

**Processor Rate Cards Link:**
- [ ] Visible in Masters section
- [ ] Located after "Suppliers"
- [ ] Clicking opens `/processor-rate-cards` page
- [ ] Active state highlights when on page
- [ ] FileSpreadsheet icon displays correctly

**Permission Handling:**
- [ ] Users with `costSheets` permission see Fabric Costing
- [ ] Users with `suppliers` permission see Processor Rate Cards
- [ ] Links hidden for users without permissions

**Responsive Behavior:**
- [ ] Sidebar opens/closes correctly
- [ ] Links visible on mobile
- [ ] Touch interactions work
- [ ] No layout breaks

---

## 🔄 Navigation Flow Examples

### Example 1: Setting Up Rate Cards
```
1. Login to system
2. Click sidebar hamburger (if collapsed)
3. Scroll to "Masters" section
4. Click "Masters" to expand
5. Find "Processor Rate Cards" (after Suppliers)
6. Click to open rate card management
7. View existing 10 rate cards
8. Create new rate cards as needed
```

### Example 2: Testing Fabric Costing
```
1. Login to system
2. Look for "Fabric Costing [TEST]" in main navigation
3. Click to open fabric costing calculator
4. Select style or enter fabric manually
5. Click "Calculate" to see sourcing options
6. Verify processor rates from rate cards are used
7. Check cost comparison table
```

### Example 3: Creating Cost Sheet with Sourcing
```
1. Navigate to "Cost Sheets"
2. Click "Create New Cost Sheet"
3. Select style (fabrics auto-populate)
4. For each fabric row, click "Select Sourcing"
5. Modal opens with 3 tabs
6. Review Greige+Processing tab (uses rate cards)
7. Select preferred strategy
8. Continue with rest of cost sheet
9. Save cost sheet
```

---

## 📚 Related Documentation

- [QUICKSTART_FABRIC_COSTING.md](./QUICKSTART_FABRIC_COSTING.md) - Complete startup guide
- [PROCESSOR_RATE_CARD_GUIDE.md](./PROCESSOR_RATE_CARD_GUIDE.md) - Rate card system guide
- [FABRIC_COSTING_TEST.md](./FABRIC_COSTING_TEST.md) - Testing instructions
- [FABRIC_COSTING_FLOW.md](./FABRIC_COSTING_FLOW.md) - System architecture

---

## 🐛 Troubleshooting Navigation

### Issue: New links not showing
**Solution:**
1. Clear browser cache
2. Hard refresh (Ctrl + Shift + R)
3. Check if user has required permissions
4. Verify frontend server is running

### Issue: Links visible but page not loading
**Solution:**
1. Check routes are registered in [App.tsx](frontend/src/App.tsx:385)
2. Verify lazy-loaded components in [lazy-routes.tsx](frontend/src/routes/lazy-routes.tsx:106)
3. Check browser console for errors

### Issue: Permission errors
**Solution:**
1. Verify user role has `costSheets` or `suppliers` permission
2. Check [permissions.config.ts](frontend/src/config/permissions.config.ts) for role mappings
3. Re-login if permissions were recently updated

---

## ✅ Summary

**What Changed:**
- Added "Fabric Costing" to top-level navigation with TEST badge
- Added "Processor Rate Cards" to Masters section
- Both pages use existing permissions (no config changes needed)
- Navigation remains clean and organized

**User Impact:**
- Easy access to new fabric costing features
- Clear indication that Fabric Costing is in testing mode
- Logical placement in Masters for rate card management

**Next Steps:**
1. Start frontend: `cd frontend && npm run dev`
2. Login to system
3. Look for new navigation items
4. Test both pages are accessible
5. Begin fabric costing system testing

**Everything is ready for testing! 🚀**
