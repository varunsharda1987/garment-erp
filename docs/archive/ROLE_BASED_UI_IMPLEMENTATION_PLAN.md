# Plan: Implement Department/Role-Based UI and Page Access

## Overview
Transform the current admin-centric UI into a role-based system where different departments see customized interfaces, relevant pages, and tailored dashboards based on their role and responsibilities.

## Current State Analysis

### What Already Exists ✓
- **9 User Roles defined**: ADMIN, PRODUCTION_MANAGER, SALES, INVENTORY, ACCOUNTS, QUALITY, PURCHASE, FACTORY_SUPERVISOR, MERCHANDISER
- **Backend RBAC**: `authorize()` middleware protecting routes by role
- **Department field**: Optional `department` string field in users table
- **Auth system**: JWT-based with user/token persistence in Zustand store
- **150+ routes**: Comprehensive application covering all ERP functions
- **Protected routes**: Basic authentication check (but no role checking)

### Current Limitations ✗
- **No frontend role-based routing**: All authenticated users can access all routes
- **Generic navigation**: Everyone sees the same sidebar with all options
- **No department in auth**: Department field not stored in auth store after login
- **Single dashboard**: All users see the same generic dashboard
- **No conditional UI**: Components don't hide/show based on user role
- **Backend-only validation**: Frontend relies entirely on backend to reject unauthorized actions

## Questions to Clarify Before Implementation

I need your input on several key design decisions:

### 1. **Primary Access Control Mechanism**
- **Option A** (Recommended): Use **Role** as primary driver (structured, already has backend RBAC)
- **Option B**: Use **Department** as primary driver (more flexible but less structured)
- **Option C**: Hybrid - Role for permissions, Department for additional context

**Your Choice**: _____

### 2. **Department Formalization**
Current `department` field is free-form text. Should we:
- **Option A**: Create Department enum matching functional areas (Production, Sales, Quality, etc.)
- **Option B**: Keep flexible, map existing UserRole to functional areas instead

**Your Choice**: _____

### 3. **Customization Scope**

**Level 1 (Basic)**:
- Different sidebar navigation per role
- Route-level access control
- Generic dashboard for all

**Level 2 (Moderate)**:
- Level 1 + Role-specific dashboards
- Filtered data views
- Hide/show form sections by role

**Level 3 (Advanced)**:
- Level 2 + Completely different workflows
- Department-specific pages with custom layouts
- Role-specific terminology/branding

**Your Choice**: _____

### 4. **Priority Departments/Roles**

Which roles should we implement custom UIs for first? (Select 3-5):

- [ ] **Merchandising** (Styles, CAD, Samples, BOM)
- [ ] **Production** (Work Orders, Manufacturing, Status tracking)
- [ ] **Sales** (Orders, Customers, Delivery tracking)
- [ ] **Inventory** (Stock, Warehouses, Movements)
- [ ] **Procurement** (POs, GRN, Suppliers)
- [ ] **Quality** (Testing, FPT/GPT, Lab management)
- [ ] **Accounts** (Finance, Costing, Reports)
- [ ] **Admin** (All access - current state)

**Your Selection**: _____

### 5. **Example Use Case**

Please provide 1-2 specific examples of what you envision:

**Example Template**:
```
Role: [PRODUCTION_MANAGER]
Should See:
- Dashboard showing: [production metrics, WIP status, bottlenecks]
- Navigation sections: [Manufacturing, Work Orders, Production Status]
- Pages: [Printing, Dyeing, Cutting, Stitching, Finishing, Dispatch]

Should NOT See:
- Masters management (except read-only for reference)
- Financial/costing details
- User management
```

**Your Example(s)**:
```
[Please provide your example here]
```

---

## Proposed Implementation Plan

*(This section will be detailed once you answer the questions above)*

### High-Level Approach

#### Phase 1: Foundation (Role-Based Routing)
1. **Enhance Auth Store**
   - Add department to User interface in auth types
   - Store department in auth store after login
   - Update auth service to fetch department from backend

2. **Create Permission System**
   - Define route-to-role mappings configuration
   - Create `usePermissions()` hook for checking access
   - Build route permission validator

3. **Implement Role-Based Route Guards**
   - Enhance `ProtectedRoute` component with role checking
   - Create 403 Unauthorized page
   - Add route-level permission requirements

#### Phase 2: Dynamic Navigation
1. **Navigation Configuration**
   - Create role-to-menu mappings
   - Define navigation structure per role/department
   - Build navigation builder utility

2. **Sidebar Enhancement**
   - Modify Sidebar to filter items by user role
   - Hide entire sections if user lacks access
   - Add role-based badges/indicators

3. **Header Updates**
   - Display department in user dropdown
   - Show role-appropriate quick actions

