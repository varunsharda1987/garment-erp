# 🤖 CLAUDE CODE - DEVELOPMENT INSTRUCTIONS

## FOR CLAUDE CODE AI ASSISTANT

This document provides comprehensive instructions for Claude Code to build the Kashaya Fabs Garment Manufacturing ERP System.

---

## 📋 PROJECT CONTEXT

**Client:** Kashaya Fabs - Garment Manufacturing Company  
**Client Technical Level:** Non-technical owner  
**Development Approach:** Incremental, module-by-module  
**Communication:** Explain in simple terms, use real-world analogies  
**Code Quality:** Production-ready, well-commented, type-safe

---

## 🎯 PRIMARY OBJECTIVES

1. **MAIN PAIN POINT TO SOLVE:** Real-time production status tracking for multiple styles
2. Build a complete, scalable ERP system
3. Handle 300 machines, multiple locations, 30K-50K pieces/month
4. Support size and color tracking (flexible ranges)
5. Multi-location production coordination
6. Export business support

---

## 🏗️ TECH STACK

### Frontend
- **Framework:** React 18+ with TypeScript
- **Build Tool:** Vite
- **UI Library:** shadcn/ui components
- **Styling:** Tailwind CSS
- **State Management:** React Context API / Zustand (if complex)
- **Forms:** React Hook Form + Zod validation
- **API Client:** Axios
- **Routing:** React Router v6

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js with TypeScript
- **Database:** PostgreSQL 15+
- **ORM:** Prisma
- **Authentication:** JWT + bcrypt (Phase 1) → Clerk (Phase 2)
- **Validation:** Zod
- **API Documentation:** Swagger/OpenAPI (optional)

### Development Tools
- **Version Control:** Git + GitHub
- **Package Manager:** npm
- **Code Quality:** ESLint + Prettier
- **Environment:** dotenv for config

### Deployment (Phase 2)
- **Frontend:** Vercel
- **Backend:** Railway
- **Database:** Railway PostgreSQL

---

## 📁 PROJECT STRUCTURE

```
garment-erp/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   ├── layout/          # Layout components (Sidebar, Header)
│   │   │   ├── forms/           # Reusable form components
│   │   │   └── [feature]/       # Feature-specific components
│   │   ├── pages/
│   │   │   ├── auth/            # Login, Register
│   │   │   ├── dashboard/       # Main dashboard
│   │   │   ├── customers/       # Customer management
│   │   │   ├── orders/          # Order management
│   │   │   ├── production/      # Production tracking
│   │   │   ├── inventory/       # Inventory management
│   │   │   └── [other-modules]
│   │   ├── services/
│   │   │   ├── api.ts           # Axios instance
│   │   │   └── [feature].service.ts
│   │   ├── hooks/               # Custom React hooks
│   │   ├── utils/               # Helper functions
│   │   ├── types/               # TypeScript interfaces
│   │   ├── lib/                 # shadcn/ui lib
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── customers.routes.ts
│   │   │   ├── orders.routes.ts
│   │   │   └── [other-routes]
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── customers.controller.ts
│   │   │   └── [other-controllers]
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── utils/
│   │   │   ├── jwt.util.ts
│   │   │   ├── bcrypt.util.ts
│   │   │   └── [other-utils]
│   │   ├── types/               # TypeScript interfaces
│   │   ├── config/
│   │   │   └── database.ts
│   │   ├── app.ts               # Express app setup
│   │   └── server.ts            # Server entry point
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── docs/                         # All planning documents
│   ├── PROJECT_OVERVIEW.md
│   ├── DEVELOPMENT_ROADMAP.md
│   ├── DATABASE_SCHEMA.md
│   ├── FEATURES_LIST.md
│   ├── CLAUDE_CODE_INSTRUCTIONS.md
│   └── TECH_STACK_GUIDE.md
│
├── README.md
└── .gitignore
```

---

## 🚀 PHASE 1: FOUNDATION - DETAILED STEPS

### STEP 1.1: PROJECT INITIALIZATION

**Task:** Set up project structure and install dependencies

**Commands to Execute:**

