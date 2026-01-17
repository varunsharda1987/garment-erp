# Archived Implementation Plans

> **Executed Plans Preserved for Historical Reference**
> **Last Updated:** January 15, 2026

---

## Purpose

This folder contains plan files that have been:
1. **Executed** - The implementation is complete
2. **Merged** - Key content has been added to documentation guides
3. **Archived** - Preserved here for historical reference

---

## Archived Files (15 total)

| Plan File | Topic | Merged Into | Archive Date |
|-----------|-------|-------------|--------------|
| [CAD-Planning-Implementation.md](CAD-Planning-Implementation.md) | CAD Planning Module Implementation | [CAD_PLANNING_GUIDE.md](../../CAD_PLANNING_GUIDE.md) | Jan 13, 2026 |
| [floofy-weaving-lobster.md](floofy-weaving-lobster.md) | Documentation Consolidation Plan | docs/ folder structure | Jan 13, 2026 |
| [floofy-churning-phoenix.md](floofy-churning-phoenix.md) | Fix Trims (StyleMaterialBom Migration) | [BOM_MRP_GUIDE.md](../../BOM_MRP_GUIDE.md) | Jan 13, 2026 |
| [sunny-swinging-tarjan.md](sunny-swinging-tarjan.md) | Stock Display System (Unified Dashboard) | [STOCK_MANAGEMENT_GUIDE.md](../../STOCK_MANAGEMENT_GUIDE.md) | Jan 13, 2026 |
| [happy-drifting-galaxy.md](happy-drifting-galaxy.md) | Indian States/Cities + GST Compliance | [GST_GUIDE.md](../../GST_GUIDE.md) | Jan 13, 2026 |
| [stateless-moseying-rivest.md](stateless-moseying-rivest.md) | Fabric Costing 6 Critical Issues | [FABRIC_COSTING_GUIDE.md](../../FABRIC_COSTING_GUIDE.md) | Jan 15, 2026 |
| [jazzy-whistling-kazoo.md](jazzy-whistling-kazoo.md) | CAD Planning List Enhancement | [CAD_PLANNING_GUIDE.md](../../CAD_PLANNING_GUIDE.md) | Jan 15, 2026 |
| [zippy-mixing-pine.md](zippy-mixing-pine.md) | Processor Rate Card Redesign | [FABRIC_COSTING_GUIDE.md](../../FABRIC_COSTING_GUIDE.md) | Jan 15, 2026 |
| [drifting-foraging-pixel.md](drifting-foraging-pixel.md) | CAD Purposes System | [CAD_PLANNING_GUIDE.md](../../CAD_PLANNING_GUIDE.md) | Jan 15, 2026 |
| [eventual-scribbling-haven.md](eventual-scribbling-haven.md) | CAD Planning Data Flow Analysis | [CAD_PLANNING_GUIDE.md](../../CAD_PLANNING_GUIDE.md) | Jan 15, 2026 |
| [eventual-tinkering-church.md](eventual-tinkering-church.md) | Label/Packaging Customer Linking | [MATERIALS_MASTER_GUIDE.md](../../MATERIALS_MASTER_GUIDE.md) | Jan 15, 2026 |
| [glowing-prancing-pixel.md](glowing-prancing-pixel.md) | Multiple Costing Options & Approval | [FABRIC_COSTING_GUIDE.md](../../FABRIC_COSTING_GUIDE.md) | Jan 15, 2026 |
| [piped-mapping-fountain.md](piped-mapping-fountain.md) | Skills/MCP Servers/Hooks Integration | [CLAUDE.md](../../CLAUDE.md) | Jan 15, 2026 |
| [quirky-floating-pudding.md](quirky-floating-pudding.md) | Production Tracking UI Enhancement | [PRODUCTION_PIPELINE_GUIDE.md](../../PRODUCTION_PIPELINE_GUIDE.md) | Jan 15, 2026 |
| [brand-support-labels-packaging.md](brand-support-labels-packaging.md) | Brand Support for Labels/Packaging | [MATERIALS_MASTER_GUIDE.md](../../MATERIALS_MASTER_GUIDE.md) | Jan 15, 2026 |

---

## Detailed Archive Notes

### 1. CAD-Planning-Implementation.md
- **Topic**: CAD Planning Module Implementation
- **Evidence**: `CADSpreadsheetTable.tsx`, `CADPlanningPage.tsx` exist
- **Merged Into**: CAD_PLANNING_GUIDE.md already comprehensive
- **Key Components Implemented**:
  - CADSpreadsheetTable (evolved from InlineCADTable)
  - CADOrderHistoryTable
  - StockSummaryBanner
  - style-cad-planning.controller.ts

