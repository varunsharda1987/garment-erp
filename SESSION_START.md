# 🚀 SESSION START - Kashaya Fabs ERP

> **THE ONLY FILE YOU NEED TO START ANY SESSION**
>
> Read this file first. Everything you need is here.

**Last Updated:** October 23, 2025
**Project Status:** Style Master Complete | Customer Management Complete
**Next Priority:** Supplier Management (Phase 2.3)

---

## ⚡ QUICK START (30 SECONDS)

### 1. Start Servers
```bash
cd "c:\Users\admin\Desktop\garment-erp"
# Backend already running on http://localhost:5000
# Frontend already running on http://localhost:5173
```

### 2. Your Role
**You are a Full-Stack Developer** for Kashaya Fabs ERP.

### 3. What You'll Do
- Build features from the roadmap
- Fix bugs and errors
- Run ALL verification commands
- Show actual command outputs

---

## 📊 CURRENT PROJECT STATUS

### ✅ COMPLETED (45% Complete)
- [x] Phase 1: Project Setup & Database Schema
- [x] Phase 1: Authentication System (Backend + Frontend)
- [x] Phase 2.1: User Management (Backend + Frontend)
- [x] **Phase 2.2: Customer Management** ✅ **COMPLETE!**
  - ✅ Full CRUD API at `/api/customers`
  - ✅ Dynamic Brand Names (multiple brands per customer)
  - ✅ Dynamic Product Categories (Western Wear, Ethnic Wear, etc.)
  - ✅ Auto-generated customer codes
  - ✅ Customer Category: DOMESTIC/EXPORT/LOCAL
  - ✅ Phone validation (max 10 digits)
  - ✅ GST validation (exactly 15 characters)
  - ✅ CustomerList with search, filter, pagination
  - ✅ CustomerForm with add/remove fields
- [x] **Phase 5.1: Style Master Module** ⭐ **COMPLETE!**
  - ✅ Database schema with 13 tables
  - ✅ StyleForm (Create/Edit with 8 sections)
  - ✅ StyleList (with search, pagination & production status)
  - ✅ StyleDetail Page (with 7 tabs including Production)
  - ✅ Complete CRUD API
  - ✅ Image Upload (fully functional)
  - ✅ Size Breakdown (backend integration complete)
  - ✅ Edit Functionality (complete update logic)
  - ✅ Production Tracking Integration
    - Dashboard with real-time stage counts
    - Production tab in StyleDetail
    - Stage update API and UI
    - Color-coded stage visualization

### ⏳ NEXT UP (Priority Order)
1. **Phase 2.3 - Supplier Management** ← **RECOMMENDED NEXT**
2. **Phase 3.1 - Raw Material Master**
3. **Phase 4.2 - Order Management** (Critical for production flow)
4. **Phase 5.2 - Bill of Materials (BOM)**
5. **Phase 5.3 - Production Planning**

---

## 🏗️ PROJECT ARCHITECTURE

### Tech Stack
**Frontend:**
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Zustand (state)
- React Hook Form + Zod
- Playwright (E2E tests)
- Server: http://localhost:5173

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL (Railway)
- Prisma ORM
- JWT + bcrypt (auth)
- Server: http://localhost:5000

### Database
- **Total Tables:** 50
- **Total Enums:** 24
- **Style Master Tables:** 13
- **Location:** Railway PostgreSQL
- **Docs:** Run `cd backend && npm run docs:schema` to update

### Project Structure
```
garment-erp/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/    # Page components
│   │   ├── components/ # Reusable components
│   │   ├── stores/   # Zustand state
│   │   ├── services/ # API calls
│   │   └── types/    # TypeScript types
│   └── tests/        # Playwright E2E
│
├── backend/          # Node.js + Express
│   ├── src/
│   │   ├── controllers/ # Business logic
│   │   ├── routes/   # API routes
│   │   ├── middleware/ # Auth, validation
│   │   └── types/    # TypeScript types
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   └── scripts/
│       └── generate-schema-docs.js # Auto-doc generator
│
└── docs/
    ├── DATABASE_SCHEMA.md (auto-generated)
    └── (other reference docs)
```

---

## 🎯 YOUR WORKFLOW

### Step 1: Announce Your Role
```
"I'm your Full-Stack Developer for Kashaya Fabs ERP.
Working on: [Feature/Bug Name]"
```

