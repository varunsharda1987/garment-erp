# Production Tracking UI & Enhancement Features - Implementation Plan

## Executive Summary

This plan outlines the implementation of a **Production Tracking UI** integrated with the existing Production Status Dashboard, along with additional enhancement features including Override History, Visual Blockers, and Notifications.

### Current State
✅ **Backend Validation**: Fully implemented with hard blocking rules
✅ **Sample Form**: Sequential validation integrated
✅ **API Endpoints**: All validation endpoints operational
✅ **Admin Override**: Modal component ready to use

### What's Missing
❌ **Production Tracking UI**: No interface to update work order stages
❌ **Override History**: No UI to view admin override audit logs
❌ **Visual Blockers**: Limited blocker display in production dashboard
❌ **Notifications**: No alerts when blocks occur or are overridden

---

## Part 1: Production Tracking UI Integration

### Overview
Create an inline stage update component within the Production Status page that allows users to transition work orders through production stages with real-time validation.

### User Flow

1. **User views Production Status** → See all order items with current stages
2. **User clicks "Update Stage"** on an order item → Inline form appears
3. **User selects new stage** → System validates transition (checks FIT/PP/SIZE_SET samples, FPT/GPT tests)
4. **If blocked:**
   - Non-admin: Error toast with blocker message
   - Admin: Override modal appears
5. **If allowed:** → Stage updates successfully, production tracking record created
6. **Dashboard refreshes** → Shows updated stage and progress

---

### Component Architecture

```
ProductionStatus.tsx (existing)
├── OrderStatusListItem.tsx (existing)
│   ├── StageProgressBar (existing)
│   ├── BlockerTags (existing)
│   └── [NEW] ProductionTrackingInlineForm
│       ├── Stage selector dropdown
│       ├── Quantity input
│       ├── Remarks textarea
│       ├── "Update Stage" button
│       └── AdminOverrideModal (reuse existing)
└── [NEW] BulkStageUpdateDialog (optional)
    └── Update multiple work orders at once
```

---

### Implementation Steps

#### Step 1: Create ProductionTrackingInlineForm Component

**File**: `frontend/src/components/production/ProductionTrackingInlineForm.tsx`

**Props**:
```typescript
interface ProductionTrackingInlineFormProps {
  workOrderId: string;
  currentStage: ProductionStage;
  orderItemId: string;
  onSuccess: () => void;
  onCancel: () => void;
}
```

**Features**:
- Dropdown with all production stages (exclude stages before current)
- Quantity completed input (with validation: max = work order total quantity)
- Optional remarks textarea
- Pre-validation using `stageValidationService.checkStageTransition()`
- Shows validation blockers inline before submission
- Admin override modal integration
- Loading states during API calls

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Update Production Stage                                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ New Stage:        [Dropdown: IN_CUTTING ▼]             │
│                                                          │
│ Quantity:         [Input: 0] / 1000                     │
│                                                          │
│ Remarks:          [Textarea (optional)]                 │
│                                                          │
│ ⚠️ Validation Issues:                                   │
│   • FIT Sample must be approved before IN_PRINTING      │
│   • FPT (FPT-001) must pass. Current: FAIL             │
│                                                          │
│              [Cancel]  [Update Stage]                   │
└─────────────────────────────────────────────────────────┘
```

**Validation Logic**:
```typescript
const handleStageChange = async (newStage: ProductionStage) => {
  setSelectedStage(newStage);

  // Pre-validate
  try {
    const validation = await stageValidationService.checkStageTransition(
      workOrderId,
      newStage
    );

    setValidationBlockers(validation.blockers);
    setCanProceed(!validation.isBlocked);
  } catch (error) {
    toast.error('Failed to validate stage transition');
  }
};

const handleSubmit = async () => {
  if (validationBlockers.length > 0 && user?.role !== 'ADMIN') {
    toast.error('Cannot proceed: ' + validationBlockers[0].message);
    return;
  }

  if (validationBlockers.length > 0 && user?.role === 'ADMIN') {
    // Show override modal
    setShowOverrideModal(true);
    return;
  }

  // No blocks - proceed
  await submitStageUpdate(false, null);
};

