# Documentation Consolidation Plan

## Objective
1. Move all markdown files to the `docs` folder
2. Create a new `PROJECT_BIBLE.md` as the main comprehensive document
3. Consolidate redundant documentation files
4. Delete consolidated files to avoid duplication
5. Keep essential module-specific documents separate

---

## Current State Analysis

### Markdown Files Inventory (65 files, ~974KB)

**Root Level (19 files to move/consolidate):**
- CLAUDE.md (11K) - **KEEP SEPARATE** - Critical dev instructions
- AI_FEATURES_GUIDE.md (22K) - Consolidate into PROJECT_BIBLE
- COST_SHEET_INTEGRATION_GUIDE.md (12K) - Consolidate
- FABRIC_COSTING_COMPLETE_GUIDE.md (30K) - **KEEP SEPARATE** - Major feature
- GST_SUMMARY.md (14K) - Consolidate
- HOOKS_QUICK_REFERENCE.md (5.2K) - Consolidate
- HOOKS_USAGE_GUIDE.md (15K) - Consolidate
- HOW_TO_USE_SKILLS_NOW.md (7.7K) - Consolidate
- IMPLEMENTATION_STATUS.md (12K) - Consolidate
- MCP_QUICK_REFERENCE.md (7.7K) - Consolidate
- MCP_USAGE_GUIDE.md (18K) - Consolidate
- MIGRATION_SUMMARY.md (8.2K) - Consolidate
- NAVIGATION_UPDATE.md (8.8K) - Delete (outdated)
- PHASE_2_COMPLETE.md (11K) - Delete (historical)
- PHASE_3_COMPLETE.md (14K) - Delete (historical)
- SETUP_COMPLETE.md (12K) - Consolidate
- SKILLS_QUICK_REFERENCE.md (3.8K) - Consolidate
- SKILLS_USAGE_GUIDE.md (11K) - Consolidate
- START_HERE.md (9.9K) - Consolidate

**Docs Folder (40 files to consolidate/organize):**
- SYSTEM_GUIDE.md (29K) - Consolidate into PROJECT_BIBLE
- ARCHITECTURE.md (27K) - Consolidate into PROJECT_BIBLE
- PRODUCT_FLOW_GUIDE.md (57K) - Consolidate into PROJECT_BIBLE
- CAD-Planning-Complete.md (81K) - **KEEP SEPARATE** - Major feature
- GST_IMPLEMENTATION_GUIDE.md (26K) - **KEEP SEPARATE** - Major feature
- GLOSSARY.md (18K) - **KEEP SEPARATE** - Reference
- CODING_STANDARDS.md (19K) - **KEEP SEPARATE** - Dev reference
- DESIGN_SYSTEM.md (15K) - Consolidate
- DEPLOYMENT_GUIDE.md (14K) - Consolidate
- SETUP_GUIDE.md (15K) - Consolidate
- DATABASE_SCHEMA.md (6.6K) - Consolidate
- And 29 more files...

---

## Files to KEEP SEPARATE (Not consolidated)

| File | Reason | New Location |
|------|--------|--------------|
| CLAUDE.md | Critical Claude Code instructions | `docs/CLAUDE.md` |
| FABRIC_COSTING_COMPLETE_GUIDE.md | Major active feature (30K) | `docs/FABRIC_COSTING_GUIDE.md` |
| CAD-Planning-Complete.md | Major module (81K) | `docs/CAD_PLANNING_GUIDE.md` |
| GST_IMPLEMENTATION_GUIDE.md | Major compliance feature | `docs/GST_GUIDE.md` |
| GLOSSARY.md | Industry terminology reference | `docs/GLOSSARY.md` |
| CODING_STANDARDS.md | Development reference | `docs/CODING_STANDARDS.md` |

---

## Files to DELETE (Historical/Outdated)