### Step 2: Build the Feature
- Follow existing patterns
- Write clean TypeScript (strict mode, no `any`)
- Handle errors properly
- Add loading states

### Step 3: Run Verification Commands

**Frontend Verification:**
```bash
cd frontend

# 1. TypeScript check
npx tsc --noEmit

# 2. Build check
npm run build

# 3. E2E tests (if applicable)
npm run test:e2e

# 4. Console errors check
node scripts/check-console.cjs http://localhost:5173/[page]
```

**Backend Verification:**
```bash
cd backend

# 1. TypeScript check
npx tsc --noEmit

# 2. Health check
curl http://localhost:5000/health

# 3. Test endpoints with curl (show actual responses)
curl -X POST http://localhost:5000/api/[endpoint] \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{"field":"value"}'

# 4. Auth test (expect 401)
curl http://localhost:5000/api/[protected-endpoint]

# 5. Validation test (expect 400)
curl -X POST http://localhost:5000/api/[endpoint] \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Step 4: Show Proof
**REQUIRED FORMAT:**
```
✅ FEATURE COMPLETE: [Feature Name]

FILES CREATED/MODIFIED:
✅ path/to/file1.ts
✅ path/to/file2.ts

VERIFICATION:
1. TypeScript Check:
$ npx tsc --noEmit
(show actual output)

2. [Other verifications with outputs]

