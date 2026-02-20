# Security & User Management Guide

**Version:** 1.0
**Last Updated:** February 6, 2026
**Controllers:** `auth.controller.ts`, `user.controller.ts`, `permission.controller.ts`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication System](#2-authentication-system)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [User Management](#4-user-management)
5. [API Reference](#5-api-reference)
6. [Security Features](#6-security-features)
7. [Integration Guide](#7-integration-guide)
8. [Best Practices](#8-best-practices)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

The Garment ERP system implements a comprehensive role-based access control (RBAC) security model with JWT authentication. The system supports **9 distinct user roles**, each with granular permissions across **60+ feature modules**.

### 1.1 Key Components

| Component | File | Purpose |
|-----------|------|---------|
| **Authentication** | `auth.controller.ts` | User registration, login, token management |
| **User Management** | `user.controller.ts` | CRUD operations for user accounts |
| **Permissions** | `permission.controller.ts` | Permission matrix and role information |
| **Middleware** | `auth.middleware.ts` | JWT verification, role-based authorization |
| **Security** | `security.middleware.ts` | Rate limiting, input sanitization |

### 1.2 Security Stack

```
┌─────────────────────────────────────┐
│  Frontend (React + Tanstack Query)  │
│  - JWT storage (localStorage)       │
│  - Auth context provider            │
│  - Protected routes                 │
└─────────────────┬───────────────────┘
                  │ HTTP + Bearer Token
┌─────────────────┴───────────────────┐
│  Middleware Layer                   │
│  - authenticateToken()              │
│  - authorize(roles)                 │
│  - authLimiter (rate limiting)      │
└─────────────────┬───────────────────┘
                  │ req.user injected
┌─────────────────┴───────────────────┐
│  Controllers                        │
│  - auth.controller.ts               │
│  - user.controller.ts               │
│  - permission.controller.ts         │
└─────────────────┬───────────────────┘
                  │ Prisma ORM
┌─────────────────┴───────────────────┐
│  Database (PostgreSQL)              │
│  - users table                      │
│  - Password: bcrypt hashed          │
└─────────────────────────────────────┘
```

---

## 2. Authentication System

### 2.1 User Registration

**Endpoint:** `POST /api/auth/register`

**Request:**
```typescript
{
  email: string;        // Valid email format
  password: string;     // Minimum 8 characters
  name: string;         // Full name (split into firstName/lastName)
  role?: UserRole;      // Optional, defaults to ADMIN
}
```

**Response:**
```typescript
{
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  token: string;  // JWT token (valid for 7 days)
}
```

**Validation:**
- Email must be unique
- Password strength enforced by Zod schema
- Rate limited: 5 requests per 15 minutes per IP

**Password Hashing:**
```typescript
// Backend automatically hashes passwords with bcrypt
const hashedPassword = await bcrypt.hash(password, 10);  // 10 salt rounds
```

### 2.2 User Login

**Endpoint:** `POST /api/auth/login`

**Request:**
```typescript
{
  email: string;
  password: string;
}
```

**Response:**
```typescript
{
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
  token: string;
}
```

**Security:**
- Constant-time password comparison via bcrypt
- Inactive users (isActive = false) cannot log in
- Failed login attempts logged
- Rate limited: 5 requests per 15 minutes per IP

### 2.3 Get Current User

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```typescript
{
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: UserRole;
    department: string | null;
    isActive: boolean;
    lastLogin: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }
}
```

### 2.4 JWT Token Structure

**Payload:**
```typescript
{
  userId: string;
  email: string;
  role: UserRole;
  iat: number;    // Issued at timestamp
  exp: number;    // Expiration timestamp (iat + 7 days)
}
```

**Token Configuration:**
- **Algorithm:** HS256 (HMAC with SHA-256)
- **Expiration:** 7 days from issuance
- **Secret:** Environment variable `JWT_SECRET`
- **Header Format:** `Authorization: Bearer <token>`

---

## 3. User Roles & Permissions

### 3.1 Available Roles

The system supports **9 user roles**, each with specific permissions:

| Role | Code | Description | User Count (Typical) |
|------|------|-------------|---------------------|
| **Administrator** | `ADMIN` | Full system access, user management | 2-3 |
| **Merchandiser** | `MERCHANDISER` | Order planning, BOM, MRP, cost sheets | 5-10 |
| **Production Manager** | `PRODUCTION_MANAGER` | Manufacturing, work orders, samples | 3-5 |
| **Sales** | `SALES` | Orders, styles, quotations | 5-8 |
| **Inventory** | `INVENTORY` | Stock management, dispatch, GRN | 3-5 |
| **Accounts** | `ACCOUNTS` | Financials, invoices, payments | 2-4 |
| **Quality** | `QUALITY` | Testing, finishing, sample approval | 2-3 |
| **Purchase** | `PURCHASE` | Material procurement, supplier management | 3-5 |
| **Factory Supervisor** | `FACTORY_SUPERVISOR` | Production floor operations | 10-15 |

### 3.2 Permission Matrix

Permissions are defined in [backend/src/config/permissions.config.ts](../backend/src/config/permissions.config.ts:1). Each feature module specifies allowed roles.

**Example Permission Configuration:**
```typescript
export const PERMISSIONS = {
  // Dashboard - Available to all authenticated users
  dashboard: ALL_ROLES,

  // Orders - Available to specific roles
  orders: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.SALES,
    UserRole.PRODUCTION_MANAGER,
  ],

  // Admin-only features
  userManagement: [UserRole.ADMIN],

  // Production features
  manufacturing: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
  ],
};
```

### 3.3 Permission Categories

#### Core Modules (Available to Most Roles)
- `dashboard` - All roles
- `processGuide` - All roles
- `aiAssistant` - All roles

#### Planning & Design
- `styles` - ADMIN, MERCHANDISER, PRODUCTION_MANAGER, SALES
- `cadPlanning` - ADMIN, MERCHANDISER, PRODUCTION_MANAGER
- `costSheets` - ADMIN, MERCHANDISER, ACCOUNTS

#### Order Management
- `orders` - ADMIN, MERCHANDISER, SALES, PRODUCTION_MANAGER
- `workOrders` - ADMIN, MERCHANDISER, PRODUCTION_MANAGER, FACTORY_SUPERVISOR
- `bom` - ADMIN, MERCHANDISER, PRODUCTION_MANAGER
- `mrp` - ADMIN, MERCHANDISER, PRODUCTION_MANAGER, INVENTORY, PURCHASE

#### Manufacturing
- `cutting` - ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR
- `stitching` - ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR
- `finishing` - ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR, QUALITY
- `dispatch` - ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR, INVENTORY

#### Quality & Testing
- `testing` - ADMIN, QUALITY, PRODUCTION_MANAGER, MERCHANDISER
- `samples` - ADMIN, MERCHANDISER, PRODUCTION_MANAGER, QUALITY

#### Inventory & Procurement
- `inventoryDashboard` - ADMIN, INVENTORY, PRODUCTION_MANAGER
- `procurement` - ADMIN, PURCHASE, INVENTORY, MERCHANDISER
- `grn` - ADMIN, INVENTORY, PURCHASE

#### Financial
- `accounting` - ADMIN, ACCOUNTS
- `invoices` - ADMIN, ACCOUNTS, SALES
- `payments` - ADMIN, ACCOUNTS

#### Administration
- `userManagement` - ADMIN only
- `companySettings` - ADMIN only
- `masterData` - ADMIN, MERCHANDISER, PRODUCTION_MANAGER

### 3.4 Role Configuration

Each role has metadata defined in `ROLE_CONFIG`:

```typescript
export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  ADMIN: {
    name: 'Administrator',
    description: 'Full system access and user management',
    color: '#dc2626',      // Red
    level: 0,              // Highest level
  },
  MERCHANDISER: {
    name: 'Merchandiser',
    description: 'Order planning, BOM, MRP, cost sheets',
    color: '#2563eb',      // Blue
    level: 1,
  },
  PRODUCTION_MANAGER: {
    name: 'Production Manager',
    description: 'Manufacturing and production oversight',
    color: '#16a34a',      // Green
    level: 1,
  },
  // ... etc
};
```

---

## 4. User Management

### 4.1 List Users (Paginated)

**Endpoint:** `GET /api/users`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `search` | string | - | Search in firstName, lastName, email |

**Response:**
```typescript
{
  data: User[];  // Array of users (password excluded)
  pagination: {
    page: number;
    limit: number;
    total: number;       // Total user count
    totalPages: number;  // Math.ceil(total / limit)
  }
}
```

**Example:**
```bash
GET /api/users?page=1&limit=20&search=john
```

### 4.2 Get User by ID

**Endpoint:** `GET /api/users/:id`

**Response:**
```typescript
{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  department: string | null;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.3 Create User

**Endpoint:** `POST /api/users`

**Authorization:** Admin only

**Request:**
```typescript
{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  department?: string;
  isActive?: boolean;  // Defaults to true
}
```

**Response:**
```typescript
{
  message: "User created successfully";
  user: User;
}
```

### 4.4 Update User

**Endpoint:** `PUT /api/users/:id`

**Authorization:** Self or Admin

**Request:**
```typescript
{
  firstName?: string;
  lastName?: string;
  phone?: string;
  department?: string;
  isActive?: boolean;  // Admin only
}
```

**Logic:**
- Users can update their own profile (except role and isActive)
- Admins can update any user
- Role changes must use separate endpoint

### 4.5 Update User Role

**Endpoint:** `PUT /api/users/:id/role`

**Authorization:** Admin only

**Request:**
```typescript
{
  role: UserRole;
}
```

**Response:**
```typescript
{
  message: "User role updated successfully";
  user: User;
}
```

### 4.6 Change Password

**Endpoint:** `PUT /api/users/:id/change-password`

**Authorization:** Self only

**Request:**
```typescript
{
  currentPassword: string;
  newPassword: string;
}
```

**Validation:**
- Current password must match
- New password must meet strength requirements
- Automatically hashes new password with bcrypt

### 4.7 Delete User (Soft Delete)

**Endpoint:** `DELETE /api/users/:id`

**Authorization:** Admin only

**Behavior:**
- Sets `isActive = false` (soft delete)
- User cannot log in but data is preserved
- Cannot delete self

---

## 5. API Reference

### 5.1 Authentication Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login user |
| GET | `/api/auth/me` | Required | Get current user |

### 5.2 User Management Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Required | List users (paginated) |
| GET | `/api/users/:id` | Required | Get user by ID |
| POST | `/api/users` | Admin | Create user |
| PUT | `/api/users/:id` | Self/Admin | Update user |
| PUT | `/api/users/:id/role` | Admin | Update user role |
| PUT | `/api/users/:id/change-password` | Self | Change password |
| DELETE | `/api/users/:id` | Admin | Deactivate user |

### 5.3 Permission Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/permissions/matrix` | Required | Get full permission matrix |
| GET | `/api/permissions/roles` | Required | Get all roles with metadata |
| GET | `/api/permissions/roles/:role` | Required | Get permissions for specific role |

### 5.4 Response Formats

#### Success Response (2xx)
```typescript
{
  // Data varies by endpoint
  user?: User;
  data?: any[];
  token?: string;
  pagination?: PaginationMetadata;
}
```

#### Error Response (4xx/5xx)
```typescript
{
  error: string;     // Error type (e.g., "Validation Error")
  message: string;   // Human-readable message
  details?: any;     // Optional validation details
}
```

---

## 6. Security Features

### 6.1 Password Security

**Hashing Algorithm:** bcrypt with 10 salt rounds

**Strength Requirements (Zod Schema):**
```typescript
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number'),
  name: z.string().min(2),
});
```

**Password Verification:**
```typescript
const isMatch = await bcrypt.compare(password, user.password);
// Constant-time comparison prevents timing attacks
```

### 6.2 JWT Security

**Token Generation:**
```typescript
import jwt from 'jsonwebtoken';

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: '7d',
  });
};
```

**Token Verification (Middleware):**
```typescript
export const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;  // Inject user into request
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
```

### 6.3 Rate Limiting

**Auth Limiter (Registration & Login):**
```typescript
import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 requests per window
  message: 'Too many attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
```

**Applied to:**
- `POST /api/auth/register`
- `POST /api/auth/login`

### 6.4 Input Validation

**Zod Schema Validation:**
- All auth endpoints use `validateBody(schema)` middleware
- Automatic sanitization and type coercion
- Detailed validation error messages

**Example Schema:**
```typescript
export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, 'Password required'),
});
```

### 6.5 Role-Based Authorization

**Middleware:**
```typescript
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
```

**Usage:**
```typescript
router.post('/users', authorize(UserRole.ADMIN), createUser);
router.delete('/users/:id', authorize(UserRole.ADMIN), deleteUser);
```

### 6.6 Additional Security Measures

| Feature | Implementation |
|---------|---------------|
| **HTTPS Enforcement** | Production deployment requires HTTPS |
| **CORS Configuration** | Whitelist allowed origins |
| **Helmet.js** | Security headers (XSS, clickjacking protection) |
| **SQL Injection Protection** | Prisma ORM with parameterized queries |
| **XSS Protection** | Input sanitization, Content-Security-Policy headers |
| **Password in Transit** | Always transmitted over HTTPS |
| **Session Management** | Stateless JWT (no server-side sessions) |

---

## 7. Integration Guide

### 7.1 Frontend Integration

**Auth Context Provider:**
```typescript
import { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  );

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('token', data.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

**Protected Route Component:**
```typescript
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};
```

**API Client with Auth:**
```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
});

// Request interceptor - add auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 7.2 Permission-Based UI

**Check Permission:**
```typescript
import { useAuth } from './AuthContext';
import { PERMISSIONS } from '@/config/permissions';

export const usePermission = (feature: string): boolean => {
  const { user } = useAuth();

  if (!user) return false;

  const allowedRoles = PERMISSIONS[feature];
  return allowedRoles?.includes(user.role) || false;
};
```

**Conditional Rendering:**
```tsx
import { usePermission } from '@/hooks/usePermission';

export const UserManagementButton: React.FC = () => {
  const canManageUsers = usePermission('userManagement');

  if (!canManageUsers) return null;

  return (
    <Button onClick={() => navigate('/users')}>
      Manage Users
    </Button>
  );
};
```

---

## 8. Best Practices

### 8.1 Authentication

✅ **DO:**
- Store JWT in `localStorage` for web apps
- Always use HTTPS in production
- Implement token refresh before expiration (if needed)
- Log out users on 401 errors
- Clear tokens on logout

❌ **DON'T:**
- Store passwords in plain text (ever!)
- Hardcode JWT_SECRET in source code
- Use weak passwords (enforce validation)
- Allow unlimited login attempts
- Share tokens between users

### 8.2 Authorization

✅ **DO:**
- Check permissions on both frontend AND backend
- Use `authorize()` middleware for protected routes
- Grant minimum necessary permissions
- Regularly audit user roles
- Deactivate users instead of deleting (soft delete)

❌ **DON'T:**
- Rely solely on frontend permission checks
- Give all users Admin access
- Hardcode role checks in business logic
- Skip authorization for "internal" endpoints

### 8.3 Password Management

✅ **DO:**
- Enforce strong password requirements
- Hash passwords with bcrypt (never MD5/SHA1)
- Use at least 10 salt rounds
- Implement "forgot password" flow (if needed)
- Require current password for password changes

❌ **DON'T:**
- Store passwords reversibly encrypted
- Use custom hashing algorithms
- Allow password reuse without verification
- Display password hints

### 8.4 Session Management

✅ **DO:**
- Set reasonable token expiration (7 days)
- Implement automatic logout on inactivity (optional)
- Clear tokens on logout
- Validate tokens on every protected request

❌ **DON'T:**
- Use tokens that never expire
- Store sensitive data in JWT payload
- Trust expired tokens

---

## 9. Troubleshooting

### 9.1 Common Issues

#### "Invalid token" Error (403)

**Causes:**
- Token expired (after 7 days)
- JWT_SECRET mismatch between environments
- Malformed token

**Solutions:**
```bash
# Check token expiration
import jwt from 'jsonwebtoken';
const decoded = jwt.decode(token);
console.log('Expires:', new Date(decoded.exp * 1000));

# Verify JWT_SECRET is set
echo $JWT_SECRET  # Should not be empty
```

#### "Too many attempts" Error (429)

**Cause:** Rate limit exceeded (5 requests in 15 minutes)

**Solutions:**
- Wait 15 minutes before retrying
- Check for accidental retry loops
- Consider increasing limit for testing

#### "User not found" on Login

**Causes:**
- Email doesn't exist in database
- User is inactive (isActive = false)

**Solutions:**
```sql
-- Check user status
SELECT id, email, "isActive" FROM users WHERE email = 'user@example.com';

-- Reactivate user
UPDATE users SET "isActive" = true WHERE email = 'user@example.com';
```

#### "Insufficient permissions" Error (403)

**Cause:** User's role doesn't have access to endpoint

**Solutions:**
```typescript
// Check user's permissions
GET /api/permissions/roles/MERCHANDISER

// Update user role
PUT /api/users/:id/role
{
  "role": "ADMIN"
}
```

### 9.2 Debug Mode

**Enable Authentication Logging:**
```typescript
// backend/src/middleware/auth.middleware.ts
export const authenticateToken = (req, res, next) => {
  console.log('Auth header:', req.headers.authorization);
  // ... rest of middleware
};
```

**Test Token Validity:**
```typescript
import jwt from 'jsonwebtoken';

const token = 'your-jwt-token';
try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!);
  console.log('Token valid:', decoded);
} catch (error) {
  console.error('Token invalid:', error.message);
}
```

---

## 10. Related Documentation

- [PROJECT_BIBLE.md](PROJECT_BIBLE.md) - Complete system overview
- [GLOSSARY.md](GLOSSARY.md) - Term definitions
- Prisma Schema: `backend/prisma/schema.prisma` - `users` table definition
- Permissions Config: [backend/src/config/permissions.config.ts](../backend/src/config/permissions.config.ts:1)

---

## 11. Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-06 | 1.0 | Initial security guide creation |

