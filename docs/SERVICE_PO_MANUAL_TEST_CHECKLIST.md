# Service PO System - Manual Testing Checklist

## Pre-Test Setup

### 1. Start Servers
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Verify:**
- ✅ Backend running on http://localhost:5000
- ✅ Frontend running on http://localhost:5173
- ✅ No console errors on startup

---

## Test Execution Checklist

### ✅ Scenario 1: Work Order Service Calculation (5 minutes)

**Setup:**
1. [ ] Navigate to http://localhost:5173/work-orders
2. [ ] Open an existing work order in PENDING status (or create one)
3. [ ] Note work order number: `____________________`

**Test Steps:**
1. [ ] Verify "Calculate Services" button appears in header (purple button with Zap icon)
2. [ ] Click "Calculate Services" button
3. [ ] Verify button shows "Calculating..." with spinner
4. [ ] Wait for success toast: "Services Calculated"
5. [ ] Verify Service Requirements Summary Card appears after Material Readiness Card
6. [ ] Check statistics display:
   - [ ] Total Services: `____` (should be > 0)
   - [ ] Pending: `____`
   - [ ] PO Generated: `____`
   - [ ] Est. Total Cost: ₹`____`
7. [ ] Verify service breakdown by type shows (e.g., "3 Embroidery, 2 Printing")
8. [ ] Check processor assignment status shows assigned vs unassigned counts
9. [ ] Verify "View All Services" button appears in card header

**Expected Result:** ✅ Services calculated successfully, summary card displays accurate data

**Issues Found:** `_________________________________________________`

---

### ✅ Scenario 2: Service Requirements Dashboard (3 minutes)

**Test Steps:**
1. [ ] Click "View All Services" button from work order (or navigate to /service-requirements)
2. [ ] Verify 7 stat cards display with values:
   - [ ] Total Services: `____`
   - [ ] Pending: `____`
   - [ ] PO Generated: `____`
   - [ ] In Progress: `____`
   - [ ] Completed: `____`
   - [ ] Services Without Processor: `____`
   - [ ] Total Estimated Cost: ₹`____`
3. [ ] Verify Quick Actions card shows 3 green buttons
4. [ ] Click "Bulk Generate Service POs" button
5. [ ] Verify navigation to /service-requirements/list
6. [ ] Go back to dashboard
7. [ ] Click on "Pending" stat card
8. [ ] Verify URL shows: `/service-requirements/list?status=PENDING`
9. [ ] Verify table filtered to show only PENDING requirements

**Expected Result:** ✅ Dashboard displays correct statistics, navigation works with filters

**Issues Found:** `_________________________________________________`

---

### ✅ Scenario 3: Service Requirements List & Filtering (7 minutes)

**Test Steps:**
1. [ ] Navigate to /service-requirements/list
2. [ ] Verify table columns:
   - [ ] Checkbox
   - [ ] Work Order (clickable link)
   - [ ] Service Type (badge)
   - [ ] Quantity
   - [ ] Processor
   - [ ] Est. Cost
   - [ ] Status (colored badge)
   - [ ] Actions (3-dot menu)
3. [ ] Test Status Filter:
   - [ ] Click status dropdown
   - [ ] Select "PENDING"
   - [ ] Verify URL: `?status=PENDING`
   - [ ] Verify table shows only PENDING items
4. [ ] Test Service Type Filter:
   - [ ] Click service type dropdown
   - [ ] Select "EMBROIDERY"
   - [ ] Verify URL: `?status=PENDING&serviceType=EMBROIDERY`
   - [ ] Verify table shows filtered results
5. [ ] Test Search:
   - [ ] Type work order number in search box
   - [ ] Verify table filters in real-time
6. [ ] Test Clear Filters:
   - [ ] Click "Clear" button
   - [ ] Verify URL resets to base
   - [ ] Verify all filters cleared
7. [ ] Test Work Order Link:
   - [ ] Click work order link in table
   - [ ] Verify navigation to Work Order Detail page
   - [ ] Use browser back button
   - [ ] Verify filters preserved

**Expected Result:** ✅ All filters work correctly, URL reflects state, navigation preserves context

**Issues Found:** `_________________________________________________`

---

### ✅ Scenario 4: Processor Allocation (8 minutes)

