// User management routes - Updated 2026-02-24
import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserRole,
  deleteUser,
  permanentDeleteUser,
  changePassword,
  getPendingUsers,
  approveUser,
  rejectUser,
} from '../controllers/user.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createUserSchema,
  updateUserSchema,
  updateUserRoleSchema,
  changePasswordSchema,
  approveUserSchema,
  rejectUserSchema,
  userQuerySchema,
} from '../schemas/user.schema';
import { idParamSchema } from '../schemas/common.schema';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/users
 * @desc    Get all users (paginated)
 * @access  Protected - All authenticated users
 */
router.get('/', validateQuery(userQuerySchema), asyncHandler(getAllUsers));

/**
 * @route   GET /api/users/pending
 * @desc    Get users pending approval
 * @access  Protected - Admin only
 */
router.get('/pending', authorize(UserRole.ADMIN), asyncHandler(getPendingUsers));

/**
 * @route   POST /api/users/:id/approve
 * @desc    Approve user registration
 * @access  Protected - Admin only
 */
router.post(
  '/:id/approve',
  authorize(UserRole.ADMIN),
  validateParams(idParamSchema),
  validateBody(approveUserSchema),
  asyncHandler(approveUser)
);

/**
 * @route   POST /api/users/:id/reject
 * @desc    Reject user registration
 * @access  Protected - Admin only
 */
router.post(
  '/:id/reject',
  authorize(UserRole.ADMIN),
  validateParams(idParamSchema),
  validateBody(rejectUserSchema),
  asyncHandler(rejectUser)
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Protected - All authenticated users
 */
router.get('/:id', validateParams(idParamSchema), asyncHandler(getUserById));

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Protected - Admin only
 */
router.post('/', authorize(UserRole.ADMIN), validateBody(createUserSchema), asyncHandler(createUser));

/**
 * @route   PUT /api/users/:id
 * @desc    Update user (users can update themselves, admins can update anyone)
 * @access  Protected - Self or Admin
 */
router.put('/:id', validateParams(idParamSchema), validateBody(updateUserSchema), asyncHandler(updateUser));

/**
 * @route   PUT /api/users/:id/role
 * @desc    Update user role
 * @access  Protected - Admin only
 */
router.put(
  '/:id/role',
  authorize(UserRole.ADMIN),
  validateParams(idParamSchema),
  validateBody(updateUserRoleSchema),
  asyncHandler(updateUserRole)
);

/**
 * @route   PUT /api/users/:id/change-password
 * @desc    Change user password
 * @access  Protected - Self only
 */
router.put(
  '/:id/change-password',
  validateParams(idParamSchema),
  validateBody(changePasswordSchema),
  asyncHandler(changePassword)
);

/**
 * @route   DELETE /api/users/:id/permanent
 * @desc    Permanently delete user
 * @access  Protected - Admin only
 */
router.delete(
  '/:id/permanent',
  authorize(UserRole.ADMIN),
  validateParams(idParamSchema),
  asyncHandler(permanentDeleteUser)
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete (deactivate) user
 * @access  Protected - Admin only
 */
router.delete('/:id', authorize(UserRole.ADMIN), validateParams(idParamSchema), asyncHandler(deleteUser));

export default router;
