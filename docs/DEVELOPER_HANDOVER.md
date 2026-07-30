# Developer Handover Document

**Project:** Garment ERP  
**Handover Date:** July 2026  
**Status:** Functionally stable after comprehensive bug-hunt (142+ commits in July)

---

## Executive Summary

A full-stack garment/textile manufacturing ERP covering the complete production pipeline: styles → orders → materials → procurement → production → dispatch → invoicing → GST compliance.

**Tech Stack:** React 19 + Express 5 + Prisma + PostgreSQL  
**Scale:** 266 database models, 180+ frontend pages, 130+ API controllers  
**State:** Core workflows working; 12 edge-case pages deferred as "coming soon"

---

## Tech Stack

### Frontend
| Category | Technology | Version |
|----------|------------|---------|
| Framework | React | 19.1.1 |
| Build | Vite | 7.1.7 |
| Language | TypeScript | 5.9.3 |
| State | Zustand | 5.0.8 |
| Data Fetching | @tanstack/react-query | 5.90.11 |
| Forms | react-hook-form + zod | 7.65.0 / 4.1.12 |
| UI Components | **shadcn/ui** (Radix + Tailwind) | — |
| Styling | Tailwind CSS | 3.4.18 |
| Testing | Playwright | 1.56.1 |

### Backend
| Category | Technology | Version |
|----------|------------|---------|
| Runtime | Node.js | ES2022 |
| Framework | Express | 5.1.0 |
| ORM | Prisma | 6.19.1 |
| Database | PostgreSQL | — |
| Validation | Zod | 4.1.12 |
| Auth | jsonwebtoken + bcrypt | 9.0.2 / 6.0.0 |
| Queue | BullMQ + ioredis | 5.65.0 |
| File Storage | @aws-sdk/client-s3 | 3.700.0 (DigitalOcean Spaces) |
| PDF | pdfkit | 0.17.2 |
| Excel | exceljs | 4.4.0 |

### Infrastructure
- **Process Manager:** PM2 (ecosystem.config.js)
- **Error Tracking:** Sentry
- **File Storage:** DigitalOcean Spaces (S3-compatible)
- **Deployment:** Local Windows machine (manual `npm run deploy`)

---

## Project Structure

```
garment-erp/
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── pages/               # 180+ page components
│   │   ├── components/ui/       # shadcn/ui components (ONLY use these)
│   │   ├── services/            # API client wrappers
│   │   ├── hooks/               # Custom React hooks
│   │   ├── stores/              # Zustand state
│   │   ├── types/               # TypeScript interfaces
│   │   └── routes/              # React Router config
│   └── vite.config.ts
│
├── backend/                     # Express API
│   ├── src/
│   │   ├── controllers/         # 130+ API controllers
│   │   ├── services/            # Business logic
│   │   ├── routes/              # Express routes
│   │   ├── schemas/             # Zod validation (SINGLE SOURCE OF TRUTH)
│   │   ├── middleware/          # Auth, validation, error handling
│   │   ├── utils/
│   │   │   ├── serializer.ts    # snake_case → camelCase conversion
│   │   │   └── currency.ts      # Money math helpers
│   │   └── types/
│   └── prisma/
│       ├── schema.prisma        # 266 models
│       └── migrations/
│
├── server/                      # Static file server (production)
├── docs/                        # 35+ technical guides
├── scripts/
│   ├── skills/                  # Development automation tools
│   ├── hooks/                   # Pre-commit guardrails
│   └── agents/                  # Multi-step automation
├── mcp-servers/                 # Claude Code integrations
└── tests/                       # E2E Playwright tests
```

---

## Database Schema

**266 Prisma models** organized by domain:

| Domain | Key Models |
|--------|------------|
| **Orders** | orders, order_items, order_bom, quotations, sale_orders |
| **Customers** | customers, customer_addresses, agencies, agents |
| **Suppliers** | suppliers, supplier_gst_numbers, material_supplier_mapping |
| **Styles** | styles, style_variants, style_costing, style_fabrics, style_accessories |
| **Materials** | material_master, materials, fabric_master, greige_master, lace_master, button_master, thread_master, zipper_master, elastic_master, label_master |
| **Inventory** | stock_levels, stock_movements, fabric_stock, greige_stock, lace_stock, thread_stock, finished_goods_stock |
| **Production** | work_orders, production_plans, cutting_batches, stitching_issues, finishing_issues |
| **Procurement** | purchase_orders, purchase_order_items, goods_receiving_notes, grn_items |
| **Dispatch** | delivery_notes, invoices, invoice_items |
| **Processing** | processing_batch, processing_stage, processor_rate_card |
| **Quality** | quality_inspections, fabric_physical_tests, garment_physical_tests |
| **Financial** | chart_of_accounts, cost_centers, tax_masters, hsn_sac_masters, payments |
| **Auth** | users, role_permissions, permission_definitions, audit_logs |

### Migration Workflow
```bash
cd backend
npx prisma migrate dev --name <description>   # Create migration
npx prisma generate                            # Regenerate client
```

---

