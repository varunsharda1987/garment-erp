# Skills Usage Guide - Practical Examples

This guide shows you exactly how to use the custom Claude Code skills in your daily development workflow.

---

## 🚀 Quick Start

### Daily Development Checklist

**Before starting work:**
```bash
# Check type synchronization status
node scripts/skills/sync-types.js --report
```

**After making changes:**
```bash
# 1. Validate types are in sync
node scripts/skills/sync-types.js --check

# 2. Run tests
node scripts/skills/test-all.js --all

# 3. Generate commit message
node scripts/skills/commit-smart.js --generate
```

---

## 📋 Common Workflows

### Workflow 1: Adding a New API Endpoint

**Example: Add a new `/api/fabric-suppliers` endpoint**

```bash
# 1. Create your files:
#    - backend/src/types/fabric-supplier.types.ts
#    - backend/src/controllers/fabric-supplier.controller.ts
#    - backend/src/services/fabric-supplier.service.ts
#    - backend/src/routes/fabric-supplier.routes.ts

# 2. Check if types need frontend equivalents
node scripts/skills/sync-types.js --report

# 3. If needed, the report will show "Backend Only" - create frontend types
#    - frontend/src/types/fabric-supplier.types.ts

# 4. Validate synchronization
node scripts/skills/sync-types.js --check

# 5. Update API documentation automatically
node scripts/skills/api-docs.js --generate
# This creates/updates API_REFERENCE.md with your new endpoint

# 6. List all endpoints to verify yours is there
node scripts/skills/api-docs.js --list | grep fabric-supplier

# 7. Run tests
node scripts/skills/test-all.js --all

# 8. Stage your changes
git add .

# 9. Generate smart commit message
node scripts/skills/commit-smart.js --generate
# Copy the generated message and use it for your commit
```

---

### Workflow 2: Modifying Prisma Schema

**Example: Add a new `FabricSupplier` model**

```bash
# 1. Edit backend/prisma/schema.prisma
#    Add your new model

# 2. Run database migration + seed + docs (all in one!)
node scripts/skills/db-workflow.js --migrate
# This runs:
#   - npx prisma generate
#   - npx prisma migrate dev
#   - Seeds database
#   - Generates schema docs

# 3. Update backend types to match new schema
#    Edit backend/src/types/fabric-supplier.types.ts

# 4. Check type synchronization
node scripts/skills/sync-types.js --report
# Look for any missing frontend types

# 5. Create frontend types if needed
#    frontend/src/types/fabric-supplier.types.ts

# 6. Generate API docs
node scripts/skills/api-docs.js --generate

# 7. Commit with smart message
git add .
node scripts/skills/commit-smart.js --generate
```

---

### Workflow 3: Database Reset (Fresh Start)

**Example: Reset your development database**

```bash
# WARNING: This deletes all data!
# Full reset: migrate + seed + docs
node scripts/skills/db-workflow.js --reset

# Or if you just want to re-seed without migrating
node scripts/skills/db-workflow.js --seed
```

---

### Workflow 4: Testing Before PR

**Example: Prepare for pull request**

```bash
# 1. Check type synchronization
node scripts/skills/sync-types.js --check

# 2. Run all tests with coverage
node scripts/skills/test-all.js --coverage

# 3. Generate/update API documentation
node scripts/skills/api-docs.js --generate

# 4. Validate routes for duplicates
node scripts/skills/api-docs.js --validate

# 5. Preview your changes
node scripts/skills/commit-smart.js --preview

# 6. Generate commit message
node scripts/skills/commit-smart.js --generate

# 7. Stage and commit
git add .
# Use the generated commit message
```

---

### Workflow 5: Debugging Type Issues

**Example: Frontend can't access nested relation**

```bash
# Problem: Getting "undefined" when accessing style.brandCategories

# 1. Check type synchronization
node scripts/skills/sync-types.js --report

# 2. Look at the "Serializer Mappings" section
# You'll see output like:
#   Serializer Mappings:
#     Total mappings: 62
#     Examples:
#       brand_categories → brandCategories
#       styleComponents → components
#       ...

# 3. The report tells you:
#    - Backend uses: brand_categories (snake_case)
#    - API returns: brandCategories (camelCase)
#    - Frontend should use: brandCategories (camelCase)

# 4. Fix your frontend code:
#    WRONG: const category = style.brand_categories?.category;
#    RIGHT: const category = style.brandCategories?.category;
```

---

### Workflow 6: Quick API Endpoint Reference

**Example: Find all user-related endpoints**

```bash
# List all endpoints and filter for "user"
node scripts/skills/api-docs.js --list | grep -i user

# Or see all endpoints at once
node scripts/skills/api-docs.js --list

# Generate full API documentation file
node scripts/skills/api-docs.js --generate
# Opens API_REFERENCE.md
```

---

## 🎯 Integration with Your Current Workflow

