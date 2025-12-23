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
} from '../controllers/permission.controller';

const router = Router();

// All permission routes require authentication
router.use(authenticateToken);

// Admin-only routes for permission management
router.use(authorize(UserRole.ADMIN));

/**
 * @route GET /api/permissions/matrix
 * @desc Get complete permission matrix
 * @access Admin only
 */
router.get('/matrix', getPermissionMatrix);

/**
 * @route GET /api/permissions/roles
 * @desc Get all roles with descriptions
 * @access Admin only
 */
router.get('/roles', getRoles);

/**
 * @route GET /api/permissions/roles/:role
 * @desc Get permissions for a specific role
 * @access Admin only
 */
router.get('/roles/:role', getRolePermissions);

/**
 * @route GET /api/permissions/modules
 * @desc Get all modules and their permissions
 * @access Admin only
 */
router.get('/modules', getModules);

/**
 * @route GET /api/permissions/check/:role/:permission
 * @desc Check if a role has a specific permission
 * @access Admin only
 */
router.get('/check/:role/:permission', checkPermission);

export default router;
