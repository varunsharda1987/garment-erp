# Garment ERP - Claude Code Instructions

## Project Structure
- `frontend/` - React + TypeScript + Vite frontend
- `backend/` - Node.js + Express + Prisma backend

## CRITICAL: UI Library Standards

**🚨 ALWAYS USE SHADCN/UI FOR ALL NEW COMPONENTS 🚨**

This project uses **shadcn/ui** (built on Radix UI + Tailwind CSS) as the standard UI library.

### Rules:
1. **NEVER use Material-UI (MUI)** for new components - the project has moved away from it
2. **ALWAYS use shadcn/ui components** for dialogs, buttons, forms, tables, etc.
3. **Import from `@/components/ui/`** for all UI primitives
4. **Use Tailwind CSS** for styling, not inline styles or CSS-in-JS

### Common shadcn/ui components available:
- `Dialog` - for modals/dialogs (NOT Material-UI Dialog)
- `Button` - for buttons (NOT Material-UI Button)
- `Input` - for form inputs
- `Select` - for dropdowns
- `Table` - for data tables
- `Card` - for cards
- `Badge` - for badges
- `Tabs` - for tabs
- `Alert` - for alerts
- `Tooltip` - for tooltips (import from `@/components/ui/tooltip`)
- And many more in `frontend/src/components/ui/`

### Check available components:
```bash
# List all available shadcn/ui components
ls frontend/src/components/ui/
```

### If a shadcn/ui component doesn't exist:
1. Install it using: `npx shadcn@latest add <component-name>`
2. Then use it in your code

### Example (CORRECT):
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function MyComponent() {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>My Dialog</DialogTitle>
        </DialogHeader>
        <Button>Click Me</Button>
      </DialogContent>
    </Dialog>
  );
}
```

### Example (WRONG - DO NOT DO THIS):
```tsx
// ❌ WRONG - Do not use Material-UI
import { Dialog, Button } from '@mui/material';
```

## CRITICAL: Stock Service Pattern (MANDATORY)

**Every stock service that creates/adjusts/consumes stock MUST use the material-sync helper.**

```typescript
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';
```

### Rules:
1. **Before creating stock**: Call `ensureMaterialRecord(masterId, type)` to guarantee a `materials` record exists
2. **After every quantity change**: Call `syncStockLevelQuantity(materialId, change, tx?)` to keep `stock_levels` in sync
3. **Applies to ALL stock types**: greige_stock, fabric_stock, lace_stock, thread_stock, and any future specialized stock tables
4. **The pre-commit hook validates** that any `*stock*.service.ts` file imports `material-sync.helper`

### Why:
- The system has two stock tracking layers: specialized tables (greige_stock, fabric_stock, etc.) and centralized `stock_levels`
- Both are populated during GRN receipt and must stay in sync
- Without sync, the Stock Levels page shows stale/missing data

### Helper location: `backend/src/services/helpers/material-sync.helper.ts`

## Critical: API Response Serialization

The backend uses a serializer (`backend/src/utils/serializer.ts`) that automatically converts ALL snake_case keys to camelCase before sending responses to the frontend.

### What this means:
- Database/Prisma uses snake_case for relation names (e.g., `brand_categories`, `style_components`)
- API responses use camelCase (e.g., `brandCategories`, `styleComponents`)
- **Frontend must ALWAYS use camelCase** when accessing API response data

### Common mistakes to avoid:
```typescript
// WRONG - snake_case won't work in frontend
const category = style.brand_categories?.category;

// CORRECT - use camelCase
const category = style.brandCategories?.category;
```

### Affected relations (examples):
- `brand_categories` → `brandCategories`
- `style_components` → `styleComponents`
- `style_fabrics` → `styleFabrics`
- `style_variants` → `styleVariants`
- All Prisma relations follow this pattern

### Controller Response Keys (CRITICAL)

When returning custom/transformed data in controllers, the **response object key** must match serializer mappings.

```typescript
// WRONG - custom variable name bypasses serializer
const styleFabricsFlat = [...]; // flattened data
res.json({ data: { ...style, styleFabricsFlat } }); 
// Frontend receives: styleData.styleFabricsFlat (NOT converted to 'fabrics')