| File | Reason |
|------|--------|
| PHASE_2_COMPLETE.md | Historical milestone - info goes to PROJECT_BIBLE |
| PHASE_3_COMPLETE.md | Historical milestone - info goes to PROJECT_BIBLE |
| NAVIGATION_UPDATE.md | Outdated navigation changes |
| MIGRATION_SUMMARY.md | Historical migration info |
| HOW_TO_USE_SKILLS_NOW.md | Redundant with SKILLS_USAGE_GUIDE |
| SKILLS_QUICK_REFERENCE.md | Merge into PROJECT_BIBLE |
| HOOKS_QUICK_REFERENCE.md | Merge into PROJECT_BIBLE |
| MCP_QUICK_REFERENCE.md | Merge into PROJECT_BIBLE |
| START_HERE.md | Replace with PROJECT_BIBLE quick start |
| docs/INDEX.md | Replace with PROJECT_BIBLE TOC |
| docs/README.md | Replace with PROJECT_BIBLE |
| docs/PROJECT_STATUS.md | Merge into PROJECT_BIBLE |
| Multiple GST_*.md files | Merge into GST_GUIDE.md |
| Multiple AI_*.md files | Merge into PROJECT_BIBLE |
| STYLEFORM-*.md files | Historical fixes - delete |
| BRAND-*.md files | Historical fixes - delete |
| COMPONENT_GROUP_*.md files | Merge into PROJECT_BIBLE |
| INSTALL_PGVECTOR*.md files | Merge into setup section |

---

## PROJECT_BIBLE.md Structure

```markdown
# Kashaya Fabs Garment ERP - Project Bible
## The Complete System Documentation

### Table of Contents
1. Quick Start
2. System Overview
3. Architecture
4. Database Design
5. Major Modules
   5.1 Style Management
   5.2 Fabric & Material Management
   5.3 Order Management
   5.4 Inventory & Stock
   5.5 Manufacturing & Processing
   5.6 Costing & Financial
   5.7 Quality Management
6. API Reference
7. Frontend Guide
8. Developer Tools
   8.1 Custom Skills
   8.2 Automated Hooks
   8.3 MCP Servers
9. Deployment & Operations
10. Troubleshooting
11. Appendix
    - State Codes
    - Material Types
    - Status Flows

### Key Sections Content Sources:

**1. Quick Start** ← START_HERE.md, SETUP_GUIDE.md
**2. System Overview** ← docs/README.md, PROJECT_STATUS.md
**3. Architecture** ← ARCHITECTURE.md (condensed)
**4. Database Design** ← DATABASE_SCHEMA.md, SYSTEM_GUIDE.md
**5. Major Modules** ← SYSTEM_GUIDE.md, PRODUCT_FLOW_GUIDE.md
**6. API Reference** ← Generated from routes analysis
**7. Frontend Guide** ← DESIGN_SYSTEM.md, component analysis
**8. Developer Tools** ← AI_FEATURES_GUIDE.md, SKILLS/HOOKS/MCP guides
**9. Deployment** ← DEPLOYMENT_GUIDE.md
**10. Troubleshooting** ← Various guides
```

---

## Execution Plan

### Step 1: Create docs folder structure
```
docs/
├── PROJECT_BIBLE.md          # New comprehensive doc
├── CLAUDE.md                 # Dev instructions (moved from root)
├── FABRIC_COSTING_GUIDE.md   # Renamed/cleaned
├── CAD_PLANNING_GUIDE.md     # Renamed/cleaned
├── GST_GUIDE.md              # Consolidated GST docs
├── GLOSSARY.md               # Industry terms
├── CODING_STANDARDS.md       # Dev standards
└── archive/                  # (optional) for historical reference
```

### Step 2: Move root markdown files to docs/
Files to move: 19 files from root → docs/

### Step 3: Create PROJECT_BIBLE.md
- Analyze and extract content from all consolidation sources
- Write comprehensive document (~100-150KB estimated)
- Include all module documentation
- Add current system status
- Add API reference section
- Add developer tools section

### Step 4: Consolidate GST documentation
Merge these into `docs/GST_GUIDE.md`:
- GST_SUMMARY.md
- GST_IMPLEMENTATION_GUIDE.md
- GST_QUICK_START.md
- GST_FILES_REFERENCE.md
- INDEX.md (GST index)
- SUPPLIER_GST_IMPLEMENTATION.md

### Step 5: Delete redundant files
Delete ~45 files that have been consolidated

### Step 6: Update CLAUDE.md
- Update file references to new locations
- Ensure all paths point to docs/ folder

### Step 7: Update any code references
- Check for hardcoded doc paths in code
- Update README references

