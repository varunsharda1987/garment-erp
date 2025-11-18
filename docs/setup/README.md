# Setup & Configuration Guides

**Last Updated**: November 15, 2025

---

## Overview

This directory contains all setup and configuration documentation for the Kashaya Fabs Garment ERP system.

---

## Quick Start

**For new developers, start here**:
1. [LOCAL_DATABASE_SETUP.md](LOCAL_DATABASE_SETUP.md) - Complete database setup
2. [INDIAN_SETUP_QUICKSTART.md](INDIAN_SETUP_QUICKSTART.md) - Indian compliance configuration

---

## Setup Guides

### 1. Database Setup
**[LOCAL_DATABASE_SETUP.md](LOCAL_DATABASE_SETUP.md)**

**What's included**:
- PostgreSQL 17.6 installation
- Database creation and configuration
- Environment variables setup
- Backend initialization
- Frontend setup
- Troubleshooting guide

**When to use**: First-time project setup

---

### 2. Indian Compliance Quickstart
**[INDIAN_SETUP_QUICKSTART.md](INDIAN_SETUP_QUICKSTART.md)**

**What's included**:
- GST configuration (0%, 5%, 12%, 18%, 28%)
- Financial year setup (April-March)
- Chart of accounts (Indian format)
- Tax master data
- Indian banking setup (IFSC codes)
- Currency configuration (INR base)

**When to use**: After basic setup, before using financial modules

---

### 3. Database Migration Guide
**[DATABASE_MIGRATION_COMPLETE.md](DATABASE_MIGRATION_COMPLETE.md)**

**What's included**:
- Migration execution guide
- Rollback procedures
- Seed data information
- Migration history
- Troubleshooting

**When to use**: When running migrations or troubleshooting database issues

---

### 4. Indian Compliance Guide (Detailed)
**[INDIAN_COMPLIANCE_GUIDE.md](INDIAN_COMPLIANCE_GUIDE.md)**

**What's included**:
- Complete GST compliance requirements
- TDS/TCS configuration
- Indian Accounting Standards (Ind AS)
- Statutory reports
- GST return filing requirements
- IFSC and banking standards

**When to use**: For detailed Indian compliance requirements

---

## Setup Workflow

### For Developers

```
1. LOCAL_DATABASE_SETUP.md
   ↓
2. DATABASE_MIGRATION_COMPLETE.md
   ↓
3. INDIAN_SETUP_QUICKSTART.md
   ↓
4. Start development
```

### For Business Users

```
1. Review INDIAN_COMPLIANCE_GUIDE.md
   ↓
2. Configure GST rates (INDIAN_SETUP_QUICKSTART.md)
   ↓
3. Setup chart of accounts
   ↓
4. Start using system
```

---

## Environment Setup

### Prerequisites
- PostgreSQL 17.6
- Node.js 20+
- npm or yarn

### Quick Setup Commands

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Setup database
createdb garment_erp
psql -d garment_erp -f schema.sql

# 3. Configure environment
cp backend/.env.example backend/.env
# Edit .env with your database credentials

# 4. Run migrations
cd backend && npx prisma migrate deploy

# 5. Seed Indian financial data
npx ts-node prisma/seed-indian-financial.ts

# 6. Start servers
cd backend && npm run dev
cd frontend && npm run dev
```

---

## Configuration Files

### Backend
- `.env` - Environment variables
- `prisma/schema.prisma` - Database schema
- `prisma/seed-indian-financial.ts` - Indian financial seed data

### Frontend
- `.env` - API URL configuration
- `src/config/` - Application configuration

---

## Indian Compliance Configuration

### GST Setup
**File**: [INDIAN_COMPLIANCE_GUIDE.md](INDIAN_COMPLIANCE_GUIDE.md)

**Standard Rates**:
- 0% - Exempt goods
- 5% - Essential goods
- 12% - Standard goods
- 18% - Most services and goods
- 28% - Luxury goods

**CGST/SGST/IGST**:
- Intra-state: CGST + SGST
- Inter-state: IGST

### Chart of Accounts
**File**: [INDIAN_SETUP_QUICKSTART.md](INDIAN_SETUP_QUICKSTART.md)

**5-Level Hierarchy**:
1. Account Group (Assets, Liabilities, Income, Expenses, Capital)
2. Primary Group
3. Sub-Group
4. Category
5. Ledger Account

### Financial Year
**Period**: April 1 to March 31
**Format**: FY 2024-25 (April 1, 2024 to March 31, 2025)

---

## Troubleshooting

### Common Issues

**Database Connection Error**:
- Check PostgreSQL is running
- Verify credentials in `.env`
- See [LOCAL_DATABASE_SETUP.md](LOCAL_DATABASE_SETUP.md)

**Migration Failed**:
- Check database user permissions
- See [DATABASE_MIGRATION_COMPLETE.md](DATABASE_MIGRATION_COMPLETE.md)

**GST Configuration Issues**:
- Verify tax rates in Tax Masters
- See [INDIAN_COMPLIANCE_GUIDE.md](INDIAN_COMPLIANCE_GUIDE.md)

---

## Additional Resources

### Documentation
- [DOCUMENTATION_INDEX.md](../../DOCUMENTATION_INDEX.md) - Master documentation index
- [README.md](../../README.md) - Project overview

### Phase Documentation
- [Phase 1: Financial Masters](../phases/phase1/PHASE1_CONSOLIDATED.md)
- [Phase 1.5: Import/Export](../phases/phase1.5/PHASE1.5_CONSOLIDATED.md)
- [Phase 3: Inventory Management](../phases/phase3/PHASE3_CONSOLIDATED.md)

---

## Support

**For setup issues**:
1. Check the relevant setup guide
2. Review troubleshooting section
3. Check database logs
4. Verify environment variables

**For business configuration**:
1. Review Indian compliance guide
2. Check financial master data
3. Verify chart of accounts structure

---

**Last Updated**: November 15, 2025
**Total Setup Guides**: 4
**Configuration Time**: ~30 minutes (first-time setup)