```bash
# Navigate to project folder
cd "Z:\1. Kashaya Fabs\garment-erp"

# Initialize Git repository
git init
git branch -M main

# Create .gitignore
cat > .gitignore << EOL
node_modules/
.env
.env.local
dist/
build/
*.log
.DS_Store
EOL

# Create frontend
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install

# Install shadcn/ui
npx shadcn-ui@latest init

# Install additional frontend dependencies
npm install react-router-dom axios react-hook-form @hookform/resolvers zod zustand
npm install -D @types/node

# Return to root
cd ..

# Create backend
mkdir backend
cd backend
npm init -y

# Install backend dependencies
npm install express cors dotenv bcryptjs jsonwebtoken
npm install @prisma/client
npm install -D typescript @types/express @types/cors @types/bcryptjs @types/jsonwebtoken
npm install -D prisma ts-node nodemon

# Initialize TypeScript
npx tsc --init

# Initialize Prisma
npx prisma init

cd ..
```

**Deliverable:** Basic project structure ready

---

### STEP 1.2: DATABASE SCHEMA SETUP

**Task:** Create Prisma schema based on DATABASE_SCHEMA.md

**File:** `backend/prisma/schema.prisma`

**Instructions:**
1. Read DATABASE_SCHEMA.md thoroughly
2. Implement ALL 35+ tables as defined
3. Use proper relationships (1-to-many, many-to-many)
4. Add indexes for performance
5. Use enums for status fields
6. Add createdAt, updatedAt timestamps

**Key Prisma Patterns:**

```prisma
// Example table structure
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  firstName String
  lastName  String
  role      UserRole
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relationships
  orders    Order[]
  
  @@index([email])
}

enum UserRole {
  ADMIN
  PRODUCTION_MANAGER
  SALES
  INVENTORY
  ACCOUNTS
  QUALITY
  PURCHASE
}
```

**Run Migration:**
```bash
cd backend
npx prisma migrate dev --name initial_schema
npx prisma generate
```

**Deliverable:** Complete database schema migrated

---

### STEP 1.3: BACKEND AUTHENTICATION API

**Task:** Build JWT-based authentication

**Files to Create:**

1. **backend/src/types/auth.types.ts**
```typescript
export interface RegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}
```

2. **backend/src/controllers/auth.controller.ts**
- Register user (hash password with bcrypt)
- Login user (verify password, generate JWT)
- Get current user (from token)

3. **backend/src/middleware/auth.middleware.ts**
- Verify JWT token
- Attach user to request
- Role-based access control

4. **backend/src/routes/auth.routes.ts**
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

5. **backend/src/app.ts**
- Express app setup
- CORS configuration
- Body parser
- Error handling middleware

6. **backend/src/server.ts**
- Start server on PORT 5000

**Environment Variables (.env):**
```
DATABASE_URL="postgresql://user:password@localhost:5432/kashaya_erp"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
PORT=5000
```

**Key Implementation Notes:**
- Hash passwords with bcrypt (saltRounds: 10)
- JWT expires in 7 days
- Return 401 for invalid credentials
- Validate email format
- Password min length: 8 characters
- Include proper error messages

**Deliverable:** Working authentication API

---

### STEP 1.4: FRONTEND AUTH PAGES

**Task:** Build login and registration UI

**Files to Create:**

1. **frontend/src/pages/auth/LoginPage.tsx**
- Login form (email, password)
- Form validation (React Hook Form + Zod)
- Call login API
- Store JWT in localStorage
- Redirect to dashboard on success
- Display error messages

2. **frontend/src/pages/auth/RegisterPage.tsx**
- Registration form
- Form validation
- Call register API
- Auto-login after registration

3. **frontend/src/services/auth.service.ts**
- API calls to backend
- Token management
- User state

4. **frontend/src/components/layout/ProtectedRoute.tsx**
- Check if user authenticated
- Redirect to login if not

5. **frontend/src/App.tsx**
- React Router setup
- Public routes (login, register)
- Protected routes (dashboard, etc.)

**shadcn/ui Components to Use:**
- Button
- Input
- Form
- Card
- Label

**Deliverable:** Working login/register flow

