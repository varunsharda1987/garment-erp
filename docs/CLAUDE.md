# Garment ERP - Claude Code Instructions

## Project Structure
- `frontend/` - React + TypeScript + Vite frontend
- `backend/` - Node.js + Express + Prisma backend

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

## TypeScript Types

When defining types for API responses in frontend (`frontend/src/types/`), always use camelCase for nested relation properties to match the serialized response.

## Running the App
- Frontend: `cd frontend && npm run dev`
- Backend: `cd backend && npm run dev`

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
- Generates detailed, multi-line commit messages
- Follows existing commit patterns (68% feat, 18% fix)
- Includes Claude Code attribution

**Ensures consistent, high-quality commits**

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
**Blocking:** Yes (on TypeScript errors and type sync issues)

**What it checks:**
1. TypeScript type checking (backend + frontend)
2. Type synchronization validation
3. Console.log detection (warns, doesn't block)

**Blocks commit if:**
- TypeScript errors found
- Types out of sync
- Critical quality issues

### `pre-migration` Hook

**Triggers:** Before Prisma migrations
**Purpose:** Safety checks before database changes
**Blocking:** Yes (on critical safety issues)

**What it checks:**
1. Prisma schema syntax validation
2. Destructive operations detection
3. Serializer relation mappings
4. Environment check (blocks in production!)
5. Migration conflicts

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
| `/commit-smart` | Intelligent commit messages | Consistent quality |

### Hooks

| Hook | Triggers | Blocks? | Purpose |
|------|----------|---------|---------|
| `post-type-change` | Type files change | No | Auto-validate type sync |
| `pre-commit` | Before commit | Yes | TypeScript + type sync + console.log |
| `pre-migration` | Before migration | Yes | Schema validation + safety |
| `post-docs-update` | Docs change | No | Link validation + timestamps |

### MCP Servers

| Server | Purpose | Key Finding |
|--------|---------|-------------|
| `prisma-server` | Schema analysis | 195 models, 121 unmapped relations |
| `typescript-server` | Type intelligence | **189 case mismatches found!** |
| `database-server` | Read-only DB access | Safe queries, blocks writes |
| `docs-server` | Doc search & validation | 54 files, 12 outdated |

**Manual testing:**
```bash
node mcp-servers/prisma-server/index.js stats
node mcp-servers/typescript-server/index.js mismatches  # ⚠ 189 found!
node mcp-servers/database-server/index.js connection
node mcp-servers/docs-server/index.js stats
```

---

## Documentation

All documentation is now consolidated in the `docs/` folder:

| Document | Purpose |
|----------|---------|
| [PROJECT_BIBLE.md](PROJECT_BIBLE.md) | **Main comprehensive guide** - Start here |
| [PRODUCTION_PIPELINE_GUIDE.md](PRODUCTION_PIPELINE_GUIDE.md) | Work Orders, Cutting, Stitching, Finishing, Processing |
| [STOCK_MANAGEMENT_GUIDE.md](STOCK_MANAGEMENT_GUIDE.md) | All stock tables & when to use each |
| [DISPATCH_LOGISTICS_GUIDE.md](DISPATCH_LOGISTICS_GUIDE.md) | Delivery Notes, ASN, POD, Transport |
| [TESTING_QUALITY_GUIDE.md](TESTING_QUALITY_GUIDE.md) | FPT, GPT, Testing Labs, AQL |
| [FABRIC_COSTING_GUIDE.md](FABRIC_COSTING_GUIDE.md) | Fabric costing & processor rate cards |
| [CAD_PLANNING_GUIDE.md](CAD_PLANNING_GUIDE.md) | CAD planning module |
| [GST_GUIDE.md](GST_GUIDE.md) | Indian GST compliance |
| [GLOSSARY.md](GLOSSARY.md) | Industry terminology (180+ terms) |
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | Development standards |

**Note:** This file (CLAUDE.md) contains critical development instructions for Claude Code. The PROJECT_BIBLE.md is the comprehensive system documentation.
