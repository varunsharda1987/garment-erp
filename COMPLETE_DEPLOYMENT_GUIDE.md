# 🚀 Complete Railway Deployment & Workflow Guide

> **Everything you need to deploy your Garment ERP as a web app accessible from anywhere**

**Table of Contents:**
- [Part 1: Railway Deployment Setup](#part-1-railway-deployment-setup)
- [Part 2: Daily Development Workflow](#part-2-daily-development-workflow)
- [Part 3: Database Schema Syncing](#part-3-database-schema-syncing)

---

# Part 1: Railway Deployment Setup

## 📋 Overview

**Purpose:** Deploy a shared testing environment where:
- Office staff can enter real data
- You can access and test from home/office
- Continue building features while others test
- Everyone sees the same data in real-time

**Cost:** ~₹800-1,200/month (~$10-15/month)
**Setup Time:** 30 minutes
**Access:** From anywhere via URL

---

## 🎯 What You'll Get

After deployment:
- **URL:** `https://kashaya-erp.up.railway.app` (example)
- **Shared Database:** PostgreSQL hosted on Railway
- **Real-time Sync:** Changes visible to everyone instantly
- **Automatic Deployments:** Push code → Auto deploys in 2-3 minutes
- **HTTPS/SSL:** Secure by default
- **Backups:** Database snapshots available

---

## 📝 Prerequisites

Before starting:
- [ ] GitHub account (you already have this)
- [ ] Your code pushed to GitHub
- [ ] Credit card for Railway (free $5 credit to start)
- [ ] 30 minutes of time

---

## 🚀 Step 1: Prepare Your Repository (5 minutes)

### 1.1 Create Production Environment File

```bash
# In your garment-erp folder
cd backend
cp .env.example .env.railway
```

Edit `.env.railway` with these settings:
```bash
# DATABASE_URL will be auto-filled by Railway
DATABASE_URL=${DATABASE_URL}

# Generate a strong JWT secret
# Run this command to generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-generated-secret-here

# Production settings
NODE_ENV=production
PORT=5000

# Frontend URL (we'll update this after deployment)
FRONTEND_URL=https://your-app-url.railway.app

# Optional: Disable debugging
DEBUG_TRANSFORM=false
AI_ENABLED=false
```

### 1.2 Update .gitignore

Make sure `.env.railway` is NOT committed (for security):
```bash
# Check .gitignore includes
echo "*.env.railway" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
```

### 1.3 Commit Current State

```bash
# Commit everything
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

---

## 🛠️ Step 2: Railway Account Setup (5 minutes)

### 2.1 Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Click "Login with GitHub"
4. Authorize Railway to access your GitHub

### 2.2 Add Payment Method

1. Click your profile (top right)
2. Go to "Account Settings"
3. Click "Billing"
4. Add credit card (gets $5 free credit)
5. Set spending limit: $15/month (₹1,200) to be safe

---

## 🚂 Step 3: Create Railway Project (10 minutes)

### 3.1 Create New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your `garment-erp` repository
4. Click "Deploy Now"

Railway will detect `docker-compose.yml` and create services automatically.

### 3.2 Add PostgreSQL Database

1. Click "+ New" in your project
2. Select "Database"
3. Choose "PostgreSQL"
4. Click "Add PostgreSQL"

Railway automatically creates a database and provides connection URL.

### 3.3 Configure Backend Service

1. Click on "backend" service
2. Go to "Variables" tab
3. Add these environment variables:

```
DATABASE_URL → Click "Add Reference" → Select PostgreSQL → DATABASE_URL
JWT_SECRET → Paste your generated secret
NODE_ENV → production
PORT → 5000
FRONTEND_URL → (leave blank for now, we'll update)
```

4. Go to "Settings" tab
5. Under "Deploy":
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
6. Under "Networking":
   - Click "Generate Domain"
   - Copy the URL (e.g., `https://garment-erp-backend.up.railway.app`)

### 3.4 Configure Frontend Service

1. Click on "frontend" service
2. Go to "Variables" tab
3. Add environment variable:

```
VITE_API_URL → https://your-backend-url.railway.app/api
```

4. Go to "Settings" tab
5. Under "Deploy":
   - **Build Command:** `npm run build`
   - **Start Command:** Leave default
6. Under "Networking":
   - Click "Generate Domain"
   - Copy the URL (e.g., `https://garment-erp.up.railway.app`)

### 3.5 Update CORS Settings

1. Go back to backend service variables
2. Update `FRONTEND_URL` with your frontend Railway URL
3. Example: `https://garment-erp.up.railway.app`

### 3.6 Deploy Services

1. Railway automatically starts deploying
2. Wait 3-5 minutes for builds to complete
3. Check "Deployments" tab for status
4. Green checkmark = Success ✅

---

## 📊 Step 4: Setup Database (5 minutes)

### 4.1 Run Database Migrations

Railway doesn't have a built-in way to run migrations, so we'll add it to the build process:

**Option A: Update Dockerfile (Recommended)**

Edit `backend/Dockerfile` and add migration step:

```dockerfile
# After the prisma generate line, add:
RUN npx prisma generate

# Add this NEW line:
RUN npx prisma migrate deploy || echo "Migrations will run on startup"
```

**Option B: Run Manually via Railway CLI**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run npx prisma migrate deploy

# Seed admin user (if needed)
railway run npm run fix-admin
```

---

## ✅ Step 5: Verify Deployment (5 minutes)

### 5.1 Check Backend Health

Open your backend URL in browser:
```
https://your-backend-url.railway.app/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2025-01-28T10:30:00.000Z",
  "database": "connected"
}
```

### 5.2 Check Frontend

Open your frontend URL:
```
https://your-frontend-url.railway.app
```

Should show login page.

### 5.3 Test Login

Try logging in with admin credentials:
- **Email:** `admin@kashayafabs.com`
- **Password:** `Admin@123`

If admin doesn't exist, run via Railway CLI:
```bash
railway run npm run fix-admin
```

---

## 👥 User Access Setup

### For Office Staff:

**Share these details:**

1. **URL:** `https://your-app.railway.app`
2. **Login Credentials:**
   - Email: (their user email)
   - Password: (their password)
3. **Bookmark the URL** for easy access

### Create User Accounts:

```bash
# Option 1: Via Frontend (as admin)
1. Login as admin
2. Go to Users page
3. Click "Add User"
4. Fill details, assign role
5. Share credentials with staff

# Option 2: Via API
curl -X POST https://your-backend-url.railway.app/api/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff@kashayafabs.com",
    "password": "TempPassword123",
    "name": "Staff Name",
    "role": "USER"
  }'
```

---

## 🔧 Troubleshooting

### Issue: "Database connection failed"

**Solution:**
```bash
# Check if DATABASE_URL is set in Railway
railway variables

# Verify PostgreSQL is running
# Go to Railway dashboard → PostgreSQL → should show "Active"

# Check backend logs
railway logs
```

### Issue: "CORS error in browser"

**Solution:**
```bash
# Make sure FRONTEND_URL in backend variables matches your frontend URL
# Backend: Variables → FRONTEND_URL → https://your-frontend-url.railway.app
```

### Issue: "Changes not showing after deploy"

**Solution:**
```bash
# Check deployment status
railway status

# View logs
railway logs

# Force redeploy
railway up --detach
```

### Issue: "Can't login - no admin user"

**Solution:**
```bash
# Create admin user
railway run npm run fix-admin

# Or create manually via Railway CLI
railway run npx prisma studio
# Then create user in UI
```

---

## 💰 Cost Management

### Railway Pricing:

- **Free Trial:** $5 credit (lasts ~1 week of testing)
- **Starter Plan:** $5/month base + usage
- **Expected Monthly Cost:**
  - Database (PostgreSQL): ~$5-8
  - Backend: ~$3-5
  - Frontend: ~$1-2
  - **Total: ~$10-15/month (₹800-1,200)**

### Cost Optimization:

1. **Sleep Inactive Services:**
   - Railway can pause services when not in use
   - Settings → Enable "Auto-sleep"

2. **Monitor Usage:**
   - Dashboard shows daily cost
   - Set spending alerts

3. **Use Free Tier Wisely:**
   - Keep staging on Railway
   - Deploy production only when ready

---

# Part 2: Daily Development Workflow

## 🎯 Your Situation

**What you need:**
- ✅ Build features at home and office
- ✅ Office staff enters real data
- ✅ Everyone sees same data
- ✅ Continue building while they test

**Solution:**
- 🏠 **Local Development** - Code on your laptop (home/office)
- ☁️ **Railway Staging** - Shared testing environment with real data
- 🔄 **Git Sync** - Work from anywhere

---

## 📋 Daily Workflow

### Morning Routine (Either Home or Office):

```bash
# 1. Get latest code
cd garment-erp
git pull origin main

# 2. Start local development
# Terminal 1:
cd backend
npm run dev  # Backend on localhost:5000

# Terminal 2:
cd frontend
npm run dev  # Frontend on localhost:5173

# 3. Code your feature
# - Add new components
# - Fix bugs
# - Test locally with dummy data
```

### When Feature is Ready:

```bash
# 1. Test locally first
npm run build  # Make sure it builds
npm run test   # Run tests (if any)

# 2. Commit changes
git add .
git commit -m "Add customer management feature"

# 3. Push to GitHub
git push origin main

# 4. Railway auto-deploys (2-3 minutes)
# - Watch in Railway dashboard
# - Check logs if needed
# - Office staff sees update automatically
```

### Continue While Railway Deploys:

```bash
# You don't need to wait!
# Start next feature immediately

# Railway is deploying in background
# Office staff will see update in 2-3 minutes
# You can keep coding locally
```

### Complete Daily Flow Diagram:

```
┌─────────────────────────────────────────────────────────────┐
│  MORNING: Local Development                                 │
│  ───────────────────────────────────────────────────────────│
│  1. Code new features on your laptop                        │
│  2. Test locally: npm run dev                               │
│  3. Use local database for testing                          │
│  4. Debug, fix bugs, experiment                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ When feature is ready
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  AFTERNOON: Deploy Update                                   │
│  ───────────────────────────────────────────────────────────│
│  1. git add .                                               │
│  2. git commit -m "Add new feature"                         │
│  3. git push origin main                                    │
│  4. Railway auto-deploys (2-3 minutes)                      │
│  5. Office staff sees update immediately                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏢 Office Staff Workflow

**They don't need git or code!**

### What They Do:

```
1. Open browser
2. Go to: https://kashaya-erp.up.railway.app
3. Login with their credentials
4. Enter data:
   - Add customers
   - Create orders
   - Manage inventory
   - Add styles
5. Done!
```

### What They See:
- ✅ Always latest version (auto-updates when you deploy)
- ✅ Real-time data (saved to cloud database)
- ✅ Same data from any computer
- ✅ Accessible from home (if needed)

---

## 🏠 Working from Different Locations

### Scenario 1: Starting at Office, Going Home

**At Office (Morning):**
```bash
# Make changes
git add .
git commit -m "WIP: Started new feature"
git push origin main
```

**At Home (Evening):**
```bash
# Get your office work
cd garment-erp
git pull origin main

# Continue where you left off
npm run dev
```

### Scenario 2: Multiple Computers

**First Time on New Computer:**
```bash
# Clone repository
git clone YOUR_GITHUB_REPO_URL
cd garment-erp

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Setup local database
cd backend
cp .env.example .env
# Edit .env with local database settings
npx prisma migrate dev

# Start coding
npm run dev
```

**Every Other Time:**
```bash
# Just pull latest
cd garment-erp
git pull origin main
npm run dev
```

---

## 🗄️ Understanding Your Databases

### Two Separate Databases:

```
┌─────────────────────────────────────────────────────────────┐
│  LOCAL DATABASE (Your Laptop)                               │
├─────────────────────────────────────────────────────────────┤
│  Location:  postgres://localhost:5432/garment_erp           │
│  Purpose:   Testing, experiments, development               │
│  Data:      Dummy data, test customers, test orders         │
│  Usage:     npm run dev (uses this by default)              │
│  Can Delete: YES - won't affect office staff                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  RAILWAY DATABASE (Cloud - Shared)                          │
├─────────────────────────────────────────────────────────────┤
│  Location:  Railway servers                                 │
│  Purpose:   Real testing with office staff                  │
│  Data:      Real customers, real orders, real inventory     │
│  Usage:     https://your-app.railway.app                    │
│  Access:    You + office staff + anyone you share link with │
│  Backup:    Automatic by Railway                            │
└─────────────────────────────────────────────────────────────┘
```

### When to Use Each:

**Use LOCAL database:**
- ⚡ Fast development
- 🧪 Testing new features
- 🐛 Debugging
- 💥 Breaking things (safe to reset)

**Use RAILWAY database:**
- 👥 Showing to office staff
- 📊 Real data entry
- 🧪 User acceptance testing
- 🏠 Accessing from home

---

## 🔄 Common Scenarios

### Scenario A: "I want to test with real data locally"

```bash
# Get Railway database URL
# Railway Dashboard → PostgreSQL → Connect → Copy URL

# Temporarily use Railway database locally
# Edit backend/.env
DATABASE_URL="postgresql://railway-url-here"

# Start local dev (connected to Railway DB)
npm run dev

# CAUTION: Changes affect office staff!
# Switch back when done
```

### Scenario B: "I broke something on Railway"

```bash
# Option 1: Quick rollback
# Railway Dashboard → Deployments → Previous deploy → Rollback

# Option 2: Revert code
git revert HEAD
git push origin main
# Railway auto-deploys the revert

# Option 3: Restore database
railway run psql $DATABASE_URL < backup.sql
```

### Scenario C: "Office staff needs a feature NOW"

```bash
# Quick deploy (skip local testing - use carefully!)
git add .
git commit -m "Quick fix for urgent issue"
git push origin main

# Monitor deployment
railway logs --follow

# Verify in browser
open https://your-app.railway.app
```

### Scenario D: "Need to update database schema"

```bash
# 1. Add migration locally
cd backend
# Edit prisma/schema.prisma
npx prisma migrate dev --name add_new_field

# 2. Test locally
npm run dev

# 3. Deploy (migration runs automatically)
git add .
git commit -m "Add new field to customer model"
git push origin main

# Railway runs: npx prisma migrate deploy
```

---

## 📊 Data Management

### Backup Railway Data:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link
railway login
railway link

# Backup database
railway run pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore if needed
railway run psql $DATABASE_URL < backup_20250128.sql
```

### View Railway Data Locally:

If you want to work with production data locally:

```bash
# Get Railway database URL
# Go to Railway dashboard → PostgreSQL → Connect → Copy DATABASE_URL

# In your local .env
DATABASE_URL="postgresql://railway-user:pass@host/dbname"

# Now your local app uses Railway database
npm run dev

# Switch back to local database when done
DATABASE_URL="postgresql://localhost:5432/garment_erp"
```

### Database Backups (Automated):

```bash
# Daily backup (recommended)
railway run pg_dump $DATABASE_URL > backups/backup_$(date +%Y%m%d).sql

# Restore if needed
railway run psql $DATABASE_URL < backups/backup_20250128.sql

# Automated backup script (create this)
# File: scripts/backup.sh
#!/bin/bash
railway run pg_dump $DATABASE_URL > "backups/backup_$(date +%Y%m%d_%H%M%S).sql"
echo "Backup completed"

# Run daily via cron or Task Scheduler
```

---

## 🎯 Quick Commands Reference

### Development:
```bash
git pull origin main           # Get latest code
npm run dev                    # Start local development
npm run build                  # Test build
npm run test                   # Run tests
```

### Deployment:
```bash
git add .                      # Stage changes
git commit -m "Description"    # Commit
git push origin main           # Deploy to Railway
railway logs                   # Watch deployment
```

### Railway CLI:
```bash
railway login                  # Login once
railway link                   # Link to project (once)
railway logs                   # View logs
railway status                 # Check status
railway run <command>          # Run command on Railway
railway variables              # View environment variables
```

### Database:
```bash
railway run npx prisma studio  # Open database GUI
railway run npx prisma migrate deploy  # Run migrations
railway run pg_dump $DATABASE_URL > backup.sql  # Backup
```

---

## ✅ Best Practices

### Do's:
- ✅ **Test locally first** before deploying
- ✅ **Commit often** with clear messages
- ✅ **Pull before starting** work (git pull)
- ✅ **Backup database** regularly
- ✅ **Use descriptive commits** ("Add customer search" not "Update")
- ✅ **Check Railway logs** after deploying

### Don'ts:
- ❌ **Don't deploy untested code** (office staff will see it)
- ❌ **Don't reset Railway database** without backup
- ❌ **Don't share admin credentials** with everyone
- ❌ **Don't commit .env files** to git
- ❌ **Don't test risky changes** on Railway first

---

## 🆘 Troubleshooting

### "Code not syncing between home and office"

```bash
# Always pull before starting work
git pull origin main

# If conflicts:
git stash           # Save your changes
git pull            # Get latest
git stash pop       # Apply your changes
# Resolve conflicts manually
```

### "Office staff can't see my changes"

```bash
# Check if Railway deployed
railway status

# Check deployment logs
railway logs

# Verify deployment time
# Railway Dashboard → Deployments → Check timestamp
```

### "Changes showing locally but not on Railway"

```bash
# Did you push?
git status          # Check uncommitted changes
git push origin main

# Check Railway is deploying
railway logs --follow
```

### "Database migration failed on Railway"

```bash
# Check migration status
railway run npx prisma migrate status

# Force deploy migration
railway run npx prisma migrate deploy

# If stuck, reset (CAUTION: loses data)
railway run npx prisma migrate reset
```

---

# Part 3: Database Schema Syncing

## 🎯 The Question

**"How does the database schema sync between local and Railway?"**

**Short Answer:** Prisma migrations are tracked in Git and automatically applied when you deploy.

---

## 📊 How It Works

### The Magic: Migration Files

```
┌─────────────────────────────────────────────────────────────┐
│  prisma/migrations/                                         │
├─────────────────────────────────────────────────────────────┤
│  20250115120000_initial_migration/                          │
│  │  └─ migration.sql  ← SQL commands                        │
│  │                                                           │
│  20250120150000_add_phone_to_customer/                      │
│  │  └─ migration.sql  ← SQL commands                        │
│  │                                                           │
│  20250125180000_add_accessories/                            │
│  │  └─ migration.sql  ← SQL commands                        │
│  │                                                           │
│  └─ _migrations_log table tracks what's applied             │
└─────────────────────────────────────────────────────────────┘
```

**These migration folders are committed to Git.**

When Railway deploys:
1. Pulls latest code (includes migrations folder)
2. Runs `npx prisma migrate deploy`
3. Prisma checks `_prisma_migrations` table
4. Applies only **new** migrations
5. Updates `_prisma_migrations`

---

## 🔄 Complete Workflow Example

### Scenario: Add "phoneNumber" field to Customer

#### Step 1: Local Development

```bash
cd backend

# Edit prisma/schema.prisma
# Find the customers model and add:
# phoneNumber String?  // New field
```

Example:
```prisma
model customers {
  id                          String   @id @default(uuid())
  code                        String   @unique
  name                        String
  phone                       String?
  phoneNumber                 String?  // ← NEW FIELD
  email                       String?
  // ... rest of fields
}
```

#### Step 2: Create Migration Locally

```bash
# Generate migration
npx prisma migrate dev --name add_phone_number_to_customer

# Prisma does:
# 1. Creates folder: prisma/migrations/20250128100000_add_phone_number_to_customer/
# 2. Creates SQL file inside with:
#    ALTER TABLE "customers" ADD COLUMN "phoneNumber" TEXT;
# 3. Applies migration to YOUR LOCAL database
# 4. Regenerates Prisma Client with new field
```

**Output you'll see:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "garment_erp"

Applying migration `20250128100000_add_phone_number_to_customer`

The following migration(s) have been created and applied:

migrations/
  └─ 20250128100000_add_phone_number_to_customer/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client
```

#### Step 3: Test Locally

```bash
# Your local database NOW has the phoneNumber column
# Test your code locally

npm run dev

# Try creating a customer with phoneNumber
# Make sure everything works
```

#### Step 4: Commit Migration to Git

```bash
# Check what changed
git status

# You'll see:
# modified:   prisma/schema.prisma
# new file:   prisma/migrations/20250128100000_add_phone_number_to_customer/migration.sql

# Commit everything (schema + migration folder)
git add prisma/
git commit -m "Add phoneNumber field to customer model"
git push origin main
```

#### Step 5: Railway Auto-Applies Migration

```bash
# Railway detects push and:

# 1. Clones repository (gets migration folder)
# 2. Runs: npx prisma generate
# 3. Runs: npx prisma migrate deploy  ← THIS IS THE KEY!
# 4. Builds app
# 5. Deploys

# Railway logs will show:
# "Applying migration `20250128100000_add_phone_number_to_customer`"
# "Database schema updated successfully"
```

**Railway's database NOW has phoneNumber column!**

---

## 🎯 Key Concepts

### 1. Migration Files are Version Control

```
prisma/migrations/
├─ 20250115120000_initial/          ← Migration #1
├─ 20250120150000_add_field/        ← Migration #2
└─ 20250128100000_another_field/    ← Migration #3

Each folder contains:
- migration.sql (the actual SQL commands)
- Git tracks these folders
- Both local and Railway read from same folders
```

### 2. Migration History Table

Prisma creates a special table: `_prisma_migrations`

```sql
-- This table tracks what's been applied
SELECT * FROM _prisma_migrations;

-- Shows:
id | checksum | finished_at | migration_name
1  | abc123   | 2025-01-15  | 20250115120000_initial
2  | def456   | 2025-01-20  | 20250120150000_add_field
3  | ghi789   | 2025-01-28  | 20250128100000_another_field
```

When you deploy to Railway:
- Railway runs `npx prisma migrate deploy`
- Prisma checks `_prisma_migrations` table
- Compares with `prisma/migrations/` folder
- Applies only NEW migrations
- Updates `_prisma_migrations`

### 3. Two Different Databases, Same Schema

```
LOCAL DATABASE (Your Laptop)
├─ postgres://localhost:5432/garment_erp
├─ Has customers table with phoneNumber
├─ Migration applied: 2025-01-28 10:00 AM
└─ _prisma_migrations shows migration #3

RAILWAY DATABASE (Cloud)
├─ postgres://railway.app/garment_erp_prod
├─ Has customers table with phoneNumber
├─ Migration applied: 2025-01-28 10:05 AM (5 min later)
└─ _prisma_migrations shows migration #3

Same schema, different data!
```

---

## 🔧 Common Schema Change Scenarios

### Scenario A: You Add Multiple Fields

```bash
# 1. Edit schema.prisma - add 3 fields
model customers {
  phoneNumber String?
  whatsappNumber String?
  alternateEmail String?
  // ...
}

# 2. Create ONE migration
npx prisma migrate dev --name add_contact_fields

# 3. Test locally
npm run dev

# 4. Commit and push
git add prisma/
git commit -m "Add additional contact fields"
git push origin main

# 5. Railway applies migration automatically
# All 3 fields added to Railway database
```

### Scenario B: Working from Different Computers

```bash
# At Office - Add field
cd backend
# Edit schema.prisma
npx prisma migrate dev --name add_field
git push origin main

# At Home - Get schema changes
cd backend
git pull origin main

# Apply migrations to your LOCAL database
npx prisma migrate dev

# Prisma sees new migration in migrations/ folder
# Applies to your local database
# Now your home database has the same schema as office!
```

### Scenario C: Office Staff on Railway, You Testing Locally

```
Timeline:
─────────────────────────────────────────────────────────────
10:00 AM - You: Add phoneNumber field locally
           - Your local DB has phoneNumber
           - Railway DB does NOT yet

10:30 AM - Office Staff: Using Railway
           - Cannot see phoneNumber field yet
           - Their forms don't have this field

11:00 AM - You: Push to GitHub
           - Railway auto-deploys (3 minutes)

11:03 AM - Railway: Migration applied
           - Railway DB now has phoneNumber
           - Office staff refresh page
           - NEW FIELD APPEARS in forms!
```

---

## 📋 Schema Change Best Practices

### DO's:

✅ **Always create migrations locally first**
```bash
# GOOD: Test locally, then deploy
npx prisma migrate dev --name descriptive_name
# Test thoroughly
git push origin main
```

✅ **Use descriptive migration names**
```bash
# GOOD
npx prisma migrate dev --name add_phone_number_to_customer
npx prisma migrate dev --name create_accessories_table

# BAD
npx prisma migrate dev --name update
npx prisma migrate dev --name fix
```

✅ **Commit migrations immediately**
```bash
git add prisma/
git commit -m "Add phone field (migration included)"
git push origin main
```

✅ **Backup before major changes**
```bash
# Backup Railway database before big schema change
railway run pg_dump $DATABASE_URL > backup_before_migration.sql
```

### DON'Ts:

❌ **Don't edit migration files manually**
```bash
# DON'T edit files in prisma/migrations/
# Let Prisma generate them
```

❌ **Don't skip migrations**
```bash
# DON'T do this:
# Edit schema.prisma
# Manually run SQL on Railway
# This breaks migration tracking!
```

❌ **Don't reset production database**
```bash
# NEVER do this on Railway:
railway run npx prisma migrate reset  # DELETES ALL DATA!
```

❌ **Don't have different schemas locally and production**
```bash
# Make sure you:
git pull  # Get latest schema
npx prisma migrate dev  # Apply to local
# Before developing new features
```

---

## 🔍 Checking Migration Status

### Local Database:

```bash
cd backend

# See migration status
npx prisma migrate status

# Output:
# Database schema is up to date!
#
# The following migrations have been applied:
# 20250115120000_initial
# 20250120150000_add_field
# 20250128100000_add_phone_number
```

### Railway Database:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Check migration status
railway run npx prisma migrate status

# Output shows what's applied on Railway
```

---

## 🆘 Schema Troubleshooting

### Problem: "Migration failed on Railway"

**Check logs:**
```bash
railway logs

# Look for:
# "Error: Migration `xxx` failed to apply"
```

**Common causes:**
1. **Schema conflict** - Existing data incompatible
2. **Manual changes** - Someone edited Railway DB manually
3. **Migration order** - Pulled migrations out of order

**Solution:**
```bash
# Option 1: Check migration status
railway run npx prisma migrate status

# Option 2: Force resolve
railway run npx prisma migrate resolve --applied "20250128100000_migration_name"

# Option 3: Check actual database
railway run npx prisma studio
# Compare schema with what you expect
```

### Problem: "Local and Railway schemas different"

**How to know:**
```bash
# Get Railway schema
railway run npx prisma db pull > railway_schema.prisma

# Compare with local
diff prisma/schema.prisma railway_schema.prisma
```

**Fix:**
```bash
# Pull latest migrations
git pull origin main

# Apply to local
npx prisma migrate dev

# If that fails, reset local (DANGER: deletes local data)
npx prisma migrate reset
```

### Problem: "Office staff sees error after deployment"

**Cause:** Railway migration failed or didn't run

**Fix:**
```bash
# Check Railway logs
railway logs

# Manually apply migration
railway run npx prisma migrate deploy

# Check status
railway run npx prisma migrate status

# Redeploy if needed
railway up --detach
```

---

## 🎯 Real Example: Complete Flow

### Task: Add "taxID" field to customers

#### 1. Local Development (Your Laptop)

```bash
cd backend

# Edit prisma/schema.prisma
code prisma/schema.prisma
```

Add field:
```prisma
model customers {
  id            String   @id @default(uuid())
  code          String   @unique
  name          String
  taxID         String?  // ← ADD THIS LINE
  email         String?
  // ... rest of fields
}
```

#### 2. Create Migration

```bash
npx prisma migrate dev --name add_tax_id_to_customers
```

**Output:**
```
Applying migration `20250128123000_add_tax_id_to_customers`

migrations/
  └─ 20250128123000_add_tax_id_to_customers/
    └─ migration.sql

Generated Prisma Client
```

**Check created SQL:**
```bash
cat prisma/migrations/20250128123000_add_tax_id_to_customers/migration.sql
```

**Content:**
```sql
-- AlterTable
ALTER TABLE "customers" ADD COLUMN "taxID" TEXT;
```

#### 3. Test Locally

```bash
npm run dev

# Test in your app:
# - Create customer with taxID
# - Update existing customer
# - Verify field appears in UI
```

#### 4. Commit to Git

```bash
git status

# Shows:
# modified:   prisma/schema.prisma
# new file:   prisma/migrations/20250128123000_add_tax_id_to_customers/migration.sql

git add prisma/
git commit -m "Add taxID field to customers for GST compliance"
git push origin main
```

#### 5. Railway Auto-Deploys

**Railway logs will show:**
```
[build] Cloning repository...
[build] Installing dependencies...
[build] Running: npx prisma generate
[build] ✓ Generated Prisma Client
[build] Running migrations...
[deploy] Running: npx prisma migrate deploy
[deploy] Applying migration `20250128123000_add_tax_id_to_customers`
[deploy] ✓ Migration applied successfully
[deploy] Building application...
[deploy] Starting server...
[deploy] ✓ Server started on port 5000
```

**Timeline:**
- 12:30 PM - You push to GitHub
- 12:31 PM - Railway starts build
- 12:33 PM - Migration applied to Railway DB
- 12:34 PM - New version deployed
- 12:35 PM - Office staff refreshes, sees taxID field!

---

## 🎊 Schema Syncing Summary

### The Magic:
1. **Prisma migrations** = SQL files in folders
2. **Git tracks** migration folders
3. **Railway reads** migration folders
4. **Prisma applies** only new migrations
5. **Both databases** end up with same schema

### Your Workflow:
```bash
1. Edit schema.prisma
2. npx prisma migrate dev --name description
3. Test locally
4. git add prisma/ && git commit && git push
5. Railway auto-applies migration
6. Office staff sees new fields automatically
```

### Key Points:
- ✅ Schemas stay in sync automatically
- ✅ No manual SQL needed on Railway
- ✅ Migration history tracked in `_prisma_migrations`
- ✅ Can rollback if needed
- ✅ Works across multiple developers/computers

---

## 📚 Quick Reference

### Railway Dashboard:
```
https://railway.app/dashboard
```

### Your App URLs (after deployment):
```
Frontend: https://kashaya-erp.up.railway.app
Backend:  https://kashaya-erp-backend.up.railway.app
Database: Connect via Railway dashboard
```

### Common Commands:
```bash
# Deploy update
git push origin main

# View logs
railway logs

# Run migrations
railway run npx prisma migrate deploy

# Backup database
railway run pg_dump $DATABASE_URL > backup.sql

# Access database
railway run npx prisma studio

# Check migration status
railway run npx prisma migrate status
```

---

## ✅ Final Checklist

### Before Deployment:
- [ ] GitHub repository up to date
- [ ] Local code tested and working
- [ ] Environment variables documented
- [ ] Admin credentials known

### During Deployment:
- [ ] Railway account created
- [ ] PostgreSQL database added
- [ ] Backend service configured
- [ ] Frontend service configured
- [ ] Environment variables set
- [ ] Migrations applied

### After Deployment:
- [ ] Backend health check passes
- [ ] Frontend loads correctly
- [ ] Admin login works
- [ ] User accounts created for staff
- [ ] URLs shared with office staff
- [ ] Database backup scheduled

---

## 🚀 Next Steps

1. [ ] Complete Railway deployment (30 minutes)
2. [ ] Share Railway URL with office staff
3. [ ] Create user accounts for staff
4. [ ] Continue building locally
5. [ ] Deploy updates when ready
6. [ ] Setup regular database backups

---

## 📞 Support Resources

- **Railway Docs:** https://docs.railway.app
- **Prisma Docs:** https://www.prisma.io/docs
- **Railway Discord:** https://discord.gg/railway
- **Railway CLI:** `railway logs` for debugging

---

**Estimated Setup Time:** 30 minutes
**Monthly Cost:** ₹800-1,200 (~$10-15)
**Maintenance:** Zero - Railway handles everything

**You're 30 minutes away from having a shared testing environment accessible from anywhere!** 🚀

---

**Last Updated:** 2025-01-28