---

## Final docs/ Structure

```
docs/
├── PROJECT_BIBLE.md           # ~150KB - Main comprehensive doc
├── CLAUDE.md                  # ~11KB - Claude Code instructions
├── FABRIC_COSTING_GUIDE.md    # ~35KB - Fabric costing module
├── CAD_PLANNING_GUIDE.md      # ~85KB - CAD planning module
├── GST_GUIDE.md               # ~40KB - Consolidated GST docs
├── GLOSSARY.md                # ~18KB - Industry terminology
└── CODING_STANDARDS.md        # ~19KB - Development standards
```

**Total: 7 files (~358KB) down from 65 files (~974KB)**
**Reduction: 89% fewer files, 63% smaller total size**

---

## Files to Process

### Move to docs/ then Consolidate into PROJECT_BIBLE:
1. AI_FEATURES_GUIDE.md
2. COST_SHEET_INTEGRATION_GUIDE.md
3. HOOKS_USAGE_GUIDE.md
4. IMPLEMENTATION_STATUS.md
5. MCP_USAGE_GUIDE.md
6. SETUP_COMPLETE.md
7. SKILLS_USAGE_GUIDE.md
8. START_HERE.md
9. docs/SYSTEM_GUIDE.md
10. docs/ARCHITECTURE.md
11. docs/PRODUCT_FLOW_GUIDE.md
12. docs/DESIGN_SYSTEM.md
13. docs/DEPLOYMENT_GUIDE.md
14. docs/SETUP_GUIDE.md
15. docs/DATABASE_SCHEMA.md
16. docs/AI_ASSISTANT_IMPLEMENTATION_GUIDE.md
17. docs/AI_IMPLEMENTATION_SUMMARY.md
18. docs/AI_QUICK_REFERENCE.md
19. docs/AI_SETUP_STATUS.md
20. docs/AI_SYSTEM_SETUP_GUIDE.md
21. docs/COMPONENT_GROUP_*.md (3 files)
22. docs/CODE_OPTIMIZATION_PLAN.md
23. docs/PROCESS_GUIDE_MAINTENANCE.md
24. docs/ROLE_BASED_UI_IMPLEMENTATION_PLAN.md
25. docs/SIZE_VARIANT_INVENTORY_INTEGRATION.md

### Move to docs/ then Consolidate into GST_GUIDE:
1. GST_SUMMARY.md
2. docs/GST_QUICK_START.md
3. docs/GST_FILES_REFERENCE.md
4. docs/INDEX.md
5. docs/SUPPLIER_GST_IMPLEMENTATION.md

### Delete after consolidation:
1. PHASE_2_COMPLETE.md
2. PHASE_3_COMPLETE.md
3. NAVIGATION_UPDATE.md
4. MIGRATION_SUMMARY.md
5. HOW_TO_USE_SKILLS_NOW.md
6. SKILLS_QUICK_REFERENCE.md
7. HOOKS_QUICK_REFERENCE.md
8. MCP_QUICK_REFERENCE.md
9. docs/README.md
10. docs/PROJECT_STATUS.md
11. docs/STYLEFORM-*.md (2 files)
12. docs/BRAND-*.md (2 files)
13. docs/INSTALL_PGVECTOR*.md (2 files)

