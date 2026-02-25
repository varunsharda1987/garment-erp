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
 * @route   GET /api/users/pending
 * @desc    Get users pending approval
 * @access  Protected - Admin only
 */
router.get('/pending', authorize(UserRole.ADMIN), getPendingUsers);

/**
 * @route   POST /api/users/:id/approve
 * @desc    Approve user registration
 * @access  Protected - Admin only
 */
router.post('/:id/approve', authorize(UserRole.ADMIN), approveUser);

/**
 * @route   POST /api/users/:id/reject
 * @desc    Reject user registration
 * @access  Protected - Admin only
 */
router.post('/:id/reject', authorize(UserRole.ADMIN), rejectUser);

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
 * @route   PUT /api/users/:id/change-password
 * @desc    Change user password
 * @access  Protected - Self only
 */
router.put('/:id/change-password', changePassword);

/**
 * @route   DELETE /api/users/:id/permanent
 * @desc    Permanently delete user
 * @access  Protected - Admin only
 */
router.delete('/:id/permanent', authorize(UserRole.ADMIN), permanentDeleteUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete (deactivate) user
 * @access  Protected - Admin only
 */
router.delete('/:id', authorize(UserRole.ADMIN), deleteUser);

export default router;