**Test Steps:**
1. [ ] From Service Requirements List, filter to show PENDING items
2. [ ] Select 3-5 service requirements using checkboxes
3. [ ] Verify "Assign Processors" button shows: "Assign Processors (N)"
4. [ ] Click "Assign Processors" button
5. [ ] Verify ProcessorAllocationDialog opens
6. [ ] Check statistics grid displays:
   - [ ] High Confidence: `____`
   - [ ] Medium Confidence: `____`
   - [ ] Low Confidence: `____`
   - [ ] With Suggestion: `____`
7. [ ] Verify each requirement card shows:
   - [ ] Service Type badge
   - [ ] Work Order number
   - [ ] Confidence badge (HIGH/MEDIUM/LOW) with icon
   - [ ] Reason text (💡 emoji)
   - [ ] Processor dropdown (pre-selected if suggestion exists)
   - [ ] Suggested processor marked with ✨ emoji
8. [ ] Test Manual Assignment:
   - [ ] Change processor for one requirement using dropdown
   - [ ] Click "Assign N Processors" button
   - [ ] Verify loading state: "Assigning..."
   - [ ] Wait for success toast: "Processors Assigned - N requirements assigned"
   - [ ] Verify dialog closes
   - [ ] Verify table refreshes showing assigned processors
9. [ ] Select same requirements again
10. [ ] Click "Assign Processors"
11. [ ] Test Auto-Assign:
    - [ ] Click "Auto-Assign" button (outline button with Sparkles icon)
    - [ ] Verify success toast shows assigned/skipped counts
    - [ ] Verify dialog closes
    - [ ] Verify table shows updated processors

**Expected Result:** ✅ Processor suggestions accurate, assignment works both manually and automatically

**Issues Found:** `_________________________________________________`

---

### ✅ Scenario 5: Bulk Service PO Generation (10 minutes)

**Test Steps:**
1. [ ] Ensure you have requirements with assigned processors (from Scenario 4)
2. [ ] Select 5-10 requirements with at least 2 different processors
3. [ ] Verify "Bulk Generate POs" button shows: "Bulk Generate POs (N)"
4. [ ] Click "Bulk Generate POs" button
5. [ ] Verify BulkServicePODialog opens
6. [ ] Check statistics display:
   - [ ] Total Services: `____`
   - [ ] Processors: `____` (unique processor count)
   - [ ] Unassigned: `0` (should be zero)
   - [ ] Est. Total Cost: ₹`____`
7. [ ] Verify processor groups section:
   - [ ] One card per processor
   - [ ] Each card shows:
     - [ ] Processor name with Sparkles icon
     - [ ] Service count badge
     - [ ] Service types listed (comma-separated)
     - [ ] Estimated total in ₹
     - [ ] Expected Delivery Date input (pre-filled with +14 days)
     - [ ] Remarks input (optional)
8. [ ] Update delivery dates:
   - [ ] Change delivery date for first processor
   - [ ] Change delivery date for second processor
   - [ ] Verify dates accepted (min: today)
9. [ ] Add remarks:
   - [ ] Type "Urgent - priority order" in remarks for one processor
10. [ ] Click "Generate N Service POs" button (green)
11. [ ] Verify loading state: "Generating POs..." with spinner
12. [ ] Wait for success toast: "Bulk Service PO Generation Complete - N purchase order(s) created for ₹X"
13. [ ] Verify dialog closes
14. [ ] Navigate to /purchase-orders
15. [ ] Filter by POCategory: SERVICE (or search for recent POs)
16. [ ] Verify N service POs created:
    - [ ] Correct processor/supplier
    - [ ] Correct expected delivery dates
    - [ ] Correct remarks
    - [ ] POCategory includes "SERVICE"
17. [ ] Open one service PO
18. [ ] Verify items match service requirements:
    - [ ] Service type correct
    - [ ] Quantity correct
    - [ ] Rate and total correct

**Expected Result:** ✅ POs generated correctly, grouped by processor, all data accurate

**Edge Case Test:**
19. [ ] Try to generate POs for unassigned requirements:
    - [ ] Select requirements without processors
    - [ ] Click "Bulk Generate POs"
    - [ ] Verify error alert: "X service requirement(s) have no assigned processor"
    - [ ] Verify "Generate" button disabled

**Issues Found:** `_________________________________________________`

---

### ✅ Scenario 6: Complete End-to-End Workflow (12 minutes)