#### Phase 3: Role-Specific Dashboards
1. **Dashboard Architecture**
   - Create base dashboard layout component
   - Build role-specific dashboard variants
   - Implement dashboard router/selector

2. **Dashboard Implementations** (based on your priorities)
   - Merchandising dashboard (styles, samples, CAD pipeline)
   - Production dashboard (WIP, machine status, bottlenecks)
   - Sales dashboard (orders, delivery status, customer activity)
   - Inventory dashboard (stock levels, movements, alerts)
   - Quality dashboard (test results, failure rates)

3. **Shared Widgets**
   - Create reusable dashboard components
   - Build metric cards, charts, tables
   - Implement real-time data hooks

#### Phase 4: Component-Level Permissions
1. **Permission Utilities**
   - `hasPermission(permission)` hook
   - `<Authorized roles={[...]}>` wrapper component
   - `canAccess(route)` utility

2. **Form Enhancements**
   - Hide/disable fields based on role
   - Show read-only views for non-editors
   - Add role-based validation

3. **List/Detail Views**
   - Filter data by department/role
   - Hide actions user can't perform
   - Show appropriate columns per role

#### Phase 5: Testing & Refinement
1. **Testing Strategy**
   - Test routing with different roles
   - Verify permission checks on all routes
   - Validate dashboard data scoping

2. **Documentation**
   - Document role-permission mappings
   - Create user guides per department
   - Update developer documentation

---

## Critical Files to Modify

### Backend
- `backend/prisma/schema.prisma` - Potentially add Department enum
- `backend/src/controllers/auth.controller.ts` - Return department in login/me responses

### Frontend - Core Auth/Permissions
- `frontend/src/types/auth.types.ts` - Add department to User interface
- `frontend/src/stores/auth.store.ts` - Store department in auth state
- `frontend/src/components/ProtectedRoute.tsx` - Add role-based access control
- **NEW**: `frontend/src/config/permissions.ts` - Route/role mappings
- **NEW**: `frontend/src/hooks/usePermissions.ts` - Permission checking hook
- **NEW**: `frontend/src/components/Authorized.tsx` - Permission wrapper component

### Frontend - Navigation
- `frontend/src/components/Sidebar.tsx` - Filter menu items by role
- `frontend/src/components/Header.tsx` - Show department, role-specific actions
- **NEW**: `frontend/src/config/navigation.ts` - Role-based navigation config

### Frontend - Dashboards
- `frontend/src/pages/Dashboard.tsx` - Router to role-specific dashboards
- **NEW**: `frontend/src/pages/dashboards/MerchandisingDashboard.tsx`
- **NEW**: `frontend/src/pages/dashboards/ProductionDashboard.tsx`
- **NEW**: `frontend/src/pages/dashboards/SalesDashboard.tsx`
- **NEW**: `frontend/src/pages/dashboards/InventoryDashboard.tsx`
- **NEW**: `frontend/src/pages/dashboards/QualityDashboard.tsx`
- **NEW**: `frontend/src/components/dashboard/DashboardLayout.tsx`

### Frontend - Routes
- `frontend/src/App.tsx` - Add role requirements to route definitions

---

## Architecture Decisions to Make

### 1. Permission Model
**Option A - Simple Role-Based**:
```typescript
const routePermissions = {
  '/styles': ['ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'],
  '/orders': ['ADMIN', 'SALES', 'MERCHANDISER'],
  '/users': ['ADMIN']
}
```

**Option B - Fine-Grained Capabilities** (more complex but flexible):
```typescript
const roleCapabilities = {
  MERCHANDISER: ['styles.read', 'styles.write', 'samples.read', 'cad.read'],
  PRODUCTION_MANAGER: ['production.read', 'production.write', 'workorders.read']
}
```

### 2. Navigation Structure
**Option A - Filtered Monolithic** (current sidebar, hide items):
- Same navigation structure for all
- Hide entire sections if no child accessible
- Simpler to maintain

**Option B - Role-Specific Menus** (completely different navs):
- Define separate menu for each role
- More maintenance but cleaner UX
- Better for distinct workflows

### 3. Dashboard Strategy
**Option A - Single Dashboard with Sections**:
- One dashboard page
- Show/hide sections by role
- Quick to implement

