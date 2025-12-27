# MCP Usage Guide - Model Context Protocol Servers

This guide shows you how to use the 4 MCP servers for deep codebase analysis and insights.

---

## 🚀 What Are MCP Servers?

MCP (Model Context Protocol) servers provide **expert-level analysis** of your codebase:
- **Prisma MCP:** Schema analysis, query optimization, relation mapping
- **TypeScript LSP:** Type intelligence, reference finding, case mismatch detection
- **Database MCP:** Read-only database queries, table statistics, seed validation
- **Documentation MCP:** Smart doc search, outdated detection, completeness checking

**Key Benefits:**
- **Deep insights** - Analyze complex patterns across the entire codebase
- **Expert guidance** - Get suggestions based on best practices
- **Safety** - Read-only operations, no destructive changes
- **Integration** - Works seamlessly with skills and hooks

---

## 📋 The 4 MCP Servers

| Server | Purpose | Key Features |
|--------|---------|--------------|
| **Prisma MCP** | Schema analysis | 195 models, 626 relations, serializer mapping |
| **TypeScript LSP** | Type intelligence | 1144 types, case mismatch detection, references |
| **Database MCP** | DB queries (read-only) | Row counts, seed validation, connection info |
| **Documentation MCP** | Doc search & validation | 54 files, outdated detection, completeness |

---

## 🎯 Prisma MCP Server

**Purpose:** Deep Prisma schema analysis and query optimization

### Available Commands

#### 1. Schema Statistics
```bash
node mcp-servers/prisma-server/index.js stats
```

**Output:**
```
Schema Statistics:
  Total models: 195
  Total fields: 3115
  Total relations: 626

Models with most relations:
  1. users: 57 relations
  2. suppliers: 19 relations
  3. materials: 15 relations
  4. style_material_bom: 11 relations
  5. customers: 10 relations
```

**When to use:**
- Understanding schema complexity
- Identifying highly connected models
- Planning query strategies

---

#### 2. Introspect Schema
```bash
node mcp-servers/prisma-server/index.js introspect
```

**Output:**
```
Found 195 models:

users
  Fields: 25
  Relations: 57
    - bill_of_materials_approvedByIdTousers: bill_of_materials[]
    - orders_createdByIdTousers: orders[]
    - ...
```

**When to use:**
- Exploring available models
- Understanding model structure
- Planning includes for queries

---

#### 3. Serializer Mapping Analysis
```bash
node mcp-servers/prisma-server/index.js mappings
```

**Output:**
```
Serializer Mappings Analysis:
  Total mappings: 62
  Schema relations with underscore: 121

Missing mappings (121):
  - bill_of_materials
  - color_master
  - payment_terms
  - customers_billing
  ...
```

**When to use:**
- Before adding new relations
- Debugging API response issues
- Validating serializer completeness

**Critical:** If you add a relation with underscores (e.g., `style_fabrics`), you MUST add it to `serializer.ts` RELATION_MAPPINGS!

---

#### 4. Suggest Optimal Includes
```bash
node mcp-servers/prisma-server/index.js includes Style 1
node mcp-servers/prisma-server/index.js includes Style 2  # Nested depth
```

**Output:**
```
Suggested includes for Style:
{
  "brandCategories": true,
  "styleComponents": true,
  "styleFabrics": true,
  "styleVariants": true,
  ...
}
```

**When to use:**
- Building new queries
- Optimizing existing queries
- Avoiding N+1 problems

---

### Common Workflows

#### Workflow 1: Adding a New Relation

```bash
# 1. Edit schema.prisma - add new relation
# Add: style_accessories style_accessory[]

# 2. Check what needs to be mapped
node mcp-servers/prisma-server/index.js mappings

# Output shows: Missing mappings: style_accessories

# 3. Add to backend/src/utils/serializer.ts
# RELATION_MAPPINGS = {
#   ...
#   styleAccessories: 'accessories',
# }

# 4. Run migration
node scripts/skills/db-workflow.js --migrate

# 5. Verify mapping added
node mcp-servers/prisma-server/index.js mappings
```

---

#### Workflow 2: Optimizing a Query

```bash
# Problem: Slow query on Style model

# 1. Get suggested includes
node mcp-servers/prisma-server/index.js includes Style 1

# 2. Review suggestions - only include what you need
# Don't include all 57 relations if you only need 3!

# 3. Update your query:
const style = await prisma.style.findUnique({
  where: { id },
  include: {
    brandCategories: true,  # Only what's needed
    styleFabrics: true
  }
});
```

---