---

### STEP 1.5: DASHBOARD LAYOUT

**Task:** Create main dashboard shell with navigation

**Files to Create:**

1. **frontend/src/components/layout/Sidebar.tsx**
- Collapsible sidebar
- Navigation menu items (with icons)
- Active route highlighting
- User profile section at bottom
- Logout button

**Menu Structure:**
```
- Dashboard
- Masters
  - Customers
  - Suppliers
  - Users
- Inventory
  - Raw Materials
  - Stock Management
  - Finished Goods
- Sales
  - Quotations
  - Orders
  - Invoices
- Production
  - Styles
  - BOM
  - Work Orders
  - Production Tracking (⭐ Main Feature)
- Quality
  - Inspections
  - Samples
- Purchasing
  - Purchase Orders
  - GRN
- Reports
  - Inventory Reports
  - Production Reports
  - Sales Reports
```

2. **frontend/src/components/layout/Header.tsx**
- Top bar
- Company logo
- Notifications icon (bell)
- User menu dropdown

3. **frontend/src/components/layout/DashboardLayout.tsx**
- Combine Sidebar + Header
- Main content area
- Responsive design

4. **frontend/src/pages/dashboard/DashboardPage.tsx**
- Empty dashboard with widget placeholders
- KPI cards (to be filled later)
- Welcome message

**Design Guidelines:**
- Use Tailwind CSS utilities
- Sidebar width: 280px (expanded), 80px (collapsed)
- Use lucide-react icons
- Professional, clean design
- Mobile responsive (hamburger menu on mobile)

**Deliverable:** Complete dashboard layout with navigation

---

## 🎨 CODING STANDARDS & BEST PRACTICES

### TypeScript
- Always use TypeScript, never JavaScript
- Define interfaces for all data structures
- Use proper types, avoid `any`
- Export types from separate files

### Code Organization
- One component per file
- Separate business logic from UI
- Use custom hooks for reusable logic
- Keep components small and focused

### Naming Conventions
```typescript
// Components: PascalCase
LoginPage.tsx
CustomerForm.tsx

// Functions: camelCase
getUserById()
calculateTotalPrice()

// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 5000000;

// Interfaces: PascalCase with 'I' prefix (optional)
interface ICustomer { }
// Or without prefix
interface Customer { }

// Types: PascalCase
type OrderStatus = 'pending' | 'completed';
```

### Error Handling
```typescript
// Backend
try {
  // operation
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
}

// Frontend
try {
  // API call
} catch (error) {
  if (axios.isAxiosError(error)) {
    toast.error(error.response?.data?.message || 'An error occurred');
  }
}
```

### API Response Format
```typescript
// Success
{
  success: true,
  data: { ... },
  message: "Operation successful"
}

// Error
{
  success: false,
  error: "Error message",
  details: { ... }
}
```

### Comments
- Add comments for complex business logic
- Document function purposes
- Explain "why" not "what"

```typescript
/**
 * Calculate material requirements for a work order
 * Accounts for wastage percentage from BOM
 * @param workOrder - Work order with quantity breakup
 * @param bom - Bill of materials for the style
 * @returns Array of materials with required quantities
 */
function calculateMaterialRequirements(workOrder, bom) {
  // Implementation
}
```

---

## 🎯 PHASE-BY-PHASE DEVELOPMENT APPROACH

### For Each Module:

1. **Backend First:**
   - Create Prisma model (if new)
   - Create controller with CRUD operations
   - Create routes
   - Add validation middleware
   - Test with Postman/Thunder Client

2. **Frontend Next:**
   - Create page component
   - Create form components
   - Create data table component
   - Implement API integration
   - Add loading states and error handling
   - Test user flow

3. **Testing:**
   - Test happy path
   - Test error scenarios
   - Test edge cases
   - Verify data persistence

4. **Git Commit:**
   - Commit with descriptive message
   - Example: "feat: Add customer management module"

---

## 🔍 MODULE-SPECIFIC INSTRUCTIONS

### Customer Management Module