const submitStageUpdate = async (
  adminOverride: boolean,
  overrideReason: string | null
) => {
  await workOrderService.addProductionTracking(workOrderId, {
    productionStage: selectedStage,
    quantityCompleted,
    remarks,
    adminOverride,
    overrideReason,
  });

  toast.success('Stage updated successfully');
  onSuccess(); // Refresh parent data
};
```

#### Step 2: Integrate into OrderStatusListItem

**File**: `frontend/src/components/status/OrderStatusListItem.tsx`

**Changes**:
1. Add state for inline form visibility:
   ```typescript
   const [showTrackingForm, setShowTrackingForm] = useState(false);
   ```

2. Add "Update Stage" button in quick actions row:
   ```tsx
   {currentUser?.role && ['ADMIN', 'PRODUCTION_MANAGER'].includes(currentUser.role) && (
     <Button
       size="sm"
       variant="outline"
       onClick={() => setShowTrackingForm(true)}
     >
       <RefreshCw className="h-4 w-4 mr-1" />
       Update Stage
     </Button>
   )}
   ```

3. Render inline form when button clicked:
   ```tsx
   {showTrackingForm && (
     <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
       <ProductionTrackingInlineForm
         workOrderId={item.workOrders.latestWorkOrderId}
         currentStage={item.currentStage}
         orderItemId={item.orderItemId}
         onSuccess={() => {
           setShowTrackingForm(false);
           refreshData(); // Parent callback
         }}
         onCancel={() => setShowTrackingForm(false)}
       />
     </div>
   )}
   ```

#### Step 3: Update Work Order Service (Frontend)

**File**: `frontend/src/services/workOrder.service.ts`

**Modify existing method**:
```typescript
async addProductionTracking(
  workOrderId: string,
  data: {
    productionStage: ProductionStage;
    quantityCompleted: number;
    remarks?: string;
    adminOverride?: boolean;
    overrideReason?: string | null;
  }
): Promise<ProductionTracking> {
  const response = await apiClient.post(
    `/work-orders/${workOrderId}/tracking`,
    data
  );
  return response.data.data;
}
```

#### Step 4: Enhance Production Status Page

**File**: `frontend/src/pages/ProductionStatus.tsx`

**Add refresh mechanism**:
```typescript
const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

const refreshData = useCallback(() => {
  setLastUpdated(new Date());
  loadData(); // Re-fetch production status
}, []);

// Pass refresh callback to child components
<OrderStatusListItem
  item={item}
  onRefresh={refreshData}
  // ... other props
/>
```

**Add real-time status badge**:
```tsx
<div className="flex items-center gap-2">
  <Badge variant="outline" className="text-xs">
    <Clock className="h-3 w-3 mr-1" />
    Updated: {formatDistanceToNow(lastUpdated)} ago
  </Badge>
  <Button size="sm" variant="ghost" onClick={refreshData}>
    <RefreshCw className="h-4 w-4" />
  </Button>
</div>
```

---

### Production Stage Workflow

**Stage Progression** (enforced by validation):

```
ORDER_RECEIVED
  ↓
PENDING_COSTING
  ↓
PENDING_GREIGE_ORDER ← Can order greige/trims even without FIT approval
  ↓
IN_PRINTING ← 🔒 BLOCKED if FIT Sample not approved
  ↓
IN_DYING ← 🔒 BLOCKED if FIT Sample not approved
  ↓
IN_CUTTING ← 🔒 BLOCKED if SIZE_SET Sample, FPT, or GPT not approved
  ↓
IN_STITCHING ← 🔒 BLOCKED by same rules as cutting
  ↓
IN_EMBROIDERY ← 🔒 BLOCKED by same rules
  ↓
IN_HANDWORK ← 🔒 BLOCKED by same rules
  ↓
IN_FINISHING ← 🔒 BLOCKED by same rules
  ↓
READY_TO_SHIP ← 🔒 BLOCKED by same rules
  ↓
SHIPPED ← 🔒 BLOCKED by same rules
  ↓