// CORRECT - use the key that matches serializer mapping
const styleFabricsFlat = [...]; // variable name doesn't matter
res.json({ data: { ...style, styleFabrics: styleFabricsFlat } });
// Serializer converts styleFabrics → fabrics
// Frontend receives: styleData.fabrics (CORRECT!)
```

**Rule:** The variable name can be anything, but the **object key in the response** must match what the serializer expects.

**Common pitfall:** Using shorthand syntax `{ myCustomVar }` expands to `{ myCustomVar: myCustomVar }` - if `myCustomVar` isn't in serializer mappings, frontend gets wrong field name.

**Check serializer mappings:** `backend/src/utils/serializer.ts` → `RELATION_MAPPINGS` (62 mappings)

### Zod Schema-Controller Alignment (CRITICAL)

Zod schemas in `backend/src/schemas/` MUST match what controllers destructure from `req.body`. Mismatches cause silent 400 "Invalid request data" errors.

```typescript
// WRONG - Schema requires fields controller doesn't use
// Schema:
export const mySchema = z.object({
  requiredField: z.string(),  // ← Required but controller ignores it!
  optionalField: z.string().optional(),
});
// Controller:
const { differentField } = req.body;  // ← Doesn't match schema!
// Result: 400 error because requiredField is missing

// CORRECT - Schema matches controller expectations
// Schema:
export const mySchema = z.object({
  actualField: z.string(),
  optionalField: z.string().optional(),
});
// Controller:
const { actualField, optionalField } = req.body;  // ← Matches schema!
```

**Rule:** When refactoring controller logic, ALWAYS update the corresponding Zod schema to match.

**How to verify:** Compare schema fields with `const { ... } = req.body;` in controller.

## TypeScript Types

When defining types for API responses in frontend (`frontend/src/types/`), always use camelCase for nested relation properties to match the serialized response.

## Running the App
- Frontend: `cd frontend && npm run dev`
- Backend: `cd backend && npm run dev`

## New Module Checklist

When creating a new CRUD module end-to-end, follow this exact order (9 files minimum):

### Backend (5 files + 1 registration)
1. Add model to `backend/prisma/schema.prisma`
2. Run migration: `cd backend && npx prisma migrate dev --name add_<module>`
3. **Create `backend/src/schemas/<module>.schema.ts`** — Zod schemas for create/update (SINGLE SOURCE OF TRUTH)
4. Create `backend/src/services/<module>.service.ts` — copy pattern from `agency.service.ts`
5. Create `backend/src/controllers/<module>.controller.ts` — copy pattern from `agency.controller.ts`
6. Create `backend/src/routes/<module>.routes.ts` — **use `validateBody(schema)`** for POST/PUT/PATCH
7. Register route in `backend/src/routes/index.ts`: `router.use('/<modules>', <module>Routes)`

### Frontend (4 files + 3 registrations)
8. Create `frontend/src/types/<module>.types.ts` — ALL fields camelCase, **must match Zod schema**
9. Create `frontend/src/services/<module>.service.ts` — axios wrappers for CRUD
10. Create `frontend/src/pages/<Module>List.tsx` — React Query + shadcn/ui table + form dialog
11. Create `frontend/src/pages/<Module>FormDialog.tsx` — react-hook-form + Zod + shadcn/ui dialog
12. Add lazy import in `frontend/src/routes/lazy-routes.tsx`
13. Add route in `frontend/src/App.tsx` (inside ProtectedRoute)
14. Add sidebar entry in `frontend/src/components/Sidebar.tsx`

### Reference Files (copy these patterns)
- **Zod Schema:** `backend/src/schemas/agency.schema.ts` — create/update schemas + type exports
- **Controller:** `backend/src/controllers/agency.controller.ts` — class-based, 6 methods, try-catch
- **Service:** `backend/src/services/agency.service.ts` — interfaces, generateCode(), pagination, search
- **Routes:** `backend/src/routes/agency.routes.ts` — `/search` MUST come before `/:id`, **uses validateBody**
- **Frontend Types:** `frontend/src/types/agency.types.ts` — Entity, Create/Update Request, QueryParams, Paginated
- **Frontend Service:** `frontend/src/services/agency.service.ts` — async functions wrapping api.get/post/put/delete
- **List Page:** `frontend/src/pages/AgencyList.tsx` — useQuery + 3 mutations + table + dialogs

### Why Zod Schemas Matter
- **Single source of truth** for field definitions
- Validates incoming data, strips unknown fields
- Controller receives fully-typed body (no manual destructuring errors)
- Frontend types MUST match schema to avoid silent data drops
- Validation check: `node scripts/hooks/check-route-validation.js`

## Standard File Patterns

### Backend Controller (class-based)
```typescript
import { Request, Response } from 'express';
import { <module>Service } from '../services/<module>.service';