### Keep in backend/frontend (no changes):
- backend/prisma/seeds/README.md
- backend/scripts/MIGRATION_README.md
- backend/scripts/README.md
- frontend/README.md
- frontend/src/components/icons/README.md
- frontend/tests/e2e-testing-framework/*.md (2 files)

---

## Implementation Order

1. **Read all source files** to understand content
2. **Create PROJECT_BIBLE.md** with comprehensive content
3. **Create GST_GUIDE.md** by consolidating GST docs
4. **Rename/clean feature guides** (Fabric, CAD)
5. **Move CLAUDE.md** to docs/
6. **Delete redundant files** from root and docs/
7. **Update CLAUDE.md** with new paths
8. **Verify all links work**

---

## Success Criteria

- [x] All markdown files in docs/ folder (except backend/frontend READMEs)
- [x] PROJECT_BIBLE.md contains comprehensive system documentation
- [x] GST_GUIDE.md consolidates all GST documentation
- [x] Only 7 markdown files in docs/ folder
- [x] CLAUDE.md updated with correct paths
- [x] No broken documentation links
- [ ] All major modules documented in PROJECT_BIBLE.md (PARTIAL - see gap analysis)

---

# PHASE 2: Documentation Gap Analysis & Expansion Plan

## Consolidation Complete ✓

**Before:** 65 markdown files (~974KB)
**After:** 7 markdown files in docs/ + 1 root CLAUDE.md (~202KB)
**Reduction:** 89% fewer files

## Current Documentation Coverage Assessment

### What's Well Documented (✅)

| Document | Status | Coverage |
|----------|--------|----------|
| GLOSSARY.md | Excellent | 180+ industry terms, 14 categories |
| CODING_STANDARDS.md | Excellent | React/Express/Prisma patterns |
| CAD_PLANNING_GUIDE.md | Excellent | v3.3, complete with testing |
| FABRIC_COSTING_GUIDE.md | Excellent | 3 strategies, complete workflow |
| GST_GUIDE.md | Complete | State/city/tax calculations |
| CLAUDE.md | Complete | Dev tools, hooks, skills |

### What's In PROJECT_BIBLE But Needs Expansion (⚠️)

| Section | Current | Gap |
|---------|---------|-----|
| Style Management | Good overview | Missing BOM workflow details |
| Order Management | Adequate | Missing order-to-production flow |
| Inventory & Stock | Basic | 5 stock tables not differentiated |
| Manufacturing | Basic overview | Missing stage workflows |
| Quality Management | Minimal | Missing test procedures |

### Critical Documentation Gaps (❌)

#### Gap 1: Production Pipeline (HIGH PRIORITY)
**Undocumented:** Cutting, Stitching, Finishing, Printing, Dyeing workflows
- 15+ database models
- 4+ route files
- Complete workflow missing

#### Gap 2: Stock Management Clarity (HIGH PRIORITY)
**Problem:** 5 stock tables not differentiated:
- fabric_stock
- finished_goods_stock
- inventory_stock
- embroidery_stock
- greige_stock
**Risk:** Developers won't know which table to use

#### Gap 3: Order-to-Production Flow (HIGH PRIORITY)
**Missing:** Complete lifecycle documentation
```
Order → Work Order → Material Allocation → Production → QC → Dispatch
```

#### Gap 4: Dispatch & Logistics (MEDIUM)
**Undocumented:** 5+ routes (dispatch, ASN, transport, POD)

#### Gap 5: Embroidery System (MEDIUM)
**Undocumented:** 3 routes, 8+ models

#### Gap 6: Testing & Quality Labs (MEDIUM)
**Undocumented:** AQL procedures, test templates, lab management

#### Gap 7: Master Data Management (MEDIUM)
**Undocumented:** 15+ trim masters (buttons, zippers, lace, etc.)

#### Gap 8: AI & Conversational Features (LOW)
**Undocumented:** 3 routes for AI assistant

---

## Quantified Coverage

| Metric | Total | Documented | Gap |
|--------|-------|------------|-----|
| Database Models | 197 | ~50 | 75% undocumented |
| API Routes | 94 | ~30 | 68% undocumented |
| Frontend Pages | 157 | ~30 | 81% undocumented |
| Major Modules | 12 | 7 | 42% missing |

---

## Recommended Documentation Expansion

### Option A: Expand PROJECT_BIBLE.md (Recommended)
Add these sections to the existing document:

**5.8 Production Pipeline**
- Cutting workflow
- Stitching workflow
- Finishing workflow
- Processing (Print/Dye) workflow

**5.9 Dispatch & Logistics**
- Dispatch process
- ASN/POD procedures
- Transport management

**5.10 Stock Management Unified Guide**
- When to use each stock table
- Stock transaction types
- Allocation procedures

**5.11 Testing & Quality Labs**
- Test template management
- AQL procedures
- Lab workflow

### Option B: Create Separate Module Guides
Create additional focused documents:
- PRODUCTION_PIPELINE_GUIDE.md
- STOCK_MANAGEMENT_GUIDE.md
- DISPATCH_LOGISTICS_GUIDE.md
- TESTING_QUALITY_GUIDE.md

### Option C: Minimal - Expand Glossary + Quick References
Add workflow diagrams and quick references without full guides

---

## Estimated Effort for Each Option

| Option | Documents | Estimated Size | Effort |
|--------|-----------|----------------|--------|
| Option A | 1 expanded | ~100KB added | Medium |
| Option B | 4 new files | ~40KB each | High |
| Option C | 2 updated | ~20KB added | Low |

---

## User Decision: Option B with PROJECT_BIBLE Linkage ✓

Create 4 separate module guides linked from PROJECT_BIBLE.md for easy navigation.

---

# PHASE 3: Documentation Expansion Plan

## New Documentation Structure

```
docs/
├── PROJECT_BIBLE.md           ✓ Existing - Add links to new guides
├── CAD_PLANNING_GUIDE.md      ✓ Existing - Complete
├── FABRIC_COSTING_GUIDE.md    ✓ Existing - Complete
├── GST_GUIDE.md               ✓ Existing - Complete
├── GLOSSARY.md                ✓ Existing - Complete
├── CODING_STANDARDS.md        ✓ Existing - Complete
├── CLAUDE.md                  ✓ Existing - Complete
├── PRODUCTION_PIPELINE_GUIDE.md  [NEW] Production workflows
├── STOCK_MANAGEMENT_GUIDE.md     [NEW] Inventory & stock tables
├── DISPATCH_LOGISTICS_GUIDE.md   [NEW] Dispatch & shipping
└── TESTING_QUALITY_GUIDE.md      [NEW] Quality control & labs
```

**Final: 11 documentation files**

---

## New Documents to Create

### 1. PRODUCTION_PIPELINE_GUIDE.md (~40KB)

**Purpose:** Document all production stage workflows

**Sections:**
1. Production Overview
   - Production stages diagram
   - Key database models

2. Cutting Module
   - Cutting batch creation
   - Material consumption
   - API endpoints
   - Frontend pages

3. Stitching Module
   - Work order assignment
   - Progress tracking
   - Quality checkpoints

4. Finishing Module
   - Finishing processes
   - Final inspection
   - Handoff to dispatch

5. Printing & Dyeing
   - Processing batches
   - Processor integration
   - Movement tracking

6. Sample Development
   - Sample types
   - Approval workflow

**Key Files to Document:**
- Routes: cutting.routes.ts, stitching.routes.ts, finishing.routes.ts
- Controllers: processingBatch.controller.ts
- Pages: CuttingForm.tsx, StitchingList.tsx, FinishingDetail.tsx

---

### 2. STOCK_MANAGEMENT_GUIDE.md (~35KB)

**Purpose:** Clarify all stock tables and when to use each

**Sections:**
1. Stock Tables Overview
   - Which table for what purpose
   - Relationship diagram

2. Fabric Stock Management
   - fabric_stock table
   - greige_stock table
   - fabric_stock_allocation
   - fabric_stock_transaction

3. Finished Goods Stock
   - finished_goods_stock
   - finished_goods_outward
   - finished_goods_inward

4. Embroidery Stock
   - embroidery_stock
   - embroidery_send_out

5. General Inventory
   - inventory_stock
   - inventory_movement

6. Stock Transaction Types
   - PURCHASE, ISSUE, TRANSFER
   - ADJUSTMENT, RETURN

7. Stock Allocation Workflow
   - Reservation
   - Allocation
   - Consumption

**Key Files to Document:**
- Routes: stock-levels.routes.ts, fabric-stock.routes.ts
- Services: stock.service.ts
- Pages: StockLevelList.tsx, InventoryMovement.tsx

---

### 3. DISPATCH_LOGISTICS_GUIDE.md (~30KB)

**Purpose:** Document dispatch and shipping workflows

**Sections:**
1. Dispatch Overview
   - Dispatch workflow diagram
   - Integration with orders

2. Dispatch Process
   - Creating dispatch
   - Packing list generation
   - Invoice attachment

3. Advanced Shipping Notice (ASN)
   - ASN creation
   - Customer notification

4. Proof of Delivery (POD)
   - POD capture
   - Signature/photo
   - Confirmation workflow

5. Transport Management
   - Transporter master
   - Vehicle assignment
   - Tracking

6. Transfer Slips
   - Inter-location transfers
   - Gate pass generation

**Key Files to Document:**
- Routes: dispatch.routes.ts, asn.routes.ts, transport.routes.ts
- Pages: DispatchList.tsx, DispatchPOD.tsx

---

### 4. TESTING_QUALITY_GUIDE.md (~25KB)

**Purpose:** Document quality control and testing procedures

**Sections:**
1. Quality Management Overview
   - QC stages
   - Testing types

2. Fabric Physical Testing (FPT)
   - Test parameters
   - Lab procedures
   - Results recording

3. Garment Physical Testing (GPT)
   - Test templates
   - AQL-based sampling
   - Pass/fail criteria

4. Testing Labs Management
   - Lab master data
   - Equipment tracking
   - Calibration

5. Test Templates
   - Creating templates
   - Parameter configuration
   - Standard values

6. Inspection Workflow
   - Pre-production
   - In-line
   - Final inspection
   - Audit

**Key Files to Document:**
- Routes: fabric-physical-tests.routes.ts, testing-labs.routes.ts
- Pages: FabricPhysicalTests.tsx, TestTemplateForm.tsx

---

## PROJECT_BIBLE.md Updates

Add a new section linking to the module guides:

```markdown
## Module-Specific Guides

For detailed documentation on specific modules, see these dedicated guides:

| Guide | Purpose |
|-------|---------|
| [PRODUCTION_PIPELINE_GUIDE.md](PRODUCTION_PIPELINE_GUIDE.md) | Cutting, Stitching, Finishing, Processing workflows |
| [STOCK_MANAGEMENT_GUIDE.md](STOCK_MANAGEMENT_GUIDE.md) | All stock tables and when to use each |
| [DISPATCH_LOGISTICS_GUIDE.md](DISPATCH_LOGISTICS_GUIDE.md) | Dispatch, ASN, POD, Transport |
| [TESTING_QUALITY_GUIDE.md](TESTING_QUALITY_GUIDE.md) | QC procedures, testing labs, inspections |
| [FABRIC_COSTING_GUIDE.md](FABRIC_COSTING_GUIDE.md) | Fabric costing & processor rate cards |
| [CAD_PLANNING_GUIDE.md](CAD_PLANNING_GUIDE.md) | CAD planning module |
| [GST_GUIDE.md](GST_GUIDE.md) | Indian GST compliance |
```

---

## Implementation Order

1. **Create PRODUCTION_PIPELINE_GUIDE.md** (most complex, highest risk)
   - Research production route files
   - Document workflows with diagrams
   - Link relevant pages/controllers

2. **Create STOCK_MANAGEMENT_GUIDE.md** (high confusion risk)
   - Analyze all stock tables
   - Create clear decision tree
   - Document transaction flows

3. **Create DISPATCH_LOGISTICS_GUIDE.md**
   - Document dispatch workflow
   - Cover ASN/POD procedures

4. **Create TESTING_QUALITY_GUIDE.md**
   - Document testing procedures
   - Cover lab management

5. **Update PROJECT_BIBLE.md**
   - Add Module-Specific Guides section
   - Update Table of Contents
   - Add cross-links

6. **Update CLAUDE.md**
   - Add new guides to documentation table

---

## Estimated Effort

| Document | Research | Writing | Total |
|----------|----------|---------|-------|
| PRODUCTION_PIPELINE_GUIDE | 30 min | 45 min | 75 min |
| STOCK_MANAGEMENT_GUIDE | 20 min | 30 min | 50 min |
| DISPATCH_LOGISTICS_GUIDE | 15 min | 25 min | 40 min |
| TESTING_QUALITY_GUIDE | 15 min | 20 min | 35 min |
| PROJECT_BIBLE updates | 5 min | 10 min | 15 min |
| **Total** | **85 min** | **130 min** | **~3.5 hours** |

---

## Success Criteria

- [ ] 4 new module guides created
- [ ] Each guide has: overview, workflows, API reference, key files
- [ ] PROJECT_BIBLE.md updated with links to new guides
- [ ] CLAUDE.md documentation table updated
- [ ] All new guides follow same format as existing guides
- [ ] Documentation coverage increased to ~75%
