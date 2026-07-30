# Service PO System - E2E Testing Guide

## Test Environment
- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- Test Date: 2026-02-06

## Test Scenarios

### Scenario 1: Work Order Service Calculation
**Objective:** Verify service requirements can be calculated from work order

**Prerequisites:**
- Work order exists with status PENDING
- Work order has associated style with style_processes
- Material readiness is complete

**Steps:**
1. Navigate to Work Order Detail page
2. Verify "Calculate Services" button is visible
3. Click "Calculate Services" button
4. Verify loading state shows "Calculating..."
5. Verify success message appears
6. Verify Service Requirements Summary Card appears with:
   - Total Services count
   - Pending count
   - PO Generated count
   - Estimated Total Cost
   - Service breakdown by type
   - Processor assignment status

**Expected Results:**
- Service requirements created successfully
- Summary card displays accurate statistics
- No console errors
- Button disabled during calculation

**Test Data:**
- Work Order ID: [To be captured during test]

---

### Scenario 2: Service Requirements Dashboard
**Objective:** Verify dashboard displays service statistics correctly

**Prerequisites:**
- Service requirements exist in system

**Steps:**
1. Navigate to /service-requirements
2. Verify 7 stat cards display:
   - Total Services
   - Pending
   - PO Generated
   - In Progress
   - Completed
   - Services Without Processor
   - Total Estimated Cost
3. Verify Quick Actions card shows 3 buttons
4. Verify data tables load (Services Needing PO, Overdue Requirements)
5. Click on stat cards to verify navigation with filters

**Expected Results:**
- All cards display correct counts
- Navigation preserves filter context
- Tables load without errors
- Loading states show properly

---

### Scenario 3: Service Requirements List with Filtering
**Objective:** Verify list page filtering and URL-driven state

**Prerequisites:**
- Multiple service requirements with different statuses/types

**Steps:**
1. Navigate to /service-requirements/list
2. Test Status filter:
   - Select "PENDING" status
   - Verify URL updates: ?status=PENDING
   - Verify table filters correctly
3. Test Service Type filter:
   - Select "EMBROIDERY" type
   - Verify URL updates: ?serviceType=EMBROIDERY
   - Verify table filters correctly
4. Test combined filters:
   - Apply status + service type + search
   - Verify URL contains all parameters
   - Verify table shows correct results
5. Test Clear Filters button
6. Test pagination
7. Verify Work Order links navigate correctly

**Expected Results:**
- Filters work independently and combined
- URL always reflects current filter state
- Bookmarking filtered views works
- Table updates without page reload
- Pagination preserves filters

---

### Scenario 4: Processor Allocation Flow
**Objective:** Verify processor suggestion and assignment workflow

**Prerequisites:**
- Service requirements exist with status PENDING
- Processors exist in system
- Some requirements have rate card data

**Steps:**
1. Navigate to Service Requirements List
2. Select 3-5 service requirements using checkboxes
3. Verify "Assign Processors" button shows count
4. Click "Assign Processors" button
5. Verify ProcessorAllocationDialog opens
6. Verify dialog displays:
   - Statistics grid (High/Medium/Low confidence, With Suggestion)
   - Processor suggestions with confidence badges
   - Suggestion reasons
   - Processor dropdown for each requirement
7. Test Auto-Assign:
   - Click "Auto-Assign" button
   - Verify success message
   - Verify dialog closes
   - Verify list refreshes
8. Test Manual Assign:
   - Open dialog again
   - Change suggested processor for one requirement
   - Click "Assign [N] Processors"
   - Verify success message
   - Verify table shows updated processors

**Expected Results:**
- Confidence levels display correctly
- Suggested processors pre-selected in dropdowns
- Auto-assign only assigns high/medium confidence
- Manual assign respects user selections
- List refreshes after assignment

---

### Scenario 5: Bulk Service PO Generation
**Objective:** Verify bulk PO generation with processor grouping

**Prerequisites:**
- Service requirements exist with assigned processors
- Requirements grouped by at least 2 different processors

**Steps:**
1. Navigate to Service Requirements List
2. Select requirements with assigned processors
3. Click "Bulk Generate POs" button
4. Verify BulkServicePODialog opens
5. Verify statistics display:
   - Total Services
   - Processors (count of unique processors)
   - Unassigned (should be 0)
   - Est. Total Cost
6. Verify processor groups display:
   - One card per processor
   - Service count per processor
   - Service types listed
   - Estimated total per processor
7. Verify delivery date inputs have default value (+14 days)
8. Update delivery dates for each processor
9. Add remarks for one processor
10. Click "Generate [N] Service POs"
11. Verify loading state
12. Verify success message with count and amount
13. Navigate to Purchase Orders list
14. Verify service POs created with correct POCategory

**Expected Results:**
- Requirements grouped correctly by processor
- Delivery dates default to 2 weeks from now
- All processors have valid delivery dates before generation
- Success message shows correct PO count
- POs created with SERVICE category
- Service requirements status updated to PO_GENERATED

**Edge Cases to Test:**
- Select requirements with no assigned processor → should show warning, block generation
- Select requirements from single processor → should create 1 PO
- Mixed assigned/unassigned → should show error, block generation

---

### Scenario 6: Cross-Navigation Flow
**Objective:** Verify navigation between Work Order, Services, and POs

