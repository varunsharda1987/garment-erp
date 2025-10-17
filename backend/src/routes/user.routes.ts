// User management routes
import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserRole,
  deleteUser,
} from '../controllers/user.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/users
 * @desc    Get all users (paginated)
 * @access  Protected - All authenticated users
 */
router.get('/', getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Protected - All authenticated users
 */
router.get('/:id', getUserById);

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Protected - Admin only
 */
router.post('/', authorize(UserRole.ADMIN), createUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user (users can update themselves, admins can update anyone)
 * @access  Protected - Self or Admin
 */
router.put('/:id', updateUser);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Update user role
 * @access  Protected - Admin only
 */
router.put('/:id/role', authorize(UserRole.ADMIN), updateUserRole);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete (deactivate) user
 * @access  Protected - Admin only
 */
router.delete('/:id', authorize(UserRole.ADMIN), deleteUser);

export default router;