CANNOT VERIFY (requires browser):
⚠️ [What you can't verify]

USER ACTION REQUIRED:
1. [Steps for user to test]
```

---

## 🚨 KNOWN ISSUES (Pre-existing)

### High Priority Fixes Needed

**1. StyleForm.tsx Errors**
- Missing `trim` property in valueAdditionDetails type
- User type mismatch (firstName/lastName vs name)
- Description field type (null vs undefined)

**2. Dashboard.tsx**
- Unused 'error' variable

**3. Image Upload**
- Multer TypeScript configuration needed
- Route currently commented out

**4. Size Breakdown**
- Frontend UI complete
- Backend integration pending
- Not saving to StyleSizeBreakdown table

---

## 📂 KEY FILE LOCATIONS

### Most Important Files

**Frontend:**
- `frontend/src/pages/StyleForm.tsx` - Style creation form
- `frontend/src/pages/StyleList.tsx` - Style list with search
- `frontend/src/pages/StyleDetail.tsx` - Style detail (6 tabs) ⭐ NEW
- `frontend/src/types/style.types.ts` - TypeScript types
- `frontend/src/services/style.service.ts` - API service
- `frontend/src/App.tsx` - Routes

**Backend:**
- `backend/src/controllers/style.controller.ts` - Style CRUD
- `backend/src/routes/style.routes.ts` - Style routes
- `backend/prisma/schema.prisma` - Database schema
- `backend/src/app.ts` - Express app setup

---

## 🗄️ DATABASE - STYLE MASTER TABLES

### Core Tables (13 total)

1. **styles** - Main style table
   - buyerName, brandName, styleCode, styleName
   - imageUrl, season, description
   - orderQuantity, orderDate, deliveryDate, orderValue

2. **style_components** - Components (Top, Bottom, Dupatta)
   - componentName, componentType, sortOrder

3. **style_fabrics** - Fabrics with greige names
   - fabricName, fabricType, greigeName ⭐
   - fabricColor, fabricGSM, fabricWidth
   - cadAverageMeters, supplierName, unitPrice

4. **style_accessories** - Accessories (legacy)
   - accessoryName, accessoryType, quantityPerPiece

5. **style_garment_trims** ⭐ NEW
   - trimName, trimType, quantityPerPiece, unit, supplier

6. **style_value_additions** ⭐ NEW
   - additionType, description, estimatedCost, vendor

7. **style_packaging** ⭐ NEW
   - itemName, itemType, specification, quantityPerPack

8. **style_processes** - Processes (legacy)
   - processName, vendorName, estimatedCost

9. **style_costing** - Complete costing breakdown
   - Material, processing, production costs
   - totalCostPerPiece, sellingPricePerPiece, profitMargin

10. **style_size_breakdown** - Size-wise quantities
    - sizeName, quantity

11. **style_production_tracking** - Stage-wise tracking
    - currentStage, piecesInStage
    - Stage-by-stage piece counts

12. **style_orders** - Multiple orders per style
    - orderNumber, orderQuantity, orderValue

### Update Database Docs
```bash
cd backend
npm run docs:schema
```
This auto-generates `docs/DATABASE_SCHEMA.md` from Prisma schema.

---

## 🎨 STYLE MASTER - WHAT'S BUILT

### StyleForm (Create/Edit)
**Location:** `frontend/src/pages/StyleForm.tsx`

**8 Sections:**
1. Basic Info (Buyer, Brand, Code, Category, Components)
2. Order Info (Quantity, Cost, Dates) - Optional
3. Fabrics (with greige name)
4. Size Breakdown (3 input methods)
5. Garment Trims (add/remove)
6. Value Additions (checkboxes)
7. Packaging (add/remove)
8. Description/Remarks

**Features:**
- Auto-save (every 2 seconds)
- Auto-calculating order value
- Color-coded sections
- Dynamic add/remove
- Conditional rendering

### StyleList (Browse)
**Location:** `frontend/src/pages/StyleList.tsx`

**Features:**
- Table view with pagination
- Search (code, name, buyer, brand)
- Row click → StyleDetail
- Production stage display
- Create new button

### StyleDetail (View) ⭐ JUST COMPLETED
**Location:** `frontend/src/pages/StyleDetail.tsx`

**6 Tabs:**
1. **Basic Info** - All style details, order info, size breakdown
2. **Components & Fabrics** - Component-by-component breakdown
3. **Garment Trims** - Buttons, zippers, labels, elastic
4. **Value Additions** - Embroidery, handwork, printing, washing
5. **Packaging** - Polybags, hangtags, price tags, cartons
6. **Costing** - Complete cost breakdown

**Features:**
- Tabbed interface
- Responsive design
- Empty states
- Color-coded sections
- Edit button (route ready)
- Back to list button

---

## 🔌 API ENDPOINTS

### Style Master API
**Base:** `http://localhost:5000/api`

**Endpoints:**
- `POST /styles` - Create style
- `GET /styles` - List styles (paginated, searchable)
- `GET /styles/:id` - Get single style
- `PUT /styles/:id` - Update style
- `DELETE /styles/:id` - Soft delete style
- `POST /styles/:id/image` - Upload image (pending fix)

**Authentication:**
All endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

**Test Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kashayafabs.com","password":"Admin@123"}'
```

---

## 💡 DEVELOPMENT PATTERNS

### Frontend Patterns

**1. API Calls**
```typescript
// Use the service layer
import { styleService } from '@/services/style.service';

const styles = await styleService.getAllStyles(page, limit, search);
const style = await styleService.getStyleById(id);
```

**2. State Management**
```typescript
// Use Zustand for global state
import { useAuthStore } from '@/stores/auth.store';

const user = useAuthStore((state) => state.user);
const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
```

**3. Routing**
```typescript
// Use React Router
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/styles');
navigate(`/styles/${id}`);
```

**4. Forms**
```typescript
// Use controlled components with state
const [fieldName, setFieldName] = useState('');

<Input
  value={fieldName}
  onChange={(e) => setFieldName(e.target.value)}
/>
```

### Backend Patterns

**1. Controllers**
```typescript
// Handle business logic
export const createStyle = async (req: Request, res: Response) => {
  try {
    const data = await prisma.style.create({
      data: req.body,
      include: { components: true, ... }
    });
    res.status(201).json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Error message' });
  }
};
```

**2. Prisma Queries**
```typescript
// Always use Prisma Client
const style = await prisma.style.findUnique({
  where: { id },
  include: {
    components: { include: { fabrics: true } },
    garmentTrims: true,
    valueAdditions: true,
    packaging: true
  }
});
```

**3. Nested Creates**
```typescript
// Create with relationships
await prisma.style.create({
  data: {
    styleCode: 'ABC123',
    components: {
      create: [
        { componentName: 'Top', fabrics: { create: [...] } }
      ]
    },
    garmentTrims: { create: [...] }
  }
});
```

---

## 🚫 COMMON MISTAKES TO AVOID

### DON'T:
- ❌ Use `any` type in TypeScript
- ❌ Skip verification commands
- ❌ Claim "tested in browser" (you can't see it)
- ❌ Create files without reading existing ones first
- ❌ Bypass Prisma with raw SQL
- ❌ Skip error handling
- ❌ Forget loading states
- ❌ Manually edit DATABASE_SCHEMA.md

### DO:
- ✅ Use strict TypeScript types
- ✅ Run ALL verification commands
- ✅ Show actual command outputs
- ✅ Follow existing patterns
- ✅ Use Prisma for all DB operations
- ✅ Handle errors with try-catch
- ✅ Add loading states for async operations
- ✅ Run `npm run docs:schema` after schema changes

---

## 🎯 IMMEDIATE NEXT TASKS

### Priority 1: Fix Pre-existing Errors
**File:** `frontend/src/pages/StyleForm.tsx`

**Errors to fix:**
1. Add `trim` property to valueAdditionDetails type
2. Fix User type (firstName/lastName vs name)
3. Fix description field type (null vs undefined)

**File:** `frontend/src/pages/Dashboard.tsx`
- Remove unused 'error' variable

### Priority 2: Image Upload
**Tasks:**
1. Fix multer TypeScript configuration
2. Update `backend/src/middleware/upload.middleware.ts`
3. Enable route in style.routes.ts
4. Add image preview in StyleForm
5. Display images in StyleList and StyleDetail

### Priority 3: Size Breakdown Backend
**Tasks:**
1. Add size breakdown create logic in style.controller.ts
2. Calculate absolute quantities from ratio/percentage
3. Test with curl commands

---

## 📚 USEFUL COMMANDS

### Database
```bash
cd backend

# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Update schema docs
npm run docs:schema

# Combined: migrate + update docs
npm run migrate:docs

# View database
npx prisma studio

# Seed admin user
npx ts-node seed-admin.ts
```

### Frontend
```bash
cd frontend

# Install packages
npm install [package-name]

# TypeScript check
npx tsc --noEmit

# Build
npm run build

# E2E tests
npm run test:e2e

# Console check
node scripts/check-console.cjs http://localhost:5173/[page]
```

### Backend
```bash
cd backend

# TypeScript check
npx tsc --noEmit

# Test health
curl http://localhost:5000/health

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kashayafabs.com","password":"Admin@123"}'
```

---

## 🔑 TEST CREDENTIALS

**Admin User:**
- Email: `admin@kashayafabs.com`
- Password: `Admin@123`

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

---

## 📖 REFERENCE DOCS (Optional)

If you need more details, these files exist but **you don't need to read them to start**:

- `docs/DATABASE_SCHEMA.md` - Full database documentation (auto-generated)
- `docs/DEVELOPMENT_ROADMAP.md` - Complete roadmap
- `docs/FEATURES_LIST.md` - Feature descriptions
- `README.md` - Project overview

**To update database docs:**
```bash
cd backend && npm run docs:schema
```

---

## ✅ SESSION START CHECKLIST

Before you start coding:

- [ ] Servers running (backend: 5000, frontend: 5173)
- [ ] Read this SESSION_START.md file
- [ ] Understand current status (Style Master complete)
- [ ] Know next priority (Fix errors → Image upload → Size breakdown)
- [ ] Ready to run verification commands
- [ ] Will show actual outputs

---

## 🎯 YOUR MISSION

Build a production-ready ERP system for Kashaya Fabs to track garment manufacturing from order to delivery.

**Main Goal:** Real-time production status tracking across multiple styles and locations.

**Your Standards:**
- Professional code
- Secure and scalable
- Fully tested
- Well documented

---

## 💬 QUICK TIPS

1. **Always run verifications** - No exceptions
2. **Show actual outputs** - Don't just say "it works"
3. **Follow patterns** - Look at existing code first
4. **Ask if unclear** - Better than guessing
5. **One task at a time** - Complete before moving on
6. **Use TodoWrite** - Track your progress
7. **Be honest** - Say what you can't verify

---

## 🚀 LET'S START!

**You're ready to start coding!**

Just say: "I'm your Full-Stack Developer. Working on [task name]. Let me start."

Then build, test, verify, and show proof!

---

**Last Updated:** October 23, 2025
**Status:** ✅ Ready for Development
**Servers:** Running
**Next Task:** Fix StyleForm errors

---

**ONE FILE. EVERYTHING YOU NEED. LET'S BUILD! 🏭✨**
