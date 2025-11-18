# Local PostgreSQL Database Setup - Complete Guide

## ✅ Setup Complete!

Your Kashaya Fabs ERP is now running on **local PostgreSQL** instead of Railway.

---

## 📊 Database Configuration

**Connection Details:**
- **Host:** localhost
- **Port:** 5432
- **Database:** garment_erp
- **Username:** postgres
- **Password:** postgres
- **Connection String:** `postgresql://postgres:postgres@localhost:5432/garment_erp`

**Database Status:**
- ✅ PostgreSQL 17.6 installed
- ✅ Database `garment_erp` created
- ✅ All 48 tables migrated successfully
- ✅ 6 migrations applied

---

## 🔄 Environment Configuration

### Current Setup (`.env`)

```env
# Local PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp"
```

---

## 🚀 How to Start Development

### Method 1: Using Batch File (Recommended)

```bash
cd backend
start-local.bat
```

This automatically sets the DATABASE_URL and starts the server.

### Method 2: Manual

```bash
cd backend
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/garment_erp
npm run dev
```

### Method 3: Update .env (if Prisma can't read it)

If you encounter database connection issues:

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp" npm run dev
```

---

## 🔧 Common Operations

### Check Database Connection

```bash
cd backend
node test-db-connection.js
```

### View Database Tables

```bash
psql -U postgres -h localhost -d garment_erp -c "\dt"
```

### Open Prisma Studio (Visual Database Browser)

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp" npx prisma studio
```

Opens at: http://localhost:5555

### Run Migrations

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp" npx prisma migrate deploy
```

### Create New Migration

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp" npx prisma migrate dev --name your_migration_name
```

---

## 🗄️ Database Management

### Backup Local Database

```bash
pg_dump -U postgres -h localhost garment_erp > backup_$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
psql -U postgres -h localhost garment_erp < backup_20251114.sql
```

### Reset Database (Clean Start)

```bash
# Drop database
psql -U postgres -h localhost -c "DROP DATABASE garment_erp;"

# Recreate
psql -U postgres -h localhost -c "CREATE DATABASE garment_erp;"

# Apply migrations
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp" npx prisma migrate deploy
```

---

## 📋 Migration History

**Applied Migrations:**
1. `20251016185916_initial_schema` - Initial database setup
2. `20251018073546_add_merchandiser_role` - Added MERCHANDISER role
3. `20251019104913_add_style_master_complete` - Complete Style Master
4. `20251019120826_add_greige_name_to_fabric` - Added greige name field
5. `20251019121845_add_garment_trims_value_additions_packaging` - Added trims/packaging
6. `add_comprehensive_cost_sheet` - Enhanced cost sheet module

**Note:** The `0_init` migration was removed (corrupted file).

---

## ⚠️ Important Notes

### Password Storage

The password file is stored at:
```
C:\Users\DESKTOP\AppData\Roaming\postgresql\pgpass.conf
```

Content:
```
localhost:5432:*:postgres:postgres
```

This allows passwordless psql commands.

### Prisma .env Reading Issue

Sometimes Prisma CLI doesn't read `.env` correctly. When this happens, use:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp" npx prisma [command]
```

Or use the provided batch files:
- `start-local.bat` - Start backend server
- `migrate-local.bat` - Run migrations

### Schema Naming Convention

The database uses **snake_case** for table names (PostgreSQL convention):
- Tables: `bill_of_materials`, `bom_items`, `style_costing`
- Prisma models match database names (snake_case)

Controllers may have TypeScript errors if they expect camelCase. These are being fixed as we go.

---

## ✅ Verification Checklist

Run these commands to verify everything works:

```bash
# 1. Check PostgreSQL is running
psql --version
# Expected: psql (PostgreSQL) 17.6

# 2. List databases
psql -U postgres -h localhost -l | grep garment_erp
# Expected: garment_erp | postgres | UTF8

# 3. Count tables
psql -U postgres -h localhost -d garment_erp -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
# Expected: 48

# 4. Test Node.js connection
cd backend && node test-db-connection.js
# Expected: ✅ Successfully connected!

# 5. Check migration status
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp" npx prisma migrate status
# Expected: Database schema is up to date!
```

---

## 🎯 Benefits of Local Development

**Advantages:**
- ⚡ **Faster** - No network latency
- 💰 **Free** - No cloud costs
- 🔒 **Private** - Data stays on your machine
- 🚀 **Offline** - Works without internet
- 🧪 **Safe** - Test without affecting production

**For Production Deployment:**
- Consider cloud-hosted PostgreSQL providers (AWS RDS, DigitalOcean, Render, etc.)
- Ensure proper backup strategies
- Configure secure connection strings
- Use environment-specific configuration

---

## 📚 Next Steps

1. ✅ **Local database is ready**
2. ✅ **All tables created**
3. ⏳ **Start backend server** - Use `start-local.bat`
4. ⏳ **Start frontend** - `cd frontend && npm run dev`
5. ⏳ **Continue Cost Sheet module development**

---

## 🆘 Troubleshooting

### PostgreSQL service not running

```bash
# Check if PostgreSQL is running
netstat -an | findstr "5432"
# Should show: LISTENING

# If not running, start PostgreSQL service:
# Services → postgresql-x64-17 → Start
```

### Can't connect to database

```bash
# Test connection
psql -U postgres -h localhost -c "SELECT 1;"

# Check if database exists
psql -U postgres -h localhost -l | grep garment_erp
```

### Prisma can't find database

Make sure you're using the full DATABASE_URL in commands:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/garment_erp" npx prisma [command]
```

---

**Setup Date:** November 14, 2025
**PostgreSQL Version:** 17.6
**Database Name:** garment_erp
**Status:** ✅ OPERATIONAL

**Enjoy faster local development! 🚀**
