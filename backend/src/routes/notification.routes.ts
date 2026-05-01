/**
 * Notification Routes
 * All routes require authentication
 */

import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateParams } from '../middleware/validation.middleware';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/notifications
 * @desc    Get notifications for current user (paginated)
 * @query   page, limit, unreadOnly
 * @access  All authenticated users
 */
router.get('/', asyncHandler(getNotifications));

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  All authenticated users
 */
router.get('/unread-count', asyncHandler(getUnreadCount));

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  All authenticated users (own notifications only)
 */
router.patch('/:id/read', validateParams(idParamSchema), asyncHandler(markAsRead));

/**
 * @route   POST /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  All authenticated users
 */
router.post('/mark-all-read', asyncHandler(markAllAsRead));

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  All authenticated users (own notifications only)
 */
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteNotification));

export default router;
