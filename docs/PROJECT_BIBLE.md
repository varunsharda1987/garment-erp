# Kashaya Fabs Garment ERP - Project Bible

> **The Complete System Documentation**
> **Last Updated:** January 15, 2026
> **Version:** 3.1

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [System Overview](#2-system-overview)
3. [Architecture](#3-architecture)
4. [Database Design](#4-database-design)
5. [Major Modules](#5-major-modules)
   - 5.1 [Style Management](#51-style-management)
   - 5.2 [Fabric & Material Management](#52-fabric--material-management)
   - 5.3 [Order Management](#53-order-management)
   - 5.4 [Inventory & Stock](#54-inventory--stock)
   - 5.5 [Manufacturing & Processing](#55-manufacturing--processing)
   - 5.6 [Costing & Financial](#56-costing--financial)
   - 5.7 [Quality Management](#57-quality-management)
6. [Module-Specific Guides](#module-specific-guides)
7. [API Reference](#7-api-reference)
8. [Frontend Guide](#8-frontend-guide)
9. [Developer Tools](#9-developer-tools)
   - 9.1 [Custom Skills](#91-custom-skills)
   - 9.2 [Automated Hooks](#92-automated-hooks)
   - 9.3 [MCP Servers](#93-mcp-servers)
10. [Deployment & Operations](#10-deployment--operations)
11. [Troubleshooting](#11-troubleshooting)
12. [Appendix](#12-appendix)
13. [System Architecture (Detailed)](#13-system-architecture-detailed)
   - 13.1 [Polymorphic Material Design](#131-polymorphic-material-design)
   - 13.2 [Material Type Taxonomy](#132-material-type-taxonomy-13-types)
   - 13.3 [Material Naming Conventions](#133-material-naming-conventions)
   - 13.4 [Fabric Hierarchy](#134-fabric-hierarchy)
   - 13.5 [Stock Movement System](#135-stock-movement-system)
   - 13.6 [Job Work Processing System](#136-job-work-processing-system)
   - 13.7 [Virtual JOB_WORK Warehouse](#137-virtual-job_work-warehouse)
   - 13.8 [Brand-Linked Labels and Packaging](#138-brand-linked-labels-and-packaging)
14. [Product Flow (Complete End-to-End)](#14-product-flow-complete-end-to-end)

---

## 1. Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+
- Git

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd garment-erp

# Setup Backend
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Setup Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Access URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React application |
| Backend API | http://localhost:5000 | Express API server |
| API Health | http://localhost:5000/health | Health check endpoint |
| API Docs | http://localhost:5000/api-docs | Swagger documentation |

### Environment Variables

**Backend (.env):**
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/garment_erp"
JWT_SECRET="your-64-char-secret"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"
```

**Frontend (.env):**
```bash
VITE_API_URL=http://localhost:5000/api
```

---

## 2. System Overview

### What is Kashaya Fabs ERP?

A comprehensive Enterprise Resource Planning system designed specifically for garment manufacturing. It covers the complete lifecycle from style creation through production, quality control, and financial management.

### Key Statistics

| Metric | Count |
|--------|-------|
| Database Models | 150+ |
| API Endpoints | 500+ |
| Frontend Pages | 156+ |
| Route Files | 100+ |
| Service Files | 80+ |

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI |
| Backend | Node.js, Express, Prisma ORM |
| Database | PostgreSQL 15+ |
| Testing | Playwright (E2E), Jest (Unit) |
| AI Integration | Claude, Gemini, OpenAI (configurable) |

### Project Structure

```
garment-erp/
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/           # 156+ page components
│   │   ├── components/      # Reusable UI components
│   │   ├── services/        # API client services
│   │   ├── types/           # TypeScript interfaces
│   │   └── hooks/           # Custom React hooks
│   └── tests/               # E2E tests (Playwright)
├── backend/                  # Node.js + Express + Prisma
│   ├── src/
│   │   ├── controllers/     # 80+ controllers
│   │   ├── routes/          # 100+ route files
│   │   ├── services/        # 80+ service files
│   │   ├── types/           # TypeScript definitions
│   │   └── utils/           # Utilities (serializer)
│   └── prisma/
│       ├── schema.prisma    # Database schema
│       └── seeds/           # Seed data scripts
├── docs/                    # Documentation
└── scripts/                 # Skills & automation
```

---

## 3. Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│              React + TypeScript + Vite                       │
│                 (Port 5173)                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/REST
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│              Express + Prisma ORM                            │
│                 (Port 5000)                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Routes   │→ │Controllers│→ │ Services │→ │  Prisma  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │ Prisma Client
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL                              │
│                    (Port 5432)                               │
│                   150+ Tables                                │
└─────────────────────────────────────────────────────────────┘
```

### Critical: API Response Serialization

The backend uses a serializer (`backend/src/utils/serializer.ts`) that automatically converts ALL snake_case keys to camelCase before sending responses.

**What this means:**
- Database/Prisma uses snake_case: `brand_categories`, `style_components`
- API responses use camelCase: `brandCategories`, `styleComponents`
- **Frontend MUST use camelCase** when accessing API response data

```typescript
// WRONG - snake_case won't work in frontend
const category = style.brand_categories?.category;

// CORRECT - use camelCase
const category = style.brandCategories?.category;
```

### Data Flow

```
User Action → React Component → API Service → Backend Route
     ↓                                              ↓
  UI Update ← camelCase Response ← Serializer ← Prisma (snake_case)
```

---

## 4. Database Design

### Core Entity Groups

| Group | Models | Description |
|-------|--------|-------------|
| Core | Users, Audit Logs | Authentication & tracking |
| Masters | Colors, Sizes, Components, Locations | Reference data |
| Styles | Styles, Variants, Fabrics, Components | Product definitions |
| Procurement | Suppliers, POs, GRN | Material purchasing |
| Inventory | Stock Levels, Movements, Warehouses | Stock tracking |
| Manufacturing | Batches, Stages, Samples | Production workflow |
| Costing | Style Costing, Order Costing | Cost management |
| Quality | Tests, Labs, Inspections | Quality control |
| Financial | Invoices, Quotations, Accounting | Finance |
| Materials | Lace, Buttons, Threads, Zippers, Elastics | Trim masters |
| GST | States, Cities, Tax Masters | Tax compliance |

### Key Relations

```
styles
├── style_variants (colors × sizes)
├── style_fabrics (fabric specifications)
├── style_components (pattern parts)
├── style_material_bom (bill of materials)
└── fabric_width_cad (CAD measurements)

orders
├── order_items (line items)
├── order_item_breakup (SKU breakdown)
└── work_orders (production)

fabric_master
├── greige_master (raw fabric)
├── fabric_stock (inventory)
└── processor_rate_card (processing costs)
```

### Database Commands

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Open Prisma Studio (GUI)
npx prisma studio

# Reset database (DESTRUCTIVE!)
npx prisma migrate reset
```

---

## 5. Major Modules

### 5.1 Style Management

**Purpose:** Manage garment designs as reusable templates.

**Key Features:**
- Style creation with variants (colors × sizes)
- Fabric specifications and CAD planning
- Pattern part management
- Material BOM integration
- Bulk import capabilities

**Key Files:**
- Backend: `style.routes.ts`, `style.controller.ts`, `style.service.ts`
- Frontend: `StyleFormRedesigned.tsx`, `StyleDetail.tsx`

**Data Flow:**
```
Style → Variants → Components → Fabrics → BOM → Costing
```

### 5.2 Fabric & Material Management

**Purpose:** Manage all fabric and trim materials.

**Key Features:**
- Fabric master with specifications (GSM, width, composition)
- Greige (raw fabric) management
- Processor rate cards with quantity slabs
- Fabric costing calculator with 3 strategies:
  1. Stock Reuse - Use existing warehouse stock
  2. Ready Fabric - Purchase finished fabric
  3. Greige + Processing - Buy greige and process

**Fabric Costing Workflow:**
```
Select Style → Choose Fabrics → Select Sourcing Strategy
       ↓              ↓                    ↓
  Auto-populate   Enter costs      Calculate total
       ↓              ↓                    ↓
              Save with Purpose (PLANNING/COSTING/PRODUCTION)
```

**See:** [FABRIC_COSTING_GUIDE.md](FABRIC_COSTING_GUIDE.md) for complete details.

### 5.3 Order Management

**Purpose:** Customer orders and production tracking.

**Key Features:**
- Order creation with style references
- Color × Size breakdown matrix
- Delivery requirements tracking
- Work order generation
- Dispatch and fulfillment

**Order Lifecycle:**
```
Customer Inquiry → Sample Development → Costing → Quotation
        ↓
   Order Entry → BOM Creation → Material Procurement
        ↓
   Production Planning → Execution → QC → Packing → Dispatch
```

### 5.4 Inventory & Stock

**Purpose:** Multi-warehouse inventory management.

**Key Features:**
- Stock level tracking by warehouse
- Stock movements (in/out/transfer)
- Physical stock counting
- Batch/lot tracking
- Reservation management
- FIFO/FEFO support

**Stock Transaction Types:**
- PURCHASE - Material receipt
- ISSUE - Production consumption
- TRANSFER - Inter-warehouse movement
- ADJUSTMENT - Physical count variance
- RETURN - Customer/supplier returns

### 5.5 Manufacturing & Processing

**Purpose:** Production workflow management.

**Sub-modules:**
| Stage | Description |
|-------|-------------|
| Sample | Prototype creation and tracking |
| Cutting | Fabric cutting by batch |
| Stitching | Assembly operations |
| Finishing | Final treatments |
| Printing/Dyeing | Fabric processing |
| Dispatch | Delivery management |

**Processing Batch Workflow:**
```
Create Batch → Assign Stage → Track Movement → Complete Delivery
```

### 5.6 Costing & Financial

**Purpose:** Cost estimation and financial management.

**Key Features:**
- Style costing (material, labor, overhead)
- Order costing and quotations
- Invoice generation with GST
- Cost center management
- Payment tracking

**Cost Sheet Components:**
```
Fabric Cost + Trim Cost + CMT Cost + Value Loss + Markup = Final Price
```

**See:** [GST_GUIDE.md](GST_GUIDE.md) for tax compliance.

### 5.7 Quality Management

**Purpose:** Quality control throughout production.

**Key Features:**
- Test template management
- Fabric physical testing (FPT)
- Garment physical testing (GPT)
- Testing lab management
- AQL-based inspections

---

## Module-Specific Guides

For detailed documentation on specific modules, see these dedicated guides:

### Core Business Modules

| Guide | Purpose | Key Topics |
|-------|---------|------------|
| [STYLEFORM_GUIDE.md](STYLEFORM_GUIDE.md) | Style creation workflow | 4-Tab Workflow, Component Selection, Fabric/Trim/Accessory Setup, Presets |
| [MATERIALS_MASTER_GUIDE.md](MATERIALS_MASTER_GUIDE.md) | Material masters & supplier linking | 13 Trim Masters, Material Categories, Supplier Linking, Import/Export |
| [BOM_MRP_GUIDE.md](BOM_MRP_GUIDE.md) | Bill of Materials & MRP | BOM Creation, Material Requirement Planning, Requirement to PO |
| [ORDER_PROCUREMENT_GUIDE.md](ORDER_PROCUREMENT_GUIDE.md) | Order management & procurement | Order Lifecycle, PO Workflow, GRN Process, Order to Work Order |
| [SAMPLE_EMBROIDERY_GUIDE.md](SAMPLE_EMBROIDERY_GUIDE.md) | Sample management & embroidery | 5 Sample Types, Embroidery Send-Out, Lab Dips, CAD Placement |
| [FINANCIAL_ACCOUNTING_GUIDE.md](FINANCIAL_ACCOUNTING_GUIDE.md) | Financial & accounting | Chart of Accounts, Invoicing, Payments, Multi-Currency |

### Workflow & Process Guides

| Guide | Purpose | Key Topics |
|-------|---------|------------|
| [PRODUCTION_PIPELINE_GUIDE.md](PRODUCTION_PIPELINE_GUIDE.md) | Production workflow | Work Orders, Cutting, Stitching, Finishing, Processing |
| [STOCK_MANAGEMENT_GUIDE.md](STOCK_MANAGEMENT_GUIDE.md) | Inventory & stock tables | fabric_stock, greige, embroidery, inventory, transactions |
| [DISPATCH_LOGISTICS_GUIDE.md](DISPATCH_LOGISTICS_GUIDE.md) | Shipping & delivery | Delivery Notes, ASN, POD, Transport, Transfer Slips |
| [TESTING_QUALITY_GUIDE.md](TESTING_QUALITY_GUIDE.md) | Quality control | FPT, GPT, Testing Labs, Test Templates, AQL |

### Specialized Modules

| Guide | Purpose | Key Topics |
|-------|---------|------------|
| [FABRIC_COSTING_GUIDE.md](FABRIC_COSTING_GUIDE.md) | Fabric costing | 3 Costing Strategies, Processor Rate Cards (Matrix UI), Greige Pricing |
| [CAD_PLANNING_GUIDE.md](CAD_PLANNING_GUIDE.md) | CAD planning module | CAD Averages, 3 Purposes (PRODUCTION/PLANNING/COSTING), Approval Workflow |
| [GST_GUIDE.md](GST_GUIDE.md) | Tax compliance | Indian GST, State Codes, Tax Calculations |
| [AI_ASSISTANT_GUIDE.md](AI_ASSISTANT_GUIDE.md) | AI integration | Claude/Gemini/OpenAI, Process Guides, Context Management |

### Architecture & Design

| Guide | Purpose | Key Topics |
|-------|---------|------------|
| [MODULE_RELATIONSHIPS_GUIDE.md](MODULE_RELATIONSHIPS_GUIDE.md) | Module interlinking & data flows | 200+ Relationships, Data Flow Diagrams, Integration Patterns, Quick Reference |
| [plans/](plans/) | Implementation planning documents | Design decisions, architectural choices, reference documents (3 active plans, ~120KB) |
| [plans/archive/](plans/archive/) | Consolidated implementation plans | Historical reference for features now documented in main guides (15 executed plans) |

### Developer Reference

| Guide | Purpose | Key Topics |
|-------|---------|------------|
| [GLOSSARY.md](GLOSSARY.md) | Industry terminology | 180+ garment industry terms and definitions |
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | Development standards | TypeScript patterns, API design, testing guidelines |
| [CLAUDE.md](CLAUDE.md) | Developer instructions | Serialization, Skills, Hooks, MCP Servers |

---

## 7. API Reference

### Base URL

```
http://localhost:5000/api
```

### Authentication

All protected endpoints require JWT token:
```
Authorization: Bearer <token>
```

### Key Endpoints

| Module | Base Route | Operations |
|--------|-----------|------------|
| Auth | `/auth` | Login, Register, Refresh |
| Styles | `/styles` | CRUD, Variants, BOM |
| Orders | `/orders` | CRUD, Items, Breakup |
| Fabrics | `/fabrics` | CRUD, Stock |
| Fabric Costing | `/fabric-costing` | Calculate, Save, Approve |
| Customers | `/customers` | CRUD, GST Numbers |
| Suppliers | `/suppliers` | CRUD, Rate Cards |
| Inventory | `/stock-levels` | Query, Adjust |
| Processing | `/processing-batches` | CRUD, Stages |
| Invoices | `/invoices` | CRUD, GST Calc |
| Locations | `/locations` | States, Cities |
| GST | `/gst` | Validate, Calculate |

### Response Format

All responses are automatically serialized:
- snake_case → camelCase
- BigInt → String
- Date → ISO String

### Pagination

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## 8. Frontend Guide

### Component Architecture

```
App.tsx
├── Layout (Sidebar, Header)
├── Routes (lazy-loaded pages)
└── Context Providers (Auth, Theme)
```

### Key UI Patterns

**Form Pattern:**
- React Hook Form for validation
- Zod schemas for type safety
- Controlled inputs with state

**List Pattern:**
- DataTable with sorting/filtering
- Pagination component
- Search/filter sidebar

**Detail Pattern:**
- Card-based layout
- Tab navigation for sections
- Action buttons in header

### Design System

| Element | Library |
|---------|---------|
| Components | Shadcn UI |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Charts | Recharts |
| Forms | React Hook Form + Zod |

### Creating New Pages

1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/routes/lazy-routes.tsx`
3. Add navigation in `frontend/src/components/Sidebar.tsx`
4. Create service in `frontend/src/services/`
5. Add types in `frontend/src/types/`

---

## 9. Developer Tools

### 9.1 Custom Skills

Five automation skills for common development tasks:

| Skill | Command | Purpose |
|-------|---------|---------|
| `/sync-types` | `node scripts/skills/sync-types.js` | Type synchronization validation |
| `/db-workflow` | `node scripts/skills/db-workflow.js` | Database operations |
| `/test-all` | `node scripts/skills/test-all.js` | Unified test execution |
| `/api-docs` | `node scripts/skills/api-docs.js` | API documentation |
| `/commit-smart` | `node scripts/skills/commit-smart.js` | Smart commit messages |

**Daily Workflow:**
```bash
# Before starting work
node scripts/skills/sync-types.js --report

# After making changes
node scripts/skills/sync-types.js --check
node scripts/skills/test-all.js --all
node scripts/skills/commit-smart.js --generate
```

### 9.2 Automated Hooks

Four hooks enforce quality standards:

| Hook | Triggers | Blocks? | Purpose |
|------|----------|---------|---------|
| `post-type-change` | Type files change | No | Auto-validate type sync |
| `pre-commit` | Before commit | Yes | TypeScript + type sync |
| `pre-migration` | Before migration | Yes | Schema validation |
| `post-docs-update` | Docs change | No | Link validation |

**Manual Testing:**
```bash
node scripts/hooks/post-type-change.js
node scripts/hooks/pre-commit.js
node scripts/hooks/pre-migration.js
node scripts/hooks/post-docs-update.js
```

### 9.3 MCP Servers

Four Model Context Protocol servers for intelligent assistance:

| Server | Purpose |
|--------|---------|
| `prisma-server` | Schema analysis (195 models) |
| `typescript-server` | Type intelligence |
| `database-server` | Read-only DB queries |
| `docs-server` | Documentation search |

---

## 10. Deployment & Operations

### Production Checklist

**Security:**
- [ ] Generate strong JWT_SECRET (64+ chars)
- [ ] Use strong database credentials
- [ ] Enable SSL for database
- [ ] Set NODE_ENV="production"
- [ ] Configure CORS properly

**Database:**
- [ ] Run production migrations
- [ ] Verify indexes
- [ ] Configure backups
- [ ] Set up connection pooling

### Docker Deployment

```bash
# Build and start
docker-compose --env-file .env.docker up -d

# Run migrations
docker-compose exec backend npx prisma migrate deploy

# View logs
docker-compose logs -f
```

### Manual Deployment

```bash
# Build backend
cd backend
npm install --production
npm run build
npx prisma generate

# Build frontend
cd frontend
npm install --production
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production
```

### Health Checks

```bash
# Basic health
curl http://localhost:5000/health

# Readiness (includes DB)
curl http://localhost:5000/health/readiness

# Metrics
curl http://localhost:5000/health/metrics
```

---

## 11. Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check PostgreSQL is running
systemctl status postgresql

# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
psql -U postgres -d garment_erp
```

#### Type Synchronization Issues
```bash
# Run sync check
node scripts/skills/sync-types.js --check

# View detailed report
node scripts/skills/sync-types.js --report
```

#### Frontend Can't Connect to Backend
```bash
# Check backend is running
curl http://localhost:5000/health

# Verify VITE_API_URL
cat frontend/.env
```

#### Prisma Migration Failed
```bash
# Check migration status
npx prisma migrate status

# Generate client
npx prisma generate

# Force deploy (careful!)
npx prisma migrate deploy --force
```

#### Processing Cost Showing 0
- Verify rate card exists for greige and quantity
- Check fabric has greigeId set
- Select processor and click refresh

---

## 12. Appendix

### Related Documentation

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](CLAUDE.md) | Claude Code development instructions |
| [FABRIC_COSTING_GUIDE.md](FABRIC_COSTING_GUIDE.md) | Complete fabric costing system |
| [CAD_PLANNING_GUIDE.md](CAD_PLANNING_GUIDE.md) | CAD planning module |
| [GST_GUIDE.md](GST_GUIDE.md) | Indian GST compliance |
| [GLOSSARY.md](GLOSSARY.md) | Industry terminology (180+ terms) |
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | Development standards |

### GST State Codes (Common)

| Code | State | Code | State |
|------|-------|------|-------|
| 07 | Delhi | 27 | Maharashtra |
| 09 | Uttar Pradesh | 29 | Karnataka |
| 24 | Gujarat | 33 | Tamil Nadu |

### Material Categories

| Category | Examples |
|----------|----------|
| Fabric | Main body material |
| Trim | Buttons, zippers, elastic |
| Thread | Sewing threads |
| Label | Brand, care, size labels |
| Packaging | Polybags, boxes, hangers |

### Status Flows

**Order Status:**
```
DRAFT → CONFIRMED → IN_PRODUCTION → COMPLETED → DISPATCHED
```

**Costing Workflow:**
```
PLANNING → COSTING → PRODUCTION (locked)
```

**Stock Movement:**
```
PENDING → APPROVED → COMPLETED
```

---

## 13. System Architecture (Detailed)

### 13.1 Polymorphic Material Design

The ERP uses a sophisticated polymorphic material system:

```prisma
model materials {
  id             String       @id
  code           String       @unique
  name           String
  materialType   MaterialType @default(GENERIC)

  // Polymorphic Foreign Keys (only ONE is set based on materialType)
  greigeId       String?      // → greige_master (GREIGE_FABRIC)
  fabricId       String?      // → fabric_master (FINISHED_FABRIC)
  laceId         String?      // → lace_master (LACE)
  buttonId       String?      // → button_master (BUTTON)
  threadId       String?      // → thread_master (THREAD)
  zipperId       String?      // → zipper_master (ZIPPER)
  elasticId      String?      // → elastic_master (ELASTIC)
  labelId        String?      // → label_master (LABEL)
  packagingId    String?      // → packaging_master (PACKAGING)
}
```

#### System Evolution: From Dedicated Tables to Unified BOM

**Phase 1 (Original Design):** Simple dedicated tables
- `style_garment_trims` - Direct trim storage with basic fields
- Limited to simple text fields (trimName, trimType, quantity)
- No links to actual material masters

**Phase 2 (Current Design):** Unified polymorphic BOM system
- `style_material_bom` - Universal material linkage system
- Links to actual material masters (button_master, lace_master, thread_master, etc.)
- Supports multiple usage categories: GARMENT_TRIM, PACKAGING, etc.
- Direct foreign keys to each material type for performance
- All material masters have `style_material_bom[]` relations

**Migration Approach:**
- Legacy tables like `style_garment_trims` were left in schema for historical data
- New implementations use `style_material_bom` exclusively
- Frontend components query the new system
- Safer than destructive migrations

**Key Lesson:** When data source mismatches occur (save to Table A, read from Table B), check for deprecated tables that were superseded by newer polymorphic systems.

### 13.2 Material Type Taxonomy (13 Types)

```
FABRICS
├── GREIGE_FABRIC → greige_master (raw unfinished fabric)
└── FINISHED_FABRIC → fabric_master (dyed/printed fabric)

TRIMS & ACCESSORIES
├── TRIMS (generic category)
├── LACE → lace_master
├── BUTTON → button_master
├── THREAD → thread_master
├── ZIPPER → zipper_master
├── ELASTIC → elastic_master
├── LABEL → label_master
├── PACKAGING → packaging_master
└── ACCESSORIES (generic - tags, hangers, poly bags)

OTHER
├── GENERIC (no specialized master)
└── SERVICE (subcontracting services)
```

### 13.3 Material Naming Conventions

| Material Type | Code Field | Example | Master Table |
|---------------|------------|---------|--------------|
| Greige Fabric | `greigeCode` | "GRG-001" | `greige_master` |
| Finished Fabric | `fabricCode` | "FAB-001" | `fabric_master` |
| Lace | `laceCode` | "LACE-0001" | `lace_master` |
| Button | `buttonCode` | "BTN-0001" | `button_master` |
| Thread | `threadCode` | "THD-0001" | `thread_master` |
| Zipper | `zipperCode` | "ZIP-0001" | `zipper_master` |
| Elastic | `elasticCode` | "ELS-0001" | `elastic_master` |
| Label | `labelCode` | "LBL-0001" | `label_master` |
| Packaging | `packagingCode` | "PKG-0001" | `packaging_master` |

### 13.4 Fabric Hierarchy

```
greige_master (raw fabric)
    ↓ Processing (dyeing/printing)
fabric_master (finished fabric)
    ↓ Multiple widths
fabric_width_cad (CAD consumption per width)
```

### 13.5 Stock Movement System

**Core Tables:**
- `stock_movements` - Audit trail of all transactions
- `stock_transactions` - Cost/valuation tracking (weighted average)
- `stock_levels` - Current inventory by warehouse

**Stock Transaction Types:**
- PURCHASE - Material receipt
- ISSUE - Production consumption
- TRANSFER - Inter-warehouse movement
- ADJUSTMENT - Physical count variance
- RETURN - Customer/supplier returns

### 13.6 Job Work Processing System

```
┌─────────────────────────────────┐
│ processing_batch                │
│ - batchNumber: PB2511-0001      │
│ - materialType: GREIGE          │
│ - totalQuantitySent: 1000m      │
│ - overallStatus: ACTIVE         │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ processing_stage                │
│ - stageNumber: 1                │
│ - processorId: MILL-001         │
│ - processingType: DYEING        │
│ - status: PENDING               │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ processing_movement             │
│ - movementType: WAREHOUSE_TO_   │
│   PROCESSOR                     │
│ - status: IN_TRANSIT            │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ processing_delivery             │
│ - deliveryNumber: DEL-2024-001  │
│ - quantityAccepted: 400m        │
│ - qualityStatus: ACCEPTED       │
└─────────────────────────────────┘
```

### 13.7 Virtual JOB_WORK Warehouse

```
enum WarehouseType {
  RAW_MATERIAL
  FINISHED_GOODS
  WORK_IN_PROGRESS
  GENERAL
  TRANSIT
  JOB_WORK          ← Virtual warehouse for all processor inventory
}
```

**Purpose:**
- Represents ALL materials at external processors
- Not a physical location
- Tracks total value of materials in job work
- Enables inventory reports

### 13.8 Brand-Linked Labels and Packaging

**Purpose:** Support multi-brand customers where each brand requires specific labels and packaging.

#### The Challenge

One customer can have multiple brands (e.g., H&M operates H&M, COS, Monki, Weekday brands), and each brand needs:
- **Brand-specific labels** - Different washcare, main labels, price tags
- **Brand-specific packaging** - Different poly bags, boxes, hangers
- **Brand-specific presets** - Quick-apply standard combinations

#### Database Implementation

**Brand Architecture:**
- Brands are NOT standalone entities
- Implemented via `brand_categories` table combining `customerId` + `brandName` + product category
- Labels and packaging link to both customer AND specific brand via `brandCategoryId`

```prisma
// Labels support brand linking
model label_master {
  customerId      String?
  brandCategoryId String?  // Links to specific brand
  customer        customers? @relation(fields: [customerId])
  brandCategory   brand_categories? @relation(fields: [brandCategoryId])
}

// Packaging supports brand linking
model packaging_master {
  customerId      String?
  brandCategoryId String?  // Links to specific brand
  customer        customers? @relation(fields: [customerId])
  brandCategory   brand_categories? @relation(fields: [brandCategoryId])
}
```

#### Label Categories

Labels are categorized by usage:
- **SEWN_IN** - Care/size labels sewn into garment (used in Trims)
- **HANGTAG** - Removable retail tags (used in Accessories)
- **PRICE_TAG** - Price display tags (used in Accessories)

#### Multi-Supplier Support

Both labels and packaging support multiple suppliers per item:
- Per-supplier pricing (pricePerPiece, pricePerHundred)
- Mark preferred supplier
- Junction tables: `label_suppliers`, `packaging_suppliers`

#### Label & Packaging Journey

**Phase 1: Master Creation**
1. Create label in **Label Master** (`LabelForm.tsx`)
   - Auto-generated code: `LBL-XXXXXX`
   - Select customer and brand
   - Choose label type (washcare, size, brand, hangtag, etc.)
   - Add multiple suppliers with pricing
2. Create packaging in **Packaging Master** (`PackagingForm.tsx`)
   - Auto-generated code: `PKG-XXXXXX`
   - Select customer and brand
   - Choose packaging type (poly bag, carton, hanger, etc.)
   - Add multiple suppliers

**Phase 2: Customer Presets**
1. Navigate to **Customer Form** → Accessories Presets tab
2. Create brand-specific presets (e.g., "H&M Standard", "COS Premium")
3. Add labels and packaging items using MaterialBOMPicker
4. Set one preset as **default** (auto-applies to new styles)
5. Store in `customer_accessories_presets` table as JSON

**Phase 3: Style Form Usage**
1. Open **StyleForm** → Accessories tab
2. If default preset exists, items auto-populate
3. User can modify quantities or add/remove items
4. Save to `style_material_bom` with `usageCategory: 'PACKAGING'`

#### Example: Multi-Brand Setup

```
Customer: H&M Group
├── Brand: H&M
│   ├── Label: "H&M Washcare Label" (SEWN_IN)
│   ├── Label: "H&M Price Tag" (PRICE_TAG)
│   └── Packaging: "H&M Polybag" (standard)
├── Brand: COS
│   ├── Label: "COS Premium Washcare" (SEWN_IN)
│   ├── Label: "COS Hangtag" (HANGTAG)
│   └── Packaging: "COS Premium Box" (gift box)
└── Brand: Monki
    ├── Label: "Monki Eco Label" (SEWN_IN)
    └── Packaging: "Monki Recycled Bag" (eco-friendly)
```

#### Key Features

1. **Auto-Generated Names** - Labels/packaging names generated from brand + type + attributes
2. **Multi-Supplier Pricing** - Compare costs across suppliers
3. **Customer Presets** - Quick-apply standard combinations per brand
4. **Default Presets** - Auto-populate on style creation
5. **MaterialBOMPicker** - Unified component for selecting labels/packaging across forms

#### Related Tables

- `label_master` - Label definitions
- `packaging_master` - Packaging definitions
- `label_suppliers` - Label-supplier pricing junction
- `packaging_suppliers` - Packaging-supplier pricing junction
- `brand_categories` - Brand definitions
- `customer_accessories_presets` - Per-brand preset combinations
- `style_material_bom` - Final usage in styles (usageCategory: 'PACKAGING')
- `materials` - Generic polymorphic entry (materialType: 'LABEL' or 'PACKAGING')

---

## 14. Product Flow (Complete End-to-End)

### 14.1 Complete Garment Production Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Style       │ →   │  2. Sample      │ →   │  3. BOM         │
│  Creation       │     │  Development    │     │  Finalization   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  4. Costing     │ →   │  5. Quotation   │ →   │  6. Order       │
│  & Pricing      │     │  Approval       │     │  Entry          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  7. Material    │ →   │  8. Procurement │ →   │  9. Production  │
│  Planning       │     │  (PO/GRN)       │     │  Planning       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  10. Cutting    │ →   │  11. Stitching  │ →   │  12. Finishing  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ↓                       ↓                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  13. Quality    │ →   │  14. Packing    │ →   │  15. Dispatch   │
│  Control        │     │                 │     │  & Invoicing    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 14.2 Stage Details

| Stage | Description | Key Tables | Status Values |
|-------|-------------|------------|---------------|
| Style Creation | Create garment design template | styles, style_variants | DRAFT, ACTIVE |
| Sample Development | Create prototype samples | samples | REQUESTED → APPROVED |
| BOM Finalization | Finalize bill of materials | style_material_bom | - |
| Costing & Pricing | Calculate production cost | style_costing | DRAFT → APPROVED |
| Quotation Approval | Get customer approval | quotations | DRAFT → ACCEPTED |
| Order Entry | Record customer order | orders, order_items | PENDING → CONFIRMED |
| Material Planning | Plan material requirements | - | - |
| Procurement | Purchase materials | purchase_orders, grn | DRAFT → RECEIVED |
| Production Planning | Create work orders | work_orders | PENDING → IN_PROGRESS |
| Cutting | Cut fabric pieces | cutting_batches | - |
| Stitching | Assemble garments | stitching_batches | - |
| Finishing | Final treatments | finishing_batches | - |
| Quality Control | Inspect finished goods | quality_inspections | PENDING → PASS/FAIL |
| Packing | Pack for shipment | packing_lists | - |
| Dispatch & Invoicing | Ship and invoice | delivery_notes, invoices | PENDING → COMPLETED |

### 14.3 Data Flow Integration

```
Style → Variants → Components → Fabrics → BOM → Costing
                                              ↓
Order → Items → Breakup → Work Orders → Batches → QC → Dispatch
```

---

## 15. Design System & UI Standards

### 15.1 Color Palette

**Light Mode:**
| Name | Value | Usage |
|------|-------|-------|
| Primary | `#2563eb` | Buttons, links, accents |
| Secondary | `#64748b` | Secondary text, icons |
| Success | `#22c55e` | Success states |
| Warning | `#f59e0b` | Warning states |
| Error | `#ef4444` | Error states |
| Background | `#ffffff` | Main background |
| Surface | `#f8fafc` | Cards, containers |

**Dark Mode:**
| Name | Value | Usage |
|------|-------|-------|
| Primary | `#3b82f6` | Buttons, links, accents |
| Background | `#0f172a` | Main background |
| Surface | `#1e293b` | Cards, containers |

### 15.2 Typography

| Element | Class | Size |
|---------|-------|------|
| Page Title | `text-2xl font-bold` | 24px |
| Section Header | `text-lg font-semibold` | 18px |
| Body Text | `text-sm` | 14px |
| Small Text | `text-xs` | 12px |

### 15.3 Component Library (Shadcn UI)

| Component | Usage |
|-----------|-------|
| Button | Actions, form submission |
| Card | Content containers |
| Dialog | Modals, confirmations |
| Table | Data display |
| Form | Input fields |
| Select | Dropdowns |
| Badge | Status indicators |
| Toast | Notifications |

### 15.4 Page Layout Patterns

**List Page Pattern:**
```
┌─────────────────────────────────────────────┐
│ Header: Title + Actions                      │
├─────────────────────────────────────────────┤
│ Filters: Search + Dropdowns                  │
├─────────────────────────────────────────────┤
│ DataTable: Sortable columns + Pagination     │
└─────────────────────────────────────────────┘
```

**Detail Page Pattern:**
```
┌─────────────────────────────────────────────┐
│ Header: Title + Back + Actions               │
├─────────────────────────────────────────────┤
│ Tabs: Overview | Details | History           │
├─────────────────────────────────────────────┤
│ Cards: Information grouped by section        │
└─────────────────────────────────────────────┘
```

**Form Page Pattern:**
```
┌─────────────────────────────────────────────┐
│ Header: Title + Cancel + Save                │
├─────────────────────────────────────────────┤
│ Sections: Collapsible groups                 │
│ - Section 1: Basic Info                      │
│ - Section 2: Details                         │
│ - Section 3: Additional                      │
├─────────────────────────────────────────────┤
│ Footer: Cancel + Save buttons                │
└─────────────────────────────────────────────┘
```

---

## 16. Component Groups System

### 16.1 Component Group vs Product Category

| Aspect | Component Group | Product Category |
|--------|----------------|------------------|
| **Purpose** | Physical grouping by garment placement | Business/market categorization |
| **Examples** | TOP, BOTTOM, OUTER, INNER | Ethnic, Western, Fusion, Kids |
| **Usage** | Organize components by body location | Classify products for catalog |
| **User Control** | Fully manageable via UI | Fully manageable via UI |

### 16.2 Database Schema

**component_group_master:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| code | String | Unique code (e.g., "TOP", "BOTTOM") |
| name | String | Display name (e.g., "Top Wear") |
| description | String? | Optional description |
| sortOrder | Int | Display ordering |
| isActive | Boolean | Active status |

**Default Component Groups:**
- TOP (Top Wear) - Upper body garments
- BOTTOM (Bottom Wear) - Lower body garments
- FULL (Full Garment) - Single-piece full body garments
- INNER (Inner Wear) - Undergarments and linings
- OUTER (Outer Wear) - Outerwear and jackets
- ACCESS (Accessory) - Accessories and add-ons

### 16.3 Pattern Parts (Future Feature)

**pattern_part_master:**
- 12 default parts: BODY_FRONT, BODY_BACK, SLEEVE, COLLAR, CUFF, YOKE, POCKET, WAISTBAND, PLACKET, GUSSET, FLAP, LINING
- Backend infrastructure ready
- UI implementation deferred

### 16.4 Product Category Min/Max Components

```typescript
// product_category_master
{
  name: "Co-Ords Set",
  minComponents: 2,  // Minimum required
  maxComponents: 3   // Maximum allowed
}
```

**Examples:**
- T-Shirt: min=1, max=1 (exactly 1)
- Co-Ords Set: min=2, max=3 (2 or 3 components)
- Traditional Set: min=2, max=5 (2-5 components)

### 16.5 API Endpoints

```
GET    /api/component-groups              - List all
POST   /api/component-groups              - Create new
GET    /api/component-groups/:id          - Get by ID
PUT    /api/component-groups/:id          - Update
DELETE /api/component-groups/:id          - Soft delete
POST   /api/component-groups/reorder      - Reorder
GET    /api/component-groups/:id/components - Get components in group
```

---

## 17. Troubleshooting Guide (Detailed)

### 17.1 Brand Category Missing Issue

**Symptom:** When editing a style, Brand and Brand Category dropdowns show empty.

**Root Cause:** Database has `brandName` (text) populated but `brandCategoryId` (FK) is null.

**Diagnostic Query:**
```sql
SELECT styleCode, brandName, brandCategoryId
FROM styles
WHERE isActive = true AND brandName IS NOT NULL AND brandCategoryId IS NULL;
```

**Fix:** Run migration script:
```bash
cd backend
node fix-style-brand-categories.js
```

### 17.2 Product Category Not Populating

**Symptom:** Product Category dropdown shows empty even though data exists.

**Root Cause:** Backend `getFullDetails()` missing `product_category: true` in include.

**Fix:** Add to `backend/src/services/style.service.ts`:
```typescript
include: {
  brand_categories: true,
  product_category: true,  // ← ADD THIS
}
```

### 17.3 React State Timing Issues

**Symptom:** Console shows data loading but dropdowns show placeholder.

**Root Cause:** Value set before options array populated.

**Fix:** Reorder state updates:
```typescript
// ✓ CORRECT ORDER
setAvailableBrands(uniqueBrands);  // 1. Options first
setBrandName(savedBrandName);       // 2. Value after
```

### 17.4 Quick Diagnostic Checklist

1. **Database Check:**
   - Is `brandCategoryId` null? → Run migration script
   - Is `productCategoryId` null? → Check creation code

2. **API Response Check:**
   - Is `brandCategories` undefined? → Add to backend query
   - Is `productCategory` undefined? → Add to backend query

3. **Frontend State Check:**
   - Options populated? → Check customer data loading
   - Values set after options? → Fix state timing

### 17.5 Processing Cost Showing 0

**Checklist:**
- [ ] Verify rate card exists for greige and quantity
- [ ] Check fabric has greigeId set
- [ ] Select processor and click refresh
- [ ] Verify quantity falls within rate slab

### 17.6 Stock Movement Not Working

**Checklist:**
- [ ] Material exists and is active
- [ ] Warehouse exists and is active
- [ ] Quantity > 0
- [ ] Unit is selected
- [ ] User is authenticated
- [ ] JOB_WORK warehouse exists (for processing)

---

## 18. API Reference (Complete)

### 18.1 Customer Accessory Presets API

**Purpose:** Manage preset accessory combinations per customer for quick selection.

**Endpoints:**
```
GET    /api/customer-accessory-presets
       ?customerId=xxx             - Filter by customer
       &presetName=xxx             - Search by name
       &page=1&limit=20            - Pagination

POST   /api/customer-accessory-presets
       Body: { customerId, presetName, accessories[], isDefault }

GET    /api/customer-accessory-presets/:id

PUT    /api/customer-accessory-presets/:id
       Body: { presetName?, accessories?, isDefault? }

DELETE /api/customer-accessory-presets/:id

GET    /api/customer-accessory-presets/customer/:customerId/default
       Returns default preset for customer
```

**Accessory Object:**
```typescript
interface PresetAccessory {
  accessoryType: 'BUTTON' | 'ZIPPER' | 'ELASTIC' | 'LACE' | 'THREAD';
  masterId: string;      // FK to specific master table
  quantity?: number;
  unit?: string;
  notes?: string;
}
```

### 18.2 Processing API Endpoints

```
GET    /api/processing-batches        - List batches
POST   /api/processing-batches        - Create batch
GET    /api/processing-batches/:id    - Get batch details
GET    /api/processing-batches/summary/job-work - Dashboard summary

POST   /api/processing-stages         - Create stage
POST   /api/processing-movements      - Track movement
POST   /api/processing-deliveries     - Record delivery
```

### 18.3 Stock Movement API

```
GET    /api/stock-movements           - List all
POST   /api/stock-movements/stock-in  - Create stock in
POST   /api/stock-movements/stock-out - Create stock out
POST   /api/stock-movements/transfer  - Create transfer
POST   /api/stock-movements/adjustment - Create adjustment
```

---

## 19. Role-Based UI Implementation Plan

### 19.1 Current System Analysis

**Existing Roles (9):**
- ADMIN
- PRODUCTION_MANAGER
- SALES
- INVENTORY
- ACCOUNTS
- QUALITY
- PURCHASE
- FACTORY_SUPERVISOR
- MERCHANDISER

**Current Limitations:**
- No frontend role-based routing
- Generic navigation for all users
- Single dashboard for everyone
- No conditional UI components

### 19.2 Proposed Implementation

**Phase 1: Foundation**
1. Enhance Auth Store with department
2. Create Permission System
3. Implement Role-Based Route Guards

**Phase 2: Dynamic Navigation**
1. Navigation Configuration per role
2. Sidebar Enhancement (filter by role)
3. Header Updates (role-appropriate actions)

**Phase 3: Role-Specific Dashboards**
1. Merchandising dashboard (styles, samples, CAD)
2. Production dashboard (WIP, machine status)
3. Sales dashboard (orders, delivery status)
4. Inventory dashboard (stock levels, alerts)
5. Quality dashboard (test results, failure rates)

### 19.3 Permission Configuration Example

```typescript
export const RoutePermissions = {
  '/users': ['ADMIN'],
  '/styles': ['ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER'],
  '/styles/new': ['ADMIN', 'MERCHANDISER'],
  '/orders': ['ADMIN', 'SALES', 'MERCHANDISER'],
  '/work-orders': ['ADMIN', 'PRODUCTION_MANAGER', 'FACTORY_SUPERVISOR'],
  '/warehouses': ['ADMIN', 'INVENTORY'],
  '/purchase-orders': ['ADMIN', 'PURCHASE'],
  '/testing': ['ADMIN', 'QUALITY', 'PRODUCTION_MANAGER'],
  '/cost-sheets': ['ADMIN', 'ACCOUNTS', 'MERCHANDISER'],
}

export const NavigationConfig = {
  ADMIN: {
    sections: ['orders', 'manufacturing', 'inventory', 'procurement', 'masters', 'reports', 'settings']
  },
  MERCHANDISER: {
    quickLinks: ['dashboard', 'styles', 'cad-planning', 'samples'],
    sections: ['orders', 'masters']
  },
  PRODUCTION_MANAGER: {
    quickLinks: ['dashboard', 'production-status', 'work-orders'],
    sections: ['manufacturing', 'inventory', 'masters']
  }
}
```

---

## 20. Process Guide Maintenance

### 20.1 Configuration File

**Key File:** `frontend/src/config/processStages.tsx`

The Process Guide page is **completely configuration-driven**:
- All stages defined in `processStages` array
- Master data items in `masterDataItems` array
- Components read from configuration automatically

### 20.2 Adding New Process Stage

```typescript
{
  id: 'quality-inspection',
  order: 16,
  title: 'Quality Inspection',
  icon: <ClipboardCheck className="h-5 w-5" />,
  category: 'production',
  description: 'Perform quality checks on finished garments',
  purpose: 'Ensure all garments meet quality standards',
  prerequisites: [
    {
      stage: 'finishing',
      condition: 'Garments must be completely finished',
      required: true,
    },
  ],
  pages: [
    {
      title: 'Quality Inspection',
      path: '/quality/inspection',
      icon: <ClipboardCheck className="h-4 w-4" />,
    },
  ],
  statusFlow: [
    { from: 'PENDING', to: 'IN_PROGRESS' },
    { from: 'IN_PROGRESS', to: 'PASSED' },
    { from: 'IN_PROGRESS', to: 'FAILED' },
  ],
  databaseModels: ['quality_inspections', 'defects'],
  tips: [
    'Inspect at least 10% of each lot',
    'Document all defects with photos',
  ],
}
```

### 20.3 Adding New Category

1. Update type definition in `processGuide.types.ts`
2. Add category configuration in `processStages.tsx`
3. Add color scheme to `ProcessStageCard.tsx`
4. Add stages with new category

---

## 21. Code Optimization Roadmap

### 21.1 Scoring System

- **Deletion:** 2 points per line
- **Addition:** 1 point per line
- **Target:** Maximize points through smart code reduction

### 21.2 Summary

| Phase | Lines Deleted | Lines Added | Points |
|-------|---------------|-------------|--------|
| Phase 1: Pure Deletions | 4,481 | 0 | **8,962** |
| Phase 2: Generic Abstractions | 4,494 | 510 | **8,478** |
| Phase 3: Code Cleanup | 295 | 0 | **590** |
| **TOTAL** | **9,270** | **510** | **18,030** |

### 21.3 Phase 1: Pure Deletions

**Duplicate UI Components (14 files, 898 lines):**
- Files in `frontend/@/components/ui/` duplicating `src/components/ui/`

**Deprecated Pages:**
- `SupplierForm.old.tsx` (444 lines)

**Dead V1 Rate Card:**
- `processorRateCard.service.ts` (177 lines)
- `processorRateCard.types.ts` (64 lines)

**Migration Scripts (13 files, ~2,045 lines):**
- Archive then delete completed migration scripts

### 21.4 Phase 2: Generic Abstractions

**Material Controllers (5 files → 1 factory):**
- thread.controller.ts, button.controller.ts, lace.controller.ts, zipper.controller.ts, elastic.controller.ts
- Create: `material.controller.factory.ts`

**Material Routes (5 files → 1 factory):**
- Create: `material.routes.factory.ts`

**Material Services (5 files → 1 factory):**
- Create: `material.service.factory.ts`

### 21.5 Phase 3: Code Cleanup

- Remove ~200 lines of commented-out code
- Remove ~50 lines of deprecated type definitions
- Remove unused constants

### 21.6 Future Opportunities

**Large File Refactoring:**
- `StyleFormRedesigned.tsx` (2,740 lines) - split into components
- `style-cad-planning.controller.ts` (4,004 lines) - modularize
- `OrderForm.tsx` (1,585 lines) - extract sections

---

## 22. Project Status & Roadmap

### 22.1 Current Status

**Completion:** ~92%
**Target Go-Live:** Q1 2026

### 22.2 Completed Features

- ✅ Style Management (CRUD, variants, BOM)
- ✅ Fabric & Material Management
- ✅ Order Management
- ✅ Inventory & Stock (multi-warehouse)
- ✅ Manufacturing Pipeline (Cutting, Stitching, Finishing)
- ✅ Quality Management (FPT, GPT)
- ✅ Costing & Pricing
- ✅ GST Compliance (Indian states/cities)
- ✅ Customer & Supplier Management
- ✅ Processing/Job Work
- ✅ CAD Planning Module
- ✅ Fabric Costing Calculator

### 22.3 Pending Tasks

**High Priority:**
- [ ] Role-based UI implementation
- [ ] Dashboard customization per role
- [ ] Report generation module
- [ ] Bulk operations (import/export)

**Medium Priority:**
- [ ] Mobile-responsive improvements
- [ ] Email notifications
- [ ] Document attachments
- [ ] Audit log viewer

**Low Priority:**
- [ ] AI-powered suggestions
- [ ] Advanced analytics
- [ ] API rate limiting
- [ ] Performance optimization

---

## 23. Size Variant Inventory Integration

### 23.1 Overview

Labels can have multiple sizes (XS, S, M, L, XL) with independent stock tracking per size.

### 23.2 Database Architecture

**Core Tables:**
1. `size_categories` - Reusable size templates
2. `label_size_variants` - Size variant junction table
3. `materials` - Extended with `sizeVariantId` field
4. `stock_levels` - Tracks per-variant inventory
5. `stock_movements` - Transaction log per variant

### 23.3 Data Flow

**Creating Labels with Size Variants:**
1. User selects size category (e.g., "Women's Standard")
2. User enables "Auto-generate size variants"
3. Backend creates:
   - Label master record
   - One `label_size_variants` record per size
   - One `materials` record per size variant

**Stock Operations:**
- Stock In/Out at size level (e.g., "LAB-001-M")
- Each size has independent stock balance
- Weighted average costing per size

### 23.4 Benefits

- Independent size tracking
- Full integration with inventory system
- Backward compatibility (labels without variants work as before)
- Flexible size management

---

## 24. Database Schema Reference

### 24.1 Statistics

| Metric | Count |
|--------|-------|
| Total Models | 150+ |
| Total Enums | 44 |
| Schema Lines | 3,073+ |

### 24.2 Key Enums

**UserRole:**
```
ADMIN, PRODUCTION_MANAGER, SALES, INVENTORY, ACCOUNTS,
QUALITY, PURCHASE, FACTORY_SUPERVISOR, MERCHANDISER
```

**OrderStatus:**
```
PENDING, IN_PRODUCTION, COMPLETED, DISPATCHED, CANCELLED
```

**ProductionStage:**
```
CUTTING, STITCHING, FINISHING, CHECKING, PACKING,
IN_PRINTING, IN_DYING, IN_EMBROIDERY, READY_TO_SHIP, SHIPPED
```

**TransactionType:**
```
STOCK_IN, STOCK_OUT, ADJUSTMENT, TRANSFER
```

### 24.3 Auto-Generation

Schema documentation is auto-generated:
```bash
cd backend
npm run docs:schema
```

Regenerate after schema changes:
1. Modify Prisma schema
2. Run `npx prisma migrate dev --name migration_name`
3. Run `npm run docs:schema`
4. Commit both migration and docs

---

## 25. Setup & Installation (Detailed)

### 25.1 Prerequisites

- **Node.js:** 18+
- **PostgreSQL:** 15+
- **Git:** Latest

### 25.2 Database Setup

```bash
# Install PostgreSQL
choco install postgresql  # Windows
brew install postgresql@15  # macOS
sudo apt install postgresql postgresql-contrib  # Linux

# Create database
psql -U postgres
CREATE DATABASE garment_erp;
CREATE USER erp_user WITH ENCRYPTED PASSWORD 'strong_password';
GRANT ALL PRIVILEGES ON DATABASE garment_erp TO erp_user;
```

### 25.3 JWT Secret Generation

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Using OpenSSL
openssl rand -hex 64
```

### 25.4 pgvector Installation (AI Features)

**Option 1: Docker (Recommended)**
```bash
docker run -d \
  --name garment-erp-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=garment_erp \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

**Option 2: Native Installation**
```bash
# Windows PowerShell as Admin
pip install pgxnclient
pgxn install vector
```

### 25.5 Production Deployment Checklist

**Security:**
- [ ] Generate strong JWT_SECRET (64+ chars)
- [ ] Use strong database credentials
- [ ] Enable SSL for database
- [ ] Set NODE_ENV="production"
- [ ] Configure CORS properly

**Database:**
- [ ] Run production migrations
- [ ] Verify indexes
- [ ] Configure backups
- [ ] Set up connection pooling

**Monitoring:**
- [ ] Configure Sentry DSN
- [ ] Set up health check monitoring
- [ ] Enable application logging

### 25.6 Health Check Endpoints

```bash
# Basic health
curl http://localhost:5000/health

# Readiness (includes DB)
curl http://localhost:5000/health/readiness

# System metrics
curl http://localhost:5000/health/metrics
```

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-12 | 3.0 | Initial PROJECT_BIBLE consolidation |
| 2026-01-12 | 3.1 | Added sections 13-25 with detailed content |
| - | - | Section 13: System Architecture (Material system, Job Work) |
| - | - | Section 14: Product Flow (15-stage workflow) |
| - | - | Section 15: Design System (Colors, Typography, Patterns) |
| - | - | Section 16: Component Groups (vs Product Categories) |
| - | - | Section 17: Troubleshooting (Brand/Category fixes) |
| - | - | Section 18: API Reference (Presets, Processing, Stock) |
| - | - | Section 19: Role-Based UI Plan (9 roles, permissions) |
| - | - | Section 20: Process Guide Maintenance |
| - | - | Section 21: Code Optimization (18,030 points plan) |
| - | - | Section 22: Project Status (~92% complete) |
| - | - | Section 23: Size Variant Integration |
| - | - | Section 24: Database Schema Reference |
| - | - | Section 25: Setup & Installation (Detailed) |

---

**Maintained By:** Kashaya Fabs Development Team
**Contact:** development@kashayafabs.com

**This document is the single source of truth for the Garment ERP system.**
