# MCP Quick Reference Card

**Model Context Protocol Servers - Essential Commands**

---

## 🎯 The 4 MCP Servers

| Server | Purpose | Key Insight |
|--------|---------|-------------|
| **Prisma** | Schema analysis | 195 models, 121 unmapped relations |
| **TypeScript LSP** | Type intelligence | **189 case mismatches found!** |
| **Database** | Read-only queries | Safe DB access, blocks writes |
| **Documentation** | Doc search | 54 files, 12 outdated |

---

## 🔥 Most Important Commands

### Daily Use (Run These Often!)

```bash
# Check for case mismatches (CRITICAL!)
node mcp-servers/typescript-server/index.js mismatches

# Validate serializer mappings
node mcp-servers/prisma-server/index.js mappings

# Search documentation
node mcp-servers/docs-server/index.js search <keyword>
```

---

## 📋 Command Reference

### Prisma MCP Server

```bash
# Schema statistics
node mcp-servers/prisma-server/index.js stats

# List all models
node mcp-servers/prisma-server/index.js introspect

# Check serializer mappings
node mcp-servers/prisma-server/index.js mappings

# Suggest includes for query
node mcp-servers/prisma-server/index.js includes <Model> [depth]
```

**Example:**
```bash
node mcp-servers/prisma-server/index.js includes Style 1
# Output: Suggested includes for Style queries
```

---

### TypeScript LSP MCP Server

```bash
# Type statistics
node mcp-servers/typescript-server/index.js stats

# Find case mismatches (⚠ 189 found!)
node mcp-servers/typescript-server/index.js mismatches

# Find all references to a type
node mcp-servers/typescript-server/index.js references <TypeName>

# Find unused types
node mcp-servers/typescript-server/index.js unused

# Suggest imports
node mcp-servers/typescript-server/index.js imports <TypeName>
```

**Example:**
```bash
node mcp-servers/typescript-server/index.js references Style
# Output: Shows all 147 places Style type is used
```

---

### Database Query MCP Server

```bash
# Connection info
node mcp-servers/database-server/index.js connection

# Row counts for all tables
node mcp-servers/database-server/index.js counts

# Validate seed data
node mcp-servers/database-server/index.js validate
```

**Security:** All non-SELECT queries are BLOCKED (INSERT, UPDATE, DELETE, DROP)

---

### Documentation MCP Server

```bash
# Documentation statistics
node mcp-servers/docs-server/index.js stats

# Search across all docs
node mcp-servers/docs-server/index.js search <keyword>

# Find outdated documentation
node mcp-servers/docs-server/index.js outdated

# Check completeness
node mcp-servers/docs-server/index.js completeness

# Suggest updates
node mcp-servers/docs-server/index.js suggest
```

**Example:**
```bash
node mcp-servers/docs-server/index.js search "processor rate"
# Output: Shows all 47 mentions across 8 files
```

---

## 🚀 Common Workflows

### Workflow 1: Before Every Commit
```bash
# 1. Check for case mismatches
node mcp-servers/typescript-server/index.js mismatches

# 2. If found, fix them:
# WRONG: style.brand_categories
# RIGHT: style.brandCategories

# 3. Then commit
git commit -m "Fix case mismatches"
```

---

### Workflow 2: After Schema Changes
```bash
# 1. Check serializer mappings
node mcp-servers/prisma-server/index.js mappings

# 2. Add missing mappings to serializer.ts
# RELATION_MAPPINGS = {
#   newRelation: 'newRelation'
# }

# 3. Validate seed data
node mcp-servers/database-server/index.js validate
```

---

### Workflow 3: Finding Documentation
```bash
# Search for what you need
node mcp-servers/docs-server/index.js search "feature name"

# Output shows which file has the info
```

---

### Workflow 4: Optimizing a Query
```bash
# Get suggested includes
node mcp-servers/prisma-server/index.js includes Style 1

# Use suggestions in your code
const style = await prisma.style.findUnique({
  where: { id },
  include: { /* paste suggestions here */ }
});
```