**Backend Routes:**
- GET /api/customers - List all (with pagination, search, filter)
- GET /api/customers/:id - Get one
- POST /api/customers - Create new
- PUT /api/customers/:id - Update
- DELETE /api/customers/:id - Delete (soft delete)

**Features:**
- Search by name, code, phone, email
- Filter by type, category, active status
- Pagination (20 per page)
- Sort by name, code, date

**Frontend Components:**
- CustomerListPage (table with search/filter)
- CustomerForm (create/edit modal or page)
- CustomerDetails (view mode)

**Validation:**
- Email format
- Phone number format (10 digits)
- GST number format (if provided)
- Unique customer code

---

### Order Management Module (CRITICAL)

**Special Requirements:**
- Size/color matrix input UI (spreadsheet-like)
- Support for 50+ size/color combinations
- Real-time total calculation
- Order approval workflow
- Status tracking throughout lifecycle

**Backend:**
- Create order with nested order items and breakup
- Use Prisma transactions for data integrity
- Calculate totals automatically
- Generate unique order number

**Frontend:**
- Multi-step order form:
  - Step 1: Customer and basic info
  - Step 2: Add items (styles)
  - Step 3: Size/color breakup (matrix input)
  - Step 4: Review and confirm
- Dynamic size/color grid
- Auto-calculate quantities and prices
- Save as draft feature

---

### Production Tracking Dashboard (MAIN FEATURE)

**Requirements:**
- Real-time updates
- Visual progress indicators
- Color-coded status
- Filter and search
- Drill-down to details
- Mobile responsive

**Backend:**
- Efficient queries (use Prisma aggregations)
- Calculate completion percentages
- Identify bottlenecks
- Return stage-wise data

**Frontend:**
- Dashboard cards showing:
  - Total work orders
  - In progress count
  - Completed today
  - Delayed count
- Work order list with progress bars
- Quick update modal
- Filter by status, location, date range
- Export to Excel

**Update Form:**
- Select work order
- Select stage
- Enter completed quantity
- Add remarks
- Submit (takes 30 seconds max)

---

### Bill of Materials (BOM)

**Special Features:**
- Dynamic material selection
- Quantity with unit
- Wastage percentage
- Cost calculation
- BOM versions
- Approval workflow

**Calculations:**
```typescript
// For each material
requiredQuantity = quantityPerUnit * totalGarments * (1 + wastagePercent/100)

// Total BOM cost
totalCost = sum(materialCost * quantityPerUnit * (1 + wastagePercent/100))
```

---

## 📊 DATA TABLES STANDARD

### For All List Pages:

**Features to Include:**
1. Search bar (top right)
2. Filter dropdowns (if applicable)
3. Column sorting
4. Pagination
5. Actions column (Edit, Delete, View)
6. "Add New" button (top right)
7. Empty state (when no data)
8. Loading skeleton

**shadcn/ui Components:**
- Table
- Input (search)
- Select (filters)
- Button
- Pagination
- DropdownMenu (actions)

**Example Structure:**
```tsx
<div>
  <div className="flex justify-between mb-4">
    <Input placeholder="Search..." />
    <Button>Add New</Button>
  </div>
  
  <Table>
    {/* Table content */}
  </Table>
  
  <Pagination />
</div>
```

---

## 🧪 TESTING CHECKLIST

### For Each Module:

- [ ] Create operation works
- [ ] Read/List operation works
- [ ] Update operation works
- [ ] Delete operation works
- [ ] Search works correctly
- [ ] Filter works correctly
- [ ] Pagination works
- [ ] Validation shows errors
- [ ] Success messages display
- [ ] Error handling works
- [ ] Loading states show
- [ ] Mobile responsive
- [ ] Data persists in database
- [ ] Relations work correctly

---

## 🚨 COMMON PITFALLS TO AVOID

1. **Don't hardcode:**
   - URLs (use environment variables)
   - Status values (use enums)
   - User roles (use constants)

2. **Don't skip validation:**
   - Always validate on both frontend and backend
   - Use Zod schemas

3. **Don't forget error handling:**
   - Wrap API calls in try-catch
   - Show user-friendly error messages
   - Log errors for debugging