## 🔍 TypeScript LSP MCP Server

**Purpose:** Type intelligence and camelCase/snake_case mismatch detection

### Available Commands

#### 1. Type Statistics
```bash
node mcp-servers/typescript-server/index.js stats
```

**Output:**
```
Type Statistics:

Backend:
  Files: 21
  Total types: 252
  Interfaces: 225
  Enums: 3

Frontend:
  Files: 66
  Total types: 892
  Interfaces: 786
  Enums: 26
```

**When to use:**
- Understanding type coverage
- Comparing backend vs frontend types
- Planning type refactoring

---

#### 2. Detect Case Mismatches ⚠️ CRITICAL
```bash
node mcp-servers/typescript-server/index.js mismatches
```

**Output:**
```
CamelCase/snake_case Mismatches:
  Total found: 189

First 10 mismatches:

  \frontend\src\components\TrimSelector.tsx:369
    Property: hook_eye
    Suggestion: hookEye
    Line: case 'HOOK_EYE': return genericTrims.hook_eye;
```

**When to use:**
- **BEFORE EVERY COMMIT** - Critical for API response handling
- Debugging undefined property errors
- Code review validation

**Why critical:** Backend uses `snake_case` (Prisma), but serializer converts to `camelCase` for API responses. Frontend MUST use `camelCase`!

---

#### 3. Find All References
```bash
node mcp-servers/typescript-server/index.js references Style
```

**Output:**
```
References for "Style":
  Total found: 147

By location:
  backend: 23
  frontend: 124

First 5 references:
  \backend\src\controllers\style.controller.ts:15
    import { Style } from '../types/style.types';
  ...
```

**When to use:**
- Refactoring type names
- Understanding type usage
- Finding where to update after type changes

---

#### 4. Find Unused Types
```bash
node mcp-servers/typescript-server/index.js unused
```

**Output:**
```
Unused Type Definitions:
  Total found: 12

Unused types:
  - OldStyleType (type) in \backend\src\types\deprecated.types.ts
  - TempInterface (interface) in \frontend\src\types\temp.types.ts
```

**When to use:**
- Cleaning up codebase
- Identifying dead code
- Preparing for refactoring

---

#### 5. Suggest Auto-Imports
```bash
node mcp-servers/typescript-server/index.js imports ProcessorRateCard
```

**Output:**
```
Import suggestions for "ProcessorRateCard":

  backend:
    import { ProcessorRateCard } from 'backend/src/types/processor-rate-v2.types';
    Type: interface

  frontend:
    import { ProcessorRateCard } from 'frontend/src/types/processorRate.types';
    Type: interface
```

**When to use:**
- Adding imports to new files
- Resolving import errors
- Understanding type locations

---

### Common Workflows

#### Workflow 1: Fixing Case Mismatches (189 found!)

```bash
# 1. Find all mismatches
node mcp-servers/typescript-server/index.js mismatches > mismatches.txt

# 2. Review first 10
node mcp-servers/typescript-server/index.js mismatches

# 3. Fix each one:
# WRONG: genericTrims.hook_eye
# RIGHT: genericTrims.hookEye

# 4. Verify fixed
node mcp-servers/typescript-server/index.js mismatches
# Should show fewer mismatches
```

---

#### Workflow 2: Refactoring a Type Name

```bash
# Renaming: OldStyleType → StyleData

# 1. Find all references
node mcp-servers/typescript-server/index.js references OldStyleType

# Shows 23 files using it

# 2. Update all 23 files (or use IDE refactor)

# 3. Verify no more references
node mcp-servers/typescript-server/index.js references OldStyleType
# Should show 0 results
```

---

## 💾 Database Query MCP Server

**Purpose:** Read-only database insights (SAFE - blocks all writes)

### Available Commands

#### 1. Connection Info
```bash
node mcp-servers/database-server/index.js connection
```

**Output:**
```
Database connection info:
  Host: localhost
  Port: 5432
  Database: garment_erp
  User: postgres
  Password: ***hidden***
```

**When to use:**
- Verifying database configuration
- Debugging connection issues
- Setting up new environments

---

#### 2. Row Counts
```bash
node mcp-servers/database-server/index.js counts
```

**Output:**
```
Top 10 tables by row count:
  1. stock_transactions: 15,234 rows
  2. order_items: 8,456 rows
  3. users: 127 rows
  4. styles: 89 rows
  ...
```

**When to use:**
- Understanding data volume
- Identifying large tables
- Performance analysis
- Planning data archival

---

#### 3. Validate Seed Data
```bash
node mcp-servers/database-server/index.js validate
```