**Prerequisites:**
- Complete workflow executed (calculated services, assigned processors, generated POs)

**Steps:**
1. Start at Work Order Detail page
2. Click "View All Services" button
3. Verify navigation to /service-requirements/list?workOrderId={id}
4. Verify table filtered to show only that work order's services
5. Click Work Order link in table
6. Verify navigation back to Work Order Detail
7. Click "Assign Processors" quick action
8. Verify navigation to list with status=PENDING filter
9. From Service Requirements List, click on a requirement with PO
10. Verify PO link navigates to Purchase Order Detail

**Expected Results:**
- All navigation links work correctly
- Filter context preserved in URLs
- No dead-end pages
- Back button works correctly
- Breadcrumbs accurate

---

### Scenario 7: Edge Cases and Error Handling

**Test Cases:**

1. **No Services to Calculate:**
   - Work order with no style_processes
   - Expected: Empty state or message indicating no services needed

2. **Duplicate Calculation:**
   - Calculate services for same work order twice
   - Expected: Update existing requirements or show warning

3. **Unassigned Processors:**
   - Try to generate POs without assigning processors
   - Expected: Error alert, generation blocked

4. **Invalid Delivery Date:**
   - Try to generate PO with past delivery date
   - Expected: Validation error (if implemented)

5. **Network Errors:**
   - Simulate API failure during calculation
   - Expected: Error toast, graceful degradation

6. **Empty States:**
   - Dashboard with no services → should show "No services" state
   - List with no results → should show "No requirements found"

7. **Permission Checks:**
   - User without permissions tries to calculate services
   - Expected: Appropriate error or disabled buttons

---

## Browser Compatibility Testing

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] Safari (if available)

Verify:
- Dialogs render correctly
- Dropdowns work
- Date pickers functional
- Responsive design on mobile viewport

---

## Performance Testing

**Large Dataset Tests:**
1. Work order with 50+ service requirements
2. Bulk assign processors to 100+ requirements
3. Bulk generate 20+ POs simultaneously

**Expected:**
- Operations complete within 5 seconds
- UI remains responsive
- No memory leaks
- Proper loading indicators

---

## Regression Testing Checklist

After implementation, verify existing features still work:
- [ ] Material MRP workflow unaffected
- [ ] Purchase Order creation still works
- [ ] Work Order status transitions correct
- [ ] Navigation menu intact
- [ ] Other work order cards (Material Readiness, Manufacturing Progress) display correctly

---

## Test Results Template

### Test Execution: [Date]
**Tester:** [Name]
**Environment:** [Dev/Staging/Prod]

| Scenario | Status | Notes | Screenshots |
|----------|--------|-------|-------------|
| 1. Service Calculation | ✅ / ❌ | | |
| 2. Dashboard | ✅ / ❌ | | |
| 3. List Filtering | ✅ / ❌ | | |
| 4. Processor Allocation | ✅ / ❌ | | |
| 5. Bulk PO Generation | ✅ / ❌ | | |
| 6. Cross-Navigation | ✅ / ❌ | | |
| 7. Edge Cases | ✅ / ❌ | | |

**Critical Issues Found:** [List]
**Minor Issues Found:** [List]
**Recommendations:** [List]

---

## Automated Test Coverage (Future)

**Playwright E2E Tests to Create:**
```typescript
// tests/service-po-workflow.spec.ts
test('complete service PO workflow', async ({ page }) => {
  // 1. Navigate to work order
  // 2. Calculate services
  // 3. Verify summary card
  // 4. Navigate to services list
  // 5. Assign processors
  // 6. Generate POs
  // 7. Verify POs created
});
```

**Jest Unit Tests to Create:**
```typescript
// serviceRequirement.service.test.ts
describe('Service Requirement Service', () => {
  test('calculateServices creates requirements', async () => {});
  test('suggestProcessors returns confidence levels', async () => {});
  test('bulkGenerateServicePOs groups by processor', async () => {});
});
```

---

## Sign-Off Criteria

Implementation can be marked as **production-ready** when:
- [ ] All 7 scenarios pass without critical issues
- [ ] Edge cases handled gracefully
- [ ] No console errors or warnings
- [ ] Performance acceptable (< 5s operations)
- [ ] Browser compatibility verified
- [ ] Regression tests pass
- [ ] Documentation complete
- [ ] Stakeholder approval obtained

---

## Known Limitations

1. **Processor rate card matching:** May not find exact match, estimates may be inaccurate
2. **Historical data:** Existing embroidery/job work orders won't have workOrderId linkage
3. **Multi-currency:** Service costs in INR only currently

---

## Post-Deployment Monitoring

**Metrics to Track:**
- Average time from service calculation to PO generation
- Processor suggestion accuracy (manual override rate)
- Service PO volume by type
- Cost estimation vs actual variance

**Alerts to Set:**
- Failed service calculations
- Bulk PO generation failures
- High rate of manual processor assignments (low confidence)

---

## Rollback Plan

**If critical issues found in production:**

1. **Database:** No rollback needed (additive changes only)
2. **Backend:** Revert to previous commit, service tables remain but unused
3. **Frontend:** Remove routes from App.tsx, users won't access new pages
4. **Communication:** Notify users of temporary unavailability

**Recovery Time Objective (RTO):** < 30 minutes
**Recovery Point Objective (RPO):** No data loss (tables persist)
