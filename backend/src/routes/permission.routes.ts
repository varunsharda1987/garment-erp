/**
 * Permission Routes
 * API endpoints for permission management (admin only)
 */

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
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
router.get('/matrix', getPermissionMatrix);

/**
 * @route GET /api/permissions/roles
 * @desc Get all roles with descriptions
 */
router.get('/roles', getRoles);

/**
 * @route GET /api/permissions/roles/:role
 * @desc Get permissions for a specific role
 */
router.get('/roles/:role', getRolePermissions);

/**
 * @route GET /api/permissions/modules
 * @desc Get all modules and their permissions
 */
router.get('/modules', getModules);

/**
 * @route GET /api/permissions/definitions
 * @desc Get permission definitions (metadata)
 */
router.get('/definitions', getPermissionDefinitions);

/**
 * @route GET /api/permissions/check/:role/:permission
 * @desc Check if a role has a specific permission
 */
router.get('/check/:role/:permission', checkPermission);

/**
 * @route GET /api/permissions/audit-log
 * @desc Get permission change audit log
 */
router.get('/audit-log', getAuditLog);

// ============================================
// WRITE ENDPOINTS
// ============================================

/**
 * @route PATCH /api/permissions/toggle
 * @desc Toggle single permission
 * @body { role: UserRole, permissionKey: string, allowed: boolean }
 */
router.patch('/toggle', togglePermission);

/**
 * @route POST /api/permissions/bulk-update
 * @desc Bulk update multiple permissions
 * @body { updates: [{ role, permissionKey, allowed }] }
 */
router.post('/bulk-update', bulkUpdatePermissions);

/**
 * @route POST /api/permissions/reset-defaults
 * @desc Reset all permissions to config defaults
 */
router.post('/reset-defaults', resetToDefaults);

/**
 * @route POST /api/permissions/seed
 * @desc Seed permissions from config (one-time setup)
 */
router.post('/seed', seedPermissions);

export default router;