**Output:**
```
Validating seed data...

✓ All required seed data present

Present seed data:
  ✓ users: 5 rows
  ✓ roles: 8 rows
```

**When to use:**
- After running migrations
- After seeding database
- Before starting development
- CI/CD validation

---

### Security Features

**READ-ONLY ENFORCEMENT:**
```javascript
// Allowed:
SELECT * FROM users WHERE id = '123'

// Blocked:
INSERT INTO users ...  // ERROR: Only SELECT queries allowed
UPDATE users ...       // ERROR: Dangerous keyword detected: UPDATE
DELETE FROM users ...  // ERROR: Dangerous keyword detected: DELETE
DROP TABLE users       // ERROR: Dangerous keyword detected: DROP
```

**All destructive operations are BLOCKED.**

---

### Common Workflows

#### Workflow 1: Debugging Data Issues

```bash
# Problem: API returns empty array

# 1. Check if data exists
node mcp-servers/database-server/index.js counts

# Shows: orders: 0 rows

# 2. Validate seed data
node mcp-servers/database-server/index.js validate

# Shows: Missing seed data for orders

# 3. Run seed
node scripts/skills/db-workflow.js --seed

# 4. Verify
node mcp-servers/database-server/index.js counts
# Shows: orders: 50 rows
```

---

## 📖 Documentation MCP Server

**Purpose:** Smart documentation search and quality validation

### Available Commands

#### 1. Documentation Statistics
```bash
node mcp-servers/docs-server/index.js stats
```

**Output:**
```
Documentation Statistics:
  Total files: 54
  Total lines: 25,379
  Total size: 695.82 KB
  Average file size: 12.89 KB

Largest files:
  1. AI_ASSISTANT_IMPLEMENTATION_GUIDE.md (63.64 KB)
  2. PRODUCT_FLOW_GUIDE.md (50.08 KB)
  ...

By category:
  docs: 31 files
  root: 16 files
```

**When to use:**
- Understanding documentation coverage
- Identifying large docs
- Planning documentation strategy

---

#### 2. Search Documentation
```bash
node mcp-servers/docs-server/index.js search "processor rate"
```

**Output:**
```
Search results for "processor rate":
  Total matches: 47
  Files matched: 8

First 10 matches:
  PROCESSOR_RATE_CARD_GUIDE.md:15
    ## Processor Rate Card System
  ...
```

**When to use:**
- Finding relevant documentation
- Understanding where features are documented
- Quick reference lookup

---

#### 3. Detect Outdated Documentation
```bash
node mcp-servers/docs-server/index.js outdated
```

**Output:**
```
Outdated Documentation:
  Total files: 54
  Outdated: 12
  Missing timestamp: 8

Outdated files:
  - AI_FEATURES_GUIDE.md
    Last Updated: December 20, 2025
    File Modified: December 27, 2025 (7 days ago)
```

**When to use:**
- Before releases
- Periodic documentation audits
- After major changes

---

#### 4. Check Completeness
```bash
node mcp-servers/docs-server/index.js completeness
```

**Output:**
```
Documentation Completeness:
  Total files: 54
  With headers: 52
  With examples: 41
  With TOC: 15

Incomplete documentation (13 files):
  - QUICK_START.md
    Issues: No code examples
```

**When to use:**
- Quality audits
- Documentation reviews
- Onboarding improvements

---

#### 5. Suggest Updates
```bash
node mcp-servers/docs-server/index.js suggest
```

**Output:**
```
Documentation Update Suggestions:

1. Documentation timestamps
   Reason: 12 files have outdated timestamps
   → Update timestamps in modified files
```

**When to use:**
- Weekly documentation maintenance
- Before releases
- After major feature additions

---

### Common Workflows

#### Workflow 1: Finding Documentation

```bash
# Question: How do processor rate cards work?

# 1. Search for it
node mcp-servers/docs-server/index.js search "processor rate"

# Shows: PROCESSOR_RATE_CARD_GUIDE.md has 47 mentions

# 2. Open the file
# Read: PROCESSOR_RATE_CARD_GUIDE.md
```

---

#### Workflow 2: Documentation Maintenance

```bash
# Monthly documentation audit

# 1. Check for outdated files
node mcp-servers/docs-server/index.js outdated

# Shows: 12 files outdated

# 2. Check completeness
node mcp-servers/docs-server/index.js completeness

# Shows: 13 files incomplete

# 3. Get suggestions
node mcp-servers/docs-server/index.js suggest

# 4. Fix issues:
# - Update timestamps
# - Add missing examples
# - Add TOC to large files
```

