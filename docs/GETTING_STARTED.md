# Getting Started - Kashaya Fabs ERP

> Quick setup guide for developers and users

**Last Updated:** January 19, 2025

---

## 🎯 Choose Your Path

### I'm a Business User → [Jump to User Guide](#for-business-users)
### I'm a Developer → [Jump to Development Setup](#for-developers)
### I'm an AI Agent → [Jump to AI Agent Guide](#for-ai-agents)

---

## For Business Users

### Starting the Application

**At Office:**
```bash
office-control
# Press 3 to start both servers
```

**At Home:**
```bash
home-control
# Press 3 to start both servers
```

### Accessing the System

1. **Open your browser**
   - Frontend: http://localhost:5173

2. **Login**
   - Email: `admin@kashayafabs.com`
   - Password: `Admin@123`

3. **Start using!**
   - Dashboard shows production overview
   - Left sidebar has all modules
   - Use search to find specific items

### Common Tasks

**View Production Status:**
1. Click "Production Dashboard" in sidebar
2. See stage-wise production counts
3. Click any stage to drill down

**Create New Order:**
1. Click "Orders" → "New Order"
2. Select customer and style
3. Fill Color x Size matrix
4. Save

**Check Fabric Stock:**
1. Click "Fabric Stock" in sidebar
2. View stock by fabric type
3. Filter by grade, aging, warehouse

**Need Help?**
- All forms have field descriptions
- Hover over info icons for details
- Contact admin for training

---

## For Developers

### Prerequisites