## Critical Patterns (MUST FOLLOW)

These patterns are **enforced by pre-commit hooks**. Violations block commits.

### 1. Serializer (snake_case → camelCase)

**File:** `backend/src/utils/serializer.ts`

The API automatically converts all snake_case keys to camelCase:

```typescript
// Backend Prisma returns:
{ brand_categories: [...], style_components: [...] }

// Frontend receives (after serializer):
{ brandCategories: [...], styleComponents: [...] }
```

**Rule:** Frontend MUST use camelCase when accessing response data.

```typescript
// WRONG
const category = style.brand_categories?.category;

// CORRECT
const category = style.brandCategories?.category;
```

**RELATION_MAPPINGS:** 100+ mappings rename verbose Prisma names:
```typescript
styleComponents → components
purchaseOrderItems → items
usersOrdersCreatedByIdTousers → createdBy
```

### 2. Zod Validation

**Location:** `backend/src/schemas/`

Every mutating route MUST use `validateBody(schema)`:

```typescript
// In routes file
import { validateBody } from '../middleware/validation.middleware';
import { createCustomerSchema } from '../schemas/customer.schema';

router.post('/', validateBody(createCustomerSchema), controller.create);
```

**Critical:** Schema fields MUST match what the controller destructures from `req.body`. Mismatch = silent 400 errors.

```typescript
// Schema
export const createSchema = z.object({
  code: z.string(),
  name: z.string(),
});

// Controller MUST match
const { code, name } = req.body;  // ✅
const { differentField } = req.body;  // ❌ Will 400
```

### 3. Stock Sync Pattern

**File:** `backend/src/services/helpers/material-sync.helper.ts`

ALL stock services MUST sync with centralized `stock_levels`:

```typescript
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';

// Before creating stock record
const materialId = await ensureMaterialRecord(fabricId, 'FABRIC', tx);

// After every quantity change
await syncStockLevelQuantity(materialId, quantity, warehouseId, 'METER', tx);
```

### 4. UI Library: shadcn/ui ONLY

**NEVER use Material-UI.** Always use shadcn/ui:

```typescript
// CORRECT
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem } from '@/components/ui/select';

// WRONG - DO NOT USE
import { Button, Dialog } from '@mui/material';
```

Available components: `frontend/src/components/ui/`

### 5. DateTime Validation

Use `z.coerce.date()`, NOT `z.string().datetime()`:

```typescript
// WRONG - rejects "2026-07-29" from date pickers
expectedDate: z.string().datetime()

// CORRECT - accepts both ISO and date-only
expectedDate: z.coerce.date()
```

### 6. Money Math

Use helpers from `backend/src/utils/currency.ts`:

```typescript
import { divideByShrinkage, roundToCent } from '../utils/currency';

// WRONG - Infinity at 100% shrinkage
const adjusted = value / (1 - shrinkage/100);

// CORRECT
const adjusted = divideByShrinkage(value, shrinkage);
```

---

## Custom Development Tooling

### Skills (`scripts/skills/`)

| Skill | Command | Purpose |
|-------|---------|---------|
| scaffold-module | `node scripts/skills/scaffold-module.js --name warehouse --fields "name:string" --prefix WH` | Generate 8 files for new CRUD module |
| sync-types | `node scripts/skills/sync-types.js --check` | Validate frontend/backend type sync |
| generate-types | `node scripts/skills/generate-types.js --model agencies` | Prisma → TypeScript types |
| health-check | `node scripts/skills/health-check.js --check` | Detect stale Node processes |
| db-workflow | `node scripts/skills/db-workflow.js --setup` | Migrate + seed database |
| api-docs | `node scripts/skills/api-docs.js --find "customer"` | Search existing API endpoints |
| test-all | `node scripts/skills/test-all.js --all` | Run E2E + unit tests |

### Guardrails (`scripts/hooks/smart-check.js`)

Pre-commit hook enforces these checks:

| Check | What It Catches |
|-------|-----------------|
| Schema-Controller Alignment | Controller reads field that Zod strips |
| Route Validation | POST/PUT without `validateBody` |
| Enum Drift | Zod enum values not in Prisma enum |
| DateTime Schema | `z.string().datetime()` instead of `z.coerce.date()` |
| Shrinkage Divide | Raw `/ (1 - x/100)` → Infinity |
| Currency Format | Missing `maximumFractionDigits: 2` |

**Baselines:** `scripts/hooks/*-baseline.json` grandfather existing violations. Only NEW violations block.

### Automation Agents (`scripts/agents/`)

| Agent | Purpose |
|-------|---------|
| new-module.js | Complete module creation: scaffold → schema → migrate → types → routes (9 steps) |
| schema-propagate.js | After schema changes: regenerate client, update types, check mappings |

---

## Development Workflow

### Daily Development
```bash
# Services run via PM2 (usually already running)
npm run pm2:start

# Frontend: http://localhost:3000
# Backend:  http://localhost:5000

# After backend code changes
npm run restart:api

# View logs
pm2 logs
```