---

## 🔗 Integration with Skills & Hooks

### MCP + Skills Integration

#### /sync-types + TypeScript LSP MCP
```javascript
// In sync-types skill:
const tsLSP = new TypeScriptLSPServer();
const mismatches = tsLSP.detectCaseMismatches();

// Report case mismatches alongside type sync issues
console.log(`Found ${mismatches.length} case mismatches`);
```

#### /db-workflow + Prisma MCP
```javascript
// In db-workflow skill:
const prismaMCP = new PrismaMCPServer();
const mappings = prismaMCP.analyzeSerializerMappings();

// Warn if unmapped relations exist
if (mappings.missingMappings.length > 0) {
  console.warn(`${mappings.missingMappings.length} relations need mapping`);
}
```

---

### MCP + Hooks Integration

#### pre-migration + Prisma MCP
```javascript
// In pre-migration hook:
const prismaMCP = new PrismaMCPServer();
const mappings = prismaMCP.analyzeSerializerMappings();

// Block migration if mappings incomplete
if (mappings.missingMappings.length > 50) {
  console.error('Too many unmapped relations!');
  process.exit(1);
}
```

#### post-docs-update + Documentation MCP
```javascript
// In post-docs-update hook:
const docsMCP = new DocumentationServer();
const outdated = docsMCP.detectOutdatedDocs();

// Auto-update timestamps
for (const doc of outdated.outdated) {
  // Update timestamp in file
}
```

---

## 💡 Best Practices

### 1. Run Regularly
```bash
# Daily checks:
node mcp-servers/typescript-server/index.js mismatches  # Check for case issues
node mcp-servers/prisma-server/index.js mappings        # Verify serializer

# Weekly checks:
node mcp-servers/docs-server/index.js outdated          # Update docs
node mcp-servers/database-server/index.js counts        # Monitor data growth
```

### 2. Before Commits
```bash
# Pre-commit checklist:
1. node mcp-servers/typescript-server/index.js mismatches
2. Fix any case mismatches found
3. node scripts/skills/sync-types.js --check
4. git commit
```

### 3. After Schema Changes
```bash
# Post-migration checklist:
1. node mcp-servers/prisma-server/index.js mappings
2. Add missing mappings to serializer.ts
3. node mcp-servers/database-server/index.js validate
4. Verify seed data present
```

### 4. Documentation Maintenance
```bash
# Monthly docs audit:
1. node mcp-servers/docs-server/index.js outdated
2. node mcp-servers/docs-server/index.js completeness
3. node mcp-servers/docs-server/index.js suggest
4. Fix identified issues
```

---

## 🎯 Quick Reference

### Most Important Commands

```bash
# Type issues (RUN DAILY!)
node mcp-servers/typescript-server/index.js mismatches

# Serializer validation
node mcp-servers/prisma-server/index.js mappings

# Database health
node mcp-servers/database-server/index.js validate

# Documentation search
node mcp-servers/docs-server/index.js search <keyword>
```

---

## 🆘 Troubleshooting

### "RELATION_MAPPINGS not found"
**Problem:** Prisma MCP can't find serializer mappings

**Solution:**
```bash
# Check serializer file exists
ls backend/src/utils/serializer.ts

# Verify RELATION_MAPPINGS is exported
grep "RELATION_MAPPINGS" backend/src/utils/serializer.ts
```

### "189 case mismatches found"
**Problem:** Frontend using snake_case instead of camelCase

**Solution:**
```bash
# Get full list
node mcp-servers/typescript-server/index.js mismatches > fixes-needed.txt

# Fix manually or use find-replace:
# OLD: .hook_eye
# NEW: .hookEye
```

### "Only SELECT queries allowed"
**Problem:** Trying to modify database via Database MCP

**Solution:**
This is intentional! Database MCP is READ-ONLY for safety.
Use Prisma Client or `db-workflow` skill for writes.

---

## 📚 Related Documentation

- [SKILLS_USAGE_GUIDE.md](SKILLS_USAGE_GUIDE.md) - Custom skills
- [HOOKS_USAGE_GUIDE.md](HOOKS_USAGE_GUIDE.md) - Automated hooks
- [AI_FEATURES_GUIDE.md](AI_FEATURES_GUIDE.md) - Complete AI features
- [PHASE_3_COMPLETE.md](PHASE_3_COMPLETE.md) - MCP implementation details

---

**Last Updated:** December 27, 2025
**Status:** All 4 MCP servers operational and tested