**Test Steps:**
1. [ ] Start from Work Order List: /work-orders
2. [ ] Create new work order with:
   - [ ] Order with style that has style_processes
   - [ ] Quantity: 100 pieces
   - [ ] Status: PENDING
3. [ ] Open the work order detail page
4. [ ] **Calculate Services:**
   - [ ] Click "Calculate Services"
   - [ ] Wait for completion
   - [ ] Note services created: `____`
5. [ ] **Navigate to Services:**
   - [ ] Click "View All Services" from summary card
   - [ ] Verify filtered to this work order
   - [ ] Note service types: `_________________________`
6. [ ] **Assign Processors:**
   - [ ] Select all services
   - [ ] Click "Assign Processors"
   - [ ] Review suggestions (note confidence levels: `____`)
   - [ ] Use Auto-Assign
   - [ ] Verify all assigned
7. [ ] **Generate POs:**
   - [ ] Select all services again
   - [ ] Click "Bulk Generate POs"
   - [ ] Review grouping (number of processors: `____`)
   - [ ] Set delivery dates
   - [ ] Generate POs
   - [ ] Note PO numbers created: `_________________________`
8. [ ] **Verify POs:**
   - [ ] Navigate to Purchase Orders
   - [ ] Find the service POs
   - [ ] Open each PO
   - [ ] Verify details correct
9. [ ] **Navigate Back to Work Order:**
   - [ ] Use Work Order link from Service Requirements List
   - [ ] Verify Service Summary Card now shows:
     - [ ] Services: `____`
     - [ ] PO Generated: `____`
     - [ ] Pending: 0
10. [ ] **Verify Status Updates:**
    - [ ] Go back to Service Requirements List
    - [ ] Verify all requirements now show status: PO_GENERATED

**Expected Result:** ✅ Complete workflow executes smoothly, data consistent across all pages

**Time Taken:** `____ minutes` (target: < 15 minutes for trained user)

**Issues Found:** `_________________________________________________`

---

### ✅ Scenario 7: Edge Cases & Error Handling (8 minutes)

**Test Cases:**

1. [ ] **Empty Work Order:**
   - Navigate to work order with no style_processes
   - Verify "Calculate Services" either:
     - Disabled, OR
     - Shows message: "No services needed"

2. [ ] **Duplicate Calculation:**
   - Calculate services for same work order twice
   - Verify no errors
   - Verify counts update correctly

3. [ ] **No Processors in System:**
   - Filter list to show unassigned services
   - Try to assign processors
   - Verify dropdown shows "No processors available" OR message

4. [ ] **Network Error Simulation:**
   - Open browser DevTools
   - Go to Network tab → Throttling → Offline
   - Try to calculate services
   - Verify error toast: "Failed to calculate services"
   - Go online, retry
   - Verify works

5. [ ] **Empty State - Dashboard:**
   - If possible, test with fresh database
   - Navigate to /service-requirements
   - Verify empty state message

6. [ ] **Empty State - List:**
   - Apply filters that return no results
   - Verify "No requirements found" message

7. [ ] **Pagination:**
   - If you have > 20 requirements
   - Verify pagination controls appear
   - Click page 2
   - Verify URL: `?page=2`
   - Verify different data loads

8. [ ] **Console Errors:**
   - Open browser DevTools console
   - Execute complete workflow
   - Verify NO errors or warnings in console

**Expected Result:** ✅ All edge cases handled gracefully, no crashes

**Issues Found:** `_________________________________________________`

---

### ✅ Scenario 8: Cross-Browser Compatibility (15 minutes)

**Browsers to Test:**

**Chrome:**
- [ ] All scenarios pass
- [ ] Dialogs render correctly
- [ ] Date picker works
- [ ] Dropdowns functional

**Firefox:**
- [ ] All scenarios pass
- [ ] Dialogs render correctly
- [ ] Date picker works
- [ ] Dropdowns functional

**Edge:**
- [ ] All scenarios pass
- [ ] Dialogs render correctly
- [ ] Date picker works
- [ ] Dropdowns functional

**Mobile Viewport (Chrome DevTools):**
- [ ] Responsive layout works
- [ ] Dialogs fit screen
- [ ] Buttons accessible
- [ ] Tables scrollable

**Expected Result:** ✅ Consistent experience across browsers

**Issues Found:** `_________________________________________________`

---

### ✅ Scenario 9: Performance Testing (10 minutes)

