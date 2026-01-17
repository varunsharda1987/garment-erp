# System Architecture - Kashaya Fabs Garment ERP

## Table of Contents
1. [High-Level Overview](#1-high-level-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Decisions](#3-architecture-decisions)
4. [Database Design](#4-database-design)
5. [API Design](#5-api-design)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Security Architecture](#7-security-architecture)
8. [Deployment Architecture](#8-deployment-architecture)

---

## 1. HIGH-LEVEL OVERVIEW

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   React 19 SPA (Single Page Application)            │   │
│  │   - TypeScript                                        │   │
│  │   - Vite (Build Tool)                                │   │
│  │   - Tailwind CSS + shadcn/ui                        │   │
│  │   - React Router (Client-side routing)              │   │
│  │   - Zustand (State Management)                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Express.js REST API Server                        │   │
│  │   - Node.js Runtime                                  │   │
│  │   - TypeScript                                        │   │
│  │   - JWT Authentication Middleware                    │   │
│  │   - CORS Configuration                               │   │
│  │   - Request Validation (Zod)                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ Prisma ORM
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   PostgreSQL 17.6                                   │   │
│  │   - 48 Tables                                        │   │
│  │   - 25 Enums                                         │   │
│  │   - Foreign Key Constraints                          │   │
│  │   - Indexes for Performance                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Core Concepts

**Three-Tier Architecture:**
1. **Presentation Tier:** React frontend (user interface)
2. **Application Tier:** Express.js backend (business logic)
3. **Data Tier:** PostgreSQL database (data storage)

**Benefits:**
- Clear separation of concerns
- Independent scaling of each tier
- Technology flexibility (can replace any tier)
- Easier testing and maintenance

---

## 2. TECHNOLOGY STACK

### Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.0.0 | UI framework |
| **TypeScript** | 5.9.x | Type safety |
| **Vite** | 6.0.x | Build tool & dev server |
| **Tailwind CSS** | 3.4.x | Utility-first CSS |
| **shadcn/ui** | Latest | Component library |
| **React Router** | 7.x | Client-side routing |
| **Zustand** | 5.x | State management |
| **React Hook Form** | 7.x | Form management |
| **Zod** | 3.x | Schema validation |
| **Axios** | 1.x | HTTP client |
| **React Hot Toast** | 2.x | Notifications |

### Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20.x LTS | Runtime |
| **Express.js** | 4.x | Web framework |
| **TypeScript** | 5.9.x | Type safety |
| **Prisma** | 6.x | ORM & database toolkit |
| **PostgreSQL** | 17.6 | Relational database |
| **JSON Web Token** | 9.x | Authentication |
| **bcryptjs** | 2.x | Password hashing |
| **Zod** | 3.x | Request validation |
| **CORS** | 2.x | Cross-origin requests |

### Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **Nodemon** | Auto-restart dev server |
| **Playwright** | E2E testing |
| **Git** | Version control |

---

## 3. ARCHITECTURE DECISIONS

### ADR 001: Style-Order Separation

**Decision:** Separate Style (design template) from Order (customer purchase)

**Context:**
- Initial design mixed style specifications with order data
- This caused data duplication for repeat orders
- Industry standard separates these concepts

**Rationale:**
1. **Reusability:** One style → many orders (80% data entry reduction)
2. **Data Integrity:** Style modifications don't affect existing orders
3. **Flexibility:** Different customers can order same style
4. **Industry Standard:** Matches real garment manufacturing workflow

**Implementation:**
```
styles table (template)
  ↓ one-to-many
orders table (customer-specific)
  ↓ one-to-many
order_items table (style reference + quantities)
```

**Consequences:**
- ✅ Reduced data redundancy
- ✅ Easier style versioning
- ✅ Cleaner order management
- ⚠️ More complex queries (joins required)
- ⚠️ User education needed (two-step process)

---

### ADR 002: JSON Fields for Dynamic Data

**Decision:** Use PostgreSQL JSON/JSONB fields for category-specific dynamic data

**Context:**
- Different material categories need different specification fields
- Fabric needs: GSM, width, composition
- Trims needs: size, color, type
- Creating columns for all would result in sparse tables

**Rationale:**
1. **Flexibility:** Easy to add new material categories without schema migration
2. **Schema Cleanliness:** Avoid 50+ nullable columns
3. **PostgreSQL Native Support:** JSONB type with indexing and querying
4. **Type Safety:** Zod validation at application layer

**Implementation:**
```typescript
materials table:
  - categoryId (foreign key)
  - categoryData (JSONB) ← dynamic fields per category

Example for Fabric:
categoryData = {
  "gsm": 180,
  "width": 60,
  "composition": "100% Cotton",
  "finish": "Mercerized"
}
```

**Consequences:**
- ✅ Flexible schema
- ✅ Easy category additions
- ✅ No nullable column sprawl
- ⚠️ Complex validation needed
- ⚠️ JSONB queries less performant than columns (acceptable trade-off)

---

### ADR 003: Prisma ORM over Raw SQL

**Decision:** Use Prisma as ORM instead of raw SQL queries

**Rationale:**
1. **Type Safety:** Auto-generated TypeScript types from schema
2. **Migration Management:** Declarative schema with migration tracking
3. **SQL Injection Prevention:** Parameterized queries by default
4. **Developer Experience:** Intuitive API, better than query builders
5. **Database Agnostic:** Can switch databases (PostgreSQL → MySQL) if needed

**Implementation:**
```typescript
// Prisma way (type-safe)
const user = await prisma.users.findUnique({
  where: { id: userId },
  include: { orders: true }
});

// vs Raw SQL (error-prone)
const result = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);
```

**Consequences:**
- ✅ Compile-time type checking
- ✅ Automatic database migrations
- ✅ Reduced SQL injection risk
- ✅ Better code maintainability
- ⚠️ Learning curve for team
- ⚠️ Abstraction layer (can't use all PostgreSQL features directly)

---

### ADR 004: JWT Token Authentication

**Decision:** Use JWT (JSON Web Tokens) for stateless authentication

**Rationale:**
1. **Stateless:** No server-side session storage needed
2. **Scalable:** Works across multiple servers (horizontal scaling)
3. **Standard:** Industry-standard authentication method
4. **Payload Flexibility:** Can include user role, permissions in token

**Implementation:**
```typescript
// Token structure
{
  userId: string,
  email: string,
  role: UserRole,
  iat: number,  // issued at
  exp: number   // expiration (24 hours)
}

// Authentication flow
1. User logs in → Backend validates credentials
2. Backend generates JWT → Signs with secret key
3. Frontend stores JWT → localStorage
4. Subsequent requests → Include JWT in Authorization header
5. Backend validates JWT → Verifies signature & expiration
```

**Consequences:**
- ✅ No database lookup per request (fast)
- ✅ Horizontal scalability
- ✅ Works well with REST APIs
- ⚠️ Token size (larger than session ID)
- ⚠️ Can't revoke tokens (must wait for expiration)
- ⚠️ Needs refresh token mechanism (future enhancement)

---

### ADR 005: React 19 with TypeScript

**Decision:** Use React 19 with TypeScript for frontend

**Rationale:**
1. **Modern Features:** Latest React capabilities (improved compiler, RSC compatible)
2. **Type Safety:** TypeScript catches errors at compile-time
3. **Developer Experience:** Better autocomplete, refactoring support
4. **Industry Standard:** React + TypeScript is de facto standard
5. **Future Proof:** React 19 is production-ready and maintained

**Consequences:**
- ✅ Robust error checking
- ✅ Better code documentation (types as documentation)
- ✅ Easier refactoring
- ⚠️ Longer compile times
- ⚠️ TypeScript learning curve

---

### ADR 006: Monorepo Structure

**Decision:** Keep backend and frontend in single repository (monorepo)

**Rationale:**
1. **Shared Types:** Frontend can import backend types (upcoming feature)
2. **Atomic Commits:** API + UI changes in single commit
3. **Simpler Setup:** One git clone, easier for new developers
4. **Coordinated Versioning:** Frontend/backend versions stay in sync

**Structure:**
```
garment-erp/
├── backend/          # Express API
├── frontend/         # React SPA
├── docs/             # Documentation
├── .git/             # Single git repository
└── README.md         # Project overview
```

**Consequences:**
- ✅ Easier type sharing
- ✅ Simplified deployment
- ✅ Single source of truth
- ⚠️ Larger repository size
- ⚠️ Need clear folder boundaries

---

## 4. DATABASE DESIGN

### Entity Relationship Philosophy

**Core Entities:**
```
Users (authentication & authorization)
  ↓
Customers ← Orders ← Order Items → Styles
               ↓
          Work Orders → Production Tracking
               ↓
          Material Requirements
               ↓
          Stock Transactions ← Inventory
```

### Key Design Patterns

**1. Soft Delete Pattern**
```sql
-- All tables include
isActive BOOLEAN DEFAULT TRUE

-- Queries filter
WHERE isActive = TRUE

-- "Delete" operation
UPDATE table SET isActive = FALSE
```
**Benefit:** Preserve audit trail, enable data recovery

**2. Timestamp Pattern**
```sql
-- Auto-managed timestamps
createdAt TIMESTAMP DEFAULT NOW()
updatedAt TIMESTAMP DEFAULT NOW()  -- Auto-updated on changes
```

**3. User Tracking Pattern**
```sql
-- Track who created/modified
createdById UUID REFERENCES users(id)
updatedAt TIMESTAMP
```

**4. Approval Workflow Pattern**
```sql
-- Standard approval fields
isApproved BOOLEAN DEFAULT FALSE
approvedById UUID REFERENCES users(id)
approvedAt TIMESTAMP
```

### Table Naming Conventions

**Standard:** snake_case (PostgreSQL convention)
```
users
customers
material_categories
bill_of_materials
style_costing
```

**Why snake_case over camelCase:**
- PostgreSQL defaults to lowercase
- Avoids quoting requirements (`"tableName"` vs `table_name`)
- Standard in SQL databases

### Index Strategy

**Primary Indexes:**
- All `id` columns (UUID, auto-indexed)
- Foreign keys (indexed for JOIN performance)

**Secondary Indexes:** (Future optimization)
- `customers.code` (frequent lookups)
- `materials.code` (frequent lookups)
- `orders.orderNumber` (search by order number)
- `styles.styleCode` (search by style code)

---

## 5. API DESIGN

### REST API Principles

**RESTful Routes:**
```
Resource      | GET          | POST         | PUT           | DELETE
--------------|--------------|--------------|---------------|-------------
/customers    | List all     | Create new   | -             | -
/customers/:id| Get one      | -            | Update one    | Delete one
/orders       | List all     | Create new   | -             | -
/orders/:id   | Get one      | -            | Update one    | Cancel
```

### Response Format Standard

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "pagination": {  // If applicable
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "details": [  // For validation errors
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### API Versioning Strategy

**Current:** No versioning (v1 implicit)

**Future:** URL-based versioning when breaking changes needed
```
/api/v1/customers
/api/v2/customers  ← New version with breaking changes
```

### Authentication Flow

```
1. POST /api/auth/login
   Body: { email, password }
   Response: { token, user }

2. Subsequent requests:
   Header: Authorization: Bearer <token>

3. Token validation:
   - Middleware checks JWT signature
   - Verifies expiration
   - Extracts user info
   - Attaches to req.user
```

---

## 6. FRONTEND ARCHITECTURE

### Component Structure

```
src/
├── components/        # Reusable UI components
│   ├── ui/           # shadcn/ui components
│   └── common/       # Custom shared components
├── pages/            # Route components (full pages)
├── services/         # API client functions
├── stores/           # Zustand state management
├── types/            # TypeScript type definitions
├── utils/            # Helper functions
└── App.tsx           # Root component with routing
```

### State Management Strategy

**Zustand Store:**
```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  login: async (email, password) => {
    const { data } = await authService.login(email, password);
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
  isAuthenticated: () => !!get().token,
}));
```

**Why Zustand over Redux:**
- Simpler API (less boilerplate)
- Built-in TypeScript support
- No context provider needed
- Smaller bundle size
- Sufficient for our complexity level

### Routing Strategy

**React Router v7:**
```typescript
// App.tsx
<Routes>
  {/* Public routes */}
  <Route path="/login" element={<Login />} />

  {/* Protected routes */}
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<Dashboard />} />
    <Route path="/customers" element={<CustomerList />} />
    <Route path="/customers/new" element={<CustomerForm />} />
    {/* ... */}
  </Route>
</Routes>
```

### Form Handling Pattern

**React Hook Form + Zod:**
```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});

const onSubmit = async (data) => {
  await authService.login(data);
};
```

**Benefits:**
- Type-safe validation
- Reduced re-renders (better performance)
- Easy async validation
- Built-in error handling

---

## 7. SECURITY ARCHITECTURE

### Authentication & Authorization

**Multi-Layer Security:**
```
1. Frontend Route Guards
   ↓
2. API Authentication Middleware (JWT validation)
   ↓
3. Role-Based Access Control (RBAC)
   ↓
4. Database Row-Level Security (future enhancement)
```

### Password Security

**Hashing:** bcrypt with 10 rounds (salt)
```typescript
// Hashing on registration
const hashedPassword = await bcrypt.hash(password, 10);

// Verification on login
const isValid = await bcrypt.compare(password, hashedPassword);
```

**Why bcrypt:**
- Adaptive algorithm (can increase rounds as hardware improves)
- Built-in salting
- Slow by design (prevents brute force)

### SQL Injection Prevention

**Prisma Parameterization:**
```typescript
// Safe (Prisma handles escaping)
await prisma.users.findUnique({
  where: { email: userInput }  // Automatically parameterized
});

// Unsafe (if using raw SQL - avoided)
// await prisma.$queryRaw`SELECT * FROM users WHERE email = ${userInput}`
```

### CORS Configuration

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

### Input Validation

**Two-Layer Validation:**
1. **Frontend:** Zod schema validation (user experience)
2. **Backend:** Zod schema validation (security - never trust client)

```typescript
// Backend controller
export const createCustomer = async (req: Request, res: Response) => {
  try {
    const validatedData = CustomerSchema.parse(req.body);
    // ... proceed with validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.issues,
      });
    }
  }
};
```

---

## 8. DEPLOYMENT ARCHITECTURE

### Development Environment

```
Local Development:
├── Backend: http://localhost:5000
├── Frontend: http://localhost:5173
└── Database: postgresql://localhost:5432/garment_erp
```

**Start Commands:**
```bash
# Backend (with auto-restart)
cd backend && npm run dev

# Frontend (with HMR)
cd frontend && npm run dev
```

### Production Deployment (Planned)

**Target Architecture:**
```
┌─────────────────────┐
│   CDN Platform      │  ← Frontend (React SPA)
│   - Global CDN      │     (Vercel, Netlify, etc.)
│   - Auto SSL        │
└─────────────────────┘
          ↓ HTTPS
┌─────────────────────┐
│   Cloud Platform    │  ← Backend (Express API)
│   - Auto-deploy     │     (Cloud hosting service)
│   - Health checks   │
└─────────────────────┘
          ↓ Private Network
┌─────────────────────┐
│   PostgreSQL DB     │  ← Database (PostgreSQL)
│   - Automated       │     (Cloud-hosted)
│     backups         │
│   - Read replicas   │
└─────────────────────┘
```

**Deployment Architecture:**
- **Frontend:** Static hosting with CDN (Vercel, Netlify, or similar)
- **Backend:** Node.js hosting with Express API
- **Database:** Cloud-hosted PostgreSQL with automated backups
- **Features:** Auto-deploy, environment variables, monitoring

### CI/CD Pipeline (Future)

```
Git Push (main branch)
  ↓
GitHub Actions
  ↓
1. Run TypeScript checks
2. Run tests (when written)
3. Build frontend
4. Deploy frontend to CDN platform
5. Deploy backend to cloud platform
6. Run database migrations
7. Health check
```

### Backup Strategy

**Database Backups:**
- **Automated:** Daily backups via cloud database provider
- **Manual:** Weekly full database export (stored in cloud storage)

**Code Backups:**
- **Git Repository:** GitHub (primary)
- **Mirror:** GitLab (secondary - future)

---

## 9. PERFORMANCE CONSIDERATIONS

### Frontend Optimization

**Current:**
- Vite for fast builds
- React 19 automatic optimizations
- Lazy loading (not yet implemented)

**Future Enhancements:**
```typescript
// Code splitting
const CustomerList = lazy(() => import('./pages/CustomerList'));
const OrderForm = lazy(() => import('./pages/OrderForm'));

// Usage
<Suspense fallback={<Loading />}>
  <Route path="/customers" element={<CustomerList />} />
</Suspense>
```

### Backend Optimization

**Query Optimization:**
```typescript
// Efficient (select only needed fields)
const customers = await prisma.customers.findMany({
  select: {
    id: true,
    code: true,
    companyName: true,
  },
});

// Inefficient (loads all fields + relations)
const customers = await prisma.customers.findMany({
  include: { orders: { include: { orderItems: true } } },
});
```

**Pagination:**
```typescript
// Always paginate large datasets
const { page = 1, limit = 10 } = req.query;
const skip = (page - 1) * limit;

const [data, total] = await Promise.all([
  prisma.customers.findMany({ skip, take: limit }),
  prisma.customers.count(),
]);
```

### Database Optimization

**Indexes (to be added):**
```sql
CREATE INDEX idx_customers_code ON customers(code);
CREATE INDEX idx_materials_code ON materials(code);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
```

---

## 10. SCALABILITY CONSIDERATIONS

### Horizontal Scaling

**Stateless Backend:**
- JWT authentication (no server-side sessions)
- No in-memory state
- Can add multiple backend instances behind load balancer

**Database Scaling:**
- PostgreSQL connection pooling (Prisma handles this)
- Read replicas for reporting queries (future)
- Vertical scaling (upgrade database instance size)

### Future Scaling Path

```
Phase 1 (Current):
- Single backend instance
- Single database instance
- Serves ~50 concurrent users

Phase 2 (100-500 users):
- Multiple backend instances
- Database connection pooling
- CDN for frontend assets

Phase 3 (500+ users):
- Load balancer (provided by cloud platform)
- Database read replicas
- Redis caching layer
- Background job processing
```

---

## 11. MONITORING & OBSERVABILITY

### Logging Strategy

**Backend Logging:**
```typescript
// Current: Console.log (development)
console.log('Customer created:', customer.id);
console.error('Database error:', error);

// Future: Structured logging
logger.info('Customer created', {
  customerId: customer.id,
  userId: req.user.userId,
  timestamp: new Date(),
});
```

**Future Enhancements:**
- Winston or Pino for structured logging
- Log aggregation (Logtail, Papertrail)
- Error tracking (Sentry)

### Health Monitoring

**Backend Health Endpoint:**
```typescript
// GET /health
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    database: 'connected',  // Check Prisma connection
  });
});
```

---

## 12. TESTING STRATEGY

### Testing Pyramid

```
      /\
     /  \     E2E Tests (10%)
    /    \    - Playwright
   /------\
  /        \  Integration Tests (30%)
 /          \ - API endpoint tests
/------------\
              Unit Tests (60%)
              - Business logic
              - Utility functions
```

**Current Status:** No automated tests (technical debt)

**Future Implementation:**
```typescript
// Example unit test (Vitest)
describe('calculateMaterialCost', () => {
  it('should calculate total with wastage', () => {
    const result = calculateMaterialCost({
      quantity: 100,
      unitCost: 50,
      wastagePercent: 5,
    });
    expect(result).toBe(5250); // 100 * 50 * 1.05
  });
});

// Example E2E test (Playwright)
test('should create new customer', async ({ page }) => {
  await page.goto('/customers/new');
  await page.fill('[name="companyName"]', 'Test Customer');
  await page.fill('[name="code"]', 'CUST001');
  await page.click('button[type="submit"]');
  await expect(page.locator('.toast-success')).toBeVisible();
});
```

---

## ARCHITECTURE REVIEW CHECKLIST

### Quarterly Review Questions

- [ ] Are all API endpoints secured?
- [ ] Is database performance acceptable (<100ms queries)?
- [ ] Are backups functioning correctly?
- [ ] Is error logging capturing issues?
- [ ] Are there any new security vulnerabilities?
- [ ] Is the tech stack still current?
- [ ] Are there performance bottlenecks?
- [ ] Is documentation up-to-date?

---

## CHANGE LOG

| Date | Version | Changes | Architect |
|------|---------|---------|-----------|
| 2025-11-14 | 1.0 | Initial architecture documentation | Claude Code |

---

**Last Updated:** November 14, 2025
**Document Owner:** Kashaya Fabs Development Team
**Review Frequency:** Quarterly or before major architectural changes