### 2. floofy-weaving-lobster.md
- **Topic**: Documentation Consolidation Plan
- **Evidence**: 18 docs in docs/ folder (exceeded plan of 11)
- **Result**: Current docs/ structure with all guides
- **Key Outcomes**:
  - Created PROJECT_BIBLE.md
  - Created 11 module guides
  - Organized archive folder

### 3. floofy-churning-phoenix.md
- **Topic**: Fix Trims Not Displaying in Style View
- **Evidence**: Commit 944cca46 - removed `style_garment_trims`
- **Merged Into**: BOM_MRP_GUIDE.md Section 3 (StyleMaterialBom)
- **Key Changes**:
  - Removed deprecated `style_garment_trims` model
  - Unified all materials in `style_material_bom`
  - Updated frontend to use `styleMaterialBom`

### 4. sunny-swinging-tarjan.md
- **Topic**: Stock Display System (Unified Dashboard)
- **Evidence**: ViewStockButton.tsx exists on 9 material masters
- **Merged Into**: STOCK_MANAGEMENT_GUIDE.md Section 8
- **Key Changes**:
  - Created ViewStockButton component
  - Enhanced StockDashboard as unified dashboard
  - Added material type filtering

### 5. happy-drifting-galaxy.md
- **Topic**: Indian States/Cities + GST Compliance
- **Evidence**: 36 states + 133 cities in database, all services/routes/components exist
- **Merged Into**: GST_GUIDE.md (comprehensive GST documentation)
- **Key Components Implemented**:
  - `indian_states` and `indian_cities` Prisma models
  - `gst.service.ts` - GST validation, CGST/SGST/IGST calculation
  - `location.service.ts` - State/city CRUD operations
  - `StateSelector.tsx` and `CitySelector.tsx` frontend components
  - `GSTNumberInput.tsx` - Complete GST input with state validation
  - Seed data: 36 states/UTs, 133 major cities by tier
  - SupplierForm integration with billing/shipping address
  - CustomerForm GST validation via GSTNumberInput

### 6. stateless-moseying-rivest.md
- **Topic**: Fabric Costing 6 Critical Issues (Factory Usage Feedback)
- **Evidence**: All 6 issues verified as FIXED in current codebase
- **Merged Into**: FABRIC_COSTING_GUIDE.md
- **Issues Resolved**:
  1. **Greige Price Override** - Manual input (FabricCostingPage.tsx lines 1091-1129), visual indicators (S=Stock, D=Default, M=Manual)
  2. **Multiple Width Approval** - `ALTERNATE_APPROVED` status in backend (lines 960-975)
  3. **Style-Specific Options** - Endpoint implemented, frontend uses query parameter
  4. **Global Qty Removal** - No global input in header, row-level inputs only
  5. **Approve Button Refresh** - Line 686 calls `fetchStyleFabrics(true)` after save
  6. **CAD-Costing Mode Linking** - SKIPPED per original plan decision

### 7. jazzy-whistling-kazoo.md
- **Topic**: CAD Planning List Enhancement & Fabric Costing Fix
- **Evidence**: CADPlanningList.tsx with order-based filtering, fabric costing page fix
- **Merged Into**: CAD_PLANNING_GUIDE.md
- **Key Changes**:
  - Added order-based filtering to CAD Planning List
  - Fixed fabric costing page missing CAD data issue
  - Implemented style-cad-planning controller with getStylesByOrder endpoint

### 8. zippy-mixing-pine.md
- **Topic**: Processor Rate Card Redesign (Matrix-Based UI)
- **Evidence**: ProcessorRateCardPage.tsx fully replaced, processor-rate-v2 service implemented
- **Merged Into**: FABRIC_COSTING_GUIDE.md
- **Implementation Status**: 100% COMPLETE + Bonus Features
- **Key Features Implemented**:
  - Matrix-based UI with ONE table per processor
  - Greige fabrics as rows (Generic Name + Full Greige Name)
  - Custom quantity slabs as columns (editable headers)
  - DYEING & PRINTING process tabs
  - Printing type sub-tabs (PIGMENT, PROCIAN, DISCHARGE, PIGMENT_DISCHARGE)
  - Copy rates between processors
  - Summary dashboard with statistics
  - Row copy/paste functionality (bonus)
  - Shrinkage percentage tracking (bonus)
  - Default rates mode with SYSTEM_DEFAULT processor (bonus)
