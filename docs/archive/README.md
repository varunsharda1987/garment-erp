# Archive Folder - Historical Documentation

> **Note:** This folder contains archived/historical documentation that has been superseded by updated guides in the main `docs/` folder. These files are preserved for reference only.

---

## Folder Structure

### `/implementation-reports/` (Added Feb 2026)
Contains implementation summaries, test reports, and verification documents from completed features:
- `FINAL_IMPLEMENTATION_SUMMARY.md` - Overall implementation summary
- `FRONTEND_CONVERSION_STATUS.md` - Frontend migration status report
- `MRP_IMPLEMENTATION_VERIFICATION_REPORT.md` - MRP workflow verification
- `THREAD_MODULE_TEST_REPORT.md` - Thread module testing results
- `THREAD_ROUTES_DEBUG.md` - Thread routes debugging notes

**Purpose:** Historical record of feature implementation, useful for troubleshooting and understanding implementation decisions.

### Root Archive Files (34 files)
Original detailed documentation files that were consolidated into the comprehensive guides in `docs/`:
- CAD Planning, AI Assistant, GST, Financial guides consolidated
- ARCHITECTURE.md → MODULE_RELATIONSHIPS_GUIDE.md
- DATABASE_SCHEMA.md → Multiple specific guides
- Component group, style form, size variant implementation docs

---

# Original README (Archived from Jan 2025)

# Kashaya Fabs - Garment ERP System

A modern ERP built specifically for small garment manufacturers.

**Status:** Archived - See current status in `docs/PROJECT_BIBLE.md`
**Original Go-Live Target:** March 2025 (superseded)

---

## Quick Start

### Running the Application

```bash
# Backend
cd backend
npm install
npx prisma generate
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

**Access:** http://localhost:5173
**Login:** admin@kashayafabs.com / Admin@123

---

## What's Working

- **Production Tracking Dashboard** - Real-time stage-wise monitoring
- **Inventory Management** - Multi-warehouse with WAC costing
- **Order Management** - Color x Size matrix entry
- **Style Management** - Complete 5-tab workflow with CAD planning
- **Material Masters** - Button, Zipper, Lace, Thread, Elastic, Label, Packaging
- **Financial Masters** - GST-compliant Chart of Accounts
- **Import/Export** - CSV/XLSX/JSON for 8 modules
- **User Management** - Role-based access control

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js 20 + Express + TypeScript + Prisma |
| Frontend | React 18 + TypeScript + Vite + shadcn/ui |
| Database | PostgreSQL 17.6 |
| Testing | Vitest + Playwright |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Current state & roadmap |
| [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) | Development setup |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Database documentation |
| [docs/SYSTEM_GUIDE.md](docs/SYSTEM_GUIDE.md) | Materials, Stock, Job-work |
| [docs/CODING_STANDARDS.md](docs/CODING_STANDARDS.md) | Development standards |
| [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | Production deployment |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Garment industry terms |

---

## Project Structure

```
garment-erp/
├── README.md              # This file
├── docs/                  # Documentation (8 files)
├── backend/               # Node.js API (45 controllers, 17 services)
│   ├── src/              # Source code
│   └── prisma/           # Database schema (90 models)
└── frontend/             # React app (69 pages, 80+ components)
    ├── src/              # Source code
    └── tests/            # E2E tests (Playwright)
```

---

## Stats

- 45 Controllers | 42 Routes | 17 Services
- 90 Database Models | 69 Frontend Pages
- 80+ UI Components | 30 API Service Files
- Zero TypeScript compilation errors

---

**License:** Proprietary - Kashaya Fabs 2025