COMPLETED
```

---

## Part 2: Override History Page

### Overview
Create a dedicated admin page to view all override events with filtering, search, and export capabilities.

### Component Structure

**File**: `frontend/src/pages/admin/OverrideHistory.tsx`

**Features**:
- Table view with columns: Date, User, Type, Work Order/Sample, Reason, Details
- Filters: Date range, user, block type, work order/sample
- Search: By override reason
- Export: Download as CSV/Excel
- Pagination: 50 records per page
- Detail modal: View full override context

**UI Layout**:
```
┌────────────────────────────────────────────────────────────────┐
│ Override History                                    [Export CSV]│
├────────────────────────────────────────────────────────────────┤
│ Filters:                                                        │
│ Date Range: [Last 30 days ▼]  User: [All ▼]  Type: [All ▼]   │
│ Search: [Search by reason...]                                  │
├────────────────────────────────────────────────────────────────┤
│ Date/Time      │ User        │ Type              │ Item        │
│────────────────┼─────────────┼───────────────────┼─────────────│
│ 2025-01-15 3PM │ John Doe    │ Stage Transition  │ WO-12345   │
│ Reason: Customer urgency - approved by production head         │
│ Details: IN_CUTTING → SIZE_SET_SAMPLE_NOT_APPROVED            │
│                                                                 │
│ 2025-01-14 9AM │ Jane Smith  │ Sample Creation   │ SMPL-456   │
│ Reason: Rush order for VIP customer                           │
│ Details: PP_SAMPLE → FIT_SAMPLE required                      │
└────────────────────────────────────────────────────────────────┘
```

**Implementation**:
```typescript
const OverrideHistory: React.FC = () => {
  const [overrides, setOverrides] = useState<OverrideHistoryItem[]>([]);
  const [filters, setFilters] = useState({
    dateRange: 'last_30_days',
    userId: null,
    blockType: null,
  });

  useEffect(() => {
    loadOverrides();
  }, [filters]);

  const loadOverrides = async () => {
    const data = await stageValidationService.getOverrideHistory(
      filters.workOrderId,
      filters.sampleId,
      50
    );
    setOverrides(data);
  };

  const exportToCSV = () => {
    const csv = convertToCSV(overrides);
    downloadFile(csv, 'override-history.csv');
  };

  return (
    <div>
      <PageHeader title="Override History" />
      <FilterBar filters={filters} onChange={setFilters} />
      <DataTable
        data={overrides}
        columns={columns}
        onRowClick={(override) => showDetailModal(override)}
      />
    </div>
  );
};
```

**Route**: Add to `frontend/src/routes/lazy-routes.tsx`:
```typescript
export const OverrideHistoryPage = lazy(() => import('@/pages/admin/OverrideHistory'));
```

**Navigation**: Add to admin menu in `frontend/src/components/Sidebar.tsx`:
```tsx
{user?.role === 'ADMIN' && (
  <MenuItem href="/admin/override-history" icon={ShieldAlert}>
    Override History
  </MenuItem>
)}
```

---

## Part 3: Enhanced Visual Blockers in Production Dashboard

### Overview
Improve the blocker display in the production status page to show more context and suggested actions.

### Current Implementation
**File**: `frontend/src/components/status/OrderStatusListItem.tsx` (lines 200-220)

Currently shows blockers as simple tags with severity colors.

### Enhancement Goals
1. **Expandable blocker cards** with full context
2. **Direct action buttons** (e.g., "Approve Sample", "View FPT Results")
3. **Timeline view** showing how long each blocker has been active
4. **Impact metrics** showing how many orders are affected

### Enhanced Blocker Component

**File**: `frontend/src/components/production/EnhancedBlockerCard.tsx`

```tsx
interface EnhancedBlockerCardProps {
  blocker: BlockerInfo;
  orderItemId: string;
  onResolve?: () => void;
}

