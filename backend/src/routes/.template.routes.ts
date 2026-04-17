/**
 * [FEATURE_NAME] Routes Template
 *
 * HOW TO USE THIS TEMPLATE:
 * 1. Copy this file and rename it to match your feature (e.g., product.routes.ts)
 * 2. Replace [FEATURE_NAME] with your actual feature name
 * 3. Replace [feature] with the lowercase version
 * 4. Create schema file: backend/src/schemas/[feature].schema.ts
 * 5. Import your controller and schemas
 * 6. Define your routes following the patterns below
 * 7. DO NOT modify the authentication import or usage pattern
 */

import { Router } from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
// import * as [feature]Controller from '../controllers/[feature].controller';
// import {
//   create[Feature]Schema,
//   update[Feature]Schema,
//   [feature]QuerySchema,
// } from '../schemas/[feature].schema';

const router = Router();

// ============================================
// AUTHENTICATION SETUP
// ============================================
// IMPORTANT: Always use authenticateToken (not 'authenticate' or any alias)
// This applies authentication to ALL routes in this file
router.use(authenticateToken);

// ============================================
// PUBLIC ROUTES (if needed)
// ============================================
// If you need public routes, define them BEFORE router.use(authenticateToken)
// Example:
// router.get('/public-endpoint', controller.publicMethod);

// ============================================
// AUTHENTICATED ROUTES WITH ZOD VALIDATION
// ============================================

// GET - Retrieve all items (with optional filters)
// router.get('/', validateQuery([feature]QuerySchema), asyncHandler([feature]Controller.getAll));

// GET - Retrieve statistics/summary
// router.get('/statistics', asyncHandler([feature]Controller.getStatistics));

// GET - Retrieve single item by ID
// router.get('/:id', asyncHandler([feature]Controller.getById));

// POST - Create new item (MUST use validateBody with Zod schema)
// router.post('/', validateBody(create[Feature]Schema), asyncHandler([feature]Controller.create));

// PUT - Update existing item (MUST use validateBody with Zod schema)
// router.put('/:id', validateBody(update[Feature]Schema), asyncHandler([feature]Controller.update));

// PATCH - Partial update (MUST use validateBody with Zod schema)
// router.patch('/:id', validateBody(update[Feature]Schema), asyncHandler([feature]Controller.partialUpdate));

// DELETE - Delete item
// router.delete('/:id', asyncHandler([feature]Controller.delete));

// ============================================
// ROLE-BASED AUTHORIZATION EXAMPLES
// ============================================
// If specific routes need role-based access:

// Admin only routes
// router.delete('/admin/:id', authorize('ADMIN'), asyncHandler([feature]Controller.adminDelete));

// Multiple roles allowed
// router.post('/approve/:id', authorize('ADMIN', 'MANAGER'), validateBody(approveSchema), asyncHandler([feature]Controller.approve));

export default router;

/*
 * AUTHENTICATION STANDARDS:
 *
 * ✅ CORRECT:
 * import { authenticateToken } from '../middleware/auth.middleware';
 * router.use(authenticateToken);
 *
 * ❌ INCORRECT:
 * import { authenticateToken as authenticate } from '../middleware/auth.middleware';
 * router.use(authenticate);
 *
 * ❌ INCORRECT:
 * import { authenticate } from '../middleware/auth.middleware';
 * router.use(authenticate);
 *
 * PATTERNS:
 *
 * Pattern A - Global Protection (RECOMMENDED for most routes):
 * router.use(authenticateToken);
 *
 * Pattern B - Per-Route Protection (use only if you need mixed public/private):
 * router.get('/', authenticateToken, controller.method);
 *
 * Pattern C - Role-Based Authorization:
 * router.post('/', authenticateToken, authorize('ADMIN', 'MANAGER'), controller.method);
 *
 * Note: Pattern C can also use router.use(authenticateToken) globally, then just
 * add authorize() to specific routes that need it.
 */