**Required Software:**
- Node.js 20+ ([Download](https://nodejs.org/))
- PostgreSQL 17.6 ([Download](https://www.postgresql.org/download/))
- Git ([Download](https://git-scm.com/))
- Code Editor (VS Code recommended)

**Check Installation:**
```bash
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
psql --version   # Should show 17.6
git --version    # Should show 2.x.x
```

### Initial Setup (First Time Only)

#### 1. Clone Repository
```bash
git clone <repository-url>
cd garment-erp
```

#### 2. Setup Database

**Create Database:**
```bash
# Open PostgreSQL CLI
psql -U postgres

# Create database
CREATE DATABASE garment_erp;

# Create user (optional)
CREATE USER erp_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE garment_erp TO erp_user;

# Exit
\q
```

#### 3. Setup Backend

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL="postgresql://postgres:your_password@localhost:5432/garment_erp"
# JWT_SECRET="your_jwt_secret_here"
# PORT=5000

# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed initial data (admin user, chart of accounts)
npx prisma db seed
```

#### 4. Setup Frontend

```bash
# Open new terminal
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with backend URL
# VITE_API_URL=http://localhost:5000
```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev

# Should see: Server running on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev

# Should see: Local: http://localhost:5173
```

**Access Application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Admin Login: admin@kashayafabs.com / Admin@123

### Development Workflow

#### Before Starting Work

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Check system health**
   ```bash
   # Backend: Check for TypeScript errors
   cd backend && npx tsc --noEmit

   # Frontend: Check build
   cd frontend && npm run build
   ```

3. **Read documentation**
   - [CURRENT_STATE.md](CURRENT_STATE.md) - What exists now
   - [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md) - Known issues
   - [ROADMAP.md](ROADMAP.md) - What to build next

#### While Working

1. **Follow coding standards**
   - Read [CODING_STANDARDS.md](../CODING_STANDARDS.md)
   - Use TypeScript strict mode
   - Write meaningful commit messages

2. **Test your changes**
   ```bash
   # Backend: TypeScript check
   cd backend && npx tsc --noEmit

   # Backend: Run tests
   npm test

   # Frontend: Component tests
   cd frontend && npm run test
   ```

3. **Update documentation**
   - Update [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md) if you find issues
   - Update API documentation if you add endpoints
   - Update README if you change setup process

#### After Completing Work

1. **Verify everything works**
   ```bash
   # Backend compilation
   cd backend && npx tsc --noEmit

   # Frontend build
   cd frontend && npm run build

   # Test main workflows manually
   ```

2. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: Add quality inspection controller"
   git push origin main
   ```

3. **Update status**
   - Update [CURRENT_STATE.md](CURRENT_STATE.md) if you complete a module
   - Check off tasks in [ROADMAP.md](ROADMAP.md)

### Common Development Tasks

#### Add New API Endpoint

1. **Define in Prisma schema** (`backend/prisma/schema.prisma`)
2. **Create migration:** `npx prisma migrate dev --name feature_name`
3. **Create controller** (`backend/src/controllers/feature.controller.ts`)
4. **Create routes** (`backend/src/routes/feature.routes.ts`)
5. **Register routes** (`backend/src/app.ts`)
6. **Test endpoint** (curl/Postman)

#### Add New Frontend Page

1. **Create types** (`frontend/src/types/feature.types.ts`)
2. **Create service** (`frontend/src/services/feature.service.ts`)
3. **Create page** (`frontend/src/pages/FeaturePage.tsx`)
4. **Add route** (`frontend/src/App.tsx`)
5. **Add navigation** (`frontend/src/components/Sidebar.tsx`)
6. **Test in browser**

#### Database Operations

```bash
# View current schema
cd backend && npx prisma studio

# Create new migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (CAUTION: deletes all data)
npx prisma migrate reset

# Generate Prisma client after schema changes
npx prisma generate
```

#### Debugging

**Backend errors:**
- Check terminal for error messages
- Check `backend/logs/` for detailed logs
- Use `console.log()` or debugger
- Check Prisma queries: `npx prisma studio`

**Frontend errors:**
- Check browser console (F12)
- Check Network tab for API errors
- Use React DevTools
- Check Redux DevTools (if using Redux)

---

## For AI Agents

### Quick Orientation

**Your Role:** Autonomous development following established patterns

**Before Starting ANY Task:**

1. **Read these files IN ORDER:**
   ```
   1. PROJECT_OVERVIEW.md → Understand what we're building
   2. CURRENT_STATE.md → Understand what exists
   3. TECHNICAL_DEBT.md → Understand what's broken
   4. ROADMAP.md → Understand what to build next
   5. CODING_STANDARDS.md → Understand how to code
   ```

2. **Verify system health:**
   ```bash
   # Backend must have ZERO TypeScript errors
   cd backend && npx tsc --noEmit

   # If errors exist, DO NOT proceed. Fix them first.
   ```

3. **Check current branch and git status:**
   ```bash
   git status
   git branch
   # Work on main unless instructed otherwise
   ```

### Your Development Process

#### Phase 1: Understand (15 min)
- Read relevant documentation
- Review existing similar code
- Understand data models (Prisma schema)
- Identify dependencies

#### Phase 2: Plan (10 min)
- Break task into subtasks
- Identify files to create/modify
- Identify potential issues
- Estimate time

#### Phase 3: Implement (Main work)
- Follow [CODING_STANDARDS.md](../CODING_STANDARDS.md) religiously
- Write TypeScript (not JavaScript)
- Add error handling
- Add input validation
- Write meaningful comments
- Test as you go

#### Phase 4: Test (Critical)
```bash
# Must pass ALL of these:
cd backend && npx tsc --noEmit           # Zero errors
cd frontend && npm run build              # Clean build
# Manual testing of new features           # Works as expected
```

#### Phase 5: Document (Required)
- Update [CURRENT_STATE.md](CURRENT_STATE.md) if module complete
- Update [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md) if issues found
- Add API documentation comments
- Update ROADMAP.md progress

### Critical Rules

**NEVER:**
- ❌ Skip TypeScript compilation check
- ❌ Leave compilation errors
- ❌ Skip testing
- ❌ Use `any` type without comment
- ❌ Commit broken code
- ❌ Delete code without understanding it
- ❌ Change database schema without migration

**ALWAYS:**
- ✅ Read documentation first
- ✅ Follow existing patterns
- ✅ Test before committing
- ✅ Update documentation
- ✅ Ask if unsure
- ✅ Leave code better than you found it

### Common Agent Tasks

**Task: Add New Controller**

1. Read Prisma schema for the model
2. Study similar controller (e.g., `customer.controller.ts`)
3. Create controller file following pattern
4. Create corresponding routes file
5. Register routes in `app.ts`
6. Compile: `npx tsc --noEmit`
7. Test endpoints manually
8. Document in CURRENT_STATE.md

**Task: Add New Frontend Page**

1. Study similar page (e.g., `CustomerList.tsx`)
2. Create types file
3. Create service file
4. Create page component
5. Add route in App.tsx
6. Add sidebar navigation
7. Build: `npm run build`
8. Test in browser

**Task: Fix Bug**

1. Understand the bug (reproduce it)
2. Find root cause (don't guess)
3. Fix properly (don't patch)
4. Test fix thoroughly
5. Check for similar bugs elsewhere
6. Document fix if non-obvious

### Current Focus (January 2025)

**Priority 1: Complete Fabric Lifecycle Backend**

Read these in order:
1. [ROADMAP.md](ROADMAP.md) → Priority 1 section
2. [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md) → High priority items
3. `backend/prisma/schema.prisma` → Fabric lifecycle models

**Your Tasks:**
1. Quality Inspection Controller (~4-5 hours)
2. Stock Aging Service (~2-3 hours)
3. Quality Grading Service (~3-4 hours)
4. Cross-Style Allocation Service (~3-4 hours)
5. Integration updates (~4-6 hours)

**Start with:** Quality Inspection Controller

**Files to create:**
- `backend/src/controllers/quality-inspection.controller.ts`
- `backend/src/routes/quality-inspection.routes.ts`

**Reference:**
- Similar pattern: `fabric-procurement.controller.ts`
- Database model: `quality_inspection` table in Prisma schema

---

## 🔧 Troubleshooting

### Backend won't start

**Error: "Cannot connect to database"**
```bash
# Check PostgreSQL is running
# Windows: Check Services
# Mac: brew services list
# Linux: systemctl status postgresql

# Verify DATABASE_URL in .env
# Make sure database exists
psql -U postgres -c "\l"
```

**Error: "Port 5000 already in use"**
```bash
# Find process using port
# Windows: netstat -ano | findstr :5000
# Mac/Linux: lsof -i :5000

# Kill process or change port in .env
```

**Error: "Module not found"**
```bash
# Reinstall dependencies
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Frontend won't start

**Error: "Cannot connect to backend"**
- Check backend is running on http://localhost:5000
- Check VITE_API_URL in frontend/.env
- Check for CORS errors in browser console

**Error: "Module not found"**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Database issues

**Error: "Migration failed"**
```bash
# Check current migration status
npx prisma migrate status

# Resolve migration
npx prisma migrate resolve --applied "migration_name"

# Or reset (CAUTION: deletes data)
npx prisma migrate reset
```

**Data not showing up**
```bash
# Check data in Prisma Studio
npx prisma studio

# Run seed if needed
npx prisma db seed
```

### Build errors

**TypeScript errors**
```bash
# Check specific errors
cd backend && npx tsc --noEmit

# Common fixes:
# - Missing types: npm install --save-dev @types/package-name
# - Type mismatch: Check your types
# - Import errors: Check file paths
```

**Prisma errors**
```bash
# Regenerate client
npx prisma generate

# If schema changed, create migration
npx prisma migrate dev
```

---

## 📚 Additional Resources

### Documentation
- [PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md) - Project vision and goals
- [CURRENT_STATE.md](CURRENT_STATE.md) - Detailed technical status
- [ROADMAP.md](ROADMAP.md) - What's next
- [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md) - Known issues
- [CODING_STANDARDS.md](../CODING_STANDARDS.md) - How to code
- [DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md) - All docs index

### Phase Documentation
- [Phase 1: Financial Masters](phases/phase1/PHASE1_CONSOLIDATED.md)
- [Phase 1.5: Import/Export](phases/phase1.5/PHASE1.5_CONSOLIDATED.md)
- [Phase 3: Inventory Management](phases/phase3/PHASE3_CONSOLIDATED.md)

### External Resources
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

## 🎯 Next Steps

### New Developer Onboarding

**Day 1: Setup & Orientation**
- Complete Prerequisites installation
- Clone repository and setup
- Run application successfully
- Login and explore features
- Read PROJECT_OVERVIEW.md

**Day 2: Understanding Codebase**
- Read CURRENT_STATE.md
- Explore backend structure
- Explore frontend structure
- Read CODING_STANDARDS.md
- Study 2-3 existing controllers/pages

**Day 3: First Task**
- Pick a small task from TECHNICAL_DEBT.md
- Follow development workflow
- Get code review
- Merge and celebrate!

### Ready to Code?

**Start here based on your role:**

**Backend Developer:**
→ [ROADMAP.md](ROADMAP.md) Priority 1: Complete Fabric Lifecycle Backend

**Frontend Developer:**
→ [ROADMAP.md](ROADMAP.md) Priority 2: Build Fabric Lifecycle Frontend

**Full-Stack Developer:**
→ Start with backend, then frontend

**AI Agent:**
→ [ROADMAP.md](ROADMAP.md) Priority 1, Task 1: Quality Inspection Controller

---

**Last Updated:** January 19, 2025

**Need Help?**
- Check [DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)
- Review troubleshooting section above
- Ask in team chat
- Create GitHub issue

**Let's build something amazing!** 🚀
