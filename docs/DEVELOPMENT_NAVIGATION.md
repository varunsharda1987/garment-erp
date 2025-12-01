# 🗺️ DEVELOPMENT NAVIGATION GUIDE

> **Quick Reference** - Where to find what you need

**Last Updated:** November 15, 2025
**Purpose:** Central index of all project documentation
**For:** Developers, New Team Members, Future Sessions

---

## 🎯 START HERE

### New to the Project?
1. Read [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) - Complete roadmap
2. Review [GLOSSARY.md](GLOSSARY.md) - Understand terminology
3. Check [ARCHITECTURE.md](ARCHITECTURE.md) - System design
4. Setup environment using [LOCAL_DATABASE_SETUP.md](../LOCAL_DATABASE_SETUP.md)

### Starting a Development Session?
1. Check [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) for current phase
2. Review phase-specific validation checklist
3. Confirm backward compatibility requirements
4. Start coding!

### Need to Understand Business Logic?
1. [BUSINESS_RULES.md](BUSINESS_RULES.md) - All business rules (15 categories)
2. [GLOSSARY.md](GLOSSARY.md) - Technical term definitions (180+)
3. Feature-specific docs in [docs/features/](features/)

---

## 📚 CORE DOCUMENTATION

### Master Planning Documents

**[MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md)** ⭐ **PRIMARY REFERENCE**
- **What:** Complete consolidated roadmap for all phases (0-11)
- **Contains:** Phase details, completion status, validation checklists, timeline
- **When to use:** Planning, progress tracking, understanding what's next
- **Size:** 50KB+ comprehensive guide
- **Status:** ✅ Complete and up-to-date

**[DEVELOPMENT_NAVIGATION.md](DEVELOPMENT_NAVIGATION.md)** (This File)
- **What:** Quick reference index of all documentation
- **Contains:** File descriptions, navigation paths, "where to find what" guide
- **When to use:** Finding the right documentation file quickly
- **Size:** 10KB guide

---

### Business & Technical References

**[GLOSSARY.md](GLOSSARY.md)**
- **What:** 180+ technical term definitions
- **Contains:** Manufacturing, business, inventory, production, sales, quality, HR, PLM, compliance, maintenance terms
- **When to use:** Understanding any unfamiliar term or acronym
- **Organization:** Alphabetical by category
- **Coverage:** All current modules + all planned phases
- **Size:** 25KB+ comprehensive glossary

**[BUSINESS_RULES.md](BUSINESS_RULES.md)**
- **What:** Complete business logic and validation rules
- **Contains:** 15 categories of rules:
  1. Costing & Pricing Rules
  2. BOM Rules
  3. Order Management Rules
  4. Style Management Rules
  5. Supplier Management
  6. Inventory Rules
  7. Production Rules
  8. Quality Control
  9. Approval Workflows
  10. Financial Rules
  11. User Roles & Permissions
  12. Data Validation
  13. System Behavior
  14. Integration Rules
  15. Reporting Rules
- **When to use:** Understanding "why" behind features, implementing validation logic
- **Size:** 15KB comprehensive rules

**[ARCHITECTURE.md](ARCHITECTURE.md)**
- **What:** System architecture and design decisions
- **Contains:**
  - Three-tier architecture (React → Express → PostgreSQL)
  - Technology stack details
  - 6 Architecture Decision Records (ADRs)
  - Database design patterns
  - API design principles
  - Security architecture
  - Deployment architecture
- **When to use:** Understanding system design, making architectural decisions
- **Size:** 27KB detailed architecture guide

**[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)**
- **What:** Database structure documentation
- **Contains:**
  - 48 current tables
  - 25 enums
  - Relationships and foreign keys
  - Indexes and constraints
- **When to use:** Understanding data model, writing queries, planning migrations
- **Size:** 6.2KB schema reference

---

## 🛠️ SETUP & CONFIGURATION GUIDES

**[LOCAL_DATABASE_SETUP.md](../LOCAL_DATABASE_SETUP.md)**
- **What:** PostgreSQL 17.6 local setup guide
- **Contains:** Installation steps, database creation, connection configuration
- **When to use:** First-time setup, troubleshooting database connections
- **Platform:** Windows-specific (local PostgreSQL for development)

**[INDIAN_COMPLIANCE_GUIDE.md](../INDIAN_COMPLIANCE_GUIDE.md)**
- **What:** GST and Indian tax compliance specifics
- **Contains:** GST rates, HSN codes, compliance requirements
- **When to use:** Implementing tax calculations, understanding Indian regulations

**[INDIAN_SETUP_QUICKSTART.md](../INDIAN_SETUP_QUICKSTART.md)**
- **What:** Quick start guide for Indian setup
- **Contains:** Fast-track setup steps
- **When to use:** Quick environment setup