- **Files**: `ProcessorRateCardPage.tsx`, `processor-rate-v2.service.ts`, `processor_quantity_slabs` schema

### 9. drifting-foraging-pixel.md
- **Topic**: CAD Purposes System (PRODUCTION, PLANNING, COSTING)
- **Evidence**: All 3 purposes working with approval workflow, versioning, and stock linkage
- **Merged Into**: CAD_PLANNING_GUIDE.md
- **Implementation Status**: 92% COMPLETE (1 minor TODO remaining)
- **Key Features Implemented**:
  - **Purpose Selection**: PRODUCTION, PLANNING, COSTING with color-coded badges
  - **Approval Workflow**: PENDING → APPROVED/REJECTED with notes and auditing
  - **Version Control**: PLANNING CAD versioning (v1, v2, v3...) with supersession tracking
  - **Copy Between Purposes**: COSTING → PLANNING → PRODUCTION flow
  - **Stock Linkage**: PRODUCTION CAD links to fabric stock with variance tracking
  - **Locking**: `isLocked` field when CAD used in orders
  - **Visual UI**: Status badges, version indicators, lock icons
- **Minor TODO**: Stock reservation on PRODUCTION approval (low impact)
- **Files**: `CADSpreadsheetTable.tsx`, `style-cad-planning.controller.ts`, `fabric_width_cad` schema enhancements

### 10. eventual-scribbling-haven.md
- **Topic**: CAD Planning Data Flow Analysis (4 Proposed Enhancements)
- **Evidence**: All 4 proposed features fully implemented in current codebase
- **Merged Into**: CAD_PLANNING_GUIDE.md
- **Implementation Status**: 100% COMPLETE
- **Key Features Implemented**:
  - **PrintDirection Field**: `ONE_WAY`/`TWO_WAY` enum on `fabric_width_cad` and `embroidery_part_cad`
  - **Pattern Part Assignment**: `style_pattern_parts` model with `goesToEmbroidery` flag, unique constraint
  - **Separate Embroidery CAD**: `embroidery_part_cad` + `embroidery_cad_size_breakdown` models
  - **Cutable Width Validation**: Stock width suggestions with >5% or >2" variance warnings
  - **InlineCADTable**: Evolved into `CADSpreadsheetTable.tsx` with full inline editing
  - **Single-Page Workflow**: `CADPlanningPage.tsx` with 3 tabs (Spreadsheet, History, Order History)
  - **All Parts Detection**: `ALL_PARTS_CODE` constant with duplicate prevention
  - **Size Breakdown Propagation**: Auto-propagates to sibling rows with same componentId
- **Files**: `schema.prisma` (PrintDirection enum, 3 new models), `CADSpreadsheetTable.tsx`, `CADPlanningPage.tsx`

### 11. eventual-tinkering-church.md
- **Topic**: Label/Packaging Customer Linking + Fabric Content Fields
- **Evidence**: All features fully implemented in schema, controllers, and frontend forms
- **Merged Into**: MATERIALS_MASTER_GUIDE.md
- **Implementation Status**: 100% COMPLETE
- **Feature 1: Customer Linking to Labels & Packaging**:
  - **Schema**: `label_master.customerId` at line 4671 with relation at 4693, index at 4706
  - **Schema**: `packaging_master.customerId` at line 4755 with relation at 4773, index at 4783
  - **Schema**: `customers` relations at lines 195-196 (`labels` and `packaging` arrays)
  - **Backend**: `label.controller.ts` - Create/Update/GetAll handle customerId with OR filter for generic
  - **Backend**: `packaging.controller.ts` - Create/Update/GetAll handle customerId with OR filter for generic
  - **Frontend**: `LabelForm.tsx` Customer dropdown at lines 378-400
  - **Frontend**: `PackagingForm.tsx` Customer dropdown at lines 276-298
  - **Frontend**: `AccessorySelector.tsx` customerId prop at line 59, filtering at lines 125-145
- **Feature 2: Fabric Content & Washcare Instructions Fields**:
  - **Schema**: `label_master.fabricContent` at line 4677
  - **Schema**: `label_master.washcareInstructions` at line 4678
  - **Frontend**: `LabelForm.tsx` fabricContent at lines 556-566, washcareInstructions at lines 569-580
- **Key Pattern**: OR filter logic shows both customer-specific AND generic (null customerId) items