4. **Don't create monolithic components:**
   - Keep components small and reusable
   - Extract repeated logic to custom hooks

5. **Don't ignore TypeScript errors:**
   - Fix all TypeScript errors before moving on
   - Don't use `@ts-ignore` without good reason

---

## 📦 DEPLOYMENT PREPARATION (Phase 2)

### Frontend (Vercel):
```bash
# Build command
npm run build

# Output directory
dist

# Environment variables
VITE_API_URL=https://your-backend.railway.app
```

### Backend (Railway):
```bash
# Start command
npm run start

# Build command
npm run build

# Environment variables
DATABASE_URL=postgresql://...
JWT_SECRET=...
PORT=5000
NODE_ENV=production
```

### Database Migration:
```bash
# Run on Railway
npx prisma migrate deploy
```

---

## 🎯 PRIORITY ORDER

### Week 1-2: Foundation
1. Project setup ✅
2. Database schema ✅
3. Authentication ✅
4. Dashboard layout ✅

### Week 3-4: Core Masters
5. User management
6. Customer management
7. Supplier management
8. Raw material master

### Week 5-7: Inventory
9. Stock management
10. Stock transactions
11. Finished goods
12. Stock alerts

### Week 8-9: Sales
13. Orders (CRITICAL)
14. Order items with size/color
15. Quotations
16. Invoices

### Week 10-13: Production (MAIN GOAL)
17. Style master
18. Size/color options
19. BOM
20. Work orders
21. Production tracking dashboard ⭐

---

## 💬 COMMUNICATION WITH OWNER

### When Explaining Technical Concepts:

**Bad:** "We'll use JWT tokens with bcrypt hashing and implement middleware for route protection."

**Good:** "Think of the login system like a security gate. When you log in, you get a special pass (token) that proves who you are. This pass is encrypted so no one can fake it."

### When Encountering Issues:

**Always:**
1. Explain what you're trying to do
2. Explain what the issue is (in simple terms)
3. Provide 2-3 options to solve it
4. Recommend one option with reasoning

### Progress Updates:

**Provide:**
- What was completed
- What's working (with screenshots if possible)
- What's next
- Any blockers

---

## 📝 GIT WORKFLOW

### Commit Message Format:
```
feat: Add customer management module
fix: Correct calculation in BOM total cost
chore: Update dependencies
docs: Add API documentation for orders
style: Format code with Prettier
refactor: Simplify authentication logic
```

### Branch Strategy (Simple):
- `main` - Production-ready code
- `develop` - Development branch (optional for later)

### Commit Frequency:
- After each working module
- Before trying major changes
- End of each work session

---

## 🎓 LEARNING RESOURCES (If Needed)

### For Owner to Understand:
- Prisma Docs: https://www.prisma.io/docs
- React Docs: https://react.dev
- shadcn/ui: https://ui.shadcn.com
- Tailwind CSS: https://tailwindcss.com

### Quick Reference:
- TypeScript: https://www.typescriptlang.org/docs
- Express.js: https://expressjs.com
- Zod: https://zod.dev

---

## ✅ CHECKLIST BEFORE STARTING EACH MODULE

- [ ] Read module requirements from FEATURES_LIST.md
- [ ] Check DATABASE_SCHEMA.md for data structure
- [ ] Understand user workflow
- [ ] Plan API endpoints
- [ ] Design UI layout (sketch if needed)
- [ ] Identify reusable components
- [ ] Start coding!

---

## 🚀 FINAL NOTES

1. **Focus on solving the main problem:** Production tracking is the #1 priority
2. **Build incrementally:** Small working pieces, not big broken systems
3. **Test immediately:** Don't wait - test as you build
4. **Ask questions:** If requirements are unclear, ask owner
5. **Document as you go:** Update README with setup instructions
6. **Keep it simple:** Don't over-engineer - build what's needed
7. **Think long-term:** Code should be maintainable and scalable

---

**Remember:** The owner is non-technical but very knowledgeable about garment manufacturing. Use factory and business analogies to explain concepts!

---

**Document Version:** 1.0  
**Last Updated:** October 16, 2025  
**For:** Claude Code AI Assistant