### Option 1: Add to package.json scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "sync-types": "node scripts/skills/sync-types.js --report",
    "sync-types:check": "node scripts/skills/sync-types.js --check",
    "db:setup": "node scripts/skills/db-workflow.js --setup",
    "db:migrate": "node scripts/skills/db-workflow.js --migrate",
    "db:reset": "node scripts/skills/db-workflow.js --reset",
    "db:seed": "node scripts/skills/db-workflow.js --seed",
    "test:all": "node scripts/skills/test-all.js --all",
    "test:coverage": "node scripts/skills/test-all.js --coverage",
    "docs:api": "node scripts/skills/api-docs.js --generate",
    "docs:api:list": "node scripts/skills/api-docs.js --list",
    "commit:smart": "node scripts/skills/commit-smart.js --generate"
  }
}
```

Then use them like:
```bash
npm run sync-types
npm run db:migrate
npm run test:all
npm run docs:api
npm run commit:smart
```

---

### Option 2: Create a development checklist script

Create `scripts/dev-checklist.sh`:

```bash
#!/bin/bash

echo "🔍 Running Development Checklist..."

echo ""
echo "1️⃣  Checking type synchronization..."
node scripts/skills/sync-types.js --check

echo ""
echo "2️⃣  Running all tests..."
node scripts/skills/test-all.js --all

echo ""
echo "3️⃣  Generating API documentation..."
node scripts/skills/api-docs.js --generate

echo ""
echo "✅ All checks passed! Ready to commit."
echo ""
echo "4️⃣  Generate commit message:"
node scripts/skills/commit-smart.js --generate
```

Make it executable:
```bash
chmod +x scripts/dev-checklist.sh
```

Run it before committing:
```bash
./scripts/dev-checklist.sh
```

---

## 💡 Tips & Tricks

### Tip 1: Use in CI/CD Pipeline

Add to your `.github/workflows/ci.yml`:

```yaml
- name: Validate Type Synchronization
  run: node scripts/skills/sync-types.js --check

- name: Run All Tests
  run: node scripts/skills/test-all.js --coverage

- name: Validate API Routes
  run: node scripts/skills/api-docs.js --validate
```

### Tip 2: Quick Type Reference

When working on frontend and unsure about camelCase transformation:

```bash
# Quick reference for all 62 mappings
node scripts/skills/sync-types.js --report | grep "→"
```

### Tip 3: Before Every Commit

Create a git alias:

```bash
# Add to ~/.gitconfig
[alias]
  precommit = !node scripts/skills/sync-types.js --check && node scripts/skills/commit-smart.js --preview
  smartcommit = !node scripts/skills/commit-smart.js --generate
```

Usage:
```bash
git precommit    # Check before committing
git smartcommit  # Generate commit message
```

---

## 🔧 Troubleshooting

### Issue: "Backend Only" types shown in sync-types report

**Solution:**
This is normal if the type is only used internally in the backend. Frontend-only types (UI state, forms) are also fine. Only create frontend equivalents if:
- The type represents API response data
- The frontend needs to consume this data

### Issue: Test skill shows "command not found"

**Solution:**
Make sure you're running from the project root directory:
```bash
cd c:\Users\NEW\garment-erp
node scripts/skills/test-all.js --all
```

### Issue: Commit smart shows too many unrelated changes

**Solution:**
Stage only the files you want to commit first:
```bash
git add backend/src/types/new-feature.types.ts
git add frontend/src/types/new-feature.types.ts
node scripts/skills/commit-smart.js --generate
```

---

## 📖 Real-World Example

Here's a complete example of adding a "Fabric Quality Ratings" feature:

```bash
# Step 1: Start fresh - check current state
node scripts/skills/sync-types.js --report

# Step 2: Add Prisma model
# Edit backend/prisma/schema.prisma
# Add FabricQualityRating model

# Step 3: Run database workflow
node scripts/skills/db-workflow.js --migrate

# Step 4: Create backend types
# Create backend/src/types/fabric-quality-rating.types.ts

# Step 5: Create controller, service, routes
# backend/src/controllers/fabric-quality-rating.controller.ts
# backend/src/services/fabric-quality-rating.service.ts
# backend/src/routes/fabric-quality-rating.routes.ts

# Step 6: Check type sync
node scripts/skills/sync-types.js --report
# Shows "Backend Only: fabric-quality-rating.types.ts"

# Step 7: Create frontend types
# frontend/src/types/fabric-quality-rating.types.ts

# Step 8: Create frontend page
# frontend/src/pages/FabricQualityRatingPage.tsx

# Step 9: Validate everything
node scripts/skills/sync-types.js --check      # ✓ Types in sync
node scripts/skills/api-docs.js --generate     # ✓ API docs updated
node scripts/skills/test-all.js --all          # ✓ Tests pass

# Step 10: Commit
git add .
node scripts/skills/commit-smart.js --generate

# Output:
# feat: Add fabric quality rating system
#
# - Add FabricQualityRating Prisma model
# - Create backend types, controller, service, and routes
# - Add frontend types and rating page
# - Update API documentation
# - Sync types (backend → frontend camelCase)
#
# 🤖 Generated with Claude Code
# Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## 🎓 Learning Resources

- Full documentation: See [AI_FEATURES_GUIDE.md](AI_FEATURES_GUIDE.md)
- Implementation plan: See [.claude/plans/piped-mapping-fountain.md](.claude/plans/piped-mapping-fountain.md)
- Project instructions: See [CLAUDE.md](CLAUDE.md)

---

**Last Updated:** December 27, 2025
**Status:** All 5 skills operational and ready for daily use
