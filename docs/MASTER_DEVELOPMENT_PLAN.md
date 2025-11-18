# 🏭 KASHAYA FABS ERP - MASTER DEVELOPMENT PLAN

> **SINGLE SOURCE OF TRUTH** - Complete development roadmap with all phases consolidated

**Last Updated:** November 15, 2025
**Version:** 2.0
**Overall Progress:** 35% Complete (Phases 0-2 + 5.1-5.2 complete)
**Current Focus:** Phase 1 Documentation + Phase 1.5 Import/Export Infrastructure
**Go-Live Target:** March 2026

---

## 📑 TABLE OF CONTENTS

- [Project Overview](#project-overview)
- [Quick Navigation Index](#quick-navigation-index)
- [Phase Completion Status](#phase-completion-status)
- [Phase Details (0-11)](#phase-details)
- [Backward Compatibility Strategy](#backward-compatibility-strategy)
- [Technology Stack](#technology-stack)
- [Success Metrics](#success-metrics)

---

## 📊 PROJECT OVERVIEW

### Business Context
**Company:** Kashaya Fabs
**Industry:** Garment Manufacturing (Ethnic Wear, Western Wear, Uniforms)
**Scale:** 300 machines, 30-40 staff, 30K-50K pieces/month
**Orders:** Single piece to 10,000 pcs per style

### Primary Goals
1. **Real-time Production Tracking** - View all styles, all stages, all locations
2. **Pre-Order Cost Management** - Cost Sheet → BOM workflow
3. **Inventory Management** - Raw materials + finished goods
4. **Multi-Location Coordination** - Seamless operations across sites
5. **Financial Compliance** - GST, tax, and export documentation

---

## 🗂️ QUICK NAVIGATION INDEX

### Documentation Files
- **[MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md)** (this file) - Complete development roadmap
- **[DEVELOPMENT_NAVIGATION.md](DEVELOPMENT_NAVIGATION.md)** - Quick reference guide
- **[GLOSSARY.md](GLOSSARY.md)** - All technical terms (180+ definitions)
- **[BUSINESS_RULES.md](BUSINESS_RULES.md)** - Business logic and validation rules
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design decisions
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Database structure (48 tables)

### Setup & Configuration
- **[LOCAL_DATABASE_SETUP.md](../LOCAL_DATABASE_SETUP.md)** - PostgreSQL 17.6 setup guide
- **[INDIAN_COMPLIANCE_GUIDE.md](../INDIAN_COMPLIANCE_GUIDE.md)** - GST and compliance specifics
- **[INDIAN_SETUP_QUICKSTART.md](../INDIAN_SETUP_QUICKSTART.md)** - Quick start guide

### Feature Documentation
- **[Cost Sheet](features/cost-sheet/)** - Pre-order costing module (60% complete)
- **Phase Status Files** - PHASE1_COMPLETE.md, PHASE1_CONTROLLERS_COMPLETE.md

### Legacy Reference (Historical)
- PROJECT_MASTER_GUIDE.md - Previous consolidated guide
- NEXT_SESSION.md - Quick session start reference

---

## 📈 PHASE COMPLETION STATUS

### Legend
- ✅ **COMPLETED** - 100% done, tested, and validated
- ⏳ **IN PROGRESS** - Actively being developed
- 📋 **PLANNED** - Defined and ready to start
- 🔄 **PENDING VALIDATION** - Complete but awaiting user approval

---

### Phase Overview

| Phase | Name | Backend | Frontend | Status | Completion |
|-------|------|---------|----------|--------|------------|
| **0** | Foundation | ✅ | ✅ | **COMPLETE** | 100% |
| **1** | Financial Masters | ✅ | ⏳ | **90% COMPLETE** | 90% |
| **2** | Master Data | ✅ | ✅ | **COMPLETE** | 100% |
| **3.1** | Raw Materials | ✅ | ✅ | **COMPLETE** | 100% |
| **4.2** | Order Management | ✅ | ✅ | **COMPLETE** | 100% |
| **5.1** | Style Master | ✅ | ✅ | **COMPLETE** | 100% |
| **5.2** | Bill of Materials | ✅ | ✅ | **COMPLETE** | 100% |
| **5.X** | Cost Sheet/Costing | ✅ | ⏳ | **IN PROGRESS** | 60% |
| **1 (NEW)** | Documentation Consolidation | 📋 | N/A | **PLANNED** | 0% |
| **1.5** | Import/Export Infrastructure | 📋 | 📋 | **PLANNED** | 0% |
| **2** | Inventory & Warehouse | 📋 | 📋 | **PLANNED** | 0% |
| **3** | Production & Operations | 📋 | 📋 | **PLANNED** | 0% |
| **4** | Sales & Logistics | 📋 | 📋 | **PLANNED** | 0% |
| **5** | Quality Management | 📋 | 📋 | **PLANNED** | 0% |
| **6** | Human Resources | 📋 | 📋 | **PLANNED** | 0% |
| **7** | Purchase & Vendor Enhancement | 📋 | 📋 | **PLANNED** | 0% |
| **8** | PLM Product Development | 📋 | 📋 | **PLANNED** | 0% |
| **9** | Compliance & Documentation | 📋 | 📋 | **PLANNED** | 0% |
| **10** | Maintenance Management | 📋 | 📋 | **PLANNED** | 0% |
| **11** | Global Masters | 📋 | 📋 | **PLANNED** | 0% |

---

## 📝 PHASE DETAILS

---

## PHASE 0: Foundation ✅ **COMPLETED (100%)**

**Timeline:** Weeks 1-2 (Initial Setup)
**Status:** Production-ready foundation established

### ✅ Completed Deliverables

**Database Infrastructure:**
- ✅ PostgreSQL 17.6 local setup complete
- ✅ Prisma ORM integrated (48 tables, 25 enums)
- ✅ 6 migrations applied successfully
- ✅ Database configured to use local PostgreSQL for development

**Backend:**
- ✅ Node.js + Express + TypeScript setup
- ✅ JWT authentication system (bcrypt password hashing)
- ✅ User management with 8 role types
- ✅ CORS configuration for frontend
- ✅ Environment variable management (.env + .env.local)
- ✅ Health check endpoints
- ✅ Server running on http://localhost:5000

**Frontend:**
- ✅ React 19 + TypeScript + Vite
- ✅ Tailwind CSS + shadcn/ui components
- ✅ Zustand state management
- ✅ React Router Dom v7
- ✅ Axios API client
- ✅ Dashboard layout with navigation
- ✅ Server running on http://localhost:5173

**Security:**
- ✅ JWT token authentication (7-day expiry)
- ✅ Role-based access control
- ✅ Password hashing (bcrypt, 10 rounds)
- ✅ Input validation (Zod schemas)
- ✅ SQL injection prevention (Prisma ORM)

### Validation Checkpoint ✅ PASSED
- All servers start successfully
- Database connection uses local PostgreSQL
- Authentication system functional
- User can log in and access dashboard

---

## PHASE 1: Financial Masters ✅ **BACKEND COMPLETE (100%) | FRONTEND 90%**

**Timeline:** Week 3
**Status:** Backend production-ready, Frontend needs final polish

### ✅ Completed Deliverables

**Database Schema (8 Tables):**
1. ✅ **chart_of_accounts** - Hierarchical accounting structure (12 columns, 3 indexes)
2. ✅ **tax_masters** - GST/VAT/Customs with HSN codes (11 columns, 3 indexes)
3. ✅ **payment_terms** - Standardized payment schedules (10 columns, JSON support)
4. ✅ **currencies** - Multi-currency support with base currency (7 columns)
5. ✅ **exchange_rates** - Daily rates by currency and type (7 columns, unique constraints)
6. ✅ **cost_centers** - Budget tracking by department/location (11 columns)
7. ✅ **expense_types** - Expense categorization (10 columns)
8. ✅ **bank_accounts** - Multi-bank account management (14 columns, IFSC/SWIFT)

**Backend API (45+ Endpoints):**
- ✅ Chart of Accounts: 6 endpoints (CRUD + hierarchy + tree view)
- ✅ Tax Masters: 6 endpoints (CRUD + applicable taxes by date)
- ✅ Payment Terms: 5 endpoints (full CRUD)
- ✅ Currencies: 8 endpoints (CRUD + exchange rate management)
- ✅ Cost Centers: 5 endpoints (full CRUD)
- ✅ Expense Types: 5 endpoints (full CRUD)
- ✅ Bank Accounts: 5 endpoints (full CRUD)
- ✅ All routes registered in Express app
- ✅ Zero TypeScript compilation errors

**Features:**
- ✅ Pagination and filtering on all list endpoints
- ✅ Search functionality
- ✅ Soft delete pattern (isActive flag)
- ✅ Audit trail (createdAt, updatedAt, createdById)
- ✅ Authentication required on all endpoints
- ✅ Comprehensive error handling

**Frontend (90%):**
- ✅ Most master pages functional
- ⏳ Final UI polish needed
- ⏳ Chart of Accounts tree view enhancement

### Validation Checkpoint ✅ PASSED (Backend)
- All 45+ API endpoints functional
- Database schema deployed
- Indian GST compliance verified
- Zero compilation errors
- All CRUD operations tested

### ⏳ Pending Validation (Frontend)
- [ ] All master pages complete and polished
- [ ] Chart of Accounts tree view working
- [ ] User reviews and approves UI/UX

**Documentation:**
- ✅ [PHASE1_COMPLETE.md](../PHASE1_COMPLETE.md)
- ✅ [PHASE1_CONTROLLERS_COMPLETE.md](../PHASE1_CONTROLLERS_COMPLETE.md)

---

## PHASE 2: Master Data Management ✅ **COMPLETED (100%)**

**Timeline:** Week 4
**Status:** Fully functional and validated

### ✅ Completed Deliverables

**2.1 - User Management:**
- ✅ Full CRUD API at `/api/users`
- ✅ Frontend with search, pagination, activation
- ✅ 8 Role Types: ADMIN, PRODUCTION_MANAGER, SALES, INVENTORY, ACCOUNTS, QUALITY, PURCHASE, MERCHANDISER
- ✅ 16 department options
- ✅ Password management (reset functionality)

**2.2 - Customer Management:**
- ✅ Full CRUD API at `/api/customers`
- ✅ Dynamic Brand Names fields (JSON array)
- ✅ Dynamic Product Categories (Western/Ethnic/Uniforms)
- ✅ Auto-generated customer codes
- ✅ Customer categories: DOMESTIC/EXPORT/LOCAL
- ✅ Phone validation (max 10 digits)
- ✅ GST validation (exactly 15 characters)
- ✅ Search, filter, pagination

**2.3 - Supplier Management:**
- ✅ Full CRUD API at `/api/suppliers`
- ✅ **7 Distinct Supplier Categories** with category-specific fields:
  1. Fabric Supplier - Greige/Ready fabrics, width/GSM ranges
  2. Trims & Accessories - Buttons, zippers, threads
  3. Dyeing & Printing - Service types, techniques, capacity
  4. Embroidery - Types, machines, stitch counts
  5. Hand Work - Beading, sequins, stone work
  6. CMT Unit - Garment categories, machine counts
  7. Packaging - Items, printing services, RFID/barcode
- ✅ Category filtering in list view
- ✅ Dynamic category-specific form fields
- ✅ Auto-generated supplier codes
- ✅ Search, filter by category, pagination

### Validation Checkpoint ✅ PASSED
- All master data CRUD functional
- Supplier refactor with 7 types validated
- All relationships working correctly
- Frontend and backend integrated
- Zero errors in production

---

## PHASE 3.1: Raw Material Master ✅ **COMPLETED (100%)**

**Timeline:** Week 5
**Status:** Production-ready

### ✅ Completed Deliverables

**Material Management:**
- ✅ Material CRUD with 7 categories matching supplier types
- ✅ Category-specific fields (Fabric: Greige/Ready status)
- ✅ Dynamic field system (JSON metadata)
- ✅ Auto-generated material codes
- ✅ Optional supplier assignment
- ✅ Search and filter by category
- ✅ Full frontend UI

### Validation Checkpoint ✅ PASSED
- Material management fully functional
- Category-specific fields working
- Integration with suppliers verified

---

## PHASE 4.2: Order Management ✅ **COMPLETED (100%)**

**Timeline:** Week 6
**Status:** Production-ready

### ✅ Completed Deliverables

**Order System:**
- ✅ OrderForm with Color × Size matrix input
- ✅ OrderList with filtering and pagination
- ✅ Backend API fully functional
- ✅ Routes configured in App.tsx
- ✅ Integration with Style Master
- ✅ Order-Style relationship (Many-to-Many)
- ✅ Size breakdown tracking
- ✅ Order status workflow

### Validation Checkpoint ✅ PASSED
- Orders can be created from styles
- Color × Size matrix working correctly
- Order tracking functional
- Integration tested and working

---

## PHASE 5.1: Style Master ✅ **COMPLETED (100%)**

**Timeline:** Week 7
**Status:** Production-ready with production tracking

### ✅ Completed Deliverables

**Style Management:**
- ✅ StyleForm (Create/Edit - cleaned of order fields per ADR-001)
- ✅ StyleList (Browse with search & pagination)
- ✅ StyleDetail (View with "Create Order" button)
- ✅ Image Upload functionality
- ✅ Edit functionality
- ✅ 8 comprehensive sections:
  1. Basic Information (code, name, buyer, brand)
  2. Garment Components (multi-component styles)
  3. Fabric Details (with greige name and construction)
  4. Size Breakdown (3 input methods: ratio/percentage/absolute)
  5. Garment Trims (buttons, zippers, threads, labels, elastic)
  6. Value Additions (embroidery, handwork, printing, washing)
  7. Packaging (polybags, hangtags, price tags, cartons)
  8. Auto-save functionality

**Production Tracking Dashboard:**
- ✅ Real-time status for all styles
- ✅ Stage-wise tracking (12 production stages)
- ✅ Visual progress dashboard
- ✅ Bottleneck identification
- ✅ StyleDetail with production tab
- ✅ Stage update functionality
- ✅ Stage-wise piece tracking

### Validation Checkpoint ✅ PASSED
- Style-Order separation validated (ADR-001)
- Production tracking functional
- Multi-component styles working
- All 8 sections tested

---

## PHASE 5.2: Bill of Materials (BOM) ✅ **COMPLETED (100%)**

**Timeline:** Week 8
**Status:** Production-ready

### ✅ Completed Deliverables

**BOM System:**
- ✅ BOM CRUD API (9 endpoints)
- ✅ Version control (auto-incrementing versions per style)
- ✅ Approval workflow (created by user, approved by authorized user)
- ✅ Material requirement calculations with wastage
- ✅ BOMForm (Create/Edit materials for a style)
- ✅ BOMList (Browse all BOMs with filtering)
- ✅ Integration with Material Master
- ✅ Cost calculation per piece
- ✅ Zero TypeScript errors

**Business Logic:**
- ✅ BOM created AFTER Cost Sheet approval
- ✅ Material budget must not exceed Cost Sheet estimates

### Validation Checkpoint ✅ PASSED
- BOM creation functional
- Versioning system working
- Approval workflow validated
- Cost calculations accurate
- Integration with materials tested

---

## PHASE 5.X: Cost Sheet/Costing Module ⏳ **IN PROGRESS (60%)**

**Timeline:** Week 9
**Status:** Backend complete, Frontend in progress

### ✅ Completed Deliverables

**Database:**
- ✅ Comprehensive cost sheet structure
- ✅ Approval workflow fields (isApproved, approvedById, approvedAt)
- ✅ All cost component tables
- ✅ Migration applied

**Backend:**
- ✅ Full CRUD operations (7 controller functions)
- ✅ Cost calculation engine:
  - Materials cost (fabric, trims, accessories)
  - Processing cost (CMT, embroidery, printing, washing)
  - Labor cost
  - Overhead allocation
  - Value loss adjustment (2%)
  - Markup calculation (15%)
  - Final product cost
- ✅ Indian GST integration
- ✅ API endpoints functional

**Business Logic:**
- ✅ Cost Sheet must be approved BEFORE BOM creation
- ✅ Cost Sheet acts as approved budget
- ✅ CAD average consumption calculations

### ⏳ Remaining Work (40%)

**Frontend:**
- ⏳ CostSheetForm (needs validation and polish)
- ⏳ Cost sheet approval workflow UI
- ⏳ Cost comparison reports
- ⏳ Integration testing with BOM workflow

### Validation Checkpoint 🔄 PENDING
- [ ] Can create cost sheet from style
- [ ] All cost calculations accurate
- [ ] GST calculated correctly
- [ ] Approval workflow functional
- [ ] Frontend form complete and validated
- [ ] **USER APPROVAL REQUIRED**

**Documentation:**
- ✅ [Cost Sheet Implementation Docs](features/cost-sheet/)

---

## PHASE 1 (NEW): Documentation Consolidation 📋 **PLANNED (0%)**

**Timeline:** Days 1-2
**Status:** Ready to start (approved plan)

### 📋 Planned Deliverables

**1. Create MASTER_DEVELOPMENT_PLAN.md** (This File)
- Consolidate PROJECT_MASTER_GUIDE.md, PROJECT_STATUS.md, PHASE*.md
- Merge new phases (2-11) with existing phases
- Mark completed vs pending items clearly
- Add navigation index with clickable links
- Include backward compatibility checklist template
- Show validation checkpoints for each phase

**2. Update GLOSSARY.md**
- Add 100+ new terms from upcoming phases:
  - **Inventory Terms:** Storage Bins, Batch/Lot, UOM Conversion, Stock Adjustment, Reorder Level, Safety Stock
  - **Production Terms:** Production Line, Machine, Operation, Shift, Calendar, Work Order, Capacity Planning
  - **Sales/Logistics:** Incoterms, Freight Forwarder, Agent, Shipping Carrier, Sales Territory, Export Documentation
  - **Quality Terms:** Defect Codes, AQL Standards, Testing Parameters, Quality Checkpoint, Inspection Levels
  - **HR Terms:** Employee, Department, Designation, Shift Roster, Attendance, Leave Management
  - **PLM Terms:** Season, Collection, Tech Pack, Sample Types, Approval Workflow, Product Lifecycle
  - **Compliance:** Certification, Regulatory Requirements, Document Management, Audit Trail
  - **Maintenance:** Maintenance Types, Spare Parts, Breakdown Reasons, Preventive Maintenance, Downtime
  - **Global:** Color Master, Size Master, Sequence/Numbering, Measurement Charts
- Organize alphabetically with category tags
- Cross-reference related terms
- Total target: 180+ terms

**3. Create DEVELOPMENT_NAVIGATION.md**
- Index of all documentation files with descriptions
- Quick links to key sections
- "Where to find what" guide for developers
- File organization structure
- Documentation update procedures

### Deliverables
- ✅ MASTER_DEVELOPMENT_PLAN.md (this file - IN PROGRESS)
- Updated GLOSSARY.md (180+ terms)
- DEVELOPMENT_NAVIGATION.md

### Validation Checkpoint
- [ ] All phase plans consolidated in one place
- [ ] Completed items marked with ✅
- [ ] Pending items marked with ⏳ or 📋
- [ ] Navigation links work correctly
- [ ] Glossary has all current + future terms organized
- [ ] User reviews and approves documentation structure
- [ ] **USER APPROVAL REQUIRED**

---

## PHASE 1.5: Data Import/Export Infrastructure 📋 **PLANNED (0%)**

**Timeline:** Weeks 1-2
**Status:** Ready to start after Phase 1 documentation validation

### 📋 Planned Deliverables

**Backend Services:**

**1. Export Service** (`backend/src/services/export.service.ts`)
- CSV export with configurable columns
- Excel (.xlsx) export with formatting and styling
- PDF export with templated reports
- Handle large datasets (10,000+ records) with streaming
- Pagination support for exports
- Column mapping and transformation
- Date format standardization
- Number format localization (Indian: 1,00,000 vs International: 100,000)

**2. Import Service** (`backend/src/services/import.service.ts`)
- CSV/Excel parser with column mapping
- Bulk insert with transaction support (all or nothing)
- Row-by-row validation with detailed error reporting
- Preview before import functionality (first 100 rows)
- Handle foreign key relationships (lookup by code/name)
- Duplicate detection and handling
- Data transformation and normalization
- Import history tracking

**3. Template Management**
- Database table: `export_templates`
  - id, moduleName, templateName, columnConfig (JSON), isDefault, isActive, createdBy, createdAt, updatedAt
- Admin can create/edit/delete templates per module
- Dynamic column selection based on current database schema
- Column reordering via drag-drop
- Versioning support for template changes
- Default template per module
- Template sharing between users

**4. Export/Import Controllers & Routes**
- `/api/{module}/export?templateId=xyz&format=csv|excel|pdf&filters={...}`
- `/api/{module}/import` with multipart file upload
- `/api/{module}/import/preview` for validation before import (returns first 100 rows with validation errors)
- `/api/templates` (CRUD for export templates)
- `/api/templates/{moduleId}` (Get templates for specific module)

**Frontend Components:**

**5. ExportButton Component** (`frontend/src/components/ExportButton.tsx`)
- Dropdown menu with CSV/Excel/PDF options
- Template selector (dropdown of saved templates)
- Custom column selector (checkbox list)
- Filter preservation (current list filters applied to export)
- Loading state with progress indicator
- Auto-download when file ready
- Error handling with user-friendly messages

**6. ImportButton Component** (`frontend/src/components/ImportButton.tsx`)
- File upload (drag-drop + browse button)
- File type validation (CSV/XLSX only)
- File size validation (max 10MB)
- Preview grid showing first 100 rows
- Validation error display (inline in preview grid)
- Confirm/Cancel import workflow
- Progress indicator during import
- Success/failure summary (X records imported, Y failed)

**7. Template Manager UI** (`frontend/src/pages/TemplateManager.tsx`)
- Admin-only page (role-based access)
- Module selector dropdown
- Column configuration:
  - Available columns (from schema)
  - Selected columns (drag-drop to reorder)
  - Column renaming (display name vs database field)
  - Column format (date format, number format)
- Save template with name
- Set default template checkbox
- Template preview
- Edit/Delete existing templates

**8. Integration into ALL Existing Pages**
Add export/import buttons to list pages:
- Users
- Customers
- Suppliers
- Materials
- Styles
- Orders
- Chart of Accounts
- Tax Masters
- Payment Terms
- Currencies
- Cost Centers
- Expense Types
- Bank Accounts
- BOM
- Cost Sheets
- (All future module list pages)

**Backward Compatibility:**
- ✅ Existing pages work without any changes
- ✅ Export/Import buttons are additive features
- ✅ No breaking changes to existing APIs
- ✅ Templates are optional (default: export all columns)

### Deliverables
- Export service (CSV/Excel/PDF) with streaming support
- Import service (CSV/Excel) with validation and preview
- Template management system (database + backend + frontend)
- ExportButton and ImportButton reusable components
- Template Manager admin page
- Integration in all 15+ existing list pages
- Documentation for users on how to use import/export

### Validation Checkpoint
- [ ] Can export Chart of Accounts to CSV ✓
- [ ] Can export Suppliers to Excel with formatting ✓
- [ ] Can export Tax Masters to PDF ✓
- [ ] Can import 100 customers from CSV ✓
- [ ] Import validation catches errors (duplicate codes, invalid data) ✓
- [ ] Preview shows first 100 rows before import ✓
- [ ] Admin can create custom export template for any module ✓
- [ ] Template columns auto-update when database schema changes ✓
- [ ] Large dataset (5000+ records) exports successfully without timeout ✓
- [ ] All existing functionality still works (no regression) ✓
- [ ] User can select which columns to export ✓
- [ ] Import handles foreign key relationships correctly ✓
- [ ] **USER APPROVAL: System meets import/export requirements** ✓

---

## PHASE 2: Inventory & Warehouse Management 📋 **PLANNED (0%)**

**Timeline:** Weeks 3-4
**Status:** Defined, ready to start after Phase 1.5 validation

### 📋 Planned Deliverables

**New Masters (4):**

**1. Storage Bins/Racks Master**
- Warehouse location mapping
- Bin code (e.g., WH1-A-01-03 = Warehouse 1, Aisle A, Rack 01, Shelf 03)
- Bin capacity (weight/volume)
- Bin type (fabric/trims/finished goods)
- Bin status (empty/partial/full)
- Assignment to materials

**2. Stock Adjustment Reasons Master**
- Predefined adjustment categories:
  - Damage/Defect
  - Theft/Loss
  - Counting Error
  - Returns from Production
  - Sample Usage
  - Expired Materials
- Auto-populated in adjustment transactions

**3. Batch/Lot Master**
- Batch number (supplier lot number)
- Receipt date
- Expiry date (for perishable items)
- Batch quality status
- Batch-wise stock tracking
- FIFO/LIFO/FEFO support

**4. UOM Conversion Master**
- Unit conversions (meters to yards, kg to lbs, pieces to dozens)
- Material-specific conversions (fabric: meters to kg based on GSM)
- Auto-calculation in transactions

**Database Changes:**
- 4 new tables (storage_bins, stock_adjustment_reasons, batches, uom_conversions)
- Update `inventory_stock` table:
  - Add `binId` (foreign key)
  - Add `batchId` (foreign key)
  - Add `uomId` (unit of measure)
- Add UOM conversion logic in stock transactions

**Backend (4 Controllers):**
- StorageBins controller (CRUD + capacity tracking)
- StockAdjustmentReasons controller (CRUD)
- Batches controller (CRUD + batch tracking)
- UOMConversions controller (CRUD + conversion calculation)
- Update StockTransactions controller for new fields

**Frontend:**
- Warehouse layout visualization (grid view of bins)
- Bin management interface (assign/unassign materials)
- Batch tracking in inventory screens
- UOM conversion calculator
- Stock adjustment transaction form

**Export/Import:**
- ✅ Already available from Phase 1.5 (CSV/Excel/PDF)

**Backward Compatibility:**
- ✅ Existing inventory tables remain unchanged
- ✅ New fields are nullable initially
- ✅ Gradual migration of existing stock to bins/batches
- ✅ Old inventory queries continue to work

### Validation Checkpoint
- [ ] Can create storage bins/racks with hierarchy ✓
- [ ] Can assign inventory to specific bins ✓
- [ ] Batch/lot tracking works for materials ✓
- [ ] UOM conversions calculate correctly (meters ↔ kg for fabric) ✓
- [ ] Stock adjustment reasons auto-populate ✓
- [ ] Can export/import all new masters ✓
- [ ] Existing inventory features still work ✓
- [ ] Warehouse layout visualization is user-friendly ✓
- [ ] **USER APPROVAL: Warehouse module meets requirements** ✓

---

## PHASE 3: Production & Operations 📋 **PLANNED (0%)**

**Timeline:** Weeks 5-6
**Status:** Defined

### 📋 Planned Deliverables

**New Masters (5):**

**1. Production Line/Floor Master**
- Line code and name
- Floor location
- Number of machines
- Capacity (pieces per day)
- Line specialization (stitching/finishing/packing)
- Active/inactive status

**2. Machine/Equipment Master**
- Machine code and name
- Machine type (sewing/cutting/ironing/packing)
- Make and model
- Purchase date and warranty
- Assigned to production line
- Maintenance schedule
- Current status (operational/under maintenance/breakdown)

**3. Operation Master**
- Operation code and name
- Operation category (cutting/stitching/finishing)
- Standard time (SAM - Standard Allowed Minutes)
- Skill level required
- Machine type required

**4. Calendar Master (Working Days/Holidays)**
- Year and month
- Working days configuration
- Public holidays (national/state/company-specific)
- Weekend definition (Saturday/Sunday or custom)
- Shift working days
- Capacity calculation base

**5. Shift Master**
- Shift code and name
- Start time and end time
- Break times
- Shift type (day/night/general)
- Applicable days (weekdays/weekends/all)
- Number of workers per shift

**Database Changes:**
- 5 new tables
- Update `work_orders` table:
  - Add `productionLineId`
  - Add `shiftId`
  - Add `assignedMachineIds` (JSON array)
- Update `production_tracking` table:
  - Add `operationId`
  - Add `standardTime`
  - Add `actualTime`
- Add capacity calculation logic

**Backend (5 Controllers):**
- ProductionLines controller
- Machines controller (with maintenance tracking)
- Operations controller
- Calendar controller
- Shifts controller
- Production scheduling algorithms:
  - Calculate line capacity
  - Assign work orders to lines
  - Balance workload across shifts
  - Optimize machine utilization

**Frontend:**
- Production floor management interface (visual floor map)
- Machine assignment screens (drag-drop work orders to machines)
- Calendar management (mark holidays, configure working days)
- Capacity planning dashboard:
  - Line utilization chart
  - Machine efficiency graph
  - Shift productivity comparison
  - Bottleneck identification

**Export/Import:**
- ✅ Already available from Phase 1.5

**Backward Compatibility:**
- ✅ Existing work_orders continue to work
- ✅ New fields are optional initially
- ✅ Gradual assignment of production lines

### Validation Checkpoint
- [ ] Production lines and machines created and assigned ✓
- [ ] Operations defined with standard times ✓
- [ ] Calendar with holidays working correctly ✓
- [ ] Shift scheduling functional ✓
- [ ] Capacity planning calculations accurate ✓
- [ ] Work orders can be assigned to lines/machines ✓
- [ ] Existing production features still work ✓
- [ ] Visual production floor map is intuitive ✓
- [ ] **USER APPROVAL: Production module meets requirements** ✓

---

## PHASE 4: Sales & Logistics 📋 **PLANNED (0%)**

**Timeline:** Weeks 7-8
**Status:** Defined

### 📋 Planned Deliverables

**New Masters (6):**

**1. Shipping Carrier Master**
- Carrier name (DHL, FedEx, BlueDart, etc.)
- Carrier type (air/sea/road/courier)
- Contact details
- Rate cards (JSON - weight slabs)
- Service types (express/standard/economy)
- Tracking URL template

**2. Incoterms Master**
- Term code (FOB, CIF, EXW, DDP, etc.)
- Term name and description
- Responsibility matrix (seller vs buyer)
- Cost allocation rules
- Insurance requirements

**3. Agent/Broker Master**
- Agent code and name
- Agent type (buying agent/commission agent/broker)
- Commission structure (flat/percentage/tiered)
- Associated customers
- Contact details
- Performance metrics

**4. Freight Forwarder Master**
- Company name
- Service types (air/sea/multimodal)
- Routes covered
- Rate cards
- Documentation handling
- Contact details

**5. Sales Territory Master**
- Territory code and name
- Geographic coverage (states/countries)
- Assigned sales personnel
- Target revenue
- Customer list

**6. Country Master**
- Country code (ISO 3166)
- Country name
- Currency
- Time zone
- Export documentation requirements
- Compliance requirements

**Database Changes:**
- 6 new tables
- Update `orders` table:
  - Add `shippingCarrierId`
  - Add `incoterm`
  - Add `agentId`
  - Add `freightForwarderId`
  - Add `salesTerritoryId`
  - Add `destinationCountryId`
- Update `delivery_notes` table:
  - Add export documentation fields (invoice, packing list, bill of lading, etc.)
  - Add `awbNumber` (Air Waybill)
  - Add `blNumber` (Bill of Lading)

**Backend (6 Controllers):**
- ShippingCarriers controller
- Incoterms controller
- Agents controller (with commission calculation logic)
- FreightForwarders controller
- SalesTerritories controller
- Countries controller
- Shipping integration logic (tracking API integrations)

**Frontend:**
- Shipping management interface (assign carriers, generate AWB/BL)
- Agent/broker management (commission reports)
- Export documentation screens (auto-generate export docs)
- Territory-based sales analytics (revenue by territory, target vs actual)
- Freight forwarder comparison (rate comparison tool)

**Export/Import:**
- ✅ Already available from Phase 1.5

**Backward Compatibility:**
- ✅ Existing orders work without shipping details
- ✅ New fields are optional
- ✅ Gradual adoption for export orders

### Validation Checkpoint
- [ ] Shipping carriers configured with rate cards ✓
- [ ] Incoterms assigned to orders correctly ✓
- [ ] Agent commission calculated accurately ✓
- [ ] Freight forwarders assigned to shipments ✓
- [ ] Sales territories created and assigned ✓
- [ ] Country master populated with export requirements ✓
- [ ] Export documentation auto-generated correctly ✓
- [ ] Shipping tracking functional ✓
- [ ] Existing order management still works ✓
- [ ] **USER APPROVAL: Sales & Logistics module meets requirements** ✓

---

## PHASE 5: Quality Management 📋 **PLANNED (0%)**

**Timeline:** Week 9
**Status:** Defined

### 📋 Planned Deliverables

**New Masters (4):**

**1. Defect Codes Master**
- Defect code (unique identifier)
- Defect name and description
- Defect category (critical/major/minor)
- Defect type (measurement/stitching/fabric/finishing)
- Severity level
- Corrective action suggestions

**2. AQL Standards Master**
- AQL level (1.0, 1.5, 2.5, 4.0, etc.)
- Inspection level (I, II, III)
- Lot size ranges
- Sample size table
- Acceptance/rejection criteria
- Critical/major/minor defect limits

**3. Testing Parameter Master**
- Parameter code and name
- Parameter category (fabric/garment/wash/color fastness)
- Testing method (ASTM/ISO/AATCC standards)
- Acceptance criteria (min/max values)
- Testing equipment required
- Testing cost

**4. Quality Checkpoint Master**
- Checkpoint code and name
- Checkpoint stage (raw material/in-process/final)
- Inspection frequency (100%/sampling/random)
- Mandatory/optional flag
- Associated testing parameters
- Checklist items

**Database Changes:**
- 4 new tables
- Update `quality_inspections` table:
  - Add `aqlStandardId`
  - Add `checkpointId`
  - Add `sampleSize`
  - Add `acceptableDefects`
- Update `quality_defects` table:
  - Add `defectCodeId`
  - Add `severity`
  - Add `correctiveAction`
- Add AQL calculation logic

**Backend (4 Controllers):**
- DefectCodes controller
- AQLStandards controller (with AQL sampling calculation logic)
- TestingParameters controller
- QualityCheckpoints controller
- Defect analysis reports (Pareto charts, defect trends)

**Frontend:**
- Defect code selection interface (quick search/dropdown)
- AQL inspection screens (auto-calculate sample size, show acceptance criteria)
- Quality checkpoint management (configure checkpoints for each stage)
- Quality analytics dashboard:
  - Defect rate trends
  - Top 10 defects (Pareto chart)
  - Supplier quality comparison
  - Style-wise defect analysis
  - Pass/fail rates

**Export/Import:**
- ✅ Already available from Phase 1.5

**Backward Compatibility:**
- ✅ Existing quality_inspections work as-is
- ✅ New defect coding is optional
- ✅ Gradual migration to AQL-based inspections

### Validation Checkpoint
- [ ] Defect codes created and categorized ✓
- [ ] AQL standards configured with sampling tables ✓
- [ ] AQL sample size auto-calculated correctly ✓
- [ ] Testing parameters defined with acceptance criteria ✓
- [ ] Quality checkpoints configured for each stage ✓
- [ ] Defect recording uses defect codes ✓
- [ ] Quality analytics dashboard shows trends ✓
- [ ] Existing quality features still work ✓
- [ ] **USER APPROVAL: Quality module meets requirements** ✓

---

## PHASE 6: Human Resources & Department Management 📋 **PLANNED (0%)**

**Timeline:** Week 10
**Status:** Defined

### 📋 Planned Deliverables

**New Masters (4):**

**1. Employee Master**
- Employee code (unique identifier)
- Full name, DOB, gender
- Contact details
- Department and designation
- Joining date, leaving date
- Employment type (permanent/contract/temporary)
- Salary details (optional - if not using separate payroll)
- Reporting manager
- Skills and certifications
- Link to `users` table (for system access)

**2. Department Master**
- Department code and name
- Department type (production/sales/accounts/quality/purchase/hr/admin)
- Department head (employeeId)
- Parent department (for hierarchy)
- Number of employees
- Budget allocation
- Location

**3. Designation Master**
- Designation code and name
- Designation level (entry/junior/senior/manager/director)
- Department applicability
- Salary range
- Reporting hierarchy

**4. Shift Roster Master**
- Roster template name
- Shift pattern (5-day/6-day/rotating)
- Weekly off configuration
- Shift assignments (employeeId → shiftId → dates)
- Roster effective dates

**Database Changes:**
- 4 new tables
- Link `employees` to `users` table (one-to-one relationship)
- Department hierarchy structure (self-referential)
- Add `employeeId` to transactions (created_by, approved_by, etc.)

**Backend (4 Controllers):**
- Employees controller (CRUD + organizational chart generation)
- Departments controller (hierarchy management)
- Designations controller
- ShiftRosters controller
- Attendance tracking logic (if needed - optional based on user requirements)
- Department-wise reporting (headcount, productivity)

**Frontend:**
- Employee management interface (list, form, profile page)
- Organization chart visualization (hierarchical tree view)
- Department structure editor (drag-drop hierarchy)
- Shift roster management (calendar view, assign employees to shifts)
- Employee directory with search and filters
- Attendance tracker (optional - if required)

**Export/Import:**
- ✅ Already available from Phase 1.5

**Backward Compatibility:**
- ✅ Existing `users` table continues to work
- ✅ Employees are optional (user can exist without employee record)
- ✅ Gradual migration: link existing users to employee records

### Validation Checkpoint
- [ ] Employees created and linked to users ✓
- [ ] Departments created with hierarchy ✓
- [ ] Designations defined with levels ✓
- [ ] Shift rosters created and assigned to employees ✓
- [ ] Organization chart displays correctly ✓
- [ ] Employee directory functional with search ✓
- [ ] Department-wise reports accurate ✓
- [ ] Existing user management still works ✓
- [ ] **USER APPROVAL: HR module meets requirements** ✓

---

## PHASE 7: Purchase & Vendor Management Enhancement 📋 **PLANNED (0%)**

**Timeline:** Week 11
**Status:** Defined

### 📋 Planned Deliverables

**New Masters (4):**

**1. Purchase Order Types Master**
- PO type code and name
- Type category (raw material/service/capital equipment)
- Approval workflow (auto-approve under X amount, multi-level above)
- Payment terms applicability
- Delivery terms
- Quality inspection required (yes/no)

**2. Vendor Evaluation Criteria Master**
- Criteria code and name
- Criteria category (quality/delivery/pricing/communication/documentation)
- Weight percentage (total 100%)
- Scoring method (1-5 scale, percentage, pass/fail)
- Target score

**3. Terms and Conditions Templates Master**
- Template code and name
- Template type (purchase/sales/service agreement)
- Standard T&C clauses (JSON array)
- Applicable to (material/service/customer/supplier)
- Version control

**4. Purchase Requisition Types Master**
- PR type code and name
- PR category (production/maintenance/office supplies/capex)
- Approval levels required
- Auto-convert to PO (yes/no)
- Budget validation required

**Database Changes:**
- 4 new tables
- Update `purchase_orders` table:
  - Add `poTypeId`
  - Add `tcTemplateId`
  - Add approval workflow fields (approval level, approval status, approvers)
- Create `vendor_evaluations` table (score vendors periodically)
- Create `purchase_requisitions` table (PR → PO workflow)

**Backend (4 Controllers):**
- POTypes controller
- VendorEvaluationCriteria controller (with scoring logic)
- TCTemplates controller
- PRTypes controller
- Vendor evaluation scoring logic (auto-calculate scores based on PO performance)
- PO approval workflow engine

**Frontend:**
- Vendor evaluation screens (periodic scoring, trend charts)
- T&C template management (editor with clause library)
- Enhanced PO creation with templates (select T&C template, auto-populate)
- PR to PO conversion workflow
- Approval workflow tracking (pending approvals, approval history)

**Export/Import:**
- ✅ Already available from Phase 1.5

**Backward Compatibility:**
- ✅ Existing purchase_orders work without PO types
- ✅ New fields are optional
- ✅ T&C can be added to existing POs

### Validation Checkpoint
- [ ] PO types configured with approval rules ✓
- [ ] Vendor evaluation criteria defined ✓
- [ ] Vendors scored based on performance ✓
- [ ] T&C templates created and applied to POs ✓
- [ ] Purchase requisitions created and converted to POs ✓
- [ ] Approval workflow functional (multi-level approvals) ✓
- [ ] Vendor evaluation reports accurate ✓
- [ ] Existing purchase management still works ✓
- [ ] **USER APPROVAL: Purchase enhancement meets requirements** ✓

---

## PHASE 8: PLM Product Development 📋 **PLANNED (0%)**

**Timeline:** Week 12
**Status:** Defined

### 📋 Planned Deliverables

**New Masters (4):**

**1. Season/Collection Master**
- Season code and name
- Season year (e.g., Spring/Summer 2026)
- Collection theme
- Start date and end date
- Target launch date
- Number of styles planned
- Status (planning/in-development/launched/archived)

**2. Approval Workflow Master**
- Workflow code and name
- Workflow type (style approval/sample approval/cost sheet approval/BOM approval)
- Approval levels (L1: Merchandiser, L2: Manager, L3: Director)
- Approver roles
- Escalation rules (if not approved in X days)
- Notification settings

**3. Tech Pack Template Master**
- Template code and name
- Garment category (tops/bottoms/dresses/etc.)
- Standard sections (measurement chart, construction details, stitch types, etc.)
- Custom fields configuration
- File attachments (PDF/images)

**4. Sample Types Master** (Convert existing enum to table)
- Sample type code and name
- Sample category (development/sales/approval/production)
- Purpose description
- Approval required (yes/no)
- Cost tracking (billable/non-billable to customer)

**Database Changes:**
- 4 new tables
- Update `styles` table:
  - Add `seasonId`
  - Add `collectionId`
  - Add workflow tracking fields
- Update `samples` table:
  - Replace enum with `sampleTypeId` (foreign key)
  - Add workflow status
- Create `approvals` table (generic approval tracking)
- Add tech pack storage (file paths or JSON)

**Backend (4 Controllers):**
- Seasons controller (CRUD + season-based analytics)
- ApprovalWorkflows controller (workflow engine)
- TechPackTemplates controller
- SampleTypes controller
- Workflow engine for approvals (auto-routing to next approver, notifications)
- Season-based filtering across styles, samples, orders

**Frontend:**
- Season/collection management (create seasons, assign styles)
- Approval workflow screens (pending approvals, approve/reject interface)
- Tech pack builder interface (drag-drop sections, upload files)
- Enhanced sample management (link samples to workflow, track status)
- Season-based dashboard (styles by season, collection progress)

**Export/Import:**
- ✅ Already available from Phase 1.5

**Backward Compatibility:**
- ✅ Existing styles work without season assignment
- ✅ Existing samples work (migrate enum to table references)
- ✅ Approvals are optional initially

### Validation Checkpoint
- [ ] Seasons/collections created and assigned to styles ✓
- [ ] Approval workflows configured for each approval type ✓
- [ ] Tech pack templates created with standard sections ✓
- [ ] Sample types migrated from enum to table ✓
- [ ] Approval workflow engine routes correctly ✓
- [ ] Tech pack builder functional ✓
- [ ] Season-based filtering works across modules ✓
- [ ] Existing style/sample features still work ✓
- [ ] **USER APPROVAL: PLM module meets requirements** ✓

---

## PHASE 9: Compliance & Documentation 📋 **PLANNED (0%)**

**Timeline:** Week 13
**Status:** Defined

### 📋 Planned Deliverables

**New Masters (3):**

**1. Certification Master**
- Certification code and name
- Certification type (material/supplier/product/facility)
- Issuing authority
- Certification standard (GOTS, Oeko-Tex, ISO, etc.)
- Issue date and expiry date
- Document attachments
- Applicable to (materials, suppliers, styles)

**2. Document Type Master**
- Document type code and name
- Document category (compliance/quality/legal/export/contract)
- Retention period (years)
- Mandatory/optional flag
- Access control level (public/internal/confidential)

**3. Regulatory Requirement Master**
- Requirement code and name
- Country/region applicability
- Requirement category (labeling/testing/documentation)
- Compliance deadline
- Authority reference
- Penalty for non-compliance

**Database Changes:**
- 3 new tables
- Add certification tracking to:
  - `materials` table (add `certifications` JSON field)
  - `styles` table (add `certifications` JSON field)
  - `suppliers` table (add `certifications` JSON field)
- Create `documents` table:
  - Document type, entity type, entity ID
  - File path/URL
  - Upload date, uploaded by
  - Version control
- Create `compliance_checklist` table:
  - Link orders to regulatory requirements
  - Checklist status (pending/complete)

**Backend (3 Controllers):**
- Certifications controller (CRUD + expiry alerts)
- DocumentTypes controller
- RegulatoryRequirements controller
- Certification expiry alerts (cron job to send notifications)
- Compliance checking logic (validate order against requirements)
- Document management (upload, version control, access control)

**Frontend:**
- Certification management screens (add certs to materials/suppliers/styles)
- Document repository interface (upload, categorize, search documents)
- Compliance dashboard:
  - Expiring certifications (30/60/90 days)
  - Missing certifications
  - Compliance status by order
  - Regulatory requirements checklist
- Document viewer with version history

**Export/Import:**
- ✅ Already available from Phase 1.5

**Backward Compatibility:**
- ✅ Existing entities work without certifications
- ✅ Document storage is optional
- ✅ Gradual addition of certifications

### Validation Checkpoint
- [ ] Certifications created and assigned to materials/suppliers/styles ✓
- [ ] Certification expiry alerts working ✓
- [ ] Document types configured ✓
- [ ] Documents uploaded and categorized correctly ✓
- [ ] Regulatory requirements defined by country ✓
- [ ] Compliance checklist functional for orders ✓
- [ ] Compliance dashboard shows expiring certs ✓
- [ ] Document repository is searchable ✓
- [ ] Existing features still work ✓
- [ ] **USER APPROVAL: Compliance module meets requirements** ✓

---

## PHASE 10: Maintenance Management 📋 **PLANNED (0%)**

**Timeline:** Week 14
**Status:** Defined

### 📋 Planned Deliverables

**New Masters (3):**

**1. Maintenance Type Master**
- Maintenance type code and name
- Type category (preventive/corrective/breakdown/calibration)
- Frequency (daily/weekly/monthly/quarterly/annual)
- Duration (hours)
- Cost estimation

**2. Spare Parts Catalog**
- Part code and name
- Part category (electrical/mechanical/consumable)
- Compatible machines (machineId references)
- Supplier
- Current stock level
- Reorder level
- Unit price

**3. Breakdown Reason Codes Master**
- Reason code and name
- Reason category (electrical/mechanical/operator error/material issue)
- Severity (low/medium/high)
- Typical resolution time
- Preventive measures

**Database Changes:**
- 3 new tables
- Create `maintenance_logs` transaction table:
  - machineId (foreign key to machines master)
  - maintenanceTypeId
  - scheduledDate vs actualDate
  - Duration
  - Cost
  - Spare parts used (JSON array)
  - Technician (employeeId)
  - Status (scheduled/in-progress/complete)
- Update `machines` table:
  - Add `lastMaintenanceDate`
  - Add `nextMaintenanceDate`
  - Add `totalDowntimeHours`

**Backend (3 Controllers):**
- MaintenanceTypes controller
- SpareParts controller (inventory management for spare parts)
- BreakdownReasons controller
- MaintenanceLogs controller (schedule, record, track maintenance)
- Preventive maintenance scheduler (auto-generate maintenance tasks)
- Downtime analysis (calculate machine efficiency, MTBF, MTTR)

**Frontend:**
- Maintenance scheduling interface (calendar view of scheduled maintenance)
- Maintenance log entry form (record maintenance activities)
- Spare parts inventory management (stock levels, usage tracking)
- Downtime analytics dashboard:
  - Machine downtime hours by month
  - MTBF (Mean Time Between Failures)
  - MTTR (Mean Time To Repair)
  - Top breakdown reasons (Pareto chart)
  - Maintenance cost analysis
- Preventive maintenance alerts (due/overdue tasks)

**Export/Import:**
- ✅ Already available from Phase 1.5

**Backward Compatibility:**
- ✅ Existing machines master works without maintenance
- ✅ Maintenance is optional initially
- ✅ Gradual adoption of maintenance tracking

### Validation Checkpoint
- [ ] Maintenance types configured with frequencies ✓
- [ ] Spare parts catalog created with stock levels ✓
- [ ] Breakdown reason codes defined ✓
- [ ] Preventive maintenance tasks auto-scheduled ✓
- [ ] Maintenance logs recorded with spare parts usage ✓
- [ ] Downtime analytics accurate (MTBF, MTTR) ✓
- [ ] Maintenance alerts triggered correctly ✓
- [ ] Spare parts inventory tracked ✓
- [ ] Existing machine management still works ✓
- [ ] **USER APPROVAL: Maintenance module meets requirements** ✓

---

## PHASE 11: Global/Cross-Module Masters 📋 **PLANNED (0%)**

**Timeline:** Week 15
**Status:** Defined

### 📋 Planned Deliverables

**New Masters (3):**

**1. Color Master** (Global Standardized)
- Color code (unique global identifier)
- Color name (standard name + customer-specific names)
- Color family (red/blue/green/yellow/neutral)
- Pantone code (if applicable)
- RGB and HEX values
- Color swatch image
- Replace existing `color_options` scattered across modules

**2. Size Master** (Global Standardized)
- Size code (unique global identifier)
- Size name (S/M/L/XL or 28/30/32 or 6/8/10)
- Size system (US/UK/EU/Free Size)
- Size category (infant/kids/adults)
- Measurement chart reference
- Replace existing `size_options` scattered across modules

**3. Sequence/Numbering Master**
- Entity type (style/order/invoice/PO/GRN/etc.)
- Prefix (e.g., "STY-", "ORD-", "INV-")
- Separator (e.g., "-", "/")
- Number format (5 digits, 6 digits, etc.)
- Include year (yes/no)
- Include month (yes/no)
- Next number
- Reset frequency (never/yearly/monthly)
- Examples: STY-2026-00001, ORD/2026/JAN/0001

**Database Changes:**
- 3 new tables
- Migrate existing `color_options` and `size_options` to global masters:
  - Create migration script to consolidate scattered color/size data
  - Update all tables using color/size to reference global masters
  - Support dual mode during migration (old enum + new foreign key)
- Implement auto-numbering configuration:
  - Replace hardcoded code generation with configurable sequences
  - Add `sequence_id` to entities using auto-generated codes

**Backend (3 Controllers):**
- Colors controller (CRUD + color family filtering)
- Sizes controller (CRUD + size system filtering)
- Sequences controller (CRUD + sequence generation service)
- Sequence generation service:
  - Generate next number based on configuration
  - Handle concurrent requests (database locks)
  - Reset sequence on schedule (yearly/monthly)
- Color/size standardization logic:
  - Merge duplicate colors/sizes during migration
  - Provide mapping interface for users to consolidate

**Frontend:**
- Global color management (create, edit, merge colors)
- Global size management (create size charts, size systems)
- Numbering sequence configuration (admin page to configure all auto-numbers)
- Measurement chart builder (define size charts with measurements)
- Migration tools:
  - Color mapping interface (map old colors to new global colors)
  - Size mapping interface (map old sizes to new global sizes)
  - Preview impact before migration

**Export/Import:**
- ✅ Already available from Phase 1.5

**Backward Compatibility:**
- ✅ Dual support period (2-4 weeks):
  - Old color/size enums continue to work
  - New global masters also available
  - Users can map old to new gradually
- ✅ Auto-migration script with user review:
  - Suggest color/size mappings
  - User approves before applying
- ✅ Rollback capability if issues arise

**Migration Strategy:**
1. **Week 1:** Deploy global masters alongside existing enums
2. **Week 2:** Provide mapping UI, allow users to map gradually
3. **Week 3:** Monitor usage, ensure data integrity
4. **Week 4:** Complete migration, deprecate old enums (keep in DB for reference)

### Validation Checkpoint
- [ ] Global color master created with Pantone codes ✓
- [ ] Global size master created with measurement charts ✓
- [ ] Sequence/numbering master configured for all entities ✓
- [ ] Auto-numbering generates codes correctly (concurrent safe) ✓
- [ ] Existing color_options migrated to global colors ✓
- [ ] Existing size_options migrated to global sizes ✓
- [ ] All modules use global color/size references ✓
- [ ] No data loss during migration ✓
- [ ] Existing features still work during dual-support period ✓
- [ ] Users approve migration mappings ✓
- [ ] **USER APPROVAL: Global masters meet requirements** ✓

---

## 🔒 BACKWARD COMPATIBILITY STRATEGY

**Objective:** Ensure zero breaking changes when adding new phases

### Before Each Phase

**1. Document Existing Functionality**
- List all features that must continue working
- Identify dependencies and integrations
- Create regression test checklist

**2. Plan Database Migrations**
- **ADD ONLY, NEVER DROP** columns or tables
- Make new fields nullable initially
- Add foreign keys with ON DELETE SET NULL (not CASCADE)
- Create indexes for new fields

**3. Feature Flags (Optional)**
- Use environment variables to enable/disable new features
- Allow gradual rollout
- Easy rollback if issues detected

### During Each Phase

**1. Dual Support Period**
- Old and new approaches work simultaneously
- Example: Phase 11 - both enum colors and global color master work for 2-4 weeks
- Users migrate gradually without pressure

**2. Additive Changes Only**
- New tables, not modifications to existing tables
- New API endpoints, not changes to existing endpoints
- New UI components, not replacements

**3. Automated Testing**
- Run existing test suite after each change
- Verify all existing APIs return 200 OK
- Check all existing pages render without errors

### After Each Phase

**1. Backward Compatibility Checklist**
```markdown
- [ ] All existing APIs return expected responses ✓
- [ ] All existing frontend pages render correctly ✓
- [ ] No broken foreign key relationships ✓
- [ ] All existing data is accessible ✓
- [ ] Existing workflows still function ✓
- [ ] No performance degradation ✓
```

**2. Regression Testing**
- Test critical user flows (login, create order, create style, etc.)
- Verify data integrity (counts match, no duplicates)
- Check for console errors in frontend

**3. User Validation Session**
- User tests existing features
- User tests new features
- User approves before next phase

**4. Rollback Plan**
```markdown
If issues detected:
1. Disable new features via feature flags
2. Revert database migration (if safe)
3. Redeploy previous version of code
4. Analyze and fix issues
5. Re-deploy when ready
```

### Migration Scripts

**Template for Safe Migrations:**
```sql
-- Add new column (nullable initially)
ALTER TABLE existing_table
ADD COLUMN new_field_id UUID NULL;

-- Add foreign key (with SET NULL on delete)
ALTER TABLE existing_table
ADD CONSTRAINT fk_new_field
FOREIGN KEY (new_field_id)
REFERENCES new_table(id)
ON DELETE SET NULL;

-- Gradual data migration (run in batches)
-- DO NOT migrate all at once
UPDATE existing_table
SET new_field_id = (SELECT id FROM new_table WHERE ...)
WHERE id IN (SELECT id FROM existing_table LIMIT 100);
```

### Phase-Specific Backward Compatibility Notes

**Phase 1.5 (Import/Export):**
- ✅ Export/Import buttons are additive (no changes to existing pages)
- ✅ Templates are optional (works without templates)
- ✅ No breaking API changes

**Phase 2 (Inventory):**
- ✅ Bin assignment is optional (stock works without bins)
- ✅ Batch tracking is optional (stock works without batches)
- ✅ Existing inventory_stock table unchanged (new fields added as nullable)

**Phase 11 (Global Masters):**
- ✅ Dual support: enums + global masters work together
- ✅ 2-4 week migration period
- ✅ User-controlled mapping (no forced migration)

---

## 🛠️ TECHNOLOGY STACK

### Frontend
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **UI Library:** Tailwind CSS + shadcn/ui components
- **State Management:** Zustand
- **Forms:** React Hook Form + Zod validation
- **Routing:** React Router Dom v7
- **API Client:** Axios
- **Dev Server:** http://localhost:5173

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js + TypeScript
- **Database ORM:** Prisma
- **Authentication:** JWT + bcrypt
- **Validation:** Zod
- **Dev Server:** http://localhost:5000

### Database
- **Development:** PostgreSQL 17.6 (Local)
- **Production:** Cloud-hosted PostgreSQL (to be configured)
- **Database Name:** garment_erp
- **Tables:** 48 (will grow to 70+ after all phases)
- **Migrations:** Managed by Prisma

### Deployment (Future)
- **Frontend:** Static hosting with CDN (Vercel, Netlify, etc.)
- **Backend:** Cloud hosting with PostgreSQL support
- **Estimated Cost:** ₹500-2,000/month (varies by provider)

---

## 📊 SUCCESS METRICS

### Immediate (3 months) - Phases 0-6
- ✅ Real-time production status visible for all styles
- ✅ Inventory accuracy >95%
- ✅ Order tracking time: hours → seconds
- ✅ Eliminate manual production registers
- ✅ Cost Sheet → BOM workflow functional
- ✅ CSV/Excel import/export on all modules

### Mid-term (6 months) - Phases 7-11
- ✅ 10+ users actively using system
- ✅ Multi-location coordination seamless
- ✅ Reports generated automatically
- ✅ Customer query response <5 minutes
- ✅ Compliance tracking automated
- ✅ Preventive maintenance scheduled

### Long-term (12 months) - Production Optimization
- ✅ Data-driven production planning
- ✅ Wastage reduction through better tracking
- ✅ On-time delivery >90%
- ✅ Capacity utilization optimized
- ✅ Export documentation automated
- ✅ Zero manual data entry for imports

---

## 📅 TIMELINE SUMMARY

| Week | Phase | Deliverables | Validation |
|------|-------|--------------|------------|
| **1-2** | Phase 0 | Foundation setup | ✅ Complete |
| **3** | Phase 1 | Financial Masters (Backend) | ✅ Complete |
| **4** | Phase 2 | Master Data Management | ✅ Complete |
| **5** | Phase 3.1 | Raw Materials | ✅ Complete |
| **6** | Phase 4.2 | Order Management | ✅ Complete |
| **7** | Phase 5.1 | Style Master | ✅ Complete |
| **8** | Phase 5.2 | BOM | ✅ Complete |
| **9** | Phase 5.X | Cost Sheet | ⏳ In Progress (60%) |
| **9.5** | Phase 1 (NEW) | Documentation | 📋 Planned (This file) |
| **10-11** | Phase 1.5 | Import/Export Infrastructure | 📋 Planned |
| **12-13** | Phase 2 | Inventory & Warehouse | 📋 Planned |
| **14-15** | Phase 3 | Production & Operations | 📋 Planned |
| **16-17** | Phase 4 | Sales & Logistics | 📋 Planned |
| **18** | Phase 5 | Quality Management | 📋 Planned |
| **19** | Phase 6 | Human Resources | 📋 Planned |
| **20** | Phase 7 | Purchase Enhancement | 📋 Planned |
| **21** | Phase 8 | PLM Product Development | 📋 Planned |
| **22** | Phase 9 | Compliance & Documentation | 📋 Planned |
| **23** | Phase 10 | Maintenance Management | 📋 Planned |
| **24** | Phase 11 | Global Masters | 📋 Planned |

**Total Timeline:** ~24 weeks (6 months)
**Current Progress:** Week 9 (37.5%)
**Estimated Go-Live:** March 2026

---

## 🎯 CURRENT PRIORITIES

### Immediate Next Steps:
1. ⏳ **Complete Phase 5.X** - Cost Sheet Frontend (40% remaining)
2. 📋 **Start Phase 1 (NEW)** - Documentation Consolidation
3. 📋 **Plan Phase 1.5** - Import/Export Infrastructure

### This Week:
- [ ] Finish Cost Sheet frontend form
- [ ] Test Cost Sheet → BOM workflow
- [ ] Get user validation on Cost Sheet
- [ ] Complete GLOSSARY.md with new terms
- [ ] Create DEVELOPMENT_NAVIGATION.md

### Next Week:
- [ ] Start Phase 1.5 - Export Service
- [ ] Build Import Service
- [ ] Create Template Management System

---

## 📖 RELATED DOCUMENTATION

**Core Documents:**
- [GLOSSARY.md](GLOSSARY.md) - 180+ technical terms
- [BUSINESS_RULES.md](BUSINESS_RULES.md) - Business logic and validation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture (3-tier, ADRs)
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database structure (48 tables)

**Setup Guides:**
- [LOCAL_DATABASE_SETUP.md](../LOCAL_DATABASE_SETUP.md) - PostgreSQL setup
- [INDIAN_COMPLIANCE_GUIDE.md](../INDIAN_COMPLIANCE_GUIDE.md) - GST compliance
- [INDIAN_SETUP_QUICKSTART.md](../INDIAN_SETUP_QUICKSTART.md) - Quick start

**Feature Docs:**
- [Cost Sheet Implementation](features/cost-sheet/) - Cost Sheet module (60% complete)

**Phase Status:**
- [PHASE1_COMPLETE.md](../PHASE1_COMPLETE.md) - Financial Masters complete
- [PHASE1_CONTROLLERS_COMPLETE.md](../PHASE1_CONTROLLERS_COMPLETE.md) - Controller details

---

**Document Version:** 2.0
**Last Updated:** November 15, 2025
**Maintained By:** Kashaya Fabs Development Team
**Status:** Living document - Updated after each phase completion

---

**LET'S BUILD SOMETHING AMAZING! 🏭✨**