**[DATABASE_MIGRATION_COMPLETE.md](../DATABASE_MIGRATION_COMPLETE.md)**
- **What:** Migration status and history
- **Contains:** Applied migrations, migration results
- **When to use:** Checking migration status, troubleshooting migrations

---

## 📁 FEATURE-SPECIFIC DOCUMENTATION

### Cost Sheet Module (Phase 5.X - 60% Complete)
**Location:** [docs/features/cost-sheet/](features/cost-sheet/)

Files:
- **COST_SHEET_IMPLEMENTATION_COMPLETE.md** - Implementation status
- **COST_SHEET_IMPLEMENTATION_SUMMARY.md** - Summary
- **COST_SHEET_NEXT_STEPS.md** - Remaining work

---

## 📝 PHASE STATUS DOCUMENTS

**[PHASE1_COMPLETE.md](../PHASE1_COMPLETE.md)**
- **What:** Phase 1 Financial Masters completion summary
- **Contains:**
  - 8 modules (Chart of Accounts, Tax Masters, Payment Terms, Currencies, Cost Centers, Expense Types, Bank Accounts, Exchange Rates)
  - 45+ API endpoints
  - Database schema (8 tables, 6 enums)
  - Testing checklist
- **Status:** ✅ 100% Backend Complete, 90% Frontend
- **Size:** 13KB

**[PHASE1_CONTROLLERS_COMPLETE.md](../PHASE1_CONTROLLERS_COMPLETE.md)**
- **What:** Phase 1 controller implementation details
- **Contains:** Controller code, API endpoints, usage examples
- **Size:** 8KB

**[PHASE1_FINANCIAL_MASTERS_STATUS.md](../PHASE1_FINANCIAL_MASTERS_STATUS.md)**
- **What:** Initial Phase 1 planning document
- **Contains:** Planning notes, initial schema, migration instructions
- **Size:** 6KB

---

## 📖 LEGACY REFERENCE DOCUMENTS

**[PROJECT_MASTER_GUIDE.md](../PROJECT_MASTER_GUIDE.md)** (Historical - Replaced by MASTER_DEVELOPMENT_PLAN.md)
- **What:** Previous consolidated guide (Version 1.6)
- **Status:** Kept for historical reference
- **Note:** Use MASTER_DEVELOPMENT_PLAN.md for current information
- **Size:** 29KB

**[NEXT_SESSION.md](../NEXT_SESSION.md)** (Quick Reference)
- **What:** Quick start guide for new sessions
- **Contains:** Server start commands, access points, recent updates
- **When to use:** Quick reminder of basics
- **Size:** 1KB

---

## 🗂️ FILE ORGANIZATION

```
garment-erp/
├── docs/                                    ← ALL DOCUMENTATION HERE
│   ├── MASTER_DEVELOPMENT_PLAN.md          ← ⭐ PRIMARY: Complete roadmap
│   ├── DEVELOPMENT_NAVIGATION.md           ← ⭐ This file: Navigation guide
│   ├── GLOSSARY.md                         ← ⭐ 180+ term definitions
│   ├── BUSINESS_RULES.md                   ← Business logic (15 categories)
│   ├── ARCHITECTURE.md                     ← System architecture (27KB)
│   ├── DATABASE_SCHEMA.md                  ← Database structure (48 tables)
│   │
│   └── features/                           ← Feature-specific docs
│       ├── cost-sheet/                     ← Cost Sheet module docs
│       │   ├── COST_SHEET_IMPLEMENTATION_COMPLETE.md
│       │   ├── COST_SHEET_IMPLEMENTATION_SUMMARY.md
│       │   └── COST_SHEET_NEXT_STEPS.md
│       └── (future feature folders)
│
├── ROOT LEVEL DOCUMENTS:
├── LOCAL_DATABASE_SETUP.md                 ← PostgreSQL 17.6 setup
├── INDIAN_COMPLIANCE_GUIDE.md              ← GST and tax compliance
├── INDIAN_SETUP_QUICKSTART.md              ← Quick setup guide
├── DATABASE_MIGRATION_COMPLETE.md          ← Migration status
├── PHASE1_COMPLETE.md                      ← Phase 1 summary
├── PHASE1_CONTROLLERS_COMPLETE.md          ← Phase 1 controllers
├── PHASE1_FINANCIAL_MASTERS_STATUS.md      ← Phase 1 planning
├── PROJECT_MASTER_GUIDE.md                 ← Legacy (historical reference)
├── NEXT_SESSION.md                         ← Quick session start
└── README.md                               ← General project overview
```

---

## 🔍 COMMON QUESTIONS & WHERE TO FIND ANSWERS