### 12. glowing-prancing-pixel.md
- **Topic**: Multiple Costing Options & Approval Workflow
- **Evidence**: Schema constraint enhanced, FabricCostingOptionsPage.tsx exists, all API endpoints implemented
- **Merged Into**: FABRIC_COSTING_GUIDE.md
- **Implementation Status**: 100% COMPLETE + Bonus Features
- **Key Features Implemented**:
  - **Schema Enhancement**: Unique constraint now `(costingStyleId, componentName, cutableWidth, processorId, purpose)`
  - **FabricCostingOptionsPage.tsx**: Full filtering, grouping, approval workflow
  - **API Endpoints**: getCostingOptions, approveCostingOption, deleteCostingOption, promoteCostingOption, getStylesCostingStatus
  - **Workflow Stages**: PLANNING → COSTING → PRODUCTION with promotion flow
  - **Repeat Order Detection**: Auto-upgrades to PRODUCTION for repeat orders
  - **Approval States**: PENDING, APPROVED, ALTERNATE_APPROVED
- **Files**: `FabricCostingOptionsPage.tsx`, `fabric-costing.controller.ts`, `fabric-costing.routes.ts`

### 13. piped-mapping-fountain.md
- **Topic**: Skills, MCP Servers, and Hooks Integration
- **Evidence**: All 5 skills, 4 MCP servers, and 4 hooks fully implemented
- **Merged Into**: CLAUDE.md (documented in Custom Skills and Automated Hooks sections)
- **Implementation Status**: 100% COMPLETE (13/13 components)
- **Skills Implemented** (scripts/skills/):
  - `/sync-types` - Type synchronization validation
  - `/db-workflow` - Database operations automation
  - `/test-all` - Unified test orchestration
  - `/api-docs` - API documentation generation
  - `/commit-smart` - Intelligent commit messages
- **MCP Servers Implemented** (mcp-servers/):
  - `prisma-server` - Schema analysis, N+1 detection
  - `typescript-server` - Type inference, mismatch detection
  - `database-server` - Read-only database queries
  - `docs-server` - Documentation search
- **Hooks Implemented** (scripts/hooks/):
  - `post-type-change.js` - Auto-validate type sync
  - `pre-commit.js` - TypeScript + type sync blocking
  - `pre-migration.js` - Schema validation + safety checks
  - `post-docs-update.js` - Link validation

### 14. quirky-floating-pudding.md
- **Topic**: Production Tracking UI Enhancement
- **Evidence**: All components, pages, and backend endpoints implemented
- **Merged Into**: PRODUCTION_PIPELINE_GUIDE.md
- **Implementation Status**: 100% COMPLETE
- **Key Features Implemented**:
  - **ProductionTrackingInlineForm.tsx**: Stage selector, quantity input, remarks, pre-validation
  - **AdminOverrideModal.tsx**: Blocker display, required reason field, audit logging
  - **EnhancedBlockerCard.tsx**: Expandable cards, severity colors, resolution steps, action buttons
  - **OverrideHistory.tsx**: Admin page with table, filters, CSV export, detail modal
  - **stageTransitionValidation.controller.ts**: checkStageTransition, checkSampleCreation, getOverrideHistory endpoints
  - **ProductionStatus.tsx**: Refresh mechanism, update badges, inline stage update integration
- **Files**: Multiple files in `frontend/src/components/production/`, `frontend/src/pages/admin/`, backend controllers

### 15. brand-support-labels-packaging.md
- **Topic**: Brand Support for Labels and Packaging
- **Evidence**: All schema, controller, and frontend changes implemented
- **Merged Into**: MATERIALS_MASTER_GUIDE.md
- **Implementation Status**: 100% COMPLETE
- **Key Features Implemented**:
  - **Schema**: `brandCategoryId` field on `label_master` and `packaging_master`
  - **Schema**: Reverse relations `labels` and `packaging` on `brand_categories`
  - **Frontend**: Brand dropdown in LabelForm.tsx (lines 403-434) and PackagingForm.tsx (lines 301-332)
  - **State Management**: Brand loading when customer changes, proper reset behavior
  - **API Integration**: brandCategoryId included in form submissions
- **Key Pattern**: Optional brand linking allows brand-specific configurations within a customer

---

## How to Use Archived Plans

1. **Historical Reference** - Understand why features were designed
2. **Implementation Context** - See the thought process behind features
3. **Traceability** - Link documented features to original plans

**Current Documentation:** Always refer to the main guides in [docs/](../../) for current system documentation.

---

**Archive Maintained By:** Development Team
