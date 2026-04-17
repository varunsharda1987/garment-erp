/**
 * Permission Routes
 * API endpoints for permission management (admin only)
 */

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { togglePermissionSchema, bulkUpdatePermissionsSchema } from '../schemas/permission.schema';
import {
  getPermissionMatrix,
  getRoles,
  getRolePermissions,
  getModules,
  checkPermission,
  togglePermission,
  bulkUpdatePermissions,
  resetToDefaults,
  getPermissionDefinitions,
  getAuditLog,
  seedPermissions,
} from '../controllers/permission.controller';

const router = Router();

// All permission routes require authentication
router.use(authenticateToken);

// Admin-only routes for permission management
router.use(authorize(UserRole.ADMIN));

// ============================================
// READ ENDPOINTS
// ============================================

/**
 * @route GET /api/permissions/matrix
 * @desc Get complete permission matrix (DB-backed)
 */
router.get('/matrix', asyncHandler(getPermissionMatrix));

/**
 * @route GET /api/permissions/roles
 * @desc Get all roles with descriptions
 */
router.get('/roles', asyncHandler(getRoles));

/**
 * @route GET /api/permissions/roles/:role
 * @desc Get permissions for a specific role
 */
router.get('/roles/:role', asyncHandler(getRolePermissions));

/**
 * @route GET /api/permissions/modules
 * @desc Get all modules and their permissions
 */
router.get('/modules', asyncHandler(getModules));

/**
 * @route GET /api/permissions/definitions
 * @desc Get permission definitions (metadata)
 */
router.get('/definitions', asyncHandler(getPermissionDefinitions));

/**
 * @route GET /api/permissions/check/:role/:permission
 * @desc Check if a role has a specific permission
 */
router.get('/check/:role/:permission', asyncHandler(checkPermission));

/**
 * @route GET /api/permissions/audit-log
 * @desc Get permission change audit log
 */
router.get('/audit-log', asyncHandler(getAuditLog));

// ============================================
// WRITE ENDPOINTS
// ============================================

/**
 * @route PATCH /api/permissions/toggle
 * @desc Toggle single permission
 * @body { role: UserRole, permissionKey: string, allowed: boolean }
 */
router.patch('/toggle', validateBody(togglePermissionSchema), asyncHandler(togglePermission));

/**
 * @route POST /api/permissions/bulk-update
 * @desc Bulk update multiple permissions
 * @body { updates: [{ role, permissionKey, allowed }] }
 */
router.post('/bulk-update', validateBody(bulkUpdatePermissionsSchema), asyncHandler(bulkUpdatePermissions));

/**
 * @route POST /api/permissions/reset-defaults
 * @desc Reset all permissions to config defaults
 */
router.post('/reset-defaults', asyncHandler(resetToDefaults));

/**
 * @route POST /api/permissions/seed
 * @desc Seed permissions from config (one-time setup)
 */
router.post('/seed', asyncHandler(seedPermissions));

export default router;
