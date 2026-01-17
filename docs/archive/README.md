# Kashaya Fabs - Garment ERP System

A modern ERP built specifically for small garment manufacturers.

**Status:** ~90% Complete | **Go-Live Target:** March 2025

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
