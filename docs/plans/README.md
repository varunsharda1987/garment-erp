# Implementation Plans

> **Detailed Planning Documents & Architectural Decisions**
> **Last Updated:** January 15, 2026
> **Location:** `docs/plans/`

---

## Purpose

This folder contains detailed implementation plans, design decisions, and architectural documentation created during feature development. These plans provide valuable context about:

- **Design Rationale** - Why specific approaches were chosen
- **Implementation Details** - How features were built
- **Architectural Decisions** - System design trade-offs
- **Domain Knowledge** - Business logic and workflow understanding
- **Historical Context** - Evolution of the system

---

## How to Use This Folder

### During Planning
- New plan files are **automatically saved here** (configured in `.claude/settings.local.json`)
- Claude Code creates plans with random names (e.g., `happy-drifting-galaxy.md`)
- Plans capture comprehensive exploration and decision-making

### After Implementation
- Valuable plans are **preserved for future reference**
- Use plans to understand past decisions
- Reference when working on related features

### When Searching
- Use this README index to find plans by topic
- Use grep/search for keywords: `grep -i "fabric costing" docs/plans/*.md`
- File names are random - rely on topic descriptions

---

## Index of Preserved Plans

### Active Implementation Plans (3 files)

| Plan File | Topic | Size | Status | Date | Priority |
|-----------|-------|------|--------|------|----------|
| [partitioned-giggling-iverson.md](partitioned-giggling-iverson.md) | Order Management / Fabric Flow Analysis | 69KB | Reference | Dec 2024 | CRITICAL |
| [enchanted-wandering-unicorn.md](enchanted-wandering-unicorn.md) | Fabric Costing Linkage Analysis | 34KB | Reference | Dec 2024 | HIGH |
| [distributed-wandering-thimble.md](distributed-wandering-thimble.md) | Pre-Production Cost Sheet Enhancement | 17KB | Reference | Dec 2024 | HIGH |

> **Note:** `styleform-dedicated-agent.md` was moved to [docs/STYLEFORM_GUIDE.md](../STYLEFORM_GUIDE.md) on Jan 13, 2026

### Archived Plans (15 files) → [archive/](archive/)

| Plan File | Topic | Merged Into |
|-----------|-------|-------------|
| [CAD-Planning-Implementation.md](archive/CAD-Planning-Implementation.md) | CAD Planning Module | CAD_PLANNING_GUIDE.md |
| [floofy-weaving-lobster.md](archive/floofy-weaving-lobster.md) | Documentation Consolidation | docs/ structure |
| [floofy-churning-phoenix.md](archive/floofy-churning-phoenix.md) | Fix Trims (StyleMaterialBom) | BOM_MRP_GUIDE.md |
| [sunny-swinging-tarjan.md](archive/sunny-swinging-tarjan.md) | Stock Display System | STOCK_MANAGEMENT_GUIDE.md |
| [happy-drifting-galaxy.md](archive/happy-drifting-galaxy.md) | Indian States/Cities + GST | GST_GUIDE.md |
| [stateless-moseying-rivest.md](archive/stateless-moseying-rivest.md) | Fabric Costing 6 Critical Issues | FABRIC_COSTING_GUIDE.md |
| [jazzy-whistling-kazoo.md](archive/jazzy-whistling-kazoo.md) | CAD Planning List Enhancement | CAD_PLANNING_GUIDE.md |
| [zippy-mixing-pine.md](archive/zippy-mixing-pine.md) | Processor Rate Card Redesign | FABRIC_COSTING_GUIDE.md |
| [drifting-foraging-pixel.md](archive/drifting-foraging-pixel.md) | CAD Purposes System | CAD_PLANNING_GUIDE.md |
| [eventual-scribbling-haven.md](archive/eventual-scribbling-haven.md) | CAD Planning Data Flow Analysis | CAD_PLANNING_GUIDE.md |
| [eventual-tinkering-church.md](archive/eventual-tinkering-church.md) | Label/Packaging Customer Linking | MATERIALS_MASTER_GUIDE.md |
| [glowing-prancing-pixel.md](archive/glowing-prancing-pixel.md) | Multiple Costing Options | FABRIC_COSTING_GUIDE.md |
| [piped-mapping-fountain.md](archive/piped-mapping-fountain.md) | Skills/MCP/Hooks Integration | CLAUDE.md |
| [quirky-floating-pudding.md](archive/quirky-floating-pudding.md) | Production Tracking UI | PRODUCTION_PIPELINE_GUIDE.md |
| [brand-support-labels-packaging.md](archive/brand-support-labels-packaging.md) | Brand Support Labels/Packaging | MATERIALS_MASTER_GUIDE.md |

---

## Plans by Category

### 🔴 CRITICAL (1 file)
Critical system issues and major architectural decisions:
- Order Management / Fabric Flow Analysis (reference document)