**Option B - Separate Dashboard Pages**:
- Distinct dashboard per role
- More customization possible
- Better performance (load only what's needed)

---

## Example Permission Configuration (Illustrative)

```typescript
// frontend/src/config/permissions.ts

export const RoutePermissions = {
  // Admin only
  '/users': ['ADMIN'],
  '/users/:id': ['ADMIN'],

  // Merchandising
  '/styles': ['ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'],
  '/styles/new': ['ADMIN', 'MERCHANDISER'],
  '/styles/:id': ['ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER', 'SALES'],
  '/cad-planning': ['ADMIN', 'MERCHANDISER'],
  '/samples': ['ADMIN', 'MERCHANDISER', 'QUALITY'],

  // Sales & Orders
  '/orders': ['ADMIN', 'SALES', 'MERCHANDISER'],
  '/orders/new': ['ADMIN', 'SALES'],
  '/customers': ['ADMIN', 'SALES', 'MERCHANDISER'],

  // Production
  '/work-orders': ['ADMIN', 'PRODUCTION_MANAGER', 'FACTORY_SUPERVISOR'],
  '/production-status': ['ADMIN', 'PRODUCTION_MANAGER', 'SALES'],
  '/printing': ['ADMIN', 'PRODUCTION_MANAGER', 'FACTORY_SUPERVISOR'],
  '/dyeing': ['ADMIN', 'PRODUCTION_MANAGER', 'FACTORY_SUPERVISOR'],
  '/cutting': ['ADMIN', 'PRODUCTION_MANAGER', 'FACTORY_SUPERVISOR'],
  '/stitching': ['ADMIN', 'PRODUCTION_MANAGER', 'FACTORY_SUPERVISOR'],
  '/finishing': ['ADMIN', 'PRODUCTION_MANAGER', 'FACTORY_SUPERVISOR'],

  // Inventory
  '/warehouses': ['ADMIN', 'INVENTORY'],
  '/stock-in': ['ADMIN', 'INVENTORY'],
  '/stock-out': ['ADMIN', 'INVENTORY'],
  '/stock-levels': ['ADMIN', 'INVENTORY', 'PRODUCTION_MANAGER'],

  // Procurement
  '/purchase-orders': ['ADMIN', 'PURCHASE'],
  '/grn': ['ADMIN', 'PURCHASE', 'INVENTORY'],
  '/suppliers': ['ADMIN', 'PURCHASE'],

  // Quality
  '/testing': ['ADMIN', 'QUALITY', 'PRODUCTION_MANAGER'],
  '/fabric-physical-tests': ['ADMIN', 'QUALITY'],
  '/garment-physical-tests': ['ADMIN', 'QUALITY'],

  // Finance
  '/cost-sheets': ['ADMIN', 'ACCOUNTS', 'MERCHANDISER'],
  '/charts-of-accounts': ['ADMIN', 'ACCOUNTS'],

  // Read-only access to masters for reference
  '/masters/*': ['ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER', 'PURCHASE', 'INVENTORY']
}

export const NavigationConfig = {
  ADMIN: {
    // All sections visible
    quickLinks: ['dashboard', 'process-guide', 'production-status', 'styles', 'testing'],
    sections: ['orders', 'manufacturing', 'inventory', 'procurement', 'masters', 'reports', 'settings']
  },

  MERCHANDISER: {
    quickLinks: ['dashboard', 'styles', 'cad-planning', 'samples'],
    sections: ['orders', 'masters']
  },

  PRODUCTION_MANAGER: {
    quickLinks: ['dashboard', 'production-status', 'work-orders'],
    sections: ['manufacturing', 'inventory', 'masters']
  },

  SALES: {
    quickLinks: ['dashboard', 'orders', 'customers', 'production-status'],
    sections: ['orders', 'masters']
  },

  INVENTORY: {
    quickLinks: ['dashboard', 'stock-levels'],
    sections: ['inventory', 'procurement']
  },

  PURCHASE: {
    quickLinks: ['dashboard', 'purchase-orders', 'suppliers'],
    sections: ['procurement', 'inventory', 'masters']
  },

  QUALITY: {
    quickLinks: ['dashboard', 'testing', 'samples'],
    sections: ['testing', 'manufacturing']
  }
}
```

---

## Next Steps

**Please provide answers to the questions in the "Questions to Clarify" section above**, especially:
1. Your preferred access control approach (Role vs Department)
2. Customization level you want (Basic/Moderate/Advanced)
3. Top 3-5 priority roles/departments to implement first
4. At least one concrete example of what a specific role should/shouldn't see

Once I have your input, I'll refine this plan with:
- Detailed step-by-step implementation tasks
- Specific component designs
- Concrete permission configurations
- Timeline estimates for each phase

---

## Benefits of This Approach

✅ **Better UX**: Users see only what's relevant to their role
✅ **Faster Navigation**: Reduced clutter, easier to find features
✅ **Security**: Frontend and backend validation aligned
✅ **Scalability**: Easy to add new roles or adjust permissions
✅ **Maintainability**: Centralized permission configuration
✅ **Performance**: Load only necessary components per role
✅ **Onboarding**: New users understand their scope immediately
