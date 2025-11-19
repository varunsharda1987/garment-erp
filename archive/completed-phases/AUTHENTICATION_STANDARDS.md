# Authentication Standards

## Overview

This document defines the authentication and authorization standards for the Kashaya Fabs Garment ERP backend API. Following these standards ensures consistent security across all endpoints and prevents common authentication-related bugs.

---

## Table of Contents

1. [Middleware Functions](#middleware-functions)
2. [Standard Import Pattern](#standard-import-pattern)
3. [Route Protection Patterns](#route-protection-patterns)
4. [Role-Based Authorization](#role-based-authorization)
5. [Common Mistakes to Avoid](#common-mistakes-to-avoid)
6. [Enforcement](#enforcement)
7. [Quick Reference](#quick-reference)

---

## Middleware Functions

### Location
All authentication middleware is defined in:
```
backend/src/middleware/auth.middleware.ts
```

### Available Functions

#### `authenticateToken`
- **Purpose**: Validates JWT tokens and authenticates users
- **Usage**: Required for all protected routes
- **Effect**: Adds `user` object to request with user ID, email, and role
- **Standard Name**: ALWAYS use `authenticateToken` (no aliases allowed)

#### `authorize(...roles)`
- **Purpose**: Restricts access to specific user roles
- **Usage**: Optional, for role-based access control
- **Parameters**: One or more role names (e.g., 'ADMIN', 'MANAGER', 'USER')
- **Requirement**: Must be used AFTER `authenticateToken`

---

## Standard Import Pattern

### ✅ CORRECT

```typescript
import { authenticateToken } from '../middleware/auth.middleware';
```

**With authorization:**
```typescript
import { authenticateToken, authorize } from '../middleware/auth.middleware';
```

### ❌ INCORRECT - Do Not Use Aliases

```typescript
// ❌ DO NOT DO THIS
import { authenticateToken as authenticate } from '../middleware/auth.middleware';

// ❌ DO NOT DO THIS
import { authenticate } from '../middleware/auth.middleware';
```

**Why?** Using aliases creates inconsistency across the codebase and makes code harder to maintain and review.

---

## Route Protection Patterns

### Pattern A: Global Protection (RECOMMENDED)

Use this pattern when ALL routes in the file require authentication.

```typescript
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as controller from '../controllers/example.controller';

const router = Router();

// Apply authentication to ALL routes
router.use(authenticateToken);

// All routes below are automatically protected
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router;
```

**Advantages:**
- Clean and DRY (Don't Repeat Yourself)
- Less error-prone
- Easy to audit
- Used by 26+ route files in this project

**Use When:**
- All routes in the file need authentication
- Most CRUD endpoints
- Admin or management modules

### Pattern B: Per-Route Protection

Use this pattern only when you have a MIX of public and protected routes.

```typescript
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as controller from '../controllers/example.controller';

const router = Router();

// Public routes (no authentication)
router.get('/public', controller.publicEndpoint);
router.post('/webhook', controller.webhookHandler);

// Protected routes (authentication required)
router.get('/private', authenticateToken, controller.privateEndpoint);
router.post('/create', authenticateToken, controller.create);

export default router;
```

**Advantages:**
- Flexibility for mixed public/private endpoints
- Explicit protection per route

**Use When:**
- You have public endpoints (login, register, webhooks)
- Only a few routes need protection
- Building an auth service

**Example from project:** `backend/src/routes/auth.routes.ts`

---

## Role-Based Authorization

### Basic Usage

```typescript
import { Router } from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import * as controller from '../controllers/example.controller';

const router = Router();

// Global authentication
router.use(authenticateToken);

// Public route (all authenticated users)
router.get('/', controller.getAll);

// Admin only
router.delete('/:id', authorize('ADMIN'), controller.delete);

// Multiple roles allowed
router.post('/approve/:id',
  authorize('ADMIN', 'MANAGER'),
  controller.approve
);

export default router;
```

### Available Roles

The system supports the following roles (defined in Prisma schema):
- `ADMIN` - Full system access
- `MANAGER` - Management-level access
- `USER` - Standard user access

**Note:** Roles are defined in `backend/prisma/schema.prisma` in the `UserRole` enum.

### Authorization Best Practices

1. **Always authenticate first**: `authorize()` requires `authenticateToken` to run first
2. **Be specific**: Only add role restrictions where truly needed
3. **Document expectations**: Comment why specific roles are required
4. **Test thoroughly**: Verify both allowed and denied access scenarios

---

## Common Mistakes to Avoid

### 1. Using Import Aliases

❌ **WRONG:**
```typescript
import { authenticateToken as authenticate } from '../middleware/auth.middleware';
router.use(authenticate);
```

✅ **CORRECT:**
```typescript
import { authenticateToken } from '../middleware/auth.middleware';
router.use(authenticateToken);
```

**Impact:** Found in `fabric-greige.routes.ts` (fixed on Jan 19, 2025)

### 2. Forgetting Authentication Entirely

❌ **WRONG:**
```typescript
const router = Router();
router.get('/', controller.getAll); // Unprotected!
```

✅ **CORRECT:**
```typescript
const router = Router();
router.use(authenticateToken);
router.get('/', controller.getAll); // Protected
```

**Impact:** Found in `ai.routes.ts` - 3 endpoints were unprotected (fixed on Jan 19, 2025)

### 3. Wrong Order of Middleware

❌ **WRONG:**
```typescript
router.post('/', authorize('ADMIN'), authenticateToken, controller.create);
```

✅ **CORRECT:**
```typescript
router.post('/', authenticateToken, authorize('ADMIN'), controller.create);
```

**Why?** `authorize()` needs the `user` object added by `authenticateToken`.

### 4. Mixing Patterns Unnecessarily

❌ **INCONSISTENT:**
```typescript
router.use(authenticateToken); // Global protection

// Then also adding it per-route (redundant)
router.get('/', authenticateToken, controller.getAll);
```

✅ **CONSISTENT:**
```typescript
router.use(authenticateToken); // Global protection

// No need to repeat
router.get('/', controller.getAll);
```

---

## Enforcement

### ESLint Rules

The project includes ESLint rules to prevent authentication issues:

**File:** `backend/.eslintrc.json`

**Rules:**
1. **No import aliases**: Prevents renaming `authenticateToken` or `authorize` on import
2. **Import name restrictions**: Only allows importing `authenticateToken` and `authorize` from auth middleware

**To run linter:**
```bash
npm run lint
```

### Code Review Checklist

When reviewing new route files:
- [ ] Imports `authenticateToken` without alias
- [ ] Uses `router.use(authenticateToken)` for global protection OR applies per-route
- [ ] All sensitive endpoints are protected
- [ ] `authorize()` is used correctly (after `authenticateToken`)
- [ ] No redundant authentication (mixing global + per-route unnecessarily)

### Template File

Use the route template for new route files:
```
backend/src/routes/.template.routes.ts
```

This template includes:
- Correct import statements
- Authentication setup patterns
- Commented examples
- Best practice guidelines

---

## Quick Reference

### Standard Route File Structure

```typescript
// 1. Imports
import { Router } from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import * as controller from '../controllers/feature.controller';

// 2. Router initialization
const router = Router();

// 3. Global authentication (if all routes need it)
router.use(authenticateToken);

// 4. Define routes
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', authorize('ADMIN'), controller.create);
router.put('/:id', controller.update);
router.delete('/:id', authorize('ADMIN'), controller.delete);

// 5. Export
export default router;
```

### Common Route Patterns

| Pattern | Code | Use Case |
|---------|------|----------|
| All routes protected | `router.use(authenticateToken);` | Most CRUD APIs |
| Mixed public/private | Per-route `authenticateToken` | Auth endpoints |
| Admin only | `authorize('ADMIN')` | Delete, sensitive operations |
| Multiple roles | `authorize('ADMIN', 'MANAGER')` | Approval workflows |

### Project Statistics (as of Jan 19, 2025)

- **Total route files**: 28
- **Using `authenticateToken` standard**: 28 (100%)
- **Using global protection pattern**: 26 files (93%)
- **Using per-route pattern**: 2 files (7%)
- **Files with role authorization**: 5 files

---

## Resources

### Related Files
- Middleware definition: `backend/src/middleware/auth.middleware.ts`
- Type definitions: `backend/src/types/auth.types.ts`
- User roles schema: `backend/prisma/schema.prisma`
- Route template: `backend/src/routes/.template.routes.ts`
- ESLint config: `backend/.eslintrc.json`

### Testing Authentication
- Test authentication: `backend/test-auth.js`
- Run test: `node backend/test-auth.js`

---

## Change History

| Date | Change | Impact |
|------|--------|--------|
| Jan 19, 2025 | Standardized all routes to `authenticateToken` | Fixed naming inconsistency in fabric-greige.routes.ts |
| Jan 19, 2025 | Added authentication to AI routes | Secured 3 previously unprotected endpoints |
| Jan 19, 2025 | Created ESLint rules | Prevents future naming issues |
| Jan 19, 2025 | Created route template | Provides standard for new routes |
| Jan 19, 2025 | Created this documentation | Defines authentication standards |

---

## Questions?

If you have questions about authentication standards:
1. Review this document
2. Check the template file: `backend/src/routes/.template.routes.ts`
3. Look at reference implementations in `backend/src/routes/`
4. Run ESLint to catch common issues: `npm run lint`

**Remember:** Consistency is key. When in doubt, use Pattern A (global protection) and follow the template.