### Schema Changes
```bash
cd backend
npx prisma migrate dev --name add_new_field
npx prisma generate

# Propagate to frontend types
node scripts/agents/schema-propagate.js --propagate
```

### Before Committing
```bash
# Runs automatically via husky, but you can test manually:
node scripts/hooks/smart-check.js

# Check for stale processes (common debugging pitfall)
node scripts/skills/health-check.js --check
```

### Adding a New Module

Use the automation agent:
```bash
node scripts/agents/new-module.js \
  --name warehouse \
  --fields "name:string, address:string?, capacity:number?" \
  --prefix WH \
  --section Masters \
  --icon Warehouse
```

Or manually create 9 files (see CLAUDE.md "New Module Checklist").

---

## Known Issues & Technical Debt

### Security (User Deferred)
- `.env` with JWT_SECRET and DB credentials is in git history
- Requires secret rotation + history purge (BFG/filter-repo)
- User explicitly deferred: "not in my priority list"

### 12 Deferred Pages
Currently show "coming soon" instead of 404:
- Stock-count detail view
- ASN create/detail
- Credit-note detail
- Garment/fabric/template test-entry forms
- Dyeing/printing sub-modules
- Fabric-CAD create
- Lace downgrade
- Processing-batch create

### User WIP (Do Not Touch)
- CustomerAddress/Contact features uncommitted in working tree
- WhatsApp integration uncommitted
- These files have been fixed for tsc errors but user hasn't committed

### Pending Migration
Unit enum needs GRAM/LITER/ROLL values:
```bash
cd backend && npx prisma migrate deploy
```

---

## What's Working

| Module | Status | Notes |
|--------|--------|-------|
| Style Masters | ✅ | Full CRUD + variants + costing + accessories |
| Orders | ✅ | Order → Work Order flow |
| Purchase Orders | ✅ | Unified PO for all 23 material types |
| GRN | ✅ | Receipt + automatic stock sync |
| Work Orders | ✅ | Production tracking + completion rollup |
| Cutting | ✅ | Batch creation + issue to stitching |
| Stitching | ✅ | Receive + issue to finishing |
| Finishing | ✅ | Receive + completed goods |
| External Processing | ✅ | Embroidery, handwork, smocking flows |
| Stock (all types) | ✅ | Greige, fabric, trims — all synchronized |
| Invoicing | ✅ | GST-compliant with HSN codes |
| GST Reports | ✅ | GSTR-1, GSTR-3B generation |
| User Auth | ✅ | JWT + RBAC (63 authorize guards) |

---

## Deployment

### Current Setup (Local Windows)
```bash
npm run deploy
```

This runs `scripts/deploy.js`:
1. Build frontend (`npm run build`)
2. Build backend (`npm run build`)
3. Stop API process
4. Run `prisma migrate deploy`
5. Run `prisma generate`
6. Restart API via PM2
7. Reload web server
8. Poll `/health` until ready

### URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### PM2 Services (ecosystem.config.js)
- `garment-erp-api` — Backend on port 5000
- `garment-erp-web` — Static server on port 3000

---

## Documentation References

| Document | What It Covers |
|----------|----------------|
| **CLAUDE.md** (root) | Development rules — READ THIS FIRST, hooks enforce it |
| docs/DEVELOPER_HANDOVER.md | This document — technical onboarding |
| docs/PROJECT_STATUS.md | Current project status and blockers |
| docs/B2B_INTEGRATION_GUIDE.md | External B2B app integration contract |

**Note:** Legacy docs from pre-July 2026 are archived in `docs/archive/legacy-feb-2026/`. These describe the system before the bug-hunt and should NOT be referenced for current development. The code is the source of truth.

---

## Getting Started (New Developer)

### 1. Clone and Install
```bash
git clone <repo>
cd garment-erp
npm install
cd frontend && npm install
cd ../backend && npm install
```

### 2. Environment Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL credentials
```

### 3. Database Setup
```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 4. Start Services
```bash
cd ..  # back to root
npm run pm2:start
```

### 5. Verify
```bash
# Check health
node scripts/skills/health-check.js --check

# Should show:
# Frontend: http://localhost:3000 ✅
# Backend:  http://localhost:5000 ✅
```

### 6. Read the Rules
**CLAUDE.md is mandatory reading.** The pre-commit hooks enforce these patterns:
- Zod validation on all routes
- Schema-controller field alignment
- shadcn/ui only (no Material-UI)
- Stock sync via material-sync.helper

### 7. First Contribution
```bash
# Check existing endpoints before adding new ones
node scripts/skills/api-docs.js --find "your feature"

# Use scaffold for new modules
node scripts/skills/scaffold-module.js --help

# Run guardrails manually to test
node scripts/hooks/smart-check.js
```

---

## Key Contacts / Resources

- **Primary Documentation:** CLAUDE.md + docs/PROJECT_BIBLE.md
- **API Reference:** Run `node scripts/skills/api-docs.js --generate`
- **Type Sync Issues:** Run `node scripts/skills/sync-types.js --report`
- **Stale Process Debugging:** Run `node scripts/skills/health-check.js --processes`

---

*Document generated: July 2026*