**Test Cases:**

1. [ ] **Large Work Order (50 services):**
   - Create work order with style containing many processes
   - Calculate services
   - Time taken: `____ seconds` (target: < 5s)

2. [ ] **Bulk Assign (50+ requirements):**
   - Select 50+ requirements
   - Assign processors
   - Time taken: `____ seconds` (target: < 5s)

3. [ ] **Bulk PO Generation (20+ POs):**
   - Select requirements for 20+ processors
   - Generate POs
   - Time taken: `____ seconds` (target: < 10s)

4. [ ] **List Loading (100+ requirements):**
   - Navigate to list with many requirements
   - Time taken: `____ seconds` (target: < 3s)

5. [ ] **Dashboard Loading:**
   - Navigate to dashboard
   - Time taken: `____ seconds` (target: < 2s)

**Expected Result:** ✅ All operations complete within acceptable time limits

**Issues Found:** `_________________________________________________`

---

### ✅ Scenario 10: Regression Testing (10 minutes)

**Verify existing features unaffected:**

1. [ ] **Material MRP:**
   - Navigate to /mrp
   - Verify dashboard loads
   - Calculate MRP for order
   - Verify still works

2. [ ] **Material Purchase Orders:**
   - Create material PO
   - Verify POCategory options include both material and service categories
   - Verify material PO creation unaffected

3. [ ] **Work Order Other Cards:**
   - Open work order detail
   - Verify Material Readiness Card displays
   - Verify Manufacturing Progress displays
   - Verify Service Card positioned correctly between them

4. [ ] **Navigation Menu:**
   - Verify all menu items intact
   - Verify no broken links

5. [ ] **Purchase Order List:**
   - View purchase orders
   - Verify filter by POCategory works
   - Verify both material and service POs display

**Expected Result:** ✅ No regressions, all existing features work

**Issues Found:** `_________________________________________________`

---

## Test Summary

### Overall Results

**Date:** `____________________`
**Tester:** `____________________`
**Duration:** `____ minutes` (target: < 90 minutes complete test suite)

| Scenario | Status | Critical Issues | Minor Issues |
|----------|--------|-----------------|--------------|
| 1. Service Calculation | ✅ / ❌ | | |
| 2. Dashboard | ✅ / ❌ | | |
| 3. List & Filtering | ✅ / ❌ | | |
| 4. Processor Allocation | ✅ / ❌ | | |
| 5. Bulk PO Generation | ✅ / ❌ | | |
| 6. End-to-End Workflow | ✅ / ❌ | | |
| 7. Edge Cases | ✅ / ❌ | | |
| 8. Browser Compatibility | ✅ / ❌ | | |
| 9. Performance | ✅ / ❌ | | |
| 10. Regression | ✅ / ❌ | | |

### Critical Issues (Must Fix Before Production)
1. `_________________________________________________`
2. `_________________________________________________`
3. `_________________________________________________`

### Minor Issues (Can Fix Post-Production)
1. `_________________________________________________`
2. `_________________________________________________`
3. `_________________________________________________`

### Recommendations
1. `_________________________________________________`
2. `_________________________________________________`
3. `_________________________________________________`

### Sign-Off

**Implementation Status:** ✅ PRODUCTION READY / ❌ NEEDS FIXES

**Approver Name:** `____________________`
**Signature:** `____________________`
**Date:** `____________________`

---

## Quick Commands for Testing

```bash
# Start both servers
cd backend && npm run dev &
cd frontend && npm run dev

# Reset test database (if needed)
cd backend && npm run db:reset

# Check console errors
# In browser: F12 → Console → filter "error"

# Network throttling (Chrome DevTools)
# F12 → Network → Throttling → Slow 3G

# Mobile viewport (Chrome DevTools)
# F12 → Toggle device toolbar (Ctrl+Shift+M)
```

---

## Screenshot Checklist

**Take screenshots of:**
- [ ] Work Order Detail with Service Requirements Summary Card
- [ ] Service Requirements Dashboard (all stat cards visible)
- [ ] Service Requirements List (with filters applied)
- [ ] ProcessorAllocationDialog (showing suggestions)
- [ ] BulkServicePODialog (showing processor groups)
- [ ] Generated Service PO in Purchase Orders list
- [ ] Service PO Detail page
- [ ] Any errors encountered

**Save to:** `docs/screenshots/service-po-testing/`
