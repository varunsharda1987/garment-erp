# Hooks Usage Guide - Automated Quality Gates

This guide explains how the 4 automated hooks work to enforce quality standards and prevent common mistakes.

---

## 🎯 What Are Hooks?

Hooks are **automated checks that run automatically** when specific events occur (file changes, commits, migrations, etc.). They catch issues before they become problems.

**Key Benefits:**
- **No manual checking** - Hooks run automatically
- **Prevent mistakes** - Block bad commits and dangerous operations
- **Enforce standards** - Consistent code quality across the team
- **Save time** - Catch issues early, before CI/CD or production

---

## 🔧 The 4 Hooks

| Hook | When It Runs | What It Does | Blocks? |
|------|--------------|--------------|---------|
| **post-type-change** | After changing `.types.ts` or `schema.prisma` | Validates type synchronization | No (warns) |
| **pre-commit** | Before git commit | TypeScript checks, type sync, console.log detection | Yes (on errors) |
| **pre-migration** | Before Prisma migration | Schema validation, destructive op detection, environment check | Yes (on errors) |
| **post-docs-update** | After changing `.md` files | Link validation, code block checks, timestamp updates | No (warns) |

---

## 📋 Hook Details

### 1. **post-type-change Hook**

**Purpose:** Auto-validate type synchronization when type files change

**Triggers on:**
- Changes to `backend/src/types/*.types.ts`
- Changes to `frontend/src/types/*.types.ts`
- Changes to `backend/prisma/schema.prisma`

**What it checks:**
1. Detects which type files changed
2. Runs `/sync-types --check` validation
3. If controller types changed, suggests running API docs
4. Reports serializer mapping issues

**Example output:**
```
=== Post-Type-Change Validation ===

Changed type files (3):
  M backend/prisma/schema.prisma
  M backend/src/types/processor-rate-v2.types.ts
  M frontend/src/types/fabricCosting.types.ts

Running type synchronization check...
✓ Types are synchronized

Controller types changed - consider running:
  node scripts/skills/api-docs.js --generate
```

**When it helps:**
- You modify Prisma schema and forget to sync frontend types
- You change backend types and frontend breaks
- You need to remember to update API docs

**Manual run:**
```bash
node scripts/hooks/post-type-change.js
```

---

### 2. **pre-commit Hook**

**Purpose:** Quality gates before allowing commits

**Triggers on:** `git commit`

**What it checks:**
1. **TypeScript type checking** (both backend and frontend)
   - Runs `tsc --noEmit` to catch type errors
   - Blocks commit if type errors found
2. **Type synchronization validation**
   - Runs `/sync-types --check`
   - Blocks commit if types are out of sync