export class <Module>Controller {
  async getAll(req: Request, res: Response) { /* parse query, call service, try-catch 500 */ }
  async search(req: Request, res: Response) { /* dropdown search, limited fields */ }
  async getById(req: Request, res: Response) { /* params.id, 404 if not found */ }
  async create(req: Request, res: Response) { /* validate body, 201 on success */ }
  async update(req: Request, res: Response) { /* params.id + body, P2025 → 404 */ }
  async delete(req: Request, res: Response) { /* params.id, check FK constraints first */ }
}
export const <module>Controller = new <Module>Controller();
```

### Backend Service (Prisma + interfaces)
```typescript
interface <Module>CreateInput { /* required fields */ }
interface <Module>UpdateInput { /* all optional */ }
interface <Module>QueryParams { page?, limit?, search?, isActive?, sortBy?, sortOrder? }

export class <Module>Service {
  private async generateCode(): Promise<string> { /* PREFIX-001, PREFIX-002 */ }
  async create(data) { /* generate code, prisma.create with include */ }
  async getAll(params) { /* where builder, [findMany, count] in parallel, pagination object */ }
  async getById(id) { /* findUnique with includes + _count */ }
  async update(id, data) { /* prisma.update */ }
  async delete(id) { /* check FK constraints, then prisma.delete */ }
  async search(params) { /* minimal fields for dropdown, OR search */ }
}
```

### Backend Routes (order matters!)
```typescript
router.get('/search', controller.search.bind(controller));  // BEFORE /:id
router.get('/', controller.getAll.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.post('/', controller.create.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));
```

### Frontend List Page (React Query + shadcn/ui)
```typescript
// State: search, page, dialogOpen, selectedItem, deleteDialogOpen
// Queries: useQuery(['<modules>', { page, search }], () => getAll(...))
// Mutations: create (201 toast), update (toast), delete (toast)
// Layout: header + Card > Table > pagination + FormDialog + AlertDialog
// All mutations invalidate queryKey on success
// Error handling: toast.error(error?.response?.data?.message)
```

### Frontend Types (always camelCase)
```typescript
interface <Module> { id, code, name, ...fields, isActive, createdAt, updatedAt, _count? }
interface Create<Module>Request { /* required fields only */ }
interface Update<Module>Request { /* all optional */ }
interface <Module>QueryParams { page?, limit?, search?, sortBy?, sortOrder? }
interface Paginated<Modules> { data: <Module>[], pagination: { page, limit, total, totalPages } }
```

## Custom Skills

We've implemented custom Claude Code skills to automate repetitive development tasks.

### `/sync-types` - Type Synchronization Skill

Analyzes and validates type synchronization between backend and frontend TypeScript files.

**Usage:**
```bash
node scripts/skills/sync-types.js [--check|--report|--help]
```

**Modes:**
- `--report` (default) - Generate detailed synchronization report
- `--check` - Validate synchronization (exits with error if issues found)
- `--help` - Show usage information

**What it does:**
- Scans `backend/src/types/*.types.ts` and `frontend/src/types/*.types.ts`
- Identifies matched files, backend-only, and frontend-only files
- Displays serializer camelCase transformation mappings from `backend/src/utils/serializer.ts`
- Shows RELATION_MAPPINGS (62 custom mappings)
- Validates type consistency

**When to use:**
- Before committing changes to type files
- After modifying Prisma schema
- When adding new API endpoints
- During code review to verify type consistency

**Example Output:**
```
=== Type Synchronization Report ===

Summary:
  Backend type files:  20
  Frontend type files: 64
  Matched files:       10
  Backend only:        10
  Frontend only:       54

Serializer Mappings:
  Total mappings: 62
  Examples:
    styleComponents → components
    brandCategories → brandCategories
    ...
```

**Key Reminders from the tool:**
1. Backend uses snake_case for Prisma relations (e.g., `brand_categories`)
2. Serializer converts to camelCase in API responses (e.g., `brandCategories`)
3. Frontend MUST use camelCase when accessing nested relations
4. Check RELATION_MAPPINGS in serializer.ts for custom mappings (e.g., `styleComponents` → `components`)

### `/db-workflow` - Database Workflow Automation

Unified database operations: migrate, seed, reset, and documentation generation.

**Usage:**
```bash
node scripts/skills/db-workflow.js [--setup|--migrate|--reset|--seed|--docs|--help]
```

**Modes:**
- `--setup` - Full first-time setup (migrate + seed + docs)
- `--migrate` (default) - Run migration + generate docs
- `--reset` - Reset database + migrate + seed (⚠ deletes all data!)
- `--seed` - Run all seed scripts only
- `--docs` - Generate schema documentation only

**What it replaces:**
```bash
# Before (4+ manual commands)
npx prisma migrate dev
npx ts-node scripts/seed-all-modules.ts
npx ts-node scripts/seed-production-data.ts
node scripts/generate-schema-docs.js

# After (1 command)
node scripts/skills/db-workflow.js --setup
```

**5x speedup** on database operations

### `/test-all` - Unified Test Orchestration

Runs frontend E2E (Playwright) + backend unit/integration (Jest) tests with unified reporting.

**Usage:**
```bash
node scripts/skills/test-all.js [--all|--e2e|--backend|--coverage|--clean|--help]
```

**Modes:**
- `--all` (default) - Run all tests (E2E + backend)
- `--e2e` - Run frontend E2E tests only
- `--backend` - Run backend tests only (unit + integration)
- `--coverage` - Run all tests with coverage reports
- `--clean` - Clean up test artifacts

**What it replaces:**
- `npm run test:e2e:foundation`
- `npm run test:e2e:masters`
- `npm run test:e2e:transactions`
- `npm run test:e2e:integration`
- `cd backend && npm run test:unit`
- `cd backend && npm run test:integration`
- Manual coverage and cleanup

**Consolidates 8+ test commands** into one unified workflow

### `/api-docs` - API Documentation Generator

Auto-generates API documentation from route files.

**Usage:**
```bash
node scripts/skills/api-docs.js [--generate|--validate|--list|--help]
```

**Modes:**
- `--generate` (default) - Generate API documentation markdown
- `--validate` - Validate routes and check for duplicates
- `--list` - List all API endpoints with HTTP methods

**What it does:**
- Scans 80+ route files automatically
- Generates `API_REFERENCE.md`
- Lists endpoints with HTTP methods
- Validates for duplicate routes
- Includes serializer transformation notes

**Hours → minutes** for API documentation

### `/commit-smart` - Intelligent Git Commits

Analyzes changes and generates consistent, detailed commit messages.

**Usage:**
```bash
node scripts/skills/commit-smart.js [--generate|--preview|--help]
```

**Modes:**
- `--generate` (default) - Generate smart commit message
- `--preview` - Show what would be committed (dry-run)

**What it does:**
- Analyzes git changes (modified, added, deleted files)
- Detects change patterns (schema, types, controllers, etc.)
- Determines appropriate commit type (feat/fix/docs/etc.)
- **Module scope analysis** — detects when changes span >3 feature modules and suggests splitting
- Generates detailed, multi-line commit messages
- Follows existing commit patterns (68% feat, 18% fix)
- Includes Claude Code attribution

**Ensures consistent, high-quality commits with scope awareness**

### `/validate-docs` - Documentation Validation

Validates documentation coverage, broken links, and accuracy.

**Usage:**
```bash
node scripts/skills/validate-docs.js [--all|--controllers|--endpoints|--links|--materials|--help]
```

**Modes:**
- `--all` (default) - Run all validations
- `--controllers` - Check controller documentation coverage
- `--endpoints` - Check API endpoint documentation coverage
- `--links` - Validate internal markdown links
- `--materials` - Verify material types count accuracy
- `--help` - Show usage information

**What it validates:**
- **Controller Coverage** - % of controllers mentioned in docs (threshold: 50%)
- **API Endpoint Coverage** - % of endpoints documented (threshold: 30%)
- **Internal Links** - Broken markdown links in docs/ folder
- **Material Types** - Count accuracy in MATERIALS_MASTER_GUIDE.md

**When to use:**
- Before committing documentation changes
- After adding new controllers or routes
- When updating module guides
- To identify documentation gaps

**What it does:**
- Scans all controllers and route files automatically
- Cross-references with documentation in docs/ folder
- Validates internal markdown links (file existence)
- Compares material type counts (Prisma schema vs guide claims)
- Provides actionable suggestions for improvements

**Example Output:**
```
=== Documentation Validation Report ===

📊 Validating Controller Coverage...
📁 Total Controllers: 101
✅ Documented: 22 (21.8%)
❌ Undocumented: 79

🌐 Validating API Endpoint Coverage...
🔗 Total API Endpoints: 965
✅ Documented: 165 (17.1%)
❌ Undocumented: 800

🔗 Validating Internal Links...
🔗 Total Internal Links: 45
✅ Valid Links: 45
❌ Broken Links: 0

📦 Validating Material Types Count...
📊 Prisma Schema: 23 material types
📖 Materials Guide Claims: 23 material types
✅ Match: Yes
```

**Prevents documentation drift** and maintains quality standards

### `/scaffold-module` - CRUD Module Scaffolder

Generates all files for a new CRUD module following the Agency pattern.

**Usage:**
```bash
node scripts/skills/scaffold-module.js --name <module> --fields <fields> [--prefix <PREFIX>] [--preview]
```

**Generates:** Backend service + controller + routes, Frontend types + service + list page, Prisma model snippet, registration snippets.

**Example:**
```bash
node scripts/skills/scaffold-module.js --name warehouse --fields "name:string, address:string?, capacity:number?" --prefix WH
```

### `/generate-types` - Schema-to-Types Generator

Generates frontend TypeScript types from Prisma schema with camelCase conversion. Complements `/sync-types` (which validates) — this skill GENERATES.

**Usage:**
```bash
node scripts/skills/generate-types.js --list                     # List all 226 models
node scripts/skills/generate-types.js --model agencies --preview  # Preview types
node scripts/skills/generate-types.js --model agencies            # Generate file
```

### `/register-route` - Route + Sidebar Registration

Updates lazy-routes.tsx + App.tsx + optionally routes/index.ts when adding a new page.

**Usage:**
```bash
node scripts/skills/register-route.js --page WarehouseList --route /warehouses --section Masters --icon Warehouse --backend warehouse
```

### `/health-check` - Live API Health Checker

Detects stale Node.js processes and tests API endpoint reachability. Prevents the #1 debugging pitfall.

**Usage:**
```bash
node scripts/skills/health-check.js [--check|--processes|--endpoints|--test <path>|--help]
```

**Modes:**
- `--check` (default) - Full health check: processes + endpoints + recently modified routes
- `--processes` - Check only Node.js process ages (flags >4 hours as stale)
- `--endpoints` - Check only endpoint reachability
- `--test <path>` - Test a specific API endpoint (e.g., `--test /agencies`)

**Key insight:**
- 401 = route EXISTS but needs auth (good)
- 404 = route NOT found or server stale (investigate)

---

## Automated Hooks

We've implemented automated hooks that enforce quality standards automatically.

### `post-type-change` Hook

**Triggers:** When `*.types.ts` or `schema.prisma` files change
**Purpose:** Auto-validate type synchronization
**Blocking:** No (warnings only)

**What it does:**
- Detects changed type files
- Runs `/sync-types --check` validation
- Suggests running API docs if controller types changed
- Reports serializer mapping issues

### `pre-commit` Hook

**Triggers:** Before every `git commit`
**Purpose:** Quality gates before commits
**Blocking:** Yes (on broken links in documentation changes)

**What it checks:**
1. Documentation link validation (if docs/*.md files changed)
2. Console.log detection (warns, doesn't block)

**Blocks commit if:**
- Broken internal links found in changed documentation files
- Critical documentation quality issues

**To bypass (use with caution):**
```bash
git commit --no-verify
```

### `pre-migration` Hook

**Triggers:** Before Prisma migrations
**Purpose:** Safety checks before database changes
**Blocking:** Yes (on critical safety issues)

**What it checks:**
1. Prisma schema syntax validation
2. Destructive operations detection
3. Serializer relation mappings (auto-generates missing RELATION_MAPPINGS entries)
4. Environment check (blocks in production!)
5. Migration conflicts

**Enhanced:** Now auto-generates copy-pasteable RELATION_MAPPINGS entries for any missing snake_case relations, instead of just warning.

**Production safety:** Blocks 100% of accidental production migrations

### `post-docs-update` Hook

**Triggers:** When `*.md` files change
**Purpose:** Validate documentation quality
**Blocking:** No (warnings only)

**What it checks:**
1. Broken internal links
2. Dangerous commands in code blocks
3. Auto-updates timestamps

**Manual testing:**
```bash
node scripts/hooks/post-type-change.js
node scripts/hooks/pre-commit.js       # Requires staged files
node scripts/hooks/pre-migration.js
node scripts/hooks/post-docs-update.js
```

---

## Quick Reference

### Skills

| Skill | Purpose | Impact |
|-------|---------|--------|
| `/sync-types` | Type synchronization validation | 30x faster (30 min → <1 min) |
| `/db-workflow` | Database operations automation | 5x speedup (4 cmds → 1) |
| `/test-all` | Unified test orchestration | 8+ commands → 1 |
| `/api-docs` | API documentation generation | Hours → minutes |
| `/commit-smart` | Intelligent commit messages + scope analysis | Consistent quality + split warnings |
| `/validate-docs` | Documentation quality validation | Prevents drift, ensures accuracy |
| `/scaffold-module` | CRUD module code generation | 45-60 min → 2 min per module |
| `/generate-types` | Schema-to-types generation | 15-20 min → 1 min per model |
| `/register-route` | Route + sidebar registration | 5-10 min → 30 sec per page |
| `/health-check` | Stale process detection + API health | Prevents #1 debugging pitfall |

### Hooks

| Hook | Triggers | Blocks? | Purpose |
|------|----------|---------|---------|
| `post-type-change` | Type files change | No | Auto-validate type sync |
| `pre-commit` | Before commit | Yes | Doc link validation + console.log |
| `pre-migration` | Before migration | Yes | Schema validation + safety + auto-gen mappings |
| `post-docs-update` | Docs change | No | Link validation + timestamps |

### MCP Servers

| Server | Purpose | Key Finding |
|--------|---------|-------------|
| `prisma-server` | Schema analysis + diff + impact | 226 models, schema diff, mapping gen |
| `typescript-server` | Type intelligence | **189 case mismatches found!** |
| `database-server` | Read-only DB access | Safe queries, blocks writes |
| `docs-server` | Doc search & validation | 54 files, 12 outdated |
| `playwright` | Browser automation | UI testing, screenshots, web interaction |

**Manual testing:**
```bash
node mcp-servers/prisma-server/index.js stats
node mcp-servers/prisma-server/index.js diff             # Schema changes vs git HEAD
node mcp-servers/prisma-server/index.js generate-mappings # Auto-generate missing mappings
node mcp-servers/typescript-server/index.js mismatches    # ⚠ 189 found!
node mcp-servers/database-server/index.js connection
node mcp-servers/docs-server/index.js stats
```

### Playwright MCP Server (Browser Automation)

The `playwright` MCP server provides browser automation capabilities. **Use this automatically** when the task involves UI verification or browser interaction.

**Auto-use triggers** - Use Playwright MCP when the user:
- Asks to "check the UI", "take a screenshot", "verify the page"
- Wants to "test the frontend", "see what the page looks like"
- Needs to debug visual/layout issues
- Wants to test form submissions or button clicks
- Says "open the browser", "navigate to", "click on"

**Local URLs:**
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

**Available tools:**
- Navigate to URLs
- Click elements, type text, hover
- Take screenshots
- Get page content/accessibility snapshots
- Handle dialogs and forms
- Manage browser tabs

**Best practices:**
1. Use accessibility snapshots (structured data) over screenshots when possible - they're more LLM-friendly
2. For forms, use the fill/type tools rather than clicking each field
3. Wait for navigation to complete before taking actions
4. Close tabs when done to avoid resource leaks
5. The server runs in headless mode (no visible browser window)

---

## Agents (Multi-Step Automated Workflows)

### `new-module` - New Module Agent (A1)

Orchestrates the complete CRUD module creation in one command: scaffold → schema → migrate → types → routes → verify.

**Usage:**
```bash
node scripts/agents/new-module.js --name <module> --fields "<fields>" [--prefix <prefix>] [--section <section>] [--icon <icon>] [--dry-run] [--skip-migration]
```

**9 automated steps:**
1. Scaffold backend + frontend files (uses `/scaffold-module`)
2. Add Prisma model to schema.prisma
3. Run `prisma migrate dev`
4. Generate Prisma client
5. Generate frontend types (uses `/generate-types`)
6. Register frontend routes (uses `/register-route`)
7. Register backend routes
8. Verify TypeScript compilation
9. Check serializer mappings

**Example:**
```bash
node scripts/agents/new-module.js --dry-run --name warehouse --fields "name:string, address:string?, capacity:number?" --prefix WH --icon Warehouse
```

### `schema-propagate` - Schema Change Propagation Agent (A2)

After modifying schema.prisma, detects changes and propagates them downstream. Goes beyond hooks — it FIXES, not just detects.

**Usage:**
```bash
node scripts/agents/schema-propagate.js [--check|--propagate|--dry-run|--help]
```

**7 automated steps:**
1. Diff schema.prisma against git HEAD
2. Identify downstream files impacted
3. Regenerate Prisma client
4. Generate/update frontend types for changed models
5. Check serializer RELATION_MAPPINGS for new relations
6. Run type synchronization validation
7. Verify TypeScript compilation

---

## Documentation

All documentation is now consolidated in the `docs/` folder. **Total: 19 comprehensive guides.**

### Start Here

| Document | Purpose |
|----------|---------|
| [PROJECT_BIBLE.md](docs/PROJECT_BIBLE.md) | **Main comprehensive guide** - Complete system overview |
| [MODULE_RELATIONSHIPS_GUIDE.md](docs/MODULE_RELATIONSHIPS_GUIDE.md) | **Module interlinking & data flows** - 200+ relationships, integration patterns |
| [CLAUDE.md](CLAUDE.md) | **Developer instructions** - Critical for Claude Code development |

### Core Business Modules (5 Guides)

| Document | Purpose |
|----------|---------|
| [MATERIALS_MASTER_GUIDE.md](docs/MATERIALS_MASTER_GUIDE.md) | Material masters & supplier linking (13 Trim Masters, Categories, Import/Export) |
| [BOM_MRP_GUIDE.md](docs/BOM_MRP_GUIDE.md) | Bill of Materials & Material Requirement Planning |
| [ORDER_PROCUREMENT_GUIDE.md](docs/ORDER_PROCUREMENT_GUIDE.md) | Order management, Purchase Orders, GRN, Order to Work Order |
| [SAMPLE_EMBROIDERY_GUIDE.md](docs/SAMPLE_EMBROIDERY_GUIDE.md) | Sample management (5 types), Embroidery workflow, Lab Dips |
| [FINANCIAL_ACCOUNTING_GUIDE.md](docs/FINANCIAL_ACCOUNTING_GUIDE.md) | Chart of Accounts, Invoicing, Payments, Multi-Currency |

### Workflow & Process Guides (4 Guides)

| Document | Purpose |
|----------|---------|
| [PRODUCTION_PIPELINE_GUIDE.md](docs/PRODUCTION_PIPELINE_GUIDE.md) | Work Orders, Cutting, Stitching, Finishing, Processing |
| [STOCK_MANAGEMENT_GUIDE.md](docs/STOCK_MANAGEMENT_GUIDE.md) | All stock tables & when to use each |
| [DISPATCH_LOGISTICS_GUIDE.md](docs/DISPATCH_LOGISTICS_GUIDE.md) | Delivery Notes, ASN, POD, Transport |
| [TESTING_QUALITY_GUIDE.md](docs/TESTING_QUALITY_GUIDE.md) | FPT, GPT, Testing Labs, AQL |

### Specialized Modules (5 Guides)

| Document | Purpose |
|----------|---------|
| [FABRIC_COSTING_GUIDE.md](docs/FABRIC_COSTING_GUIDE.md) | Fabric costing & processor rate cards |
| [CAD_PLANNING_GUIDE.md](docs/CAD_PLANNING_GUIDE.md) | CAD planning module |
| [MATERIAL_QUICK_ADD_GUIDE.md](docs/MATERIAL_QUICK_ADD_GUIDE.md) | Material quick add dialog - Unified creation for 23 material types |
| [GST_GUIDE.md](docs/GST_GUIDE.md) | Indian GST compliance (1,602 lines) |
| [AI_ASSISTANT_GUIDE.md](docs/AI_ASSISTANT_GUIDE.md) | AI integration with Claude/Gemini/OpenAI |

### Developer Reference (4 Guides)

| Document | Purpose |
|----------|---------|
| [MODULE_RELATIONSHIPS_GUIDE.md](docs/MODULE_RELATIONSHIPS_GUIDE.md) | Module interlinking, data flows, integration patterns (200+ relationships) |
| [docs/plans/](docs/plans/) | Implementation planning documents - Design decisions, architectural choices (19 files, ~500KB) |
| [GLOSSARY.md](docs/GLOSSARY.md) | Industry terminology (180+ terms) |
| [CODING_STANDARDS.md](docs/CODING_STANDARDS.md) | Development standards |

### Archive Folder

The `docs/archive/` folder contains 34 original detailed documentation files preserved for historical reference. All content has been consolidated into the guides above.

**Note:** This file (CLAUDE.md) contains critical development instructions for Claude Code. The PROJECT_BIBLE.md is the comprehensive system documentation.