### 🟠 HIGH PRIORITY (2 files)
Major features and system enhancements:
- Fabric Costing Linkage Analysis (reference document)
- Pre-production Cost Sheet Enhancement (planning document)

---

## Plans by Module

### CAD Planning
*All CAD plans executed and archived:*
- *glowing-prancing-pixel.md (Multiple Costing Options - 100% complete)*
- *drifting-foraging-pixel.md (CAD Purposes - 100% complete)*
- *jazzy-whistling-kazoo.md (CAD Planning List)*
- *CAD-Planning-Implementation.md*

### Fabric Costing (1 reference plan)
- `enchanted-wandering-unicorn.md` - Data flow analysis (reference document)
- *Archived: zippy-mixing-pine.md (Processor Rate Card), stateless-moseying-rivest.md (6 Critical Issues), glowing-prancing-pixel.md (Multiple Options)*

### Order Management (1 reference plan)
- `partitioned-giggling-iverson.md` - Fabric flow analysis (reference document)

### Production Tracking
*All production plans executed and archived:*
- *quirky-floating-pudding.md (Production Tracking UI - 100% complete)*

### System Architecture (1 plan)
- `distributed-wandering-thimble.md` - Pre-production cost sheet enhancement (planning document)
- *Archived: eventual-scribbling-haven.md, eventual-tinkering-church.md*

### Compliance & Regulations
*GST plan executed and archived - see [archive/happy-drifting-galaxy.md](archive/happy-drifting-galaxy.md)*

### AI/Developer Tools
*All AI/tools plans executed and archived:*
- *piped-mapping-fountain.md (Skills/MCP/Hooks - 100% complete)*
- *StyleForm AI guide moved to [docs/STYLEFORM_GUIDE.md](../STYLEFORM_GUIDE.md)*

### Materials/Labels/Packaging
*All material plans executed and archived:*
- *brand-support-labels-packaging.md (Brand Support - 100% complete)*
- *eventual-tinkering-church.md (Customer Linking - 100% complete)*

---

## Plan File Lifecycle

### 1. Creation (Automatic)
```
Claude Code creates plan → Saved to docs/plans/ automatically
```

### 2. Implementation
```
Plan guides implementation → References during development
```

### 3. Completion
```
Implementation done → Plan marked complete → Preserved for reference
```

### 4. Long-term Value
```
Historical reference → Design decisions → Domain knowledge
```

---

## Search Tips

### Find by Topic
```bash
# Fabric costing plans
grep -li "fabric costing" docs/plans/*.md

# CAD-related plans
grep -li "cad" docs/plans/*.md

# Architecture decisions
grep -li "architecture\|design decision" docs/plans/*.md
```

### Find by Status
```bash
# Active/in-progress plans
grep -l "Status.*Active\|Status.*In-Progress" docs/plans/*.md

# Completed plans
grep -l "Status.*Complete" docs/plans/*.md
```

### Find by Priority
```bash
# Critical issues
grep -l "CRITICAL" docs/plans/*.md

# High priority
grep -l "HIGH" docs/plans/*.md
```

---

## Configuration

Future plan files are automatically saved to this folder via configuration in `.claude/settings.local.json`:

```json
{
  "planDirectory": "docs/plans"
}
```

This ensures all new plans are:
- ✅ Version-controlled with git
- ✅ Part of project documentation
- ✅ Easy to discover and reference
- ✅ Preserved for future developers

---

## Archived Plans

Plans that have been consolidated into main documentation guides are moved to the `archive/` folder:

📁 **[archive/](archive/)** - Consolidated implementation plans with full metadata

See [archive/README.md](archive/README.md) for:
- **Consolidation tracking** - Which plans were merged into which guides
- **Content summary** - What was added to each guide
- **Historical reference** - Original implementation context

**When to check the archive:**
- Understanding why a feature was designed a certain way
- Finding the original implementation plan for a documented feature
- Tracing decisions from plan to documentation

---

## Related Documentation

- [PROJECT_BIBLE.md](../PROJECT_BIBLE.md) - Complete system documentation
- [MODULE_RELATIONSHIPS_GUIDE.md](../MODULE_RELATIONSHIPS_GUIDE.md) - Module interlinking
- [ARCHITECTURE.md](../archive/ARCHITECTURE.md) - Architectural decisions (archive)
- [CLAUDE.md](../../CLAUDE.md) - Development instructions

---

## Maintenance

### Adding New Plans
New plans are added automatically by Claude Code. No manual action needed.

### Updating This Index
When new critical plans are added:
1. Add entry to "Index of Preserved Plans" table
2. Update category counts
3. Add to relevant module section
4. Update "Last Updated" date at top

---

**Active Plans:** 3 files (~120KB) - Reference/planning documents
**Archived Plans:** 15 files (executed & merged)
**Moved to Docs:** 1 file (STYLEFORM_GUIDE.md)
**Coverage:** 10+ major modules
**Time Period:** Dec 2024 - Jan 2026
**Status:** Active maintenance