3. **Console.log detection**
   - Scans staged `.ts` and `.tsx` files
   - Warns (doesn't block) if console.log found in production code
   - Ignores test files, scripts, and commented lines

**Example output (success):**
```
=== Pre-Commit Quality Gates ===

Staged files: 5

1. Running TypeScript type checking...
✓ Backend TypeScript check passed
✓ Frontend TypeScript check passed

2. Validating type synchronization...
✓ Types are synchronized

3. Checking for console.log statements...
✓ No console.log found

✓ All pre-commit checks passed
Safe to commit
```

**Example output (failure):**
```
=== Pre-Commit Quality Gates ===

Staged files: 3

1. Running TypeScript type checking...
✗ Backend TypeScript errors found
src/controllers/fabric-stock.controller.ts(203,30): error TS18046: 'error' is of type 'unknown'.
src/controllers/styleCosting.controller.ts(140,7): error TS2322: Type '{ styleId: string; }' is not assignable...

2. Validating type synchronization...
⚠ Type synchronization issues detected
Run: node scripts/skills/sync-types.js --report for details

3. Checking for console.log statements...
✓ No console.log found

✗ Pre-commit checks failed
Fix the issues above before committing
```

**When it helps:**
- Prevents committing code with TypeScript errors
- Catches type drift before it reaches CI/CD
- Reminds you to remove debug console.log statements
- Enforces code quality standards

**Manual run:**
```bash
# Stage files first
git add .
node scripts/hooks/pre-commit.js
```

---

### 3. **pre-migration Hook**

**Purpose:** Safety checks before Prisma database migrations

**Triggers on:**
- `prisma migrate dev`
- `prisma migrate deploy`
- `node scripts/skills/db-workflow.js --migrate`
- `node scripts/skills/db-workflow.js --reset`

**What it checks:**
1. **Prisma schema syntax validation**
   - Runs `prisma validate`
   - Blocks if schema has syntax errors
2. **Destructive operations detection**
   - Warns about DROP TABLE, DROP COLUMN operations
   - Reminds to backup data before destructive changes
3. **Serializer relation mappings check**
   - Lists all snake_case relations in schema
   - Reminds to update `serializer.ts` RELATION_MAPPINGS
4. **Environment validation**
   - **Blocks in production** unless explicitly confirmed
   - Warns about running migrations in non-dev environments
5. **Migration conflicts detection**
   - Checks for multiple pending migrations
   - Warns about potential conflicts

**Example output:**
```
=== Pre-Migration Safety Checks ===

1. Validating Prisma schema syntax...
✓ Schema syntax is valid

2. Checking for destructive operations...
ℹ Manual review recommended for destructive changes
  If dropping tables/columns, ensure data backup exists

3. Checking serializer relation mappings...
Found 62 snake_case relations:
  - customers_billing
  - suppliers_shipping
  - style_fabrics
  ... and 59 more
Ensure serializer.ts RELATION_MAPPINGS includes these

4. Checking environment...
✓ Environment: development

5. Checking for migration conflicts...
✓ No migration conflicts

✓ All pre-migration checks passed
Safe to proceed with migration
```

**Production blocking example:**
```
=== Pre-Migration Safety Checks ===

4. Checking environment...
⚠ WARNING: Running migration in PRODUCTION environment!
✗ Migration blocked for safety
  Set ALLOW_PRODUCTION_MIGRATION=true to override

✗ Pre-migration checks failed
Aborting migration for safety
```

**When it helps:**
- Prevents data loss from destructive migrations
- Catches schema syntax errors before migration
- Ensures serializer mappings are up to date
- Blocks accidental production migrations
- Validates migration safety

**Manual run:**
```bash
node scripts/hooks/pre-migration.js
```

---

### 4. **post-docs-update Hook**

**Purpose:** Validate documentation quality when markdown files change

**Triggers on:**
- Changes to any `*.md` file

**What it checks:**
1. **Broken internal links**
   - Finds `[text](path)` links in markdown
   - Validates linked files exist
   - Warns about broken links (doesn't block)
2. **Code block validation**
   - Checks for dangerous commands (`rm -rf /`, `DROP DATABASE`, etc.)
   - Validates code block syntax
   - Warns about potential issues
3. **Automatic timestamp updates**
   - Finds `**Last Updated:** date` patterns
   - Auto-updates to current date when file changes

**Example output:**
```
=== Documentation Validation ===

Changed markdown files (8):
  M CLAUDE.md
  M AI_FEATURES_GUIDE.md
  M SKILLS_USAGE_GUIDE.md
  ... and 5 more

Checking for broken links...
⚠ Broken links in AI_FEATURES_GUIDE.md:
  - [Implementation Plan](.claude/plans/piped-mapping-fountain.md)
  - [Skills Documentation](SKILLS_GUIDE.md)

⚠ Broken links in NAVIGATION_UPDATE.md:
  - [Processor Rate Card](docs/processor-rate-card.md)
  - [Fabric Costing](docs/fabric-costing.md)
  ... and 4 more

Validating code blocks...
✓ No dangerous commands found

Updating timestamps...
✓ Updated timestamps in 3 files

⚠ Documentation validation complete with warnings
Fix broken links when possible
```

**When it helps:**
- Catches broken documentation links before commit
- Prevents dangerous command examples in docs
- Keeps documentation timestamps current
- Maintains documentation quality

**Manual run:**
```bash
node scripts/hooks/post-docs-update.js
```

---

## 🚀 How Hooks Work in Your Workflow

### Automatic Execution

**When you make changes:**
```bash
# 1. Edit backend types
# Edit: backend/src/types/fabric-supplier.types.ts

# → post-type-change hook runs automatically
#   Validates type synchronization
#   Suggests running API docs if needed

# 2. Edit documentation
# Edit: FABRIC_COSTING_GUIDE.md

# → post-docs-update hook runs automatically
#   Checks for broken links
#   Updates timestamp
#   Validates code blocks
```

**When you commit:**
```bash
# 1. Stage your changes
git add .

# 2. Try to commit
git commit -m "Add fabric supplier feature"

# → pre-commit hook runs automatically
#   ✓ TypeScript type checking (backend + frontend)
#   ✓ Type synchronization validation
#   ✓ Console.log detection
#   → Blocks commit if any checks fail
```

**When you migrate:**
```bash
# 1. Edit schema
# Edit: backend/prisma/schema.prisma

# 2. Run migration
node scripts/skills/db-workflow.js --migrate

# → pre-migration hook runs automatically
#   ✓ Schema syntax validation
#   ✓ Destructive operation detection
#   ✓ Serializer mapping check
#   ✓ Environment validation
#   ✓ Migration conflict detection
#   → Blocks migration if any checks fail
```

---

## 🎯 Common Scenarios

### Scenario 1: Adding a New Feature

**Your workflow:**
```bash
# 1. Edit Prisma schema
# Edit: backend/prisma/schema.prisma
# Add new FabricSupplier model

# 2. Run migration
node scripts/skills/db-workflow.js --migrate
# → pre-migration hook validates schema
# ✓ All checks passed

# 3. Create backend types
# Create: backend/src/types/fabric-supplier.types.ts
# → post-type-change hook runs
# ⚠ Warning: Frontend types missing

# 4. Create frontend types
# Create: frontend/src/types/fabric-supplier.types.ts
# → post-type-change hook runs
# ✓ Types synchronized

# 5. Implement feature (controllers, services, pages)

# 6. Update documentation
# Edit: FABRIC_SUPPLIER_GUIDE.md
# → post-docs-update hook runs
# ✓ Timestamp updated

# 7. Commit changes
git add .
git commit -m "feat: Add fabric supplier feature"
# → pre-commit hook runs
# ✓ TypeScript checks passed
# ✓ Types synchronized
# ✓ No console.log found
# → Commit succeeds
```

---

### Scenario 2: Hook Catches Error

**What happens:**
```bash
# You modify backend types
# Edit: backend/src/types/style.types.ts

# You forget to update frontend types

# You try to commit
git add .
git commit -m "Update style types"

# → pre-commit hook runs
# ✓ Backend TypeScript check passed
# ✗ Frontend TypeScript errors found
#   Property 'newField' does not exist on type 'Style'...
# ✗ Type synchronization issues detected
#   Run: node scripts/skills/sync-types.js --report
# → Commit BLOCKED

# Fix the issue
node scripts/skills/sync-types.js --check
# Shows exactly what's out of sync

# Update frontend types
# Edit: frontend/src/types/style.types.ts

# Try commit again
git commit -m "Update style types"
# → pre-commit hook runs
# ✓ All checks passed
# → Commit succeeds
```

---

### Scenario 3: Production Migration Protection

**What happens:**
```bash
# Accidentally set NODE_ENV=production
export NODE_ENV=production

# Try to run migration
node scripts/skills/db-workflow.js --migrate

# → pre-migration hook runs
# ⚠ WARNING: Running migration in PRODUCTION environment!
# ✗ Migration blocked for safety
#   Set ALLOW_PRODUCTION_MIGRATION=true to override
# → Migration BLOCKED

# Fix environment
export NODE_ENV=development

# Run migration again
node scripts/skills/db-workflow.js --migrate
# → pre-migration hook runs
# ✓ Environment: development
# ✓ All checks passed
# → Migration proceeds
```

---

## 🔧 Hook Configuration

### Enable/Disable Hooks

Edit `.claude/hooks/<hook-name>.hook.json`:

```json
{
  "name": "pre-commit",
  "enabled": true,  // Set to false to disable
  "blocking": true, // Set to false for warnings only
  "timeout": 120000 // Adjust timeout if needed
}
```

### Temporarily Skip Hooks

```bash
# Skip pre-commit hook (NOT RECOMMENDED)
git commit --no-verify -m "message"

# Better: Fix the issues instead of skipping
```

---

## 📊 Hook Reference

### File Locations

**Hook Metadata:**
- `.claude/hooks/post-type-change.hook.json`
- `.claude/hooks/pre-commit.hook.json`
- `.claude/hooks/pre-migration.hook.json`
- `.claude/hooks/post-docs-update.hook.json`

**Hook Implementation:**
- `scripts/hooks/post-type-change.js`
- `scripts/hooks/pre-commit.js`
- `scripts/hooks/pre-migration.js`
- `scripts/hooks/post-docs-update.js`

### Manual Testing

```bash
# Test each hook manually
node scripts/hooks/post-type-change.js
node scripts/hooks/pre-commit.js       # Requires staged files
node scripts/hooks/pre-migration.js
node scripts/hooks/post-docs-update.js
```

---

## 💡 Best Practices

### 1. Don't Skip Hooks
**Bad:**
```bash
git commit --no-verify -m "Quick fix"
```

**Good:**
```bash
# Fix the issues, then commit normally
node scripts/skills/sync-types.js --check
git commit -m "Quick fix"
```

### 2. Read Hook Output
Hooks provide helpful messages - read them!

**Hook says:**
```
⚠ Type synchronization issues detected
Run: node scripts/skills/sync-types.js --report for details
```

**You should:**
```bash
node scripts/skills/sync-types.js --report
# Read the output, fix the issues
```

### 3. Keep Hooks Updated
When you add new validations to skills, update hooks to use them.

### 4. Test Before Committing
```bash
# Before: git add . && git commit
# After: git add . && <hook runs automatically>

# If you want to preview:
git add .
node scripts/hooks/pre-commit.js  # See what will happen
```

---

## 🎓 Learning Resources

- Hook metadata files: `.claude/hooks/*.hook.json`
- Hook implementation: `scripts/hooks/*.js`
- Skills integration: [SKILLS_USAGE_GUIDE.md](SKILLS_USAGE_GUIDE.md)
- Project overview: [CLAUDE.md](CLAUDE.md)
- Full AI features: [AI_FEATURES_GUIDE.md](AI_FEATURES_GUIDE.md)

---

**Last Updated:** December 27, 2025
**Status:** All 4 hooks operational and enforcing quality standards