### "What's the current development status?"
→ [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) - See "Phase Completion Status" section

### "What does [TERM] mean?"
→ [GLOSSARY.md](GLOSSARY.md) - 180+ definitions organized by category

### "Why is this feature designed this way?"
→ [BUSINESS_RULES.md](BUSINESS_RULES.md) - Business logic explanations
→ [ARCHITECTURE.md](ARCHITECTURE.md) - Architecture Decision Records (ADRs)

### "What's the database structure?"
→ [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - 48 tables, relationships, indexes

### "How do I set up the local database?"
→ [LOCAL_DATABASE_SETUP.md](../LOCAL_DATABASE_SETUP.md) - Step-by-step PostgreSQL setup

### "What are the API endpoints for [MODULE]?"
→ [PHASE1_COMPLETE.md](../PHASE1_COMPLETE.md) - Financial Masters endpoints (45+)
→ [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) - All module endpoints

### "What's next to build?"
→ [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) - See "Current Priorities" section

### "What are the validation rules for [FEATURE]?"
→ [BUSINESS_RULES.md](BUSINESS_RULES.md) - All validation rules by category

### "How do I ensure backward compatibility?"
→ [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) - See "Backward Compatibility Strategy" section

### "What's the GST/tax calculation logic?"
→ [INDIAN_COMPLIANCE_GUIDE.md](../INDIAN_COMPLIANCE_GUIDE.md) - Indian tax specifics
→ [BUSINESS_RULES.md](BUSINESS_RULES.md) - Financial rules section

---

## 📊 DOCUMENTATION UPDATE PROCEDURES

### When Completing a Phase:
1. Update [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md):
   - Mark phase as complete ✅
   - Update completion percentage
   - Check all validation checkpoint items
2. Create phase-specific summary document (if major phase)
3. Update [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) if schema changed
4. Add new terms to [GLOSSARY.md](GLOSSARY.md)
5. Update [BUSINESS_RULES.md](BUSINESS_RULES.md) if new rules added

### When Adding a New Feature:
1. Add feature description to relevant phase in [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md)
2. Add technical terms to [GLOSSARY.md](GLOSSARY.md)
3. Document business rules in [BUSINESS_RULES.md](BUSINESS_RULES.md)
4. Update [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) if new tables/fields
5. Create feature-specific docs in [docs/features/[feature-name]/](features/) if complex

### When Making Architectural Decisions:
1. Document in [ARCHITECTURE.md](ARCHITECTURE.md) as new ADR (Architecture Decision Record)
2. Update [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) if affects roadmap
3. Communicate decision in team meeting/documentation review

---

## 🎯 QUICK LINKS BY ROLE

### For Backend Developers:
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Tables and relationships
- [BUSINESS_RULES.md](BUSINESS_RULES.md) - Validation logic
- [ARCHITECTURE.md](ARCHITECTURE.md) - API design patterns
- [PHASE1_COMPLETE.md](../PHASE1_COMPLETE.md) - API endpoint examples

### For Frontend Developers:
- [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) - UI requirements per phase
- [BUSINESS_RULES.md](BUSINESS_RULES.md) - Form validation rules
- [GLOSSARY.md](GLOSSARY.md) - UI terminology

### For Full-Stack Developers:
- [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) - Complete phase details
- [ARCHITECTURE.md](ARCHITECTURE.md) - Full system design
- [BUSINESS_RULES.md](BUSINESS_RULES.md) - End-to-end workflows

### For Project Managers:
- [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) - Timeline and progress
- Phase status documents (PHASE1_COMPLETE.md, etc.)
- Feature-specific implementation summaries

### For New Team Members:
1. [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) - Project overview
2. [GLOSSARY.md](GLOSSARY.md) - Learn the terminology
3. [ARCHITECTURE.md](ARCHITECTURE.md) - Understand the system
4. [LOCAL_DATABASE_SETUP.md](../LOCAL_DATABASE_SETUP.md) - Set up environment

---

## 📞 DOCUMENTATION SUPPORT

### Documentation Issues:
- Missing information? Create a note in team meeting
- Outdated documentation? Update and commit
- Unclear explanations? Add clarifying examples

### Documentation Standards:
- Use Markdown format (.md files)
- Include last updated date
- Add table of contents for files >200 lines
- Use clear headings and bullet points
- Include examples where helpful
- Cross-reference related documents

---

**Document Version:** 1.0
**Last Updated:** November 15, 2025
**Maintained By:** Kashaya Fabs Development Team
**Purpose:** Central navigation hub for all project documentation

**Quick Tip:** Bookmark [MASTER_DEVELOPMENT_PLAN.md](MASTER_DEVELOPMENT_PLAN.md) and [GLOSSARY.md](GLOSSARY.md) - these are your two most-used documents!