---

## ⚠️ Critical Findings

### 🔴 189 Case Mismatches Detected!

The TypeScript LSP MCP found **189 instances** where frontend code uses `snake_case` instead of `camelCase`.

**Example Issues:**
```typescript
// WRONG (found in 189 places):
genericTrims.hook_eye         // ❌
genericTrims.snap_button       // ❌
import.meta.env.VITE_API_URL  // ❌ (this one's OK - env vars)

// RIGHT:
genericTrims.hookEye           // ✓
genericTrims.snapButton        // ✓
```

**Why critical:** Backend uses snake_case (Prisma), but serializer converts API responses to camelCase. Frontend MUST use camelCase!

**Fix command:**
```bash
node mcp-servers/typescript-server/index.js mismatches > fixes.txt
# Review fixes.txt and update code
```

---

### 🔴 121 Unmapped Relations

Prisma MCP found **121 relations** in schema that aren't in serializer.ts RELATION_MAPPINGS.

**Impact:** API responses may have wrong property names, causing frontend errors.

**Fix:**
```bash
# 1. See what's missing
node mcp-servers/prisma-server/index.js mappings

# 2. Add to backend/src/utils/serializer.ts
export const RELATION_MAPPINGS = {
  // Add missing ones here
  billOfMaterials: 'billOfMaterials',
  colorMaster: 'colorMaster',
  // ...
}
```

---

## 💡 Pro Tips

### Tip 1: Pipe Output to File
```bash
# Save results for review
node mcp-servers/typescript-server/index.js mismatches > case-issues.txt
node mcp-servers/prisma-server/index.js mappings > missing-mappings.txt
```

### Tip 2: Combine with grep
```bash
# Find specific patterns
node mcp-servers/docs-server/index.js search "API" | grep "endpoint"
```

### Tip 3: Weekly Health Check
```bash
# Run every Monday:
echo "=== Weekly Codebase Health Check ==="
node mcp-servers/typescript-server/index.js mismatches | head -n 5
node mcp-servers/prisma-server/index.js mappings | grep "Missing"
node mcp-servers/docs-server/index.js outdated | head -n 10
node mcp-servers/database-server/index.js validate
```

---

## 🆘 Emergency Commands

### "API returns undefined property"
```bash
# Check if it's a case mismatch
node mcp-servers/typescript-server/index.js mismatches | grep "property_name"
```

### "Can't find type definition"
```bash
# Search for the type
node mcp-servers/typescript-server/index.js references TypeName
```

### "Database seems empty"
```bash
# Check row counts
node mcp-servers/database-server/index.js counts

# Validate seed data
node mcp-servers/database-server/index.js validate
```

### "Where is this feature documented?"
```bash
# Search docs
node mcp-servers/docs-server/index.js search "feature name"
```

---

## 📊 Key Statistics

### Prisma MCP
- **195 models** in schema
- **3,115 fields** total
- **626 relations** total
- **62 serializer mappings** configured
- **121 unmapped relations** (need fixing!)

### TypeScript LSP
- **1,144 total types** (252 backend, 892 frontend)
- **189 case mismatches** detected (need fixing!)
- **21 backend** type files
- **66 frontend** type files

### Database MCP
- **Read-only enforced** (blocks INSERT, UPDATE, DELETE)
- **Connection:** postgres@localhost:5432/garment_erp

### Documentation MCP
- **54 markdown files**
- **25,379 lines** of documentation
- **695 KB** total size
- **12 outdated files** (timestamps need updating)

---

## 📖 Full Documentation

- **Complete Guide:** [MCP_USAGE_GUIDE.md](MCP_USAGE_GUIDE.md)
- **Implementation Details:** [PHASE_3_COMPLETE.md](PHASE_3_COMPLETE.md)
- **AI Features Overview:** [AI_FEATURES_GUIDE.md](AI_FEATURES_GUIDE.md)

---

**Last Updated:** December 27, 2025
**Status:** All 4 MCP servers operational