const EnhancedBlockerCard: React.FC<EnhancedBlockerCardProps> = ({
  blocker,
  orderItemId,
  onResolve,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getActionButton = () => {
    switch (blocker.type) {
      case 'FIT_SAMPLE_NOT_APPROVED':
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/samples?styleId=${styleId}`)}
          >
            View Sample
          </Button>
        );
      case 'FPT_NOT_PASSED':
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/fabric-physical-tests/${fptId}`)}
          >
            View Test Results
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn(
      "border rounded-lg p-3",
      blocker.severity === 'CRITICAL' && "border-red-500 bg-red-50",
      blocker.severity === 'HIGH' && "border-orange-500 bg-orange-50",
      blocker.severity === 'MEDIUM' && "border-yellow-500 bg-yellow-50"
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 flex-1">
          <AlertCircle className={cn(
            "h-5 w-5 mt-0.5",
            blocker.severity === 'CRITICAL' && "text-red-600",
            blocker.severity === 'HIGH' && "text-orange-600",
            blocker.severity === 'MEDIUM' && "text-yellow-600"
          )} />
          <div className="flex-1">
            <p className="font-medium text-sm">{blocker.message}</p>
            {blocker.daysStuck && (
              <p className="text-xs text-gray-600 mt-1">
                Stuck for {blocker.daysStuck} days
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getActionButton()}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              isExpanded && "rotate-180"
            )} />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="text-xs">
            <p className="font-semibold">Blocker Type:</p>
            <p className="text-gray-600">{blocker.type}</p>
          </div>
          <div className="text-xs">
            <p className="font-semibold">Resolution Steps:</p>
            <ol className="list-decimal list-inside text-gray-600 space-y-1">
              {getResolutionSteps(blocker.type).map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
```

**Integration**:
Replace existing `BlockerTags` component with `EnhancedBlockerCard` in `OrderStatusListItem.tsx`.

---

## Part 4: Notification System

### Overview
Implement notifications when production blockers occur or are overridden.

### Notification Types

1. **Blocker Detected** → Alert production team when new blocker appears
2. **Override Occurred** → Notify management when admin bypasses blocks
3. **Blocker Resolved** → Celebrate when blocker is cleared
4. **Stage Updated** → Confirm successful stage transitions

### Implementation Options

#### Option A: In-App Toast Notifications (Immediate)
**File**: `frontend/src/components/production/ProductionTrackingInlineForm.tsx`

```typescript
// After successful stage update
toast.success('Stage updated to IN_CUTTING', {
  description: '100 pieces completed',
  action: {
    label: 'View',
    onClick: () => navigate(`/work-orders/${workOrderId}`),
  },
});

// After admin override
toast.warning('Admin override used', {
  description: 'Stage transition blocked but overridden',
  action: {
    label: 'View History',
    onClick: () => navigate('/admin/override-history'),
  },
});

// When blocker detected
toast.error('Production blocked', {
  description: blocker.message,
  action: {
    label: 'View Details',
    onClick: () => setShowBlockerDetails(true),
  },
});
```

#### Option B: Notification Center (Future Enhancement)
**File**: `frontend/src/components/NotificationCenter.tsx`

- Bell icon in header with unread count
- Dropdown panel showing recent notifications
- Mark as read/unread functionality
- Persistent storage in database
- Push notifications (if PWA enabled)

#### Option C: Email Notifications (Backend)
**File**: `backend/src/services/notification.service.ts`

```typescript
class NotificationService {
  async notifyBlockerDetected(workOrderId: string, blockers: BlockerInfo[]) {
    const workOrder = await prisma.work_orders.findUnique({
      where: { id: workOrderId },
      include: { order_items: { include: { customers: true } } }
    });

    // Send email to production managers
    await emailService.send({
      to: getProductionManagers(),
      subject: `Production Blocked: WO-${workOrder.workOrderNumber}`,
      template: 'production-blocker',
      data: { workOrder, blockers }
    });
  }

  async notifyAdminOverride(override: StageTransitionOverride) {
    // Send email to senior management
    await emailService.send({
      to: getManagement(),
      subject: 'Admin Override Alert',
      template: 'admin-override',
      data: { override }
    });
  }
}
```

**Integration Point**:
- Add notification calls after `productionBlockingValidationService.logOverride()`
- Add notification calls when `validateStageTransition()` returns blockers

---

## Implementation Phases

### Phase 1: Core Production Tracking UI (Priority: HIGH)
**Duration**: 3-4 days

1. ✅ Create `ProductionTrackingInlineForm` component
2. ✅ Integrate into `OrderStatusListItem`
3. ✅ Add refresh mechanism to `ProductionStatus` page
4. ✅ Test all blocking scenarios (FIT, SIZE_SET, FPT, GPT)
5. ✅ Test admin override workflow

**Deliverable**: Users can update production stages with real-time validation

---

### Phase 2: Override History Page (Priority: MEDIUM)
**Duration**: 2 days

1. ✅ Create `OverrideHistory` page component
2. ✅ Add filtering and search
3. ✅ Implement CSV export
4. ✅ Add to admin navigation menu
5. ✅ Add detail modal for viewing full context

**Deliverable**: Admins can audit all override events

---

### Phase 3: Enhanced Visual Blockers (Priority: MEDIUM)
**Duration**: 1-2 days

1. ✅ Create `EnhancedBlockerCard` component
2. ✅ Add expandable details
3. ✅ Add direct action buttons
4. ✅ Replace existing `BlockerTags`
5. ✅ Test with various blocker types

**Deliverable**: Better user experience for understanding and resolving blockers

---

### Phase 4: Notification System (Priority: LOW)
**Duration**: 2-3 days

1. ✅ Implement toast notifications (Option A)
2. ⏳ Create email templates (Option C - optional)
3. ⏳ Set up email service integration (Option C - optional)
4. ⏳ Build notification center UI (Option B - future)

**Deliverable**: Real-time alerts for production events

---

## Testing Strategy

### Unit Tests
- `ProductionTrackingInlineForm`: Stage selection, quantity validation, blocker display
- `productionBlockingValidationService`: All blocking rules
- `OverrideHistory`: Filtering, search, export

### Integration Tests
- Full workflow: Select stage → Validation → Override → Update
- Data flow: Frontend → API → Database → Response
- Refresh mechanism: Stage update → Dashboard refresh

### User Acceptance Tests
1. **Non-admin tries to bypass block** → Should see error toast
2. **Admin overrides block** → Should see modal, log override, update stage
3. **Sequential sample creation** → PP requires FIT, SIZE_SET requires PP
4. **FPT/GPT blocking** → Cannot move to cutting if tests fail
5. **Override history** → All overrides visible to admins

---

## Critical Files Summary

### New Files to Create:

**Frontend**:
1. `frontend/src/components/production/ProductionTrackingInlineForm.tsx` - Main tracking form
2. `frontend/src/pages/admin/OverrideHistory.tsx` - Override audit page
3. `frontend/src/components/production/EnhancedBlockerCard.tsx` - Enhanced blocker display
4. `frontend/src/components/NotificationCenter.tsx` - Notification UI (future)

**Backend**:
5. `backend/src/services/notification.service.ts` - Email notifications (optional)

### Files to Modify:

**Frontend**:
1. `frontend/src/components/status/OrderStatusListItem.tsx` - Add tracking form integration
2. `frontend/src/pages/ProductionStatus.tsx` - Add refresh mechanism
3. `frontend/src/services/workOrder.service.ts` - Already updated (adminOverride params)
4. `frontend/src/components/Sidebar.tsx` - Add override history menu item
5. `frontend/src/routes/lazy-routes.tsx` - Add override history route

**Backend**:
6. `backend/src/services/productionBlockingValidation.service.ts` - Already complete
7. `backend/src/controllers/stageTransitionValidation.controller.ts` - Already complete

---

## Success Criteria

✅ **Production Tracking**:
- Users can update production stages inline from production status page
- Real-time validation prevents invalid stage transitions
- Admin override workflow is smooth and auditable
- Dashboard refreshes automatically after updates

✅ **Override History**:
- All overrides are logged and visible to admins
- Filtering, search, and export work correctly
- Detail view provides full context

✅ **Enhanced Blockers**:
- Blockers show clear messages and resolution steps
- Direct action buttons navigate to relevant pages
- Expandable cards provide additional context

✅ **Notifications**:
- Toast notifications appear for all key events
- Email notifications alert stakeholders (if implemented)

---

## Database Impact

**No schema changes required!** All necessary models already exist:
- ✅ `stage_transition_overrides` - Audit trail (already created)
- ✅ `production_tracking` - Stage updates (existing)
- ✅ `work_orders` - Production runs (existing)
- ✅ `samples` - Sample tracking (existing)
- ✅ `fabric_physical_tests` - FPT records (existing)
- ✅ `garment_physical_tests` - GPT records (existing)

---

## API Endpoints Summary

**Already Implemented**:
- ✅ `GET /api/stage-validation/check` - Validate stage transition
- ✅ `GET /api/stage-validation/check-sample-creation` - Validate sample creation
- ✅ `GET /api/stage-validation/override-history` - Get override logs
- ✅ `POST /api/work-orders/:id/tracking` - Add production tracking (with override support)
- ✅ `GET /api/production-status/by-order` - Get order-centric status

**No new endpoints needed!** All functionality can be built with existing APIs.

---

## Risk Mitigation

### Risk 1: Users bypass validation by calling API directly
**Mitigation**: Backend validation is hard-enforced; frontend is just UX layer

### Risk 2: Performance issues with real-time validation
**Mitigation**: Validation runs in parallel; results cached briefly

### Risk 3: Too many override requests
**Mitigation**: Override history provides management visibility for review

### Risk 4: Confusion about which blocker to resolve first
**Mitigation**: Enhanced blocker cards show priority and resolution steps

---

## Future Enhancements (Out of Scope)

1. **Bulk Stage Updates**: Update multiple work orders at once
2. **Stage Automation**: Auto-transition when conditions met
3. **WhatsApp Notifications**: Instant alerts to mobile devices
4. **AI-Powered Predictions**: Predict blockers before they occur
5. **Mobile App**: Dedicated production tracking app
6. **Barcode Scanning**: Scan work orders to update stages

---

## Conclusion

This plan provides a complete roadmap for implementing Production Tracking UI and enhancement features. All backend infrastructure is already in place, making frontend implementation straightforward.

**Estimated Total Timeline**: 8-11 days for all phases
**Priority**: Phase 1 (Production Tracking UI) should be implemented first
**Team**: 1 full-stack developer can complete all phases

The implementation will transform the production status page from a read-only dashboard into an interactive production management tool with full audit compliance.
